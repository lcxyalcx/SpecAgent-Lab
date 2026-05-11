"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiProviderConfigSchema, CLIENT_API_CONFIG_STORAGE_KEY, type ApiProviderConfig } from "@/lib/ai/config";
import type { AiProvider } from "@/lib/ai/catalog";

const providerPresets = {
  openai: {
    label: "OpenAI",
    placeholder: "sk-...",
    baseURL: "",
    helper: "使用 OpenAI 官方默认接口。",
  },
  siliconflow: {
    label: "SiliconFlow",
    placeholder: "sk-...",
    baseURL: "https://api.siliconflow.cn/v1",
    helper: "使用 SiliconFlow 的 OpenAI 兼容接口。",
  },
} as const;

function buildDefaultConfig(provider: AiProvider): ApiProviderConfig {
  return {
    provider,
    apiKey: "",
    baseURL: provider === "siliconflow" ? providerPresets.siliconflow.baseURL : "",
  };
}

type ApiConfigCardProps = {
  defaultProvider: AiProvider;
};

export function ApiConfigCard({ defaultProvider }: ApiConfigCardProps) {
  const [formState, setFormState] = useState<ApiProviderConfig>(() =>
    buildDefaultConfig(defaultProvider),
  );
  const [isSaved, setIsSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(CLIENT_API_CONFIG_STORAGE_KEY);

        if (!raw) {
          setFormState(buildDefaultConfig(defaultProvider));
          setIsSaved(false);
          return;
        }

        const parsed = apiProviderConfigSchema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          setFormState(parsed.data);
          setIsSaved(true);
          return;
        }

        setFormState(buildDefaultConfig(defaultProvider));
        setIsSaved(false);
      } catch {
        // Ignore malformed local state and fall back to defaults.
        setFormState(buildDefaultConfig(defaultProvider));
        setIsSaved(false);
      }
    });
  }, [defaultProvider]);

  function handleProviderChange(provider: ApiProviderConfig["provider"]) {
    setFormState((current) => ({
      provider,
      apiKey: current.provider === provider ? current.apiKey : "",
      baseURL:
        provider === "openai"
          ? ""
          : current.provider === provider && current.baseURL
            ? current.baseURL
            : providerPresets.siliconflow.baseURL,
    }));
    setStatusMessage(null);
  }

  function handleSave() {
    const parsed = apiProviderConfigSchema.safeParse({
      ...formState,
      baseURL: formState.provider === "openai" ? undefined : formState.baseURL,
    });

    if (!parsed.success) {
      setStatusMessage("请填写有效的供应商、API Key，以及在需要时填写正确的 Base URL。");
      return;
    }

    window.localStorage.setItem(
      CLIENT_API_CONFIG_STORAGE_KEY,
      JSON.stringify(parsed.data),
    );
    window.dispatchEvent(new Event("specagent-api-config-changed"));
    setIsSaved(true);
    setStatusMessage("已保存到当前浏览器，本地 Playground 和 Benchmark 会自动使用这组配置。");
  }

  function handleClear() {
    window.localStorage.removeItem(CLIENT_API_CONFIG_STORAGE_KEY);
    window.dispatchEvent(new Event("specagent-api-config-changed"));
    setFormState(buildDefaultConfig(defaultProvider));
    setIsSaved(false);
    setStatusMessage("已清除当前浏览器中的本地 API 配置。");
  }

  return (
    <Card className="bg-card/85 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" aria-hidden="true" />
              API 配置
            </CardTitle>
            <CardDescription>
              可以在这里填写你自己的模型供应商凭证。密钥仅保存在当前浏览器里，只有运行 Playground 或 Benchmark 时才会随请求发送。
            </CardDescription>
          </div>
          <Badge variant={isSaved ? "default" : "outline"} className="rounded-md">
            {isSaved ? "本地配置已就绪" : "尚未配置"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 md:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-2">
            <Label htmlFor="api-provider">供应商</Label>
            <Select value={formState.provider} onValueChange={handleProviderChange}>
              <SelectTrigger id="api-provider">
                <SelectValue placeholder="选择供应商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="siliconflow">SiliconFlow</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={formState.apiKey}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  apiKey: event.target.value,
                }))
              }
              placeholder={providerPresets[formState.provider].placeholder}
            />
          </div>
        </div>

        {formState.provider === "siliconflow" ? (
          <div className="grid gap-2">
            <Label htmlFor="api-base-url">Base URL</Label>
            <Input
              id="api-base-url"
              value={formState.baseURL ?? ""}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  baseURL: event.target.value,
                }))
              }
              placeholder={providerPresets.siliconflow.baseURL}
            />
          </div>
        ) : null}

        <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </div>
            <div className="grid gap-1">
              <div className="font-medium">工作方式</div>
              <p className="text-muted-foreground">
                {providerPresets[formState.provider].helper}
                这组配置会存到当前浏览器的 Local Storage，因此不同浏览器可以各自使用自己的供应商，而不用修改服务器端密钥。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-md">
              首页统一管理
            </Badge>
            <Badge variant="outline" className="rounded-md">
              Playground 可用
            </Badge>
            <Badge variant="outline" className="rounded-md">
              Benchmark 可用
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave}>
            <Sparkles className="size-4" aria-hidden="true" />
            保存本地 API 配置
          </Button>
          <Button type="button" variant="outline" onClick={handleClear}>
            <RotateCcw className="size-4" aria-hidden="true" />
            清除
          </Button>
          {statusMessage ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              {statusMessage}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
