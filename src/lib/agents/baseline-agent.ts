import { generateText, stepCountIs } from "ai";

import type { ApiProviderConfigInput } from "@/lib/ai/config";
import { getLanguageModel } from "@/lib/ai/provider";
import { specAgentTools } from "@/lib/tools";

const MODEL_PRICING_USD_PER_1M_TOKENS: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-5.4": { input: 1.25, output: 10 },
  "gpt-5.4-mini": { input: 0.25, output: 2 },
};

const DEFAULT_MODEL_PRICING = { input: 1, output: 4 };
const MAX_AGENT_STEPS = 6;
const MAX_AGENT_OUTPUT_TOKENS = 320;

export type EnabledToolName = keyof typeof specAgentTools;

export type BaselineAgentInput = {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  enabledTools: EnabledToolName[];
  benchmarkTaskId?: string;
  providerConfig?: ApiProviderConfigInput;
};

export type RunToolCallRecord = {
  toolCallId: string;
  toolName: string;
  stepNumber: number | null;
  input: unknown;
  output: unknown | null;
  success: boolean;
  latencyMs: number;
  error: string | null;
};

export type RunResult = {
  status: "succeeded" | "failed";
  benchmarkTaskId: string | null;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  outputText: string;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  toolCalls: RunToolCallRecord[];
  metrics: {
    toolCallCount: number;
    toolErrorCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
};

export async function runBaselineAgent(
  input: BaselineAgentInput,
): Promise<RunResult> {
  const startedAt = new Date();
  const toolCalls = new Map<string, RunToolCallRecord>();
  const activeTools = input.enabledTools.filter(isEnabledToolName);

  try {
    const result = await generateText({
      model: getLanguageModel(input.model, input.providerConfig),
      system: input.systemPrompt,
      prompt: input.userPrompt,
      maxOutputTokens: MAX_AGENT_OUTPUT_TOKENS,
      tools: specAgentTools,
      activeTools,
      stopWhen: stepCountIs(MAX_AGENT_STEPS),
      experimental_onToolCallFinish: (event) => {
        if (!event.toolCall) {
          return;
        }

        toolCalls.set(event.toolCall.toolCallId, {
          toolCallId: event.toolCall.toolCallId,
          toolName: event.toolCall.toolName,
          stepNumber: event.stepNumber ?? null,
          input: event.toolCall.input,
          output: event.success ? event.output : null,
          success: event.success,
          latencyMs: Math.round(event.durationMs),
          error: event.success ? null : formatUnknownError(event.error),
        });
      },
    });

    const finishedAt = new Date();
    const usage = normalizeUsage({
      inputTokens: result.totalUsage.inputTokens,
      outputTokens: result.totalUsage.outputTokens,
      fallbackInputText: `${input.systemPrompt}\n${input.userPrompt}`,
      fallbackOutputText: result.text,
    });

    return {
      status: "succeeded",
      benchmarkTaskId: input.benchmarkTaskId ?? null,
      model: input.model,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      outputText: result.text,
      error: null,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      latencyMs: finishedAt.getTime() - startedAt.getTime(),
      toolCalls: [...toolCalls.values()],
      metrics: {
        // These metrics directly map to the product surface:
        // latency for responsiveness, tool counts/errors for reliability,
        // and token/cost estimates for benchmark efficiency comparisons.
        toolCallCount: toolCalls.size,
        toolErrorCount: [...toolCalls.values()].filter((call) => !call.success)
          .length,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd: estimateCostUsd(input.model, usage),
      },
    };
  } catch (error) {
    const finishedAt = new Date();
    const usage = normalizeUsage({
      fallbackInputText: `${input.systemPrompt}\n${input.userPrompt}`,
      fallbackOutputText: "",
    });

    return {
      status: "failed",
      benchmarkTaskId: input.benchmarkTaskId ?? null,
      model: input.model,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      outputText: "",
      error: formatUnknownError(error),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      latencyMs: finishedAt.getTime() - startedAt.getTime(),
      toolCalls: [...toolCalls.values()],
      metrics: {
        toolCallCount: toolCalls.size,
        toolErrorCount: [...toolCalls.values()].filter((call) => !call.success)
          .length,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        estimatedCostUsd: estimateCostUsd(input.model, usage),
      },
    };
  }
}

function isEnabledToolName(value: string): value is EnabledToolName {
  return value in specAgentTools;
}

function normalizeUsage({
  inputTokens,
  outputTokens,
  fallbackInputText = "",
  fallbackOutputText = "",
}: {
  inputTokens?: number;
  outputTokens?: number;
  fallbackInputText?: string;
  fallbackOutputText?: string;
}) {
  const normalizedInputTokens =
    inputTokens ?? estimateTokensFromText(fallbackInputText);
  const normalizedOutputTokens =
    outputTokens ?? estimateTokensFromText(fallbackOutputText);

  return {
    inputTokens: normalizedInputTokens,
    outputTokens: normalizedOutputTokens,
    totalTokens: normalizedInputTokens + normalizedOutputTokens,
  };
}

function estimateTokensFromText(text: string) {
  const normalized = text.trim();

  if (!normalized) {
    return 0;
  }

  return Math.ceil(normalized.length / 4);
}

function estimateCostUsd(
  model: string,
  usage: { inputTokens: number; outputTokens: number },
) {
  const pricing = MODEL_PRICING_USD_PER_1M_TOKENS[model] ?? DEFAULT_MODEL_PRICING;
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;

  return roundCurrency(inputCost + outputCost);
}

function roundCurrency(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function formatUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown agent runtime error.";
  }
}
