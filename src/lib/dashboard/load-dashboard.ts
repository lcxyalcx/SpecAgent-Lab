import {
  buildDashboardPayload,
  buildMockDashboardPayload,
  normalizeDbRun,
} from "@/lib/dashboard/build-payload";
import type { DashboardPayload } from "@/lib/dashboard/types";
import { isDatabaseConfigured } from "@/lib/env";
import { getPrisma } from "@/lib/db";

const RECENT_RUN_LIMIT = 250;

export async function loadDashboardPayload(): Promise<DashboardPayload> {
  if (!isDatabaseConfigured()) {
    return { ...buildMockDashboardPayload(), source: "demo" };
  }

  try {
    const prisma = getPrisma();
    const rows = await prisma.run.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_RUN_LIMIT,
      include: {
        agentConfig: true,
        benchmarkTask: true,
      },
    });

    const normalized = rows
      .map((row) =>
        normalizeDbRun({
          id: row.id,
          createdAt: row.createdAt,
          name: row.name,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          metrics: row.metrics,
          summary: row.summary,
          agentConfig: row.agentConfig,
          benchmarkTask: row.benchmarkTask,
        }),
      )
      .filter((value): value is NonNullable<typeof value> => value !== null);

    if (normalized.length === 0) {
      return buildMockDashboardPayload();
    }

    return buildDashboardPayload(normalized, "database");
  } catch {
    return buildMockDashboardPayload();
  }
}
