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

async function acceptToken(token: string, source = "unknown"): Promise<boolean> {
  if (!isAccessToken(token)) return false;
  await patchState({ lastTokenCandidateAt: new Date().toISOString() });
  if (!(await isSearchActive())) return false;

  const before = await getState();
  const tokenFingerprint = await fingerprint(token);
  const changed = token !== before.token;
  await patchState({
    token,
    tokenFingerprint,
    tokenUpdatedAt: changed ? new Date().toISOString() : before.tokenUpdatedAt ?? new Date().toISOString()
  });
  await patchState({ lastTokenSource: source });
  await pauseSearch();
  if (changed) {
    await addLog("success", before.token ? "Токен оновлено зі сторінки вайтліста" : "Токен знайдено на сторінці вайтліста");
    await checkAndSync("token_changed");
  }
  return true;
}

async function snapshotUserAgent(before: Awaited<ReturnType<typeof getState>>): Promise<{
  state: ChangeState;
  value: string | null;
  lastUpdatedAt: string | null;
}> {
  // AdsPower overrides the page UA, not necessarily the extension service worker UA.
  // The page script reports the profile UA when a Facebook tab is opened.
  const value = before.userAgent || "";
  const uaFingerprint = await fingerprint(value);
  const state: ChangeState = !value ? "missing" : uaFingerprint === before.userAgentFingerprint ? "unchanged" : "changed";
  let lastUpdatedAt = before.userAgentUpdatedAt;
  if (state === "changed" || (!before.userAgentFingerprint && value)) {
    lastUpdatedAt = new Date().toISOString();
    await patchState({ userAgent: value, userAgentFingerprint: uaFingerprint, userAgentUpdatedAt: lastUpdatedAt });
    if (before.userAgentFingerprint) await addLog("info", "User-Agent оновлено");
  }
  return { state, value: value || null, lastUpdatedAt };
}

async function checkAndSync(reason: SyncReason, force = false): Promise<boolean> {
  const before = await getState();
  if (!before.enabled && !force) return false;

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
      await patchState({ cookieFingerprint: snapshot.fingerprint, cookieUpdatedAt, lastCookieError: "" });
      await addLog("success", before.cookieFingerprint ? "Facebook cookie оновилися" : "Facebook cookie отримано");
    } else {
      await patchState({ lastCookieError: "" });
    }
  } catch (error) {
    await patchState({ lastCookieError: error instanceof Error ? error.message : String(error) });
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

  const userAgent = await snapshotUserAgent(current);
  const payload: StatusPayload = {
    schemaVersion: 3,
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
    },
    userAgent
  };
  return sendStatus(payload, force);
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
  if (token) await acceptToken(token, "webRequest");
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

chrome.runtime.onMessage.addListener((message: { type?: string; token?: string; userAgent?: string; url?: string; source?: string }, _sender, sendResponse) => {
  if (message.type === "page-context") {
    void (async () => {
      const userAgent = message.userAgent?.trim() ?? "";
      const url = message.url ?? "";
      const now = new Date().toISOString();
      const before = await getState();
      const uaChanged = Boolean(userAgent) && userAgent !== before.userAgent;
      const urlChanged = Boolean(url) && url !== before.lastPageUrl;
      await patchState({
        ...(uaChanged
          ? {
              userAgent,
              userAgentFingerprint: await fingerprint(userAgent),
              userAgentUpdatedAt: now,
              userAgentSource: "page" as const
            }
          : {}),
        lastPageUrl: url,
        lastPageSeenAt: now
      });
      if (uaChanged) await addLog("info", "User-Agent зчитано зі сторінки профілю");
      else if (urlChanged) await addLog("info", "Facebook-сторінка оновилася");
      sendResponse({ ok: true });
    })().catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message.type === "search-status") {
    isSearchActive().then((active) => sendResponse({ active, prefixes: TOKEN_PAGE_WHITELIST })).catch(() => sendResponse({ active: false, prefixes: TOKEN_PAGE_WHITELIST }));
    return true;
  }
  if (message.type === "token-found" && message.token) {
    acceptToken(message.token, message.source ?? "page").then((ok) => sendResponse({ ok })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message.type !== "manual-sync") return;
  checkAndSync("manual", true).then((ok) => sendResponse({ ok: !!ok })).catch(() => sendResponse({ ok: false }));
  return true;
});

ensureAlarm();
