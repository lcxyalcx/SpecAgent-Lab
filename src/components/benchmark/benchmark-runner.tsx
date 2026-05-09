"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  CircleDollarSign,
  FlaskConical,
  Gauge,
  ListChecks,
  ListTodo,
  LoaderCircle,
  Scale,
  ShieldCheck,
  Sparkles,
  Timer,
  TriangleAlert,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  benchmarkTaskLibrary,
  type BenchmarkTaskDefinition,
} from "@/lib/benchmark/tasks";
import { cn } from "@/lib/utils";

type BenchmarkMode = "baseline" | "draft_verifier";

type BenchmarkRunResponse = {
  benchmarkId: string;
  results: Array<{
    runId: string;
    taskId: string;
    taskTitle: string;
    category: BenchmarkTaskDefinition["category"];
    difficulty: BenchmarkTaskDefinition["difficulty"];
    mode: BenchmarkMode;
    status: "succeeded" | "failed";
    outputText: string;
    metrics: {
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
    toolCallCount: number;
    toolErrorCount: number;
    draftAccepted: boolean | null;
    verifierReason: string | null;
  }>;
  aggregates: Array<{
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
  }>;
};

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const modeCards = [
  {
    value: "baseline" as const,
    title: "Baseline",
    description: "Single-agent benchmark pass with deterministic tools.",
  },
  {
    value: "draft_verifier" as const,
    title: "Draft + Verifier",
    description: "Speculative-style comparison mode for latency and quality tradeoffs.",
  },
];

export function BenchmarkRunner() {
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(
    benchmarkTaskLibrary.slice(0, 3).map((task) => task.id),
  );
  const [selectedModes, setSelectedModes] = useState<BenchmarkMode[]>([
    "baseline",
    "draft_verifier",
  ]);
  const [result, setResult] = useState<BenchmarkRunResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [useLlmJudge, setUseLlmJudge] = useState(false);

  const selectedTasks = useMemo(
    () =>
      benchmarkTaskLibrary.filter((task) => selectedTaskIds.includes(task.id)),
    [selectedTaskIds],
  );

  async function handleRunBenchmark() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/benchmark/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskIds: selectedTaskIds,
          modes: selectedModes,
          useLlmJudge,
        }),
      });

      const payload = (await response.json()) as BenchmarkRunResponse & {
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        const suffix = payload.code ? ` [${payload.code}]` : "";
        setErrorMessage(`${payload.error ?? "Unable to run benchmark."}${suffix}`);
        return;
      }

      setResult(payload);
    } catch {
      setErrorMessage("Network error while starting the benchmark.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const summaryStats = buildSummaryStats(result);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Benchmark"
        title="Run a benchmark pack and compare workflow modes."
        description="Select built-in multi-turn tasks, choose the baseline and speculative-style draft-verifier modes to compare, and review aggregated product metrics plus persisted run links."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-md px-2.5 py-1">
              {selectedTasks.length} tasks selected
            </Badge>
            <Badge variant="outline" className="rounded-md px-2.5 py-1">
              {selectedModes.length} modes
            </Badge>
          </div>
        }
      />

      {errorMessage ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" aria-hidden="true" />
          <AlertTitle>Benchmark failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[24rem_1fr]">
        <aside className="grid gap-5">
          <Card className="bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="size-4 text-primary" aria-hidden="true" />
                Task Selection
              </CardTitle>
              <CardDescription>
                Choose one or more seeded benchmark tasks for a small evaluation pass.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {benchmarkTaskLibrary.map((task) => {
                const isSelected = selectedTaskIds.includes(task.id);

                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() =>
                      setSelectedTaskIds((current) =>
                        current.includes(task.id)
                          ? current.filter((value) => value !== task.id)
                          : [...current, task.id],
                      )
                    }
                    className={cn(
                      "grid gap-2 rounded-lg border px-3 py-3 text-left transition-colors",
                      isSelected
                        ? "border-primary/35 bg-primary/6"
                        : "border-border bg-background hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className="mt-1 text-sm leading-6 text-muted-foreground">
                          {task.userGoal}
                        </div>
                      </div>
                      <Badge
                        variant={isSelected ? "default" : "outline"}
                        className="capitalize"
                      >
                        {task.difficulty}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="capitalize">
                        {formatCategory(task.category)}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                Comparison Modes
              </CardTitle>
              <CardDescription>Select the workflows you want to compare.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {modeCards.map((mode) => {
                const isSelected = selectedModes.includes(mode.value);

                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() =>
                      setSelectedModes((current) =>
                        current.includes(mode.value)
                          ? current.filter((value) => value !== mode.value)
                          : [...current, mode.value],
                      )
                    }
                    className={cn(
                      "grid gap-2 rounded-lg border px-3 py-3 text-left transition-colors",
                      isSelected
                        ? "border-primary/35 bg-primary/6"
                        : "border-border bg-background hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{mode.title}</span>
                      <Badge variant={isSelected ? "default" : "outline"}>
                        {isSelected ? "Included" : "Off"}
                      </Badge>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {mode.description}
                    </p>
                  </button>
                );
              })}

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Benchmark pass</div>
                    <p className="text-sm text-muted-foreground">
                      {selectedTaskIds.length} tasks × {selectedModes.length} modes
                    </p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg border border-primary/15 bg-primary/8 text-primary">
                    <FlaskConical className="size-4" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-background/80 px-3 py-3">
                  <input
                    id="use-llm-judge"
                    type="checkbox"
                    checked={useLlmJudge}
                    onChange={(event) => setUseLlmJudge(event.target.checked)}
                    className="mt-1 size-4 rounded border-input"
                  />
                  <div className="grid gap-1">
                    <Label htmlFor="use-llm-judge" className="text-sm font-medium">
                      LLM-as-judge scoring
                    </Label>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Optional second model pass for rubric scores. Requires{" "}
                      <span className="font-mono">OPENAI_API_KEY</span>; falls back to heuristic if
                      unavailable.
                    </p>
                  </div>
                </div>
                <Button
                  className="mt-4 w-full"
                  size="lg"
                  disabled={
                    isSubmitting ||
                    selectedTaskIds.length === 0 ||
                    selectedModes.length === 0
                  }
                  onClick={handleRunBenchmark}
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      Running benchmark
                    </>
                  ) : (
                    <>
                      <Gauge className="size-4" aria-hidden="true" />
                      Run Benchmark
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="grid gap-5">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={CheckCircle2}
              label="Avg success"
              value={summaryStats.averageSuccess}
              hint="Task success score"
            />
            <MetricCard
              icon={Timer}
              label="Avg latency"
              value={summaryStats.averageLatency}
              hint="Across all selected runs"
            />
            <MetricCard
              icon={CircleDollarSign}
              label="Avg cost"
              value={summaryStats.averageCost}
              hint="Estimated per run"
            />
            <MetricCard
              icon={ShieldCheck}
              label="Draft accept"
              value={summaryStats.draftAcceptance}
              hint="Draft-verifier only"
            />
          </section>

          <Card className="bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle>Aggregate Results</CardTitle>
              <CardDescription>
                Mode-level averages for success, latency, cost, tool reliability, and verifier confidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSubmitting && !result ? <AggregateLoading /> : null}

              {!isSubmitting && !result ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm leading-6 text-muted-foreground">
                  The benchmark runner is ready. Start with two or three tasks to keep the comparison quick and easy to inspect.
                </div>
              ) : null}

              {result ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {result.aggregates.map((aggregate) => (
                    <Card key={aggregate.mode} size="sm" className="bg-muted/20">
                      <CardHeader>
                        <CardTitle className="text-sm">
                          {aggregate.mode === "baseline"
                            ? "Baseline"
                            : "Draft + Verifier"}
                        </CardTitle>
                        <CardDescription>
                          {aggregate.runCount} persisted benchmark runs
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 text-sm">
                        <AggregateRow
                          label="Task success"
                          value={formatPercent(aggregate.averageTaskSuccessScore)}
                        />
                        <AggregateRow
                          label="Reasoning quality"
                          value={formatPercent(aggregate.averageReasoningQualityScore)}
                        />
                        <AggregateRow
                          label="Constraint satisfaction"
                          value={formatPercent(aggregate.averageConstraintSatisfactionScore)}
                        />
                        <AggregateRow
                          label="Tool-use score"
                          value={formatPercent(aggregate.averageToolUseScore)}
                        />
                        <AggregateRow
                          label="Latency"
                          value={formatMs(aggregate.averageLatencyMs)}
                        />
                        <AggregateRow
                          label="Estimated cost"
                          value={compactCurrency.format(
                            aggregate.averageEstimatedCostUsd,
                          )}
                        />
                        <AggregateRow
                          label="Tool error rate"
                          value={formatPercent(aggregate.averageToolErrorRate)}
                        />
                        <AggregateRow
                          label="Draft acceptance"
                          value={
                            aggregate.draftAcceptanceRate === null
                              ? "N/A"
                              : formatPercent(aggregate.draftAcceptanceRate)
                          }
                        />
                        <AggregateRow
                          label="Avg confidence"
                          value={
                            aggregate.averageConfidenceScore === null
                              ? "N/A"
                              : formatPercent(aggregate.averageConfidenceScore)
                          }
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle>Run Results</CardTitle>
              <CardDescription>
                Each row is persisted and links to the run detail route.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isSubmitting && !result ? <ResultsLoading /> : null}

              {result ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Success</TableHead>
                      <TableHead className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Brain className="size-3.5" aria-hidden="true" />
                          Reason
                        </span>
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <ListTodo className="size-3.5" aria-hidden="true" />
                          Constr.
                        </span>
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Scale className="size-3.5" aria-hidden="true" />
                          Tools
                        </span>
                      </TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Tool error</TableHead>
                      <TableHead>Draft</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead className="text-right">Run</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.results.map((row) => (
                      <TableRow key={row.runId}>
                        <TableCell className="min-w-72">
                          <div className="font-medium">{row.taskTitle}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {formatCategory(row.category)}
                            </Badge>
                            <Badge variant="secondary" className="capitalize">
                              {row.difficulty}
                            </Badge>
                          </div>
                          {row.verifierReason ? (
                            <div className="mt-2 text-xs leading-5 text-muted-foreground">
                              {row.verifierReason}
                            </div>
                          ) : null}
                          {row.metrics.evaluationExplanation ? (
                            <div className="mt-2 text-xs leading-5 text-muted-foreground">
                              <Badge variant="outline" className="mb-1 mr-2 capitalize">
                                {row.metrics.evaluationMethod.replaceAll("_", " ")}
                              </Badge>
                              {row.metrics.evaluationExplanation}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {row.mode === "baseline"
                              ? "Baseline"
                              : "Draft + Verifier"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatPercent(row.metrics.taskSuccessScore)}</TableCell>
                        <TableCell>
                          {formatPercent(row.metrics.reasoningQualityScore)}
                        </TableCell>
                        <TableCell>
                          {formatPercent(row.metrics.constraintSatisfactionScore)}
                        </TableCell>
                        <TableCell>{formatPercent(row.metrics.toolUseScore)}</TableCell>
                        <TableCell>{formatMs(row.metrics.latencyMs)}</TableCell>
                        <TableCell>
                          {compactCurrency.format(row.metrics.estimatedCostUsd)}
                        </TableCell>
                        <TableCell>{formatPercent(row.metrics.toolErrorRate)}</TableCell>
                        <TableCell>
                          {row.draftAccepted === null ? (
                            <span className="text-muted-foreground">N/A</span>
                          ) : (
                            <Badge
                              variant={row.draftAccepted ? "secondary" : "outline"}
                            >
                              {row.draftAccepted ? "Accepted" : "Rejected"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.metrics.averageConfidenceScore === null
                            ? "N/A"
                            : formatPercent(row.metrics.averageConfidenceScore)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/runs/${encodeURIComponent(row.runId)}`}>
                              Open
                              <ArrowRight className="size-4" aria-hidden="true" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card size="sm" className="bg-card/85 shadow-sm">
      <CardContent className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
          <span className="flex size-9 items-center justify-center rounded-lg border border-primary/15 bg-primary/8 text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <div>
          <div className="text-3xl font-semibold tracking-normal">{value}</div>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AggregateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function AggregateLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Skeleton className="h-52 w-full rounded-lg" />
      <Skeleton className="h-52 w-full rounded-lg" />
    </div>
  );
}

function ResultsLoading() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}

function buildSummaryStats(result: BenchmarkRunResponse | null) {
  if (!result || result.results.length === 0) {
    return {
      averageSuccess: "—",
      averageLatency: "—",
      averageCost: "—",
      draftAcceptance: "N/A",
    };
  }

  const averageSuccess =
    result.results.reduce(
      (sum, row) => sum + row.metrics.taskSuccessScore,
      0,
    ) / result.results.length;
  const averageLatency =
    result.results.reduce((sum, row) => sum + row.metrics.latencyMs, 0) /
    result.results.length;
  const averageCost =
    result.results.reduce(
      (sum, row) => sum + row.metrics.estimatedCostUsd,
      0,
    ) / result.results.length;
  const draftRates = result.results
    .map((row) => row.metrics.draftAcceptanceRate)
    .filter((value): value is number => value !== null);

  return {
    averageSuccess: formatPercent(averageSuccess),
    averageLatency: formatMs(Math.round(averageLatency)),
    averageCost: compactCurrency.format(averageCost),
    draftAcceptance:
      draftRates.length === 0
        ? "N/A"
        : formatPercent(
            draftRates.reduce((sum, value) => sum + value, 0) / draftRates.length,
          ),
  };
}

function formatCategory(category: string) {
  return category.replaceAll("-", " ");
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatMs(value: number) {
  return `${value.toLocaleString()} ms`;
}
