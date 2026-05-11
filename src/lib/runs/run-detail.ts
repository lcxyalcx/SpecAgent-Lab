import type { AgentMode, RunStatus, ToolCallStatus } from "@prisma/client";

export type WorkflowMode = "baseline" | "draft_verifier" | "other";

export type TimelineStepKind =
  | "user"
  | "draft"
  | "tool"
  | "verifier"
  | "final"
  | "note";

export type TimelineStep = {
  kind: TimelineStepKind;
  title: string;
  body: string;
  meta?: string;
};

export type DraftVerifierView = {
  draftAnswer: string;
  draftPlan: string[];
  expectedToolCalls: string[];
  draftLatencyMs?: number;
  verifierDecision: string;
  verifierReason: string;
  confidenceScore: number;
  verifierLatencyMs?: number;
  draftAccepted: boolean | null;
};

export type ToolCallView = {
  id: string;
  sequence: number;
  toolName: string;
  status: ToolCallStatus;
  latencyMs: number | null;
  input: unknown;
  output: unknown;
  error: unknown;
};

export type RunDetailViewModel = {
  id: string;
  name: string;
  status: RunStatus;
  createdAt: string;
  workflowMode: WorkflowMode;
  modeLabel: string;
  agentMode: AgentMode;
  modelsLabel: string;
  summaryHints: {
    draftAccepted: boolean | null;
    verifierReason: string | null;
    verifierDecision: string | null;
    draftAcceptanceRate: number | null;
  };
  benchmarkMeta: {
    benchmarkId?: string;
    taskTitle?: string;
    category?: string;
    difficulty?: string | number;
  };
  userPrompt: string | null;
  systemPrompt: string | null;
  enabledTools: unknown;
  rawInput: unknown;
  finalAnswer: string | null;
  rawOutput: unknown;
  errorMessage: string | null;
  latencyMs: number | null;
  costUsd: number | null;
  taskSuccessScore: number | null;
  taskSuccessLabel: "strong" | "ok" | "weak" | "unknown";
  toolErrorRate: number | null;
  toolCallCount: number;
  toolErrorCount: number;
  evaluationMethod: string | null;
  evaluationExplanation: string | null;
  reasoningQualityScore: number | null;
  constraintSatisfactionScore: number | null;
  toolUseScore: number | null;
  draftVerifier: DraftVerifierView | null;
  toolCalls: ToolCallView[];
  productInterpretation: string[];
};

