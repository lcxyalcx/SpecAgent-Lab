import {
  AgentMode,
  type AgentConfig,
  type BenchmarkTask as PrismaBenchmarkTask,
  Prisma,
  RunStatus,
  ToolCallStatus,
} from "@prisma/client";

import {
  runBaselineAgent,
  type RunResult,
} from "@/lib/agents/baseline-agent";
import {
  runDraftVerifierAgent,
  type DraftVerifierRunResult,
} from "@/lib/agents/draft-verifier-agent";
import { evaluateBenchmarkRun } from "@/lib/benchmark/evaluator";
import {
  benchmarkTaskLibrary,
  type BenchmarkTaskDefinition,
} from "@/lib/benchmark/tasks";
import { sanitizeApiProviderConfig } from "@/lib/ai/config";
import type { ApiProviderConfigInput } from "@/lib/ai/config";
import { getDefaultAgentModels } from "@/lib/ai/provider";
import { getPrisma } from "@/lib/db";

export type BenchmarkMode = "baseline" | "draft_verifier";

export type BenchmarkRunnerInput = {
  taskIds: string[];
  modes: BenchmarkMode[];
  /** When set, scores also come from an LLM judge (requires a configured model provider). */
  useLlmJudge?: boolean;
  providerConfig?: ApiProviderConfigInput;
  persistRuns?: boolean;
};

export type BenchmarkRunMetrics = {
  taskSuccessScore: number;
  reasoningQualityScore: number;
  constraintSatisfactionScore: number;
  toolUseScore: number;
  evaluationExplanation: string;
  evaluationMethod: "heuristic" | "llm_judge";
  latencyMs: number;
  estimatedCostUsd: number;
  toolErrorRate: number;
  draftAcceptanceRate: number | null;
  averageConfidenceScore: number | null;
};

export type BenchmarkRunRow = {
  runId: string;
  persisted: boolean;
  taskId: string;
  taskTitle: string;
  category: BenchmarkTaskDefinition["category"];
  difficulty: BenchmarkTaskDefinition["difficulty"];
  mode: BenchmarkMode;
  status: "succeeded" | "failed";
  outputText: string;
  metrics: BenchmarkRunMetrics;
  toolCallCount: number;
  toolErrorCount: number;
  draftAccepted: boolean | null;
  verifierReason: string | null;
  error: string | null;
};

export type BenchmarkAggregateRow = {
  mode: BenchmarkMode;
  runCount: number;
  averageTaskSuccessScore: number;
  averageReasoningQualityScore: number;
  averageConstraintSatisfactionScore: number;
  averageToolUseScore: number;
  averageLatencyMs: number;
  averageEstimatedCostUsd: number;
  averageToolErrorRate: number;
  draftAcceptanceRate: number | null;
  averageConfidenceScore: number | null;
};

export type BenchmarkRunnerResult = {
  benchmarkId: string;
  persisted: boolean;
  results: BenchmarkRunRow[];
  aggregates: BenchmarkAggregateRow[];
};

