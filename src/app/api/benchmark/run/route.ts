import { NextResponse } from "next/server";
import { z } from "zod";

import { runBenchmark } from "@/lib/benchmark/runner";
import { benchmarkTaskLibrary } from "@/lib/benchmark/tasks";
import { hasOpenAiApiKey, isDatabaseConfigured } from "@/lib/env";

const benchmarkRunRequestSchema = z.object({
  taskIds: z
    .array(z.string().min(1))
    .min(1)
    .max(10),
  modes: z
    .array(z.enum(["baseline", "draft_verifier"]))
    .min(1)
    .max(2),
  useLlmJudge: z.boolean().optional(),
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

  const parsedRequest = benchmarkRunRequestSchema.safeParse(requestBody);

  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "Invalid benchmark request.",
        details: parsedRequest.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { taskIds, modes, useLlmJudge } = parsedRequest.data;
  const validTaskIds = new Set(benchmarkTaskLibrary.map((task) => task.id));
  const invalidTaskIds = taskIds.filter((taskId) => !validTaskIds.has(taskId));

  if (invalidTaskIds.length > 0) {
    return NextResponse.json(
      {
        error: "Unknown benchmark task id.",
        invalidTaskIds,
      },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Database is not configured. Set DATABASE_URL (e.g. Vercel Postgres or Neon) to persist benchmark runs.",
        code: "DATABASE_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  if (!hasOpenAiApiKey()) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is not set. Add it in environment variables to run benchmark agents against OpenAI.",
        code: "OPENAI_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  try {
    const result = await runBenchmark({
      taskIds,
      modes,
      useLlmJudge,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Benchmark run route failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        error: "Unable to run benchmark request.",
      },
      { status: 500 },
    );
  }
}
