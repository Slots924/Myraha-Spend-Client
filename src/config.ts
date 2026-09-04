const DEFAULT_WHITELIST = [
  "https://www.facebook.com/adsmanager",
  "https://www.facebook.com/advertising",
  "https://www.facebook.com/ad_center",
  "https://adsmanager.facebook.com",
  "https://business.facebook.com"
];

function parseMinutes(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const TOKEN_SEARCH_COOLDOWN_MINUTES = parseMinutes(
  import.meta.env.VITE_TOKEN_SEARCH_COOLDOWN_MINUTES,
  60
);

export const TOKEN_SEARCH_COOLDOWN_MS = TOKEN_SEARCH_COOLDOWN_MINUTES * 60 * 1000;

const FROM_ENV = String(import.meta.env.VITE_TOKEN_PAGE_WHITELIST ?? "")
  .split(",")
  .map((item: string) => item.trim())
  .filter(Boolean);

export const TOKEN_PAGE_WHITELIST = FROM_ENV.length ? FROM_ENV : DEFAULT_WHITELIST;

export function isWhitelistedUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const normalized = new URL(url).href;
    return TOKEN_PAGE_WHITELIST.some((prefix: string) => normalized.startsWith(prefix));
  } catch {
    return false;
  }
}
