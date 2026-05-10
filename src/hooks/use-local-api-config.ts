"use client";

import { useEffect, useMemo, useState } from "react";

import {
  apiProviderConfigSchema,
  CLIENT_API_CONFIG_STORAGE_KEY,
  type ApiProviderConfig,
} from "@/lib/ai/config";

export function useLocalApiConfig() {
  const [providerConfig, setProviderConfig] = useState<ApiProviderConfig | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadConfig = () => {
      queueMicrotask(() => {
        try {
          const raw = window.localStorage.getItem(CLIENT_API_CONFIG_STORAGE_KEY);

          if (!raw) {
            setProviderConfig(null);
            return;
          }

          const parsed = apiProviderConfigSchema.safeParse(JSON.parse(raw));
          setProviderConfig(parsed.success ? parsed.data : null);
        } catch {
          setProviderConfig(null);
        } finally {
          setIsReady(true);
        }
      });
    };

    loadConfig();
    window.addEventListener("storage", loadConfig);
    window.addEventListener("specagent-api-config-changed", loadConfig);

    return () => {
      window.removeEventListener("storage", loadConfig);
      window.removeEventListener("specagent-api-config-changed", loadConfig);
    };
  }, []);

  const isConfigured = useMemo(
    () => Boolean(providerConfig?.apiKey.trim()),
    [providerConfig],
  );

  return {
    providerConfig,
    isConfigured,
    isReady,
  };
}
