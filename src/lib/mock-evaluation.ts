export type TaskDomain = "planning" | "retrieval" | "tool-use" | "reasoning";

export type WorkflowMode = "baseline" | "draft-verifier";

export type BenchmarkTask = {
  id: string;
  title: string;
  domain: TaskDomain;
  difficulty: 1 | 2 | 3 | 4 | 5;
  turns: number;
  expectedTools: string[];
  successThreshold: number;
  prompt: string;
};

export type LabConfig = {
  baselineModel: string;
  draftModel: string;
  verifierModel: string;
  temperature: number;
  maxTurns: number;
  toolReliability: number;
  draftAggression: number;
};

export type TraceStep = {
  turn: number;
  actor: "user" | "baseline" | "draft" | "verifier" | "tool";
  label: string;
  status: "accepted" | "revised" | "called" | "answered";
  latencyMs: number;
};

export type EvaluationResult = {
  taskId: string;
  taskTitle: string;
  domain: TaskDomain;
  mode: WorkflowMode;
  success: boolean;
  score: number;
  latencyMs: number;
  tokenCostUsd: number;
  toolCalls: number;
  toolErrors: number;
  draftAcceptanceRate: number | null;
  turns: number;
  trace: TraceStep[];
};

export type AggregateMetrics = {
  successRate: number;
  averageScore: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  averageCostUsd: number;
  totalCostUsd: number;
  toolErrorRate: number;
  draftAcceptanceRate: number | null;
};

export type EvaluationSnapshot = {
  baselineResults: EvaluationResult[];
  draftVerifierResults: EvaluationResult[];
  baselineMetrics: AggregateMetrics;
  draftVerifierMetrics: AggregateMetrics;
};

export const DEFAULT_LAB_CONFIG: LabConfig = {
  baselineModel: "openai/gpt-5.4",
  draftModel: "openai/gpt-5.4-mini",
  verifierModel: "openai/gpt-5.4",
  temperature: 0.2,
  maxTurns: 6,
  toolReliability: 0.92,
  draftAggression: 0.58,
};

export const benchmarkTasks: BenchmarkTask[] = [
  {
    id: "task-supplier-risk",
    title: "Supplier risk triage",
    domain: "retrieval",
    difficulty: 3,
    turns: 4,
    expectedTools: ["knowledge.search", "spreadsheet.lookup", "email.draft"],
    successThreshold: 0.78,
    prompt: "Classify supplier risk from a contract note, shipment log, and policy excerpt.",
  },
  {
    id: "task-refund-policy",
    title: "Refund policy resolution",
    domain: "tool-use",
    difficulty: 2,
    turns: 3,
    expectedTools: ["order.lookup", "policy.match"],
    successThreshold: 0.72,
    prompt: "Resolve a customer refund request with order status, policy constraints, and escalation rules.",
  },
  {
    id: "task-release-plan",
    title: "Release readiness plan",
    domain: "planning",
    difficulty: 4,
    turns: 5,
    expectedTools: ["issue.search", "calendar.check", "doc.summarize"],
    successThreshold: 0.82,
    prompt: "Build a launch readiness plan from open issues, owner availability, and rollout gates.",
  },
  {
    id: "task-data-recon",
    title: "Data reconciliation",
    domain: "reasoning",
    difficulty: 5,
    turns: 6,
    expectedTools: ["warehouse.query", "spreadsheet.diff", "ticket.create"],
    successThreshold: 0.86,
    prompt: "Explain a revenue mismatch across two exports and create a precise follow-up ticket.",
  },
  {
    id: "task-prioritize-inbox",
    title: "Inbox prioritization",
    domain: "planning",
    difficulty: 2,
    turns: 3,
    expectedTools: ["mail.search", "crm.lookup"],
    successThreshold: 0.7,
    prompt: "Rank customer emails by revenue impact, urgency, and available next actions.",
  },
];

