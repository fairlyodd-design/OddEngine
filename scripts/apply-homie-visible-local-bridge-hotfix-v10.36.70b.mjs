import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.70b";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) fail("Missing " + label + ": " + filePath);
}

function backup(filePath) {
  const dst = filePath + ".bak_" + VERSION;
  if (!fs.existsSync(dst)) fs.copyFileSync(filePath, dst);
}

function replaceOnce(text, needle, replacement, label) {
  if (!text.includes(needle)) fail("Could not find anchor: " + label);
  return text.replace(needle, replacement);
}

ensureFile(buddyPath, "HomieBuddy.tsx");
ensureFile(cssPath, "homieRebuild.css");
backup(buddyPath);
backup(cssPath);

let buddy = fs.readFileSync(buddyPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

if (!buddy.includes("export default function HomieBuddy")) {
  fail("HomieBuddy.tsx shape not recognized.");
}
if (!buddy.includes("probeExternalVoice") || !buddy.includes("transcribeExternalBlob")) {
  fail("Homie voice functions were not found.");
}

// 1) Add direct browser bridge helpers if missing.
if (!buddy.includes("v10.36.70b Homie visible local bridge helpers")) {
  const anchor = "  async function getExternalBridgeReadiness(force = false, baseState?: VoiceDiagnostics) {";
  const helpers = [
    "  // ===== v10.36.70b Homie visible local bridge helpers =====",
    "  function normalizeHomieBridgeBaseUrl(baseUrl: string) {",
    "    return String(baseUrl || \"http://127.0.0.1:8765\").trim().replace(/\\/+$/, \"\") || \"http://127.0.0.1:8765\";",
    "  }",
    "",
    "  function isDesktopBridgeUnavailable(result: any) {",
    "    const hay = String(result?.error || result?.message || result?.detail || \"\").toLowerCase();",
    "    return hay.includes(\"not available in browser\") || hay.includes(\"not available\") || hay.includes(\"desktop mode\");",
    "  }",
    "",
    "  async function homieBridgeFetchJson(url: string, init: RequestInit = {}, timeoutMs = 8000) {",
    "    const controller = new AbortController();",
    "    const timer = window.setTimeout(() => controller.abort(), Math.max(1500, timeoutMs));",
    "    try {",
    "      const res = await fetch(url, { ...init, signal: controller.signal });",
    "      const text = await res.text();",
    "      let parsed: any = null;",
    "      try { parsed = text ? JSON.parse(text) : null; } catch { /* ignore */ }",
    "      if (!res.ok) return { ok: false, error: \"HTTP \" + res.status + \" from \" + url, detail: text || res.statusText };",
    "      return parsed && typeof parsed === \"object\" ? parsed : { ok: true, text };",
    "    } catch (error: any) {",
    "      return { ok: false, error: String(error?.name || \"fetch-failed\") + \": \" + String(error?.message || \"Could not reach \" + url) };",
    "    } finally {",
    "      window.clearTimeout(timer);",
    "    }",
    "  }",
    "",
    "  async function callHomieVoiceBridgeProbe(payload: any, forceDirect = false) {",
    "    let desktopResult: any = null;",
    "    if (!forceDirect) {",
    "      try { desktopResult = await api.voiceBridgeProbe?.(payload); }",
    "      catch (error: any) { desktopResult = { ok: false, error: String(error?.message || error || \"Desktop bridge probe failed.\") }; }",
    "      if (desktopResult?.ok) return desktopResult;",
    "    }",
    "",
    "    const shouldTryDirect = forceDirect || !api.isDesktop?.() || isDesktopBridgeUnavailable(desktopResult);",
    "    if (!shouldTryDirect) return desktopResult || { ok: false, error: \"Desktop bridge probe failed.\" };",
    "",
    "    const baseUrl = normalizeHomieBridgeBaseUrl(payload?.baseUrl || externalVoiceBaseUrl);",
    "    const health = await homieBridgeFetchJson(baseUrl + \"/health\", { method: \"GET\" }, Math.min(Number(payload?.timeoutMs || externalVoiceTimeoutMs || 8000), 10000));",
    "    if (health?.ok) {",
    "      return {",
    "        ...health,",
    "        ok: true,",
    "        status: \"ready\",",
    "        detail: \"Direct browser bridge is ready at \" + baseUrl + \".\",",
    "        model: health?.stt?.modelHint || health?.model || \"\",",
    "        browserDirect: true,",
    "      };",
    "    }",
    "    return { ...(health || {}), ok: false, error: health?.error || \"Direct browser bridge did not answer at \" + baseUrl + \". Keep RUN_HOMIE_VOICE_BRIDGE_v10.36.45.bat open.\", browserDirect: true };",
    "  }",
    "",
    "  async function callHomieVoiceBridgeTranscribe(payload: any) {",
    "    let desktopResult: any = null;",
    "    try { desktopResult = await api.voiceBridgeTranscribe?.(payload); }",
    "    catch (error: any) { desktopResult = { ok: false, error: String(error?.message || error || \"Desktop bridge transcribe failed.\") }; }",
    "    if (desktopResult?.ok) return desktopResult;",
    "",
    "    const shouldTryDirect = !api.isDesktop?.() || isDesktopBridgeUnavailable(desktopResult);",
    "    if (!shouldTryDirect) return desktopResult || { ok: false, error: \"Desktop bridge transcribe failed.\" };",
    "",
    "    const baseUrl = normalizeHomieBridgeBaseUrl(payload?.baseUrl || externalVoiceBaseUrl);",
    "    const result = await homieBridgeFetchJson(baseUrl + \"/transcribe\", {",
    "      method: \"POST\",",
    "      headers: { \"Content-Type\": \"application/json\" },",
    "      body: JSON.stringify({ audioBase64: payload?.audioBase64 || \"\", mimeType: payload?.mimeType || \"audio/webm\" }),",
    "    }, Math.max(Number(payload?.timeoutMs || externalVoiceTimeoutMs || 120000), 120000));",
    "    return { ...(result || {}), browserDirect: true };",
    "  }",
    "",
    "  async function activateHomieLocalBridgeNow() {",
    "    const baseUrl = normalizeHomieBridgeBaseUrl(externalVoiceBaseUrl || \"http://127.0.0.1:8765\");",
    "    persistHomiePrefs({ homieVoiceEngineMode: \"external-http\", homieExternalVoiceBaseUrl: baseUrl, homieExternalVoiceTimeoutMs: 120000 } as any);",
    "    setDiagnostics((prev) => ({",
    "      ...prev,",
    "      externalBridgeConfigured: true,",
    "      externalBridgeBaseUrl: baseUrl,",
    "      externalBridgeState: \"configuring\",",
    "      externalBridgeMessage: \"Checking direct local bridge at \" + baseUrl + \"…\",",
    "      lastErrorCode: \"\",",
    "      lastErrorMessage: \"\",",
    "    }));",
    "    setStatus(\"Switching Homie to local bridge mode at \" + baseUrl + \".\");",
    "    const result = await callHomieVoiceBridgeProbe({ baseUrl, timeoutMs: 8000 }, true);",
    "    if (result?.ok) {",
    "      const message = result.detail || \"Direct browser bridge is ready at \" + baseUrl + \".\";",
    "      setDiagnostics((prev) => ({",
    "        ...prev,",
    "        externalBridgeConfigured: true,",
    "        externalBridgeBaseUrl: baseUrl,",
    "        externalBridgeState: \"ready\",",
    "        externalBridgeMessage: message,",
    "        externalBridgeModel: result.model || prev.externalBridgeModel || \"tiny.en\",",
    "        lastErrorCode: \"\",",
    "        lastErrorMessage: \"\",",
    "      }));",
    "      announce(message + \" Use Start listening or Hold to talk now.\", \"good\", true, \"Local bridge ready.\");",
    "      return;",
    "    }",
    "    const message = classifyExternalBridgeError(result?.error || \"Direct local bridge did not answer.\", baseUrl);",
    "    setDiagnostics((prev) => ({",
    "      ...prev,",
    "      externalBridgeConfigured: true,",
    "      externalBridgeBaseUrl: baseUrl,",
    "      externalBridgeState: \"degraded\",",
    "      externalBridgeMessage: message,",
    "      lastErrorCode: \"direct-bridge-unreachable\",",
    "      lastErrorMessage: message,",
    "    }));",
    "    announce(message, \"warn\", true, \"Local bridge issue.\");",
    "  }",
    "  // ===== v10.36.70b Homie visible local bridge helpers END =====",
    "",
    anchor
  ].join("\n");
  buddy = replaceOnce(buddy, anchor, helpers, "insert direct bridge helpers");
}

// 2) If v10.36.70 helper exists but lacks activation, add activation near its helper block.
if (buddy.includes("callHomieVoiceBridgeProbe") && !buddy.includes("activateHomieLocalBridgeNow")) {
  const anchor = "  async function getExternalBridgeReadiness(force = false, baseState?: VoiceDiagnostics) {";
  const fn = [
    "  async function activateHomieLocalBridgeNow() {",
    "    const baseUrl = normalizeHomieBridgeBaseUrl(externalVoiceBaseUrl || \"http://127.0.0.1:8765\");",
    "    persistHomiePrefs({ homieVoiceEngineMode: \"external-http\", homieExternalVoiceBaseUrl: baseUrl, homieExternalVoiceTimeoutMs: 120000 } as any);",
    "    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: \"configuring\", externalBridgeMessage: \"Checking direct local bridge at \" + baseUrl + \"…\", lastErrorCode: \"\", lastErrorMessage: \"\" }));",
    "    const result = await callHomieVoiceBridgeProbe({ baseUrl, timeoutMs: 8000 }, true);",
    "    if (result?.ok) {",
    "      const message = result.detail || \"Direct browser bridge is ready at \" + baseUrl + \".\";",
    "      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: \"ready\", externalBridgeMessage: message, externalBridgeModel: result.model || prev.externalBridgeModel || \"tiny.en\", lastErrorCode: \"\", lastErrorMessage: \"\" }));",
    "      announce(message + \" Use Start listening or Hold to talk now.\", \"good\", true, \"Local bridge ready.\");",
    "    } else {",
    "      const message = classifyExternalBridgeError(result?.error || \"Direct local bridge did not answer.\", baseUrl);",
    "      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: \"degraded\", externalBridgeMessage: message, lastErrorCode: \"direct-bridge-unreachable\", lastErrorMessage: message }));",
    "      announce(message, \"warn\", true, \"Local bridge issue.\");",
    "    }",
    "  }",
    "",
    anchor
  ].join("\n");
  buddy = replaceOnce(buddy, anchor, fn, "add activate local bridge function");
}

// 3) Use direct helper for probe/transcribe.
buddy = buddy.replace(
  "const result = await api.voiceBridgeProbe({ baseUrl: externalVoiceBaseUrl, timeoutMs: Math.min(externalVoiceTimeoutMs, 8000) });",
  "const result = await callHomieVoiceBridgeProbe({ baseUrl: externalVoiceBaseUrl, timeoutMs: Math.min(externalVoiceTimeoutMs, 8000) });"
);

buddy = buddy.replace(
  'const result = await api.voiceBridgeTranscribe({ baseUrl: externalVoiceBaseUrl, timeoutMs: externalVoiceTimeoutMs, mimeType: blob.type || "audio/webm", audioBase64 });',
  'const result = await callHomieVoiceBridgeTranscribe({ baseUrl: externalVoiceBaseUrl, timeoutMs: externalVoiceTimeoutMs, mimeType: blob.type || "audio/webm", audioBase64 });'
);

// 4) Remove desktop-only transcribe guard.
buddy = buddy.replace(
  /    if \(!api\.voiceBridgeTranscribe\) \{[\s\S]*?      return;\r?\n    \}\r?\n\r?\n    try \{/,
  "    try {"
);

// 5) Replace probe guard so browser mode can probe direct bridge after local mode is selected.
buddy = buddy.replace(
  /    if \(!api\.voiceBridgeProbe \|\| !wantsExternalVoice\(\)\) \{[\s\S]*?      return \{ ok: false, status: nextState, message \};\r?\n    \}\r?\n\r?\n    setDiagnostics/,
  [
    "    if (!wantsExternalVoice()) {",
    "      const message = \"External/local bridge is idle because Homie is set to cloud mode. Click Use local bridge to use 127.0.0.1:8765.\";",
    "      const nextState = \"disabled\";",
    "      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: false, externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: nextState, externalBridgeMessage: message, externalBridgeModel: \"\" }));",
    "      if (!silent) announce(message, \"idle\", true, \"Local bridge is idle because cloud voice is selected.\");",
    "      return { ok: false, status: nextState, message };",
    "    }",
    "",
    "    setDiagnostics"
  ].join("\n")
);

// 6) Improve success copy.
buddy = buddy.replace(
  "const message = result.detail || `External/local voice bridge is ready at ${externalVoiceBaseUrl}.`;",
  "const message = result.detail || (result.browserDirect ? `Direct browser bridge is ready at ${externalVoiceBaseUrl}.` : `External/local voice bridge is ready at ${externalVoiceBaseUrl}.`);"
);
buddy = buddy.replace(
  'externalBridgeMessage: result.detail || `External/local voice bridge ready at ${externalVoiceBaseUrl}.`,',
  'externalBridgeMessage: result.detail || (result.browserDirect ? `Direct browser bridge ready at ${externalVoiceBaseUrl}.` : `External/local voice bridge ready at ${externalVoiceBaseUrl}.`),'
);

// 7) Add visible controls directly inside the main Voice meta card.
if (!buddy.includes('data-homie-visible-bridge-controls="v10.36.70b"')) {
  const bridgeLine = '<div className="small"><b>Bridge:</b> {diagnostics.externalBridgeState} • {diagnostics.externalBridgeBaseUrl}</div>';
  const visibleControls = [
    bridgeLine,
    '            <div className="homieVisibleBridgeControls assistantChipWrap" data-homie-visible-bridge-controls="v10.36.70b">',
    '              <button className={`tabBtn ${voiceEngineMode === "external-http" ? "active" : ""}`} onClick={() => void activateHomieLocalBridgeNow()}>Use local bridge</button>',
    '              <button className="tabBtn" onClick={() => void probeExternalVoice(false)}>Probe 8765</button>',
    '              <button className={`tabBtn ${voiceEngineMode === "cloud" ? "active" : ""}`} onClick={() => { persistHomiePrefs({ homieVoiceEngineMode: "cloud" } as any); announce("Cloud voice mode is on. Local bridge is idle.", "idle", true, "Cloud voice mode."); void refreshVoiceDiagnostics(); }}>Cloud mode</button>',
    '            </div>',
    '            <div className="small homieBridgeInlineTip">Bridge tip: your 8765 bridge can be healthy while Homie still says disabled if Cloud voice is selected. Use local bridge flips the saved mode.</div>'
  ].join("\n");
  buddy = replaceOnce(buddy, bridgeLine, visibleControls, "visible bridge controls after bridge line");
}

// 8) Add top-level voice chip too so it is impossible to miss.
if (!buddy.includes('data-homie-top-bridge-button="v10.36.70b"')) {
  const voiceOnButtonStart = '<button className={`tabBtn ${voiceEnabled ? "active" : ""}`';
  const topButton = '            <button className={`tabBtn ${voiceEngineMode === "external-http" ? "active" : ""}`} data-homie-top-bridge-button="v10.36.70b" onClick={() => void activateHomieLocalBridgeNow()}>{voiceEngineMode === "external-http" ? "Bridge on" : "Use bridge"}</button>\n';
  const idx = buddy.indexOf(voiceOnButtonStart);
  if (idx === -1) fail("Could not find Voice on button to insert top bridge button.");
  buddy = buddy.slice(0, idx) + topButton + buddy.slice(idx);
}

// 9) Update any idle cloud copy.
buddy = buddy.split("External/local bridge is idle because Homie is set to cloud mode.").join("External/local bridge is idle because Homie is set to cloud mode. Click Use local bridge to use 127.0.0.1:8765.");

// 10) Marker.
if (!buddy.includes("v10.36.70b checker-safe marker")) {
  buddy = buddy.replace(
    "export default function HomieBuddy",
    "// v10.36.70b checker-safe marker: visible bridge switch and direct browser fallback installed\nexport default function HomieBuddy"
  );
}

fs.writeFileSync(buddyPath, buddy, "utf8");

// CSS.
const cssStart = "/* ===== v10.36.70b Homie Visible Local Bridge Controls ===== */";
const cssEnd = "/* ===== v10.36.70b Homie Visible Local Bridge Controls END ===== */";
if (css.includes(cssStart) && css.includes(cssEnd)) {
  const s = css.indexOf(cssStart);
  const e = css.indexOf(cssEnd, s) + cssEnd.length;
  css = (css.slice(0, s) + css.slice(e)).trimEnd();
}

const cssBlock = [
  cssStart,
  ".homieVisibleBridgeControls{",
  "  margin-top: 10px;",
  "  margin-bottom: 8px;",
  "  padding: 10px;",
  "  border-radius: 16px;",
  "  border: 1px solid rgba(94,234,242,0.14);",
  "  background: rgba(94,234,242,0.045);",
  "}",
  ".homieBridgeInlineTip{",
  "  color: rgba(226,238,255,0.68);",
  "  line-height: 1.38;",
  "}",
  cssEnd
].join("\n");

css = css.trimEnd() + "\n\n" + cssBlock + "\n";
fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied visible local bridge hotfix.");
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");
console.log("- ui/src/components/homieRebuild.css");