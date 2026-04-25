import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.70";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");

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
backup(buddyPath);

let buddy = fs.readFileSync(buddyPath, "utf8");

if (!buddy.includes("export default function HomieBuddy")) {
  fail("HomieBuddy.tsx shape not recognized.");
}
if (!buddy.includes("voiceBridgeProbe") || !buddy.includes("voiceBridgeTranscribe")) {
  fail("Homie voice bridge hooks were not found.");
}

// Add direct browser bridge helpers inside the component, near getExternalBridgeReadiness.
if (!buddy.includes("v10.36.70 Homie direct browser bridge helpers")) {
  const anchor = "  async function getExternalBridgeReadiness(force = false, baseState?: VoiceDiagnostics) {";
  const helpers = [
    '  // ===== v10.36.70 Homie direct browser bridge helpers =====',
    '  function normalizeHomieBridgeBaseUrl(baseUrl: string) {',
    '    return String(baseUrl || "http://127.0.0.1:8765").trim().replace(/\\/+$/, "") || "http://127.0.0.1:8765";',
    '  }',
    '',
    '  function isDesktopBridgeUnavailable(result: any) {',
    '    const hay = String(result?.error || result?.message || result?.detail || "").toLowerCase();',
    '    return hay.includes("not available in browser") || hay.includes("not available") || hay.includes("desktop mode");',
    '  }',
    '',
    '  async function homieBridgeFetchJson(url: string, init: RequestInit = {}, timeoutMs = 8000) {',
    '    const controller = new AbortController();',
    '    const timer = window.setTimeout(() => controller.abort(), Math.max(1500, timeoutMs));',
    '    try {',
    '      const res = await fetch(url, { ...init, signal: controller.signal });',
    '      const text = await res.text();',
    '      let parsed: any = null;',
    '      try { parsed = text ? JSON.parse(text) : null; } catch { /* ignore */ }',
    '      if (!res.ok) {',
    '        return { ok: false, error: "HTTP " + res.status + " from " + url, detail: text || res.statusText };',
    '      }',
    '      return parsed && typeof parsed === "object" ? parsed : { ok: true, text };',
    '    } catch (error: any) {',
    '      return { ok: false, error: String(error?.name || "fetch-failed") + ": " + String(error?.message || "Could not reach " + url) };',
    '    } finally {',
    '      window.clearTimeout(timer);',
    '    }',
    '  }',
    '',
    '  async function callHomieVoiceBridgeProbe(payload: any) {',
    '    let desktopResult: any = null;',
    '    try {',
    '      desktopResult = await api.voiceBridgeProbe?.(payload);',
    '    } catch (error: any) {',
    '      desktopResult = { ok: false, error: String(error?.message || error || "Desktop bridge probe failed.") };',
    '    }',
    '',
    '    if (desktopResult?.ok) return desktopResult;',
    '',
    '    const shouldTryDirect = !api.isDesktop?.() || isDesktopBridgeUnavailable(desktopResult);',
    '    if (!shouldTryDirect) return desktopResult || { ok: false, error: "Desktop bridge probe failed." };',
    '',
    '    const baseUrl = normalizeHomieBridgeBaseUrl(payload?.baseUrl || externalVoiceBaseUrl);',
    '    const health = await homieBridgeFetchJson(baseUrl + "/health", { method: "GET" }, Math.min(Number(payload?.timeoutMs || externalVoiceTimeoutMs || 8000), 10000));',
    '    if (health?.ok) {',
    '      return {',
    '        ...health,',
    '        ok: true,',
    '        status: "ready",',
    '        detail: "Direct browser bridge is ready at " + baseUrl + ".",',
    '        model: health?.stt?.modelHint || health?.model || "",',
    '        browserDirect: true,',
    '      };',
    '    }',
    '    return {',
    '      ...(health || {}),',
    '      ok: false,',
    '      error: health?.error || "Direct browser bridge did not answer at " + baseUrl + ". Keep RUN_HOMIE_VOICE_BRIDGE_v10.36.45.bat open.",',
    '      browserDirect: true,',
    '    };',
    '  }',
    '',
    '  async function callHomieVoiceBridgeTranscribe(payload: any) {',
    '    let desktopResult: any = null;',
    '    try {',
    '      desktopResult = await api.voiceBridgeTranscribe?.(payload);',
    '    } catch (error: any) {',
    '      desktopResult = { ok: false, error: String(error?.message || error || "Desktop bridge transcribe failed.") };',
    '    }',
    '',
    '    if (desktopResult?.ok) return desktopResult;',
    '',
    '    const shouldTryDirect = !api.isDesktop?.() || isDesktopBridgeUnavailable(desktopResult);',
    '    if (!shouldTryDirect) return desktopResult || { ok: false, error: "Desktop bridge transcribe failed." };',
    '',
    '    const baseUrl = normalizeHomieBridgeBaseUrl(payload?.baseUrl || externalVoiceBaseUrl);',
    '    const result = await homieBridgeFetchJson(baseUrl + "/transcribe", {',
    '      method: "POST",',
    '      headers: { "Content-Type": "application/json" },',
    '      body: JSON.stringify({',
    '        audioBase64: payload?.audioBase64 || "",',
    '        mimeType: payload?.mimeType || "audio/webm",',
    '      }),',
    '    }, Math.max(Number(payload?.timeoutMs || externalVoiceTimeoutMs || 120000), 120000));',
    '',
    '    return { ...(result || {}), browserDirect: true };',
    '  }',
    '  // ===== v10.36.70 Homie direct browser bridge helpers END =====',
    '',
    anchor
  ].join("\n");

  buddy = replaceOnce(buddy, anchor, helpers, "direct browser bridge helper insertion");
}

