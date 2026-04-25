import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.73c";
const root = process.cwd();
const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const coachPath = path.join(root, "ui", "src", "lib", "homieCompanionCoach.ts");
const batPath = path.join(root, "RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.73.bat");

function fail(message) { console.error("[" + VERSION + "] " + message); process.exit(1); }
function backup(filePath) { const dst = filePath + ".bak_" + VERSION; if (!fs.existsSync(dst)) fs.copyFileSync(filePath, dst); }
function countMatches(text, needle) { return text.split(needle).length - 1; }

function findMatchingBrace(text, openIndex) {
  let depth = 0, quote = "", escaped = false, lineComment = false, blockComment = false;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (lineComment) { if (ch === "\n") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i++; } continue; }
    if (quote) { if (escaped) { escaped = false; continue; } if (ch === "\\") { escaped = true; continue; } if (ch === quote) quote = ""; continue; }
    if (ch === "/" && next === "/") { lineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i++; continue; }
    if (ch === "\"" || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function findFunctionSpan(text, name, from = 0) {
  const patterns = ["async function " + name, "function " + name];
  let idx = -1;
  for (const pattern of patterns) {
    const at = text.indexOf(pattern, from);
    if (at !== -1 && (idx === -1 || at < idx)) idx = at;
  }
  if (idx === -1) return null;
  let start = idx;
  while (start > 0 && text[start - 1] !== "\n") start--;
  const open = text.indexOf("{", idx);
  const close = open === -1 ? -1 : findMatchingBrace(text, open);
  if (open === -1 || close === -1) return null;
  let end = close + 1;
  while (end < text.length && /[ \t\r\n]/.test(text[end])) end++;
  return { start, end };
}

function dedupeFunction(text, name) {
  const spans = [];
  let search = 0;
  while (true) {
    const span = findFunctionSpan(text, name, search);
    if (!span) break;
    spans.push(span);
    search = span.end;
  }
  if (spans.length <= 1) return text;
  let next = text;
  for (let i = spans.length - 2; i >= 0; i--) next = next.slice(0, spans[i].start) + next.slice(spans[i].end);
  return next.replace(/\n{3,}/g, "\n\n");
}

if (!fs.existsSync(buddyPath)) fail("Missing " + buddyPath);
if (!fs.existsSync(coachPath)) fail("Missing " + coachPath);
backup(buddyPath);
backup(coachPath);

let buddy = fs.readFileSync(buddyPath, "utf8");
let coach = fs.readFileSync(coachPath, "utf8");

for (const name of ["normalizeHomieBridgeBaseUrl", "isDesktopBridgeUnavailable", "homieBridgeFetchJson", "callHomieVoiceBridgeProbe", "callHomieVoiceBridgeTranscribe"]) {
  buddy = dedupeFunction(buddy, name);
}

if (!buddy.includes("runHomieLocalBridgeSayTest")) {
  const anchor = "  async function getExternalBridgeReadiness(force = false, baseState?: VoiceDiagnostics) {";
  if (!buddy.includes(anchor)) fail("Missing getExternalBridgeReadiness anchor.");
  const helper = [
    "  // ===== v10.36.73c Homie bridge say test helper =====",
    "  async function runHomieLocalBridgeSayTest() {",
    "    persistHomiePrefs({ homieVoiceEngineMode: \"external-http\", homieExternalVoiceBaseUrl: externalVoiceBaseUrl || \"http://127.0.0.1:8765\", homieExternalVoiceTimeoutMs: 120000 } as any);",
    "    setStatus(\"Bridge say test is listening — say one clear sentence, then click Stop listening.\");",
    "    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: \"recording\", externalBridgeMessage: \"Bridge say test records audio and sends it to /transcribe.\", lastErrorCode: \"\", lastErrorMessage: \"\" }));",
    "    await startVoice(false, true, false, false, \"bridge-say-test\");",
    "  }",
    "  // ===== v10.36.73c Homie bridge say test helper END =====",
    "",
  ].join("\n");
  buddy = buddy.replace(anchor, helper + anchor);
}

if (!buddy.includes('data-homie-bridge-say-test="v10.36.73c"')) {
  const bridgeButton = '            <button className={"tabBtn " + (voiceEngineMode === "external-http" ? "active" : "")} data-homie-bridge-say-test="v10.36.73c" onClick={() => { voiceEngineMode === "external-http" ? void runHomieLocalBridgeSayTest() : void startVoice(false, true, false, false, "mic-proof"); }}>{voiceEngineMode === "external-http" ? "Bridge say test" : "Say test"}</button>';
  const micButton = '            <button className="tabBtn" onClick={() => void runMicTest()}>Mic test</button>';
  const micPermButton = '            <button className="tabBtn" onClick={() => void runMicTest()}>Mic permission</button>';
  if (buddy.includes(micPermButton)) buddy = buddy.replace(micPermButton, bridgeButton + "\n" + micPermButton);
  else if (buddy.includes(micButton)) buddy = buddy.replace(micButton, bridgeButton + "\n" + micButton);
  else fail("Missing mic button anchor for Bridge say test insert.");
}

buddy = buddy.replace(
  'setStatus("Heard you. I’m answering.");\n      setMood("good");\n      window.setTimeout(() => run(transcript), 90);',
  'setStatus("Bridge heard: " + transcript + ". Answering now.");\n      setMood("good");\n      window.setTimeout(() => run(transcript), 90);'
);

if (!buddy.includes("v10.36.73c checker-safe marker")) {
  buddy = buddy.replace("export default function HomieBuddy", "// v10.36.73c checker-safe marker: bridge launcher and say test crash hotfix installed\nexport default function HomieBuddy");
}
fs.writeFileSync(buddyPath, buddy, "utf8");

if (!coach.includes("v10.36.73c Homie short STT reply helpers")) {
  const helperAnchor = "export function buildHomieCompanionReply";
  const helper = [
    "// ===== v10.36.73c Homie short STT reply helpers =====",
    "function homieV73cNormalize(text: string) { return cleanPrompt(String(text || \"\")).replace(/\\s+/g, \" \" ).trim(); }",
    "function homieV73cShortAck(text: string) { return /^(ok|okay|yeah|yes|yep|no|nope|thanks|thank you|nice|cool|sweet|now|good|got it|hell yeah|lol|lmao|yup)[.!?]*$/i.test(homieV73cNormalize(text)); }",
    "function homieV73cDrift(text: string) { const lower = homieV73cNormalize(text).toLowerCase(); if (/\\b(going to this here we now|to this here we now|this here we now|do this here we now|going to this here)\\b/.test(lower)) return true; const words = lower.split(/\\s+/).filter(Boolean); if (words.length >= 5) { const filler = words.filter((w) => /^(to|the|a|an|we|me|you|it|is|are|this|that|here|now|going)$/.test(w)).length; return filler / words.length > 0.68; } return false; }",
    "function homieV73cShortReply(text: string): HomieCompanionReply { const heard = homieV73cNormalize(text); const thanks = /^(thanks|thank you|appreciate it|nice|awesome|hell yeah|cool|sweet)[.!?]*$/i.test(heard); const displayText = thanks ? \"Anytime, Homie. I’m here and listening.\" : \"Got it. I heard: \\\"\" + heard + \"\\\". Say the next full sentence when you’re ready.\"; return { text: displayText, displayText, spokenText: thanks ? \"Anytime, Homie. I’m listening.\" : \"Got it. Say the next full sentence when you’re ready.\", mood: \"good\", tags: [\"voice\"], nextStep: \"Say one full sentence, or say correction followed by the exact words.\" }; }",
    "function homieV73cDriftReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply { const heard = homieV73cNormalize(text) || \"blank audio\"; const displayText = [\"I heard: \\\"\" + heard + \"\\\".\", \"That sounds like transcription drift, not a clean instruction. I won’t pretend I understood it perfectly.\", \"Try: say it again slower, say correction with the exact words, or type the important part once.\", \"Current lane: \" + ctx.activePanelTitle + \".\"].join(\"\\n\\n\"); return { text: displayText, displayText, spokenText: \"I heard something, but it sounds like transcription drift. Say correction followed by the exact words, or repeat it slower.\", mood: \"warn\", tags: [\"voice\", \"stt-drift\"], nextStep: \"Say: correction, then the exact words you wanted Homie to use.\" }; }",
    "// ===== v10.36.73c Homie short STT reply helpers END =====",
    "",
    helperAnchor
  ].join("\n");
  coach = coach.replace(helperAnchor, helper);
}

const workingAnchor = "  const workingText = cleaned || text;";
if (coach.includes(workingAnchor) && !coach.includes("v10.36.73c short voice early return")) {
  const early = [
    workingAnchor,
    "  // v10.36.73c short voice early return: avoid essaying over tiny/noisy STT.",
    "  if (ctx.source === \"voice\" && homieV73cShortAck(workingText)) {",
    "    const reply = homieV73cShortReply(workingText);",
    "    remember(reply.tags, workingText, reply.text, reply.nextStep || \"Say one full sentence next.\", undefined, false);",
    "    return reply;",
    "  }",
    "  if (ctx.source === \"voice\" && homieV73cDrift(workingText)) {",
    "    const reply = homieV73cDriftReply(workingText, ctx);",
    "    remember(reply.tags, workingText, reply.text, reply.nextStep || \"Repeat or correct the phrase.\", undefined, false);",
    "    return reply;",
    "  }"
  ].join("\n");
  coach = coach.replace(workingAnchor, early);
}

coach = coach.split("Useful read: keep Homie as an informational family/OS companion first — explain, organize, remember, route panels, and help with practical next moves. Save the deep support voice for when you explicitly ask for grounding.")
  .join("Useful read: I can explain, organize, route panels, remember notes, or help pick the next move.");

if (!coach.includes("v10.36.73c checker-safe marker")) {
  coach = "// v10.36.73c checker-safe marker: natural short STT replies installed\n" + coach;
}
fs.writeFileSync(coachPath, coach, "utf8");

const bat = [
  "@echo off",
  "setlocal",
  "cd /d \"%~dp0\"",
  "echo ========================================",
  "echo   Homie Voice Bridge HIGH ACCURACY",
  "echo ========================================",
  "echo.",
  "echo This uses HOMIE_WHISPER_MODEL=base.en instead of tiny.en.",
  "echo If port 8765 is already in use, close the old bridge window first.",
  "echo First run may download/load the model and take longer.",
  "echo.",
  "set HOMIE_WHISPER_MODEL=base.en",
  "set HOMIE_VOICE_PORT=8765",
  "node backend_scaffold\\homie-voice-bridge.mjs",
  "pause"
].join("\r\n");
fs.writeFileSync(batPath, bat, "utf8");

console.log("[" + VERSION + "] Applied crash hotfix + created high-accuracy bridge launcher.");
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");
console.log("- ui/src/lib/homieCompanionCoach.ts");
console.log("- RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.73.bat");
