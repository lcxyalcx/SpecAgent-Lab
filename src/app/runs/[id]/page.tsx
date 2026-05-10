import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileJson,
  GitBranch,
  Layers,
  Lightbulb,
  MessageSquare,
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
import { Separator } from "@/components/ui/separator";
import { DatabaseNotConfiguredError, getPrisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";
import {
  buildRunDetailViewModel,
  buildTimelineSteps,
  type TimelineStepKind,
} from "@/lib/runs/run-detail";
import { cn } from "@/lib/utils";

type RunDetailPageProps = {
  params: Promise<{ id: string }>;
};

function DemoRunFallback({ displayId }: { displayId: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Run Detail"
        title="演示模式（示例 Run）"
        description="当前链接用于展示 Run Detail 的版式与信息结构。配置数据库并实际运行 benchmark 后，这里会展示真实的执行结果、工具轨迹和评分。"
      />
      <Card>
        <CardContent className="grid gap-3 pt-6 text-sm leading-6 text-muted-foreground">
          <p>
            如果要查看真实运行记录，请先配置 <span className="font-mono">DATABASE_URL</span>，然后在{" "}
            <span className="font-mono">/benchmark</span> 发起一次运行。
          </p>
          <p className="text-xs">
            Requested id: <span className="font-mono">{displayId}</span>
          </p>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" aria-hidden="true" />
            查看仪表盘
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/benchmark">Benchmark</Link>
        </Button>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: RunDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const displayId = decodeURIComponent(id);

  if (displayId === "demo-run") {
    return { title: "Demo run · SpecAgent Lab" };
  }

  if (!isDatabaseConfigured()) {
    return { title: `Run · SpecAgent Lab` };
  }

  try {
    const run = await getPrisma().run.findUnique({
      where: { id: displayId },
      select: { name: true },
    });

    if (run) {
      return { title: `${run.name} · SpecAgent Lab` };
    }
  } catch {
    /* ignore */
  }

  return { title: `Run ${displayId.slice(0, 8)}… · SpecAgent Lab` };
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { id } = await params;
  const displayId = decodeURIComponent(id);

  if (displayId === "demo-run") {
    return <DemoRunFallback displayId={displayId} />;
  }

  if (!isDatabaseConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Run Detail"
          title="演示模式（未配置数据库）"
          description="Vercel 或本地未设置 DATABASE_URL 时，无法加载真实 Run。仪表盘仍可使用内置示例数据；配置 Postgres 后即可打开 benchmark 产生的 /runs/[id] 链接。"
        />
        <Card>
          <CardContent className="grid gap-3 pt-6 text-sm leading-6 text-muted-foreground">
            <p>
              请在环境变量中设置 <span className="font-mono">DATABASE_URL</span>（如 Vercel Postgres、Neon），并执行{" "}
              <span className="font-mono">pnpm run db:push</span> 与{" "}
              <span className="font-mono">pnpm run db:seed</span>（可选），再运行 Benchmark 生成可查看的运行记录。
            </p>
            <p className="text-xs">
              Requested id: <span className="font-mono">{displayId}</span>
            </p>
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden="true" />
              查看仪表盘（示例数据）
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/benchmark">Benchmark</Link>
          </Button>
        </div>
      </div>
    );
  }

  let loadError: string | null = null;
  let run = null;

  try {
    run = await getPrisma().run.findUnique({
      where: { id: displayId },
      include: {
        agentConfig: true,
        benchmarkTask: true,
        toolCalls: { orderBy: { sequence: "asc" } },
      },
    });
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      loadError = error.message;
    } else {
      loadError =
        error instanceof Error ? error.message : "Unable to load run from database.";
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Run Detail"
          title="数据库不可用"
          description="请配置 DATABASE_URL 后重试；benchmark 结果会持久化到 Run 表。"
        />
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{loadError}</CardContent>
        </Card>
        <Button asChild variant="outline">
          <Link href="/benchmark">
            <ArrowLeft className="size-4" aria-hidden="true" />
            返回 Benchmark
          </Link>
        </Button>
      </div>
    );
  }

  if (!run) {
    notFound();
  }

  const vm = buildRunDetailViewModel(run);
  const timeline = buildTimelineSteps(vm);

  const statusVariant =
    run.status === "SUCCEEDED"
      ? "secondary"
      : run.status === "FAILED"
        ? "destructive"
        : "outline";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Run Detail"
        title={run.name}
        description="单次 benchmark / 评估运行的完整输入、工具轨迹、评分与可讲给面试官的产品叙事。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/benchmark">Benchmark</Link>
            </Button>
            <Badge variant={statusVariant} className="rounded-md capitalize">
              {run.status.toLowerCase().replaceAll("_", " ")}
            </Badge>
            <Badge variant="outline" className="rounded-md">
              {vm.modeLabel}
            </Badge>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          icon={Timer}
          label="延迟"
          value={vm.latencyMs != null ? formatDuration(vm.latencyMs) : "—"}
        />
        <MetricTile
          icon={CircleDollarSign}
          label="估算成本"
          value={vm.costUsd != null ? `$${vm.costUsd.toFixed(4)}` : "—"}
        />
        <MetricTile
          icon={CheckCircle2}
          label="任务成功分"
          value={
            vm.taskSuccessScore != null ? `${Math.round(vm.taskSuccessScore * 100)}%` : "—"
          }
        />
        <MetricTile
          icon={Wrench}
          label="工具错误"
          value={
            vm.toolCallCount > 0
              ? `${vm.toolErrorCount}/${vm.toolCallCount}（${Math.round((vm.toolErrorRate ?? 0) * 100)}%）`
              : "无工具调用"
          }
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="size-4 text-primary" aria-hidden="true" />
              模式与模型
            </CardTitle>
            <CardDescription>Agent 配置与 benchmark 元数据。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <InfoRow label="工作流" value={vm.modeLabel} />
            <InfoRow label="Prisma AgentMode" value={vm.agentMode} />
            <InfoRow label="模型" value={vm.modelsLabel} />
            <InfoRow label="配置名称" value={run.agentConfig.name} />
            {vm.benchmarkMeta.benchmarkId ? (
              <InfoRow label="Benchmark ID" value={vm.benchmarkMeta.benchmarkId} />
            ) : null}
            {vm.benchmarkMeta.taskTitle ? (
              <InfoRow label="任务" value={String(vm.benchmarkMeta.taskTitle)} />
            ) : null}
            {vm.benchmarkMeta.category ? (
              <InfoRow label="类别" value={String(vm.benchmarkMeta.category)} />
            ) : null}
            {vm.benchmarkMeta.difficulty != null ? (
              <InfoRow label="难度" value={String(vm.benchmarkMeta.difficulty)} />
            ) : null}
          </CardContent>
        </Card>

        <Card className="bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="size-4 text-primary" aria-hidden="true" />
              评估与 Rubric
            </CardTitle>
            <CardDescription>启发式或 LLM judge 产出的分项分（若存在）。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              <MiniScore label="推理" value={vm.reasoningQualityScore} />
              <MiniScore label="约束" value={vm.constraintSatisfactionScore} />
              <MiniScore label="工具分" value={vm.toolUseScore} />
            </div>
            {vm.evaluationMethod ? (
              <Badge variant="secondary" className="w-fit capitalize">
                {vm.evaluationMethod.replaceAll("_", " ")}
              </Badge>
            ) : null}
            {vm.evaluationExplanation ? (
              <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm leading-6 text-muted-foreground">
                {vm.evaluationExplanation}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">暂无评估说明。</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="size-4 text-primary" aria-hidden="true" />
              输入
            </CardTitle>
            <CardDescription>用户提示、系统提示与原始 JSON。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {vm.userPrompt ? (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  User prompt
                </div>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-6">
                  {vm.userPrompt}
                </pre>
              </div>
            ) : null}
            {vm.systemPrompt ? (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  System prompt
                </div>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                  {vm.systemPrompt}
                </pre>
              </div>
            ) : null}
            <details className="group rounded-lg border border-border bg-muted/20">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
                <FileJson className="size-4 text-muted-foreground" aria-hidden="true" />
                原始 input JSON
              </summary>
              <pre className="max-h-72 overflow-auto border-t border-border p-3 text-xs leading-relaxed">
                {safeStringify(vm.rawInput)}
              </pre>
            </details>
          </CardContent>
        </Card>

        <Card className="bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="size-4 text-primary" aria-hidden="true" />
              最终输出
            </CardTitle>
            <CardDescription>面向用户的答案与持久化的 output 载荷。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {vm.finalAnswer ? (
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-6">
                {vm.finalAnswer}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">无 finalAnswer / outputText 字段。</p>
            )}
            {vm.errorMessage ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {vm.errorMessage}
              </p>
            ) : null}
            <details className="group rounded-lg border border-border bg-muted/20">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
                <FileJson className="size-4 text-muted-foreground" aria-hidden="true" />
                原始 output JSON
              </summary>
              <pre className="max-h-72 overflow-auto border-t border-border p-3 text-xs leading-relaxed">
                {safeStringify(vm.rawOutput)}
              </pre>
            </details>
          </CardContent>
        </Card>
      </section>

      {vm.draftVerifier ? (
        <Card className="border-primary/20 bg-primary/[0.03] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Draft–Verifier 元数据</CardTitle>
            <CardDescription>推测式工作流中的草稿、验证决策与接受情况。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2 text-sm">
              <InfoRow
                label="验证决定"
                value={vm.draftVerifier.verifierDecision}
              />
              <InfoRow
                label="草稿是否被接受"
                value={
                  vm.draftVerifier.draftAccepted === null
                    ? "未知"
                    : vm.draftVerifier.draftAccepted
                      ? "是"
                      : "否"
                }
              />
              {vm.summaryHints.draftAcceptanceRate != null ? (
                <InfoRow
                  label="指标中的接受率"
                  value={`${Math.round(vm.summaryHints.draftAcceptanceRate * 100)}%`}
                />
              ) : null}
              <InfoRow
                label="置信度"
                value={`${Math.round(vm.draftVerifier.confidenceScore * 100)}%`}
              />
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Verifier reason
              </div>
              <p className="mt-2 rounded-lg border border-border bg-background p-3 text-sm leading-6">
                {vm.draftVerifier.verifierReason}
              </p>
            </div>
            {vm.draftVerifier.draftAnswer.trim() ? (
              <div className="lg:col-span-2">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Draft 原文
                </div>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-6">
                  {vm.draftVerifier.draftAnswer}
                </pre>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : vm.workflowMode === "draft_verifier" ? (
        <Card className="bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Draft–Verifier</CardTitle>
            <CardDescription>本次运行未包含完整 draft 对象，以下为 summary / metrics 中的线索。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {vm.summaryHints.verifierDecision ? (
              <InfoRow label="验证决策" value={vm.summaryHints.verifierDecision} />
            ) : null}
            {vm.summaryHints.draftAcceptanceRate != null ? (
              <InfoRow
                label="草稿接受率（指标）"
                value={`${Math.round(vm.summaryHints.draftAcceptanceRate * 100)}%`}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="size-4 text-primary" aria-hidden="true" />
            时间线
          </CardTitle>
          <CardDescription>
            用户输入 → 草稿（若有）→ 工具调用 → 验证（若有）→ 最终回答。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RunTimeline steps={timeline} />
        </CardContent>
      </Card>

      <Card className="bg-card/85 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4 text-primary" aria-hidden="true" />
            工具调用
          </CardTitle>
          <CardDescription>每条包含状态、延迟与序列化负载，便于复盘。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {vm.toolCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground">无工具调用记录。</p>
          ) : (
            vm.toolCalls.map((call) => (
              <details
                key={call.id}
                className="rounded-lg border border-border bg-background open:bg-muted/20"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm font-medium">
                  <span>
                    {call.sequence}. {call.toolName}
                  </span>
                  <div className="flex items-center gap-2">
                    {call.latencyMs != null ? (
                      <span className="text-xs font-normal text-muted-foreground">
                        {call.latencyMs} ms
                      </span>
                    ) : null}
                    <Badge variant={call.status === "SUCCEEDED" ? "secondary" : "destructive"}>
                      {call.status}
                    </Badge>
                  </div>
                </summary>
                <div className="grid gap-2 border-t border-border px-3 py-3 text-xs">
                  <div>
                    <span className="font-medium text-muted-foreground">Input</span>
                    <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-muted/50 p-2">
                      {safeStringify(call.input)}
                    </pre>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Output</span>
                    <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-muted/50 p-2">
                      {safeStringify(call.output)}
                    </pre>
                  </div>
                  {call.error != null ? (
                    <div>
                      <span className="font-medium text-destructive">Error</span>
                      <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-destructive/5 p-2 text-destructive">
                        {safeStringify(call.error)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              </details>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="size-5 text-primary" aria-hidden="true" />
            产品解读（Product Interpretation）
          </CardTitle>
          <CardDescription>
            基于状态、评分、延迟与工具表现的自动摘要，可用于面试中解释「这次运行说明了什么」。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ul className="grid gap-3 text-sm leading-7 text-foreground">
            {vm.productInterpretation.map((paragraph, index) => (
              <li key={index} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span>{paragraph}</span>
              </li>
            ))}
          </ul>
          <Separator />
          <p className="text-xs leading-5 text-muted-foreground">
            Run ID：<span className="font-mono">{run.id}</span> ·{" "}
            {new Date(vm.createdAt).toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
}) {
  return (
    <Card size="sm" className="bg-card/85 shadow-sm">
      <CardContent className="grid gap-2 pt-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </span>
          <Icon className="size-4 text-primary" aria-hidden="true" />
        </div>
        <div className="text-xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2 py-2 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold">
        {value == null ? "—" : `${Math.round(value * 100)}%`}
      </div>
    </div>
  );
}

function RunTimeline({
  steps,
}: {
  steps: ReturnType<typeof buildTimelineSteps>;
}) {
  return (
    <ol className="relative ms-2 border-s border-border ps-6">
      {steps.map((step, index) => (
        <li key={`${step.kind}-${index}`} className="mb-10 last:mb-2">
          <span
            className={cn(
              "absolute -start-[5px] mt-1.5 size-2.5 rounded-full border-2 border-background ring-2",
              stepKindRing(step.kind),
            )}
            aria-hidden="true"
          />
          <div className="text-sm font-semibold">{step.title}</div>
          {step.meta ? (
            <div className="mt-0.5 text-xs text-muted-foreground">{step.meta}</div>
          ) : null}
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm leading-6">
            {step.body}
          </pre>
        </li>
      ))}
    </ol>
  );
}

function stepKindRing(kind: TimelineStepKind): string {
  switch (kind) {
    case "user":
      return "bg-chart-2 ring-chart-2/30";
    case "draft":
      return "bg-chart-3 ring-chart-3/30";
    case "tool":
      return "bg-chart-4 ring-chart-4/30";
    case "verifier":
      return "bg-chart-5 ring-chart-5/30";
    case "final":
      return "bg-primary ring-primary/30";
    default:
      return "bg-muted-foreground ring-muted-foreground/20";
  }
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDuration(ms: number) {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)} s`;
  }
  return `${ms} ms`;
}
