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
import { useLocalApiConfig } from "@/hooks/use-local-api-config";
import { getProviderLabel, type AiProvider } from "@/lib/ai/catalog";
import { cn } from "@/lib/utils";

type BenchmarkMode = "baseline" | "draft_verifier";

type BenchmarkRunResponse = {
  benchmarkId: string;
  persisted: boolean;
  results: Array<{
    runId: string;
    persisted: boolean;
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
    error: string | null;
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

const compactCurrency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const modeCards = [
  {
    value: "baseline" as const,
    title: "单代理",
    description: "由一个智能体直接完成整组任务。",
  },
  {
    value: "draft_verifier" as const,
    title: "草稿 + 校验",
    description: "先生成草稿，再由校验模型复核或改写。",
  },
];

type BenchmarkRunnerProps = {
  defaultProvider: AiProvider;
};

export function BenchmarkRunner({ defaultProvider }: BenchmarkRunnerProps) {
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
  const { providerConfig, isConfigured, isReady } = useLocalApiConfig();

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
          providerConfig: providerConfig ?? undefined,
        }),
      });

      const payload = (await response.json()) as BenchmarkRunResponse & {
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        const suffix = payload.code ? ` [${payload.code}]` : "";
        setErrorMessage(`${payload.error ?? "无法开始这次批量测试。"}${suffix}`);
        return;
      }

      setResult(payload);
    } catch {
      setErrorMessage("启动批量测试时发生网络错误。");
    } finally {
      setIsSubmitting(false);
    }
  }

  const summaryStats = buildSummaryStats(result);
  const failedRuns = result?.results.filter((row) => row.status === "failed") ?? [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="批量测试"
        title="一次运行多组任务，快速比较不同模式。"
        description="选择想要测试的任务，批量运行不同模式，并集中查看成功率、耗时和失败原因。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-md px-2.5 py-1">
              已选 {selectedTasks.length} 个任务
            </Badge>
            <Badge variant="outline" className="rounded-md px-2.5 py-1">
              {selectedModes.length} 种模式
            </Badge>
          </div>
        }
      />

      {errorMessage ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" aria-hidden="true" />
          <AlertTitle>批量测试失败</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {isReady ? (
        <Alert>
          <Sparkles className="size-4" aria-hidden="true" />
          <AlertTitle>
            {isConfigured ? "已检测到浏览器侧 API 配置" : "当前未检测到浏览器侧 API 配置"}
          </AlertTitle>
          <AlertDescription>
            {isConfigured
              ? `本次会优先使用首页保存的 ${getProviderLabel(providerConfig?.provider ?? defaultProvider)} 本地凭证运行所选任务。`
              : `当前会回退使用部署环境中的 ${getProviderLabel(defaultProvider)} 配置。若线上未设置密钥，请先回首页填写本地 API 配置。`}
          </AlertDescription>
        </Alert>
      ) : null}

      {result && !result.persisted ? (
        <Alert>
          <TriangleAlert className="size-4" aria-hidden="true" />
          <AlertTitle>结果未持久化</AlertTitle>
          <AlertDescription>
            当前数据库尚未配置，这次批量测试的结果只会显示在页面中，不会保存到 <span className="font-mono">/runs/[id]</span>。
          </AlertDescription>
        </Alert>
      ) : null}

      {failedRuns.length > 0 ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" aria-hidden="true" />
          <AlertTitle>部分任务执行失败</AlertTitle>
          <AlertDescription>
            有 {failedRuns.length} 条运行返回失败。你可以在下方结果表查看具体任务与错误原因。
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[24rem_1fr]">
        <aside className="grid gap-5">
          <Card className="bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="size-4 text-primary" aria-hidden="true" />
                任务选择
              </CardTitle>
              <CardDescription>
                选择这次想要批量运行的任务。
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
                        <div className="font-medium">
                          {formatTaskTitle(task.id, task.title)}
                        </div>
                        <div className="mt-1 text-sm leading-6 text-muted-foreground">
                          {formatTaskGoal(task.id, task.userGoal)}
                        </div>
                      </div>
                      <Badge
                        variant={isSelected ? "default" : "outline"}
                        className="capitalize"
                      >
                        {formatDifficulty(task.difficulty)}
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
                运行模式
              </CardTitle>
              <CardDescription>选择这次要一起比较的模式。</CardDescription>
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
                        {isSelected ? "已纳入" : "关闭"}
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
                    <div className="text-sm font-medium">本次批量运行</div>
                    <p className="text-sm text-muted-foreground">
                      {selectedTaskIds.length} 个任务 × {selectedModes.length} 种模式
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
                      启用模型评分
                    </Label>
                    <p className="text-xs leading-5 text-muted-foreground">
                      可选地再走一遍模型评分，用于补充规则评分。需要{" "}
                      <span className="font-mono">OPENAI_API_KEY</span> 或{" "}
                      <span className="font-mono">SILICONFLOW_API_KEY</span>；如果不可用，会回退到启发式评分。
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
                      正在运行
                    </>
                  ) : (
                    <>
                      <Gauge className="size-4" aria-hidden="true" />
                      开始批量测试
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
              label="平均通过率"
              value={summaryStats.averageSuccess}
              hint="任务成功评分"
            />
            <MetricCard
              icon={Timer}
              label="平均时延"
              value={summaryStats.averageLatency}
              hint="全部选中运行的均值"
            />
            <MetricCard
              icon={CircleDollarSign}
              label="平均费用"
              value={summaryStats.averageCost}
              hint="按单次运行估算"
            />
            <MetricCard
              icon={ShieldCheck}
              label="草稿接受率"
              value={summaryStats.draftAcceptance}
              hint="仅草稿校验模式"
            />
          </section>

          <Card className="bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle>汇总结果</CardTitle>
              <CardDescription>
                按模式汇总通过率、耗时、费用和稳定性。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSubmitting && !result ? <AggregateLoading /> : null}

              {!isSubmitting && !result ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm leading-6 text-muted-foreground">
                  建议先从 2 到 3 个任务开始，先跑一轮看看不同模式在真实问题上的表现差异。
                </div>
              ) : null}

              {result ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {result.aggregates.map((aggregate) => (
                    <Card key={aggregate.mode} size="sm" className="bg-muted/20">
                      <CardHeader>
                        <CardTitle className="text-sm">
                          {aggregate.mode === "baseline"
                            ? "单代理"
                            : "草稿 + 校验"}
                        </CardTitle>
                        <CardDescription>
                          {aggregate.runCount} 次{result.persisted ? "已持久化" : "临时"}运行
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 text-sm">
                        <AggregateRow
                          label="任务成功率"
                          value={formatPercent(aggregate.averageTaskSuccessScore)}
                        />
                        <AggregateRow
                          label="推理质量"
                          value={formatPercent(aggregate.averageReasoningQualityScore)}
                        />
                        <AggregateRow
                          label="约束满足度"
                          value={formatPercent(aggregate.averageConstraintSatisfactionScore)}
                        />
                        <AggregateRow
                          label="工具使用评分"
                          value={formatPercent(aggregate.averageToolUseScore)}
                        />
                        <AggregateRow
                          label="时延"
                          value={formatMs(aggregate.averageLatencyMs)}
                        />
                        <AggregateRow
                          label="预估成本"
                          value={compactCurrency.format(
                            aggregate.averageEstimatedCostUsd,
                          )}
                        />
                        <AggregateRow
                          label="工具报错率"
                          value={formatPercent(aggregate.averageToolErrorRate)}
                        />
                        <AggregateRow
                          label="草稿接受率"
                          value={
                            aggregate.draftAcceptanceRate === null
                              ? "不适用"
                              : formatPercent(aggregate.draftAcceptanceRate)
                          }
                        />
                        <AggregateRow
                          label="平均置信度"
                          value={
                            aggregate.averageConfidenceScore === null
                              ? "不适用"
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
              <CardTitle>单项结果</CardTitle>
              <CardDescription>
                {result?.persisted
                  ? "每一行都已经落库，可以直接跳转到运行详情页。"
                  : "即使没有数据库，也会先显示结果；配置 DATABASE_URL 后可获得可持久化的详情链接。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isSubmitting && !result ? <ResultsLoading /> : null}

              {result ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务</TableHead>
                      <TableHead>模式</TableHead>
                      <TableHead>成功率</TableHead>
                      <TableHead className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Brain className="size-3.5" aria-hidden="true" />
                          推理
                        </span>
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <ListTodo className="size-3.5" aria-hidden="true" />
                          约束
                        </span>
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Scale className="size-3.5" aria-hidden="true" />
                          工具
                        </span>
                      </TableHead>
                      <TableHead>时延</TableHead>
                      <TableHead>成本</TableHead>
                      <TableHead>工具报错</TableHead>
                      <TableHead>草稿</TableHead>
                      <TableHead>置信度</TableHead>
                      <TableHead className="text-right">详情</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.results.map((row) => (
                      <TableRow key={row.runId}>
                        <TableCell className="min-w-72">
                          <div className="font-medium">
                            {formatTaskTitle(row.taskId, row.taskTitle)}
                          </div>
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
                          {row.error ? (
                            <div className="mt-2 rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-xs leading-5 text-destructive">
                              {row.error}
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
                              ? "单代理"
                              : "草稿 + 校验"}
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
                            <span className="text-muted-foreground">不适用</span>
                          ) : (
                            <Badge
                              variant={row.draftAccepted ? "secondary" : "outline"}
                            >
                              {row.draftAccepted ? "已接受" : "已拒绝"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.metrics.averageConfidenceScore === null
                            ? "不适用"
                            : formatPercent(row.metrics.averageConfidenceScore)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.persisted ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/runs/${encodeURIComponent(row.runId)}`}>
                                打开
                                <ArrowRight className="size-4" aria-hidden="true" />
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">未保存</span>
                          )}
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
      draftAcceptance: "不适用",
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
        ? "不适用"
        : formatPercent(
            draftRates.reduce((sum, value) => sum + value, 0) / draftRates.length,
          ),
  };
}

function formatCategory(category: string) {
  const labels: Record<string, string> = {
    "travel-planning": "行程规划",
    "customer-support": "客服支持",
    "product-requirement-clarification": "需求澄清",
    "data-analysis": "数据分析",
    "coding-assistant": "代码协作",
    "meeting-summarization": "会议总结",
    "product-recommendation": "产品推荐",
    "budget-planning": "预算规划",
    "multi-constraint-decision-making": "多约束决策",
    "agent-self-correction": "智能体自纠偏",
  };

  return labels[category] ?? category.replaceAll("-", " ");
}

function formatTaskTitle(taskId: string, fallback: string) {
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

function formatTaskGoal(taskId: string, fallback: string) {
  const labels: Record<string, string> = {
    "travel-europe-family-itinerary":
      "产出一份可随着到达时间、酒店位置和总预算变化而调整的真实行程安排。",
    "support-refund-escalation":
      "给出依据政策、语气稳妥且能随着新订单信息调整的客服处理方案。",
    "prd-clarification-for-ai-feature":
      "通过多轮澄清，把模糊想法收敛成目标用户、场景、非目标和指标都清晰的需求方案。",
    "sales-dataset-diagnosis":
      "像分析师一样逐步排查问题，在新数据不断出现时持续修正判断。",
    "codebase-bug-fix-guidance":
      "像结对工程师一样识别关键线索，提出可验证的修复方向与验证方案。",
    "executive-meeting-synthesis":
      "把零散会议笔记整理成清晰摘要，并在后续信息冲突时继续修正。",
    "laptop-recommendation-tradeoffs":
      "随着预算、系统偏好和性能要求变化，持续给出有取舍解释的推荐。",
    "quarterly-team-budget-plan":
      "产出一份能随招聘计划、削减目标和依赖变化而调整的务实预算方案。",
    "vendor-selection-under-constraints":
      "在安全、速度、成本等多目标冲突时，给出透明可解释的取舍过程。",
    "agent-self-correction-after-misread":
      "检查智能体能否承认误解、纠正上下文，并继续高质量完成后续任务。",
  };

  return labels[taskId] ?? fallback;
}

function formatDifficulty(difficulty: BenchmarkTaskDefinition["difficulty"]) {
  const labels: Record<BenchmarkTaskDefinition["difficulty"], string> = {
    easy: "简单",
    medium: "中等",
    hard: "困难",
  };

  return labels[difficulty];
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatMs(value: number) {
  return `${value.toLocaleString("zh-CN")} ms`;
}
