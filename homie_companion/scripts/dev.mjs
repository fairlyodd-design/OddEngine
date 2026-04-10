import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const host = "127.0.0.1";
const port = 5187;
const target = `http://${host}:${port}/`;

function run(command, args, options = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    shell: true,
    ...options
  });
}

async function waitForRenderer(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await delay(500);
  }
  return false;
}

const vite = run("npm", ["run", "dev:renderer"], { cwd: root });

const cleanExit = () => {
  try { vite.kill(); } catch {}
};

process.on("SIGINT", () => { cleanExit(); process.exit(0); });
process.on("SIGTERM", () => { cleanExit(); process.exit(0); });

const ready = await waitForRenderer(target);
if (!ready) {
  console.error(`[Homie Companion] Renderer did not come up at ${target}`);
  cleanExit();
  process.exit(1);
}

console.log(`[Homie Companion] Renderer ready at ${target}`);
const electron = run("npx", ["electron", "."], { cwd: root });

electron.on("exit", (code) => {
  cleanExit();
  process.exit(code ?? 0);
});
