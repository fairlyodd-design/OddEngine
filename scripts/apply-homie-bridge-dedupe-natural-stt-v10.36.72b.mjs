import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.72b";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const coachPath = path.join(root, "ui", "src", "lib", "homieCompanionCoach.ts");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");
const highAccuracyBatPath = path.join(root, "RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.72.bat");

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

function removeBlock(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return { text, removed: false };
  const end = text.indexOf(endMarker, start);
  if (end === -1) return { text, removed: false };
  const after = end + endMarker.length;
  return { text: (text.slice(0, start) + text.slice(after)).replace(/\n{3,}/g, "\n\n"), removed: true };
}

function countMatches(text, needle) {
  return text.split(needle).length - 1;
}

ensureFile(buddyPath, "HomieBuddy.tsx");
ensureFile(coachPath, "homieCompanionCoach.ts");
ensureFile(cssPath, "homieRebuild.css");

backup(buddyPath);
backup(coachPath);
backup(cssPath);

let buddy = fs.readFileSync(buddyPath, "utf8");
let coach = fs.readFileSync(coachPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

if (!buddy.includes("export default function HomieBuddy")) fail("HomieBuddy.tsx shape not recognized.");
if (!coach.includes("export function buildHomieCompanionReply")) fail("homieCompanionCoach.ts shape not recognized.");

// ===== 1) Repair duplicate bridge helper functions =====
// The broken state has both v10.36.70 and v10.36.70b helper blocks. Keep 70b because it has visible local bridge controls and activation.
let removed70 = false;
if (buddy.includes("v10.36.70 Homie direct browser bridge helpers") && buddy.includes("v10.36.70b Homie visible local bridge helpers")) {
  const result = removeBlock(
    buddy,
    "  // ===== v10.36.70 Homie direct browser bridge helpers =====",
    "  // ===== v10.36.70 Homie direct browser bridge helpers END ====="
  );
  buddy = result.text;
  removed70 = result.removed;
}

// If markers were damaged but duplicates still exist, remove the first duplicate helper group by function boundaries.
const duplicateFunctionNames = [
  "function normalizeHomieBridgeBaseUrl",
  "function isDesktopBridgeUnavailable",
  "async function homieBridgeFetchJson",
  "async function callHomieVoiceBridgeProbe",
  "async function callHomieVoiceBridgeTranscribe",
];

if (countMatches(buddy, "function normalizeHomieBridgeBaseUrl") > 1) {
  // Remove the first occurrence group ending just before the second occurrence.
  const first = buddy.indexOf("  function normalizeHomieBridgeBaseUrl");
  const second = buddy.indexOf("  function normalizeHomieBridgeBaseUrl", first + 1);
  if (first !== -1 && second !== -1) {
    // Prefer removing backward to the marker if nearby, otherwise from first function start.
    const markerStart = buddy.lastIndexOf("  // ===== v10.36.70", first);
    const safeStart = markerStart !== -1 && first - markerStart < 400 ? markerStart : first;
    buddy = (buddy.slice(0, safeStart) + buddy.slice(second)).replace(/\n{3,}/g, "\n\n");
  }
}

for (const name of duplicateFunctionNames) {
  const count = countMatches(buddy, name);
  if (count > 1) {
    fail("Duplicate bridge helper still present after repair: " + name + " count=" + count);
  }
}

// Make sure the remaining probe helper accepts forceDirect. If not, upgrade signature and call behavior lightly.
buddy = buddy.replace(
  "async function callHomieVoiceBridgeProbe(payload: any) {",
  "async function callHomieVoiceBridgeProbe(payload: any, forceDirect = false) {"
);
buddy = buddy.replace(
  "if (!forceDirect) {\n      try { desktopResult = await api.voiceBridgeProbe?.(payload); }",
  "if (!forceDirect) {\n      try { desktopResult = await api.voiceBridgeProbe?.(payload); }"
);

// ===== 2) Make Say Test not spam boilerplate and mark STT drift =====
// We patch the coach to produce natural short replies and correction guidance.
if (!coach.includes("v10.36.72b Homie natural STT repair helpers")) {
  const helperAnchor = "export function buildHomieCompanionReply";
  const helperBlock = [
    "// ===== v10.36.72b Homie natural STT repair helpers =====",
    "function homieNormalizeHeardText(text: string) {",
    "  return cleanPrompt(String(text || \"\"))",
    "    .replace(/[“”]/g, '\"')",
    "    .replace(/[’]/g, \"'\")",
    "    .replace(/\\s+/g, \" \")",
    "    .trim();",
    "}",
    "",
    "function homieIsTinyVoiceAck(text: string) {",
    "  const lower = homieNormalizeHeardText(text).toLowerCase();",
    "  return /^(ok|okay|yeah|yes|yep|no|nope|thanks|thank you|nice|cool|sweet|now|good|got it|hell yeah|lol|lmao|yup)[.!?]*$/.test(lower);",
    "}",
    "",
    "function homieLooksLikeSTTDrift(text: string) {",
    "  const lower = homieNormalizeHeardText(text).toLowerCase();",
    "  if (!lower) return true;",
    "  if (/\\b(going to this here we now|to this here we now|this here we now|do this here we now|going to this here)\\b/.test(lower)) return true;",
    "  const words = lower.split(/\\s+/).filter(Boolean);",
    "  if (words.length >= 5) {",
    "    const filler = words.filter((word) => /^(to|the|a|an|we|me|you|it|is|are|this|that|here|now|going)$/.test(word)).length;",
    "    if (filler / words.length > 0.68) return true;",
    "  }",
    "  return false;",
    "}",
    "",
    "function homieCorrectionText(text: string) {",
    "  const match = homieNormalizeHeardText(text).match(/^(correction|correct that|i said|what i said was)[:\\s-]+(.+)$/i);",
    "  return match?.[2]?.trim() || \"\";",
    "}",
    "",
    "function buildHomieTinyAckReply(text: string): HomieCompanionReply {",
    "  const heard = homieNormalizeHeardText(text);",
    "  const isThanks = /^(thanks|thank you|appreciate it|nice|awesome|hell yeah|cool|sweet)[.!?]*$/i.test(heard);",
    "  const displayText = isThanks",
    "    ? \"Anytime, Homie. I’m here and listening.\"",
    "    : \"Got it. I heard: \\\"\" + heard + \"\\\". Say the next full sentence when you’re ready.\";",
    "  return { text: displayText, displayText, spokenText: isThanks ? \"Anytime, Homie. I’m listening.\" : \"Got it. Say the next full sentence when you’re ready.\", mood: \"good\", tags: [\"voice\"], nextStep: \"Say one full sentence, or say correction followed by the exact words.\" };",
    "}",
    "",
    "function buildHomieSTTDriftReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply {",
    "  const heard = homieNormalizeHeardText(text) || \"blank audio\";",
    "  const displayText = [",
    "    \"I heard: \\\"\" + heard + \"\\\".\",",
    "    \"That sounds like transcription drift, not a clean instruction. I won’t pretend I understood it perfectly.\",",
    "    \"Try: say it again slower, say \\\"correction: ...\\\" with the exact words, or type the important part once.\",",
    "    \"Current lane: \" + ctx.activePanelTitle + \".\"",
    "  ].join(\"\\n\\n\");",
    "  return { text: displayText, displayText, spokenText: \"I heard something, but it sounds like transcription drift. Say correction followed by the exact words, or repeat it slower.\", mood: \"warn\", tags: [\"voice\", \"stt-drift\"], nextStep: \"Say: correction, then the exact words you wanted Homie to use.\" };",
    "}",
    "",
    "function buildHomieCorrectionReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply {",
    "  const corrected = homieCorrectionText(text);",
    "  const displayText = [",
    "    \"Correction received.\",",
    "    \"Clean wording: \\\"\" + corrected + \"\\\"\",",
    "    \"I’ll use that instead of the messy transcript.\",",
    "    \"Current lane: \" + ctx.activePanelTitle + \".\"",
    "  ].join(\"\\n\\n\");",
    "  return { text: displayText, displayText, spokenText: \"Got it. I’ll use the corrected wording.\", mood: \"good\", tags: detectThemes(corrected), nextStep: \"Now say the command or question with that clean wording, or type it once.\" };",
    "}",
    "",
    "function buildHomieNaturalCompanionDisplay(workingText: string, themes: string[], ctx: HomieCompanionContext, nextStep: string) {",
    "  const heard = homieNormalizeHeardText(workingText);",
    "  const lines = [",
    "    ctx.source === \"voice\" ? \"I heard: \\\"\" + heard + \"\\\".\" : \"Got you.\",",
    "    \"Current lane: \" + ctx.activePanelTitle + \".\"",
    "  ];",
    "  if (themes.includes(\"creative\")) lines.push(\"Creative read: turn it into one saved artifact, not a giant universe.\");",
    "  else if (themes.includes(\"money\")) lines.push(\"Money read: keep it practical, small, and explainable.\");",
    "  else if (themes.includes(\"family\")) lines.push(\"Family read: make it easy for someone else to open later.\");",
    "  else if (themes.includes(\"grounding\") || themes.includes(\"health\")) lines.push(\"Grounding read: slow it down and make the next move tiny.\");",
    "  else lines.push(\"Useful read: I can explain, organize, route panels, remember notes, or help pick the next move.\");",
    "  lines.push(\"Next move: \" + nextStep);",
    "  return lines.join(\"\\n\\n\");",
    "}",
    "// ===== v10.36.72b Homie natural STT repair helpers END =====",
    "",
    helperAnchor
  ].join("\n");
  coach = replaceOnce(coach, helperAnchor, helperBlock, "insert natural STT helpers");
}

// Replace buildHomieCompanionReply function with natural version.
const start = coach.indexOf("export function buildHomieCompanionReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply {");
const end = coach.indexOf("\nexport function buildHomieCompanionCheckIn", start);
if (start === -1 || end === -1) fail("Could not locate buildHomieCompanionReply bounds.");

const newReplyBuilder = [
  "export function buildHomieCompanionReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply {",
  "  const cleaned = cleanPrompt(text);",
  "  const workingText = cleaned || text;",
  "  const normalized = homieNormalizeHeardText(workingText);",
  "  const memory = loadMemory();",
  "  const correction = homieCorrectionText(workingText);",
  "",
  "  if (correction) {",
  "    const reply = buildHomieCorrectionReply(workingText, ctx);",
  "    remember(reply.tags, correction, reply.text, reply.nextStep || \"Use the corrected wording.\", reply.artifact, false);",
  "    return reply;",
  "  }",
  "",
  "  if (ctx.source === \"voice\" && homieLooksLikeSTTDrift(normalized)) {",
  "    const reply = buildHomieSTTDriftReply(normalized, ctx);",
  "    remember(reply.tags, normalized, reply.text, reply.nextStep || \"Repeat the phrase or say correction.\", undefined, false);",
  "    return reply;",
  "  }",
  "",
  "  if (ctx.source === \"voice\" && homieIsTinyVoiceAck(normalized)) {",
  "    const reply = buildHomieTinyAckReply(normalized);",
  "    remember(reply.tags, normalized, reply.text, reply.nextStep || \"Say one full sentence next.\", undefined, false);",
  "    return reply;",
  "  }",
  "",
  "  const themes = detectThemes(workingText);",
  "  const checkIn = /check in|how am i|how are we|life coach|coach me|ground me|help me focus|talk to me/i.test(text);",
  "  const nextStep = nextStepFor(themes, workingText);",
  "  const artifact = shouldCreateLegacyArtifact(themes, text) ? buildLegacyArtifact(workingText, ctx, nextStep) : undefined;",
  "",
  "  let displayText = buildHomieNaturalCompanionDisplay(workingText, themes, ctx, nextStep);",
  "  if (artifact) displayText += \"\\n\\nFamily artifact: drafted \" + artifact.title + \". Review before final family use.\";",
  "",
  "  if (startsLikeRepeat(displayText, memory)) {",
  "    displayText = [",
  "      \"Same lane, cleaner pass.\",",
  "      ctx.source === \"voice\" ? \"I heard: \\\"\" + normalized + \"\\\".\" : \"What I heard: \" + normalized,",
  "      \"Current lane: \" + ctx.activePanelTitle + \".\",",
  "      \"Next move: \" + nextStep",
  "    ].join(\"\\n\\n\");",
  "  }",
  "",
  "  const spokenText = ctx.source === \"voice\"",
  "    ? (\"I heard: \" + normalized + \". Next move: \" + nextStep).replace(/\\s+/g, \" \").slice(0, 260)",
  "    : formatSpokenReply(openingLine(themes, memory, checkIn, text), nextStep, themes);",
  "",
  "  remember(themes, workingText, displayText, nextStep, artifact, checkIn);",
  "  const mood: HomieCompanionMood = themes.includes(\"grounding\") || themes.includes(\"health\") ? \"warn\" : \"good\";",
  "  return { text: displayText, displayText, spokenText, mood, tags: themes, nextStep, artifact };",
  "}",
  ""
].join("\n");

coach = coach.slice(0, start) + newReplyBuilder + coach.slice(end + 1);

coach = coach.replace(
  'return buildHomieCompanionReply(`Homie, check in with me from ${ctx.activePanelTitle}. Body, mind, family, next move.`, { ...ctx, source: ctx.source || "quick" });',
  'return buildHomieCompanionReply(`Homie, quick companion check from ${ctx.activePanelTitle}. Give me the useful read and one small next move.`, { ...ctx, source: ctx.source || "quick" });'
);

if (!coach.includes("v10.36.72b checker-safe marker")) {
  coach = "// v10.36.72b checker-safe marker: duplicate bridge repair plus natural STT replies installed\n" + coach;
}

fs.writeFileSync(coachPath, coach, "utf8");

// ===== 3) Buddy copy polish + high-accuracy bridge starter =====
buddy = buddy.split("Permission means the browser may use the mic. Signal means audio moved. Transcript means Homie actually caught words.")
  .join("Permission means the browser may use the mic. Signal means audio moved. Transcript means Homie caught words. If words are wrong, use Correction or high-accuracy bridge.");

buddy = buddy.split("Heads up: browser Say test uses SpeechRecognition. Bridge say test records audio and sends it to the local 8765 Whisper bridge.")
  .join("Heads up: Bridge say test records audio and sends it to the local 8765 Whisper bridge. If transcripts are messy, stop the old bridge and run RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.72.bat.");

if (!buddy.includes("v10.36.72b checker-safe marker")) {
  buddy = buddy.replace(
    "export default function HomieBuddy",
    "// v10.36.72b checker-safe marker: bridge dedupe repair installed\nexport default function HomieBuddy"
  );
}

fs.writeFileSync(buddyPath, buddy, "utf8");

const cssStart = "/* ===== v10.36.72b Homie STT Natural Reply Repair ===== */";
const cssEnd = "/* ===== v10.36.72b Homie STT Natural Reply Repair END ===== */";
if (css.includes(cssStart) && css.includes(cssEnd)) {
  const s = css.indexOf(cssStart);
  const e = css.indexOf(cssEnd, s) + cssEnd.length;
  css = (css.slice(0, s) + css.slice(e)).trimEnd();
}
css = css.trimEnd() + "\n\n" + [
  cssStart,
  ".homieBridgeProofCard .small, .homieMicProofMeter .small{",
  "  line-height: 1.42;",
  "}",
  cssEnd
].join("\n") + "\n";
fs.writeFileSync(cssPath, css, "utf8");

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
fs.writeFileSync(highAccuracyBatPath, bat, "utf8");

console.log("[" + VERSION + "] Applied duplicate bridge helper repair + natural STT reply polish.");
console.log("Removed old v10.36.70 helper block: " + (removed70 ? "yes" : "not needed"));
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");
console.log("- ui/src/lib/homieCompanionCoach.ts");
console.log("- ui/src/components/homieRebuild.css");
console.log("- RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.72.bat");