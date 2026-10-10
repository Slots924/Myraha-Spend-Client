import { addLog } from "./log";
import { getState, patchState } from "./storage";
import type { ProfileInfo } from "./types";

const REFRESH = "adspower-profile-refresh";
const EMPTY_INFO: ProfileInfo = { serialNumber: null, name: null, groupName: null };
let timer: ReturnType<typeof setTimeout> | undefined;
let queue: Promise<void> = Promise.resolve();
let refreshing = false;

function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task).catch(async () => {
    await addLog("error", "Помилка визначення профілю AdsPower");
  });
}

function profileIdFromUrl(value?: string): string | null {
  try {
    const url = new URL(value ?? "");
    if (url.protocol !== "https:" || url.hostname !== "start.adspower.net") return null;
    const id = url.searchParams.get("id")?.trim();
    return id && /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

async function armRefresh(): Promise<void> {
  clearTimeout(timer);
  const { profileRefreshJob: job } = await getState();
  if (!job) {
    await chrome.alarms.clear(REFRESH);
    return;
  }
  // The timer provides the short delay; the persisted job and alarm survive worker suspension.
  await chrome.alarms.create(REFRESH, { when: job.dueAt });
  timer = setTimeout(() => { void refreshInfo(); }, Math.max(0, job.dueAt - Date.now()));
}

async function acceptProfileId(profileId: string): Promise<void> {
  const before = await getState();
  const changed = before.profileId !== profileId;
  await patchState({
    profileId,
    ...(changed ? {
      profileIdUpdatedAt: new Date().toISOString(),
      profileInfo: { ...EMPTY_INFO },
      profileInfoUpdatedAt: null,
      profileInfoError: ""
    } : {})
  });
  if (changed) await addLog("success", before.profileId ? "ID профілю AdsPower оновлено" : "ID профілю AdsPower знайдено");
  const { adspowerRefreshScheduledFor } = await chrome.storage.session.get("adspowerRefreshScheduledFor");
  if (adspowerRefreshScheduledFor === profileId && !changed) return;
  await chrome.storage.session.set({ adspowerRefreshScheduledFor: profileId });
  await patchState({ profileRefreshJob: {
    id: crypto.randomUUID(), profileId, attempt: 0, dueAt: Date.now() + 2_000
  } });
  await armRefresh();
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() :
    typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

async function refreshInfo(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    await requestInfo();
  } catch {
    enqueue(async () => {
      await addLog("error", "Помилка оновлення інформації AdsPower");
      await armRefresh();
    });
  } finally {
    refreshing = false;
  }
}

async function requestInfo(): Promise<void> {
  const { profileRefreshJob: job, profileId } = await getState();
  if (!job) return;
  if (job.profileId !== profileId) {
    await patchState({ profileRefreshJob: null });
    await armRefresh();
    return;
  }
  if (Date.now() < job.dueAt) { await armRefresh(); return; }
  try {
    const url = new URL("http://localhost:50325/api/v1/user/list");
    url.searchParams.set("user_id", job.profileId);
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (body.code !== 0) throw new Error("AdsPower API повернув помилку");
    const profile = Array.isArray(body.data?.list)
      ? body.data.list.find((item: { user_id?: unknown }) => item.user_id === job.profileId) : null;
    if (!profile) throw new Error("Профіль не знайдено у відповіді AdsPower");
    const info: ProfileInfo = {
        serialNumber: optionalText(profile.serial_number),
        name: optionalText(profile.name),
        groupName: optionalText(profile.group_name)
    };
    enqueue(async () => {
      const current = await getState();
      if (current.profileRefreshJob?.id === job.id && current.profileId === job.profileId) {
        await patchState({
          profileInfo: info,
          profileInfoUpdatedAt: new Date().toISOString(),
          profileInfoError: "",
          profileRefreshJob: null
        });
        await addLog("success", "Інформацію профілю AdsPower оновлено");
      }
      await armRefresh();
    });
  } catch (error) {
    const attempt = job.attempt + 1;
    const message = error instanceof Error ? error.message : "Помилка запиту AdsPower";
    enqueue(async () => {
      const current = await getState();
      if (current.profileRefreshJob?.id === job.id && current.profileId === job.profileId) {
        await patchState({
          profileInfoError: message,
          profileRefreshJob: attempt < 5 ? { ...job, attempt, dueAt: Date.now() + 5_000 } : null
        });
        await addLog("error", `Не вдалося отримати інформацію AdsPower (спроба ${attempt}/5)${attempt < 5 ? "; повтор через 5 с" : "; повтор при наступному запуску профілю"}`);
      }
      await armRefresh();
    });
  }
}

async function initialize(): Promise<void> {
  const { adspowerInitialized } = await chrome.storage.session.get("adspowerInitialized");
  if (!adspowerInitialized) {
    await chrome.storage.session.set({ adspowerInitialized: true });
    await patchState({ profileRefreshJob: null });
    await chrome.storage.session.remove("adspowerRefreshScheduledFor");
  }
  const tabs = await chrome.tabs.query({ url: "https://start.adspower.net/*" });
  const ids = new Set(tabs.map(tab => profileIdFromUrl(tab.pendingUrl) ?? profileIdFromUrl(tab.url)).filter((id): id is string => !!id));
  if (ids.size === 1) await acceptProfileId([...ids][0]!);
  else if (ids.size > 1) await addLog("error", "У вкладках AdsPower знайдено різні ID профілів; очікуємо відкриття стартової сторінки");
  else if (!adspowerInitialized) {
    const { profileId } = await getState();
    if (profileId) await acceptProfileId(profileId);
    else await addLog("info", "Шукаємо ID профілю AdsPower");
  }
  await armRefresh();
}

chrome.webNavigation.onBeforeNavigate.addListener(details => {
  if (details.frameId !== 0) return;
  const id = profileIdFromUrl(details.url);
  if (id) enqueue(() => acceptProfileId(id));
}, { url: [{ hostEquals: "start.adspower.net", schemes: ["https"] }] });
chrome.runtime.onStartup.addListener(() => enqueue(initialize));
chrome.runtime.onInstalled.addListener(() => enqueue(initialize));
chrome.alarms.onAlarm.addListener(({ name }) => {
  if (name === REFRESH) void refreshInfo();
});
enqueue(initialize);
