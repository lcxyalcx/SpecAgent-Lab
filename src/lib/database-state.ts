export type DatabaseStatus = "ready" | "not_configured" | "unavailable";

export type DatabaseState = {
  status: DatabaseStatus;
  configured: boolean;
  available: boolean;
  message: string | null;
};

export function buildDatabaseState(
  status: DatabaseStatus,
  message: string | null = null,
): DatabaseState {
  return {
    status,
    configured: status !== "not_configured",
    available: status === "ready",
    message,
  };
}

export function isDatabaseReady(state: DatabaseState | null | undefined) {
  return state?.status === "ready";
}
