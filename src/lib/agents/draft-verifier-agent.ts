import { generateObject, generateText, stepCountIs } from "ai";
import { z } from "zod";

import {
  type EnabledToolName,
  type RunResult,
  type RunToolCallRecord,
} from "@/lib/agents/baseline-agent";
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
const MAX_DRAFT_OUTPUT_TOKENS = 220;
const MAX_VERIFIER_REVIEW_TOKENS = 120;
const MAX_VERIFIER_OUTPUT_TOKENS = 320;

const draftOutputSchema = z.object({
  draftAnswer: z.string().min(1),
  draftPlan: z.array(z.string().min(1)).min(1).max(6),
  expectedToolCalls: z.array(z.string().min(1)).max(6),
});

const verifierReviewSchema = z.object({
  decision: z.enum(["accept", "revise", "reject"]),
  reason: z.string().min(1),
  confidenceScore: z.number().min(0).max(1),
});

const draftSchemaHint = `{"draftAnswer":"string","draftPlan":["string"],"expectedToolCalls":["string"]}`;
const verifierSchemaHint = `{"decision":"accept|revise|reject","reason":"string","confidenceScore":0.0}`;

export type DraftVerifierAgentInput = {
  systemPrompt: string;
  userPrompt: string;
  draftModel: string;
  verifierModel: string;
  enabledTools: EnabledToolName[];
  benchmarkTaskId?: string;
  providerConfig?: ApiProviderConfigInput;
};

export type DraftVerifierRunResult = RunResult & {
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
  metrics: RunResult["metrics"] & {
    draftLatencyMs: number;
    verifierLatencyMs: number;
    totalLatencyMs: number;
    draftAccepted: boolean;
    draftAcceptanceRate: number;
    confidenceScore: number;
  };
};

