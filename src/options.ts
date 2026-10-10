import { endpointOrigin } from "./api";
import { TOKEN_PAGE_WHITELIST, TOKEN_SEARCH_COOLDOWN_MINUTES } from "./config";
import { readFacebookCookies } from "./cookies";
import { getLogs, getState, patchState, setLogs } from "./storage";

const apiUrl = document.querySelector<HTMLInputElement>("#api-url")!;
const clientKey = document.querySelector<HTMLInputElement>("#client-key")!;

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("uk-UA") : "Ще не оновлювалося";
}

function searchLabel(pausedUntil: string | null, on: boolean): string {
  if (!on) return "Пошук вимкнено разом із розширенням";
  if (pausedUntil && Date.now() < Date.parse(pausedUntil)) {
    return `Пауза до ${new Date(pausedUntil).toLocaleString("uk-UA")}`;
  }
  return "Режим пошуку активний: чекаємо сторінку з вайтліста";
}

async function renderLogs(): Promise<void> {
  const logs = (await getLogs()).reverse();
  const box = document.querySelector("#logs")!;
  const scrollTop = box.scrollTop;
  box.replaceChildren();
  for (const log of logs) {
    const row = document.createElement("div");
    row.className = `log ${log.level}`;
    const time = document.createElement("time");
    time.textContent = new Date(log.at).toLocaleString("uk-UA");
    const message = document.createElement("span");
    message.textContent = log.message;
    message.title = log.message;
    row.append(time, message);
    box.append(row);
  }
  if (!logs.length) box.textContent = "Логів поки немає";
  box.scrollTop = scrollTop;
}

async function render(updateInputs = false): Promise<void> {
  const state = await getState();
  if (updateInputs) {
    apiUrl.value = state.apiUrl;
    clientKey.value = state.clientKey;
  }
  document.querySelector("#profile-id")!.textContent = state.profileId || "Шукаємо…";
  document.querySelector("#profile-number")!.textContent = state.profileInfo.serialNumber ?? "—";
  document.querySelector("#profile-name")!.textContent = state.profileInfo.name ?? "—";
  document.querySelector("#profile-group")!.textContent = state.profileInfo.groupName ?? "—";
  document.querySelector("#profile-date")!.textContent = `Останнє оновлення: ${formatDate(state.profileInfoUpdatedAt)}`;
  document.querySelector("#profile-error")!.textContent = state.profileInfoError
    ? `Не вдалося оновити: ${state.profileInfoError}` : "";
  document.querySelector("#search-status")!.textContent = searchLabel(state.searchPausedUntil, state.enabled);
  document.querySelector("#token-date")!.textContent = state.token
    ? `Токен є. Останнє оновлення: ${formatDate(state.tokenUpdatedAt)}`
    : "Токен ще не знайдений";
  document.querySelector("#cooldown")!.textContent =
    `Після знахідки пошук вимикається на ${TOKEN_SEARCH_COOLDOWN_MINUTES} хв (VITE_TOKEN_SEARCH_COOLDOWN_MINUTES).`;
  document.querySelector("#whitelist")!.textContent = TOKEN_PAGE_WHITELIST.join("\n");
  document.querySelector("#cookie-date")!.textContent = `Остання зміна: ${formatDate(state.cookieUpdatedAt)}`;
  document.querySelector("#ua-date")!.textContent = state.userAgent
    ? `User-Agent є. Останнє оновлення: ${formatDate(state.userAgentUpdatedAt)}`
    : "User-Agent ще не знімали";
  await renderLogs();
}

document.querySelector("#show-diagnostics")!.addEventListener("click", async () => {
  const box = document.querySelector<HTMLPreElement>("#diagnostics")!;
  const state = await getState();
  let cookieText: string;
  try {
    const cookies = await readFacebookCookies();
    cookieText = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("\n") || "Cookie не знайдено";
  } catch {
    cookieText = "Не вдалося прочитати cookie";
  }
  box.hidden = false;
  box.textContent = [
    `User-Agent (${state.userAgentSource || "ще не отримано"}):`, state.userAgent || "—",
    "", "Access token:", state.token || "—",
    "", "Facebook cookie:", cookieText,
    "", "Стан:",
    `Остання Facebook-сторінка: ${state.lastPageUrl || "—"}`,
    `Сторінку бачили: ${formatDate(state.lastPageSeenAt)}`,
    `Токен отримано з: ${state.lastTokenSource || "—"}`,
    `Кандидат токена бачили: ${formatDate(state.lastTokenCandidateAt)}`,
    `Cookies оновлено: ${formatDate(state.cookieUpdatedAt)}`,
    `Помилка cookies: ${state.lastCookieError || "—"}`
  ].join("\n");
});

document.querySelector("#save")!.addEventListener("click", async () => {
  const origin = endpointOrigin(apiUrl.value.trim());
  const result = document.querySelector("#save-result")!;
  if (apiUrl.value.trim() && !origin) { result.textContent = "Некоректний або незахищений URL"; return; }
  if (origin && !(await chrome.permissions.contains({ origins: [origin] }))) {
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) { result.textContent = "Chrome не надав доступ до адреси"; return; }
  }
  await patchState({ apiUrl: apiUrl.value.trim(), clientKey: clientKey.value.trim() });
  result.textContent = "Збережено";
  await chrome.runtime.sendMessage({ type: "manual-sync" });
  await render();
});

document.querySelector("#debug-send")!.addEventListener("click", async () => {
  const result = document.querySelector("#save-result")!;
  const origin = endpointOrigin(apiUrl.value.trim());
  if (apiUrl.value.trim() && origin && !(await chrome.permissions.contains({ origins: [origin] }))) {
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) { result.textContent = "Chrome не надав доступ до адреси"; return; }
  }
  result.textContent = "Надсилаю…";
  const response = await chrome.runtime.sendMessage({ type: "manual-sync" }) as { ok?: boolean };
  result.textContent = response?.ok ? "Відправлено cookie, токен і user-agent" : "Не вдалося, спробуємо наступного разу";
  await render();
});

document.querySelector("#clear-logs")!.addEventListener("click", async () => { await setLogs([]); await renderLogs(); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (Object.keys(changes).every(key => key === "logs")) void renderLogs();
  else void render();
});
render(true);
