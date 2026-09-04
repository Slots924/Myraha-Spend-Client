import { addLog } from "./log";
import { getState, patchState } from "./storage";
import type { StatusPayload } from "./types";

export function endpointOrigin(apiUrl: string): string | null {
  try {
    const url = new URL(apiUrl);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return null;
    return `${url.origin}/*`;
  } catch {
    return null;
  }
}

export async function sendStatus(payload: StatusPayload): Promise<boolean> {
  const { apiUrl, clientKey, enabled } = await getState();
  if (!enabled || !apiUrl) return false;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientKey ? { "X-Client-Key": clientKey } : {})
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await patchState({ lastSyncAt: new Date().toISOString(), lastSyncOk: true, retryCount: 0 });
    await addLog("success", `Дані надіслано успішно (HTTP ${response.status})`);
    return true;
  } catch {
    const { retryCount } = await getState();
    const nextRetry = Math.min(retryCount + 1, 4);
    await patchState({ lastSyncAt: new Date().toISOString(), lastSyncOk: false, retryCount: nextRetry });
    await chrome.alarms.create("sync-retry", { delayInMinutes: Math.min(5 * 2 ** retryCount, 60) });
    await addLog("error", "Не вдалося надіслати дані, спробуємо наступного разу");
    return false;
  }
}
