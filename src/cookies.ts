import { fingerprint } from "./fingerprint";

export async function readFacebookCookies(): Promise<chrome.cookies.Cookie[]> {
  const cookies = await chrome.cookies.getAll({ domain: "facebook.com" });
  return cookies.sort((a, b) => `${a.domain}|${a.path}|${a.name}`.localeCompare(`${b.domain}|${b.path}|${b.name}`));
}

export async function cookieSnapshot(): Promise<{ fingerprint: string; count: number }> {
  const cookies = await readFacebookCookies();
  const canonical = cookies.map(({ domain, path, name, value, expirationDate }) =>
    JSON.stringify([domain, path, name, value, expirationDate ?? null])
  ).join("\n");
  return { fingerprint: await fingerprint(canonical), count: cookies.length };
}
