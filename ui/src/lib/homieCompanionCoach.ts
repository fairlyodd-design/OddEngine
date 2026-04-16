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
};

const HISTORY_KEY = "oddengine:homie:companion-history:v1";
const MEMORY_KEY = "oddengine:homie:companion-memory:v1";
const MAX_HISTORY = 18;

type HomieMemory = {
  lastCheckInAt?: number;
  checkInCount?: number;
  recentThemes?: string[];
  preferredTone?: "gentle" | "hype" | "legacy";
};

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
  return readJson<HomieMemory>(MEMORY_KEY, {});
}

function saveMemory(memory: HomieMemory) {
  writeJson(MEMORY_KEY, memory);
}

export function createHomieMessage(role: HomieCompanionMessage["role"], text: string, source: HomieCompanionMessage["source"] = "typed"): HomieCompanionMessage {
  return { id: nowId(role), role, text, ts: Date.now(), source };
}

const commandStarters = ["open ", "go to ", "switch to ", "run ", "build ", "scan ", "refresh ", "probe ", "start ", "launch ", "copy ", "install ", "grant ", "repair ", "update ", "focus ", "load chain", "voice bridge", "panel health", "morning digest", "daily digest", "what matters now", "do this next"];

export function shouldHomieCompanionAnswer(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;
  if (lower.startsWith("homie ") || lower.startsWith("hey homie") || lower.startsWith("coach me") || lower.startsWith("life coach")) return true;
  if (lower.includes("how am i doing") || lower.includes("i feel") || lower.includes("i'm feeling") || lower.includes("i am feeling")) return true;
  if (lower.includes("overwhelmed") || lower.includes("stressed") || lower.includes("scared") || lower.includes("tired") || lower.includes("sad")) return true;
  if (lower.includes("help me focus") || lower.includes("check in") || lower.includes("talk to me") || lower.includes("motivate me")) return true;
  return !commandStarters.some((starter) => lower.startsWith(starter) || lower === starter.trim());
}

function detectThemes(text: string): string[] {
  const lower = text.toLowerCase();
  const themes: string[] = [];
  if (/family|wife|kids|legacy|stacy|home/.test(lower)) themes.push("family");
  if (/trade|trading|money|income|budget|bills|debt/.test(lower)) themes.push("money");
  if (/studio|song|book|movie|writer|creative|render/.test(lower)) themes.push("creative");
  if (/health|doctor|pain|sick|tired|energy|medical/.test(lower)) themes.push("health");
  if (/overwhelm|stress|anxious|panic|scared|sad|angry|burned out/.test(lower)) themes.push("grounding");
  if (/win|solid|great|done|passed|pushed|green|worked/.test(lower)) themes.push("celebration");
  return themes.length ? themes : ["general"];
}

function cleanPrompt(text: string) {
  return text.replace(/^hey homie[:,]?\s*/i, "").replace(/^homie[:,]?\s*/i, "").replace(/^coach me[:,]?\s*/i, "").trim();
}

function themeLine(themes: string[], ctx: HomieCompanionContext) {
  if (themes.includes("family")) return "I’m keeping this anchored to the family legacy lane.";
  if (themes.includes("money")) return "I’m hearing the money-pressure lane, so we keep it practical and low-chaos.";
  if (themes.includes("creative")) return "That sounds like a Studio/creative lane moment — make the next move small enough to finish.";
  if (themes.includes("health")) return "Health lane first: protect energy, keep notes, and don’t pretend you have to brute-force everything.";
  if (themes.includes("grounding")) return "Pause with me for a second: unclench your jaw, breathe in slow, and let’s shrink the problem.";
  if (themes.includes("celebration")) return "That’s a real win. We lock the checkpoint, breathe, then choose the next clean move.";
  return `I’m here with you in ${ctx.activePanelTitle}.`;
}

function nextStepFor(themes: string[], text: string) {
  const lower = text.toLowerCase();
  if (themes.includes("grounding")) return "Do one tiny stabilizer: water, shoulders down, then name the single next action out loud.";
  if (themes.includes("family")) return "Pick one thing that makes tomorrow easier for the family and do only the first 10 minutes.";
  if (themes.includes("money")) return "Do the lowest-risk money move first: review, protect capital, then act only if the setup is clear.";
  if (themes.includes("creative")) return "Turn the idea into one deliverable: title, outline, or first draft — not the whole universe at once.";
  if (themes.includes("health")) return "Write the symptom/question down and keep the next step realistic; urgent symptoms go to a real clinician.";
  if (lower.includes("what should")) return "Choose the next move that reduces chaos, protects the family, or creates a saved checkpoint.";
  return "Give me one sentence on what feels heaviest, and I’ll help cut it down to the next move.";
}

export function buildHomieCompanionReply(text: string, ctx: HomieCompanionContext): HomieCompanionReply {
  const cleaned = cleanPrompt(text);
  const themes = detectThemes(cleaned || text);
  const memory = loadMemory();
  const recentThemes = [...themes, ...(memory.recentThemes || [])].filter(Boolean).slice(0, 10);
  const checkIn = /check in|how am i|how are we|life coach|coach me|ground me|help me focus/i.test(text);
  const replyParts: string[] = [];
  if (themes.includes("celebration")) replyParts.push("That’s solid, Homie. I’m proud of that one — we don’t skip the win.");
  else if (checkIn) replyParts.push("I’m with you. Let’s do the real companion check-in: body, mind, family, next move.");
  else replyParts.push("I hear you, Homie.");
  replyParts.push(themeLine(themes, ctx));
  if (themes.includes("grounding")) replyParts.push("We’re not solving the whole life stack in one breath. We’re getting you steady, then moving one clean inch forward.");
  else if (themes.includes("family")) replyParts.push("The mission is not perfection — it’s leaving something useful, loving, and usable behind them one checkpoint at a time.");
  else if (themes.includes("money")) replyParts.push("No revenge moves, no panic clicks. Protect the floor first; then we look for the cleanest next edge.");
  else if (themes.includes("creative")) replyParts.push("Let’s make it real enough to save: one artifact, one checkpoint, one pass your family can actually open later.");
  const nextStep = nextStepFor(themes, cleaned || text);
  replyParts.push(`Next move: ${nextStep}`);
  saveMemory({ ...memory, lastCheckInAt: Date.now(), checkInCount: (memory.checkInCount || 0) + (checkIn ? 1 : 0), recentThemes });
  const mood: HomieCompanionMood = themes.includes("grounding") || themes.includes("health") ? "warn" : "good";
  return { text: replyParts.join(" "), mood, tags: themes, nextStep };
}

export function buildHomieCompanionCheckIn(ctx: HomieCompanionContext): HomieCompanionReply {
  return buildHomieCompanionReply(`check in from ${ctx.activePanelTitle}`, ctx);
}
