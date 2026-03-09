import { spawn } from "node:child_process";
import http from "node:http";

const isWin = process.platform === "win32";
// On Windows, npm/npx are usually .cmd shims. Spawning shims directly can throw
// EINVAL in newer Node versions. This script uses cmd.exe explicitly on Windows
// to keep the dev launcher reliable.
const npmCmd = "npm";
const npxCmd = "npx";
const VITE_URL = "http://localhost:5173";

function quoteForCmd(s){
  // Minimal quoting for cmd.exe: wrap in quotes if spaces or quotes.
  if (typeof s !== "string") s = String(s);
  if (!/[\s"]/g.test(s)) return s;
  // cmd.exe escaping: double quotes inside a quoted string.
  return `"${s.replace(/"/g, '""')}"`;
}

function run(cmd, args, opts={}){
  if (isWin) {
    // Node 24+ can throw EINVAL when spawning .cmd shims directly (e.g., npm.cmd).
    // The most reliable approach is to spawn cmd.exe explicitly.
    const comspec = process.env.ComSpec || "cmd.exe";
    const line = [cmd, ...args].map(quoteForCmd).join(" ");
    return spawn(comspec, ["/d","/s","/c", line], {
      stdio: "inherit",
      windowsHide: false,
      ...opts
    });
  }

  return spawn(cmd, args, {
    stdio: "inherit",
    shell: false,
    ...opts
  });
}

function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function waitForUrl(url, tries=120){
  for(let i=0;i<tries;i++){
    const ok = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(800, () => { try{ req.destroy(); }catch(e){} resolve(false); });
    });
    if(ok) return true;
    await wait(500);
  }
  return false;
}

console.log("[OddEngine] Starting UI (Vite)...");
const ui = run(npmCmd, ["--prefix","ui","run","dev","--","--host","127.0.0.1","--port","5173","--strictPort"], {
  env: { ...process.env, BROWSER:"none" }
});

const ok = await waitForUrl(VITE_URL);
if(!ok){
  console.error("[OddEngine] Vite did not become ready. Exiting.");
  try{ ui.kill(); }catch(e){}
  process.exit(1);
}

console.log("[OddEngine] Starting Desktop (Electron)...");
const desktop = run(npxCmd, ["electron","."], {
  env: { ...process.env, ELECTRON_START_URL: VITE_URL }
});

function shutdown(){
  try{ desktop.kill(); }catch(e){}
  try{ ui.kill(); }catch(e){}
}

process.on("SIGINT", () => { shutdown(); process.exit(0); });
process.on("SIGTERM", () => { shutdown(); process.exit(0); });

desktop.on("exit", (code) => {
  console.log("[OddEngine] Electron exited:", code);
  shutdown();
  process.exit(code ?? 0);
});
