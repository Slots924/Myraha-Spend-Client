export type ChangeState = "changed" | "unchanged" | "missing" | "unavailable";

export interface AppState {
  enabled: boolean;
  installationId: string;
  apiUrl: string;
  clientKey: string;
  token: string;
  tokenFingerprint: string;
  tokenUpdatedAt: string | null;
  cookieFingerprint: string;
  cookieUpdatedAt: string | null;
  lastSyncAt: string | null;
  lastSyncOk: boolean | null;
  retryCount: number;
}

export interface LogEntry {
  id: string;
  at: string;
  level: "info" | "success" | "error";
  message: string;
}

export interface StatusPayload {
  schemaVersion: 1;
  installationId: string;
  extensionVersion: string;
  sentAt: string;
  reason: "install" | "hourly" | "cookie_changed" | "token_changed" | "retry" | "manual";
  enabled: boolean;
  cookies: { state: ChangeState; count: number; lastUpdatedAt: string | null };
  token: { state: ChangeState; lastUpdatedAt: string | null };
}