// Use direct helper for probing.
const probeOld = "const result = await api.voiceBridgeProbe({ baseUrl: externalVoiceBaseUrl, timeoutMs: Math.min(externalVoiceTimeoutMs, 8000) });";
const probeNew = "const result = await callHomieVoiceBridgeProbe({ baseUrl: externalVoiceBaseUrl, timeoutMs: Math.min(externalVoiceTimeoutMs, 8000) });";
if (buddy.includes(probeOld)) {
  buddy = buddy.replace(probeOld, probeNew);
} else if (!buddy.includes("callHomieVoiceBridgeProbe({ baseUrl: externalVoiceBaseUrl")) {
  fail("Could not find probe call anchor.");
}

// Use direct helper for transcription.
const transcribeOld = 'const result = await api.voiceBridgeTranscribe({ baseUrl: externalVoiceBaseUrl, timeoutMs: externalVoiceTimeoutMs, mimeType: blob.type || "audio/webm", audioBase64 });';
const transcribeNew = 'const result = await callHomieVoiceBridgeTranscribe({ baseUrl: externalVoiceBaseUrl, timeoutMs: externalVoiceTimeoutMs, mimeType: blob.type || "audio/webm", audioBase64 });';
if (buddy.includes(transcribeOld)) {
  buddy = buddy.replace(transcribeOld, transcribeNew);
} else if (!buddy.includes("callHomieVoiceBridgeTranscribe({ baseUrl: externalVoiceBaseUrl")) {
  fail("Could not find transcribe call anchor.");
}

// Browser direct should not be blocked by desktop-only transcribe guard.
const desktopGuardOld = [
  '    if (!api.voiceBridgeTranscribe) {',
  '      const message = "External/local voice bridge transcription is only available in desktop mode.";',
  '      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "unavailable", externalBridgeMessage: message, lastErrorCode: "external-bridge-unavailable", lastErrorMessage: message, activeRecognitionMode: "idle" }));',
  '      announce(message, "warn", true, "Voice bridge unavailable.");',
  '      return;',
  '    }',
  ''
].join("\n");

if (buddy.includes(desktopGuardOld)) {
  buddy = buddy.replace(desktopGuardOld, "");
}

