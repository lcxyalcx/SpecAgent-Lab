import { tool } from "ai";
import { z } from "zod";

type SearchDocument = {
  id: string;
  title: string;
  snippet: string;
  tags: string[];
};

const corpus: SearchDocument[] = [
  {
    id: "doc-prd-speculative",
    title: "Speculative workflow notes",
    snippet:
      "Draft-verifier workflows can improve latency when draft acceptance stays high and tool recovery remains stable.",
    tags: ["agent", "latency", "verifier", "speculative"],
  },
  {
    id: "doc-support-refunds",
    title: "Refund policy summary",
    snippet:
      "Refund approval depends on shipment state, delay threshold, and whether the issue requires manual escalation.",
    tags: ["support", "refund", "policy"],
  },
  {
    id: "doc-benchmark-design",
    title: "Benchmark design memo",
    snippet:
      "Multi-turn evaluation should measure success, latency, cost, and tool reliability rather than answer quality alone.",
    tags: ["benchmark", "evaluation", "metrics"],
  },
  {
    id: "doc-budget-planning",
    title: "Quarterly planning checklist",
    snippet:
      "Budget planning works best when fixed costs, discretionary spend, and scenario tradeoffs are tracked separately.",
    tags: ["budget", "planning", "finance"],
  },
  {
    id: "doc-meeting-ops",
    title: "Meeting summary rubric",
    snippet:
      "Strong summaries separate decisions, action items, unresolved questions, and missing evidence.",
    tags: ["meeting", "summary", "operations"],
  },
  {
    id: "doc-product-recommendations",
    title: "Recommendation system guide",
    snippet:
      "Product recommendations should adapt to user goals, constraints, and changing preferences over several turns.",
    tags: ["recommendation", "product", "constraints"],
  },
];

export const mockSearchInputSchema = z.object({
  query: z
    .string()
    .min(2)
    .max(120)
    .describe("A search query for the deterministic local corpus."),
});

export const mockSearch = tool({
  description:
    "Search a small deterministic local knowledge corpus for benchmark and product context.",
  inputSchema: mockSearchInputSchema,
  execute: async ({ query }) => {
    const normalizedQuery = query.trim().toLowerCase();
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const scored = corpus
      .map((document) => ({
        document,
        score: scoreDocument(document, tokens),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.document.id.localeCompare(right.document.id))
      .slice(0, 3);

    return {
      ok: true,
      tool: "mockSearch" as const,
      query: normalizedQuery,
      latencyMs: deterministicLatency(normalizedQuery, 24),
      resultCount: scored.length,
      results: scored.map(({ document, score }) => ({
        id: document.id,
        title: document.title,
        snippet: document.snippet,
        score,
      })),
    };
  },
});

function scoreDocument(document: SearchDocument, tokens: string[]) {
  const haystack = `${document.title} ${document.snippet} ${document.tags.join(" ")}`.toLowerCase();

  return tokens.reduce((score, token) => {
    if (document.tags.includes(token)) {
      return score + 4;
    }

    if (document.title.toLowerCase().includes(token)) {
      return score + 3;
    }

    if (haystack.includes(token)) {
      return score + 2;
    }

    return score;
  }, 0);
}

function deterministicLatency(seed: string, minimum: number) {
  return minimum + (seed.length % 9);
}