export async function runBenchmark(
  input: BenchmarkRunnerInput,
): Promise<BenchmarkRunnerResult> {
  const useLlmJudge = input.useLlmJudge === true;
  const defaultModels = getDefaultAgentModels(input.providerConfig);
const benchmarkId = `bench_${Date.now()}`;
  const tasks = benchmarkTaskLibrary.filter((task) => input.taskIds.includes(task.id));
  let persistenceContext: {
    prisma: ReturnType<typeof getPrisma>;
    modeConfigs: Map<BenchmarkMode, AgentConfig>;
  } | null = null;

  if (input.persistRuns === true) {
    try {
      const prisma = getPrisma();
      const modeConfigs = await createModeConfigs(
        prisma,
        input.modes,
        input.providerConfig,
      );
      persistenceContext = { prisma, modeConfigs };
    } catch (error) {
      console.error("Benchmark persistence unavailable", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const results: BenchmarkRunRow[] = [];

  for (const task of tasks) {
    let persistedTask: PrismaBenchmarkTask | null = null;

    if (persistenceContext) {
      try {
        persistedTask = await ensureBenchmarkTaskRecord(
          persistenceContext.prisma,
          task,
        );
      } catch (error) {
        console.error("Benchmark task persistence failed", {
          taskId: task.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        persistenceContext = null;
      }
    }

    for (const mode of input.modes) {
      const runResult =
        mode === "baseline"
          ? await runBaselineAgent({
              systemPrompt: buildBenchmarkSystemPrompt(task, mode),
              userPrompt: buildBenchmarkUserPrompt(task),
              model: defaultModels.baseline,
              enabledTools: defaultEnabledToolsForTask(task),
              benchmarkTaskId: task.id,
              providerConfig: input.providerConfig,
            })
          : await runDraftVerifierAgent({
              systemPrompt: buildBenchmarkSystemPrompt(task, mode),
              userPrompt: buildBenchmarkUserPrompt(task),
              draftModel: defaultModels.draft,
              verifierModel: defaultModels.verifier,
              enabledTools: defaultEnabledToolsForTask(task),
              benchmarkTaskId: task.id,
              providerConfig: input.providerConfig,
            });

      const metrics = await buildBenchmarkMetrics(
        task,
        mode,
        runResult,
        useLlmJudge,
        input.providerConfig,
      );
      let runId = createTransientBenchmarkRunId(benchmarkId, mode, task.id);
      let persisted = false;

      if (persistenceContext && persistedTask) {
        try {
          const persistedRun = await persistenceContext.prisma.run.create({
            data: {
              name: `${benchmarkId} · ${getModeLabel(mode)} · ${getTaskDisplayTitle(task.id, task.title)}`,
              agentConfigId: persistenceContext.modeConfigs.get(mode)!.id,
              benchmarkTaskId: persistedTask.id,
              status:
                runResult.status === "succeeded"
                  ? RunStatus.SUCCEEDED
                  : RunStatus.FAILED,
              input: toJsonValue({
                benchmarkId,
                mode,
                taskId: task.id,
                taskTitle: task.title,
                category: task.category,
                difficulty: task.difficulty,
                systemPrompt: buildBenchmarkSystemPrompt(task, mode),
                userPrompt: buildBenchmarkUserPrompt(task),
                enabledTools: defaultEnabledToolsForTask(task),
                useLlmJudge,
                providerConfig: sanitizeApiProviderConfig(input.providerConfig),
              }),
              output: toJsonValue(buildRunOutput(runResult)),
              summary: toJsonValue({
                benchmarkId,
                mode,
                taskSuccessScore: metrics.taskSuccessScore,
                evaluationMethod: metrics.evaluationMethod,
                evaluationExplanation: metrics.evaluationExplanation,
                reasoningQualityScore: metrics.reasoningQualityScore,
                constraintSatisfactionScore: metrics.constraintSatisfactionScore,
                toolUseScore: metrics.toolUseScore,
                verifierReason:
                  isDraftVerifierRunResult(runResult) ? runResult.verifier.reason : null,
                draftAccepted:
                  isDraftVerifierRunResult(runResult) ? runResult.metrics.draftAccepted : null,
              }),
              metrics: toJsonValue({
                ...metrics,
                toolCallCount: runResult.metrics.toolCallCount,
                toolErrorCount: runResult.metrics.toolErrorCount,
                totalTokens: runResult.metrics.totalTokens,
              }),
              startedAt: new Date(runResult.startedAt),
              finishedAt: new Date(runResult.finishedAt),
            },
          });

          if (runResult.toolCalls.length > 0) {
            await persistenceContext.prisma.toolCall.createMany({
              data: runResult.toolCalls.map((toolCall, index) => ({
                runId: persistedRun.id,
                toolName: toolCall.toolName,
                sequence: index + 1,
                status: toolCall.success
                  ? ToolCallStatus.SUCCEEDED
                  : ToolCallStatus.FAILED,
                input: toJsonValue(toolCall.input),
                output: toJsonValue(toolCall.output),
                error: toJsonValue(
                  toolCall.error ? { message: toolCall.error } : null,
                ),
                latencyMs: toolCall.latencyMs,
              })),
            });
          }

          runId = persistedRun.id;
          persisted = true;
        } catch (error) {
          console.error("Benchmark run persistence failed", {
            benchmarkId,
            mode,
            taskId: task.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          persistenceContext = null;
        }
      }

      results.push({
        runId,
        persisted,
        taskId: task.id,
        taskTitle: task.title,
        category: task.category,
        difficulty: task.difficulty,
        mode,
        status: runResult.status,
        outputText: runResult.outputText,
        metrics,
        toolCallCount: runResult.metrics.toolCallCount,
        toolErrorCount: runResult.metrics.toolErrorCount,
        draftAccepted:
          isDraftVerifierRunResult(runResult) ? runResult.metrics.draftAccepted : null,
        verifierReason: isDraftVerifierRunResult(runResult)
          ? runResult.verifier.reason
          : null,
        error: runResult.error,
      });
    }
  }

  return {
    benchmarkId,
    persisted: results.length > 0 && results.every((result) => result.persisted),
    results,
    aggregates: buildAggregates(results),
  };
}

async function createModeConfigs(
  prisma: ReturnType<typeof getPrisma>,
  modes: BenchmarkMode[],
  providerConfig?: ApiProviderConfigInput,
) {
  const configs = new Map<BenchmarkMode, AgentConfig>();
  const defaultModels = getDefaultAgentModels(providerConfig);

  for (const mode of modes) {
    const config = await prisma.agentConfig.create({
      data: {
        name:
          mode === "baseline"
            ? `批量测试单代理 ${Date.now()}`
            : `批量测试草稿校验 ${Date.now()}`,
        mode: mode === "baseline" ? AgentMode.BASELINE : AgentMode.DRAFT_VERIFIER,
        model:
          mode === "baseline"
            ? defaultModels.baseline
            : `${defaultModels.draft} -> ${defaultModels.verifier}`,
        systemPrompt:
          mode === "baseline"
            ? "用于批量测试的单代理默认配置。"
            : "用于批量测试的草稿加校验默认配置。",
        enabledTools: toJsonValue(["calculator", "mockSearch", "productDb", "calendar"]),
        toolConfig: toJsonValue({
          source: "benchmark-runner",
          mode,
          providerConfig: sanitizeApiProviderConfig(providerConfig),
        }),
      },
    });

    configs.set(mode, config);
  }

  return configs;
}

function getModeLabel(mode: BenchmarkMode) {
  return mode === "baseline" ? "单代理" : "草稿 + 校验";
}

function getTaskDisplayTitle(taskId: string, fallback: string) {
  const labels: Record<string, string> = {
    "travel-europe-family-itinerary": "预算内的欧洲亲子行程规划",
    "support-refund-escalation": "处理带政策边界的退款请求",
    "prd-clarification-for-ai-feature": "澄清模糊的 AI 功能需求",
    "sales-dataset-diagnosis": "诊断销售漏斗转化下滑",
    "codebase-bug-fix-guidance": "排查 Web 应用中的异步疑难问题",
    "executive-meeting-synthesis": "整理混乱的管理层会议记录",
    "laptop-recommendation-tradeoffs": "在需求变化下推荐合适笔记本",
    "quarterly-team-budget-plan": "规划季度团队预算",
    "vendor-selection-under-constraints": "在多重约束下选择供应商",
    "agent-self-correction-after-misread": "在误解需求后完成自我纠偏",
  };

  return labels[taskId] ?? fallback;
}

async function ensureBenchmarkTaskRecord(
  prisma: ReturnType<typeof getPrisma>,
  task: BenchmarkTaskDefinition,
) {
  const existing = await prisma.benchmarkTask.findUnique({
    where: { slug: task.id },
  });

  if (existing) {
    return existing;
  }

  return prisma.benchmarkTask.create({
    data: {
      slug: task.id,
      title: getTaskDisplayTitle(task.id, task.title),
      description: task.expectedOutcome,
      category: task.category,
      difficulty: difficultyWeight(task.difficulty),
      conversation: [
        task.initialPrompt,
        task.userGoal,
        task.expectedOutcome,
      ],
      evaluationRubric: task.evaluationRubric,
      expectedTools: defaultEnabledToolsForTask(task),
      toolConfig: toJsonValue({
        source: "benchmark-library",
        deterministic: true,
      }),
    },
  });
}

function createTransientBenchmarkRunId(
  benchmarkId: string,
  mode: BenchmarkMode,
  taskId: string,
) {
  return `${benchmarkId}_${mode}_${taskId}`;
}

function buildBenchmarkSystemPrompt(
  task: BenchmarkTaskDefinition,
  mode: BenchmarkMode,
) {
  return [
    "You are being evaluated on a deterministic multi-turn benchmark task.",
    mode === "baseline"
      ? "Solve the task directly and use tools only when they improve correctness."
      : "You are part of a speculative-style draft-verifier workflow. Preserve quality while keeping latency and cost efficient.",
    `Task category: ${task.category}.`,
    `Difficulty: ${task.difficulty}.`,
    `Expected outcome: ${task.expectedOutcome}`,
    `Rubric focus: ${task.evaluationRubric.scoringNotes}`,
  ].join("\n\n");
}

function buildBenchmarkUserPrompt(task: BenchmarkTaskDefinition) {
  return [
    task.initialPrompt,
    `User goal: ${task.userGoal}`,
    "Respond as if this is the current turn of a realistic multi-turn workflow. Be concrete and helpful.",
  ].join("\n\n");
}

function defaultEnabledToolsForTask(task: BenchmarkTaskDefinition) {
  const categoryToolMap: Record<BenchmarkTaskDefinition["category"], Array<"calculator" | "mockSearch" | "productDb" | "calendar">> = {
    "travel-planning": ["mockSearch", "calendar", "calculator"],
    "customer-support": ["mockSearch", "calculator"],
    "product-requirement-clarification": ["mockSearch"],
    "data-analysis": ["calculator", "mockSearch"],
    "coding-assistant": ["mockSearch"],
    "meeting-summarization": ["mockSearch", "calendar"],
    "product-recommendation": ["productDb", "mockSearch", "calculator"],
    "budget-planning": ["calculator", "mockSearch"],
    "multi-constraint-decision-making": ["productDb", "mockSearch", "calculator"],
    "agent-self-correction": ["mockSearch"],
  };

  return categoryToolMap[task.category];
}

async function buildBenchmarkMetrics(
  task: BenchmarkTaskDefinition,
  mode: BenchmarkMode,
  runResult: RunResult | DraftVerifierRunResult,
  useLlmJudge: boolean,
  providerConfig?: ApiProviderConfigInput,
): Promise<BenchmarkRunMetrics> {
  const evaluation = await evaluateBenchmarkRun(
    {
      rubric: task.evaluationRubric,
      agentOutput: runResult.outputText,
      toolCalls: runResult.toolCalls.map((toolCall) => ({
        success: toolCall.success,
      })),
      runStatus: runResult.status,
      verifier: isDraftVerifierRunResult(runResult)
        ? {
            confidenceScore: runResult.verifier.confidenceScore,
            reason: runResult.verifier.reason,
            draftAccepted: runResult.metrics.draftAccepted,
          }
        : null,
    },
    { useLlmJudge, providerConfig },
  );

  const toolErrorRate =
    runResult.metrics.toolCallCount === 0
      ? 0
      : runResult.metrics.toolErrorCount / runResult.metrics.toolCallCount;
  const confidenceScore = isDraftVerifierRunResult(runResult)
    ? runResult.verifier.confidenceScore
    : null;
  const draftAcceptanceRate =
    mode === "draft_verifier" && isDraftVerifierRunResult(runResult)
      ? runResult.metrics.draftAcceptanceRate
      : null;

  return {
    taskSuccessScore: roundMetric(evaluation.taskSuccessScore),
    reasoningQualityScore: roundMetric(evaluation.reasoningQualityScore),
    constraintSatisfactionScore: roundMetric(evaluation.constraintSatisfactionScore),
    toolUseScore: roundMetric(evaluation.toolUseScore),
    evaluationExplanation: evaluation.explanation,
    evaluationMethod: evaluation.method,
    latencyMs: runResult.latencyMs,
    estimatedCostUsd: runResult.metrics.estimatedCostUsd,
    toolErrorRate: roundMetric(toolErrorRate),
    draftAcceptanceRate:
      draftAcceptanceRate === null ? null : roundMetric(draftAcceptanceRate),
    averageConfidenceScore:
      confidenceScore === null ? null : roundMetric(confidenceScore),
  };
}

function buildAggregates(results: BenchmarkRunRow[]) {
  return [...new Set(results.map((result) => result.mode))].map((mode) => {
    const modeResults = results.filter((result) => result.mode === mode);
    const draftRates = modeResults
      .map((result) => result.metrics.draftAcceptanceRate)
      .filter((value): value is number => value !== null);
    const confidenceScores = modeResults
      .map((result) => result.metrics.averageConfidenceScore)
      .filter((value): value is number => value !== null);

    return {
      mode,
      runCount: modeResults.length,
      averageTaskSuccessScore: roundMetric(
        average(modeResults.map((result) => result.metrics.taskSuccessScore)),
      ),
      averageReasoningQualityScore: roundMetric(
        average(modeResults.map((result) => result.metrics.reasoningQualityScore)),
      ),
      averageConstraintSatisfactionScore: roundMetric(
        average(
          modeResults.map((result) => result.metrics.constraintSatisfactionScore),
        ),
      ),
      averageToolUseScore: roundMetric(
        average(modeResults.map((result) => result.metrics.toolUseScore)),
      ),
      averageLatencyMs: Math.round(
        average(modeResults.map((result) => result.metrics.latencyMs)),
      ),
      averageEstimatedCostUsd: roundCurrency(
        average(modeResults.map((result) => result.metrics.estimatedCostUsd)),
      ),
      averageToolErrorRate: roundMetric(
        average(modeResults.map((result) => result.metrics.toolErrorRate)),
      ),
      draftAcceptanceRate:
        draftRates.length === 0 ? null : roundMetric(average(draftRates)),
      averageConfidenceScore:
        confidenceScores.length === 0
          ? null
          : roundMetric(average(confidenceScores)),
    };
  });
}

function buildRunOutput(runResult: RunResult | DraftVerifierRunResult) {
  if (isDraftVerifierRunResult(runResult)) {
    return {
      outputText: runResult.outputText,
      draft: runResult.draft,
      verifier: runResult.verifier,
      error: runResult.error,
    };
  }

  return {
    outputText: runResult.outputText,
    error: runResult.error,
  };
}

function difficultyWeight(difficulty: BenchmarkTaskDefinition["difficulty"]) {
  switch (difficulty) {
    case "easy":
      return 2;
    case "medium":
      return 3;
    case "hard":
      return 5;
  }
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMetric(value: number) {
  return Math.round(value * 1000) / 1000;
}

function roundCurrency(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function isDraftVerifierRunResult(
  runResult: RunResult | DraftVerifierRunResult,
): runResult is DraftVerifierRunResult {
  return "verifier" in runResult && "draft" in runResult;
}
