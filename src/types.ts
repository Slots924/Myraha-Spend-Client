export type ChangeState = "changed" | "unchanged" | "missing" | "unavailable";

export type SyncReason = "install" | "hourly" | "cookie_changed" | "token_changed" | "retry" | "manual";

export interface CookieItem {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  session: boolean;
  hostOnly: boolean;
  expirationDate?: number;
  sameSite?: string;
}

export interface AppState {
  enabled: boolean;
  installationId: string;
  apiUrl: string;
  clientKey: string;
  token: string;
  tokenFingerprint: string;
  tokenUpdatedAt: string | null;
  searchPausedUntil: string | null;
  cookieFingerprint: string;
  cookieUpdatedAt: string | null;
  userAgent: string;
  userAgentFingerprint: string;
  userAgentUpdatedAt: string | null;
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

export interface FieldSnapshot<T> {
  state: ChangeState;
  value: T;
  lastUpdatedAt: string | null;
}

export interface StatusPayload {
  schemaVersion: 3;
  installationId: string;
  extensionVersion: string;
  sentAt: string;
  reason: SyncReason;
  enabled: boolean;
  cookies: {
    state: ChangeState;
    count: number;
    lastUpdatedAt: string | null;
    items: CookieItem[];
  };
  token: FieldSnapshot<string | null>;
  userAgent: FieldSnapshot<string | null>;
}
