import { getState, patchState } from "./storage";

const enabled = document.querySelector<HTMLInputElement>("#enabled")!;
const cookieStatus = document.querySelector("#cookie-status")!;
const tokenStatus = document.querySelector("#token-status")!;
const syncStatus = document.querySelector("#sync-status")!;

async function render(): Promise<void> {
  const state = await getState();
  enabled.checked = state.enabled;
  cookieStatus.textContent = state.cookieUpdatedAt ? "Відстежуються" : "Ще не знайдені";
  tokenStatus.textContent = state.token ? "Збережений локально" : "Не вказаний";
  syncStatus.textContent = state.lastSyncAt ? (state.lastSyncOk ? "Успішно" : "Помилка") : "Ще не було";
}

enabled.addEventListener("change", async () => { await patchState({ enabled: enabled.checked }); await render(); });
document.querySelector("#settings")!.addEventListener("click", () => chrome.runtime.openOptionsPage());
document.querySelector("#sync")!.addEventListener("click", async () => {
  const button = document.querySelector<HTMLButtonElement>("#sync")!;
  button.disabled = true; button.textContent = "Перевіряю…";
  await chrome.runtime.sendMessage({ type: "manual-sync" });
  button.disabled = false; button.textContent = "Перевірити зараз"; await render();
});
render();
