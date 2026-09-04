(() => {
  const SOURCE = "myraha-token-hunt";
  const TOKEN_RE = /\b(EAA[A-Za-z0-9]{50,})\b/g;
  let lastSent = "";

  function rank(token: string): number {
    if (token.startsWith("EAAB")) return 2;
    if (token.startsWith("EAAG")) return 1;
    return 0;
  }

  function pick(text: string): string | null {
    let best: string | null = null;
    for (const match of text.matchAll(TOKEN_RE)) {
      const token = match[1];
      if (!token) continue;
      if (!best || rank(token) > rank(best) || (rank(token) === rank(best) && token.length > best.length)) {
        best = token;
      }
    }
    return best;
  }

  function fromGlobals(): string | null {
    const w = window as Window & { __accessToken?: unknown; accessToken?: unknown; require?: unknown };
    const values: unknown[] = [w.__accessToken, w.accessToken];
    try {
      const requireFn = w.require;
      if (typeof requireFn === "function") {
        const data = (requireFn as (mod: string) => { accessToken?: unknown })("CurrentUserInitialData");
        values.push(data?.accessToken);
      }
    } catch {
      /* Facebook module may be absent */
    }
    for (const value of values) {
      if (typeof value === "string" && /^EAA[A-Za-z0-9]{50,}$/.test(value)) return value;
    }
    return null;
  }

  function hunt(): void {
    const token = fromGlobals() || pick(document.documentElement?.innerHTML ?? "");
    if (!token || token === lastSent) return;
    lastSent = token;
    window.postMessage({ source: SOURCE, token }, "*");
  }

  hunt();
  setInterval(hunt, 3000);
})();
