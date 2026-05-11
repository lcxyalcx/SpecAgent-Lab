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

const currency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
});

const dateTime = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export function AnalyticsDashboard({ payload }: AnalyticsDashboardProps) {
  const { overview, source, comparison } = payload;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="结果总览"
        title="在一个界面里看质量、速度和成本。"
        description="集中查看最近运行的通过率、耗时、费用和工具稳定性；如果暂时没有历史记录，这里会先展示示例数据帮助你熟悉界面。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={source === "database" ? "default" : "secondary"}
              className="rounded-md"
            >
              {source === "database"
                ? "实时数据"
                : source === "demo"
                  ? "示例数据（未配置数据库）"
                  : "示例数据（数据库为空）"}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href="/benchmark">
                去做一次批量测试
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Gauge}
          label="运行次数"
          value={String(overview.totalRuns)}
          hint="当前统计窗口"
        />
        <StatCard
          icon={Timer}
          label="平均时延"
          value={formatMs(overview.avgLatencyMs)}
          hint="所含运行的平均值"
        />
        <StatCard
          icon={CircleDollarSign}
          label="平均费用"
          value={currency.format(overview.avgCostUsd)}
          hint="按单次运行估算"
        />
        <StatCard
          icon={BarChart3}
          label="平均通过率"
          value={formatPct(overview.avgTaskSuccessScore)}
          hint="评分范围 0–100%"
        />
        <StatCard
          icon={Wrench}
          label="工具报错率"
          value={formatPct(overview.toolErrorRate)}
          hint="按每次运行求均值"
        />
        <StatCard
          icon={Gauge}
          label="草稿接受率"
          value={
            overview.draftAcceptanceRate === null
              ? "不适用"
              : formatPct(overview.draftAcceptanceRate)
          }
          hint="仅统计草稿校验模式"
        />
      </section>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/6 via-card to-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="size-5 text-primary" aria-hidden="true" />
            系统解读
          </CardTitle>
          <CardDescription>根据当前汇总结果自动生成，帮助快速判断接下来该优化什么。</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-base leading-7 text-foreground">{payload.productInsight}</p>
        </CardContent>
      </Card>

      <section className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="不同模式的平均时延" description="耗时越低越好">
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

        <ChartCard title="不同模式的平均费用" description="按单次运行估算的美元成本">
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

        <ChartCard title="不同模式的平均通过率" description="按评分规则换算后的平均分（0–100%）">
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
          title="草稿接受率趋势"
          description="按时间顺序查看草稿校验模式的接受率变化"
        >
          {payload.chartDraftAcceptanceTrend.length === 0 ? (
            <EmptyChart message="暂时还没有带草稿接受率指标的运行记录。" />
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
        title="按任务类型查看工具报错率"
        description="比较不同模式在各类任务中的平均工具报错率（%）"
        contentClassName="h-80"
      >
        {payload.chartToolErrorByCategory.length === 0 ? (
          <EmptyChart message="暂时还没有可用的分类对比数据。" />
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
                <Bar dataKey="baseline" name="单代理" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="draftVerifier"
                  name="草稿 + 校验"
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
          <CardTitle>模式对比</CardTitle>
          <CardDescription>在同一批运行窗口里，对比不同模式的平均表现。</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>模式</TableHead>
                <TableHead className="text-right">运行数</TableHead>
                <TableHead className="text-right">平均时延</TableHead>
                <TableHead className="text-right">平均费用</TableHead>
                <TableHead className="text-right">平均通过率</TableHead>
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
          <CardTitle>最近运行</CardTitle>
          <CardDescription>打开任意一条已保存记录，查看完整回答和工具过程。</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {payload.recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">当前统计窗口里还没有运行记录。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>运行</TableHead>
                  <TableHead>模式</TableHead>
                  <TableHead className="text-right">通过率</TableHead>
                  <TableHead className="text-right">时延</TableHead>
                  <TableHead className="text-right">查看</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.recentRuns.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate font-medium">{formatRunName(row.name)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimestamp(row.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {row.mode === "baseline" ? "单代理" : "草稿 + 校验"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPct(row.taskSuccessScore)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMs(row.latencyMs)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/runs/${encodeURIComponent(row.id)}`}>查看详情</Link>
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

function formatRunName(value: string) {
  return value
    .replaceAll("Playground baseline run", "试运行 · 单代理")
    .replaceAll("Playground draft-verifier run", "试运行 · 草稿 + 校验")
    .replaceAll("travel-europe-family-itinerary", "预算内的欧洲亲子行程规划")
    .replaceAll("support-refund-escalation", "处理带政策边界的退款请求")
    .replaceAll("prd-clarification-for-ai-feature", "澄清模糊的 AI 功能需求")
    .replaceAll("sales-dataset-diagnosis", "诊断销售漏斗转化下滑")
    .replaceAll("codebase-bug-fix-guidance", "排查 Web 应用中的异步疑难问题")
    .replaceAll("executive-meeting-synthesis", "整理混乱的管理层会议记录")
    .replaceAll("laptop-recommendation-tradeoffs", "在需求变化下推荐合适笔记本")
    .replaceAll("quarterly-team-budget-plan", "规划季度团队预算")
    .replaceAll("vendor-selection-under-constraints", "在多重约束下选择供应商")
    .replaceAll("agent-self-correction-after-misread", "在误解需求后完成自我纠偏")
    .replaceAll("Europe family itinerary under budget", "预算内的欧洲亲子行程规划")
    .replaceAll("Handle a refund request with policy constraints", "处理带政策边界的退款请求")
    .replaceAll("Clarify an ambiguous AI product request", "澄清模糊的 AI 功能需求")
    .replaceAll("Diagnose a drop in sales conversion", "诊断销售漏斗转化下滑")
    .replaceAll("Debug an asynchronous web app issue", "排查 Web 应用中的异步疑难问题")
    .replaceAll("Summarize a messy executive meeting", "整理混乱的管理层会议记录")
    .replaceAll("Recommend a laptop under changing constraints", "在需求变化下推荐合适笔记本")
    .replaceAll("Plan a quarterly team budget", "规划季度团队预算")
    .replaceAll("Select a vendor under multiple constraints", "在多重约束下选择供应商")
    .replaceAll("Recover after misunderstanding the task", "在误解需求后完成自我纠偏")
    .replaceAll("draft-verifier", "草稿 + 校验")
    .replaceAll("baseline", "单代理")
    .replaceAll("draft_verifier", "草稿 + 校验");
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
