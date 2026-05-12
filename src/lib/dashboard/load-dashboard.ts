import {
  buildDashboardPayload,
  buildMockDashboardPayload,
  normalizeDbRun,
} from "@/lib/dashboard/build-payload";
import type { DashboardPayload } from "@/lib/dashboard/types";
import {
  listFileRuns,
  toDashboardRunRow,
} from "@/lib/persistence/file-store";
import { buildStorageInfo } from "@/lib/persistence/state";
import {
  formatDatabaseError,
  getDatabaseState,
  getPrisma,
  withDatabaseTimeout,
} from "@/lib/db";

const RECENT_RUN_LIMIT = 250;

export async function loadDashboardPayload(): Promise<DashboardPayload> {
  const fileRows = await listFileRuns(RECENT_RUN_LIMIT);
  const normalizedFileRuns = normalizeRows(fileRows.map(toDashboardRunRow));
  const databaseState = await getDatabaseState();

  if (!databaseState.available) {
    if (normalizedFileRuns.length > 0) {
      return {
        ...buildDashboardPayload(normalizedFileRuns, "file"),
        databaseMessage: databaseState.message,
        storage: buildStorageInfo(
          "file",
          databaseState.configured
            ? `${buildStorageInfo("file").message} 当前数据库仍不可用：${databaseState.message}`
            : buildStorageInfo("file").message,
        ),
      };
    }

    return {
      ...buildMockDashboardPayload(),
      source: databaseState.configured ? "unavailable" : "demo",
      databaseMessage: databaseState.message,
      storage: buildStorageInfo("none"),
    };
  }

  try {
    const prisma = getPrisma();
    const rows = await withDatabaseTimeout(
      prisma.run.findMany({
        orderBy: { createdAt: "desc" },
        take: RECENT_RUN_LIMIT,
        include: {
          agentConfig: true,
          benchmarkTask: true,
        },
      }),
    );

    const normalizedDatabaseRuns = normalizeRows(
      rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        name: row.name,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        metrics: row.metrics,
        summary: row.summary,
        agentConfig: row.agentConfig,
        benchmarkTask: row.benchmarkTask,
      })),
    );
    const combined = mergeRuns(normalizedDatabaseRuns, normalizedFileRuns);

    if (combined.length === 0) {
      return {
        ...buildMockDashboardPayload(),
        source: "mock",
        databaseMessage: null,
        storage: buildStorageInfo("none"),
      };
    }

    return {
      ...buildDashboardPayload(
        combined,
        normalizedDatabaseRuns.length > 0 ? "database" : "file",
      ),
      databaseMessage: null,
      storage: buildStorageInfo(
        normalizedDatabaseRuns.length > 0 ? "database" : "file",
      ),
    };
  } catch (error) {
    if (normalizedFileRuns.length > 0) {
      const message = formatDatabaseError(error);
      return {
        ...buildDashboardPayload(normalizedFileRuns, "file"),
        databaseMessage: message,
        storage: buildStorageInfo(
          "file",
          `${buildStorageInfo("file").message} 当前数据库仍不可用：${message}`,
        ),
      };
    }

    return {
      ...buildMockDashboardPayload(),
      source: "unavailable",
      databaseMessage: formatDatabaseError(error),
      storage: buildStorageInfo("none"),
    };
  }
}

function normalizeRows(
  rows: Array<Parameters<typeof normalizeDbRun>[0]>,
) {
  return rows
    .map((row) => normalizeDbRun(row))
    .filter((value): value is NonNullable<typeof value> => value !== null);
}

function mergeRuns(
  databaseRuns: ReturnType<typeof normalizeRows>,
  fileRuns: ReturnType<typeof normalizeRows>,
) {
  const deduped = new Map<string, (typeof databaseRuns)[number]>();

  for (const run of [...databaseRuns, ...fileRuns]) {
    if (!deduped.has(run.id)) {
      deduped.set(run.id, run);
    }
  }

  return [...deduped.values()]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, RECENT_RUN_LIMIT);
}
