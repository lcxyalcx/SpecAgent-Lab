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
import { cn } from "@/lib/utils";

const toolOptions = [
  {
    id: "calculator",
    label: "Calculator",
    description: "Deterministic arithmetic and guardrails for unsafe expressions.",
  },
  {
    id: "mockSearch",
    label: "Mock Search",
    description: "Local corpus retrieval with stable result ordering.",
  },
  {
    id: "productDb",
    label: "Product DB",
    description: "Structured product options for recommendation tasks.",
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "Mock availability slots for planning scenarios.",
  },
] as const;

const modeOptions = [
  {
    value: "baseline",
    label: "Baseline",
    description: "Single agent run with tool calling.",
  },
  {
    value: "draft_verifier",
    label: "Draft + Verifier",
    description: "Speculative-style draft-verifier workflow.",
  },
] as const;

const modelOptions = [
  "Qwen/Qwen2-7B-Instruct",
  "Qwen/Qwen2.5-7B-Instruct",
  "deepseek-ai/DeepSeek-V3",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o-mini",
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

const defaultFormState: FormState = {
  agentName: "SpecAgent Baseline Demo",
  mode: "baseline",
  systemPrompt:
    "You are an evaluation-ready product agent. Use deterministic tools carefully, explain tradeoffs clearly, and optimize for reliable benchmark performance.",
  userPrompt:
    "Recommend a laptop for frequent travel, light coding, and strong battery life. Stay under $1,400 and explain the tradeoffs.",
  model: "deepseek-ai/DeepSeek-V3",
  draftModel: "deepseek-ai/DeepSeek-V3",
  verifierModel: "deepseek-ai/DeepSeek-V3",
  enabledTools: ["productDb", "mockSearch", "calculator"],
};

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

export function AgentPlayground() {
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [runResult, setRunResult] = useState<PlaygroundRunResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { providerConfig, isConfigured, isReady } = useLocalApiConfig();

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
          model: formState.model,
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
        setErrorMessage(`${payload.error ?? "Unable to run agent."}${suffix}`);
        return;
      }

      setRunResult(payload);
    } catch {
      setErrorMessage("Network error while calling the agent run API.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Playground"
        title="Configure, run, and inspect agent behavior."
        description="Run a baseline agent or a speculative-style draft-verifier workflow, then inspect latency, cost, tool traces, and verifier decisions in one place."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-md border-primary/25 bg-primary/5 px-2.5 py-1 text-primary">
              Deterministic tools
            </Badge>
            <Badge variant="outline" className="rounded-md px-2.5 py-1">
              Portfolio demo ready
            </Badge>
          </div>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[25rem_1fr]">
        <Card className="bg-card/85 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4 text-primary" aria-hidden="true" />
              Agent Setup
            </CardTitle>
            <CardDescription>Configure the run shape, prompt pair, and available tool surface.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="agent-name">Agent name</Label>
                <Input
                  id="agent-name"
                  value={formState.agentName}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      agentName: event.target.value,
                    }))
                  }
                  placeholder="SpecAgent Recommender"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="agent-mode">Mode</Label>
                <Select
                  value={formState.mode}
                  onValueChange={(value: Mode) =>
                    setFormState((current) => ({
                      ...current,
                      mode: value,
                      agentName:
                        value === "baseline"
                          ? "SpecAgent Baseline Demo"
                          : "SpecAgent Draft-Verifier Demo",
                    }))
                  }
                >
                  <SelectTrigger id="agent-mode" className="w-full">
                    <SelectValue placeholder="Choose mode" />
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
                <Label htmlFor="system-prompt">System prompt</Label>
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
                <Label htmlFor="user-prompt">User prompt</Label>
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
                <div className="grid gap-2">
                  <Label htmlFor="primary-model">
                    {formState.mode === "baseline" ? "Model" : "Fallback model"}
                  </Label>
                  <Select
                    value={formState.model}
                    onValueChange={(value) =>
                      setFormState((current) => ({ ...current, model: value }))
                    }
                  >
                    <SelectTrigger id="primary-model" className="w-full">
                      <SelectValue placeholder="Choose model" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formState.mode === "draft_verifier" ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="draft-model">Draft model</Label>
                      <Select
                        value={formState.draftModel}
                        onValueChange={(value) =>
                          setFormState((current) => ({ ...current, draftModel: value }))
                        }
                      >
                        <SelectTrigger id="draft-model" className="w-full">
                          <SelectValue placeholder="Choose draft model" />
                        </SelectTrigger>
                        <SelectContent>
                          {modelOptions.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label htmlFor="verifier-model">Verifier model</Label>
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
                          <SelectValue placeholder="Choose verifier model" />
                        </SelectTrigger>
                        <SelectContent>
                          {modelOptions.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <Label>Enabled tools</Label>
                  <Badge variant="secondary" className="rounded-md px-2.5 py-1">
                    {selectedToolCount} selected
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
                            {isSelected ? "On" : "Off"}
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
                    <div className="text-sm font-medium text-foreground">Run profile</div>
                    <p className="text-sm text-muted-foreground">
                      {formState.mode === "baseline"
                        ? "Single pass with deterministic tool traces."
                        : "Fast draft reviewed by a stronger verifier."}
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
                      Running agent
                    </>
                  ) : (
                    <>
                      <Zap className="size-4" aria-hidden="true" />
                      Run Agent
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
          <AlertTitle>Run failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {isReady ? (
        <Alert>
          <Sparkles className="size-4" aria-hidden="true" />
          <AlertTitle>
            {isConfigured ? "Using browser API configuration" : "No browser API configuration found"}
          </AlertTitle>
          <AlertDescription>
            {isConfigured
              ? `This run will use your locally saved ${providerConfig?.provider} credentials from the homepage.`
              : "Add an API key on the homepage first so playground runs can execute without relying on server environment variables."}
          </AlertDescription>
        </Alert>
      ) : null}

      {runResult && !runResult.persisted ? (
        <Alert>
          <TriangleAlert className="size-4" aria-hidden="true" />
          <AlertTitle>Transient run</AlertTitle>
          <AlertDescription>
            This run completed successfully without a configured database, so it is shown in the playground only and not saved to <span className="font-mono">/runs/[id]</span>.
          </AlertDescription>
        </Alert>
      ) : null}

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Clock3}
              label="Latency"
              value={runResult ? formatMs(runResult.latency) : "—"}
              hint="End-to-end runtime"
            />
            <MetricCard
              icon={CircleDollarSign}
              label="Estimated Cost"
              value={runResult ? compactCurrency.format(runResult.cost) : "—"}
              hint="Token-based estimate"
            />
            <MetricCard
              icon={Wrench}
              label="Tool Calls"
              value={runResult ? String(runResult.toolCalls.length) : "—"}
              hint="Execution trace volume"
            />
            <MetricCard
              icon={CheckCircle2}
              label="Draft Accepted"
              value={
                runResult?.draftAccepted === null
                  ? "N/A"
                  : runResult?.draftAccepted
                    ? "Accepted"
                    : "Rejected"
              }
              hint="Verifier decision surface"
            />
          </section>

          <Card className="bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="size-4 text-primary" aria-hidden="true" />
                Run Result
              </CardTitle>
              <CardDescription>
                Final answer, trace details, and workflow-level metrics for the latest playground run.
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
                    <h2 className="text-lg font-medium">Ready for the first run</h2>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      Configure the prompts and model stack, then run the agent to inspect answer quality, tool usage, and draft-verifier behavior.
                    </p>
                  </div>
                </div>
              ) : null}

              {runResult ? (
                <Tabs defaultValue="answer" className="gap-4">
                  <TabsList variant="line">
                    <TabsTrigger value="answer">Answer</TabsTrigger>
                    <TabsTrigger value="timeline">Timeline</TabsTrigger>
                    <TabsTrigger value="tools">Tool Calls</TabsTrigger>
                  </TabsList>

                  <TabsContent value="answer" className="grid gap-5">
                    <Card size="sm" className="bg-muted/20">
                      <CardHeader>
                        <CardTitle className="text-sm">Final answer</CardTitle>
                        <CardDescription>Returned to the playground caller.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-lg border border-border bg-background p-4 text-sm leading-7 text-foreground whitespace-pre-wrap">
                          {runResult.output || "No output returned."}
                        </div>

                        {"workflow" in runResult.result ? (
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-lg border border-border bg-background p-4">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-medium">Draft review</span>
                                <Badge
                                  variant={
                                    runResult.result.metrics.draftAccepted
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="rounded-md px-2 py-0.5"
                                >
                                  {runResult.result.metrics.draftAccepted
                                    ? "Accepted"
                                    : runResult.result.verifier.decision}
                                </Badge>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                {runResult.result.verifier.reason}
                              </p>
                            </div>
                            <div className="rounded-lg border border-border bg-background p-4">
                              <div className="text-sm font-medium">Verifier confidence</div>
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
                Runtime health
              </CardTitle>
              <CardDescription>Quick read on trace stability for the current run.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Tool success rate</span>
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
        No tool calls were needed for this run.
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
                <span className="text-sm text-muted-foreground">Call {index + 1}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={toolCall.success ? "secondary" : "destructive"}
                  className="rounded-md px-2 py-0.5"
                >
                  {toolCall.success ? "Success" : "Failed"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatMs(toolCall.latencyMs)}
                </span>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <JsonPanel label="Input" value={toolCall.input} />
              <JsonPanel
                label={toolCall.success ? "Output" : "Error"}
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
            title: "Draft step",
            badge: runResult.result.draftModel,
            tone: "default" as const,
            body: runResult.result.draft.draftAnswer,
            meta: `${formatMs(runResult.result.draft.latencyMs)} · ${runResult.result.draft.expectedToolCalls.length} expected tools`,
          },
          ...runResult.toolCalls.map((toolCall) => ({
            title: `Tool call · ${toolCall.toolName}`,
            badge: toolCall.success ? "Succeeded" : "Failed",
            tone: toolCall.success ? ("default" as const) : ("destructive" as const),
            body: JSON.stringify(toolCall.input, null, 2),
            meta: `${formatMs(toolCall.latencyMs)} · step ${toolCall.stepNumber ?? "n/a"}`,
          })),
          {
            title: "Verifier step",
            badge: runResult.result.verifier.decision,
            tone:
              runResult.result.verifier.decision === "accept"
                ? ("secondary" as const)
                : runResult.result.verifier.decision === "reject"
                  ? ("destructive" as const)
                  : ("outline" as const),
            body: runResult.result.verifier.reason,
            meta: `${formatMs(runResult.result.verifier.latencyMs)} · ${Math.round(
              runResult.result.verifier.confidenceScore * 100,
            )}% confidence`,
          },
          {
            title: "Final answer",
            badge: "Returned",
            tone: "secondary" as const,
            body: runResult.output,
            meta: `${formatMs(runResult.latency)} total`,
          },
        ]
      : [
          {
            title: "Baseline step",
            badge: runResult.result.model,
            tone: "default" as const,
            body: runResult.output,
            meta: `${formatMs(runResult.latency)} total`,
          },
          ...runResult.toolCalls.map((toolCall) => ({
            title: `Tool call · ${toolCall.toolName}`,
            badge: toolCall.success ? "Succeeded" : "Failed",
            tone: toolCall.success ? ("default" as const) : ("destructive" as const),
            body: JSON.stringify(toolCall.input, null, 2),
            meta: `${formatMs(toolCall.latencyMs)} · step ${toolCall.stepNumber ?? "n/a"}`,
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
  return `${value.toLocaleString()} ms`;
}
