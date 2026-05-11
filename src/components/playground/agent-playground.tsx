"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Brain,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Cpu,
  Sparkles,
  TriangleAlert,
  Wrench,
  Zap,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLocalApiConfig } from "@/hooks/use-local-api-config";
import {
  getDefaultModelsForProvider,
  getModelOptionsForProvider,
  getProviderLabel,
  isKnownModelCompatibleWithProvider,
  type AiProvider,
} from "@/lib/ai/catalog";
import { cn } from "@/lib/utils";

const toolOptions = [
  {
    id: "calculator",
    label: "计算器",
    description: "执行确定性计算，并对不安全表达式做保护。",
  },
  {
    id: "mockSearch",
    label: "模拟搜索",
    description: "查询本地知识库，并保持稳定的结果排序。",
  },
  {
    id: "productDb",
    label: "产品库",
    description: "为推荐类任务提供结构化商品信息。",
  },
  {
    id: "calendar",
    label: "日历",
    description: "为规划类场景提供模拟空闲时间段。",
  },
] as const;

const modeOptions = [
  {
    value: "baseline",
    label: "单代理",
    description: "单个智能体直接执行，并按需调用工具。",
  },
  {
    value: "draft_verifier",
    label: "草稿 + 校验",
    description: "先生成草稿，再由校验模型审核或改写。",
  },
] as const;

type Mode = "baseline" | "draft_verifier";
type EnabledTool = (typeof toolOptions)[number]["id"];

type PlaygroundRunResponse = {
  runId: string;
  persisted: boolean;
  mode: Mode;
  status: "succeeded" | "failed";
  output: string;
  latency: number;
  cost: number;
  toolCalls: ToolCallRecord[];
  draftAccepted: boolean | null;
  result: BaselineRunResult | DraftVerifierRunResult;
  error?: string;
};

type ToolCallRecord = {
  toolCallId: string;
  toolName: string;
  stepNumber: number | null;
  input: unknown;
  output: unknown | null;
  success: boolean;
  latencyMs: number;
  error: string | null;
};

