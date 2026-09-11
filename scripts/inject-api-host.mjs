import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "vite";

function apiHostPermission(apiUrl) {
  try {
    const url = new URL(apiUrl);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return null;
    return `${url.origin}/*`;
  } catch {
    return null;
  }
}

const env = loadEnv("production", process.cwd(), "");
const apiHost = apiHostPermission(env.VITE_API_URL ?? "");
if (!apiHost) process.exit(0);

const manifestPath = resolve("dist/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const hosts = new Set(manifest.host_permissions ?? []);
hosts.add(apiHost);
manifest.host_permissions = [...hosts];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
