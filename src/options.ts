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
  document.querySelector("#logs")!.innerHTML = logs.map((log) =>
    `<div class="log ${log.level}"><time>${new Date(log.at).toLocaleString("uk-UA")}</time><span>${log.message}</span></div>`
  ).join("") || "<p class='muted'>Логів поки немає</p>";
}

async function render(): Promise<void> {
  const state = await getState();
  apiUrl.value = state.apiUrl;
  clientKey.value = state.clientKey;
  document.querySelector("#search-status")!.textContent = searchLabel(state.searchPausedUntil, state.enabled);
  document.querySelector("#token-date")!.textContent = state.token
    ? `Токен є. Останнє оновлення: ${formatDate(state.tokenUpdatedAt)}`
    : "Токен ще не знайдений";
  document.querySelector("#cooldown")!.textContent =
    `Після знахідки пошук вимикається на ${TOKEN_SEARCH_COOLDOWN_MINUTES} хв (VITE_TOKEN_SEARCH_COOLDOWN_MINUTES).`;
  document.querySelector("#whitelist")!.textContent = TOKEN_PAGE_WHITELIST.join("\n");
  document.querySelector("#cookie-date")!.textContent = `Остання зміна: ${formatDate(state.cookieUpdatedAt)}`;
  await renderLogs();
}

document.querySelector("#load-cookies")!.addEventListener("click", async () => {
  const box = document.querySelector("#cookies")!;
  try {
    const cookies = await readFacebookCookies();
    box.textContent = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("\n") || "Cookie не знайдено";
  } catch {
    box.textContent = "Не вдалося прочитати cookie";
  }
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

document.querySelector("#clear-logs")!.addEventListener("click", async () => { await setLogs([]); await renderLogs(); });
render();
