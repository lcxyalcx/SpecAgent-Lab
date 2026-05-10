"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Gauge,
  Lightbulb,
  Timer,
  Wrench,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardPayload } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

type AnalyticsDashboardProps = {
  payload: DashboardPayload;
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
});

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function AnalyticsDashboard({ payload }: AnalyticsDashboardProps) {
  const { overview, source, comparison } = payload;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Dashboard"
        title="Run history, quality, and cost in one view."
        description="Aggregates recent benchmark-class runs from Postgres. When no compatible runs exist, the charts fall back to deterministic mock data so layouts stay reviewable."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={source === "database" ? "default" : "secondary"}
              className="rounded-md"
            >
              {source === "database"
                ? "Live data"
                : source === "demo"
                  ? "Demo (no DATABASE_URL)"
                  : "Sample data (empty DB)"}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/benchmark">
                Run benchmark
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Gauge}
          label="Total runs"
          value={String(overview.totalRuns)}
          hint="Recent window"
        />
        <StatCard
          icon={Timer}
          label="Avg latency"
          value={formatMs(overview.avgLatencyMs)}
          hint="Across included runs"
        />
        <StatCard
          icon={CircleDollarSign}
          label="Avg cost"
          value={currency.format(overview.avgCostUsd)}
          hint="Estimated per run"
        />
        <StatCard
          icon={BarChart3}
          label="Avg task success"
          value={formatPct(overview.avgTaskSuccessScore)}
          hint="Score 0–100%"
        />
        <StatCard
          icon={Wrench}
          label="Tool error rate"
          value={formatPct(overview.toolErrorRate)}
          hint="Mean of per-run rates"
        />
        <StatCard
          icon={Gauge}
          label="Draft acceptance"
          value={
            overview.draftAcceptanceRate === null
              ? "N/A"
              : formatPct(overview.draftAcceptanceRate)
          }
          hint="Draft-verifier runs only"
        />
      </section>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/6 via-card to-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="size-5 text-primary" aria-hidden="true" />
            Product insight
          </CardTitle>
          <CardDescription>Auto-generated from the current aggregates (not an LLM).</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-base leading-7 text-foreground">{payload.productInsight}</p>
        </CardContent>
      </Card>

      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Latency by mode" description="Mean latency — lower is better">
          <ChartViewport>
            {({ width, height }) => (
              <BarChart
                width={width}
                height={height}
                data={payload.chartLatencyByMode}
                margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}s`}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMs(Number(v))} />
                <Bar dataKey="latencyMs" radius={[6, 6, 0, 0]}>
                  {payload.chartLatencyByMode.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ChartViewport>
        </ChartCard>

        <ChartCard title="Cost by mode" description="Mean estimated USD per run">
          <ChartViewport>
            {({ width, height }) => (
              <BarChart
                width={width}
                height={height}
                data={payload.chartCostByMode}
                margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => currency.format(Number(v))}
                />
                <Bar dataKey="costUsd" radius={[6, 6, 0, 0]}>
                  {payload.chartCostByMode.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ChartViewport>
        </ChartCard>

        <ChartCard title="Task success score by mode" description="Mean rubric-style success (0–100%)">
          <ChartViewport>
            {({ width, height }) => (
              <BarChart
                width={width}
                height={height}
                data={payload.chartSuccessByMode}
                margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Math.round(Number(v))}%`} />
                <Bar dataKey="successPct" radius={[6, 6, 0, 0]}>
                  {payload.chartSuccessByMode.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ChartViewport>
        </ChartCard>

        <ChartCard
          title="Draft acceptance trend"
          description="Draft-verifier runs with acceptance rate (chronological)"
        >
          {payload.chartDraftAcceptanceTrend.length === 0 ? (
            <EmptyChart message="No draft-verifier runs with acceptance metrics yet." />
          ) : (
            <ChartViewport>
              {({ width, height }) => (
                <LineChart
                  width={width}
                  height={height}
                  data={payload.chartDraftAcceptanceTrend}
                  margin={{ left: 8, right: 12, top: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Math.round(Number(v))}%`} />
                  <Line
                    type="monotone"
                    dataKey="acceptancePct"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--chart-1)" }}
                  />
                </LineChart>
              )}
            </ChartViewport>
          )}
        </ChartCard>
      </section>

      <ChartCard
        title="Tool error rate by category"
        description="Mean tool error rate (%) — baseline vs draft-verifier"
        contentClassName="h-80"
      >
        {payload.chartToolErrorByCategory.length === 0 ? (
          <EmptyChart message="No category breakdown available." />
        ) : (
          <ChartViewport>
            {({ width, height }) => (
              <BarChart
                width={width}
                height={height}
                data={payload.chartToolErrorByCategory}
                margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
              >
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="category" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${Math.round(Number(v))}%`} />
                <Legend />
                <Bar dataKey="baseline" name="Baseline" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="draftVerifier"
                  name="Draft + Verifier"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
          </ChartViewport>
        )}
      </ChartCard>

      <Card className="bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle>Mode comparison</CardTitle>
          <CardDescription>Baseline versus draft-verifier averages over the same run window.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="text-right">Avg latency</TableHead>
                <TableHead className="text-right">Avg cost</TableHead>
                <TableHead className="text-right">Avg success</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[comparison.baseline, comparison.draftVerifier].map((row) => (
                <TableRow key={row.mode}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.runCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMs(row.avgLatencyMs)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {currency.format(row.avgCostUsd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPct(row.avgTaskSuccessScore)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
          <CardDescription>Open a persisted run for full output and tool trace.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {payload.recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs in this window.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.recentRuns.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimestamp(row.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {row.mode === "baseline" ? "Baseline" : "Draft + Verifier"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPct(row.taskSuccessScore)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMs(row.latencyMs)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/runs/${encodeURIComponent(row.id)}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatTimestamp(value: string) {
  return `${dateTime.format(new Date(value))} UTC`;
}

function StatCard({
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
      <CardContent className="grid gap-3 pt-6">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </span>
          <span className="flex size-9 items-center justify-center rounded-lg border border-primary/15 bg-primary/8 text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <div>
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("bg-card/85 shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={cn("h-72", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[12rem] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function ChartViewport({
  children,
}: {
  children: (size: { width: number; height: number }) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);

      if (width <= 0 || height <= 0) {
        return;
      }

      setSize((current) =>
        current?.width === width && current.height === height ? current : { width, height },
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-full min-h-0 w-full min-w-0">
      {size ? children(size) : <Skeleton className="h-full w-full min-h-[220px]" />}
    </div>
  );
}

function formatMs(ms: number) {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)} s`;
  }

  return `${Math.round(ms)} ms`;
}

function formatPct(fraction: number) {
  return `${Math.round(fraction * 100)}%`;
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
};
