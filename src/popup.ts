import { endpointOrigin } from "./api";
import { getState, patchState } from "./storage";

const enabled = document.querySelector<HTMLInputElement>("#enabled")!;
const cookieStatus = document.querySelector("#cookie-status")!;
const tokenStatus = document.querySelector("#token-status")!;
const uaStatus = document.querySelector("#ua-status")!;
const searchStatus = document.querySelector("#search-status")!;
const syncStatus = document.querySelector("#sync-status")!;
const syncResult = document.querySelector("#sync-result")!;

function searchLabel(pausedUntil: string | null, on: boolean): string {
  if (!on) return "Вимкнено";
  if (pausedUntil && Date.now() < Date.parse(pausedUntil)) {
    return `Пауза до ${new Date(pausedUntil).toLocaleTimeString("uk-UA")}`;
  }
  return "Шукаємо";
}

async function render(): Promise<void> {
  const state = await getState();
  enabled.checked = state.enabled;
  cookieStatus.textContent = state.cookieUpdatedAt ? "Відстежуються" : "Ще не знайдені";
  tokenStatus.textContent = state.token ? "Знайдений" : "Ще немає";
  uaStatus.textContent = state.userAgent ? "Є" : "Ще немає";
  searchStatus.textContent = searchLabel(state.searchPausedUntil, state.enabled);
  syncStatus.textContent = state.lastSyncAt ? (state.lastSyncOk ? "Успішно" : "Наступного разу") : "Ще не було";
}

async function ensureApiPermission(): Promise<boolean> {
  const { apiUrl } = await getState();
  if (!apiUrl) {
    syncResult.textContent = "Немає API URL у налаштуваннях";
    return false;
  }
  const origin = endpointOrigin(apiUrl);
  if (!origin) {
    syncResult.textContent = "Некоректний API URL";
    return false;
  }
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

enabled.addEventListener("change", async () => { await patchState({ enabled: enabled.checked }); await render(); });
document.querySelector("#settings")!.addEventListener("click", () => chrome.runtime.openOptionsPage());
document.querySelector("#sync")!.addEventListener("click", async () => {
  const button = document.querySelector<HTMLButtonElement>("#sync")!;
  button.disabled = true;
  button.textContent = "Надсилаю…";
  syncResult.textContent = "";
  try {
    if (!(await ensureApiPermission())) {
      if (!syncResult.textContent) syncResult.textContent = "Немає дозволу на API";
      return;
    }
    const result = await chrome.runtime.sendMessage({ type: "manual-sync" }) as { ok?: boolean };
    syncResult.textContent = result?.ok ? "Відправлено cookie, токен і user-agent" : "Не вдалося, спробуємо наступного разу";
  } catch {
    syncResult.textContent = "Не вдалося, спробуємо наступного разу";
  } finally {
    button.disabled = false;
    button.textContent = "Debug: відправити на сервер";
    await render();
  }
});
render();
