"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FlaskConical,
  Gauge,
  GitCompare,
  Play,
  RotateCcw,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Wrench,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  benchmarkTasks,
  buildEvaluationSnapshot,
  DEFAULT_LAB_CONFIG,
  type EvaluationResult,
  type LabConfig,
  type TraceStep,
} from "@/lib/mock-evaluation";
import { cn } from "@/lib/utils";

type SpecAgentDashboardProps = {
  initialConfig: LabConfig;
};

const percentFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 0,
  style: "percent",
});

const compactCurrency = new Intl.NumberFormat("en", {
  maximumFractionDigits: 3,
  style: "currency",
  currency: "USD",
});

const EvaluationCharts = dynamic(
  () => import("@/components/dashboard/evaluation-charts").then((mod) => mod.EvaluationCharts),
  {
    ssr: false,
    loading: () => <ChartsSkeletonGrid />,
  },
);

export function SpecAgentDashboard({ initialConfig }: SpecAgentDashboardProps) {
  const [config, setConfig] = useState(initialConfig);
  const [runSerial, setRunSerial] = useState(1);
  const [selectedTaskId, setSelectedTaskId] = useState(benchmarkTasks[0]?.id ?? "");
  const snapshot = useMemo(() => buildEvaluationSnapshot(config), [config]);

  const selectedDraftResult =
    snapshot.draftVerifierResults.find((result) => result.taskId === selectedTaskId) ??
    snapshot.draftVerifierResults[0];
  const selectedBaselineResult =
    snapshot.baselineResults.find((result) => result.taskId === selectedTaskId) ??
    snapshot.baselineResults[0];

  const taskRows = benchmarkTasks.map((task) => {
    const baseline = snapshot.baselineResults.find((result) => result.taskId === task.id);
    const draftVerifier = snapshot.draftVerifierResults.find((result) => result.taskId === task.id);

    return {
      task,
      baseline,
      draftVerifier,
    };
  });

  const latencyChartRows = taskRows.map(({ task, baseline, draftVerifier }) => ({
    task: shortTaskName(task.title),
    Baseline: baseline?.latencyMs ?? 0,
    "Draft+Verifier": draftVerifier?.latencyMs ?? 0,
  }));

  const qualityChartRows = taskRows.map(({ task, baseline, draftVerifier }) => ({
    task: shortTaskName(task.title),
    Baseline: Math.round((baseline?.score ?? 0) * 100),
    "Draft+Verifier": Math.round((draftVerifier?.score ?? 0) * 100),
  }));

  const updateConfig = <Key extends keyof LabConfig>(key: Key, value: LabConfig[Key]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-chart-2/40 bg-chart-2/10 text-chart-2">
              <FlaskConical className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">SpecAgent Lab</h1>
                <Badge variant="outline" className="border-chart-1/40 text-chart-1">
                  MVP
                </Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Benchmark: product-ops-seeded-v1 · {benchmarkTasks.length} tasks · deterministic tool contracts
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setConfig(DEFAULT_LAB_CONFIG);
                setRunSerial((value) => value + 1);
              }}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv(snapshot.draftVerifierResults)}>
              <Download className="size-4" aria-hidden="true" />
              Export
            </Button>
            <Button size="sm" onClick={() => setRunSerial((value) => value + 1)}>
              <Play className="size-4" aria-hidden="true" />
              Run eval
            </Button>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[21rem_1fr]">
          <aside className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="size-4 text-chart-2" aria-hidden="true" />
                  Agent Setup
                </CardTitle>
                <CardDescription>Run #{runSerial.toString().padStart(3, "0")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Field label="Baseline model" value={config.baselineModel} onChange={(value) => updateConfig("baselineModel", value)} />
                <Field label="Draft model" value={config.draftModel} onChange={(value) => updateConfig("draftModel", value)} />
                <Field label="Verifier model" value={config.verifierModel} onChange={(value) => updateConfig("verifierModel", value)} />
                <SliderField
                  label="Temperature"
                  value={config.temperature}
                  min={0}
                  max={0.8}
                  step={0.05}
                  suffix=""
                  onChange={(value) => updateConfig("temperature", value)}
                />
                <SliderField
                  label="Tool reliability"
                  value={config.toolReliability}
                  min={0.72}
                  max={0.99}
                  step={0.01}
                  suffix="%"
                  scale={100}
                  onChange={(value) => updateConfig("toolReliability", value)}
                />
                <SliderField
                  label="Draft aggression"
                  value={config.draftAggression}
                  min={0.25}
                  max={0.9}
                  step={0.01}
                  suffix="%"
                  scale={100}
                  onChange={(value) => updateConfig("draftAggression", value)}
                />
                <div className="grid gap-2">
                  <Label htmlFor="max-turns">Max turns</Label>
                  <Input
                    id="max-turns"
                    type="number"
                    min={3}
                    max={10}
                    value={config.maxTurns}
                    onChange={(event) => updateConfig("maxTurns", Number(event.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="size-4 text-chart-3" aria-hidden="true" />
                  Mock Tools
                </CardTitle>
                <CardDescription>{uniqueTools.length} deterministic tool contracts</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {uniqueTools.map((tool) => (
                  <Badge key={tool} variant="secondary" className="font-mono text-[11px]">
                    {tool}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </aside>

          <div className="flex min-w-0 flex-col gap-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                icon={CheckCircle2}
                label="Success rate"
                value={formatPercent(snapshot.draftVerifierMetrics.successRate)}
                helper={formatDelta(snapshot.draftVerifierMetrics.successRate - snapshot.baselineMetrics.successRate, "pp")}
                tone="green"
                direction="up"
              />
              <MetricCard
                icon={Timer}
                label="P95 latency"
                value={formatMs(snapshot.draftVerifierMetrics.p95LatencyMs)}
                helper={formatDelta(
                  (snapshot.draftVerifierMetrics.p95LatencyMs - snapshot.baselineMetrics.p95LatencyMs) /
                    snapshot.baselineMetrics.p95LatencyMs,
                  "%",
                )}
                tone="blue"
                direction="down"
              />
              <MetricCard
                icon={CircleDollarSign}
                label="Total cost"
                value={compactCurrency.format(snapshot.draftVerifierMetrics.totalCostUsd)}
                helper={formatDelta(
                  (snapshot.draftVerifierMetrics.totalCostUsd - snapshot.baselineMetrics.totalCostUsd) /
                    snapshot.baselineMetrics.totalCostUsd,
                  "%",
                )}
                tone="amber"
                direction="down"
              />
              <MetricCard
                icon={TriangleAlert}
                label="Tool error rate"
                value={formatPercent(snapshot.draftVerifierMetrics.toolErrorRate)}
                helper={formatDelta(
                  snapshot.draftVerifierMetrics.toolErrorRate - snapshot.baselineMetrics.toolErrorRate,
                  "pp",
                )}
                tone="red"
                direction="down"
              />
              <MetricCard
                icon={ShieldCheck}
                label="Draft acceptance"
                value={formatPercent(snapshot.draftVerifierMetrics.draftAcceptanceRate ?? 0)}
                helper="Verifier approved drafts"
                tone="violet"
                direction="up"
              />
            </section>

            <Tabs defaultValue="compare" className="min-w-0">
              <TabsList className="grid w-full grid-cols-3 lg:w-[28rem]">
                <TabsTrigger value="compare">
                  <GitCompare className="size-4" aria-hidden="true" />
                  Compare
                </TabsTrigger>
                <TabsTrigger value="tasks">
                  <Gauge className="size-4" aria-hidden="true" />
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="trace">
                  <Activity className="size-4" aria-hidden="true" />
                  Trace
                </TabsTrigger>
              </TabsList>

              <TabsContent value="compare" className="mt-5 grid gap-5 xl:grid-cols-2">
                <EvaluationCharts latencyChartRows={latencyChartRows} qualityChartRows={qualityChartRows} />
              </TabsContent>

              <TabsContent value="tasks" className="mt-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Benchmark Tasks</CardTitle>
                    <CardDescription>{benchmarkTasks.length} seeded multi-turn scenarios</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Domain</TableHead>
                          <TableHead className="text-right">Baseline</TableHead>
                          <TableHead className="text-right">Draft+Verifier</TableHead>
                          <TableHead className="text-right">Latency</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Acceptance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {taskRows.map(({ task, baseline, draftVerifier }) => (
                          <TableRow key={task.id}>
                            <TableCell className="min-w-56">
                              <div className="font-medium">{task.title}</div>
                              <div className="mt-1 max-w-md text-xs leading-5 text-muted-foreground">{task.prompt}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{task.domain}</Badge>
                            </TableCell>
                            <ScoreCell result={baseline} />
                            <ScoreCell result={draftVerifier} />
                            <TableCell className="text-right font-mono text-xs">
                              {draftVerifier && baseline
                                ? formatDelta((draftVerifier.latencyMs - baseline.latencyMs) / baseline.latencyMs, "%")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {draftVerifier && baseline
                                ? formatDelta(
                                    (draftVerifier.tokenCostUsd - baseline.tokenCostUsd) / baseline.tokenCostUsd,
                                    "%",
                                  )
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatPercent(draftVerifier?.draftAcceptanceRate ?? 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trace" className="mt-5 grid gap-5 xl:grid-cols-[20rem_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Selected Task</CardTitle>
                    <CardDescription>Baseline and draft-verifier traces</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {taskRows.map(({ task, draftVerifier }) => (
                      <button
                        type="button"
                        key={task.id}
                        className={cn(
                          "rounded-lg border p-3 text-left transition hover:border-chart-2/70 hover:bg-muted/50",
                          selectedTaskId === task.id ? "border-chart-2 bg-chart-2/10" : "border-border",
                        )}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">{task.title}</span>
                          <Badge variant={draftVerifier?.success ? "secondary" : "destructive"}>
                            {draftVerifier?.success ? "pass" : "miss"}
                          </Badge>
                        </div>
                        <Progress className="mt-3 h-1.5" value={(draftVerifier?.score ?? 0) * 100} />
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <div className="grid gap-5 lg:grid-cols-2">
                  <TraceCard title="Baseline" icon={Bot} result={selectedBaselineResult} />
                  <TraceCard title="Draft + Verifier" icon={Zap} result={selectedDraftResult} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
  direction,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  tone: "green" | "blue" | "amber" | "red" | "violet";
  direction: "up" | "down";
}) {
  const toneClass = {
    green: "bg-chart-1/10 text-chart-1 border-chart-1/30",
    blue: "bg-chart-2/10 text-chart-2 border-chart-2/30",
    amber: "bg-chart-3/10 text-chart-3 border-chart-3/30",
    red: "bg-chart-4/10 text-chart-4 border-chart-4/30",
    violet: "bg-chart-5/10 text-chart-5 border-chart-5/30",
  }[tone];
  const DirectionIcon = direction === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <Card size="sm">
      <CardContent className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</span>
          <span className={cn("flex size-8 items-center justify-center rounded-lg border", toneClass)}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <div className="text-2xl font-semibold tracking-normal">{value}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <DirectionIcon className="size-3.5" aria-hidden="true" />
          {helper}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-full flex-col justify-end gap-3">
      <Skeleton className="h-7 w-4/5" />
      <Skeleton className="h-10 w-3/5" />
      <Skeleton className="h-16 w-11/12" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function ChartsSkeletonGrid() {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Latency by Task</CardTitle>
          <CardDescription>Lower is better</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ChartSkeleton />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Rubric Score</CardTitle>
          <CardDescription>Task-level quality score</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ChartSkeleton />
        </CardContent>
      </Card>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  scale = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  scale?: number;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-mono text-xs text-muted-foreground">
          {Math.round(value * scale)}
          {suffix}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-chart-2"
      />
    </div>
  );
}

function ScoreCell({ result }: { result?: EvaluationResult }) {
  if (!result) {
    return <TableCell className="text-right">-</TableCell>;
  }

  return (
    <TableCell className="text-right">
      <div className="font-mono text-sm">{Math.round(result.score * 100)}</div>
      <div className={cn("mt-1 text-xs", result.success ? "text-chart-1" : "text-chart-4")}>
        {result.success ? "pass" : "miss"}
      </div>
    </TableCell>
  );
}

function TraceCard({ title, icon: Icon, result }: { title: string; icon: LucideIcon; result?: EvaluationResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Icon className="size-4 text-chart-2" aria-hidden="true" />
            {title}
          </span>
          <Badge variant={result?.success ? "secondary" : "destructive"}>{result?.success ? "pass" : "miss"}</Badge>
        </CardTitle>
        <CardDescription>
          {result ? `${formatMs(result.latencyMs)} · ${compactCurrency.format(result.tokenCostUsd)}` : "No task selected"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {result?.trace.map((step, index) => <TraceStepRow key={`${step.turn}-${step.actor}-${index}`} step={step} />)}
      </CardContent>
    </Card>
  );
}

function TraceStepRow({ step }: { step: TraceStep }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr_auto] items-start gap-3 rounded-lg border border-border/70 p-3">
      <div className="font-mono text-xs text-muted-foreground">T{step.turn}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {step.actor}
          </Badge>
          <span className="text-xs text-muted-foreground">{step.status}</span>
        </div>
        <div className="mt-2 text-sm leading-5">{step.label}</div>
      </div>
      <div className="font-mono text-xs text-muted-foreground">{step.latencyMs ? formatMs(step.latencyMs) : ""}</div>
    </div>
  );
}

function exportCsv(results: EvaluationResult[]) {
  const header = ["task", "mode", "success", "score", "latency_ms", "cost_usd", "tool_errors", "draft_acceptance"];
  const rows = results.map((result) => [
    result.taskTitle,
    result.mode,
    String(result.success),
    result.score.toFixed(3),
    String(result.latencyMs),
    result.tokenCostUsd.toFixed(4),
    String(result.toolErrors),
    result.draftAcceptanceRate?.toFixed(3) ?? "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "specagent-evaluation.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function formatDelta(value: number, unit: "%" | "pp") {
  if (unit === "pp") {
    const points = Math.round(value * 100);
    return `${points >= 0 ? "+" : ""}${points} pp vs baseline`;
  }

  const percent = Math.round(value * 100);
  return `${percent >= 0 ? "+" : ""}${percent}% vs baseline`;
}

function formatPercent(value: number) {
  return percentFormatter.format(value);
}

function formatMs(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

function shortTaskName(value: string) {
  return value
    .replace("Supplier ", "")
    .replace("Refund ", "")
    .replace("Release ", "")
    .replace("Data ", "")
    .replace("Inbox ", "");
}

const uniqueTools = Array.from(new Set(benchmarkTasks.flatMap((task) => task.expectedTools))).sort();
