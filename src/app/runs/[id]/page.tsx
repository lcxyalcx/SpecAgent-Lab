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
  TriangleAlert,
  Wrench,
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
import { Separator } from "@/components/ui/separator";
import {
  formatDatabaseError,
  getPrisma,
  withDatabaseTimeout,
} from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";
import { getFileRunById, toRunDetailRow } from "@/lib/persistence/file-store";
import { buildStorageInfo } from "@/lib/persistence/state";
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
        eyebrow="运行详情"
        title="示例运行详情"
        description="当前页面用于预览运行详情的布局。配置数据库并完成一次批量测试后，这里会展示真实回答、工具过程和评分结果。"
      />
      <Card>
        <CardContent className="grid gap-3 pt-6 text-sm leading-6 text-muted-foreground">
          <p>
            如果要查看真实运行记录，请先配置 <span className="font-mono">DATABASE_URL</span>，然后在{" "}
            <span className="font-mono">/benchmark</span> 页面发起一次批量测试。
          </p>
          <p className="text-xs">
            请求 ID：<span className="font-mono">{displayId}</span>
          </p>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" aria-hidden="true" />
            查看结果总览
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/benchmark">去批量测试</Link>
        </Button>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: RunDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const displayId = decodeURIComponent(id);

  if (displayId === "demo-run") {
    return { title: "示例运行 · SpecAgent Lab" };
  }

  if (!isDatabaseConfigured()) {
    const fileRun = await getFileRunById(displayId);
    if (fileRun) {
      return { title: `${fileRun.name} · SpecAgent Lab` };
    }

    return { title: "运行详情 · SpecAgent Lab" };
  }

  try {
    const run = await withDatabaseTimeout(
      getPrisma().run.findUnique({
        where: { id: displayId },
        select: { name: true },
      }),
    );

    if (run) {
      return { title: `${run.name} · SpecAgent Lab` };
    }
  } catch {
    /* ignore */
  }

  const fileRun = await getFileRunById(displayId);
  if (fileRun) {
    return { title: `${fileRun.name} · SpecAgent Lab` };
  }

  return { title: `运行 ${displayId.slice(0, 8)}… · SpecAgent Lab` };
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { id } = await params;
  const displayId = decodeURIComponent(id);

  if (displayId === "demo-run") {
    return <DemoRunFallback displayId={displayId} />;
  }

  let run = null;
  let loadError: string | null = null;
  let runSource: "database" | "file" | null = null;
  const databaseConfigured = isDatabaseConfigured();

  if (databaseConfigured) {
    try {
      run = await withDatabaseTimeout(
        getPrisma().run.findUnique({
          where: { id: displayId },
          include: {
            agentConfig: true,
            benchmarkTask: true,
            toolCalls: { orderBy: { sequence: "asc" } },
          },
        }),
      );

      if (run) {
        runSource = "database";
      }
    } catch (error) {
      loadError = formatDatabaseError(error);
    }
  }

  if (!run) {
    const fileRun = await getFileRunById(displayId);
    if (fileRun) {
      run = toRunDetailRow(fileRun);
      runSource = "file";
    }
  }

  if (!run && !databaseConfigured) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="运行详情"
          title="暂时还没有可查看的运行详情"
          description="当前环境还没有配置数据库，也还没有命中可用的本地文件记录。你仍然可以先跑一次任务，系统会自动回退到文件存储。"
        />
        <Card>
          <CardContent className="grid gap-3 pt-6 text-sm leading-6 text-muted-foreground">
            <p>
              现在即使没有 <span className="font-mono">DATABASE_URL</span>，运行结果也会先保存到本地文件。完成一次试运行或批量测试后，可以直接回到这里查看真实记录。
            </p>
            <p>
              如果你希望这些记录在多实例和长期运行中都稳定保留，仍然建议配置 PostgreSQL，并执行{" "}
              <span className="font-mono">pnpm run db:push</span>。
            </p>
            <p className="text-xs">
              请求 ID：<span className="font-mono">{displayId}</span>
            </p>
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" aria-hidden="true" />
              查看结果总览
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/benchmark">去批量测试</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (loadError && !run) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="运行详情"
          title="数据库不可用"
          description="已检测到 DATABASE_URL，但当前无法读取这次运行记录，也没有找到对应的文件回退记录。请先恢复数据库连接，再重试。"
        />
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">{loadError}</CardContent>
        </Card>
        <Button asChild variant="outline">
          <Link href="/benchmark">
            <ArrowLeft className="size-4" aria-hidden="true" />
            返回批量测试
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
        eyebrow="运行详情"
        title={formatRunName(run.name)}
        description="查看这次运行的输入、回答、工具过程和评分结果。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">
                <ArrowLeft className="size-4" aria-hidden="true" />
                结果总览
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/benchmark">批量测试</Link>
            </Button>
            <Badge variant={statusVariant} className="rounded-md">
              {formatRunStatus(run.status)}
            </Badge>
            <Badge variant="outline" className="rounded-md">
              {vm.modeLabel}
            </Badge>
          </div>
        }
      />

      {runSource === "file" ? (
        <Alert>
          <TriangleAlert className="size-4" aria-hidden="true" />
          <AlertTitle>
            {loadError ? "数据库不可用，当前展示文件回退记录" : "当前展示文件回退记录"}
          </AlertTitle>
          <AlertDescription>
            {buildStorageInfo(
              "file",
              loadError
                ? `${buildStorageInfo("file").message} 当前数据库状态：${loadError}`
                : buildStorageInfo("file").message,
            ).message}
          </AlertDescription>
        </Alert>
      ) : null}

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
            <CardDescription>本次运行使用的模式、模型和任务信息。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <InfoRow label="运行方式" value={vm.modeLabel} />
            <InfoRow label="系统记录模式" value={formatStoredMode(vm.agentMode)} />
            <InfoRow label="模型" value={vm.modelsLabel} />
            <InfoRow label="配置名称" value={run.agentConfig.name} />
            {vm.benchmarkMeta.benchmarkId ? (
              <InfoRow label="批量测试批次 ID" value={vm.benchmarkMeta.benchmarkId} />
            ) : null}
            {vm.benchmarkMeta.taskTitle ? (
              <InfoRow label="任务" value={formatTaskTitle(String(vm.benchmarkMeta.taskTitle))} />
            ) : null}
            {vm.benchmarkMeta.category ? (
              <InfoRow label="类别" value={formatCategoryLabel(String(vm.benchmarkMeta.category))} />
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
              评分结果
            </CardTitle>
            <CardDescription>按规则或模型评分得到的分项结果（若存在）。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              <MiniScore label="推理" value={vm.reasoningQualityScore} />
              <MiniScore label="约束" value={vm.constraintSatisfactionScore} />
              <MiniScore label="工具分" value={vm.toolUseScore} />
            </div>
            {vm.evaluationMethod ? (
              <Badge variant="secondary" className="w-fit capitalize">
                {formatEvaluationMethod(vm.evaluationMethod)}
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
            <CardDescription>用户问题、系统设定和原始请求数据。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {vm.userPrompt ? (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  用户问题
                </div>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-6">
                  {vm.userPrompt}
                </pre>
              </div>
            ) : null}
            {vm.systemPrompt ? (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  系统设定
                </div>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                  {vm.systemPrompt}
                </pre>
              </div>
            ) : null}
            <details className="group rounded-lg border border-border bg-muted/20">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
                <FileJson className="size-4 text-muted-foreground" aria-hidden="true" />
                原始输入 JSON
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
            <CardDescription>本次返回的最终回答，以及系统保存的输出数据。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {vm.finalAnswer ? (
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm leading-6">
                {vm.finalAnswer}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">当前没有记录到最终回答字段。</p>
            )}
            {vm.errorMessage ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {vm.errorMessage}
              </p>
            ) : null}
            <details className="group rounded-lg border border-border bg-muted/20">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
                <FileJson className="size-4 text-muted-foreground" aria-hidden="true" />
                原始输出 JSON
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
            <CardTitle className="text-base">草稿校验信息</CardTitle>
            <CardDescription>展示草稿内容、审核决定和接受情况。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2 text-sm">
              <InfoRow
                label="审核决定"
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
                审核说明
              </div>
              <p className="mt-2 rounded-lg border border-border bg-background p-3 text-sm leading-6">
                {vm.draftVerifier.verifierReason}
              </p>
            </div>
            {vm.draftVerifier.draftAnswer.trim() ? (
              <div className="lg:col-span-2">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  草稿原文
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
            <CardTitle className="text-base">草稿校验摘要</CardTitle>
            <CardDescription>本次运行没有保存完整草稿对象，以下内容来自 summary 或 metrics。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {vm.summaryHints.verifierDecision ? (
              <InfoRow label="审核决定" value={vm.summaryHints.verifierDecision} />
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
            用户问题 → 草稿（若有）→ 工具调用 → 审核（若有）→ 最终回答。
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
          <CardDescription>每次调用都展示状态、耗时和请求数据，便于快速排查问题。</CardDescription>
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
                      {formatToolCallStatus(call.status)}
                    </Badge>
                  </div>
                </summary>
                <div className="grid gap-2 border-t border-border px-3 py-3 text-xs">
                  <div>
                    <span className="font-medium text-muted-foreground">输入</span>
                    <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-muted/50 p-2">
                      {safeStringify(call.input)}
                    </pre>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">输出</span>
                    <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-muted/50 p-2">
                      {safeStringify(call.output)}
                    </pre>
                  </div>
                  {call.error != null ? (
                    <div>
                      <span className="font-medium text-destructive">错误</span>
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
            系统解读
          </CardTitle>
          <CardDescription>
            根据状态、评分、耗时和工具表现自动生成，帮助快速判断这次运行值不值得继续优化。
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
            运行 ID：<span className="font-mono">{run.id}</span> ·{" "}
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

function formatRunStatus(status: string) {
  switch (status) {
    case "SUCCEEDED":
      return "成功";
    case "FAILED":
      return "失败";
    case "RUNNING":
      return "运行中";
    default:
      return status;
  }
}

function formatToolCallStatus(status: string) {
  switch (status) {
    case "SUCCEEDED":
      return "成功";
    case "FAILED":
      return "失败";
    default:
      return status;
  }
}

function formatStoredMode(value: string) {
  switch (value) {
    case "BASELINE":
      return "单代理";
    case "DRAFT_VERIFIER":
      return "草稿 + 校验";
    default:
      return value;
  }
}

function formatEvaluationMethod(value: string) {
  switch (value) {
    case "heuristic":
      return "启发式评分";
    case "llm_judge":
      return "模型评分";
    default:
      return value.replaceAll("_", " ");
  }
}

function formatCategoryLabel(value: string) {
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

  return labels[value] ?? value.replaceAll("-", " ");
}

function formatTaskTitle(value: string) {
  const labels: Record<string, string> = {
    "Europe family itinerary under budget": "预算内的欧洲亲子行程规划",
    "Handle a refund request with policy constraints": "处理带政策边界的退款请求",
    "Clarify an ambiguous AI product request": "澄清模糊的 AI 功能需求",
    "Diagnose a drop in sales conversion": "诊断销售漏斗转化下滑",
    "Debug an asynchronous web app issue": "排查 Web 应用中的异步疑难问题",
    "Summarize a messy executive meeting": "整理混乱的管理层会议记录",
    "Recommend a laptop under changing constraints": "在需求变化下推荐合适笔记本",
    "Plan a quarterly team budget": "规划季度团队预算",
    "Select a vendor under multiple constraints": "在多重约束下选择供应商",
    "Recover after misunderstanding the task": "在误解需求后完成自我纠偏",
  };

  return labels[value] ?? value;
}

function formatRunName(value: string) {
  return value
    .replaceAll("Playground baseline run", "试运行 · 单代理")
    .replaceAll("Playground draft-verifier run", "试运行 · 草稿 + 校验")
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
    .replaceAll("draft_verifier", "草稿 + 校验")
    .replaceAll("baseline", "单代理");
}
