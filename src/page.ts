(() => {
  const SOURCE = "myraha-token-hunt";
  const TOKEN_RE = /\b(EAA[A-Za-z0-9_-]{20,})\b/g;
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
      if (typeof value === "string" && /^EAA[A-Za-z0-9_-]{20,}$/.test(value)) return value;
    }
    return null;
  }

  function hunt(): void {
    const token = fromGlobals() || pick(document.documentElement?.innerHTML ?? "");
    if (!token || token === lastSent) return;
    lastSent = token;
    window.postMessage({ source: SOURCE, token }, "*");
  }

  function huntValue(value: unknown): void {
    if (typeof value === "string") {
      huntText(value);
      return;
    }
    if (value instanceof URLSearchParams) huntText(value.toString());
  }

  function huntText(text: string): void {
    let decoded = text;
    try { decoded = decodeURIComponent(text.replace(/\+/g, "%20")); } catch { /* keep raw text */ }
    const token = pick(decoded);
    if (token && token !== lastSent) {
      lastSent = token;
      window.postMessage({ source: SOURCE, token }, "*");
    }
  }

  function hookNetwork(): void {
    const nativeFetch = window.fetch;
    window.fetch = function (...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
      const input = args[0];
      huntValue(typeof input === "string" ? input : input instanceof Request ? input.url : String(input));
      huntValue(args[1]?.body);
      return Reflect.apply(nativeFetch, this, args);
    };

    const nativeOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      ...args: Parameters<XMLHttpRequest["open"]>
    ): void {
      huntValue(String(args[1]));
      Reflect.apply(nativeOpen, this, args);
    } as typeof XMLHttpRequest.prototype.open;

    const nativeSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (
      ...args: Parameters<XMLHttpRequest["send"]>
    ): void {
      huntValue(args[0]);
      Reflect.apply(nativeSend, this, args);
    };
  }

  hookNetwork();
  hunt();
  setInterval(hunt, 3000);
})();
