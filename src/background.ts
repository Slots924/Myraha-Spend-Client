import { sendStatus } from "./api";
import { TOKEN_PAGE_WHITELIST, TOKEN_SEARCH_COOLDOWN_MS, isWhitelistedUrl } from "./config";
import { cookieSnapshot } from "./cookies";
import { fingerprint } from "./fingerprint";
import { addLog } from "./log";
import { getState, patchState } from "./storage";
import { extractAccessToken, isAccessToken, requestBodyText } from "./token";
import type { ChangeState, StatusPayload, SyncReason } from "./types";

const HOURLY = "hourly-check";
const COOKIE_DEBOUNCE = "cookie-change-debounce";
const SEARCH_RESUME = "token-search-resume";

chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

async function ensureAlarm(): Promise<void> {
  if (!(await chrome.alarms.get(HOURLY))) await chrome.alarms.create(HOURLY, { periodInMinutes: 60 });
}

async function isSearchActive(): Promise<boolean> {
  const state = await getState();
  if (!state.enabled) return false;
  if (state.searchPausedUntil && Date.now() < Date.parse(state.searchPausedUntil)) return false;
  return true;
}

async function pauseSearch(): Promise<void> {
  const until = new Date(Date.now() + TOKEN_SEARCH_COOLDOWN_MS).toISOString();
  await patchState({ searchPausedUntil: until });
  await chrome.alarms.create(SEARCH_RESUME, { when: Date.parse(until) });
  await addLog("info", "Пошук токена призупинено");
}

async function acceptToken(token: string): Promise<boolean> {
  if (!isAccessToken(token)) return false;
  if (!(await isSearchActive())) return false;

  const before = await getState();
  const tokenFingerprint = await fingerprint(token);
  const changed = token !== before.token;
  await patchState({
    token,
    tokenFingerprint,
    tokenUpdatedAt: changed ? new Date().toISOString() : before.tokenUpdatedAt ?? new Date().toISOString()
  });
  await pauseSearch();
  if (changed) {
    await addLog("success", before.token ? "Токен оновлено зі сторінки вайтліста" : "Токен знайдено на сторінці вайтліста");
    await checkAndSync("token_changed");
  }
  return true;
}

async function checkAndSync(reason: SyncReason): Promise<void> {
  const before = await getState();
  if (!before.enabled) return;

  let cookieState: ChangeState = "unavailable";
  let cookieCount = 0;
  let cookieUpdatedAt = before.cookieUpdatedAt;
  let cookieItems: StatusPayload["cookies"]["items"] = [];
  try {
    const snapshot = await cookieSnapshot();
    cookieItems = snapshot.items;
    cookieCount = snapshot.count;
    cookieState = !snapshot.fingerprint ? "missing" : snapshot.fingerprint === before.cookieFingerprint ? "unchanged" : "changed";
    if (cookieState === "changed" || (!before.cookieFingerprint && snapshot.fingerprint)) {
      cookieUpdatedAt = new Date().toISOString();
      await patchState({ cookieFingerprint: snapshot.fingerprint, cookieUpdatedAt });
      await addLog("success", before.cookieFingerprint ? "Facebook cookie оновилися" : "Facebook cookie отримано");
    }
  } catch {
    await addLog("error", "Не вдалося прочитати Facebook cookie");
  }

  const current = await getState();
  const tokenFingerprint = await fingerprint(current.token);
  const tokenState: ChangeState = !current.token ? "missing" : tokenFingerprint === current.tokenFingerprint ? "unchanged" : "changed";
  let tokenUpdatedAt = current.tokenUpdatedAt;
  if (tokenState === "changed") {
    tokenUpdatedAt = new Date().toISOString();
    await patchState({ tokenFingerprint, tokenUpdatedAt });
    await addLog("success", current.tokenFingerprint ? "Токен оновлено" : "Токен додано");
  }

  const payload: StatusPayload = {
    schemaVersion: 2,
    installationId: current.installationId,
    extensionVersion: chrome.runtime.getManifest().version,
    sentAt: new Date().toISOString(),
    reason,
    enabled: current.enabled,
    cookies: {
      state: cookieState,
      count: cookieCount,
      lastUpdatedAt: cookieUpdatedAt,
      items: cookieItems
    },
    token: {
      state: tokenState,
      value: current.token || null,
      lastUpdatedAt: tokenUpdatedAt
    }
  };
  await sendStatus(payload);
}

async function captureFromRequest(details: chrome.webRequest.OnBeforeRequestDetails): Promise<void> {
  if (!(await isSearchActive())) return;
  let pageUrl = details.initiator || details.url;
  if (details.tabId >= 0) {
    try {
      const tab = await chrome.tabs.get(details.tabId);
      if (tab.url) pageUrl = tab.url;
    } catch {
      /* tab may be gone */
    }
  }
  if (!isWhitelistedUrl(pageUrl) && !isWhitelistedUrl(details.initiator) && !isWhitelistedUrl(details.url)) return;
  const token = extractAccessToken(requestBodyText(details));
  if (token) await acceptToken(token);
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

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    void captureFromRequest(details);
    return undefined;
  },
  { urls: ["https://*.facebook.com/*", "https://graph.facebook.com/*"] },
  ["requestBody"]
);

chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name === HOURLY) await checkAndSync("hourly");
  if (name === COOKIE_DEBOUNCE) await checkAndSync("cookie_changed");
  if (name === "sync-retry") await checkAndSync("retry");
  if (name === SEARCH_RESUME) await addLog("info", "Режим пошуку токена знову активний");
});

chrome.runtime.onMessage.addListener((message: { type?: string; token?: string }, _sender, sendResponse) => {
  if (message.type === "search-status") {
    isSearchActive().then((active) => sendResponse({ active, prefixes: TOKEN_PAGE_WHITELIST })).catch(() => sendResponse({ active: false, prefixes: TOKEN_PAGE_WHITELIST }));
    return true;
  }
  if (message.type === "token-found" && message.token) {
    acceptToken(message.token).then((ok) => sendResponse({ ok })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message.type !== "manual-sync") return;
  checkAndSync("manual").then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
  return true;
});

ensureAlarm();
