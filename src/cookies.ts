import { fingerprint } from "./fingerprint";
import type { CookieItem } from "./types";

export async function readFacebookCookies(): Promise<chrome.cookies.Cookie[]> {
  const cookies = await chrome.cookies.getAll({ domain: "facebook.com" });
  return cookies.sort((a, b) => `${a.domain}|${a.path}|${a.name}`.localeCompare(`${b.domain}|${b.path}|${b.name}`));
}

export function toCookieItems(cookies: chrome.cookies.Cookie[]): CookieItem[] {
  return cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    session: cookie.session,
    hostOnly: cookie.hostOnly,
    ...(cookie.expirationDate != null ? { expirationDate: cookie.expirationDate } : {}),
    ...(cookie.sameSite ? { sameSite: cookie.sameSite } : {})
  }));
}

export async function cookieSnapshot(): Promise<{ fingerprint: string; count: number; items: CookieItem[] }> {
  const cookies = await readFacebookCookies();
  const items = toCookieItems(cookies);
  const canonical = items
    .map((cookie) => JSON.stringify([cookie.domain, cookie.path, cookie.name, cookie.value, cookie.expirationDate ?? null]))
    .join("\n");
  return { fingerprint: await fingerprint(canonical), count: items.length, items };
}
