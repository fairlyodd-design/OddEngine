import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.67";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const coachPath = path.join(root, "ui", "src", "lib", "homieCompanionCoach.ts");

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
ensureFile(coachPath, "homieCompanionCoach.ts");
backup(buddyPath);
backup(coachPath);

let buddy = fs.readFileSync(buddyPath, "utf8");
let coach = fs.readFileSync(coachPath, "utf8");

if (!buddy.includes("export default function HomieBuddy")) fail("HomieBuddy.tsx shape not recognized.");
if (!coach.includes("export function buildHomieCompanionReply")) fail("homieCompanionCoach.ts shape not recognized.");

// ===== HomieBuddy voice/camera reality polish =====

// Camera is visual only. Make that explicit anywhere the user would assume it can hear.
const cameraTextReplacements = [
  [
    "Camera preview is off. Homie is not sampling visual signals.",
    "Camera preview is off. Camera is visual only; Homie is not listening through it."
  ],
  [
    "Camera is off. Camera opens only when clicked. No video is analyzed or saved.",
    "Camera is off. Camera is visual only; use mic buttons for hearing. No video is saved."
  ],
  [
    "Camera preview is live and local. No video is analyzed beyond simple brightness/motion signals or saved.",
    "Camera preview is live and local. Camera is visual only; Homie listens only through the mic buttons. No video is saved."
  ],
  [
    "Camera preview is live and local. Homie is only sampling simple brightness/motion signals: ",
    "Camera preview is live and local. Camera is visual only. Homie is only sampling simple brightness/motion signals: "
  ],
  [
    "Camera preview is live. I am only sampling simple brightness and motion signals, and I am not saving video.",
    "Camera preview is live. I am only sampling brightness and motion. I am not listening through the camera or saving video."
  ],
  [
    "Camera preview live.",
    "Camera preview live. Mic is separate."
  ],
  [
    "Opt-in preview. Local only. Homie samples brightness/motion, not identity.",
    "Opt-in visual preview. Local only. Mic is separate."
  ],
  [
    "Click Start camera when you want Homie to read simple room signals.",
    "Click Start camera for simple light/motion signals. Use Start listening or Talk by mic for hearing."
  ],
  [
    "Truth note: Homie is not identifying people or objects here. This lane only reports simple brightness/motion signals unless a future vision model is explicitly added.",
    "Truth note: Homie is not identifying people or objects here, and the camera does not listen. This lane only reports simple brightness/motion signals unless a future vision model is explicitly added."
  ],
  [
    "<div className=\"small\"><b>Camera note:</b> Camera opens only when clicked. No video is analyzed or saved.</div>",
    "<div className=\"small\"><b>Camera note:</b> Camera is visual only. Use Start listening, Hold to talk, or Talk by mic for voice.</div>"
  ]
];

for (const [from, to] of cameraTextReplacements) {
  if (buddy.includes(from)) buddy = buddy.split(from).join(to);
}

// Map no-speech into something useful, not mysterious.
buddy = buddy.replace(
  'return "The microphone started, but no speech was detected before recognition ended.";',
  'return "The microphone opened, but I did not catch words. Camera does not carry voice here. Try Start listening, say one short sentence clearly, or check your Windows input device.";'
);

// Make listening state tell user exactly what to do.
buddy = buddy.replace(
  'setStatus(pushToTalk ? "Hold to talk is live." : "I’m listening.");',
  'setStatus(pushToTalk ? "Hold to talk is live — speak while holding." : "Listening — say one short sentence now.");'
);
buddy = buddy.replace(
  'emitVoiceStatus({ source, status: "started", message: pushToTalk ? "Hold to talk is live." : "Listening.", mode: "cloud" });',
  'emitVoiceStatus({ source, status: "started", message: pushToTalk ? "Hold to talk is live — speak while holding." : "Listening — say one short sentence now.", mode: "cloud" });'
);

// Make mic test label honest.
buddy = buddy.replace(
  'announce(`Mic test passed. ${fresh.audioInputCount || 1} audio input${fresh.audioInputCount === 1 ? "" : "s"} detected.`, "good", true, "Mic test passed.");',
  'announce(`Mic permission passed. ${fresh.audioInputCount || 1} audio input${fresh.audioInputCount === 1 ? "" : "s"} detected. This proves permission, not transcript. Use Say test to prove Homie heard words.`, "good", true, "Mic permission passed. Use Say test to prove transcript.");'
);

// Add a one-click transcript proof button beside Mic test.
if (!buddy.includes("Mic proof")) {
  const micTestButton = '<button className="tabBtn" onClick={() => void runMicTest()}>Mic test</button>';
  const replacement = [
    '<button className="tabBtn" onClick={() => void runMicTest()}>Mic permission</button>',
    '<button className="tabBtn" onClick={() => { setStatus("Mic proof is listening — say: Homie can hear me."); void startVoice(false, true, false, false, "mic-proof"); }}>Say test</button>'
  ].join("\n            ");
  buddy = replaceOnce(buddy, micTestButton, replacement, "mic test button");
}

