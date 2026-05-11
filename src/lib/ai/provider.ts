import { createOpenAI, openai } from "@ai-sdk/openai";

import {
  apiProviderConfigSchema,
  type ApiProviderConfigInput,
} from "@/lib/ai/config";
import {
  type AiProvider,
  getDefaultModelsForProvider,
  getModelOptionsForProvider,
} from "@/lib/ai/catalog";

const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";

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
  return getDefaultModelsForProvider(getAiProvider(input));
}

export function getModelOptions(input?: ApiProviderConfigInput) {
  return getModelOptionsForProvider(getAiProvider(input));
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
