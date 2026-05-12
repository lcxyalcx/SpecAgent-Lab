import type { StorageInfo } from "@/lib/persistence/state";

export type BenchmarkWorkflowMode = "baseline" | "draft_verifier";

export type NormalizedRun = {
  id: string;
  name: string;
  createdAt: string;
  mode: BenchmarkWorkflowMode;
  category: string;
  difficulty: number | null;
  latencyMs: number;
  costUsd: number;
  taskSuccessScore: number;
  toolErrorRate: number;
  draftAcceptanceRate: number | null;
};

export type ModeComparisonRow = {
  mode: BenchmarkWorkflowMode;
  label: string;
  runCount: number;
  avgLatencyMs: number;
  avgCostUsd: number;
  avgTaskSuccessScore: number;
};

export type DashboardOverview = {
  totalRuns: number;
  avgLatencyMs: number;
  avgCostUsd: number;
  avgTaskSuccessScore: number;
  toolErrorRate: number;
  draftAcceptanceRate: number | null;
};

export type DashboardPayload = {
  /** database = real Postgres rows; file = local fallback rows; mock = DB OK but no compatible runs; demo = DATABASE_URL unset and no local rows; unavailable = DB configured but unreachable and no local rows */
  source: "database" | "file" | "mock" | "demo" | "unavailable";
  databaseMessage: string | null;
  storage: StorageInfo;
  overview: DashboardOverview;
  comparison: {
    baseline: ModeComparisonRow;
    draftVerifier: ModeComparisonRow;
  };
  hardTaskComparison: {
    baseline: { avgTaskSuccessScore: number; count: number };
    draftVerifier: { avgTaskSuccessScore: number; count: number };
  };
  chartLatencyByMode: { name: string; latencyMs: number; fill: string }[];
  chartCostByMode: { name: string; costUsd: number; fill: string }[];
  chartSuccessByMode: { name: string; successPct: number; fill: string }[];
  chartDraftAcceptanceTrend: { label: string; acceptancePct: number; runId: string }[];
  chartToolErrorByCategory: {
    category: string;
    baseline: number;
    draftVerifier: number;
  }[];
  recentRuns: {
    id: string;
    name: string;
    mode: BenchmarkWorkflowMode;
    createdAt: string;
    taskSuccessScore: number;
    latencyMs: number;
  }[];
  productInsight: string;
};
