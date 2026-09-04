import type { AppState, LogEntry } from "./types";

const DEFAULTS: AppState = {
  enabled: true,
  installationId: "",
  apiUrl: import.meta.env.VITE_API_URL ?? "",
  clientKey: import.meta.env.VITE_CLIENT_KEY ?? "",
  token: "",
  tokenFingerprint: "",
  tokenUpdatedAt: null,
  cookieFingerprint: "",
  cookieUpdatedAt: null,
  lastSyncAt: null,
  lastSyncOk: null,
  retryCount: 0
};

export async function getState(): Promise<AppState> {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const state = { ...DEFAULTS, ...stored } as AppState;
  if (!state.installationId) {
    state.installationId = crypto.randomUUID();
    await chrome.storage.local.set({ installationId: state.installationId });
  }
  return state;
}

export async function patchState(patch: Partial<AppState>): Promise<void> {
  await chrome.storage.local.set(patch);
}

export async function getLogs(): Promise<LogEntry[]> {
  const { logs = [] } = await chrome.storage.local.get("logs");
  return logs as LogEntry[];
}

export async function setLogs(logs: LogEntry[]): Promise<void> {
  await chrome.storage.local.set({ logs: logs.slice(-200) });
}
