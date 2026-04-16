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

export type HomieCompanionReply = {
  text: string;
  mood: HomieCompanionMood;
  tags: string[];
  nextStep?: string;
  artifact?: HomieLegacyArtifact;
};

export type HomieLegacyArtifact = {
  id: string;
  title: string;
  body: string;
  ts: number;
  sourceText?: string;
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
const MEMORY_KEY = "oddengine:homie:companion-memory:v2";
const OLD_MEMORY_KEY = "oddengine:homie:companion-memory:v1";
const MAX_HISTORY = 18;
const MAX_THEMES = 10;
const MAX_ARTIFACTS = 12;

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
  } catch {}
}

export function loadHomieCompanionHistory(): HomieCompanionMessage[] {
  const raw = readJson<HomieCompanionMessage[]>(HISTORY_KEY, []);
  return Array.isArray(raw) ? raw.slice(-MAX_HISTORY) : [];
}

export function saveHomieCompanionHistory(messages: HomieCompanionMessage[]) {
  writeJson(HISTORY_KEY, messages.slice(-MAX_HISTORY));
}

function loadMemory(): HomieMemory {
  const v2 = readJson<HomieMemory | null>(MEMORY_KEY, null);
  if (v2) return normalizeMemory(v2);
  const v1 = readJson<HomieMemory | null>(OLD_MEMORY_KEY, null);
  return normalizeMemory(v1 || {});
}

function normalizeMemory(memory: HomieMemory): HomieMemory {
  return {
    ...memory,
    checkInCount: Math.max(0, Number(memory.checkInCount || 0)),
    recentThemes: Array.isArray(memory.recentThemes) ? memory.recentThemes.filter(Boolean).slice(0, MAX_THEMES) : [],
    legacyArtifacts: Array.isArray(memory.legacyArtifacts) ? memory.legacyArtifacts.slice(-MAX_ARTIFACTS) : [],
  };
}

function saveMemory(memory: HomieMemory) {
  writeJson(MEMORY_KEY, normalizeMemory(memory));
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
  if (lower.includes("overwhelmed") || lower.includes("stressed") || lower.includes("scared") || lower.includes("tired") || lower.includes("sad") || lower.includes("burned out")) return true;
  if (lower.includes("help me focus") || lower.includes("check in") || lower.includes("talk to me") || lower.includes("motivate me") || lower.includes("ground me")) return true;
  if (lower.includes("legacy") || lower.includes("family note") || lower.includes("protect my family")) return true;
  return !commandStarters.some((starter) => lower.startsWith(starter) || lower === starter.trim());
}

function detectThemes(text: string): string[] {
  const lower = text.toLowerCase();
  const themes: string[] = [];
  if (/family|wife|kids|legacy|stacy|home|letter|note to/.test(lower)) themes.push("family");
  if (/trade|trading|money|income|budget|bills|debt|capital/.test(lower)) themes.push("money");
  if (/studio|song|book|movie|writer|creative|render|draft|outline|artifact|title/.test(lower)) themes.push("creative");
  if (/health|doctor|pain|sick|tired|energy|medical|body|breath|water/.test(lower)) themes.push("health");
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
  const last = (memory.lastReplyText || "").slice(0, 48).toLowerCase();
  return !!last && next.slice(0, 48).toLowerCase() === last;
}

function openingLine(themes: string[], memory: HomieMemory, checkIn: boolean, text: string) {
  const count = memory.checkInCount || 0;
  if (themes.includes("celebration")) return "That one counts, Homie. We lock the win before we sprint past it.";
  if (themes.includes("grounding")) return count > 0 ? "I’m here. Let’s make this smaller again." : "I’m here with you. First we get your body out of alarm mode.";
  if (checkIn && lastTheme(memory) === "family") return "I’m with you — and I remember the legacy lane from the last check-in.";
  if (checkIn) return count > 0 ? "I’m with you. Body, mind, family, next move — one clean pass." : "I’m with you. Let’s do the real check-in without making it huge.";
  if (/protect|legacy|family/i.test(text)) return "I hear the family legacy lane. That gets the calm, careful version of us.";
  return oneOf(["I hear you, Homie.", "I’m here, Homie.", "Got you, Homie."], text);
}

function bodyStep(themes: string[]) {
  if (themes.includes("grounding") || themes.includes("health")) return "Drop your shoulders, unclench your jaw, and take one slow breath before we decide anything.";
  return "Quick body check: breathe once, soften the shoulders, and don’t let the screen rush you.";
}

