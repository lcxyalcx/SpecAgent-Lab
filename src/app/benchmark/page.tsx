import { BenchmarkRunner } from "@/components/benchmark/benchmark-runner";
import { getConfiguredAiProvider } from "@/lib/env";

export default function BenchmarkPage() {
  return <BenchmarkRunner defaultProvider={getConfiguredAiProvider()} />;
}