// Probe guard should now allow direct browser mode.
const probeGuardOld = [
  '    if (!api.voiceBridgeProbe || !wantsExternalVoice()) {',
  '      const message = voiceEngineMode === "cloud"',
  '        ? "External/local bridge is idle because Homie is set to cloud mode."',
  '        : "External/local bridge probing is only available in desktop mode.";',
  '      const nextState = voiceEngineMode === "cloud" ? "disabled" : "unavailable";',
  '      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: wantsExternalVoice(), externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: nextState, externalBridgeMessage: message, externalBridgeModel: "" }));',
  '      if (!silent) announce(message, "warn", true, "Voice bridge unavailable.");',
  '      return { ok: false, status: nextState, message };',
  '    }'
].join("\n");

const probeGuardNew = [
  '    if (!wantsExternalVoice()) {',
  '      const message = "External/local bridge is idle because Homie is set to cloud mode.";',
  '      const nextState = "disabled";',
  '      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: false, externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: nextState, externalBridgeMessage: message, externalBridgeModel: "" }));',
  '      if (!silent) announce(message, "idle", true, "Local bridge is idle because cloud voice is selected.");',
  '      return { ok: false, status: nextState, message };',
  '    }'
].join("\n");

if (buddy.includes(probeGuardOld)) {
  buddy = buddy.replace(probeGuardOld, probeGuardNew);
}

// Improve success copy to mention browser direct mode.
buddy = buddy.replace(
  'const message = result.detail || `External/local voice bridge is ready at ${externalVoiceBaseUrl}.`;',
  'const message = result.detail || (result.browserDirect ? `Direct browser bridge is ready at ${externalVoiceBaseUrl}.` : `External/local voice bridge is ready at ${externalVoiceBaseUrl}.`);'
);

buddy = buddy.replace(
  'externalBridgeMessage: result.detail || `External/local voice bridge ready at ${externalVoiceBaseUrl}.`,',
  'externalBridgeMessage: result.detail || (result.browserDirect ? `Direct browser bridge ready at ${externalVoiceBaseUrl}.` : `External/local voice bridge ready at ${externalVoiceBaseUrl}.`),'
);

// Add voice buttons to switch modes and probe direct bridge.
if (!buddy.includes("Use local bridge")) {
  const probeButton = '<button className="tabBtn" onClick={() => void probeExternalVoice(false)}>Probe bridge</button>';
  const replacement = [
    '<button className="tabBtn" onClick={() => void refreshVoiceDiagnostics()}>Refresh diagnostics</button>',
    '<button className="tabBtn active" onClick={() => { persistHomiePrefs({ homieVoiceEngineMode: "external-http" } as any); announce("Local bridge mode is on. Keep the bridge window open, then use Start listening or Hold to talk.", "good", true, "Local bridge mode on."); void refreshVoiceDiagnostics(); }}>Use local bridge</button>',
    '<button className="tabBtn" onClick={() => void probeExternalVoice(false)}>Probe bridge</button>'
  ].join("\n                ");

  if (buddy.includes(probeButton)) {
    buddy = buddy.replace('<button className="tabBtn" onClick={() => void refreshVoiceDiagnostics()}>Refresh diagnostics</button>\n                ' + probeButton, replacement);
  } else {
    fail("Could not find diagnostics probe button anchor.");
  }
}

// Make visible text clearer.
buddy = buddy.replace(
  "External/local bridge is idle because Homie is set to cloud mode.",
  "External/local bridge is idle because Homie is set to cloud mode. Click Use local bridge to use 127.0.0.1:8765."
);

if (!buddy.includes("v10.36.70 checker-safe marker")) {
  buddy = buddy.replace(
    "export default function HomieBuddy",
    "// v10.36.70 checker-safe marker: direct browser voice bridge fallback installed\nexport default function HomieBuddy"
  );
}

fs.writeFileSync(buddyPath, buddy, "utf8");

console.log("[" + VERSION + "] Applied direct browser bridge fallback.");
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");