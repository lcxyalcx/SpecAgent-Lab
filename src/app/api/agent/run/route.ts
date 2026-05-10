import {
  AgentMode,
  Prisma,
  RunStatus,
  ToolCallStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  runBaselineAgent,
  type RunResult,
} from "@/lib/agents/baseline-agent";
import {
  runDraftVerifierAgent,
  type DraftVerifierRunResult,
} from "@/lib/agents/draft-verifier-agent";
import {
  apiProviderConfigSchema,
  sanitizeApiProviderConfig,
} from "@/lib/ai/config";
import {
  getAiProvider,
  hasAiProviderCredentials,
} from "@/lib/ai/provider";
import { getPrisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/env";

const enabledToolSchema = z.enum([
  "calculator",
  "mockSearch",
  "productDb",
  "calendar",
]);

const agentRunRequestSchema = z
  .object({
    agentName: z.string().min(1).max(120),
    mode: z.enum(["baseline", "draft_verifier"]),
    systemPrompt: z.string().min(1).max(12_000),
    userPrompt: z.string().min(1).max(12_000),
    model: z.string().min(1).max(200),
    draftModel: z.string().min(1).max(200).optional(),
    verifierModel: z.string().min(1).max(200).optional(),
    enabledTools: z.array(enabledToolSchema).max(8).default([]),
    providerConfig: apiProviderConfigSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.mode === "draft_verifier") {
      if (!value.draftModel) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["draftModel"],
          message: "draftModel is required when mode is draft_verifier.",
        });
      }

      if (!value.verifierModel) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["verifierModel"],
          message: "verifierModel is required when mode is draft_verifier.",
        });
      }
    }
  });

export async function POST(request: Request) {
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON request body.",
      },
      { status: 400 },
    );
  }

  const parsedRequest = agentRunRequestSchema.safeParse(requestBody);

  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "Invalid agent run request.",
        details: parsedRequest.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsedRequest.data;
  const provider = getAiProvider(input.providerConfig);

  if (!hasAiProviderCredentials(input.providerConfig)) {
    return NextResponse.json(
      {
        error:
          provider === "siliconflow"
            ? "SILICONFLOW_API_KEY is not set. Add it in environment variables or save it from the homepage API configuration card."
            : "OPENAI_API_KEY is not set. Add it in environment variables or save it from the homepage API configuration card.",
        code:
          provider === "siliconflow"
            ? "SILICONFLOW_NOT_CONFIGURED"
            : "OPENAI_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  try {
    const runResult =
      input.mode === "baseline"
        ? await runBaselineAgent({
            systemPrompt: input.systemPrompt,
            userPrompt: input.userPrompt,
            model: input.model,
            enabledTools: input.enabledTools,
            providerConfig: input.providerConfig,
          })
        : await runDraftVerifierAgent({
            systemPrompt: input.systemPrompt,
            userPrompt: input.userPrompt,
            draftModel: input.draftModel!,
            verifierModel: input.verifierModel!,
            enabledTools: input.enabledTools,
            providerConfig: input.providerConfig,
          });

    let runId = createTransientRunId();
    let persisted = false;

    if (isDatabaseConfigured()) {
      try {
        const prisma = getPrisma();
        const agentConfig = await prisma.agentConfig.create({
          data: {
            name:
              input.agentName,
            mode:
              input.mode === "baseline"
                ? AgentMode.BASELINE
                : AgentMode.DRAFT_VERIFIER,
            model:
              input.mode === "baseline"
                ? input.model
                : `${input.draftModel} -> ${input.verifierModel}`,
            systemPrompt: input.systemPrompt,
            enabledTools: toJsonValue(input.enabledTools),
            toolConfig: toJsonValue({
              source: "playground",
              requestedMode: input.mode,
              agentName: input.agentName,
              providerConfig: sanitizeApiProviderConfig(input.providerConfig),
            }),
          },
        });

        const persistedRun = await prisma.run.create({
          data: {
            name:
              input.mode === "baseline"
                ? "Playground baseline run"
                : "Playground draft-verifier run",
            agentConfigId: agentConfig.id,
            status:
              runResult.status === "succeeded"
                ? RunStatus.SUCCEEDED
                : RunStatus.FAILED,
            input: toJsonValue({
              mode: input.mode,
              agentName: input.agentName,
              systemPrompt: input.systemPrompt,
              userPrompt: input.userPrompt,
              model: input.model,
              draftModel: input.draftModel ?? null,
              verifierModel: input.verifierModel ?? null,
              enabledTools: input.enabledTools,
              providerConfig: sanitizeApiProviderConfig(input.providerConfig),
            }),
            output: toJsonValue(buildRunOutput(runResult)),
            summary: toJsonValue(buildRunSummary(input.mode, runResult)),
            metrics: toJsonValue(runResult.metrics),
            startedAt: new Date(runResult.startedAt),
            finishedAt: new Date(runResult.finishedAt),
          },
        });

        if (runResult.toolCalls.length > 0) {
          await prisma.toolCall.createMany({
            data: runResult.toolCalls.map((toolCall, index) => ({
              runId: persistedRun.id,
              toolName: toolCall.toolName,
              sequence: index + 1,
              status: toolCall.success
                ? ToolCallStatus.SUCCEEDED
                : ToolCallStatus.FAILED,
              input: toJsonValue(toolCall.input),
              output: toJsonValue(toolCall.output),
              error: toJsonValue(
                toolCall.error
                  ? {
                      message: toolCall.error,
                    }
                  : null,
              ),
              latencyMs: toolCall.latencyMs,
            })),
          });
        }

        runId = persistedRun.id;
        persisted = true;
      } catch (error) {
        console.error("Playground persistence failed", {
          mode: input.mode,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const responseBody = buildResponseBody(
      runId,
      persisted,
      input.mode,
      runResult,
    );

    if (runResult.status === "failed") {
      return NextResponse.json(
        {
          ...responseBody,
          error: "Agent run failed.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("Agent run route failed", {
      mode: input.mode,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        error: "Unable to run agent request.",
      },
      { status: 500 },
    );
  }
}

function buildResponseBody(
  runId: string,
  persisted: boolean,
  mode: "baseline" | "draft_verifier",
  runResult: RunResult | DraftVerifierRunResult,
) {
  const draftAccepted =
    mode === "draft_verifier" && "workflow" in runResult
      ? runResult.metrics.draftAccepted
      : null;

  return {
    runId,
    persisted,
    mode,
    status: runResult.status,
    output: runResult.outputText,
    latency: runResult.latencyMs,
    cost: runResult.metrics.estimatedCostUsd,
    toolCalls: runResult.toolCalls,
    draftAccepted,
    result: runResult,
  };
}

function createTransientRunId() {
  return `playground_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildRunOutput(runResult: RunResult | DraftVerifierRunResult) {
  if ("workflow" in runResult) {
    return {
      outputText: runResult.outputText,
      draft: runResult.draft,
      verifier: runResult.verifier,
      error: runResult.error,
    };
  }

  return {
    outputText: runResult.outputText,
    error: runResult.error,
  };
}

function buildRunSummary(
  mode: "baseline" | "draft_verifier",
  runResult: RunResult | DraftVerifierRunResult,
) {
  return {
    mode,
    status: runResult.status,
    latencyMs: runResult.latencyMs,
    estimatedCostUsd: runResult.metrics.estimatedCostUsd,
    toolCallCount: runResult.metrics.toolCallCount,
    toolErrorCount: runResult.metrics.toolErrorCount,
    draftAccepted:
      mode === "draft_verifier" && "workflow" in runResult
        ? runResult.metrics.draftAccepted
        : null,
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