// Improve transcript proof result status before the normal run.
const transcriptNeedle = 'setStatus("Heard you. I’m answering.");\n        setMood("good");\n        window.setTimeout(() => run(transcript), 90);';
const transcriptReplacement = 'setStatus("Mic heard: " + transcript + ". Answering now.");\n        setMood("good");\n        window.setTimeout(() => run(transcript), 90);';
if (buddy.includes(transcriptNeedle)) buddy = buddy.replace(transcriptNeedle, transcriptReplacement);

// Voice meta should show transcript proof guidance.
if (!buddy.includes("data-homie-mic-reality=\"v10.36.67\"")) {
  const voiceMetaNeedle = '<div className="small"><b>Last transcript:</b> {diagnostics.lastTranscript || "—"}</div>';
  const voiceMetaReplacement = [
    voiceMetaNeedle,
    '            <div className="small" data-homie-mic-reality="v10.36.67"><b>Mic reality:</b> Camera is visual only. For hearing, click Say test and watch Last transcript.</div>'
  ].join("\n");
  buddy = replaceOnce(buddy, voiceMetaNeedle, voiceMetaReplacement, "voice meta transcript guidance");
}

// Check marker.
if (!buddy.includes("v10.36.67 checker-safe marker")) {
  buddy = buddy.replace(
    "export default function HomieBuddy",
    "// v10.36.67 checker-safe marker: mic reality and camera-not-a-mic guidance installed\nexport default function HomieBuddy"
  );
}

fs.writeFileSync(buddyPath, buddy, "utf8");

// ===== Companion tone retune =====

// Add plain family companion helpers before the exported reply builder.
if (!coach.includes("v10.36.67 Homie plain family companion tone helpers")) {
  const helperBlock = [
    '// ===== v10.36.67 Homie plain family companion tone helpers =====',
    'function isHomieMicCameraQuestion(text: string) {',
    '  const lower = text.trim().toLowerCase();',
    '  return /\\b(mic|microphone|camera|cam|hear me|heard me|listen|listening|transcript|voice|speaker|can you hear|can hear you|cannot hear|can\\\'t hear|not hearing|through cam|through camera)\\b/.test(lower);',
    '}',
    '',
    'function isStrongSupportPrompt(text: string) {',
    '  const lower = text.trim().toLowerCase();',
    '  return /\\b(overwhelmed|panic|scared|sad|grief|heavy|burned out|spiral|ground me|stressed|anxious|pain|sick|medical|doctor)\\b/.test(lower);',
    '}',
    '',
    'function wantsBodyMindFamily(text: string) {',
    '  const lower = text.trim().toLowerCase();',
    '  return /\\b(body mind family|body, mind, family|ground me|overwhelmed|check in|daily rhythm|what matters today|start my day)\\b/.test(lower);',
    '}',
    '',
    'function companionOpening(text: string, themes: string[], ctx: HomieCompanionContext) {',
    '  const lower = text.trim().toLowerCase();',
    '  if (isHomieMicCameraQuestion(text)) return "Yep — let’s separate the lanes clearly.";',
    '  if (/\\b(thanks|nice|awesome|hell yeah|lol|lmao|fire|🔥|👊)\\b/i.test(text)) return "Hell yeah — that’s the right direction.";',
    '  if (themes.includes("creative")) return "Got you — creative lane.";',
    '  if (themes.includes("family")) return "Got you — family lane.";',
    '  if (themes.includes("money")) return "Got you — money lane.";',
    '  if (isStrongSupportPrompt(text)) return "I’m with you — we’ll keep it simple, not dramatic.";',
    '  return "Got you — companion mode."; ',
    '}',
    '',
    'function companionInfoReply(text: string, themes: string[], ctx: HomieCompanionContext, nextStep: string) {',
    '  const lower = text.trim().toLowerCase();',
    '  if (isHomieMicCameraQuestion(text)) {',
    '    return formatDisplayReply([',
    '      "Yep — let’s separate the lanes clearly.",',
    '      "Speaker out: working, because you can hear Homie.",',
    '      "Mic in: use Start listening, Hold to talk, Talk by mic, or the new Say test button. Homie only knows he heard you when Last transcript fills in.",',
    '      "Camera: visual only right now. It shows preview and samples simple brightness/motion. It does not hear audio, identify people, or understand objects yet.",',
    '      "Next move: click Say test, say “Homie can hear me,” then check Last transcript. If it stays blank, the issue is the browser/Windows input path, not the camera."',
    '    ]);',
    '  }',
    '',
    '  if (wantsBodyMindFamily(text) || isStrongSupportPrompt(text)) {',
    '    return formatDisplayReply([',
    '      companionOpening(text, themes, ctx),',
    '      "Body: quick status only — no drama. Breathe once, then check whether you need water, food, rest, or a break.",',
    '      "Mind: shrink the task until it has one visible next action.",',
    '      "Family: keep the handoff understandable. Save one thing they can open later.",',
    '      "Next move: " + nextStep',
    '    ]);',
    '  }',
    '',
    '  return formatDisplayReply([',
    '    companionOpening(text, themes, ctx),',
    '    "What I heard: " + (cleanPrompt(text) || "you want a practical next step").slice(0, 220),',
    '    "Useful read: keep Homie as a helpful family/OS companion first — explain, organize, remember, and route. Save the deep support voice for when you actually ask for grounding.",',
    '    "Current lane: " + ctx.activePanelTitle + ".",',
    '    "Next move: " + nextStep',
    '  ]);',
    '}',
    '',
    'function companionSpokenFromDisplay(displayText: string) {',
    '  const compact = displayText',
    '    .replace(/\\n+/g, " ")',
    '    .replace(/Speaker out:/g, "Speaker out is")',
    '    .replace(/Mic in:/g, "Mic in is")',
    '    .replace(/Camera:/g, "Camera is")',
    '    .replace(/Next move:/g, "Next move:")',
    '    .replace(/\\s+/g, " ")',
    '    .trim();',
    '  if (compact.length <= 260) return compact;',
    '  return compact.slice(0, 257) + "...";',
    '}',
    '// ===== v10.36.67 Homie plain family companion tone helpers END =====',
    ''
  ].join("\n");

  const buildNeedle = "export function buildHomieCompanionReply";
  coach = replaceOnce(coach, buildNeedle, helperBlock + buildNeedle, "buildHomieCompanionReply helper insertion");
}

