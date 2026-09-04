import { getState, patchState } from "./storage";

const enabled = document.querySelector<HTMLInputElement>("#enabled")!;
const cookieStatus = document.querySelector("#cookie-status")!;
const tokenStatus = document.querySelector("#token-status")!;
const searchStatus = document.querySelector("#search-status")!;
const syncStatus = document.querySelector("#sync-status")!;

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
  searchStatus.textContent = searchLabel(state.searchPausedUntil, state.enabled);
  syncStatus.textContent = state.lastSyncAt ? (state.lastSyncOk ? "Успішно" : "Наступного разу") : "Ще не було";
}

enabled.addEventListener("change", async () => { await patchState({ enabled: enabled.checked }); await render(); });
document.querySelector("#settings")!.addEventListener("click", () => chrome.runtime.openOptionsPage());
document.querySelector("#sync")!.addEventListener("click", async () => {
  const button = document.querySelector<HTMLButtonElement>("#sync")!;
  button.disabled = true; button.textContent = "Надсилаю…";
  await chrome.runtime.sendMessage({ type: "manual-sync" });
  button.disabled = false; button.textContent = "Надіслати зараз"; await render();
});
render();
