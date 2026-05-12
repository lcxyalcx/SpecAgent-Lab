import { PrismaClient } from "@prisma/client";

import {
  buildDatabaseState,
  type DatabaseState,
} from "@/lib/database-state";
import { isDatabaseConfigured } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const DATABASE_STATE_TTL_MS = 15_000;
const DATABASE_OPERATION_TIMEOUT_MS = 3_000;

let databaseStateCache:
  | {
      state: DatabaseState;
      expiresAt: number;
    }
  | undefined;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Add a PostgreSQL connection string in .env locally or in your Vercel project environment variables.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

export class DatabaseUnavailableError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "DATABASE_URL is configured, but the database is currently unavailable.",
    );
    this.name = "DatabaseUnavailableError";
  }
}

export function getPrisma(): PrismaClient {
  if (!isDatabaseConfigured()) {
    throw new DatabaseNotConfiguredError();
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }

  return globalForPrisma.prisma;
}

export async function getDatabaseState(options?: {
  force?: boolean;
}): Promise<DatabaseState> {
  if (!isDatabaseConfigured()) {
    return buildDatabaseState(
      "not_configured",
      "当前尚未配置 DATABASE_URL，因此运行结果无法持久化。",
    );
  }

  const now = Date.now();

  if (
    !options?.force &&
    databaseStateCache &&
    databaseStateCache.expiresAt > now
  ) {
    return databaseStateCache.state;
  }

  try {
    const prisma = getPrisma();
    await withDatabaseTimeout(prisma.$queryRaw`SELECT 1`);

    const state = buildDatabaseState("ready");
    databaseStateCache = {
      state,
      expiresAt: now + DATABASE_STATE_TTL_MS,
    };
    return state;
  } catch (error) {
    const state = buildDatabaseState(
      "unavailable",
      formatDatabaseError(error),
    );
    databaseStateCache = {
      state,
      expiresAt: now + DATABASE_STATE_TTL_MS,
    };
    return state;
  }
}

export function resetDatabaseStateCache() {
  databaseStateCache = undefined;
}

export async function withDatabaseTimeout<T>(
  operation: Promise<T>,
  timeoutMs = DATABASE_OPERATION_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => {
        reject(
          new DatabaseUnavailableError(
            `Database operation timed out after ${timeoutMs}ms.`,
          ),
        );
      }, timeoutMs);

      operation.then(resolve).catch(reject);
    });
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function formatDatabaseError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const unreachableMatch = message.match(
    /Can't reach database server at `([^`]+)`/,
  );
  if (unreachableMatch) {
    return `已检测到 DATABASE_URL，但当前无法连接到数据库服务器 ${unreachableMatch[1]}。请确认数据库实例已启动，并且当前连接串可从应用运行环境访问。`;
  }

  if (/authentication/i.test(message) || /password/i.test(message)) {
    return "已检测到 DATABASE_URL，但数据库认证失败。请检查连接串中的用户名、密码和访问权限。";
  }

  if (/DATABASE_URL is not set/i.test(message)) {
    return "当前尚未配置 DATABASE_URL，因此运行结果无法持久化。";
  }

  if (/timed out after \d+ms/i.test(message)) {
    return "已检测到 DATABASE_URL，但数据库连接在超时时间内没有响应。系统会尽快回退到本地文件存储，请同时检查数据库网络和实例状态。";
  }

  return "已检测到 DATABASE_URL，但当前无法读取数据库。请确认数据库服务可达，并检查连接串、网络权限和迁移状态。";
}
