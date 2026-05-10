import { z } from "zod";

export const aiProviderSchema = z.enum(["openai", "siliconflow"]);

export const apiProviderConfigSchema = z.object({
  provider: aiProviderSchema,
  apiKey: z.string().trim().min(1).max(300),
  baseURL: z.string().trim().url().max(500).optional(),
});

export type ApiProviderConfig = z.infer<typeof apiProviderConfigSchema>;

export type ApiProviderConfigInput = Partial<ApiProviderConfig> | null | undefined;

export const CLIENT_API_CONFIG_STORAGE_KEY = "specagent-lab.api-config";

export function sanitizeApiProviderConfig(
  value: ApiProviderConfigInput,
): Omit<ApiProviderConfig, "apiKey"> | null {
  const parsed = apiProviderConfigSchema.safeParse(value);

  if (!parsed.success) {
    return null;
  }

  return {
    provider: parsed.data.provider,
    ...(parsed.data.baseURL ? { baseURL: parsed.data.baseURL } : {}),
  };
}
