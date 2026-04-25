// v10.36.73c checker-safe marker: natural short STT replies installed
// v10.36.72b checker-safe marker: duplicate bridge repair plus natural STT replies installed
// v10.36.68 tone nudge: normal companion mode stays informational by default
// v10.36.67 checker-safe marker: plain family companion tone retune installed
export type HomieCompanionMood = "idle" | "good" | "warn";

export type HomieCompanionMessage = {
  id: string;
  role: "user" | "homie" | "system";
  text: string;
  ts: number;
  source?: "typed" | "voice" | "quick";
};

export type HomieCompanionContext = {
  activePanelTitle: string;
  activePanelId: string;
  status: string;
  mood: HomieCompanionMood;
  source?: "typed" | "voice" | "quick";
};

export type HomieLegacyArtifact = {
  id: string;
  title: string;
  body: string;
  ts: number;
  sourceText?: string;
};

export type HomieCompanionReply = {
  text: string;
  displayText?: string;
  spokenText?: string;
  mood: HomieCompanionMood;
  tags: string[];
  nextStep?: string;
  artifact?: HomieLegacyArtifact;
};

type HomieMemory = {
  lastCheckInAt?: number;
  checkInCount?: number;
  recentThemes?: string[];
  preferredTone?: "gentle" | "hype" | "legacy";
  lastUserText?: string;
  lastReplyText?: string;
  lastNextStep?: string;
  lastBodyStep?: string;
  lastMindStep?: string;
  lastFamilyStep?: string;
  lastArtifactTitle?: string;
  legacyArtifacts?: HomieLegacyArtifact[];
};

export type HomieCompanionMemorySnapshot = {
  checkInCount: number;
  lastCheckInLabel: string;
  recentThemeText: string;
  lastNextStep: string;
  lastArtifactTitle: string;
  legacyArtifactCount: number;
};

const HISTORY_KEY = "oddengine:homie:companion-history:v1";
const MEMORY_KEY = "oddengine:homie:companion-memory:v3";
const OLD_MEMORY_KEYS = [
  "oddengine:homie:companion-memory:v2",
  "oddengine:homie:companion-memory:v1",
];
const MAX_HISTORY = 18;
const MAX_THEMES = 10;
const MAX_ARTIFACTS = 24;

function nowId(prefix = "homie") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: any) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function normalizeMemory(memory: HomieMemory): HomieMemory {
  return {
    ...memory,
    checkInCount: Math.max(0, Number(memory.checkInCount || 0)),
    recentThemes: Array.isArray(memory.recentThemes) ? memory.recentThemes.filter(Boolean).slice(0, MAX_THEMES) : [],
    legacyArtifacts: Array.isArray(memory.legacyArtifacts) ? memory.legacyArtifacts.slice(-MAX_ARTIFACTS) : [],
  };
}

function loadMemory(): HomieMemory {
  const current = readJson<HomieMemory | null>(MEMORY_KEY, null);
  if (current) return normalizeMemory(current);
  for (const key of OLD_MEMORY_KEYS) {
    const old = readJson<HomieMemory | null>(key, null);
    if (old) return normalizeMemory(old);
  }
  return normalizeMemory({});
}

function saveMemory(memory: HomieMemory) {
  writeJson(MEMORY_KEY, normalizeMemory(memory));
}

export function loadHomieCompanionHistory(): HomieCompanionMessage[] {
  const raw = readJson<HomieCompanionMessage[]>(HISTORY_KEY, []);
  return Array.isArray(raw) ? raw.slice(-MAX_HISTORY) : [];
}

export function saveHomieCompanionHistory(messages: HomieCompanionMessage[]) {
  writeJson(HISTORY_KEY, messages.slice(-MAX_HISTORY));
}

export function createHomieMessage(role: HomieCompanionMessage["role"], text: string, source: HomieCompanionMessage["source"] = "typed"): HomieCompanionMessage {
  return { id: nowId(role), role, text, ts: Date.now(), source };
}

const commandStarters = [
  "open ", "go to ", "switch to ", "run ", "build ", "scan ", "refresh ", "probe ", "start ", "launch ", "copy ", "install ", "grant ", "repair ", "update ",
  "load chain", "voice bridge", "panel health", "morning digest", "daily digest", "what matters now", "do this next",
];

