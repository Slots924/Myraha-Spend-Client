import { sendStatus } from "./api";
import { cookieSnapshot } from "./cookies";
import { fingerprint } from "./fingerprint";
import { addLog } from "./log";
import { getState, patchState } from "./storage";
import type { ChangeState, StatusPayload } from "./types";

const HOURLY = "hourly-check";
const COOKIE_DEBOUNCE = "cookie-change-debounce";

chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

async function ensureAlarm(): Promise<void> {
  if (!(await chrome.alarms.get(HOURLY))) await chrome.alarms.create(HOURLY, { periodInMinutes: 60 });
}

async function checkAndSync(reason: StatusPayload["reason"]): Promise<void> {
  const before = await getState();
  if (!before.enabled) return;

  let cookieState: ChangeState = "unavailable";
  let cookieCount = 0;
  let cookieUpdatedAt = before.cookieUpdatedAt;
  try {
    const snapshot = await cookieSnapshot();
    cookieCount = snapshot.count;
    cookieState = !snapshot.fingerprint ? "missing" : snapshot.fingerprint === before.cookieFingerprint ? "unchanged" : "changed";
    if (cookieState === "changed" || (!before.cookieFingerprint && snapshot.fingerprint)) {
      cookieUpdatedAt = new Date().toISOString();
      await patchState({ cookieFingerprint: snapshot.fingerprint, cookieUpdatedAt });
      await addLog("success", before.cookieFingerprint ? "Facebook cookie оновилися" : "Facebook cookie отримано");
    }
  } catch {
    await addLog("error", "Не вдалося перевірити Facebook cookie");
  }

  const current = await getState();
  const tokenFingerprint = await fingerprint(current.token);
  const tokenState: ChangeState = !current.token ? "missing" : tokenFingerprint === current.tokenFingerprint ? "unchanged" : "changed";
  let tokenUpdatedAt = current.tokenUpdatedAt;
  if (tokenState === "changed") {
    tokenUpdatedAt = new Date().toISOString();
    await patchState({ tokenFingerprint, tokenUpdatedAt });
    await addLog("success", current.tokenFingerprint ? "Локальний токен оновлено" : "Локальний токен додано");
  }

  const payload: StatusPayload = {
    schemaVersion: 1,
    installationId: current.installationId,
    extensionVersion: chrome.runtime.getManifest().version,
    sentAt: new Date().toISOString(),
    reason,
    enabled: current.enabled,
    cookies: { state: cookieState, count: cookieCount, lastUpdatedAt: cookieUpdatedAt },
    token: { state: tokenState, lastUpdatedAt: tokenUpdatedAt }
  };
  await sendStatus(payload);
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await ensureAlarm();
  if (reason === "install") {
    await addLog("info", "Розширення встановлено");
    await checkAndSync("install");
  }
});

chrome.runtime.onStartup.addListener(ensureAlarm);
chrome.cookies.onChanged.addListener(async ({ cookie }) => {
  if (!cookie.domain.endsWith("facebook.com")) return;
  await chrome.alarms.clear(COOKIE_DEBOUNCE);
  await chrome.alarms.create(COOKIE_DEBOUNCE, { delayInMinutes: 0.5 });
});

chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name === HOURLY) await checkAndSync("hourly");
  if (name === COOKIE_DEBOUNCE) await checkAndSync("cookie_changed");
  if (name === "sync-retry") await checkAndSync("retry");
});

chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
  if (message.type !== "manual-sync") return;
  checkAndSync("manual").then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
  return true;
});

ensureAlarm();
