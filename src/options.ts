import { endpointOrigin } from "./api";
import { readFacebookCookies } from "./cookies";
import { addLog } from "./log";
import { getLogs, getState, patchState, setLogs } from "./storage";

const token = document.querySelector<HTMLInputElement>("#token")!;
const apiUrl = document.querySelector<HTMLInputElement>("#api-url")!;
const clientKey = document.querySelector<HTMLInputElement>("#client-key")!;

function formatDate(value: string | null): string { return value ? new Date(value).toLocaleString("uk-UA") : "Ще не оновлювалося"; }

async function renderLogs(): Promise<void> {
  const logs = (await getLogs()).reverse();
  document.querySelector("#logs")!.innerHTML = logs.map((log) => `<div class="log ${log.level}"><time>${new Date(log.at).toLocaleString("uk-UA")}</time><span>${log.message}</span></div>`).join("") || "<p class='muted'>Логів поки немає</p>";
}

async function render(): Promise<void> {
  const state = await getState();
  token.value = state.token; apiUrl.value = state.apiUrl; clientKey.value = state.clientKey;
  document.querySelector("#token-date")!.textContent = `Останнє оновлення: ${formatDate(state.tokenUpdatedAt)}`;
  document.querySelector("#cookie-date")!.textContent = `Остання зміна: ${formatDate(state.cookieUpdatedAt)}`;
  await renderLogs();
}

document.querySelector("#reveal-token")!.addEventListener("click", () => { token.type = token.type === "password" ? "text" : "password"; });
document.querySelector("#load-cookies")!.addEventListener("click", async () => {
  const box = document.querySelector("#cookies")!;
  try {
    const cookies = await readFacebookCookies();
    box.textContent = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("\n") || "Cookie не знайдено";
  } catch { box.textContent = "Не вдалося прочитати cookie"; }
});
document.querySelector("#save")!.addEventListener("click", async () => {
  const origin = endpointOrigin(apiUrl.value.trim());
  const result = document.querySelector("#save-result")!;
  if (apiUrl.value.trim() && !origin) { result.textContent = "Некоректний або незахищений URL"; return; }
  if (origin && !(await chrome.permissions.contains({ origins: [origin] }))) {
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) { result.textContent = "Chrome не надав доступ до адреси"; return; }
  }
  const before = await getState();
  await patchState({ token: token.value.trim(), apiUrl: apiUrl.value.trim(), clientKey: clientKey.value.trim() });
  if (before.token !== token.value.trim()) await addLog("info", token.value.trim() ? "Користувач змінив локальний токен" : "Користувач видалив локальний токен");
  result.textContent = "Збережено"; await chrome.runtime.sendMessage({ type: "manual-sync" }); await render();
});
document.querySelector("#clear-logs")!.addEventListener("click", async () => { await setLogs([]); await renderLogs(); });
render();
