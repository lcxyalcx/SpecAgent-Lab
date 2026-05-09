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
import { getPrisma } from "@/lib/db";

export type BenchmarkMode = "baseline" | "draft_verifier";

export type BenchmarkRunnerInput = {
  taskIds: string[];
  modes: BenchmarkMode[];
  /** When set, scores also come from an LLM judge (requires OPENAI_API_KEY). */
  useLlmJudge?: boolean;
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
  results: BenchmarkRunRow[];
  aggregates: BenchmarkAggregateRow[];
};

const DEFAULT_BASELINE_MODEL = "gpt-5.4";
const DEFAULT_DRAFT_MODEL = "gpt-5.4-mini";
const DEFAULT_VERIFIER_MODEL = "gpt-5.4";

export async function runBenchmark(
  input: BenchmarkRunnerInput,
): Promise<BenchmarkRunnerResult> {
  const prisma = getPrisma();
  const useLlmJudge = input.useLlmJudge === true;
  const benchmarkId = `bench_${Date.now()}`;
  const tasks = benchmarkTaskLibrary.filter((task) => input.taskIds.includes(task.id));
  const modeConfigs = await createModeConfigs(input.modes);
  const persistedTaskMap = new Map<string, PrismaBenchmarkTask>();
  const results: BenchmarkRunRow[] = [];

  for (const task of tasks) {
    const persistedTask = await ensureBenchmarkTaskRecord(task);
    persistedTaskMap.set(task.id, persistedTask);

    for (const mode of input.modes) {
      const runResult =
        mode === "baseline"
          ? await runBaselineAgent({
              systemPrompt: buildBenchmarkSystemPrompt(task, mode),
              userPrompt: buildBenchmarkUserPrompt(task),
              model: DEFAULT_BASELINE_MODEL,
              enabledTools: defaultEnabledToolsForTask(task),
              benchmarkTaskId: task.id,
            })
          : await runDraftVerifierAgent({
              systemPrompt: buildBenchmarkSystemPrompt(task, mode),
              userPrompt: buildBenchmarkUserPrompt(task),
              draftModel: DEFAULT_DRAFT_MODEL,
              verifierModel: DEFAULT_VERIFIER_MODEL,
              enabledTools: defaultEnabledToolsForTask(task),
              benchmarkTaskId: task.id,
            });

      const metrics = await buildBenchmarkMetrics(task, mode, runResult, useLlmJudge);
      const persistedRun = await prisma.run.create({
        data: {
          name: `${benchmarkId} · ${mode} · ${task.title}`,
          agentConfigId: modeConfigs.get(mode)!.id,
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
        await prisma.toolCall.createMany({
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

      results.push({
        runId: persistedRun.id,
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
      });
    }
  }

  return {
    benchmarkId,
    results,
    aggregates: buildAggregates(results),
  };
}

async function createModeConfigs(modes: BenchmarkMode[]) {
  const prisma = getPrisma();
  const configs = new Map<BenchmarkMode, AgentConfig>();

  for (const mode of modes) {
    const config = await prisma.agentConfig.create({
      data: {
        name:
          mode === "baseline"
            ? `Benchmark baseline ${Date.now()}`
            : `Benchmark draft-verifier ${Date.now()}`,
        mode: mode === "baseline" ? AgentMode.BASELINE : AgentMode.DRAFT_VERIFIER,
        model:
          mode === "baseline"
            ? DEFAULT_BASELINE_MODEL
            : `${DEFAULT_DRAFT_MODEL} -> ${DEFAULT_VERIFIER_MODEL}`,
        systemPrompt:
          mode === "baseline"
            ? "Benchmark baseline configuration for multi-turn agent evaluation."
            : "Benchmark speculative-style draft-verifier configuration for multi-turn agent evaluation.",
        enabledTools: toJsonValue(["calculator", "mockSearch", "productDb", "calendar"]),
        toolConfig: toJsonValue({
          source: "benchmark-runner",
          mode,
        }),
      },
    });

    configs.set(mode, config);
  }

  return configs;
}

async function ensureBenchmarkTaskRecord(task: BenchmarkTaskDefinition) {
  const prisma = getPrisma();
  const existing = await prisma.benchmarkTask.findUnique({
    where: { slug: task.id },
  });

  if (existing) {
    return existing;
  }

  return prisma.benchmarkTask.create({
    data: {
      slug: task.id,
      title: task.title,
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
    { useLlmJudge },
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