export function shouldHomieCompanionAnswer(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;
  if (lower.startsWith("homie ") || lower.startsWith("homie,") || lower.startsWith("hey homie") || lower.startsWith("coach me") || lower.startsWith("life coach")) return true;
  if (lower.includes("how am i doing") || lower.includes("i feel") || lower.includes("i'm feeling") || lower.includes("i am feeling")) return true;
  if (lower.includes("overwhelmed") || lower.includes("stressed") || lower.includes("scared") || lower.includes("tired") || lower.includes("sad") || lower.includes("burned out") || lower.includes("heavy")) return true;
  if (lower.includes("help me focus") || lower.includes("check in") || lower.includes("talk to me") || lower.includes("motivate me") || lower.includes("ground me")) return true;
  if (lower.includes("legacy") || lower.includes("family note") || lower.includes("protect my family") || lower.includes("save this for family") || lower.includes("message for my family") || lower.includes("what should they open first") || lower.includes("what should my family open first") || lower.includes("save today") || lower.includes("today’s checkpoint") || lower.includes("todays checkpoint") || lower.includes("write a note from me")) return true;
  return !commandStarters.some((starter) => lower.startsWith(starter) || lower === starter.trim());
}

function detectThemes(text: string): string[] {
  const lower = text.toLowerCase();
  const themes: string[] = [];
  if (/family|wife|kids|legacy|stacy|home|letter|note to/.test(lower)) themes.push("family");
  if (/trade|trading|money|income|budget|bills|debt|capital/.test(lower)) themes.push("money");
  if (/studio|song|book|movie|writer|creative|render|draft|outline|artifact|title/.test(lower)) themes.push("creative");
  if (/health|doctor|pain|sick|tired|energy|medical|body|breath|water|sleep/.test(lower)) themes.push("health");
  if (/overwhelm|stress|anxious|panic|scared|sad|angry|burned out|spiral|heavy/.test(lower)) themes.push("grounding");
  if (/win|solid|great|done|passed|pushed|green|worked|checkpoint|clean/.test(lower)) themes.push("celebration");
  return Array.from(new Set(themes.length ? themes : ["general"]));
}

function cleanPrompt(text: string) {
  return text
    .replace(/^hey homie[:,]?\s*/i, "")
    .replace(/^homie[:,]?\s*/i, "")
    .replace(/^coach me[:,]?\s*/i, "")
    .replace(/^life coach[:,]?\s*/i, "")
    .trim();
}

function oneOf(items: string[], seed: string) {
  const base = Array.from(seed).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return items[Math.abs(base) % items.length] || items[0];
}

function lastTheme(memory: HomieMemory) {
  return memory.recentThemes?.[0] || "general";
}

function startsLikeRepeat(next: string, memory: HomieMemory) {
  const last = (memory.lastReplyText || "").slice(0, 64).toLowerCase();
  return !!last && next.slice(0, 64).toLowerCase() === last;
}

function openingLine(themes: string[], memory: HomieMemory, checkIn: boolean, text: string) {
  const count = memory.checkInCount || 0;
  const seed = [text, String(count), memory.lastNextStep || ""].join("|");
  if (themes.includes("celebration")) {
    return oneOf([
      "That one counts, Homie. Let’s actually feel the win for a second.",
      "Good. That’s a real checkpoint — breathe it in before we sprint again.",
      "There we go. We lock the win, then we move clean."
    ], seed);
  }
  if (themes.includes("grounding")) {
    return count > 0
      ? oneOf(["I’m here. We can make this smaller.", "Still with you. Let’s take the pressure out of it.", "I’ve got you. One breath, then one tile."], seed)
      : oneOf(["I’m here with you. First we calm the alarm bell.", "Got you. We don’t solve everything from a clenched body.", "I’m with you. Let’s slow the room down first."], seed);
  }
  if (checkIn && lastTheme(memory) === "family") return "I’m with you — and I remember the family lane matters here.";
  if (checkIn) return count > 0 ? oneOf(["I’m with you. Let’s do one clean pass.", "Right here with you. Body, mind, family, next move.", "Got you. We’ll keep it small and real."], seed) : "I’m with you. Let’s check in without making it huge.";
  if (/protect|legacy|family/i.test(text)) return "I hear the family lane. We’ll keep this careful and useful.";
  return oneOf(["I hear you, Homie.", "I’m here with you.", "Got you. Let’s make it easier.", "Yeah — I’m with you."], seed);
}