function mindStep(themes: string[]) {
  if (themes.includes("grounding")) return "Your brain is trying to carry every tab at once; we only need the next tile.";
  if (themes.includes("money")) return "No panic math and no revenge move; protect the floor first.";
  if (themes.includes("creative")) return "A saved rough artifact beats a perfect idea trapped in your head.";
  return "We shrink the mission until it is small enough to finish.";
}

function familyStep(themes: string[]) {
  if (themes.includes("family")) return "Family legacy today means leave one thing clearer, kinder, or easier to open later.";
  if (themes.includes("creative")) return "Make it something the family can open: a note, outline, draft, checklist, or checkpoint.";
  return "The family lane stays protected by steady choices, not by trying to finish the whole universe tonight.";
}

function nextStepFor(themes: string[], text: string) {
  const lower = text.toLowerCase();
  if (themes.includes("grounding")) return "Get water, say the single next action out loud, then do only the first two minutes.";
  if (themes.includes("family")) return "Save one five-line Family Legacy Note: what matters, what to open first, and one message from you.";
  if (themes.includes("money")) return "Review first, size small, and only act if the setup is clean enough to explain in one sentence.";
  if (themes.includes("creative")) return "Create one artifact today: title, outline, first draft, voice note, or checkpoint — not the whole project.";
  if (themes.includes("health")) return "Write the body signal down; if anything feels urgent or dangerous, involve real medical help now.";
  if (lower.includes("what should")) return "Choose the move that reduces chaos, protects family, or creates a saved checkpoint.";
  return "Tell me the heaviest thing in one sentence, and I’ll cut it down to the next move.";
}

function shouldCreateLegacyArtifact(themes: string[], text: string) {
  const lower = text.toLowerCase();
  return themes.includes("family") || lower.includes("legacy note") || lower.includes("protect the family") || lower.includes("save this") || lower.includes("artifact");
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
    lastReplyText: replyText.slice(0, 900),
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

function formatReply(parts: string[], source?: "typed" | "voice" | "quick") {
  const cleaned = parts.map((p) => p.trim()).filter(Boolean);
  if (source === "voice") return cleaned.slice(0, 5).join(" ");
  return cleaned.join("\n\n");
}

export function buildHomieCompanionReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply {
  const cleaned = cleanPrompt(text);
  const themes = detectThemes(cleaned || text);
  const memory = loadMemory();
  const checkIn = /check in|how am i|how are we|life coach|coach me|ground me|help me focus|talk to me/i.test(text);
  const nextStep = nextStepFor(themes, cleaned || text);
  const artifact = shouldCreateLegacyArtifact(themes, text) ? buildLegacyArtifact(cleaned || text, ctx, nextStep) : undefined;

  const parts = [
    openingLine(themes, memory, checkIn, text),
    `Body: ${bodyStep(themes)}`,
    `Mind: ${mindStep(themes)}`,
    `Family: ${familyStep(themes)}`,
    `Next move: ${nextStep}`,
  ];

  if (artifact) parts.push(`I also drafted a tiny legacy artifact: ${artifact.title}. You can copy/save it from this card later.`);
  if ((memory.checkInCount || 0) > 0 && memory.lastNextStep && !themes.includes("celebration")) parts.push(`Last thread I remember: ${memory.lastNextStep}`);

  let replyText = formatReply(parts, ctx.source);
  if (startsLikeRepeat(replyText, memory)) {
    replyText = formatReply(["Still with you, Homie — different angle this time.", ...parts.slice(1)], ctx.source);
  }

  remember(themes, cleaned || text, replyText, nextStep, artifact, checkIn);
  const mood: HomieCompanionMood = themes.includes("grounding") || themes.includes("health") ? "warn" : "good";
  return { text: replyText, mood, tags: themes, nextStep, artifact };
}

export function buildHomieCompanionCheckIn(ctx: HomieCompanionContext): HomieCompanionReply {
  return buildHomieCompanionReply(`Homie, check in with me from ${ctx.activePanelTitle}. Body, mind, family, next move.`, { ...ctx, source: ctx.source || "quick" });
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
  saveMemory({ ...memory, lastArtifactTitle: artifact.title, legacyArtifacts: [...(memory.legacyArtifacts || []), artifact].slice(-MAX_ARTIFACTS) });
  return artifact;
}

export function exportHomieLegacyArtifactText() {
  const memory = loadMemory();
  const latest = (memory.legacyArtifacts || []).slice(-1)[0];
  if (latest) return latest.body;
  return buildHomieLegacyArtifactDraft({ activePanelTitle: "Homie", activePanelId: "Homie", status: "Ready", mood: "good", source: "quick" }).body;
}

export function clearHomieCompanionHistory() {
  writeJson(HISTORY_KEY, []);
}
