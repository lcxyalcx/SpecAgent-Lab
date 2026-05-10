import { generateText } from "ai";

import type { ApiProviderConfigInput } from "@/lib/ai/config";
import { getDefaultAgentModels, getLanguageModel } from "@/lib/ai/provider";
import { hasAiProviderCredentials } from "@/lib/ai/provider";
import type { BenchmarkTaskDefinition } from "@/lib/benchmark/tasks";

/**
 * Heuristic evaluation uses fixed rules (keyword overlap on the rubric, tool failure
 * rates, run status). It is fast, repeatable, and needs no extra model calls — best
 * for deterministic MVP demos and CI-style regression checks.
 *
 * LLM-as-judge evaluation asks a separate model to read the rubric and answer, then
 * returns structured scores. It can better capture nuance and reasoning quality, but
 * adds latency, cost, and non-determinism unless the judge is heavily constrained.
 */
export type EvaluationMethod = "heuristic" | "llm_judge";

export type BenchmarkRubric = BenchmarkTaskDefinition["evaluationRubric"];

export type EvalToolCallSummary = {
  success: boolean;
};

export type VerifierEvaluationMeta = {
  confidenceScore?: number | null;
  reason?: string | null;
  draftAccepted?: boolean | null;
};

export type BenchmarkEvaluationInput = {
  rubric: BenchmarkRubric;
  agentOutput: string;
  toolCalls: EvalToolCallSummary[];
  runStatus: "succeeded" | "failed";
  verifier?: VerifierEvaluationMeta | null;
};

export type StructuredEvaluationScores = {
  taskSuccessScore: number;
  reasoningQualityScore: number;
  constraintSatisfactionScore: number;
  toolUseScore: number;
  explanation: string;
};

export type BenchmarkEvaluationResult = StructuredEvaluationScores & {
  method: EvaluationMethod;
};

export type EvaluateBenchmarkOptions = {
  /** When true, call a judge model (requires configured AI provider credentials). Falls back to heuristic if the call fails. */
  useLlmJudge?: boolean;
  /** AI SDK-compatible model id for the configured provider. */
  judgeModel?: string;
  providerConfig?: ApiProviderConfigInput;
};

const STOPWORDS = new Set([
  "about",
  "across",
  "after",
  "agent",
  "and",
  "answers",
  "assistant",
  "been",
  "before",
  "being",
  "both",
  "clear",
  "could",
  "details",
  "from",
  "have",
  "help",
  "into",
  "later",
  "more",
  "must",
  "only",
  "other",
  "over",
  "should",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "through",
  "under",
  "user",
  "when",
  "where",
  "which",
  "while",
  "will",
  "with",
  "without",
  "your",
]);

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
}

function uniqueKeywords(text: string) {
  return [...new Set(tokenize(text))];
}

function criterionCoverage(outputLower: string, criterion: string) {
  const terms = uniqueKeywords(criterion);
  if (terms.length === 0) {
    return 0.5;
  }

  const hits = terms.filter((term) => outputLower.includes(term)).length;
  return hits / terms.length;
}

function failureModePenalty(outputLower: string, failureModes: string[]) {
  if (failureModes.length === 0) {
    return 0;
  }

  let penalty = 0;

  for (const mode of failureModes) {
    const terms = uniqueKeywords(mode);
    if (terms.length < 2) {
      continue;
    }

    const hits = terms.filter((term) => outputLower.includes(term)).length;
    if (hits >= Math.min(3, Math.ceil(terms.length * 0.45))) {
      penalty += 0.06;
    }
  }

  return Math.min(0.22, penalty);
}

function structureScore(output: string) {
  const words = output.trim().split(/\s+/).filter(Boolean).length;
  const hasStructure =
    /(^|\n)\s*(?:[-*•]|\d+\.)\s+/m.test(output) || /:\s*\n/.test(output);
  const lengthFactor = Math.min(1, words / 120);
  return clamp(0.08 + (hasStructure ? 0.12 : 0) + lengthFactor * 0.35, 0, 0.55);
}

export function evaluateBenchmarkHeuristic(
  input: BenchmarkEvaluationInput,
): StructuredEvaluationScores {
  const outputLower = input.agentOutput.toLowerCase();
  const criteria = input.rubric.successCriteria;
  const perCriterion =
    criteria.length === 0
      ? [0.65]
      : criteria.map((criterion) => criterionCoverage(outputLower, criterion));
  const constraintSatisfactionScore = average(perCriterion);

  const failPenalty = failureModePenalty(outputLower, input.rubric.failureModes);
  const toolTotal = input.toolCalls.length;
  const toolFailed = input.toolCalls.filter((call) => !call.success).length;
  const toolErrorRate = toolTotal === 0 ? 0 : toolFailed / toolTotal;
  const toolUseScore = clamp(1 - toolErrorRate * 1.15, 0, 1);

  const reasoningQualityScore = clamp(
    structureScore(input.agentOutput) +
      constraintSatisfactionScore * 0.35 +
      (input.runStatus === "succeeded" ? 0.12 : 0),
    0,
    1,
  );

  const statusPenalty = input.runStatus === "failed" ? 0.28 : 0;
  const toolPenalty = toolErrorRate * 0.34;
  const verifierLift =
    input.verifier?.confidenceScore != null
      ? clamp(input.verifier.confidenceScore, 0, 1) * 0.05
      : 0;
  const draftLift =
    input.verifier?.draftAccepted === true ? 0.04 : input.verifier?.draftAccepted === false ? -0.03 : 0;

  const taskSuccessScore = clamp(
    constraintSatisfactionScore * 0.72 +
      reasoningQualityScore * 0.18 +
      toolUseScore * 0.1 -
      failPenalty -
      toolPenalty -
      statusPenalty +
      verifierLift +
      draftLift,
    0,
    1,
  );

  const explanation = [
    `Heuristic: rubric coverage ≈ ${percent(constraintSatisfactionScore)} across ${criteria.length || 1} criteria.`,
    toolTotal > 0
      ? `Tool calls ${toolTotal}, failures ${toolFailed} (${percent(toolErrorRate)} error rate).`
      : "No tool calls recorded.",
    failPenalty > 0
      ? `Failure-mode overlap penalty applied (${round3(failPenalty)}).`
      : "No strong failure-mode keyword overlap.",
    input.runStatus === "failed" ? "Run reported failure status." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    taskSuccessScore: round3(taskSuccessScore),
    reasoningQualityScore: round3(reasoningQualityScore),
    constraintSatisfactionScore: round3(constraintSatisfactionScore),
    toolUseScore: round3(toolUseScore),
    explanation,
  };
}

