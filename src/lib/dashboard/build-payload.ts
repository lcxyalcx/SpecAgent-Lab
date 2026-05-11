import type { AgentMode } from "@prisma/client";

import type {
  BenchmarkWorkflowMode,
  DashboardOverview,
  DashboardPayload,
  ModeComparisonRow,
  NormalizedRun,
} from "@/lib/dashboard/types";
import {
  benchmarkTasks,
  buildEvaluationSnapshot,
  DEFAULT_LAB_CONFIG,
} from "@/lib/mock-evaluation";

const HARD_DIFFICULTY = 4;

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((a, b) => a + b, 0) / values.length;
}

function firstNumber(...candidates: unknown[]): number | null {
  for (const value of candidates) {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export function agentModeToWorkflow(mode: AgentMode): BenchmarkWorkflowMode | null {
  if (mode === "BASELINE") {
    return "baseline";
  }

  if (mode === "DRAFT_VERIFIER") {
    return "draft_verifier";
  }

  return null;
}

/** Normalize Prisma run JSON — supports benchmark runner + legacy seed field names. */
export function normalizeDbRun(row: {
  id: string;
  name: string;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  metrics: unknown;
  summary: unknown;
  agentConfig: { mode: AgentMode };
  benchmarkTask: { category: string; difficulty: number } | null;
}): NormalizedRun | null {
  const workflowMode = agentModeToWorkflow(row.agentConfig.mode);
  if (!workflowMode) {
    return null;
  }

  const metrics = row.metrics && typeof row.metrics === "object" ? (row.metrics as Record<string, unknown>) : {};
  const summary =
    row.summary && typeof row.summary === "object" ? (row.summary as Record<string, unknown>) : {};

  const taskSuccessScore = firstNumber(
    metrics.taskSuccessScore,
    metrics.taskSuccessRate,
    summary.taskSuccessScore,
  );

  if (taskSuccessScore === null) {
    return null;
  }

  const latencyFromWindow =
    row.startedAt && row.finishedAt
      ? Math.max(0, row.finishedAt.getTime() - row.startedAt.getTime())
      : null;

  const latencyMs = firstNumber(metrics.latencyMs, metrics.averageLatencyMs, latencyFromWindow);
  if (latencyMs === null) {
    return null;
  }

  const costUsd =
    firstNumber(metrics.estimatedCostUsd, metrics.estimatedCostPerTaskUsd, metrics.averageCostUsd) ?? 0;

  const toolErrorRate = firstNumber(metrics.toolErrorRate) ?? 0;

  let draftAcceptanceRate: number | null = null;
  if (metrics.draftAcceptanceRate !== undefined && metrics.draftAcceptanceRate !== null) {
    const parsed = firstNumber(metrics.draftAcceptanceRate);
    draftAcceptanceRate = parsed;
  }

  const inputCategory =
    typeof summary.category === "string"
      ? summary.category
      : typeof (metrics as { category?: unknown }).category === "string"
        ? String((metrics as { category?: string }).category)
        : null;

  const category =
    row.benchmarkTask?.category ?? inputCategory ?? "uncategorized";

  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    mode: workflowMode,
    category: category.replaceAll("-", " "),
    difficulty: row.benchmarkTask?.difficulty ?? null,
    latencyMs,
    costUsd,
    taskSuccessScore: clamp01(taskSuccessScore),
    toolErrorRate: clamp01(toolErrorRate),
    draftAcceptanceRate: draftAcceptanceRate === null ? null : clamp01(draftAcceptanceRate),
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function buildDashboardPayload(
  runs: NormalizedRun[],
  source: DashboardPayload["source"],
): DashboardPayload {
  const overview = computeOverview(runs);
  const comparison = computeComparison(runs);
  const hardTaskComparison = computeHardTaskComparison(runs);

  const chartLatencyByMode = [
    {
      name: "单代理",
      latencyMs: comparison.baseline.runCount ? comparison.baseline.avgLatencyMs : 0,
      fill: "var(--chart-4)",
    },
    {
      name: "草稿 + 校验",
      latencyMs: comparison.draftVerifier.runCount ? comparison.draftVerifier.avgLatencyMs : 0,
      fill: "var(--chart-2)",
    },
  ];

  const chartCostByMode = [
    {
      name: "单代理",
      costUsd: comparison.baseline.runCount ? comparison.baseline.avgCostUsd : 0,
      fill: "var(--chart-4)",
    },
    {
      name: "草稿 + 校验",
      costUsd: comparison.draftVerifier.runCount ? comparison.draftVerifier.avgCostUsd : 0,
      fill: "var(--chart-2)",
    },
  ];

  const chartSuccessByMode = [
    {
      name: "单代理",
      successPct: comparison.baseline.runCount ? comparison.baseline.avgTaskSuccessScore * 100 : 0,
      fill: "var(--chart-4)",
    },
    {
      name: "草稿 + 校验",
      successPct: comparison.draftVerifier.runCount
        ? comparison.draftVerifier.avgTaskSuccessScore * 100
        : 0,
      fill: "var(--chart-2)",
    },
  ];

  const draftTrendRuns = [...runs]
    .filter((run) => run.mode === "draft_verifier" && run.draftAcceptanceRate !== null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-24);

  const chartDraftAcceptanceTrend = draftTrendRuns.map((run, index) => ({
    label: formatTrendLabel(run.createdAt, index),
    acceptancePct: (run.draftAcceptanceRate as number) * 100,
    runId: run.id,
  }));

  const chartToolErrorByCategory = buildToolErrorByCategory(runs);

  const recentRuns = [...runs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
    .map((run) => ({
      id: run.id,
      name: run.name,
      mode: run.mode,
      createdAt: run.createdAt,
      taskSuccessScore: run.taskSuccessScore,
      latencyMs: run.latencyMs,
    }));

  const productInsight = buildProductInsight(comparison, hardTaskComparison);

  return {
    source,
    overview,
    comparison: {
      baseline: comparison.baseline,
      draftVerifier: comparison.draftVerifier,
    },
    hardTaskComparison,
    chartLatencyByMode,
    chartCostByMode,
    chartSuccessByMode,
    chartDraftAcceptanceTrend,
    chartToolErrorByCategory,
    recentRuns,
    productInsight,
  };
}

function formatTrendLabel(iso: string, index: number) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return `T${index + 1}`;
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function computeOverview(runs: NormalizedRun[]): DashboardOverview {
  if (runs.length === 0) {
    return {
      totalRuns: 0,
      avgLatencyMs: 0,
      avgCostUsd: 0,
      avgTaskSuccessScore: 0,
      toolErrorRate: 0,
      draftAcceptanceRate: null,
    };
  }

  const draftRates = runs
    .map((run) => run.draftAcceptanceRate)
    .filter((value): value is number => value !== null);

  return {
    totalRuns: runs.length,
    avgLatencyMs: Math.round(average(runs.map((run) => run.latencyMs))),
    avgCostUsd: average(runs.map((run) => run.costUsd)),
    avgTaskSuccessScore: average(runs.map((run) => run.taskSuccessScore)),
    toolErrorRate: average(runs.map((run) => run.toolErrorRate)),
    draftAcceptanceRate: draftRates.length === 0 ? null : average(draftRates),
  };
}

function emptyModeRow(mode: BenchmarkWorkflowMode, label: string): ModeComparisonRow {
  return {
    mode,
    label,
    runCount: 0,
    avgLatencyMs: 0,
    avgCostUsd: 0,
    avgTaskSuccessScore: 0,
  };
}

function computeComparison(runs: NormalizedRun[]) {
  const baselineRuns = runs.filter((run) => run.mode === "baseline");
  const draftRuns = runs.filter((run) => run.mode === "draft_verifier");

  const baseline: ModeComparisonRow =
    baselineRuns.length === 0
      ? emptyModeRow("baseline", "单代理")
      : {
          mode: "baseline",
          label: "单代理",
          runCount: baselineRuns.length,
          avgLatencyMs: Math.round(average(baselineRuns.map((run) => run.latencyMs))),
          avgCostUsd: average(baselineRuns.map((run) => run.costUsd)),
          avgTaskSuccessScore: average(baselineRuns.map((run) => run.taskSuccessScore)),
        };

  const draftVerifier: ModeComparisonRow =
    draftRuns.length === 0
      ? emptyModeRow("draft_verifier", "草稿 + 校验")
      : {
          mode: "draft_verifier",
          label: "草稿 + 校验",
          runCount: draftRuns.length,
          avgLatencyMs: Math.round(average(draftRuns.map((run) => run.latencyMs))),
          avgCostUsd: average(draftRuns.map((run) => run.costUsd)),
          avgTaskSuccessScore: average(draftRuns.map((run) => run.taskSuccessScore)),
        };

  return { baseline, draftVerifier };
}

function computeHardTaskComparison(runs: NormalizedRun[]) {
  const hard = runs.filter((run) => (run.difficulty ?? 0) >= HARD_DIFFICULTY);
  const baselineRuns = hard.filter((run) => run.mode === "baseline");
  const draftRuns = hard.filter((run) => run.mode === "draft_verifier");

  return {
    baseline: {
      count: baselineRuns.length,
      avgTaskSuccessScore:
        baselineRuns.length === 0
          ? 0
          : average(baselineRuns.map((run) => run.taskSuccessScore)),
    },
    draftVerifier: {
      count: draftRuns.length,
      avgTaskSuccessScore:
        draftRuns.length === 0 ? 0 : average(draftRuns.map((run) => run.taskSuccessScore)),
    },
  };
}

function buildToolErrorByCategory(runs: NormalizedRun[]) {
  const categories = [...new Set(runs.map((run) => run.category))].sort();

  return categories.map((category) => {
    const subset = runs.filter((run) => run.category === category);
    const baseline = subset.filter((run) => run.mode === "baseline");
    const draft = subset.filter((run) => run.mode === "draft_verifier");

    return {
      category: truncateCategory(category, 18),
      baseline: baseline.length ? average(baseline.map((run) => run.toolErrorRate)) * 100 : 0,
      draftVerifier: draft.length ? average(draft.map((run) => run.toolErrorRate)) * 100 : 0,
    };
  });
}

function truncateCategory(category: string, max: number) {
  if (category.length <= max) {
    return category;
  }

  return `${category.slice(0, max - 1)}…`;
}

function buildProductInsight(
  comparison: ReturnType<typeof computeComparison>,
  hard: ReturnType<typeof computeHardTaskComparison>,
): string {
  const baseline = comparison.baseline;
  const draft = comparison.draftVerifier;

  if (!baseline.runCount || !draft.runCount) {
    return "当单代理和草稿加校验都有足够运行次数时，这里会自动对比耗时、费用与成功率，并提示高难度任务上的差异。";
  }

  const latDeltaPct =
    baseline.avgLatencyMs > 0
      ? ((baseline.avgLatencyMs - draft.avgLatencyMs) / baseline.avgLatencyMs) * 100
      : 0;

  const succDeltaPct =
    baseline.avgTaskSuccessScore > 0.0001
      ? ((draft.avgTaskSuccessScore - baseline.avgTaskSuccessScore) /
          baseline.avgTaskSuccessScore) *
        100
      : 0;

  let latencyPhrase: string;
  if (latDeltaPct > 3) {
    latencyPhrase = `草稿加校验模式把平均耗时降低了约 ${Math.round(latDeltaPct)}%。`;
  } else if (latDeltaPct < -3) {
    latencyPhrase = `单代理模式平均比草稿加校验快约 ${Math.round(-latDeltaPct)}%。`;
  } else {
    latencyPhrase = "两种模式的平均延迟接近。";
  }

  let successPhrase: string;
  if (succDeltaPct > 3) {
    successPhrase = `同时，它的整体任务成功分也高约 ${Math.round(succDeltaPct)}%。`;
  } else if (succDeltaPct < -3) {
    successPhrase = `但它的整体任务成功分低约 ${Math.round(-succDeltaPct)}%，需要一起权衡质量与速度。`;
  } else {
    successPhrase = "两种模式的整体任务成功分接近。";
  }

  let hardPhrase = "";
  if (hard.baseline.count && hard.draftVerifier.count) {
    const h =
      hard.baseline.avgTaskSuccessScore > 0.0001
        ? ((hard.draftVerifier.avgTaskSuccessScore - hard.baseline.avgTaskSuccessScore) /
            hard.baseline.avgTaskSuccessScore) *
          100
        : 0;

    if (Math.abs(h) >= 4) {
      hardPhrase = ` 在高难度任务（难度 ≥ ${HARD_DIFFICULTY}）上，草稿加校验的平均成功分比单代理${h >= 0 ? "高约" : "低约"} ${Math.round(Math.abs(h))}%。`;
    }
  }

  return `${latencyPhrase}${successPhrase}${hardPhrase}`;
}

export function buildMockDashboardPayload(): DashboardPayload {
  const snapshot = buildEvaluationSnapshot(DEFAULT_LAB_CONFIG);
  const normalized: NormalizedRun[] = [];
  const now = Date.now();

  for (let index = 0; index < benchmarkTasks.length; index += 1) {
    const task = benchmarkTasks[index];
    const baseline = snapshot.baselineResults.find((result) => result.taskId === task.id);
    const draft = snapshot.draftVerifierResults.find((result) => result.taskId === task.id);
    const dayMs = 86_400_000;
    const createdAt = new Date(now - (benchmarkTasks.length - index) * dayMs).toISOString();

    if (baseline) {
      const toolErrorRate =
        baseline.toolCalls > 0 ? baseline.toolErrors / baseline.toolCalls : 0;
      normalized.push({
        id: `mock-baseline-${task.id}`,
        name: `${task.title} · 单代理`,
        createdAt,
        mode: "baseline",
        category: task.domain.replaceAll("-", " "),
        difficulty: task.difficulty,
        latencyMs: baseline.latencyMs,
        costUsd: baseline.tokenCostUsd,
        taskSuccessScore: baseline.score,
        toolErrorRate,
        draftAcceptanceRate: null,
      });
    }

    if (draft) {
      const toolErrorRate = draft.toolCalls > 0 ? draft.toolErrors / draft.toolCalls : 0;
      normalized.push({
        id: `mock-draft-${task.id}`,
        name: `${task.title} · 草稿 + 校验`,
        createdAt: new Date(new Date(createdAt).getTime() + 3_600_000).toISOString(),
        mode: "draft_verifier",
        category: task.domain.replaceAll("-", " "),
        difficulty: task.difficulty,
        latencyMs: draft.latencyMs,
        costUsd: draft.tokenCostUsd,
        taskSuccessScore: draft.score,
        toolErrorRate,
        draftAcceptanceRate: draft.draftAcceptanceRate,
      });
    }
  }

  return buildDashboardPayload(normalized, "mock");
}