export async function runDraftVerifierAgent(
  input: DraftVerifierAgentInput,
): Promise<DraftVerifierRunResult> {
  const startedAt = new Date();
  const toolCalls = new Map<string, RunToolCallRecord>();
  const activeTools = input.enabledTools.filter(isEnabledToolName);

  let draftLatencyMs = 0;
  let verifierLatencyMs = 0;
  let draftAnswer = "";
  let draftPlan: string[] = [];
  let expectedToolCalls: string[] = [];
  let decision: "accept" | "revise" | "reject" = "reject";
  let reason = "Verifier did not complete.";
  let confidenceScore = 0;
  let finalAnswer = "";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let estimatedCostUsd = 0;

  try {
    const draftStartedAt = Date.now();
    const draftResult = await generateStructuredObject({
      model: getLanguageModel(input.draftModel, input.providerConfig),
      system: buildDraftSystemPrompt(input.systemPrompt),
      prompt: buildDraftPrompt(input.userPrompt, activeTools),
      maxOutputTokens: MAX_DRAFT_OUTPUT_TOKENS,
      schema: draftOutputSchema,
      schemaName: "draft_agent_result",
      schemaDescription:
        "Draft answer, short plan, and expected tool calls for a speculative-style draft-verifier workflow.",
      jsonShapeHint: draftSchemaHint,
    });
    draftLatencyMs = Date.now() - draftStartedAt;
    draftAnswer = draftResult.object.draftAnswer;
    draftPlan = draftResult.object.draftPlan;
    expectedToolCalls = draftResult.object.expectedToolCalls;

    const normalizedDraftUsage = normalizeUsage({
      inputTokens: draftResult.usage.inputTokens,
      outputTokens: draftResult.usage.outputTokens,
      fallbackInputText: `${input.systemPrompt}\n${input.userPrompt}`,
      fallbackOutputText: JSON.stringify(draftResult.object),
    });
    totalInputTokens += normalizedDraftUsage.inputTokens;
    totalOutputTokens += normalizedDraftUsage.outputTokens;
    estimatedCostUsd += estimateCostUsd(input.draftModel, normalizedDraftUsage);

    const verifierStartedAt = Date.now();
    const verifierReview = await generateStructuredObject({
      model: getLanguageModel(input.verifierModel, input.providerConfig),
      system: buildVerifierSystemPrompt(input.systemPrompt),
      prompt: buildVerifierReviewPrompt({
        userPrompt: input.userPrompt,
        draftAnswer,
        draftPlan,
        expectedToolCalls,
      }),
      maxOutputTokens: MAX_VERIFIER_REVIEW_TOKENS,
      schema: verifierReviewSchema,
      schemaName: "verifier_review_result",
      schemaDescription:
        "Verifier decision for a speculative-style draft-verifier workflow. This is not token-level speculative decoding.",
      jsonShapeHint: verifierSchemaHint,
    });

    decision = verifierReview.object.decision;
    reason = verifierReview.object.reason;
    confidenceScore = verifierReview.object.confidenceScore;

    const normalizedVerifierReviewUsage = normalizeUsage({
      inputTokens: verifierReview.usage.inputTokens,
      outputTokens: verifierReview.usage.outputTokens,
      fallbackInputText: `${input.systemPrompt}\n${input.userPrompt}\n${draftAnswer}`,
      fallbackOutputText: JSON.stringify(verifierReview.object),
    });
    totalInputTokens += normalizedVerifierReviewUsage.inputTokens;
    totalOutputTokens += normalizedVerifierReviewUsage.outputTokens;
    estimatedCostUsd += estimateCostUsd(
      input.verifierModel,
      normalizedVerifierReviewUsage,
    );

    if (decision === "accept") {
      finalAnswer = draftAnswer;
      verifierLatencyMs = Date.now() - verifierStartedAt;
    } else {
      const revisionResult = await generateText({
        model: getLanguageModel(input.verifierModel, input.providerConfig),
        system: buildVerifierSystemPrompt(input.systemPrompt),
        prompt: buildVerifierRevisionPrompt({
          userPrompt: input.userPrompt,
          draftAnswer,
          draftPlan,
          expectedToolCalls,
          decision,
          reason,
        }),
        maxOutputTokens: MAX_VERIFIER_OUTPUT_TOKENS,
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

      verifierLatencyMs = Date.now() - verifierStartedAt;
      finalAnswer = revisionResult.text;

      const normalizedRevisionUsage = normalizeUsage({
        inputTokens: revisionResult.totalUsage.inputTokens,
        outputTokens: revisionResult.totalUsage.outputTokens,
        fallbackInputText: `${input.systemPrompt}\n${input.userPrompt}\n${draftAnswer}\n${reason}`,
        fallbackOutputText: revisionResult.text,
      });
      totalInputTokens += normalizedRevisionUsage.inputTokens;
      totalOutputTokens += normalizedRevisionUsage.outputTokens;
      estimatedCostUsd += estimateCostUsd(
        input.verifierModel,
        normalizedRevisionUsage,
      );
    }

    const finishedAt = new Date();
    const totalLatencyMs = finishedAt.getTime() - startedAt.getTime();

    return {
      status: "succeeded",
      workflow: "speculative-style draft-verifier",
      benchmarkTaskId: input.benchmarkTaskId ?? null,
      model: `${input.draftModel} -> ${input.verifierModel}`,
      draftModel: input.draftModel,
      verifierModel: input.verifierModel,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      outputText: finalAnswer,
      error: null,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      latencyMs: totalLatencyMs,
      toolCalls: [...toolCalls.values()],
      draft: {
        draftAnswer,
        draftPlan,
        expectedToolCalls,
        latencyMs: draftLatencyMs,
      },
      verifier: {
        decision,
        reason,
        confidenceScore,
        latencyMs: verifierLatencyMs,
      },
      metrics: {
        // This captures the product question behind the speculative-style workflow:
        // can a cheap draft be accepted often enough to lower latency or cost
        // without increasing tool failures or reducing answer quality?
        toolCallCount: toolCalls.size,
        toolErrorCount: [...toolCalls.values()].filter((call) => !call.success)
          .length,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        estimatedCostUsd: roundCurrency(estimatedCostUsd),
        draftLatencyMs,
        verifierLatencyMs,
        totalLatencyMs,
        draftAccepted: decision === "accept",
        draftAcceptanceRate: decision === "accept" ? 1 : 0,
        confidenceScore,
      },
    };
  } catch (error) {
    const finishedAt = new Date();
    const totalLatencyMs = finishedAt.getTime() - startedAt.getTime();

    return {
      status: "failed",
      workflow: "speculative-style draft-verifier",
      benchmarkTaskId: input.benchmarkTaskId ?? null,
      model: `${input.draftModel} -> ${input.verifierModel}`,
      draftModel: input.draftModel,
      verifierModel: input.verifierModel,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      outputText: finalAnswer,
      error: formatUnknownError(error),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      latencyMs: totalLatencyMs,
      toolCalls: [...toolCalls.values()],
      draft: {
        draftAnswer,
        draftPlan,
        expectedToolCalls,
        latencyMs: draftLatencyMs,
      },
      verifier: {
        decision,
        reason,
        confidenceScore,
        latencyMs: verifierLatencyMs,
      },
      metrics: {
        toolCallCount: toolCalls.size,
        toolErrorCount: [...toolCalls.values()].filter((call) => !call.success)
          .length,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        estimatedCostUsd: roundCurrency(estimatedCostUsd),
        draftLatencyMs,
        verifierLatencyMs,
        totalLatencyMs,
        draftAccepted: decision === "accept",
        draftAcceptanceRate: decision === "accept" ? 1 : 0,
        confidenceScore,
      },
    };
  }
}

function buildDraftSystemPrompt(systemPrompt: string) {
  return [
    systemPrompt,
    "You are the fast draft stage in a speculative-style draft-verifier workflow.",
    "This is not token-level speculative decoding.",
    "Generate a concise draft answer, a short plan, and expected tool calls that a stronger verifier can audit.",
  ].join("\n\n");
}

async function generateStructuredObject<TOutput>({
  model,
  system,
  prompt,
  maxOutputTokens,
  schema,
  schemaName,
  schemaDescription,
  jsonShapeHint,
}: {
  model: ReturnType<typeof getLanguageModel>;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  schema: z.ZodType<TOutput>;
  schemaName: string;
  schemaDescription: string;
  jsonShapeHint: string;
}) {
  try {
    return await generateObject({
      model,
      system,
      prompt,
      maxOutputTokens,
      schema,
      schemaName,
      schemaDescription,
    });
  } catch {
    const fallback = await generateText({
      model,
      system: [
        system,
        "Return only valid JSON with no markdown, code fences, or extra narration.",
        `JSON shape: ${jsonShapeHint}`,
      ].join("\n\n"),
      prompt,
      maxOutputTokens,
    });

    const parsed = schema.safeParse(extractJsonObject(fallback.text));
    if (!parsed.success) {
      throw new Error("No object generated: could not parse the response.");
    }

    return {
      object: parsed.data,
      usage: {
        inputTokens: fallback.totalUsage.inputTokens,
        outputTokens: fallback.totalUsage.outputTokens,
      },
    };
  }
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model response.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

function buildDraftPrompt(userPrompt: string, activeTools: EnabledToolName[]) {
  return [
    `User request: ${userPrompt}`,
    `Enabled tools: ${activeTools.length > 0 ? activeTools.join(", ") : "none"}`,
    "Return a draft answer that is directionally useful, even if some details may need verifier revision.",
  ].join("\n\n");
}

function buildVerifierSystemPrompt(systemPrompt: string) {
  return [
    systemPrompt,
    "You are the verifier stage in a speculative-style draft-verifier workflow.",
    "This workflow is inspired by speculative decoding at the product level, not true token-level speculative decoding.",
    "Your job is to preserve answer quality while improving latency and cost when the draft is strong enough.",
  ].join("\n\n");
}

function buildVerifierReviewPrompt(input: {
  userPrompt: string;
  draftAnswer: string;
  draftPlan: string[];
  expectedToolCalls: string[];
}) {
  return [
    `User request: ${input.userPrompt}`,
    `Draft answer: ${input.draftAnswer}`,
    `Draft plan: ${input.draftPlan.join(" | ")}`,
    `Expected tool calls: ${input.expectedToolCalls.join(", ") || "none"}`,
    "Decide whether to accept, revise, or reject the draft.",
    "Accept if the draft is already strong enough to ship as the final answer.",
    "Revise if the draft is useful but needs correction or tool-backed completion.",
    "Reject if the draft is materially flawed and should not shape the final answer.",
  ].join("\n\n");
}

function buildVerifierRevisionPrompt(input: {
  userPrompt: string;
  draftAnswer: string;
  draftPlan: string[];
  expectedToolCalls: string[];
  decision: "accept" | "revise" | "reject";
  reason: string;
}) {
  return [
    `User request: ${input.userPrompt}`,
    `Draft answer: ${input.draftAnswer}`,
    `Draft plan: ${input.draftPlan.join(" | ")}`,
    `Expected tool calls from draft: ${input.expectedToolCalls.join(", ") || "none"}`,
    `Verifier decision: ${input.decision}`,
    `Verifier reason: ${input.reason}`,
    "Produce the final user-facing answer.",
    "Use tools only if they improve correctness or completeness.",
    "Do not mention internal draft or verifier stages in the final answer.",
  ].join("\n\n");
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
    return "Unknown draft-verifier runtime error.";
  }
}