const judgeResponseSchemaHint = `{
  "taskSuccessScore": number,
  "reasoningQualityScore": number,
  "constraintSatisfactionScore": number,
  "toolUseScore": number,
  "explanation": string
}`;
const MAX_JUDGE_OUTPUT_TOKENS = 220;

function buildJudgePrompt(input: BenchmarkEvaluationInput, toolErrorRate: number) {
  return [
    "You grade an assistant answer against a fixed rubric. Reply with ONLY minified JSON matching this shape:",
    judgeResponseSchemaHint,
    "All scores are floats from 0 to 1.",
    "",
    "Rubric success criteria:",
    ...input.rubric.successCriteria.map((line, index) => `${index + 1}. ${line}`),
    "",
    "Rubric failure modes to penalize if the answer exhibits them:",
    ...input.rubric.failureModes.map((line, index) => `${index + 1}. ${line}`),
    "",
    `Scoring notes: ${input.rubric.scoringNotes}`,
    "",
    `Tool error rate (failed / total tool calls): ${round3(toolErrorRate)}.`,
    `Run status: ${input.runStatus}.`,
    input.verifier?.reason
      ? `Verifier note: ${input.verifier.reason}`
      : "",
    "",
    "Assistant answer:",
    input.agentOutput.trim() || "(empty)",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseJudgeJson(text: string): StructuredEvaluationScores | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const taskSuccessScore = clamp(Number(parsed.taskSuccessScore), 0, 1);
    const reasoningQualityScore = clamp(Number(parsed.reasoningQualityScore), 0, 1);
    const constraintSatisfactionScore = clamp(
      Number(parsed.constraintSatisfactionScore),
      0,
      1,
    );
    const toolUseScore = clamp(Number(parsed.toolUseScore), 0, 1);
    const explanation =
      typeof parsed.explanation === "string" && parsed.explanation.trim().length > 0
        ? parsed.explanation.trim()
        : "LLM judge returned no explanation.";

    if (
      [taskSuccessScore, reasoningQualityScore, constraintSatisfactionScore, toolUseScore].some(
        (value) => Number.isNaN(value),
      )
    ) {
      return null;
    }

    return {
      taskSuccessScore: round3(taskSuccessScore),
      reasoningQualityScore: round3(reasoningQualityScore),
      constraintSatisfactionScore: round3(constraintSatisfactionScore),
      toolUseScore: round3(toolUseScore),
      explanation,
    };
  } catch {
    return null;
  }
}

async function evaluateBenchmarkLlm(
  input: BenchmarkEvaluationInput,
  judgeModel: string,
  providerConfig?: ApiProviderConfigInput,
): Promise<StructuredEvaluationScores | null> {
  if (!hasAiProviderCredentials(providerConfig)) {
    return null;
  }

  const toolTotal = input.toolCalls.length;
  const toolFailed = input.toolCalls.filter((call) => !call.success).length;
  const toolErrorRate = toolTotal === 0 ? 0 : toolFailed / toolTotal;

  try {
    const { text } = await generateText({
      model: getLanguageModel(judgeModel, providerConfig),
      prompt: buildJudgePrompt(input, toolErrorRate),
      maxOutputTokens: MAX_JUDGE_OUTPUT_TOKENS,
      temperature: 0.1,
    });

    return parseJudgeJson(text);
  } catch {
    return null;
  }
}

export async function evaluateBenchmarkRun(
  input: BenchmarkEvaluationInput,
  options: EvaluateBenchmarkOptions = {},
): Promise<BenchmarkEvaluationResult> {
  const heuristic = evaluateBenchmarkHeuristic(input);

  if (!options.useLlmJudge) {
    return { ...heuristic, method: "heuristic" };
  }

  const judgeModel =
    options.judgeModel ?? getDefaultAgentModels(options.providerConfig).judge;
  const llm = await evaluateBenchmarkLlm(
    input,
    judgeModel,
    options.providerConfig,
  );

  if (llm) {
    return { ...llm, method: "llm_judge" };
  }

  return {
    ...heuristic,
    explanation: `${heuristic.explanation} LLM judge unavailable; used heuristic scores.`,
    method: "heuristic",
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}