const modelCostMultiplier: Record<string, number> = {
  "openai/gpt-5.4": 1,
  "openai/gpt-5.4-mini": 0.32,
  "openai/gpt-5.3-codex": 0.88,
};

export function buildEvaluationSnapshot(config: LabConfig): EvaluationSnapshot {
  const baselineResults = benchmarkTasks.map((task, index) =>
    evaluateTask(task, "baseline", config, index),
  );
  const draftVerifierResults = benchmarkTasks.map((task, index) =>
    evaluateTask(task, "draft-verifier", config, index),
  );

  return {
    baselineResults,
    draftVerifierResults,
    baselineMetrics: aggregateResults(baselineResults),
    draftVerifierMetrics: aggregateResults(draftVerifierResults),
  };
}

export function aggregateResults(results: EvaluationResult[]): AggregateMetrics {
  const total = results.length || 1;
  const toolCalls = sum(results.map((result) => result.toolCalls));
  const toolErrors = sum(results.map((result) => result.toolErrors));
  const acceptanceSamples = results
    .map((result) => result.draftAcceptanceRate)
    .filter((value): value is number => value !== null);

  return {
    successRate: sum(results.map((result) => (result.success ? 1 : 0))) / total,
    averageScore: average(results.map((result) => result.score)),
    averageLatencyMs: average(results.map((result) => result.latencyMs)),
    p95LatencyMs: percentile(
      results.map((result) => result.latencyMs),
      0.95,
    ),
    averageCostUsd: average(results.map((result) => result.tokenCostUsd)),
    totalCostUsd: sum(results.map((result) => result.tokenCostUsd)),
    toolErrorRate: toolCalls === 0 ? 0 : toolErrors / toolCalls,
    draftAcceptanceRate:
      acceptanceSamples.length === 0 ? null : average(acceptanceSamples),
  };
}

function evaluateTask(
  task: BenchmarkTask,
  mode: WorkflowMode,
  config: LabConfig,
  index: number,
): EvaluationResult {
  const difficultyPenalty = task.difficulty * 0.035;
  const turnPenalty = Math.max(0, task.turns - config.maxTurns) * 0.045;
  const temperaturePenalty = Math.abs(config.temperature - 0.18) * 0.12;
  const reliabilityLift = (config.toolReliability - 0.75) * 0.28;
  const baselineScore = clamp(
    task.successThreshold + reliabilityLift - difficultyPenalty - turnPenalty - temperaturePenalty + index * 0.006,
    0.42,
    0.96,
  );

  const toolCalls = task.expectedTools.length + Math.max(1, Math.round(task.turns / 2));
  const expectedErrorPressure = (1 - config.toolReliability) * toolCalls;
  const baselineToolErrors = Math.max(0, Math.round(expectedErrorPressure + task.difficulty * 0.18 - 0.35));
  const baseLatency = task.turns * (1650 + task.difficulty * 360) + toolCalls * 520;
  const baselineTokens = task.turns * 920 + task.expectedTools.length * 470 + task.difficulty * 220;
  const baselineCost = tokenCost(baselineTokens, config.baselineModel);

  if (mode === "baseline") {
    const latencyMs = Math.round(baseLatency * (1 + config.temperature * 0.05));
    const score = clamp(baselineScore - baselineToolErrors * 0.018, 0, 1);

    return {
      taskId: task.id,
      taskTitle: task.title,
      domain: task.domain,
      mode,
      success: score >= task.successThreshold,
      score,
      latencyMs,
      tokenCostUsd: roundCurrency(baselineCost),
      toolCalls,
      toolErrors: baselineToolErrors,
      draftAcceptanceRate: null,
      turns: task.turns,
      trace: makeTrace(task, mode, score, latencyMs, null, baselineToolErrors),
    };
  }

  const draftAcceptanceRate = clamp(
    0.48 + config.draftAggression * 0.31 + config.toolReliability * 0.08 - task.difficulty * 0.035 - index * 0.009,
    0.34,
    0.88,
  );
  const verifierLift = 0.025 + draftAcceptanceRate * 0.035;
  const aggressionRisk = Math.max(0, config.draftAggression - 0.7) * 0.08;
  const toolErrors = Math.max(0, baselineToolErrors - (config.toolReliability > 0.88 ? 1 : 0));
  const score = clamp(baselineScore + verifierLift - aggressionRisk - toolErrors * 0.012, 0, 1);
  const latencyFactor = clamp(0.88 - draftAcceptanceRate * 0.28 + task.difficulty * 0.018, 0.58, 0.86);
  const latencyMs = Math.round(baseLatency * latencyFactor);
  const draftTokens = baselineTokens * 0.72;
  const verifierTokens = baselineTokens * (0.18 + (1 - draftAcceptanceRate) * 0.22);
  const tokenCostUsd =
    tokenCost(draftTokens, config.draftModel) + tokenCost(verifierTokens, config.verifierModel);

  return {
    taskId: task.id,
    taskTitle: task.title,
    domain: task.domain,
    mode,
    success: score >= task.successThreshold,
    score,
    latencyMs,
    tokenCostUsd: roundCurrency(tokenCostUsd),
    toolCalls,
    toolErrors,
    draftAcceptanceRate,
    turns: task.turns,
    trace: makeTrace(task, mode, score, latencyMs, draftAcceptanceRate, toolErrors),
  };
}

