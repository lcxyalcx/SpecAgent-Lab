import { createOpenAI, openai } from "@ai-sdk/openai";

import {
  apiProviderConfigSchema,
  type ApiProviderConfigInput,
} from "@/lib/ai/config";

export type AiProvider = "openai" | "siliconflow";

const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";

const DEFAULT_MODELS: Record<
  AiProvider,
  {
    baseline: string;
    draft: string;
    verifier: string;
    judge: string;
  }
> = {
  openai: {
    baseline: "gpt-5.4",
    draft: "gpt-5.4-mini",
    verifier: "gpt-5.4",
    judge: "gpt-4o-mini",
  },
  siliconflow: {
    baseline: "deepseek-ai/DeepSeek-V3",
    draft: "deepseek-ai/DeepSeek-V3",
    verifier: "deepseek-ai/DeepSeek-V3",
    judge: "deepseek-ai/DeepSeek-V3",
  },
};

function resolveProviderConfig(input?: ApiProviderConfigInput) {
  const parsed = apiProviderConfigSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function getAiProvider(input?: ApiProviderConfigInput): AiProvider {
  const requestConfig = resolveProviderConfig(input);

  if (requestConfig) {
    return requestConfig.provider;
  }

  const configured = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (configured === "openai" || configured === "siliconflow") {
    return configured;
  }

  if (process.env.SILICONFLOW_API_KEY?.trim()) {
    return "siliconflow";
  }

  return "openai";
}

export function hasAiProviderCredentials(input?: ApiProviderConfigInput): boolean {
  const requestConfig = resolveProviderConfig(input);

  if (requestConfig) {
    return Boolean(requestConfig.apiKey.trim());
  }

  const provider = getAiProvider();

  if (provider === "siliconflow") {
    return Boolean(process.env.SILICONFLOW_API_KEY?.trim());
  }

  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getDefaultAgentModels(input?: ApiProviderConfigInput) {
  return DEFAULT_MODELS[getAiProvider(input)];
}

export function getModelOptions() {
  return [
    "Qwen/Qwen2-7B-Instruct",
    "Qwen/Qwen2.5-7B-Instruct",
    "deepseek-ai/DeepSeek-V3",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4o-mini",
  ] as const;
}

export function getLanguageModel(modelId: string, input?: ApiProviderConfigInput) {
  const requestConfig = resolveProviderConfig(input);
  const provider = getAiProvider(requestConfig);

  if (provider === "siliconflow") {
    const siliconflow = createOpenAI({
      apiKey: requestConfig?.apiKey || process.env.SILICONFLOW_API_KEY,
      baseURL:
        requestConfig?.baseURL ||
        process.env.SILICONFLOW_BASE_URL?.trim() ||
        SILICONFLOW_BASE_URL,
    });

    return siliconflow.chat(modelId);
  }

  if (requestConfig?.provider === "openai") {
    const openaiProvider = createOpenAI({
      apiKey: requestConfig.apiKey,
      ...(requestConfig.baseURL ? { baseURL: requestConfig.baseURL } : {}),
    });

    return openaiProvider(modelId);
  }

  return openai(modelId);
}