function firstNumber(...candidates: unknown[]): number | null {
  for (const value of candidates) {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value);
      if (!Number.isNaN(n)) {
        return n;
      }
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function workflowFromAgentMode(mode: AgentMode): WorkflowMode {
  if (mode === "BASELINE") {
    return "baseline";
  }
  if (mode === "DRAFT_VERIFIER") {
    return "draft_verifier";
  }
  return "other";
}

function normalizeDifficulty(value: unknown): string | number | undefined {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  return undefined;
}

function modeLabel(workflow: WorkflowMode, inputMode: string | undefined) {
  if (inputMode === "baseline" || workflow === "baseline") {
    return "单代理";
  }
  if (inputMode === "draft_verifier" || workflow === "draft_verifier") {
    return "草稿 + 校验";
  }
  return "其它 / 试运行";
}

export function buildRunDetailViewModel(row: {
  id: string;
  name: string;
  status: RunStatus;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  input: unknown;
  output: unknown;
  summary: unknown;
  metrics: unknown;
  agentConfig: { mode: AgentMode; model: string; name: string };
  benchmarkTask: { title: string; category: string; difficulty: number } | null;
  toolCalls: Array<{
    id: string;
    sequence: number;
    toolName: string;
    status: ToolCallStatus;
    latencyMs: number | null;
    input: unknown;
    output: unknown;
    error: unknown;
  }>;
}): RunDetailViewModel {
  const inputRec = asRecord(row.input);
  const outputRec = asRecord(row.output);
  const summaryRec = asRecord(row.summary);
  const metricsRec = asRecord(row.metrics);

  const inputMode =
    typeof inputRec?.mode === "string" ? inputRec.mode : undefined;
  const workflowMode = workflowFromAgentMode(row.agentConfig.mode);

  const userPrompt =
    typeof inputRec?.userPrompt === "string"
      ? inputRec.userPrompt
      : typeof inputRec?.userRequest === "string"
        ? inputRec.userRequest
        : null;

  const systemPrompt =
    typeof inputRec?.systemPrompt === "string" ? inputRec.systemPrompt : null;

  const finalAnswer =
    typeof outputRec?.outputText === "string"
      ? outputRec.outputText
      : typeof outputRec?.finalAnswer === "string"
        ? outputRec.finalAnswer
        : null;

  const errorMessage =
    typeof outputRec?.error === "string" && outputRec.error.trim() !== ""
      ? outputRec.error
      : null;

  const latencyWindow =
    row.startedAt && row.finishedAt
      ? Math.max(0, row.finishedAt.getTime() - row.startedAt.getTime())
      : null;

  const latencyMs = firstNumber(
    metricsRec?.latencyMs,
    metricsRec?.averageLatencyMs,
    latencyWindow,
  );

  const costUsd = firstNumber(
    metricsRec?.estimatedCostUsd,
    metricsRec?.estimatedCostPerTaskUsd,
    metricsRec?.averageCostUsd,
  );

  const taskSuccessScore = firstNumber(
    metricsRec?.taskSuccessScore,
    metricsRec?.taskSuccessRate,
    summaryRec?.taskSuccessScore,
  );

  const toolErrorRate = firstNumber(metricsRec?.toolErrorRate);
  const toolCallCount = firstNumber(metricsRec?.toolCallCount) ?? row.toolCalls.length;
  const toolErrorCount =
    firstNumber(metricsRec?.toolErrorCount) ??
    row.toolCalls.filter((t) => t.status !== "SUCCEEDED").length;

  const evaluationMethod =
    typeof metricsRec?.evaluationMethod === "string"
      ? metricsRec.evaluationMethod
      : typeof summaryRec?.evaluationMethod === "string"
        ? summaryRec.evaluationMethod
        : null;

  const evaluationExplanation =
    typeof metricsRec?.evaluationExplanation === "string"
      ? metricsRec.evaluationExplanation
      : typeof summaryRec?.evaluationExplanation === "string"
        ? summaryRec.evaluationExplanation
        : null;

  const summaryDraftAccepted =
    typeof summaryRec?.draftAccepted === "boolean"
      ? summaryRec.draftAccepted
      : null;
  const summaryVerifierReason =
    typeof summaryRec?.verifierReason === "string" ? summaryRec.verifierReason : null;
  const summaryVerifierDecision =
    typeof summaryRec?.verifierDecision === "string"
      ? summaryRec.verifierDecision
      : typeof summaryRec?.verifierDecision === "number"
        ? String(summaryRec.verifierDecision)
        : null;
  const metricsDraftAcceptance = firstNumber(metricsRec?.draftAcceptanceRate);

  const reasoningQualityScore = firstNumber(metricsRec?.reasoningQualityScore);
  const constraintSatisfactionScore = firstNumber(
    metricsRec?.constraintSatisfactionScore,
  );
  const toolUseScore = firstNumber(metricsRec?.toolUseScore);

  const draftRec = outputRec?.draft ? asRecord(outputRec.draft) : null;
  const verifierRec = outputRec?.verifier ? asRecord(outputRec.verifier) : null;

  let draftVerifier: DraftVerifierView | null = null;

  if (draftRec && verifierRec) {
    const draftAnswer =
      typeof draftRec.draftAnswer === "string" ? draftRec.draftAnswer : "";
    const draftPlan = Array.isArray(draftRec.draftPlan)
      ? draftRec.draftPlan.filter((x): x is string => typeof x === "string")
      : [];
    const expectedToolCalls = Array.isArray(draftRec.expectedToolCalls)
      ? draftRec.expectedToolCalls.filter((x): x is string => typeof x === "string")
      : [];
    const verifierDecision =
      typeof verifierRec.decision === "string" ? verifierRec.decision : "—";
    const verifierReason =
      typeof verifierRec.reason === "string" ? verifierRec.reason : "—";
    const confidenceScore = firstNumber(verifierRec.confidenceScore) ?? 0;
    const draftLatencyMs = firstNumber(draftRec.latencyMs) ?? undefined;
    const verifierLatencyMs = firstNumber(verifierRec.latencyMs) ?? undefined;

    const draftAccepted =
      typeof summaryRec?.draftAccepted === "boolean"
        ? summaryRec.draftAccepted
        : typeof metricsRec?.draftAccepted === "boolean"
          ? metricsRec.draftAccepted
          : verifierDecision === "accept"
            ? true
            : verifierDecision === "reject"
              ? false
              : null;

    draftVerifier = {
      draftAnswer,
      draftPlan,
      expectedToolCalls,
      draftLatencyMs,
      verifierDecision,
      verifierReason,
      confidenceScore,
      verifierLatencyMs,
      draftAccepted,
    };
  } else if (
    workflowMode === "draft_verifier" &&
    (summaryVerifierReason || summaryVerifierDecision)
  ) {
    draftVerifier = {
      draftAnswer: "",
      draftPlan: [],
      expectedToolCalls: [],
      verifierDecision: summaryVerifierDecision ?? "—",
      verifierReason: summaryVerifierReason ?? "（未记录详细审核说明）",
      confidenceScore:
        firstNumber(summaryRec?.confidenceScore, metricsRec?.averageConfidenceScore) ?? 0,
      draftAccepted: summaryDraftAccepted,
    };
  }

  const toolCalls: ToolCallView[] = row.toolCalls.map((t) => ({
    id: t.id,
    sequence: t.sequence,
    toolName: t.toolName,
    status: t.status,
    latencyMs: t.latencyMs,
    input: t.input,
    output: t.output,
    error: t.error,
  }));

  const vm: RunDetailViewModel = {
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    workflowMode,
    modeLabel: modeLabel(workflowMode, inputMode),
    agentMode: row.agentConfig.mode,
    modelsLabel: row.agentConfig.model,
    summaryHints: {
      draftAccepted: summaryDraftAccepted,
      verifierReason: summaryVerifierReason,
      verifierDecision: summaryVerifierDecision,
      draftAcceptanceRate: metricsDraftAcceptance,
    },
    benchmarkMeta: {
      benchmarkId:
        typeof inputRec?.benchmarkId === "string" ? inputRec.benchmarkId : undefined,
      taskTitle:
        typeof inputRec?.taskTitle === "string"
          ? inputRec.taskTitle
          : row.benchmarkTask?.title,
      category:
        typeof inputRec?.category === "string"
          ? inputRec.category
          : row.benchmarkTask?.category,
      difficulty: normalizeDifficulty(inputRec?.difficulty ?? row.benchmarkTask?.difficulty),
    },
    userPrompt,
    systemPrompt,
    enabledTools: inputRec?.enabledTools ?? null,
    rawInput: row.input,
    finalAnswer,
    rawOutput: row.output,
    errorMessage,
    latencyMs,
    costUsd,
    taskSuccessScore: taskSuccessScore === null ? null : clamp01(taskSuccessScore),
    taskSuccessLabel: successLabel(taskSuccessScore, row.status),
    toolErrorRate: toolErrorRate === null ? null : clamp01(toolErrorRate),
    toolCallCount: Math.round(toolCallCount),
    toolErrorCount: Math.round(toolErrorCount),
    evaluationMethod,
    evaluationExplanation,
    reasoningQualityScore:
      reasoningQualityScore === null ? null : clamp01(reasoningQualityScore),
    constraintSatisfactionScore:
      constraintSatisfactionScore === null ? null : clamp01(constraintSatisfactionScore),
    toolUseScore: toolUseScore === null ? null : clamp01(toolUseScore),
    draftVerifier,
    toolCalls,
    productInterpretation: [],
  };

  vm.productInterpretation = buildProductInterpretation(vm);
  return vm;
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function successLabel(score: number | null, status: RunStatus): RunDetailViewModel["taskSuccessLabel"] {
  if (score === null) {
    return status === "SUCCEEDED" ? "ok" : "unknown";
  }
  if (score >= 0.78) {
    return "strong";
  }
  if (score >= 0.55) {
    return "ok";
  }
  return "weak";
}

const LATENCY_OK_MS = 20_000;

export function buildTimelineSteps(vm: RunDetailViewModel): TimelineStep[] {
  const steps: TimelineStep[] = [];

  const userBody =
    vm.userPrompt?.trim() ||
    (vm.rawInput ? JSON.stringify(vm.rawInput, null, 2) : "（未记录用户输入）");

  steps.push({
    kind: "user",
    title: "用户输入",
    body: userBody,
    meta: vm.benchmarkMeta.taskTitle
      ? `任务：${vm.benchmarkMeta.taskTitle}`
      : undefined,
  });

  if (vm.draftVerifier && vm.draftVerifier.draftAnswer.trim()) {
    const plan =
      vm.draftVerifier.draftPlan.length > 0
        ? `\n\n计划：\n${vm.draftVerifier.draftPlan.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
        : "";
    const tools =
      vm.draftVerifier.expectedToolCalls.length > 0
        ? `\n\n预期工具：${vm.draftVerifier.expectedToolCalls.join(", ")}`
        : "";
    steps.push({
      kind: "draft",
      title: "草稿阶段",
      body: `${vm.draftVerifier.draftAnswer}${plan}${tools}`,
      meta:
        vm.draftVerifier.draftLatencyMs != null
          ? `草稿耗时 ${vm.draftVerifier.draftLatencyMs} ms`
          : undefined,
    });
  } else if (vm.workflowMode === "draft_verifier") {
    steps.push({
      kind: "note",
      title: "草稿阶段",
      body: "本次运行未持久化完整草稿对象，只能从最终输出和审核摘要里反推流程。",
    });
  }

  if (vm.toolCalls.length > 0) {
    for (const call of vm.toolCalls) {
      const ok = call.status === "SUCCEEDED";
      steps.push({
        kind: "tool",
        title: `工具 · ${call.toolName}`,
        body: summarizeToolCall(call),
        meta: `${ok ? "成功" : "失败"}${call.latencyMs != null ? ` · ${call.latencyMs} ms` : ""}`,
      });
    }
  }

  if (vm.workflowMode === "draft_verifier") {
    if (vm.draftVerifier) {
      const reason = vm.draftVerifier.verifierReason.trim();
      steps.push({
        kind: "verifier",
        title: "审核阶段",
        body: reason || `（未记录详细审核说明，当前决定：${vm.draftVerifier.verifierDecision}）`,
        meta: `决定：${vm.draftVerifier.verifierDecision} · 置信度 ${Math.round(vm.draftVerifier.confidenceScore * 100)}%${
          vm.draftVerifier.verifierLatencyMs != null
            ? ` · ${vm.draftVerifier.verifierLatencyMs} ms`
            : ""
        }`,
      });
    } else if (vm.summaryHints.verifierReason || vm.summaryHints.verifierDecision) {
      steps.push({
        kind: "verifier",
        title: "审核摘要",
        body:
          vm.summaryHints.verifierReason?.trim() ||
          "（数据库 summary 中只保留了决策标记，没有更详细的审核说明。）",
        meta: vm.summaryHints.verifierDecision
          ? `决定：${vm.summaryHints.verifierDecision}`
          : undefined,
      });
    }
  }

  const finalText =
    vm.finalAnswer?.trim() ||
    (vm.status === "SUCCEEDED" ? "（无文本输出）" : "（运行未成功完成）");

  steps.push({
    kind: "final",
    title: "最终回答",
    body: finalText,
    meta: vm.errorMessage ? `错误：${vm.errorMessage}` : undefined,
  });

  return steps;
}

function summarizeToolCall(call: ToolCallView): string {
  const parts: string[] = [];
  if (call.input !== undefined && call.input !== null) {
    parts.push(`输入：${safeJson(call.input)}`);
  }
  if (call.output !== undefined && call.output !== null) {
    parts.push(`输出：${safeJson(call.output)}`);
  }
  if (call.error !== undefined && call.error !== null) {
    parts.push(`错误：${safeJson(call.error)}`);
  }
  return parts.length > 0 ? parts.join("\n\n") : "（无详细负载）";
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function buildProductInterpretation(vm: RunDetailViewModel): string[] {
  const lines: string[] = [];

  const successPct =
    vm.taskSuccessScore != null ? Math.round(vm.taskSuccessScore * 100) : null;

  if (vm.status === "SUCCEEDED" && vm.taskSuccessLabel === "strong") {
    lines.push(
      `本次运行表现较好（任务成功分约 ${successPct ?? "—"}%）：回答与评分标准整体一致，可以作为当前配置的稳定样本。`,
    );
  } else if (vm.status === "SUCCEEDED" && vm.taskSuccessLabel === "ok") {
    lines.push(
      `回答基本达标（成功分约 ${successPct ?? "—"}%）：能完成主任务，但可能在约束覆盖或细节上仍有改进空间。`,
    );
  } else if (vm.status === "SUCCEEDED") {
    lines.push(
      `虽然运行状态为成功，但成功分偏低（约 ${successPct ?? "—"}%），说明当前回答还没有稳定满足要求，建议结合工具过程继续排查。`,
    );
  } else {
    lines.push(
      "这次运行没有成功完成，建议优先查看错误信息和工具失败项，而不是先解读回答质量。",
    );
  }

  if (vm.latencyMs != null) {
    const ok = vm.latencyMs <= LATENCY_OK_MS;
    lines.push(
      ok
        ? `端到端耗时约 ${formatDuration(vm.latencyMs)}，处在当前参考阈值（≤ ${LATENCY_OK_MS / 1000}s）内，整体体验可接受。`
        : `端到端耗时约 ${formatDuration(vm.latencyMs)}，高于当前参考阈值（${LATENCY_OK_MS / 1000}s），可以继续优化速度与稳定性。`,
    );
  } else {
    lines.push("暂未记录可靠耗时，建议在批量测试链路中确保写入 metrics.latencyMs 或起止时间。");
  }

  if (vm.toolCallCount === 0) {
    lines.push("未调用工具：若任务依赖外部数据，这可能意味着纯生成回答；若任务本不需工具，则属正常。");
  } else if ((vm.toolErrorRate ?? 0) <= 0.05) {
    lines.push(
      `工具链路整体健康（${vm.toolErrorCount}/${vm.toolCallCount} 次失败，错误率约 ${Math.round((vm.toolErrorRate ?? 0) * 100)}%），对最终答案起到支撑作用。`,
    );
  } else {
    lines.push(
      `工具调用存在明显摩擦（错误率约 ${Math.round((vm.toolErrorRate ?? 0) * 100)}%），很可能会拖累成功率和整体耗时。`,
    );
  }

  if (vm.workflowMode === "draft_verifier") {
    if (vm.draftVerifier) {
      if (vm.draftVerifier.draftAccepted === true) {
        lines.push("草稿被接受，说明初稿方向已经满足要求，草稿加校验模式有机会兼顾质量和效率。");
      } else if (vm.draftVerifier.draftAccepted === false) {
        lines.push("草稿未被接受，说明审核阶段做了修订或拒绝，质量更稳一些，但也可能增加耗时。");
      } else {
        lines.push(
          `本次审核决定为「${vm.draftVerifier.verifierDecision}」，可以结合审核说明判断是策略问题还是提示词问题。`,
        );
      }
    } else if (vm.summaryHints.draftAcceptanceRate != null) {
      lines.push(
        `指标中的草稿接受率约为 ${Math.round(vm.summaryHints.draftAcceptanceRate * 100)}%，可以用来判断草稿阶段的一次命中程度。`,
      );
    }
    if (vm.summaryHints.verifierDecision && !vm.draftVerifier) {
      lines.push(
        `摘要中记录了审核决定：${vm.summaryHints.verifierDecision}。可以和耗时、费用一起看这次权衡是否值得。`,
      );
    }
  } else if (vm.workflowMode === "baseline") {
    lines.push("单代理模式适合作为默认方案或对照组，用来和草稿加校验比较质量、速度和成本。");
  }

  return lines;
}

function formatDuration(ms: number) {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)} s（${ms.toLocaleString()} ms）`;
  }
  return `${ms} ms`;
}
