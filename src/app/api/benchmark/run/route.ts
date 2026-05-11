import { NextResponse } from "next/server";
import { z } from "zod";

import { apiProviderConfigSchema } from "@/lib/ai/config";
import { getAiProvider, hasAiProviderCredentials } from "@/lib/ai/provider";
import { runBenchmark } from "@/lib/benchmark/runner";
import { benchmarkTaskLibrary } from "@/lib/benchmark/tasks";
import { isDatabaseConfigured } from "@/lib/env";

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
  providerConfig: apiProviderConfigSchema.optional(),
});

export async function POST(request: Request) {
  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "请求体不是合法的 JSON。",
      },
      { status: 400 },
    );
  }

  const parsedRequest = benchmarkRunRequestSchema.safeParse(requestBody);

  if (!parsedRequest.success) {
    return NextResponse.json(
      {
        error: "批量测试请求参数不完整或格式不正确。",
        details: parsedRequest.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { taskIds, modes, useLlmJudge, providerConfig } = parsedRequest.data;
  const validTaskIds = new Set(benchmarkTaskLibrary.map((task) => task.id));
  const invalidTaskIds = taskIds.filter((taskId) => !validTaskIds.has(taskId));
  const provider = getAiProvider(providerConfig);

  if (invalidTaskIds.length > 0) {
    return NextResponse.json(
      {
        error: "存在无法识别的任务 ID。",
        invalidTaskIds,
      },
      { status: 400 },
    );
  }

  if (!hasAiProviderCredentials(providerConfig)) {
    return NextResponse.json(
      {
        error:
          provider === "siliconflow"
            ? "当前未配置 SILICONFLOW_API_KEY。请在部署环境变量中填写，或先在首页保存浏览器侧 API 配置。"
            : "当前未配置 OPENAI_API_KEY。请在部署环境变量中填写，或先在首页保存浏览器侧 API 配置。",
        code:
          provider === "siliconflow"
            ? "SILICONFLOW_NOT_CONFIGURED"
            : "OPENAI_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  try {
    const result = await runBenchmark({
      taskIds,
      modes,
      useLlmJudge,
      providerConfig,
      persistRuns: isDatabaseConfigured(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Benchmark run route failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      {
        error: "无法启动当前批量测试。",
      },
      { status: 500 },
    );
  }
}
