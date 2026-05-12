import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  AgentMode,
  RunStatus,
  type ToolCallStatus,
} from "@prisma/client";

import {
  buildStorageInfo,
  type StorageInfo,
} from "@/lib/persistence/state";

const FILE_STORE_VERSION = 1;
const MAX_STORED_RUNS = 400;

export type FileStoredRun = {
  id: string;
  name: string;
  status: RunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  input: unknown;
  output: unknown;
  summary: unknown;
  metrics: unknown;
  agentConfig: {
    id: string;
    name: string;
    mode: AgentMode;
    model: string;
    systemPrompt: string;
    enabledTools: unknown;
    toolConfig: unknown;
    metadata: unknown;
    createdAt: string;
  };
  benchmarkTask: {
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    difficulty: number;
    conversation: unknown;
    evaluationRubric: unknown;
    expectedTools: unknown;
    toolConfig: unknown;
    createdAt: string;
  } | null;
  toolCalls: Array<{
    id: string;
    sequence: number;
    toolName: string;
    status: ToolCallStatus;
    input: unknown;
    output: unknown;
    error: unknown;
    latencyMs: number | null;
    createdAt: string;
  }>;
};

type FileStore = {
  version: number;
  updatedAt: string;
  runs: FileStoredRun[];
};

export type PersistRunRecordInput = {
  id: string;
  name: string;
  status: RunStatus;
  createdAt?: Date | string;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  input: unknown;
  output: unknown;
  summary: unknown;
  metrics: unknown;
  agentConfig: {
    name: string;
    mode: AgentMode;
    model: string;
    systemPrompt: string;
    enabledTools: unknown;
    toolConfig?: unknown;
    metadata?: unknown;
  };
  benchmarkTask?: {
    slug: string;
    title: string;
    description: string;
    category: string;
    difficulty: number;
    conversation: unknown;
    evaluationRubric: unknown;
    expectedTools: unknown;
    toolConfig?: unknown;
  } | null;
  toolCalls: Array<{
    sequence: number;
    toolName: string;
    status: ToolCallStatus;
    input: unknown;
    output: unknown;
    error: unknown;
    latencyMs: number | null;
  }>;
};

let fileStoreWriteQueue: Promise<void> = Promise.resolve();

function getFileStoreDir() {
  return process.env.VERCEL === "1"
    ? "/tmp/specagent-lab"
    : path.join(process.cwd(), ".specagent-lab");
}

function getFileStorePath() {
  return path.join(getFileStoreDir(), "runs.v1.json");
}

function emptyStore(): FileStore {
  return {
    version: FILE_STORE_VERSION,
    updatedAt: new Date(0).toISOString(),
    runs: [],
  };
}

function toIso(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function toSerializable(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null)) as unknown;
}

async function ensureStoreDir() {
  await mkdir(getFileStoreDir(), { recursive: true });
}

