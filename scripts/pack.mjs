import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const zip = resolve("myraha-spend-client.zip");
if (existsSync(zip)) rmSync(zip);

const result = spawnSync(
  "powershell",
  [
    "-NoProfile",
    "-Command",
    "Compress-Archive -Path (Join-Path 'dist' '*') -DestinationPath 'myraha-spend-client.zip' -Force"
  ],
  { stdio: "inherit" }
);

process.exit(result.status ?? 1);
