// Facebook can URL-encode a token or place it in JSON/GraphQL payloads. Keep
// the check deliberately narrow (EAA prefix), but do not assume one fixed length.
const TOKEN_RE = /\b(EAA[A-Za-z0-9_-]{20,})\b/g;

function rank(token: string): number {
  if (token.startsWith("EAAB")) return 2;
  if (token.startsWith("EAAG")) return 1;
  return 0;
}

export function isAccessToken(value: string): boolean {
  return /^EAA[A-Za-z0-9_-]{20,}$/.test(value);
}

export function extractAccessToken(text: string): string | null {
  if (!text) return null;
  let decoded = text;
  try { decoded = decodeURIComponent(text.replace(/\+/g, "%20")); } catch { /* raw text is still useful */ }
  let best: string | null = null;
  for (const match of decoded.matchAll(TOKEN_RE)) {
    const token = match[1];
    if (!token) continue;
    if (!best || rank(token) > rank(best) || (rank(token) === rank(best) && token.length > best.length)) {
      best = token;
    }
  }
  return best;
}

export function requestBodyText(details: chrome.webRequest.OnBeforeRequestDetails): string {
  const parts = [details.url];
  const body = details.requestBody;
  if (body?.formData) {
    for (const [key, values] of Object.entries(body.formData)) {
      parts.push(key);
      for (const value of values ?? []) {
        parts.push(typeof value === "string" ? value : new TextDecoder().decode(value));
      }
    }
  }
  if (body?.raw) {
    for (const chunk of body.raw) {
      if (chunk.bytes) parts.push(new TextDecoder().decode(chunk.bytes));
    }
  }
  return parts.join("\n");
}
