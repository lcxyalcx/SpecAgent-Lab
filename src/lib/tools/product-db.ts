import { tool } from "ai";
import { z } from "zod";

type ProductRecord = {
  sku: string;
  name: string;
  category: "laptop" | "audio" | "monitor" | "software";
  price: number;
  tags: string[];
};

const productCatalog: ProductRecord[] = [
  {
    sku: "prod-ultralite-13",
    name: "Ultralite 13",
    category: "laptop",
    price: 1199,
    tags: ["travel", "battery", "lightweight", "coding"],
  },
  {
    sku: "prod-workbench-15",
    name: "Workbench 15",
    category: "laptop",
    price: 1699,
    tags: ["performance", "coding", "multitasking"],
  },
  {
    sku: "prod-focusbuds",
    name: "FocusBuds Pro",
    category: "audio",
    price: 249,
    tags: ["travel", "meetings", "noise-cancellation"],
  },
  {
    sku: "prod-deskview-34",
    name: "DeskView 34",
    category: "monitor",
    price: 699,
    tags: ["analysis", "coding", "productivity"],
  },
  {
    sku: "prod-noteflow",
    name: "NoteFlow",
    category: "software",
    price: 29,
    tags: ["meetings", "summaries", "collaboration"],
  },
  {
    sku: "prod-budgetboard",
    name: "BudgetBoard",
    category: "software",
    price: 49,
    tags: ["finance", "budget", "planning"],
  },
];

const priceRangeSchema = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
});

export const productDbInputSchema = z.object({
  category: z
    .enum(["laptop", "audio", "monitor", "software"])
    .optional()
    .describe("Optional product category filter."),
  priceRange: priceRangeSchema.optional().describe("Optional inclusive price range filter."),
  userNeed: z
    .string()
    .min(2)
    .max(60)
    .optional()
    .describe("A short user need such as travel, coding, budget, or meetings."),
});

export const productDb = tool({
  description:
    "Return deterministic product options from a small local catalog using category, price range, and user need filters.",
  inputSchema: productDbInputSchema,
  execute: async ({ category, priceRange, userNeed }) => {
    if (priceRange && priceRange.min > priceRange.max) {
      return {
        ok: false,
        tool: "productDb" as const,
        error: "priceRange.min cannot be greater than priceRange.max.",
        latencyMs: 21,
      };
    }

    const normalizedNeed = userNeed?.trim().toLowerCase();

    const matches = productCatalog
      .filter((product) => !category || product.category === category)
      .filter(
        (product) =>
          !priceRange ||
          (product.price >= priceRange.min && product.price <= priceRange.max),
      )
      .map((product) => ({
        product,
        relevance:
          normalizedNeed && product.tags.includes(normalizedNeed)
            ? 3
            : normalizedNeed && product.name.toLowerCase().includes(normalizedNeed)
              ? 2
              : normalizedNeed
                ? 1
                : 0,
      }))
      .filter(({ relevance }) => !normalizedNeed || relevance > 0)
      .sort(
        (left, right) =>
          right.relevance - left.relevance ||
          left.product.price - right.product.price ||
          left.product.sku.localeCompare(right.product.sku),
      )
      .slice(0, 4);

    return {
      ok: true,
      tool: "productDb" as const,
      filters: {
        category: category ?? null,
        priceRange: priceRange ?? null,
        userNeed: normalizedNeed ?? null,
      },
      latencyMs: deterministicLatency(category, normalizedNeed, priceRange),
      resultCount: matches.length,
      options: matches.map(({ product, relevance }) => ({
        sku: product.sku,
        name: product.name,
        category: product.category,
        price: product.price,
        matchedNeeds: normalizedNeed
          ? product.tags.filter((tag) => tag === normalizedNeed)
          : [],
        relevance,
      })),
    };
  },
});

function deterministicLatency(
  category: string | undefined,
  userNeed: string | undefined,
  priceRange: { min: number; max: number } | undefined,
) {
  const categoryScore = category ? category.length : 3;
  const needScore = userNeed ? userNeed.length : 5;
  const rangeScore = priceRange ? Math.abs(priceRange.max - priceRange.min) % 11 : 4;

  return 26 + categoryScore + needScore + rangeScore;
}