function bodyStep(themes: string[]) {
  if (themes.includes("grounding") || themes.includes("health")) return "Drop your shoulders, loosen your jaw, and take one slow breath before the next decision.";
  return "One breath first. Let the screen wait half a second.";
}

function mindStep(themes: string[]) {
  if (themes.includes("grounding")) return "Your brain is trying to hold the whole board; we only need the next square.";
  if (themes.includes("money")) return "No panic math. Protect the floor, then look for the clean setup.";
  if (themes.includes("creative")) return "A rough saved artifact beats a perfect idea stuck in your head.";
  return "Shrink the mission until it is small enough to finish.";
}

function familyStep(themes: string[]) {
  if (themes.includes("family")) return "Leave one thing clearer, kinder, or easier for them to open later.";
  if (themes.includes("creative")) return "Make one thing the family could actually open: a note, draft, checklist, or checkpoint.";
  return "The family lane is protected by steady choices, not by carrying the whole universe tonight.";
}

function nextStepFor(themes: string[], text: string) {
  const lower = text.toLowerCase();
  if (themes.includes("grounding")) return "Get water, name the single next action out loud, then do only two minutes.";
  if (themes.includes("family")) return "Save one short family note: what matters, what to open first, and one message from you.";
  if (themes.includes("money")) return "Review first, size small, and only act if the setup is clean enough to explain in one sentence.";
  if (themes.includes("creative")) return "Create one saved artifact today — title, outline, first draft, voice note, or checkpoint.";
  if (themes.includes("health")) return "Write the body signal down; if anything feels urgent or dangerous, bring in real medical help now.";
  if (lower.includes("what should")) return "Choose the move that reduces chaos, protects family, or creates a saved checkpoint.";
  return "Tell me the heaviest thing in one sentence, and I’ll cut it down to the next move.";
}

function shouldCreateLegacyArtifact(themes: string[], text: string) {
  const lower = text.toLowerCase();
  return themes.includes("family")
    || lower.includes("legacy note")
    || lower.includes("protect the family")
    || lower.includes("save this")
    || lower.includes("artifact")
    || lower.includes("message for my family")
    || lower.includes("what should they open first")
    || lower.includes("what should my family open first")
    || lower.includes("save today")
    || lower.includes("today’s checkpoint")
    || lower.includes("todays checkpoint")
    || lower.includes("write a note from me");
}

function buildLegacyArtifact(text: string, ctx: HomieCompanionContext, nextStep: string): HomieLegacyArtifact {
  const title = `Family Legacy Note — ${new Date().toLocaleDateString()}`;
  const source = cleanPrompt(text) || "Companion check-in";
  const body = [
    title,
    "",
    "1. What I want them to know:",
    "I was thinking about you, trying to build something useful, loving, and real.",
    "",
    "2. What matters today:",
    source.slice(0, 220),
    "",
    "3. What to open first:",
    `OddEngine → ${ctx.activePanelTitle} → Homie Companion / Legacy lane`,
    "",
    "4. One protected next move:",
    nextStep,
    "",
    "5. Message from me:",
    "One real thing saved is better than ten giant ideas unfinished.",
  ].join("\n");
  return { id: nowId("legacy"), title, body, ts: Date.now(), sourceText: source };
}

function remember(themes: string[], text: string, replyText: string, nextStep: string, artifact?: HomieLegacyArtifact, checkIn = false) {
  const memory = loadMemory();
  const recentThemes = Array.from(new Set([...themes, ...(memory.recentThemes || [])])).filter(Boolean).slice(0, MAX_THEMES);
  const legacyArtifacts = artifact ? [...(memory.legacyArtifacts || []), artifact].slice(-MAX_ARTIFACTS) : (memory.legacyArtifacts || []);
  const next: HomieMemory = {
    ...memory,
    lastCheckInAt: Date.now(),
    checkInCount: (memory.checkInCount || 0) + (checkIn ? 1 : 0),
    recentThemes,
    lastUserText: text.slice(0, 600),
    lastReplyText: replyText.slice(0, 1200),
    lastNextStep: nextStep,
    lastBodyStep: bodyStep(themes),
    lastMindStep: mindStep(themes),
    lastFamilyStep: familyStep(themes),
    lastArtifactTitle: artifact?.title || memory.lastArtifactTitle,
    legacyArtifacts,
  };
  saveMemory(next);
  return next;
}

