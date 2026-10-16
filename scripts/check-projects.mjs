// Read-only check of the exact configured entry points. Does not launch services.
import { readConfig } from "./server.mjs";
const config = readConfig();
let failed = false;
for (const project of config.projects) {
  try {
    const response = await fetch(new URL(project.url, process.env.YIFANG_BASE || "http://127.0.0.1:4591"), { signal: AbortSignal.timeout(5000) });
    await response.body?.cancel();
    console.log(`${project.id}: HTTP ${response.status}`);
    if (!response.ok) failed = true;
  } catch (error) {
    console.log(`${project.id}: unavailable (${error.cause?.code || error.name})`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