type BaselineRunResult = {
  status: "succeeded" | "failed";
  model: string;
  outputText: string;
  error: string | null;
  latencyMs: number;
  toolCalls: ToolCallRecord[];
  metrics: {
    toolCallCount: number;
    toolErrorCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
};

type DraftVerifierRunResult = BaselineRunResult & {
  workflow: "speculative-style draft-verifier";
  draftModel: string;
  verifierModel: string;
  draft: {
    draftAnswer: string;
    draftPlan: string[];
    expectedToolCalls: string[];
    latencyMs: number;
  };
  verifier: {
    decision: "accept" | "revise" | "reject";
    reason: string;
    confidenceScore: number;
    latencyMs: number;
  };
  metrics: BaselineRunResult["metrics"] & {
    draftLatencyMs: number;
    verifierLatencyMs: number;
    totalLatencyMs: number;
    draftAccepted: boolean;
    draftAcceptanceRate: number;
    confidenceScore: number;
  };
};

type FormState = {
  agentName: string;
  mode: Mode;
  systemPrompt: string;
  userPrompt: string;
  model: string;
  draftModel: string;
  verifierModel: string;
  enabledTools: EnabledTool[];
};

function getAutoAgentName(mode: Mode) {
  return mode === "baseline" ? "SpecAgent 单代理演示" : "SpecAgent 草稿校验演示";
}

function buildDefaultFormState(provider: AiProvider): FormState {
  const defaults = getDefaultModelsForProvider(provider);

  return {
    agentName: getAutoAgentName("baseline"),
    mode: "baseline",
    systemPrompt:
      "你是一个用于评测的产品智能体。请谨慎使用确定性工具，清楚解释取舍，并优先保证结果稳定可靠。",
    userPrompt:
      "请推荐一台适合频繁出差、轻度编程、续航优先的笔记本电脑，总预算控制在 1400 美元以内，并说明取舍。",
    model: defaults.baseline,
    draftModel: defaults.draft,
    verifierModel: defaults.verifier,
    enabledTools: ["productDb", "mockSearch", "calculator"],
  };
}

function normalizeFormState(formState: FormState, provider: AiProvider): FormState {
  const defaults = getDefaultModelsForProvider(provider);

  return {
    ...formState,
    model: isKnownModelCompatibleWithProvider(formState.model, provider)
      ? formState.model
      : defaults.baseline,
    draftModel: isKnownModelCompatibleWithProvider(formState.draftModel, provider)
      ? formState.draftModel
      : defaults.draft,
    verifierModel: isKnownModelCompatibleWithProvider(
      formState.verifierModel,
      provider,
    )
      ? formState.verifierModel
      : defaults.verifier,
  };
}

const compactCurrency = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

type AgentPlaygroundProps = {
  defaultProvider: AiProvider;
};

export function AgentPlayground({ defaultProvider }: AgentPlaygroundProps) {
  const [rawFormState, setFormState] = useState<FormState>(() =>
    buildDefaultFormState(defaultProvider),
  );
  const [runResult, setRunResult] = useState<PlaygroundRunResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { providerConfig, isConfigured, isReady } = useLocalApiConfig();
  const activeProvider = providerConfig?.provider ?? defaultProvider;
  const availableModels = useMemo(
    () => getModelOptionsForProvider(activeProvider),
    [activeProvider],
  );
  const formState = useMemo(
    () => normalizeFormState(rawFormState, activeProvider),
    [rawFormState, activeProvider],
  );

  const selectedToolCount = formState.enabledTools.length;

  const toolHealth = useMemo(() => {
    if (!runResult) {
      return 100;
    }

    if (runResult.toolCalls.length === 0) {
      return 100;
    }

    const successfulCalls = runResult.toolCalls.filter((toolCall) => toolCall.success).length;
    return Math.round((successfulCalls / runResult.toolCalls.length) * 100);
  }, [runResult]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentName: formState.agentName,
          mode: formState.mode,
          systemPrompt: formState.systemPrompt,
          userPrompt: formState.userPrompt,
          model:
            formState.mode === "baseline" ? formState.model : formState.draftModel,
          draftModel:
            formState.mode === "draft_verifier" ? formState.draftModel : undefined,
          verifierModel:
            formState.mode === "draft_verifier"
              ? formState.verifierModel
              : undefined,
          enabledTools: formState.enabledTools,
          providerConfig: providerConfig ?? undefined,
        }),
      });

      const payload = (await response.json()) as PlaygroundRunResponse & {
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        setRunResult(payload);
        const suffix = payload.code ? ` [${payload.code}]` : "";
        const detail =
          payload.result?.error && payload.result.error !== payload.error
            ? ` ${payload.result.error}`
            : "";
        setErrorMessage(`${payload.error ?? "无法运行当前智能体。"}${detail}${suffix}`);
        return;
      }

      setRunResult(payload);
    } catch {
      setErrorMessage("调用 Playground API 时发生网络错误。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="调试台"
        title="配置、运行并检查一次智能体执行。"
        description="可以在这里运行单代理模式或草稿校验模式，并在同一处查看时延、成本、工具调用轨迹和校验结论。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-md border-primary/25 bg-primary/5 px-2.5 py-1 text-primary">
              确定性工具链
            </Badge>
            <Badge variant="outline" className="rounded-md px-2.5 py-1">
              支持部署演示
            </Badge>
          </div>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[25rem_1fr]">
        <Card className="bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 text-primary" aria-hidden="true" />
              智能体配置
            </CardTitle>
            <CardDescription>设置运行模式、提示词以及本次可用的工具范围。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="agent-name">智能体名称</Label>
                <Input
                  id="agent-name"
                  value={formState.agentName}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      agentName: event.target.value,
                    }))
                  }
                  placeholder="例如：SpecAgent 推荐助手"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="agent-mode">运行模式</Label>
                <Select
                  value={formState.mode}
                  onValueChange={(value: Mode) =>
                    setFormState((current) => ({
                      ...current,
                      mode: value,
                      agentName: getAutoAgentName(value),
                    }))
                  }
                >
                  <SelectTrigger id="agent-mode" className="w-full">
                    <SelectValue placeholder="选择模式" />
                  </SelectTrigger>
                  <SelectContent>
                    {modeOptions.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {modeOptions.find((mode) => mode.value === formState.mode)?.description}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="system-prompt">系统提示词</Label>
                <Textarea
                  id="system-prompt"
                  className="min-h-40"
                  value={formState.systemPrompt}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      systemPrompt: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="user-prompt">用户提示词</Label>
                <Textarea
                  id="user-prompt"
                  className="min-h-32"
                  value={formState.userPrompt}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      userPrompt: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {formState.mode === "baseline" ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="primary-model">执行模型</Label>
                    <Select
                      value={formState.model}
                      onValueChange={(value) =>
                        setFormState((current) => ({ ...current, model: value }))
                      }
                    >
                      <SelectTrigger id="primary-model" className="w-full">
                        <SelectValue placeholder="选择模型" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="draft-model">草稿模型</Label>
                      <Select
                        value={formState.draftModel}
                        onValueChange={(value) =>
                          setFormState((current) => ({ ...current, draftModel: value }))
                        }
                      >
                        <SelectTrigger id="draft-model" className="w-full">
                          <SelectValue placeholder="选择草稿模型" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label htmlFor="verifier-model">校验模型</Label>
                      <Select
                        value={formState.verifierModel}
                        onValueChange={(value) =>
                          setFormState((current) => ({
                            ...current,
                            verifierModel: value,
                          }))
                        }
                      >
                        <SelectTrigger id="verifier-model" className="w-full">
                          <SelectValue placeholder="选择校验模型" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>启用工具</Label>
                  <Badge variant="secondary" className="rounded-md px-2.5 py-1">
                    已选 {selectedToolCount} 个
                  </Badge>
                </div>
                <div className="grid gap-3">
                  {toolOptions.map((tool) => {
                    const isSelected = formState.enabledTools.includes(tool.id);

                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() =>
                          setFormState((current) => ({
                            ...current,
                            enabledTools: current.enabledTools.includes(tool.id)
                              ? current.enabledTools.filter((value) => value !== tool.id)
                              : [...current.enabledTools, tool.id],
                          }))
                        }
                        className={cn(
                          "grid gap-1 rounded-lg border px-3 py-3 text-left transition-colors",
                          isSelected
                            ? "border-primary/35 bg-primary/6"
                            : "border-border bg-background hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{tool.label}</span>
                          <Badge
                            variant={isSelected ? "default" : "outline"}
                            className="rounded-md px-2 py-0.5"
                          >
                            {isSelected ? "启用" : "关闭"}
                          </Badge>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {tool.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">运行画像</div>
                    <p className="text-sm text-muted-foreground">
                      {formState.mode === "baseline"
                        ? `使用 ${getProviderLabel(activeProvider)} 兼容模型完成单次执行，并保留确定性工具轨迹。`
                        : `使用 ${getProviderLabel(activeProvider)} 兼容模型生成草稿，再由校验模型审核或重写。`}
                    </p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/8 text-primary">
                    {formState.mode === "baseline" ? (
                      <Cpu className="size-4" aria-hidden="true" />
                    ) : (
                      <Sparkles className="size-4" aria-hidden="true" />
                    )}
                  </div>
                </div>
                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Activity className="size-4 animate-spin" aria-hidden="true" />
                      正在运行
                    </>
                  ) : (
                    <>
                      <Zap className="size-4" aria-hidden="true" />
                      运行智能体
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-5">
      {errorMessage ? (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" aria-hidden="true" />
          <AlertTitle>运行失败</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {isReady ? (
        <Alert>
          <Sparkles className="size-4" aria-hidden="true" />
          <AlertTitle>
            {isConfigured ? "已检测到浏览器侧 API 配置" : "未检测到浏览器侧 API 配置"}
          </AlertTitle>
          <AlertDescription>
            {isConfigured
              ? `本次会优先使用首页中保存的 ${getProviderLabel(providerConfig?.provider ?? defaultProvider)} 本地凭证。`
              : `当前会回退使用部署环境中的 ${getProviderLabel(defaultProvider)} 配置。若未在服务端配置密钥，请先回首页填写本地 API 配置。`}
          </AlertDescription>
        </Alert>
      ) : null}

      {runResult && !runResult.persisted ? (
        <Alert>
          <TriangleAlert className="size-4" aria-hidden="true" />
          <AlertTitle>未持久化运行</AlertTitle>
          <AlertDescription>
            当前数据库尚未配置，这次运行仅会显示在调试台里，不会保存到 <span className="font-mono">/runs/[id]</span>。
          </AlertDescription>
        </Alert>
      ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Clock3}
              label="时延"
              value={runResult ? formatMs(runResult.latency) : "—"}
              hint="端到端耗时"
            />
            <MetricCard
              icon={CircleDollarSign}
              label="预估成本"
              value={runResult ? compactCurrency.format(runResult.cost) : "—"}
              hint="按 Token 粗略估算"
            />
            <MetricCard
              icon={Wrench}
              label="工具调用"
              value={runResult ? String(runResult.toolCalls.length) : "—"}
              hint="本次轨迹中的调用次数"
            />
            <MetricCard
              icon={CheckCircle2}
              label="草稿是否接受"
              value={
                runResult?.draftAccepted === null
                  ? "不适用"
                  : runResult?.draftAccepted
                    ? "已接受"
                    : "已拒绝"
              }
              hint="校验器最终判断"
            />
          </section>

          <Card className="bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="size-4 text-primary" aria-hidden="true" />
                运行结果
              </CardTitle>
              <CardDescription>
                查看最近一次 Playground 运行的最终回答、轨迹细节与流程级指标。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              {isSubmitting && !runResult ? <ResultLoading /> : null}

              {!isSubmitting && !runResult ? (
                <div className="grid gap-4 rounded-lg border border-dashed border-border bg-muted/30 p-6">
                  <div className="flex size-11 items-center justify-center rounded-lg border border-primary/15 bg-primary/6 text-primary">
                    <Bot className="size-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-medium">准备开始第一次运行</h2>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      先设置提示词和模型，再运行一次，就能检查回答质量、工具使用情况以及草稿校验链路的表现。
                    </p>
                  </div>
                </div>
              ) : null}

              {runResult ? (
                <Tabs defaultValue="answer" className="gap-4">
                  <TabsList variant="line">
                    <TabsTrigger value="answer">回答</TabsTrigger>
                    <TabsTrigger value="timeline">时间线</TabsTrigger>
                    <TabsTrigger value="tools">工具调用</TabsTrigger>
                  </TabsList>

                  <TabsContent value="answer" className="grid gap-5">
                    <Card size="sm" className="bg-muted/20">
                      <CardHeader>
                        <CardTitle className="text-sm">最终回答</CardTitle>
                        <CardDescription>返回给 Playground 调用方的结果。</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-lg border border-border bg-background p-4 text-sm leading-7 text-foreground whitespace-pre-wrap">
                          {runResult.output || "本次没有返回任何输出。"}
                        </div>

                        {"workflow" in runResult.result ? (
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg border border-border bg-background p-4">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-medium">草稿评审</span>
                                <Badge
                                  variant={
                                    runResult.result.metrics.draftAccepted
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="rounded-md px-2 py-0.5"
                                >
                                  {runResult.result.metrics.draftAccepted
                                    ? "已接受"
                                    : formatVerifierDecision(runResult.result.verifier.decision)}
                                </Badge>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                {runResult.result.verifier.reason}
                              </p>
                            </div>
                            <div className="rounded-lg border border-border bg-background p-4">
                              <div className="text-sm font-medium">校验置信度</div>
                              <div className="mt-3 space-y-2">
                                <Progress value={runResult.result.verifier.confidenceScore * 100} />
                                <div className="text-sm text-muted-foreground">
                                  {Math.round(runResult.result.verifier.confidenceScore * 100)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="timeline">
                    <RunTimeline runResult={runResult} />
                  </TabsContent>

                  <TabsContent value="tools">
                    <ToolCallPanel toolCalls={runResult.toolCalls} />
                  </TabsContent>
                </Tabs>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4 text-primary" aria-hidden="true" />
                运行健康度
              </CardTitle>
              <CardDescription>快速查看本次运行的轨迹稳定性与工具表现。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">工具成功率</span>
                <span className="font-medium">{toolHealth}%</span>
              </div>
              <Progress value={toolHealth} />
              <div className="flex flex-wrap gap-2">
                {toolOptions.map((tool) => (
                  <Badge
                    key={tool.id}
                    variant={
                      formState.enabledTools.includes(tool.id) ? "secondary" : "outline"
                    }
                    className="rounded-md px-2.5 py-1"
                  >
                    {tool.label}
                  </Badge>
                ))}
              </div>
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
  icon: typeof Activity;
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

function ResultLoading() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}

function ToolCallPanel({ toolCalls }: { toolCalls: ToolCallRecord[] }) {
  if (toolCalls.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        这次运行没有触发任何工具调用。
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {toolCalls.map((toolCall, index) => (
        <Card key={toolCall.toolCallId} size="sm" className="bg-muted/20">
          <CardContent className="grid gap-3 py-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-md px-2 py-0.5 font-mono">
                  {toolCall.toolName}
                </Badge>
                <span className="text-sm text-muted-foreground">第 {index + 1} 次调用</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={toolCall.success ? "secondary" : "destructive"}
                  className="rounded-md px-2 py-0.5"
                >
                  {toolCall.success ? "成功" : "失败"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatMs(toolCall.latencyMs)}
                </span>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <JsonPanel label="输入" value={toolCall.input} />
              <JsonPanel
                label={toolCall.success ? "输出" : "错误"}
                value={toolCall.success ? toolCall.output : toolCall.error}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RunTimeline({ runResult }: { runResult: PlaygroundRunResponse }) {
  const items =
    "workflow" in runResult.result
      ? [
          {
            title: "草稿阶段",
            badge: runResult.result.draftModel,
            tone: "default" as const,
            body: runResult.result.draft.draftAnswer,
            meta: `${formatMs(runResult.result.draft.latencyMs)} · 预计 ${runResult.result.draft.expectedToolCalls.length} 个工具调用`,
          },
          ...runResult.toolCalls.map((toolCall) => ({
            title: `工具调用 · ${toolCall.toolName}`,
            badge: toolCall.success ? "成功" : "失败",
            tone: toolCall.success ? ("default" as const) : ("destructive" as const),
            body: JSON.stringify(toolCall.input, null, 2),
            meta: `${formatMs(toolCall.latencyMs)} · 步骤 ${toolCall.stepNumber ?? "未记录"}`,
          })),
          {
            title: "校验阶段",
            badge: formatVerifierDecision(runResult.result.verifier.decision),
            tone:
              runResult.result.verifier.decision === "accept"
                ? ("secondary" as const)
                : runResult.result.verifier.decision === "reject"
                  ? ("destructive" as const)
                  : ("outline" as const),
            body: runResult.result.verifier.reason,
            meta: `${formatMs(runResult.result.verifier.latencyMs)} · ${Math.round(
              runResult.result.verifier.confidenceScore * 100,
            )}% 置信度`,
          },
          {
            title: "最终回答",
            badge: "已返回",
            tone: "secondary" as const,
            body: runResult.output,
            meta: `总耗时 ${formatMs(runResult.latency)}`,
          },
        ]
      : [
          {
            title: "单代理执行",
            badge: runResult.result.model,
            tone: "default" as const,
            body: runResult.output,
            meta: `总耗时 ${formatMs(runResult.latency)}`,
          },
          ...runResult.toolCalls.map((toolCall) => ({
            title: `工具调用 · ${toolCall.toolName}`,
            badge: toolCall.success ? "成功" : "失败",
            tone: toolCall.success ? ("default" as const) : ("destructive" as const),
            body: JSON.stringify(toolCall.input, null, 2),
            meta: `${formatMs(toolCall.latencyMs)} · 步骤 ${toolCall.stepNumber ?? "未记录"}`,
          })),
        ];

  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full border border-primary/20 bg-primary/8 text-primary">
                {index + 1}
              </div>
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="text-sm text-muted-foreground">{item.meta}</div>
              </div>
            </div>
            <Badge variant={item.tone} className="rounded-md px-2 py-0.5">
              {item.badge}
            </Badge>
          </div>
          <Separator />
          <div className="text-sm leading-6 text-foreground whitespace-pre-wrap">
            {item.body}
          </div>
        </div>
      ))}
    </div>
  );
}

function JsonPanel({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <pre className="mt-3 overflow-x-auto text-xs leading-6 text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function formatMs(value: number) {
  return `${value.toLocaleString("zh-CN")} ms`;
}

function formatVerifierDecision(decision: DraftVerifierRunResult["verifier"]["decision"]) {
  if (decision === "accept") {
    return "接受";
  }

  if (decision === "revise") {
    return "改写";
  }

  return "拒绝";
}
