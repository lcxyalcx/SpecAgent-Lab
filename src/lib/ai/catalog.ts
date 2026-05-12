export type AiProvider = "openai" | "siliconflow";

const OPENAI_MODELS = [
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o-mini",
] as const;

const SILICONFLOW_MODELS = [
  "deepseek-ai/DeepSeek-V3",
  "Qwen/Qwen2.5-7B-Instruct",
  "Qwen/Qwen2-7B-Instruct",
] as const;

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  siliconflow: "SiliconFlow",
};

export const PROVIDER_MODEL_OPTIONS = {
  openai: OPENAI_MODELS,
  siliconflow: SILICONFLOW_MODELS,
} as const satisfies Record<AiProvider, readonly string[]>;

export const DEFAULT_MODELS = {
  openai: {
    baseline: "gpt-5.4",
    draft: "gpt-5.4-mini",
    verifier: "gpt-5.4-mini",
    judge: "gpt-4o-mini",
  },
  siliconflow: {
    baseline: "deepseek-ai/DeepSeek-V3",
    draft: "Qwen/Qwen2.5-7B-Instruct",
    verifier: "Qwen/Qwen2.5-7B-Instruct",
    judge: "deepseek-ai/DeepSeek-V3",
  },
} as const satisfies Record<
  AiProvider,
  {
    baseline: string;
    draft: string;
    verifier: string;
    judge: string;
  }
>;

const KNOWN_MODEL_PROVIDER = new Map<string, AiProvider>(
  Object.entries(PROVIDER_MODEL_OPTIONS).flatMap(([provider, models]) =>
    models.map((model) => [model, provider as AiProvider] as const),
  ),
);

export function getProviderLabel(provider: AiProvider) {
  return PROVIDER_LABELS[provider];
}

export function getModelOptionsForProvider(provider: AiProvider) {
  return [...PROVIDER_MODEL_OPTIONS[provider]];
}

export function getDefaultModelsForProvider(provider: AiProvider) {
  return DEFAULT_MODELS[provider];
}

export function getKnownModelProvider(modelId: string): AiProvider | null {
  return KNOWN_MODEL_PROVIDER.get(modelId) ?? null;
}

export function isKnownModelCompatibleWithProvider(
  modelId: string,
  provider: AiProvider,
) {
  const knownProvider = getKnownModelProvider(modelId);
  return knownProvider === null || knownProvider === provider;
}
