import { AgentPlayground } from "@/components/playground/agent-playground";
import { getConfiguredAiProvider } from "@/lib/env";

export default function PlaygroundPage() {
  return <AgentPlayground defaultProvider={getConfiguredAiProvider()} />;
}