// Replace exported reply builder with calmer, more informational companion style.
const replyStart = coach.indexOf("export function buildHomieCompanionReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply {");
const replyEnd = coach.indexOf("\nexport function buildHomieCompanionCheckIn", replyStart);
if (replyStart === -1 || replyEnd === -1) fail("Could not find buildHomieCompanionReply replacement anchors.");

const newReplyBuilder = [
  'export function buildHomieCompanionReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply {',
  '  const cleaned = cleanPrompt(text);',
  '  const workingText = cleaned || text;',
  '  const themes = detectThemes(workingText);',
  '  const checkIn = /check in|how am i|how are we|daily rhythm|what matters today|ground me|help me focus|talk to me/i.test(text);',
  '  const nextStep = nextStepFor(themes, workingText);',
  '  const artifact = shouldCreateLegacyArtifact(themes, text) ? buildLegacyArtifact(workingText, ctx, nextStep) : undefined;',
  '',
  '  let displayText = companionInfoReply(workingText, themes, ctx, nextStep);',
  '  const memory = loadMemory();',
  '  if (startsLikeRepeat(displayText, memory)) {',
  '    displayText = formatDisplayReply([',
  '      "Same lane, cleaner wording this time.",',
  '      "What I heard: " + (workingText || "you want a practical next step").slice(0, 220),',
  '      "Useful read: Homie should answer like a clear family/OS companion unless you explicitly ask for grounding.",',
  '      "Next move: " + nextStep',
  '    ]);',
  '  }',
  '',
  '  if (artifact) displayText += "\\n\\nFamily artifact: drafted " + artifact.title + ". Review before final family use."; ',
  '',
  '  const spokenText = companionSpokenFromDisplay(displayText);',
  '  remember(themes, workingText, displayText, nextStep, artifact, checkIn);',
  '  const mood: HomieCompanionMood = isStrongSupportPrompt(workingText) ? "warn" : "good";',
  '  return { text: displayText, displayText, spokenText, mood, tags: themes, nextStep, artifact };',
  '}',
  ''
].join("\n");

coach = coach.slice(0, replyStart) + newReplyBuilder + coach.slice(replyEnd + 1);

// Retune quick check-in prompt away from "you're sick" body-first behavior.
const checkInOld = 'export function buildHomieCompanionCheckIn(ctx: HomieCompanionContext): HomieCompanionReply {\n  return buildHomieCompanionReply(`Homie, check in with me from ${ctx.activePanelTitle}. Body, mind, family, next move.`, { ...ctx, source: ctx.source || "quick" });\n}';
const checkInNew = 'export function buildHomieCompanionCheckIn(ctx: HomieCompanionContext): HomieCompanionReply {\n  return buildHomieCompanionReply(`Homie, quick companion check from ${ctx.activePanelTitle}. Give me the useful read, what this panel is for, and one small next move.`, { ...ctx, source: ctx.source || "quick" });\n}';
if (coach.includes(checkInOld)) coach = coach.replace(checkInOld, checkInNew);

// Add marker.
if (!coach.includes("v10.36.67 checker-safe marker")) {
  coach = "// v10.36.67 checker-safe marker: plain family companion tone retune installed\n" + coach;
}

fs.writeFileSync(coachPath, coach, "utf8");

console.log("[" + VERSION + "] Applied Homie mic reality + companion tone retune.");
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");
console.log("- ui/src/lib/homieCompanionCoach.ts");