const SOURCE = "myraha-token-hunt";

type SearchStatus = { active: boolean; prefixes: string[] };

function isWhitelisted(url: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => url.startsWith(prefix));
}

async function searchStatus(): Promise<SearchStatus | null> {
  try {
    return await chrome.runtime.sendMessage({ type: "search-status" }) as SearchStatus;
  } catch {
    return null;
  }
}

async function submit(token: string, prefixes: string[]): Promise<void> {
  if (!isWhitelisted(location.href, prefixes)) return;
  try {
    await chrome.runtime.sendMessage({ type: "token-found", token });
  } catch {
    return;
  }
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data as { source?: string; token?: string } | null;
  if (!data || data.source !== SOURCE || typeof data.token !== "string") return;
  void searchStatus().then((status) => {
    if (!status?.active) return;
    void submit(data.token as string, status.prefixes);
  });
});

function pickToken(text: string): string | null {
  let best: string | null = null;
  for (const match of text.matchAll(/\b(EAA[A-Za-z0-9]{50,})\b/g)) {
    const token = match[1];
    if (!token) continue;
    const rank = (value: string) => value.startsWith("EAAB") ? 2 : value.startsWith("EAAG") ? 1 : 0;
    if (!best || rank(token) > rank(best) || (rank(token) === rank(best) && token.length > best.length)) best = token;
  }
  return best;
}

async function scanPage(): Promise<void> {
  const status = await searchStatus();
  if (!status?.active || !isWhitelisted(location.href, status.prefixes)) return;
  const token = pickToken(document.documentElement?.innerHTML ?? "");
  if (token) await submit(token, status.prefixes);
}

void scanPage();
setInterval(() => { void scanPage(); }, 3000);