function formatDisplayReply(parts: string[]) {
  return parts.map((p) => p.trim()).filter(Boolean).join("\n\n");
}

function formatSpokenReply(opening: string, nextStep: string, themes: string[]) {
  const lane = themes.includes("grounding")
    ? "Let’s steady you first."
    : themes.includes("family")
    ? "We stay in the legacy lane."
    : themes.includes("money")
    ? "We keep this calm and practical."
    : themes.includes("creative")
    ? "We make one real thing, not the whole universe."
    : "One clean move at a time.";
  return `${opening} ${lane} Next move: ${nextStep}`.replace(/\s+/g, " ").trim();
}

function softenForVoice(part: string) {
  return part
    .replace(/^Body:\s*/i, "First, ")
    .replace(/^Mind:\s*/i, "Here’s the thought: ")
    .replace(/^Family:\s*/i, "For the family lane, ")
    .replace(/^Next move:\s*/i, "Next, ")
    .replace(/^Last thread I remember:\s*/i, "I still remember this thread: ")
    .replace(/\s+/g, " ")
    .trim();
}

function voiceCadenceReply(parts: string[]) {
  const lead = softenForVoice(parts[0] || "I’m here with you.");
  const body = softenForVoice(parts[1] || "One breath first.");
  const next = softenForVoice(parts.find((part) => /^Next move:/i.test(part)) || parts[4] || "Next, tell me the heaviest thing in one sentence.");
  const artifact = parts.find((part) => /legacy artifact|family note/i.test(part));
  return [lead, body, next, artifact ? softenForVoice(artifact) : ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// ===== v10.36.67 Homie plain family companion tone helpers =====
function isHomieMicCameraQuestion(text: string) {
  const lower = text.trim().toLowerCase();
  return /\b(mic|microphone|camera|cam|hear me|heard me|listen|listening|transcript|voice|speaker|can you hear|can hear you|cannot hear|can\'t hear|not hearing|through cam|through camera)\b/.test(lower);
}

function isStrongSupportPrompt(text: string) {
  const lower = text.trim().toLowerCase();
  return /\b(overwhelmed|panic|scared|sad|grief|heavy|burned out|spiral|ground me|stressed|anxious|pain|sick|medical|doctor)\b/.test(lower);
}

function wantsBodyMindFamily(text: string) {
  const lower = text.trim().toLowerCase();
  return /\b(body mind family|body, mind, family|ground me|overwhelmed|check in|daily rhythm|what matters today|start my day)\b/.test(lower);
}

function companionOpening(text: string, themes: string[], ctx: HomieCompanionContext) {
  const lower = text.trim().toLowerCase();
  if (isHomieMicCameraQuestion(text)) return "Yep — let’s separate the lanes clearly.";
  if (/\b(thanks|nice|awesome|hell yeah|lol|lmao|fire|🔥|👊)\b/i.test(text)) return "Hell yeah — that’s the right direction.";
  if (themes.includes("creative")) return "Got you — creative lane.";
  if (themes.includes("family")) return "Got you — family lane.";
  if (themes.includes("money")) return "Got you — money lane.";
  if (isStrongSupportPrompt(text)) return "I’m with you — we’ll keep it simple, not dramatic.";
  return "Got you — companion mode."; 
}

function companionInfoReply(text: string, themes: string[], ctx: HomieCompanionContext, nextStep: string) {
  const lower = text.trim().toLowerCase();
  if (isHomieMicCameraQuestion(text)) {
    return formatDisplayReply([
      "Yep — let’s separate the lanes clearly.",
      "Speaker out: working, because you can hear Homie.",
      "Mic in: use Start listening, Hold to talk, Talk by mic, or the new Say test button. Homie only knows he heard you when Last transcript fills in.",
      "Camera: visual only right now. It shows preview and samples simple brightness/motion. It does not hear audio, identify people, or understand objects yet.",
      "Next move: click Say test, say “Homie can hear me,” then check Last transcript. If it stays blank, the issue is the browser/Windows input path, not the camera."
    ]);
  }

  if (wantsBodyMindFamily(text) || isStrongSupportPrompt(text)) {
    return formatDisplayReply([
      companionOpening(text, themes, ctx),
      "Body: quick status only — no drama. Breathe once, then check whether you need water, food, rest, or a break.",
      "Mind: shrink the task until it has one visible next action.",
      "Family: keep the handoff understandable. Save one thing they can open later.",
      "Next move: " + nextStep
    ]);
  }

  return formatDisplayReply([
    companionOpening(text, themes, ctx),
    "What I heard: " + (cleanPrompt(text) || "you want a practical next step").slice(0, 220),
    "Useful read: I can explain, organize, route panels, remember notes, or help pick the next move.",
    "Current lane: " + ctx.activePanelTitle + ".",
    "Next move: " + nextStep
  ]);
}

function companionSpokenFromDisplay(displayText: string) {
  const compact = displayText
    .replace(/\n+/g, " ")
    .replace(/Speaker out:/g, "Speaker out is")
    .replace(/Mic in:/g, "Mic in is")
    .replace(/Camera:/g, "Camera is")
    .replace(/Next move:/g, "Next move:")
    .replace(/\s+/g, " ")
    .trim();
  if (compact.length <= 260) return compact;
  return compact.slice(0, 257) + "...";
}
// ===== v10.36.67 Homie plain family companion tone helpers END =====
// ===== v10.36.72b Homie natural STT repair helpers =====
function homieNormalizeHeardText(text: string) {
  return cleanPrompt(String(text || ""))
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function homieIsTinyVoiceAck(text: string) {
  const lower = homieNormalizeHeardText(text).toLowerCase();
  return /^(ok|okay|yeah|yes|yep|no|nope|thanks|thank you|nice|cool|sweet|now|good|got it|hell yeah|lol|lmao|yup)[.!?]*$/.test(lower);
}

function homieLooksLikeSTTDrift(text: string) {
  const lower = homieNormalizeHeardText(text).toLowerCase();
  if (!lower) return true;
  if (/\b(going to this here we now|to this here we now|this here we now|do this here we now|going to this here)\b/.test(lower)) return true;
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length >= 5) {
    const filler = words.filter((word) => /^(to|the|a|an|we|me|you|it|is|are|this|that|here|now|going)$/.test(word)).length;
    if (filler / words.length > 0.68) return true;
  }
  return false;
}

function homieCorrectionText(text: string) {
  const match = homieNormalizeHeardText(text).match(/^(correction|correct that|i said|what i said was)[:\s-]+(.+)$/i);
  return match?.[2]?.trim() || "";
}

function buildHomieTinyAckReply(text: string): HomieCompanionReply {
  const heard = homieNormalizeHeardText(text);
  const isThanks = /^(thanks|thank you|appreciate it|nice|awesome|hell yeah|cool|sweet)[.!?]*$/i.test(heard);
  const displayText = isThanks
    ? "Anytime, Homie. I’m here and listening."
    : "Got it. I heard: \"" + heard + "\". Say the next full sentence when you’re ready.";
  return { text: displayText, displayText, spokenText: isThanks ? "Anytime, Homie. I’m listening." : "Got it. Say the next full sentence when you’re ready.", mood: "good", tags: ["voice"], nextStep: "Say one full sentence, or say correction followed by the exact words." };
}

function buildHomieSTTDriftReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply {
  const heard = homieNormalizeHeardText(text) || "blank audio";
  const displayText = [
    "I heard: \"" + heard + "\".",
    "That sounds like transcription drift, not a clean instruction. I won’t pretend I understood it perfectly.",
    "Try: say it again slower, say \"correction: ...\" with the exact words, or type the important part once.",
    "Current lane: " + ctx.activePanelTitle + "."
  ].join("\n\n");
  return { text: displayText, displayText, spokenText: "I heard something, but it sounds like transcription drift. Say correction followed by the exact words, or repeat it slower.", mood: "warn", tags: ["voice", "stt-drift"], nextStep: "Say: correction, then the exact words you wanted Homie to use." };
}

function buildHomieCorrectionReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply {
  const corrected = homieCorrectionText(text);
  const displayText = [
    "Correction received.",
    "Clean wording: \"" + corrected + "\"",
    "I’ll use that instead of the messy transcript.",
    "Current lane: " + ctx.activePanelTitle + "."
  ].join("\n\n");
  return { text: displayText, displayText, spokenText: "Got it. I’ll use the corrected wording.", mood: "good", tags: detectThemes(corrected), nextStep: "Now say the command or question with that clean wording, or type it once." };
}

function buildHomieNaturalCompanionDisplay(workingText: string, themes: string[], ctx: HomieCompanionContext, nextStep: string) {
  const heard = homieNormalizeHeardText(workingText);
  const lines = [
    ctx.source === "voice" ? "I heard: \"" + heard + "\"." : "Got you.",
    "Current lane: " + ctx.activePanelTitle + "."
  ];
  if (themes.includes("creative")) lines.push("Creative read: turn it into one saved artifact, not a giant universe.");
  else if (themes.includes("money")) lines.push("Money read: keep it practical, small, and explainable.");
  else if (themes.includes("family")) lines.push("Family read: make it easy for someone else to open later.");
  else if (themes.includes("grounding") || themes.includes("health")) lines.push("Grounding read: slow it down and make the next move tiny.");
  else lines.push("Useful read: I can explain, organize, route panels, remember notes, or help pick the next move.");
  lines.push("Next move: " + nextStep);
  return lines.join("\n\n");
}
// ===== v10.36.72b Homie natural STT repair helpers END =====

// ===== v10.36.73c Homie short STT reply helpers =====
function homieV73cNormalize(text: string) { return cleanPrompt(String(text || "")).replace(/\s+/g, " " ).trim(); }
function homieV73cShortAck(text: string) { return /^(ok|okay|yeah|yes|yep|no|nope|thanks|thank you|nice|cool|sweet|now|good|got it|hell yeah|lol|lmao|yup)[.!?]*$/i.test(homieV73cNormalize(text)); }
function homieV73cDrift(text: string) { const lower = homieV73cNormalize(text).toLowerCase(); if (/\b(going to this here we now|to this here we now|this here we now|do this here we now|going to this here)\b/.test(lower)) return true; const words = lower.split(/\s+/).filter(Boolean); if (words.length >= 5) { const filler = words.filter((w) => /^(to|the|a|an|we|me|you|it|is|are|this|that|here|now|going)$/.test(w)).length; return filler / words.length > 0.68; } return false; }
function homieV73cShortReply(text: string): HomieCompanionReply { const heard = homieV73cNormalize(text); const thanks = /^(thanks|thank you|appreciate it|nice|awesome|hell yeah|cool|sweet)[.!?]*$/i.test(heard); const displayText = thanks ? "Anytime, Homie. I’m here and listening." : "Got it. I heard: \"" + heard + "\". Say the next full sentence when you’re ready."; return { text: displayText, displayText, spokenText: thanks ? "Anytime, Homie. I’m listening." : "Got it. Say the next full sentence when you’re ready.", mood: "good", tags: ["voice"], nextStep: "Say one full sentence, or say correction followed by the exact words." }; }
function homieV73cDriftReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply { const heard = homieV73cNormalize(text) || "blank audio"; const displayText = ["I heard: \"" + heard + "\".", "That sounds like transcription drift, not a clean instruction. I won’t pretend I understood it perfectly.", "Try: say it again slower, say correction with the exact words, or type the important part once.", "Current lane: " + ctx.activePanelTitle + "."].join("\n\n"); return { text: displayText, displayText, spokenText: "I heard something, but it sounds like transcription drift. Say correction followed by the exact words, or repeat it slower.", mood: "warn", tags: ["voice", "stt-drift"], nextStep: "Say: correction, then the exact words you wanted Homie to use." }; }
// ===== v10.36.73c Homie short STT reply helpers END =====

export function buildHomieCompanionReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply {
  const cleaned = cleanPrompt(text);
  const workingText = cleaned || text;
  // v10.36.73c short voice early return: avoid essaying over tiny/noisy STT.
  if (ctx.source === "voice" && homieV73cShortAck(workingText)) {
    const reply = homieV73cShortReply(workingText);
    remember(reply.tags, workingText, reply.text, reply.nextStep || "Say one full sentence next.", undefined, false);
    return reply;
  }
  if (ctx.source === "voice" && homieV73cDrift(workingText)) {
    const reply = homieV73cDriftReply(workingText, ctx);
    remember(reply.tags, workingText, reply.text, reply.nextStep || "Repeat or correct the phrase.", undefined, false);
    return reply;
  }
  const normalized = homieNormalizeHeardText(workingText);
  const memory = loadMemory();
  const correction = homieCorrectionText(workingText);

  if (correction) {
    const reply = buildHomieCorrectionReply(workingText, ctx);
    remember(reply.tags, correction, reply.text, reply.nextStep || "Use the corrected wording.", reply.artifact, false);
    return reply;
  }

  if (ctx.source === "voice" && homieLooksLikeSTTDrift(normalized)) {
    const reply = buildHomieSTTDriftReply(normalized, ctx);
    remember(reply.tags, normalized, reply.text, reply.nextStep || "Repeat the phrase or say correction.", undefined, false);
    return reply;
  }

  if (ctx.source === "voice" && homieIsTinyVoiceAck(normalized)) {
    const reply = buildHomieTinyAckReply(normalized);
    remember(reply.tags, normalized, reply.text, reply.nextStep || "Say one full sentence next.", undefined, false);
    return reply;
  }

  const themes = detectThemes(workingText);
  const checkIn = /check in|how am i|how are we|life coach|coach me|ground me|help me focus|talk to me/i.test(text);
  const nextStep = nextStepFor(themes, workingText);
  const artifact = shouldCreateLegacyArtifact(themes, text) ? buildLegacyArtifact(workingText, ctx, nextStep) : undefined;

  let displayText = buildHomieNaturalCompanionDisplay(workingText, themes, ctx, nextStep);
  if (artifact) displayText += "\n\nFamily artifact: drafted " + artifact.title + ". Review before final family use.";

  if (startsLikeRepeat(displayText, memory)) {
    displayText = [
      "Same lane, cleaner pass.",
      ctx.source === "voice" ? "I heard: \"" + normalized + "\"." : "What I heard: " + normalized,
      "Current lane: " + ctx.activePanelTitle + ".",
      "Next move: " + nextStep
    ].join("\n\n");
  }

  const spokenText = ctx.source === "voice"
    ? ("I heard: " + normalized + ". Next move: " + nextStep).replace(/\s+/g, " ").slice(0, 260)
    : formatSpokenReply(openingLine(themes, memory, checkIn, text), nextStep, themes);

  remember(themes, workingText, displayText, nextStep, artifact, checkIn);
  const mood: HomieCompanionMood = themes.includes("grounding") || themes.includes("health") ? "warn" : "good";
  return { text: displayText, displayText, spokenText, mood, tags: themes, nextStep, artifact };
}
export function buildHomieCompanionCheckIn(ctx: HomieCompanionContext): HomieCompanionReply {
  return buildHomieCompanionReply(`Homie, quick companion check from ${ctx.activePanelTitle}. Give me the useful read and one small next move.`, { ...ctx, source: ctx.source || "quick" });
}

export function getHomieCompanionMemorySnapshot(): HomieCompanionMemorySnapshot {
  const memory = loadMemory();
  const lastAt = memory.lastCheckInAt ? new Date(memory.lastCheckInAt).toLocaleString() : "No check-in yet";
  const themes = (memory.recentThemes || []).slice(0, 4).join(" • ") || "general";
  return {
    checkInCount: memory.checkInCount || 0,
    lastCheckInLabel: lastAt,
    recentThemeText: themes,
    lastNextStep: memory.lastNextStep || "No next move saved yet.",
    lastArtifactTitle: memory.lastArtifactTitle || "No legacy artifact drafted yet.",
    legacyArtifactCount: (memory.legacyArtifacts || []).length,
  };
}

export function buildHomieLegacyArtifactDraft(ctx: HomieCompanionContext): HomieLegacyArtifact {
  const memory = loadMemory();
  const nextStep = memory.lastNextStep || "Save one small note the family can open later.";
  const artifact = buildLegacyArtifact(memory.lastUserText || "Family legacy check-in", ctx, nextStep);
  saveMemory({
    ...memory,
    lastArtifactTitle: artifact.title,
    legacyArtifacts: [...(memory.legacyArtifacts || []), artifact].slice(-MAX_ARTIFACTS),
  });
  return artifact;
}

export function exportHomieLegacyArtifactText() {
  const memory = loadMemory();
  const latest = (memory.legacyArtifacts || []).slice(-1)[0];
  if (latest) return latest.body;
  return buildHomieLegacyArtifactDraft({ activePanelTitle: "Homie", activePanelId: "Homie", status: "Ready", mood: "good", source: "quick" }).body;
}


export type HomieLegacyArtifactSummary = {
  id: string;
  title: string;
  ts: number;
  preview: string;
};

function latestLegacyArtifacts(limit = 6): HomieLegacyArtifact[] {
  const memory = loadMemory();
  return (memory.legacyArtifacts || [])
    .slice()
    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
    .slice(0, Math.max(1, limit));
}

export function getHomieLegacyArtifactSummaries(limit = 6): HomieLegacyArtifactSummary[] {
  return latestLegacyArtifacts(limit).map((artifact) => ({
    id: artifact.id,
    title: artifact.title,
    ts: artifact.ts,
    preview: (artifact.body || artifact.sourceText || "").replace(/\s+/g, " ").slice(0, 140),
  }));
}

function buildLegacyPromptArtifactBody(prompt: string, ctx: HomieCompanionContext, nextStep: string) {
  const lower = prompt.toLowerCase();
  const today = new Date().toLocaleDateString();
  const isOpenFirst = lower.includes("open first") || lower.includes("what should they open");
  const isCheckpoint = lower.includes("checkpoint") || lower.includes("save today") || lower.includes("today’s") || lower.includes("todays");
  const isFamilyMessage = lower.includes("message") || lower.includes("note from me") || lower.includes("family");

  const title = isOpenFirst
    ? `Family Open-First Guide — ${today}`
    : isCheckpoint
    ? `Family Checkpoint — ${today}`
    : isFamilyMessage
    ? `Message For My Family — ${today}`
    : `Family Legacy Note — ${today}`;

  const message = isOpenFirst
    ? "Start here: open OddEngine, go to Homie, then read the latest saved legacy notes before touching anything complicated."
    : isCheckpoint
    ? "Today’s checkpoint is simple: something real was saved, the next move was named, and the family lane stayed protected."
    : "I love you. I was trying to build something useful, kind, and steady — something that could help even on hard days.";

  const body = [
    title,
    "",
    "1. Message from me:",
    message,
    "",
    "2. What matters right now:",
    cleanPrompt(prompt).slice(0, 260) || "Keep the family lane clear, kind, and easy to open.",
    "",
    "3. What to open first:",
    `OddEngine → ${ctx.activePanelTitle || "Homie"} → Homie Companion → Family Legacy Notes`,
    "",
    "4. One protected next move:",
    nextStep,
    "",
    "5. Tiny instruction:",
    "Read one note first. Do not try to understand the whole system at once.",
  ].join("\n");

  return { title, body };
}

export function buildHomieLegacyPromptArtifact(prompt: string, ctx: HomieCompanionContext): HomieLegacyArtifact {
  const themes = Array.from(new Set(["family", ...detectThemes(prompt)])).slice(0, MAX_THEMES);
  const nextStep = nextStepFor(themes, prompt || "family legacy note");
  const { title, body } = buildLegacyPromptArtifactBody(prompt, ctx, nextStep);
  const artifact: HomieLegacyArtifact = {
    id: nowId("legacy"),
    title,
    body,
    ts: Date.now(),
    sourceText: cleanPrompt(prompt) || "Family legacy prompt",
  };
  const memory = loadMemory();
  saveMemory({
    ...memory,
    recentThemes: Array.from(new Set([...themes, ...(memory.recentThemes || [])])).slice(0, MAX_THEMES),
    lastUserText: prompt.slice(0, 600),
    lastNextStep: nextStep,
    lastArtifactTitle: artifact.title,
    legacyArtifacts: [...(memory.legacyArtifacts || []), artifact].slice(-MAX_ARTIFACTS),
  });
  return artifact;
}

export function downloadHomieLegacyArtifactFileName() {
  const stamp = new Date().toISOString().slice(0, 10);
  return `Homie_Family_Legacy_Note_${stamp}.txt`;
}

export function clearHomieCompanionHistory() {
  writeJson(HISTORY_KEY, []);
}