async function readStore(): Promise<FileStore> {
  try {
    const raw = await readFile(getFileStorePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<FileStore>;

    if (!Array.isArray(parsed.runs)) {
      return emptyStore();
    }

    return {
      version: FILE_STORE_VERSION,
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date(0).toISOString(),
      runs: parsed.runs.filter(
        (run): run is FileStoredRun =>
          Boolean(
            run &&
              typeof run === "object" &&
              typeof run.id === "string" &&
              typeof run.name === "string",
          ),
      ),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyStore();
    }

    console.error("Failed to read file-backed run store", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return emptyStore();
  }
}

async function writeStore(store: FileStore) {
  await ensureStoreDir();
  const targetPath = getFileStorePath();
  const tempPath = `${targetPath}.tmp`;
  await writeFile(tempPath, JSON.stringify(store, null, 2), "utf8");
  await rename(tempPath, targetPath);
}

async function withWriteLock<T>(work: () => Promise<T>): Promise<T> {
  const pending = fileStoreWriteQueue.then(work, work);
  fileStoreWriteQueue = pending.then(
    () => undefined,
    () => undefined,
  );
  return pending;
}

function trimRuns(runs: FileStoredRun[]) {
  return [...runs]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, MAX_STORED_RUNS);
}

function buildFileStoredRun(input: PersistRunRecordInput): FileStoredRun {
  const createdAt = toIso(input.createdAt ?? new Date()) ?? new Date().toISOString();
  const runId = input.id;

  return {
    id: runId,
    name: input.name,
    status: input.status,
    createdAt,
    startedAt: toIso(input.startedAt),
    finishedAt: toIso(input.finishedAt),
    input: toSerializable(input.input),
    output: toSerializable(input.output),
    summary: toSerializable(input.summary),
    metrics: toSerializable(input.metrics),
    agentConfig: {
      id: `cfg_${runId}`,
      name: input.agentConfig.name,
      mode: input.agentConfig.mode,
      model: input.agentConfig.model,
      systemPrompt: input.agentConfig.systemPrompt,
      enabledTools: toSerializable(input.agentConfig.enabledTools),
      toolConfig: toSerializable(input.agentConfig.toolConfig),
      metadata: toSerializable(input.agentConfig.metadata),
      createdAt,
    },
    benchmarkTask: input.benchmarkTask
      ? {
          id: `task_${input.benchmarkTask.slug}`,
          slug: input.benchmarkTask.slug,
          title: input.benchmarkTask.title,
          description: input.benchmarkTask.description,
          category: input.benchmarkTask.category,
          difficulty: input.benchmarkTask.difficulty,
          conversation: toSerializable(input.benchmarkTask.conversation),
          evaluationRubric: toSerializable(input.benchmarkTask.evaluationRubric),
          expectedTools: toSerializable(input.benchmarkTask.expectedTools),
          toolConfig: toSerializable(input.benchmarkTask.toolConfig),
          createdAt,
        }
      : null,
    toolCalls: input.toolCalls.map((toolCall) => ({
      id: `tc_${runId}_${toolCall.sequence}`,
      sequence: toolCall.sequence,
      toolName: toolCall.toolName,
      status: toolCall.status,
      input: toSerializable(toolCall.input),
      output: toSerializable(toolCall.output),
      error: toSerializable(toolCall.error),
      latencyMs: toolCall.latencyMs,
      createdAt,
    })),
  };
}

export async function persistRunRecordToFile(
  input: PersistRunRecordInput,
): Promise<{
  runId: string;
  storage: StorageInfo;
}> {
  const record = buildFileStoredRun(input);

  await withWriteLock(async () => {
    const store = await readStore();
    const remaining = store.runs.filter((run) => run.id !== record.id);
    store.runs = trimRuns([record, ...remaining]);
    store.updatedAt = new Date().toISOString();
    await writeStore(store);
  });

  return {
    runId: record.id,
    storage: buildStorageInfo("file"),
  };
}

export async function listFileRuns(limit = 250): Promise<FileStoredRun[]> {
  const store = await readStore();
  return [...store.runs]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, limit);
}

export async function getFileRunById(id: string): Promise<FileStoredRun | null> {
  const store = await readStore();
  return store.runs.find((run) => run.id === id) ?? null;
}

function toDate(value: string) {
  return new Date(value);
}

function toNullableDate(value: string | null) {
  return value ? new Date(value) : null;
}

export function toDashboardRunRow(run: FileStoredRun) {
  return {
    id: run.id,
    name: run.name,
    createdAt: toDate(run.createdAt),
    startedAt: toNullableDate(run.startedAt),
    finishedAt: toNullableDate(run.finishedAt),
    metrics: run.metrics,
    summary: run.summary,
    agentConfig: {
      mode: run.agentConfig.mode,
    },
    benchmarkTask: run.benchmarkTask
      ? {
          category: run.benchmarkTask.category,
          difficulty: run.benchmarkTask.difficulty,
        }
      : null,
  };
}

export function toRunDetailRow(run: FileStoredRun) {
  return {
    id: run.id,
    name: run.name,
    status: run.status,
    createdAt: toDate(run.createdAt),
    startedAt: toNullableDate(run.startedAt),
    finishedAt: toNullableDate(run.finishedAt),
    input: run.input,
    output: run.output,
    summary: run.summary,
    metrics: run.metrics,
    agentConfig: {
      mode: run.agentConfig.mode,
      model: run.agentConfig.model,
      name: run.agentConfig.name,
    },
    benchmarkTask: run.benchmarkTask
      ? {
          title: run.benchmarkTask.title,
          category: run.benchmarkTask.category,
          difficulty: run.benchmarkTask.difficulty,
        }
      : null,
    toolCalls: run.toolCalls.map((toolCall) => ({
      id: toolCall.id,
      sequence: toolCall.sequence,
      toolName: toolCall.toolName,
      status: toolCall.status,
      latencyMs: toolCall.latencyMs,
      input: toolCall.input,
      output: toolCall.output,
      error: toolCall.error,
    })),
  };
}