function makeTrace(
  task: BenchmarkTask,
  mode: WorkflowMode,
  score: number,
  latencyMs: number,
  draftAcceptanceRate: number | null,
  toolErrors: number,
): TraceStep[] {
  const perTurnLatency = Math.max(280, Math.round(latencyMs / (task.turns + 1)));
  const steps: TraceStep[] = [];

  for (let turn = 1; turn <= task.turns; turn += 1) {
    steps.push({
      turn,
      actor: "user",
      label: turn === 1 ? task.prompt : `Follow-up constraint ${turn - 1}`,
      status: "answered",
      latencyMs: 0,
    });

    if (mode === "draft-verifier") {
      const accepted = draftAcceptanceRate !== null && turn / task.turns <= draftAcceptanceRate + 0.12;
      steps.push({
        turn,
        actor: "draft",
        label: accepted ? "Draft proposes next action" : "Draft proposes risky shortcut",
        status: accepted ? "accepted" : "revised",
        latencyMs: Math.round(perTurnLatency * 0.34),
      });
      steps.push({
        turn,
        actor: "verifier",
        label: accepted ? "Verifier accepts draft" : "Verifier revises plan",
        status: accepted ? "accepted" : "revised",
        latencyMs: Math.round(perTurnLatency * 0.28),
      });
    } else {
      steps.push({
        turn,
        actor: "baseline",
        label: "Baseline agent plans and answers",
        status: "answered",
        latencyMs: Math.round(perTurnLatency * 0.7),
      });
    }

    if (turn <= task.expectedTools.length) {
      steps.push({
        turn,
        actor: "tool",
        label: task.expectedTools[turn - 1],
        status: turn <= toolErrors ? "revised" : "called",
        latencyMs: Math.round(perTurnLatency * 0.18),
      });
    }
  }

  steps.push({
    turn: task.turns,
    actor: mode === "baseline" ? "baseline" : "verifier",
    label: score >= task.successThreshold ? "Final answer meets rubric" : "Final answer misses rubric detail",
    status: score >= task.successThreshold ? "answered" : "revised",
    latencyMs: Math.round(perTurnLatency * 0.46),
  });

  return steps;
}

function tokenCost(tokens: number, model: string) {
  const multiplier = modelCostMultiplier[model] ?? 1;
  return (tokens / 1000) * 0.006 * multiplier;
}

function average(values: number[]) {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function percentile(values: number[], quantile: number) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1);
  return sorted[index];
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundCurrency(value: number) {
  return Math.round(value * 10000) / 10000;
}
