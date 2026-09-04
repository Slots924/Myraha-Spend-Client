import { getLogs, setLogs } from "./storage";
import type { LogEntry } from "./types";

export async function addLog(level: LogEntry["level"], message: string): Promise<void> {
  // Messages are constants by design: never pass token, cookie or response bodies here.
  const logs = await getLogs();
  logs.push({ id: crypto.randomUUID(), at: new Date().toISOString(), level, message });
  await setLogs(logs);
}
