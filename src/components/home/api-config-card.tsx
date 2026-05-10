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

const providerPresets = {
  openai: {
    label: "OpenAI",
    placeholder: "sk-...",
    baseURL: "",
    helper: "Uses the default OpenAI endpoint.",
  },
  siliconflow: {
    label: "SiliconFlow",
    placeholder: "sk-...",
    baseURL: "https://api.siliconflow.cn/v1",
    helper: "OpenAI-compatible endpoint for SiliconFlow.",
  },
} as const;

const defaultConfig: ApiProviderConfig = {
  provider: "siliconflow",
  apiKey: "",
  baseURL: providerPresets.siliconflow.baseURL,
};

export function ApiConfigCard() {
  const [formState, setFormState] = useState<ApiProviderConfig>(defaultConfig);
  const [isSaved, setIsSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(CLIENT_API_CONFIG_STORAGE_KEY);

        if (!raw) {
          setIsSaved(false);
          return;
        }

        const parsed = apiProviderConfigSchema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          setFormState(parsed.data);
          setIsSaved(true);
          return;
        }

        setIsSaved(false);
      } catch {
        // Ignore malformed local state and fall back to defaults.
        setIsSaved(false);
      }
    });
  }, []);

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
      setStatusMessage("Please provide a valid provider, API key, and base URL when needed.");
      return;
    }

    window.localStorage.setItem(
      CLIENT_API_CONFIG_STORAGE_KEY,
      JSON.stringify(parsed.data),
    );
    window.dispatchEvent(new Event("specagent-api-config-changed"));
    setIsSaved(true);
    setStatusMessage("Saved locally in this browser. Playground and benchmark will use it automatically.");
  }

  function handleClear() {
    window.localStorage.removeItem(CLIENT_API_CONFIG_STORAGE_KEY);
    window.dispatchEvent(new Event("specagent-api-config-changed"));
    setFormState(defaultConfig);
    setIsSaved(false);
    setStatusMessage("Cleared local API configuration.");
  }

  return (
    <Card className="bg-card/85 shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" aria-hidden="true" />
              API Configuration
            </CardTitle>
            <CardDescription>
              Add your own model provider credentials here, CC Switch style. The key stays in your browser and is sent only when you run playground or benchmark jobs.
            </CardDescription>
          </div>
          <Badge variant={isSaved ? "default" : "outline"} className="rounded-md">
            {isSaved ? "Local config ready" : "Not configured"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 md:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-2">
            <Label htmlFor="api-provider">Provider</Label>
            <Select value={formState.provider} onValueChange={handleProviderChange}>
              <SelectTrigger id="api-provider">
                <SelectValue placeholder="Choose provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="siliconflow">SiliconFlow</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="api-key">API key</Label>
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
              <div className="font-medium">How it works</div>
              <p className="text-muted-foreground">
                {providerPresets[formState.provider].helper} This config is stored in
                local storage, so each browser can bring its own provider without changing server secrets.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-md">
              Homepage controlled
            </Badge>
            <Badge variant="outline" className="rounded-md">
              Playground compatible
            </Badge>
            <Badge variant="outline" className="rounded-md">
              Benchmark compatible
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave}>
            <Sparkles className="size-4" aria-hidden="true" />
            Save local API config
          </Button>
          <Button type="button" variant="outline" onClick={handleClear}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Clear
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
