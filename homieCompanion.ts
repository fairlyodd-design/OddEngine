import { getPanelMeta, readPanelContext } from "./brain";
import { buildHomieCoreSnapshot } from "./homieCore";
import { buildHomieRelationshipMemory, buildPanelCompanionMemory, logHomieRoutineCheckIn, noteHomieInteraction, rememberPanelCompanionState } from "./homieMemory";
import { oddApi, isDesktop } from "./odd";
import { loadJSON, saveJSON } from "./storage";

export type CompanionRole = "user" | "assistant" | "system";
export type HomieProviderKind = "ollama" | "openai_compat" | "bridge";
export type HomieVoiceChatMode = "smart" | "companion" | "commands";

export type CompanionMessage = {
  id: string;
  role: CompanionRole;
  content: string;
  ts: number;
};

export type HomieContextMode = "clean" | "memory" | "panel";
export type HomieResponseStyle = "direct" | "supportive" | "companion";

export type HomieSettings = {
  provider: HomieProviderKind;
  model: string;
  ollamaModel: string;
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  bridgeBaseUrl: string;
  bridgeModel: string;
  temperature: number;
  system: string;
  includeContext: boolean;
  contextMode: HomieContextMode;
  chatCleanMode: boolean;
  responseStyle: HomieResponseStyle;
  voiceMode: HomieVoiceChatMode;
  autoSpeakReplies: boolean;
  autoFallback: boolean;
  rememberCompanionFacts: boolean;
};

export type CompanionRuntime = {
  provider: HomieProviderKind;
  providerLabel: string;
  model: string;
  temperature: number;
  system: string;
  baseUrl?: string;
  apiKey?: string;
};

export type CompanionMemoryState = {
  currentFocus: string;
  lastUserNeed: string;
  sessionSummary: string;
  conversationArc: string;
  sharedRoutine: string;
  rememberedFacts: string[];
  updatedAt: number;
};

export type CompanionChatResult = {
  ok: boolean;
  error: string;
  model: string;
  reply: string;
  provider: string;
  providerLabel: string;
  tried: string[];
  promptMode: string;
  directRequestDetected: boolean;
  supportModeApplied: boolean;
  contextIncluded: "none" | "minimal" | "full";
  responseStyle: HomieResponseStyle;
};

export type CompanionProviderProbeResult = {
  provider: HomieProviderKind;
  providerLabel: string;
  ok: boolean;
  detail?: string;
  error?: string;
  models?: string[];
  model?: string;
};

export type ProviderSetupWizardProbe = {
  provider: HomieProviderKind;
  ok: boolean;
  error?: string;
  detail?: string;
  models?: string[];
  model?: string;
};

export type ProviderSetupWizardStep = {
  id: string;
  title: string;
  state: "done" | "action" | "warn";
  detail: string;
  command?: string;
};

export type ProviderSetupWizardPlan = {
  provider: HomieProviderKind;
  providerLabel: string;
  ready: boolean;
  headline: string;
  summary: string;
  patch: Partial<HomieSettings>;
  steps: ProviderSetupWizardStep[];
};

export const HOMIE_SETTINGS_KEY = "oddengine:homie:settings:v1";
export const HOMIE_COMPANION_CHAT_KEY = "oddengine:homie:companion:chat:v1";
export const HOMIE_COMPANION_MEMORY_KEY = "oddengine:homie:companion:memory:v1";
const MAX_COMPANION_MESSAGES = 40;
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";
const DEFAULT_OPENAI_BASE_URL = "http://127.0.0.1:1234/v1";
const DEFAULT_BRIDGE_BASE_URL = "http://127.0.0.1:8787";
const HOMIE_LAST_PROVIDER_OK_KEY = "oddengine:homie:last-provider-ok";
const MAX_MEMORY_FACTS = 6;

function uid(prefix = "homie") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
}

function compact(text: string, max = 220) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function stripMemoryLead(text: string, kind: "arc" | "routine" | "lately" | "generic" = "generic") {
  let clean = compact(text || "", 220);
  if (!clean) return "";
  if (kind === "arc" || kind === "generic") clean = clean.replace(/^(?:conversation\s*arc|arc)\s*:\s*/i, "");
  if (kind === "routine" || kind === "generic") clean = clean.replace(/^(?:shared\s*routine|routine)\s*:\s*/i, "");
  if (kind === "lately" || kind === "generic") clean = clean.replace(/^lately\s*:\s*/i, "");
  return compact(clean, 220);
}

function dedupeLines(lines: string[], max = MAX_MEMORY_FACTS) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const clean = compact(line, 140);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}

function looksLikeDiagnosticOrProviderText(text: string) {
  const clean = compact(text || "", 420).toLowerCase();
  if (!clean) return false;
  return /provider help|hear-you doctor|voice path check|typed smoke test|check provider|probe external|provider setup wizard|start ollama|pull llama|custom bridge|ollama is not reachable|external\/local voice bridge|transcript preview|reply preview|desktop runtime|download the chat model|diagnose ollama/.test(clean);
}

function sanitizeConversationMessages(messages: CompanionMessage[], chatCleanMode: boolean) {
  const rows = (Array.isArray(messages) ? messages : []).filter((row) => row && row.role !== "system");
  if (!chatCleanMode) {
    return rows.slice(-16);
  }
  const latestUserId = [...rows].reverse().find((row) => row.role === "user" && compact(row.content, 500))?.id || "";
  const filtered = rows.filter((row) => {
    const clean = compact(row.content, 500);
    if (!clean) return false;
    if (row.role === "assistant" && (clean.startsWith("⚠️") || looksLikeDiagnosticOrProviderText(clean))) return false;
    if (row.role === "user" && row.id !== latestUserId && looksLikeDiagnosticOrProviderText(clean)) return false;
    return true;
  });
  const finalRows = filtered.length ? filtered : rows;
  return finalRows.slice(-12);
}

function detectDirectRequest(text: string) {
  const clean = compact(text || "", 260);
  if (!clean) return false;
  if (/^(?:say|write|draft|send|text|message|email|rewrite|reword|summarize|sum up|explain|answer|caption|translate|list|give me|create|make|show me|tell me)\b/i.test(clean)) return true;
  if (/\b(?:say hello to|write a text to|draft a message to|summarize this|rewrite this|answer this)\b/i.test(clean)) return true;
  if (clean.split(/\s+/).length <= 14 && !/[?]$/.test(clean) && /^[a-z0-9"'`]/i.test(clean)) return true;
  return false;
}

function isStrictCommandPassthrough(text: string) {
  const clean = compact(text || "", 260);
  if (!clean) return false;
  return /^(?:say hello to|write a text to|draft a message to|draft an email to|summarize this|rewrite this|reword this|translate this|answer this|caption this|script this|make this sound|turn this into)\b/i.test(clean);
}

function prettifyTargetName(raw: string) {
  const clean = compact(raw || "", 120)
    .replace(/^(?:my|our)\s+/i, "")
    .replace(/^(?:wife|husband|partner|girlfriend|boyfriend|mom|mother|dad|father|son|daughter|brother|sister|friend)\s+/i, "")
    .replace(/^named\s+/i, "")
    .trim();
  if (!clean) return "there";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return "there";
  return parts.slice(-3).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function buildDirectCommandReply(text: string) {
  const clean = compact(text || "", 260);
  if (!clean) return "";

  const helloMatch = clean.match(/^say hello to\s+(.+)$/i);
  if (helloMatch?.[1]) {
    const target = prettifyTargetName(helloMatch[1]);
    return `Hi ${target}, just wanted to say hello and let you know I'm thinking of you.`;
  }

  const textMatch = clean.match(/^(?:write a text to|draft a message to)\s+(.+?)\s+saying\s+(.+)$/i);
  if (textMatch?.[1] && textMatch?.[2]) {
    const target = prettifyTargetName(textMatch[1]);
    const body = compact(textMatch[2].replace(/^['"]|['"]$/g, ""), 220).replace(/[.\s]+$/, "");
    return `Hi ${target}, ${body}.`;
  }

  const emailMatch = clean.match(/^draft an email to\s+(.+?)\s+saying\s+(.+)$/i);
  if (emailMatch?.[1] && emailMatch?.[2]) {
    const target = prettifyTargetName(emailMatch[1]);
    const body = compact(emailMatch[2].replace(/^['"]|['"]$/g, ""), 260).replace(/[.\s]+$/, "");
    return `Subject: Quick note

Hi ${target},

${body}.

Best,`;
  }

  return "";
}

function turnMessageWindow(messages: CompanionMessage[], contextMode: HomieContextMode, directRequestDetected: boolean, strictCommandPassthrough: boolean) {
  const rows = Array.isArray(messages) ? messages.filter((row) => row && row.role !== "system") : [];
  if (!rows.length) return [];
  const latestUser = [...rows].reverse().find((row) => row.role === "user");
  if (contextMode === "clean") {
    if (latestUser && (directRequestDetected || strictCommandPassthrough)) return [latestUser];
    return rows.slice(-4);
  }
  if (contextMode === "memory") return rows.slice(-6);
  return rows.slice(-8);
}

function describeTurnResponseStyle(responseStyle: HomieResponseStyle) {
  if (responseStyle === "direct") return "Direct";
  if (responseStyle === "supportive") return "Supportive";
  return "Companion";
}

function extractNeedFromUserText(text: string) {
  const clean = compact(text, 180);
  if (!clean) return "";
  const patterns = [
    /\b(?:i need to|need to|i need)\s+(.+)/i,
    /\b(?:i want to|want to)\s+(.+)/i,
    /\b(?:i'm trying to|im trying to|trying to)\s+(.+)/i,
    /\b(?:help me|stay with me while i|sort out)\s+(.+)/i,
    /\b(?:my goal is to|goal is to)\s+(.+)/i,
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match?.[1]) return compact(match[1], 120);
  }
  return clean;
}

function extractCompanionFacts(messages: CompanionMessage[]) {
  const candidateLines: string[] = [];
  for (const row of messages.filter((m) => m.role === "user").slice(-16)) {
    const clean = compact(row.content, 180);
    if (!clean) continue;
    if (/\b(i need|i want|i'm trying|im trying|my goal|i feel|i felt|i'm stuck|im stuck|stay with me|sort this out|help me)\b/i.test(clean)) {
      candidateLines.push(clean);
      continue;
    }
    if (clean.split(/\s+/).length >= 7 && clean.length <= 140) candidateLines.push(clean);
  }
  return dedupeLines(candidateLines, MAX_MEMORY_FACTS);
}

function buildSessionSummary(messages: CompanionMessage[]) {
  const recent = messages.slice(-6).map((row) => `${row.role === "assistant" ? "Homie" : "User"}: ${compact(row.content, 110)}`);
  return compact(recent.join(" • "), 420);
}

export function getProviderLabel(provider: HomieProviderKind) {
  if (provider === "openai_compat") return "OpenAI-compatible";
  if (provider === "bridge") return "Custom bridge";
  return "Local Ollama";
}

function normalizeEndpointUrl(raw: string, fallback: string) {
  let clean = String(raw || "").trim();
  if (!clean) clean = fallback;
  if (clean && !/^https?:\/\//i.test(clean) && /^[\w.-]+(?::\d+)?(?:\/.*)?$/i.test(clean)) {
    clean = `http://${clean}`;
  }
  return clean.replace(/\/+$/, "");
}

function isLikelyLocalUrl(url: string) {
  const clean = String(url || "").toLowerCase();
  return clean.includes("127.0.0.1") || clean.includes("localhost") || clean.includes("0.0.0.0");
}

export function buildEmbodiedCompanionPrompt(activePanelId = "Home") {
  const base = buildDefaultHomieSystem(activePanelId);
  return [
    base,
    "Embodied companion style:",
    "- Feel present, supportive, and steady without sounding fake.",
    "- Keep voice replies easy to say out loud: warm, natural, and short enough for back-and-forth.",
    "- Reflect the user's emotion briefly, then offer one grounded next move.",
    "- Ask small follow-up questions instead of delivering giant walls unless asked for detail.",
    "- Sound like a caring companion/operator hybrid: practical, honest, and easy to stay with.",
    "Synthetic companion presence:",
    "- Speak like you are in the room with the user: attentive, calm, and responsive.",
    "- Remember what you and the user have been working through lately so the thread feels continuous across days.",
    "- Let routine check-ins feel natural, light, and real instead of robotic or clingy.",
    "- Favor 1-3 short spoken sentences, then pause naturally for the next turn.",
    "- Use tiny acknowledgements before advice when the user is stressed.",
    "- Keep the rhythm conversational: listen, reflect briefly, answer, then leave room for the next turn.",
    "- Sound like you are staying with the user, not delivering a speech at them.",
    "- When voice is active, avoid giant lists unless the user asks for them.",
    "- Stay grounded and truthful. Do not pretend the local model or tools worked if they did not.",
    "Direct-request priority:",
    "- If the user asks for a simple deliverable like a greeting, rewrite, message, caption, answer, or script, do that directly first.",
    "- Do not turn a direct request into coaching, therapy, or troubleshooting unless the user asked for that.",
    "- Ignore old provider or diagnostics chatter unless the user is explicitly troubleshooting Homie right now.",
  ].join("\n");
}

export function buildProviderSetupWizard(args: {
  activePanelId?: string;
  provider: HomieProviderKind;
  ollamaModel?: string;
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  bridgeBaseUrl?: string;
  bridgeModel?: string;
  desktop?: boolean;
  probe?: ProviderSetupWizardProbe | null;
}): ProviderSetupWizardPlan {
  const panelId = args.activePanelId || "Home";
  const settings = loadHomieSettings(panelId);
  const provider = args.provider || settings.provider;
  const providerLabel = getProviderLabel(provider);
  const desktop = !!args.desktop;
  const probe = args.probe || null;
  const patch: Partial<HomieSettings> = {};
  const steps: ProviderSetupWizardStep[] = [];
  const push = (step: ProviderSetupWizardStep) => steps.push(step);

  push({
    id: "desktop",
    title: "Desktop runtime",
    state: desktop ? "done" : "action",
    detail: desktop
      ? "Desktop mode is running, so Homie can safely talk to local providers."
      : "Run OddEngine in desktop mode so Homie can reach local or protected providers.",
    command: desktop ? undefined : "npm run dev:desktop",
  });

  if (provider === "ollama") {
    let model = String(args.ollamaModel || settings.ollamaModel || DEFAULT_OLLAMA_MODEL).trim();
    if (!model) {
      model = DEFAULT_OLLAMA_MODEL;
      patch.ollamaModel = model;
    }
    const runtime = makeRuntime("ollama", settings, { model });
    const models = Array.isArray(probe?.models) ? probe!.models!.map((row) => String(row)) : [];
    const modelReady = models.some((row) => row === model) || String(probe?.model || "") === model;
    push({
      id: "ollama-service",
      title: "Reach Ollama",
      state: probe?.ok ? "done" : "action",
      detail: probe?.ok
        ? `Ollama answered at 127.0.0.1:11434 and is ready for ${probe?.model || model}.`
        : normalizeProviderError(String(probe?.error || ""), runtime),
      command: probe?.ok ? undefined : "ollama serve",
    });
    push({
      id: "ollama-model",
      title: "Download the chat model",
      state: modelReady ? "done" : "action",
      detail: modelReady
        ? `${model} is available locally.`
        : `${model} still needs to be pulled locally before Homie can answer.`,
      command: `ollama pull ${model}`,
    });
    const ready = desktop && !!probe?.ok && modelReady;
    return {
      provider,
      providerLabel,
      ready,
      headline: ready ? "Homie is ready to talk through Ollama." : "Homie needs Ollama running locally first.",
      summary: ready
        ? `${providerLabel} is reachable and ${model} is loaded.`
        : `Fast path: start Ollama, run \`ollama pull ${model}\`, then hit Check provider again.`,
      patch,
      steps,
    };
  }

  if (provider === "openai_compat") {
    let baseUrl = normalizeEndpointUrl(String(args.openaiBaseUrl || settings.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL), DEFAULT_OPENAI_BASE_URL);
    let model = String(args.openaiModel || settings.openaiModel || "gpt-4o-mini").trim();
    const apiKey = String(args.openaiApiKey || settings.openaiApiKey || "").trim();
    if (baseUrl !== String(args.openaiBaseUrl || settings.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL).trim()) patch.openaiBaseUrl = baseUrl;
    if (!model) {
      model = "gpt-4o-mini";
      patch.openaiModel = model;
    }
    const localUrl = isLikelyLocalUrl(baseUrl);
    push({
      id: "openai-url",
      title: "Base URL",
      state: baseUrl ? "done" : "action",
      detail: baseUrl
        ? `Homie will probe ${baseUrl}.`
        : "Paste the base URL for your OpenAI-compatible endpoint.",
    });
    push({
      id: "openai-auth",
      title: localUrl ? "Local server running" : "API key",
      state: localUrl ? (probe?.ok ? "done" : "action") : (apiKey ? "done" : "warn"),
      detail: localUrl
        ? (probe?.ok ? "Your local OpenAI-compatible server answered." : `The current URL looks local. Start that local server, then probe ${baseUrl} again.`)
        : (apiKey ? "API key is filled in." : "This looks like a remote endpoint, so Homie probably needs an API key."),
    });
    push({
      id: "openai-probe",
      title: "Probe endpoint",
      state: probe?.ok ? "done" : "action",
      detail: probe?.ok
        ? `${providerLabel} answered and is ready for ${probe?.model || model}.`
        : normalizeProviderError(String(probe?.error || ""), makeRuntime("openai_compat", settings, { baseUrl, model, apiKey })),
    });
    const ready = desktop && !!probe?.ok && (!!apiKey || localUrl);
    return {
      provider,
      providerLabel,
      ready,
      headline: ready ? "Homie is ready through your OpenAI-compatible lane." : "Homie needs a reachable compatible endpoint.",
      summary: ready
        ? `${providerLabel} is reachable at ${baseUrl}.`
        : localUrl
          ? `That URL is local. Start the local server behind ${baseUrl}, then hit Check provider again.`
          : `Paste the real remote base URL, add the API key, and probe again.`,
      patch,
      steps,
    };
  }

  let bridgeBaseUrl = normalizeEndpointUrl(String(args.bridgeBaseUrl || settings.bridgeBaseUrl || DEFAULT_BRIDGE_BASE_URL), DEFAULT_BRIDGE_BASE_URL);
  let bridgeModel = String(args.bridgeModel || settings.bridgeModel || "homie-bridge").trim();
  if (bridgeBaseUrl !== String(args.bridgeBaseUrl || settings.bridgeBaseUrl || DEFAULT_BRIDGE_BASE_URL).trim()) patch.bridgeBaseUrl = bridgeBaseUrl;
  if (!bridgeModel) {
    bridgeModel = "homie-bridge";
    patch.bridgeModel = bridgeModel;
  }
  push({
    id: "bridge-url",
    title: "Bridge URL",
    state: bridgeBaseUrl ? "done" : "action",
    detail: bridgeBaseUrl
      ? `Homie will probe ${bridgeBaseUrl}.`
      : "Paste the URL where your custom bridge is listening.",
  });
  push({
    id: "bridge-runtime",
    title: "Start the bridge",
    state: probe?.ok ? "done" : "action",
    detail: probe?.ok
      ? `The bridge answered and is ready for ${probe?.model || bridgeModel}.`
      : normalizeProviderError(String(probe?.error || ""), makeRuntime("bridge", settings, { baseUrl: bridgeBaseUrl, model: bridgeModel })),
  });
  const ready = desktop && !!probe?.ok;
  return {
    provider,
    providerLabel,
    ready,
    headline: ready ? "Homie is ready through your custom bridge." : "Homie needs the custom bridge online first.",
    summary: ready
      ? `${providerLabel} is reachable at ${bridgeBaseUrl}.`
      : `Start the bridge at ${bridgeBaseUrl}, then hit Check provider again.`,
    patch,
    steps,
  };
}

export function buildDefaultHomieSystem(activePanelId: string) {
  const panelMeta = getPanelMeta(activePanelId || "Home");
  const panelCtx = readPanelContext(activePanelId || "Home");
  const snap = buildHomieCoreSnapshot(activePanelId || "Home");
  const memory = buildHomieRelationshipMemory(activePanelId || "Home");
  const panelMemory = buildPanelCompanionMemory(activePanelId || "Home");
  return [
    "You are Homie👊, the built-in companion inside FairlyOdd OS.",
    "Be warm, honest, grounded, and practical.",
    "Act like a real companion: help, guide, talk, listen, and stay with the user while they work.",
    "Keep replies human and emotionally intelligent without becoming fake or over-the-top.",
    "Favor tiny-step coaching, plain English, and realistic next actions.",
    "Do not pretend you did actions you did not do. Be transparent about local AI limitations.",
    "If the user sounds overloaded, slow the plan down and offer one calm next move.",
    "When the user gives a simple direct request, fulfill it directly and briefly before offering any supportive follow-up.",
    `Active panel: ${panelMeta.title}.`,
    `Panel summary: ${panelCtx.summary}`,
    `Homie snapshot: ${snap.operatorHeadline} ${snap.briefing}`,
    `Relationship memory: ${memory.relationshipBrief}`,
    `Pattern line: ${memory.patternLine}`,
    `Money line: ${memory.moneyLine}`,
    memory.conversationArcLine,
    memory.sharedRoutineLine,
    memory.latelyLine,
    `Gentle check-in cue: ${memory.gentleCheckInCue}`,
    memory.panelMoodSummary ? `Panel mood memory: ${memory.panelMoodSummary}` : "",
    memory.panelContextSummary ? `Panel context memory: ${memory.panelContextSummary}` : "",
    memory.pinnedFacts.length ? `Pinned facts: ${memory.pinnedFacts.map((row) => row.text).join(" • ")}` : "",
    memory.milestones.length ? `Relationship milestones: ${memory.milestones.map((row) => row.text).join(" • ")}` : "",
    panelMemory.current?.lastSummary ? `Current panel lane summary: ${panelMemory.current.lastSummary}` : "",
  ].filter(Boolean).join("\n");
}

export function loadHomieSettings(activePanelId = "Home"): HomieSettings {
  const saved = loadJSON<any>(HOMIE_SETTINGS_KEY, null as any) || {};
  const provider = saved.provider === "openai_compat" || saved.provider === "bridge" || saved.provider === "ollama"
    ? saved.provider
    : "ollama";
  const ollamaModel = String(saved.ollamaModel || saved.model || DEFAULT_OLLAMA_MODEL);
  const openaiModel = String(saved.openaiModel || "gpt-4o-mini");
  const bridgeModel = String(saved.bridgeModel || "homie-bridge");
  const voiceMode = saved.voiceMode === "companion" || saved.voiceMode === "commands" || saved.voiceMode === "smart"
    ? saved.voiceMode
    : "smart";
  const responseStyle: HomieResponseStyle = saved.responseStyle === "direct" || saved.responseStyle === "supportive" || saved.responseStyle === "companion"
    ? saved.responseStyle
    : "companion";
  const contextMode: HomieContextMode = saved.contextMode === "panel" || saved.contextMode === "memory" || saved.contextMode === "clean"
    ? saved.contextMode
    : (typeof saved.includeContext === "boolean" ? (saved.includeContext ? "panel" : "clean") : "clean");
  const includeContext = contextMode !== "clean";
  return {
    provider,
    model: String(saved.model || ollamaModel),
    ollamaModel,
    openaiBaseUrl: String(saved.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL),
    openaiApiKey: String(saved.openaiApiKey || ""),
    openaiModel,
    bridgeBaseUrl: String(saved.bridgeBaseUrl || DEFAULT_BRIDGE_BASE_URL),
    bridgeModel,
    temperature: Number.isFinite(Number(saved.temperature)) ? Number(saved.temperature) : 0.35,
    system: String(saved.system || buildDefaultHomieSystem(activePanelId)),
    includeContext,
    contextMode,
    chatCleanMode: typeof saved.chatCleanMode === "boolean" ? !!saved.chatCleanMode : true,
    responseStyle,
    voiceMode,
    autoSpeakReplies: typeof saved.autoSpeakReplies === "boolean" ? !!saved.autoSpeakReplies : true,
    autoFallback: typeof saved.autoFallback === "boolean" ? !!saved.autoFallback : true,
    rememberCompanionFacts: typeof saved.rememberCompanionFacts === "boolean" ? !!saved.rememberCompanionFacts : true,
  };
}

export function saveHomieSettings(next: Partial<HomieSettings>, activePanelId = "Home") {
  const current = loadHomieSettings(activePanelId);
  const merged: HomieSettings = {
    ...current,
    ...next,
    provider: next.provider || current.provider,
    contextMode: (next as any).contextMode === "panel" || (next as any).contextMode === "memory" || (next as any).contextMode === "clean"
      ? (next as any).contextMode
      : (typeof (next as any).includeContext === "boolean" ? ((next as any).includeContext ? "panel" : "clean") : current.contextMode),
  };
  merged.includeContext = merged.contextMode !== "clean";
  const activeModel = merged.provider === "openai_compat"
    ? merged.openaiModel
    : merged.provider === "bridge"
      ? merged.bridgeModel
      : merged.ollamaModel;
  const payload = {
    ...merged,
    model: activeModel,
  };
  saveJSON(HOMIE_SETTINGS_KEY, payload);
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("oddengine:homie-settings-changed", { detail: payload }));
    }
  } catch {}
  return payload;
}

export function loadCompanionMessages() {
  const rows = loadJSON<CompanionMessage[]>(HOMIE_COMPANION_CHAT_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function saveCompanionMessages(rows: CompanionMessage[]) {
  saveJSON(HOMIE_COMPANION_CHAT_KEY, (Array.isArray(rows) ? rows : []).slice(-MAX_COMPANION_MESSAGES));
}

export function clearCompanionMessages() {
  saveCompanionMessages([]);
}

export function loadCompanionMemoryState(): CompanionMemoryState {
  const raw = loadJSON<any>(HOMIE_COMPANION_MEMORY_KEY, null as any) || {};
  return {
    currentFocus: String(raw.currentFocus || ""),
    lastUserNeed: String(raw.lastUserNeed || ""),
    sessionSummary: String(raw.sessionSummary || ""),
    conversationArc: stripMemoryLead(String(raw.conversationArc || ""), "arc"),
    sharedRoutine: stripMemoryLead(String(raw.sharedRoutine || ""), "routine"),
    rememberedFacts: Array.isArray(raw.rememberedFacts) ? dedupeLines(raw.rememberedFacts.map((row: any) => String(row || "")), MAX_MEMORY_FACTS) : [],
    updatedAt: Number(raw.updatedAt || 0) || 0,
  };
}

export function saveCompanionMemoryState(next: CompanionMemoryState) {
  const normalized: CompanionMemoryState = {
    currentFocus: compact(next.currentFocus || "", 160),
    lastUserNeed: compact(next.lastUserNeed || "", 160),
    sessionSummary: compact(next.sessionSummary || "", 420),
    conversationArc: stripMemoryLead(next.conversationArc || "", "arc"),
    sharedRoutine: stripMemoryLead(next.sharedRoutine || "", "routine"),
    rememberedFacts: dedupeLines(next.rememberedFacts || [], MAX_MEMORY_FACTS),
    updatedAt: Number(next.updatedAt || Date.now()) || Date.now(),
  };
  saveJSON(HOMIE_COMPANION_MEMORY_KEY, normalized);
  return normalized;
}

export function clearCompanionMemoryState() {
  saveCompanionMemoryState({
    currentFocus: "",
    lastUserNeed: "",
    sessionSummary: "",
    conversationArc: "",
    sharedRoutine: "",
    rememberedFacts: [],
    updatedAt: Date.now(),
  });
}

export function syncCompanionMemoryFromMessages(messages: CompanionMessage[], activePanelId = "Home") {
  const current = loadCompanionMemoryState();
  const facts = extractCompanionFacts(messages);
  const latestUser = [...messages].reverse().find((row) => row.role === "user")?.content || "";
  const relationship = buildHomieRelationshipMemory(activePanelId);
  const next: CompanionMemoryState = {
    currentFocus: compact(latestUser || current.currentFocus || getPanelMeta(activePanelId).title, 160),
    lastUserNeed: extractNeedFromUserText(latestUser) || current.lastUserNeed,
    sessionSummary: buildSessionSummary(messages) || current.sessionSummary,
    conversationArc: stripMemoryLead(relationship.conversationArcLine || current.conversationArc, "arc"),
    sharedRoutine: stripMemoryLead(relationship.sharedRoutineLine || current.sharedRoutine, "routine"),
    rememberedFacts: dedupeLines([...facts, ...current.rememberedFacts], MAX_MEMORY_FACTS),
    updatedAt: Date.now(),
  };
  const saved = saveCompanionMemoryState(next);
  try {
    const panelTitle = getPanelMeta(activePanelId).title;
    rememberPanelCompanionState(activePanelId, {
      panelTitle,
      lastNeed: saved.lastUserNeed || saved.currentFocus,
      lastSummary: saved.sessionSummary,
      context: saved.currentFocus || saved.lastUserNeed || panelTitle,
      mood: normalizePanelMood(activePanelId, saved.lastUserNeed || saved.currentFocus || ""),
    });
    logHomieRoutineCheckIn(activePanelId, {
      panelTitle,
      need: saved.lastUserNeed || saved.currentFocus,
      summary: saved.sessionSummary,
      arc: saved.conversationArc || saved.lastUserNeed || saved.currentFocus,
      routine: saved.sharedRoutine,
      ts: Date.now(),
    });
  } catch {}
  return saved;
}


function normalizePanelMood(panelId: string, signal: string) {
  const normalized = String(panelId || "").toLowerCase();
  const lower = String(signal || "").toLowerCase();
  if (normalized === "trading") {
    if (/panic|revenge|chase|fomo|loss|bleed/.test(lower)) return "risk-down coach";
    return "calm sniper";
  }
  if (normalized === "money" || normalized === "phoenixincomeforge") {
    return /overwhelm|stuck|tired/.test(lower) ? "gentle money coach" : "money hunter";
  }
  if (normalized === "books" || normalized === "builder" || normalized === "studio") return "creator heat";
  if (normalized === "familyhealth" || normalized === "happyhealthy") return "recovery guide";
  if (normalized === "grow" || normalized === "cannabis") return "watchful operator";
  if (normalized === "brain" || normalized === "homie") return "shell operator";
  return /tired|overwhelmed|heavy/.test(lower) ? "grounding companion" : "steady companion";
}

function buildSystemWithMemory(args: {
  activePanelId: string;
  messages: CompanionMessage[];
  baseSystem?: string;
  includeContext?: boolean;
  rememberCompanionFacts?: boolean;
  contextMode?: HomieContextMode;
  chatCleanMode?: boolean;
  responseStyle?: HomieResponseStyle;
}) {
  const panelId = args.activePanelId || "Home";
  const settings = loadHomieSettings(panelId);
  const baseSystem = String(args.baseSystem || settings.system || buildDefaultHomieSystem(panelId)).trim();
  const contextMode: HomieContextMode = args.contextMode === "panel" || args.contextMode === "memory" || args.contextMode === "clean"
    ? args.contextMode
    : (typeof args.includeContext === "boolean" ? (args.includeContext ? "panel" : "clean") : settings.contextMode);
  const rememberCompanionFacts = typeof args.rememberCompanionFacts === "boolean" ? args.rememberCompanionFacts : settings.rememberCompanionFacts;
  const chatCleanMode = typeof args.chatCleanMode === "boolean" ? args.chatCleanMode : settings.chatCleanMode;
  const responseStyle: HomieResponseStyle = args.responseStyle === "direct" || args.responseStyle === "supportive" || args.responseStyle === "companion"
    ? args.responseStyle
    : settings.responseStyle;
  const latestUserMessage = [...args.messages].reverse().find((row) => row.role === "user")?.content || "";
  const directRequestDetected = detectDirectRequest(latestUserMessage);
  const strictCommandPassthrough = isStrictCommandPassthrough(latestUserMessage);
  const turnResponseStyle: HomieResponseStyle = strictCommandPassthrough || directRequestDetected ? "direct" : responseStyle;
  const supportModeApplied = turnResponseStyle !== "direct";
  const contextIncluded: "none" | "minimal" | "full" = contextMode === "panel" ? "full" : contextMode === "memory" ? "minimal" : "none";
  const messagesForTurn = turnMessageWindow(args.messages, contextMode, directRequestDetected, strictCommandPassthrough);
  const memory = rememberCompanionFacts ? syncCompanionMemoryFromMessages(args.messages, panelId) : loadCompanionMemoryState();
  const core: string[] = [
    baseSystem,
    "Live user priority:",
    "- Follow the user's current request first.",
    "- If the user asks for a short direct deliverable, produce it directly instead of coaching them.",
    "- Do not let provider warnings, diagnostics, or old troubleshooting text override the current user request unless the user is clearly asking for troubleshooting.",
    `Current turn response style: ${describeTurnResponseStyle(turnResponseStyle)}.`,
    `Direct request detected: ${directRequestDetected ? "yes" : "no"}.`,
    `Strict command passthrough: ${strictCommandPassthrough ? "yes" : "no"}.`,
  ];
  if (strictCommandPassthrough || directRequestDetected) {
    core.push("Direct command gate:");
    core.push("- Fulfill the current request directly and briefly.");
    core.push("- For greetings, rewrites, short drafting asks, summaries, and direct commands: return the requested deliverable itself.");
    core.push("- Do not switch into reflective coaching, therapy, or troubleshooting unless the user explicitly asked for that.");
    core.push("- Do not ask a follow-up question unless the request is ambiguous or missing required information.");
  }
  const memoryLines: string[] = [];
  if (contextMode !== "clean") {
    if (memory.currentFocus) memoryLines.push(`Current user focus: ${memory.currentFocus}`);
    if (memory.lastUserNeed) memoryLines.push(`Latest user need: ${memory.lastUserNeed}`);
    if (memory.sessionSummary) memoryLines.push(`Session summary: ${memory.sessionSummary}`);
    if (memory.conversationArc) memoryLines.push(`Conversation arc memory: ${memory.conversationArc}`);
    if (memory.sharedRoutine) memoryLines.push(`Shared routine memory: ${memory.sharedRoutine}`);
    if (memory.rememberedFacts.length) memoryLines.push(`Remembered user lines: ${memory.rememberedFacts.join(" • ")}`);
  }
  const panelLines: string[] = [];
  if (contextMode === "panel") {
    const panelMeta = getPanelMeta(panelId);
    const panelCtx = readPanelContext(panelId);
    const snap = buildHomieCoreSnapshot(panelId);
    const relationship = buildHomieRelationshipMemory(panelId);
    const panelMemory = buildPanelCompanionMemory(panelId);
    panelLines.push(`Live panel focus: ${panelMeta.title}.`);
    panelLines.push(`Live panel note: ${panelCtx.summary}`);
    panelLines.push(`Live companion headline: ${snap.companionHeadline || snap.operatorHeadline}`);
    panelLines.push(`Live relationship brief: ${relationship.relationshipBrief}`);
    panelLines.push(relationship.conversationArcLine);
    panelLines.push(relationship.sharedRoutineLine);
    panelLines.push(relationship.latelyLine);
    panelLines.push(`Gentle check-in cue: ${relationship.gentleCheckInCue}`);
    if (relationship.panelMoodSummary) panelLines.push(`Panel mood memory: ${relationship.panelMoodSummary}`);
    if (relationship.panelContextSummary) panelLines.push(`Panel context memory: ${relationship.panelContextSummary}`);
    if (relationship.pinnedFacts.length) panelLines.push(`Pinned facts: ${relationship.pinnedFacts.map((row) => row.text).join(" • ")}`);
    if (relationship.milestones.length) panelLines.push(`Relationship milestones: ${relationship.milestones.map((row) => row.text).join(" • ")}`);
    if (panelMemory.current?.lastSummary) panelLines.push(`Current panel history: ${panelMemory.current.lastSummary}`);
  }
  const modeLine = contextMode === "panel"
    ? "Prompt mode: panel context + rolling memory."
    : contextMode === "memory"
      ? "Prompt mode: rolling memory only."
      : "Prompt mode: clean chat only. Use the current user message plus a tiny recent chat window only.";
  const cleanLine = chatCleanMode
    ? "Chat clean mode is ON. Ignore old provider help, diagnostics chatter, and warning-style assistant turns unless the user explicitly asks to debug them."
    : "Chat clean mode is OFF. Normal recent chat history can influence replies.";
  const responseLine = turnResponseStyle === "direct"
    ? "Response style gate: direct. Be brief, obey the request, and do not coach unless asked."
    : turnResponseStyle === "supportive"
      ? "Response style gate: supportive. Keep it gentle and practical without hijacking the request."
      : "Response style gate: companion. Stay warm and present, but still complete the request first.";
  const system = [
    ...core,
    modeLine,
    cleanLine,
    responseLine,
    memoryLines.length ? "Rolling companion memory:\n" + memoryLines.join("\n") : "",
    panelLines.length ? "Panel context (optional):\n" + panelLines.join("\n") : "",
    "Reply like a real companion: calm, practical, and present. Keep it short enough to feel conversational unless the user asks for depth.",
    "Carry continuity across days lightly. Reference the shared thread when it helps, but never sound clingy, fake, over-scripted, or diagnostic-heavy.",
  ].filter(Boolean).join("\n");
  return { system, memory, promptMode: contextMode, chatCleanMode, directRequestDetected, supportModeApplied, contextIncluded, responseStyle: turnResponseStyle, messagesForTurn };
}

function makeRuntime(provider: HomieProviderKind, settings: HomieSettings, overrides?: Partial<CompanionRuntime>): CompanionRuntime {
  if (provider === "openai_compat") {
    return {
      provider,
      providerLabel: getProviderLabel(provider),
      model: String(overrides?.model || settings.openaiModel || "gpt-4o-mini"),
      temperature: typeof overrides?.temperature === "number" ? overrides.temperature : settings.temperature,
      system: String(overrides?.system || settings.system || ""),
      baseUrl: String(overrides?.baseUrl || settings.openaiBaseUrl || DEFAULT_OPENAI_BASE_URL),
      apiKey: String(overrides?.apiKey || settings.openaiApiKey || ""),
    };
  }
  if (provider === "bridge") {
    return {
      provider,
      providerLabel: getProviderLabel(provider),
      model: String(overrides?.model || settings.bridgeModel || "homie-bridge"),
      temperature: typeof overrides?.temperature === "number" ? overrides.temperature : settings.temperature,
      system: String(overrides?.system || settings.system || ""),
      baseUrl: String(overrides?.baseUrl || settings.bridgeBaseUrl || DEFAULT_BRIDGE_BASE_URL),
      apiKey: String(overrides?.apiKey || ""),
    };
  }
  return {
    provider: "ollama",
    providerLabel: getProviderLabel("ollama"),
    model: String(overrides?.model || settings.ollamaModel || DEFAULT_OLLAMA_MODEL),
    temperature: typeof overrides?.temperature === "number" ? overrides.temperature : settings.temperature,
    system: String(overrides?.system || settings.system || ""),
    baseUrl: "",
    apiKey: "",
  };
}

function loadLastWorkingProvider(): HomieProviderKind | "" {
  const raw = loadJSON<any>(HOMIE_LAST_PROVIDER_OK_KEY, "") || "";
  return raw === "ollama" || raw === "openai_compat" || raw === "bridge" ? raw : "";
}

function saveLastWorkingProvider(provider: string) {
  const next = provider === "ollama" || provider === "openai_compat" || provider === "bridge" ? provider : "";
  if (!next) return;
  saveJSON(HOMIE_LAST_PROVIDER_OK_KEY, next);
}

function isProviderExplicitlyConfigured(runtime: CompanionRuntime, settings: HomieSettings) {
  if (runtime.provider === "openai_compat") {
    const base = String(runtime.baseUrl || settings.openaiBaseUrl || "").trim();
    const key = String(runtime.apiKey || settings.openaiApiKey || "").trim();
    return !!key || (!!base && base !== DEFAULT_OPENAI_BASE_URL);
  }
  if (runtime.provider === "bridge") {
    const base = String(runtime.baseUrl || settings.bridgeBaseUrl || "").trim();
    return !!base && base !== DEFAULT_BRIDGE_BASE_URL;
  }
  return !!String(runtime.model || settings.ollamaModel || DEFAULT_OLLAMA_MODEL).trim();
}

function normalizeProviderError(errorLike: any, runtime: CompanionRuntime) {
  const raw = String(errorLike || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) {
    return runtime.provider === "ollama"
      ? `Local Ollama is not reachable at 127.0.0.1:11434. Start Ollama, then run: ollama pull ${runtime.model || DEFAULT_OLLAMA_MODEL}`
      : runtime.provider === "openai_compat"
        ? `OpenAI-compatible endpoint is not reachable at ${runtime.baseUrl || DEFAULT_OPENAI_BASE_URL}. If you meant a local tool like LM Studio, start it first. If you meant a remote endpoint, paste its real base URL and API key in Homie settings.`
        : `Custom bridge is not reachable at ${runtime.baseUrl || DEFAULT_BRIDGE_BASE_URL}. Start the bridge, then probe it again.`;
  }
  if (lower.includes("fetch failed") || lower.includes("failed to fetch") || lower.includes("econnrefused") || lower.includes("socket hang up")) {
    return runtime.provider === "ollama"
      ? `Local Ollama is not reachable at 127.0.0.1:11434. Start Ollama, then run: ollama pull ${runtime.model || DEFAULT_OLLAMA_MODEL}`
      : runtime.provider === "openai_compat"
        ? `OpenAI-compatible endpoint is not reachable at ${runtime.baseUrl || DEFAULT_OPENAI_BASE_URL}. The default points to a local server. Start that server or paste your real remote base URL and API key.`
        : `Custom bridge is not reachable at ${runtime.baseUrl || DEFAULT_BRIDGE_BASE_URL}. Start the bridge, then probe it again.`;
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) {
    return runtime.provider === "ollama"
      ? `Local Ollama at 127.0.0.1:11434 timed out. It may still be loading the model ${runtime.model || DEFAULT_OLLAMA_MODEL}.`
      : `${runtime.providerLabel} timed out at ${runtime.baseUrl || "its configured URL"}.`;
  }
  return raw;
}

function isRuntimeConfigured(runtime: CompanionRuntime) {
  if (runtime.provider === "openai_compat") return !!runtime.baseUrl && !!runtime.model;
  if (runtime.provider === "bridge") return !!runtime.baseUrl && !!runtime.model;
  return !!runtime.model;
}

function buildProviderCandidates(args: {
  activePanelId: string;
  provider?: HomieProviderKind;
  model?: string;
  temperature?: number;
  system?: string;
  baseUrl?: string;
  apiKey?: string;
  autoFallback?: boolean;
}) {
  const settings = loadHomieSettings(args.activePanelId || "Home");
  const primaryProvider = args.provider || settings.provider;
  const primary = makeRuntime(primaryProvider, settings, {
    model: args.model,
    temperature: args.temperature,
    system: args.system,
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
  });
  const lastWorking = loadLastWorkingProvider();
  const alternates: CompanionRuntime[] = [
    makeRuntime("ollama", settings),
    makeRuntime("openai_compat", settings),
    makeRuntime("bridge", settings),
  ].filter((runtime) => {
    if (runtime.provider === primary.provider) return false;
    if (!isRuntimeConfigured(runtime)) return false;
    return isProviderExplicitlyConfigured(runtime, settings) || runtime.provider === lastWorking;
  });
  const ordered = [primary, ...((args.autoFallback ?? settings.autoFallback) ? alternates : [])]
    .filter((runtime, index, arr) => arr.findIndex((item) => item.provider === runtime.provider) === index)
    .filter(isRuntimeConfigured);
  return ordered.length ? ordered : [primary];
}

export function loadHomieCompanionRuntime(activePanelId: string): CompanionRuntime {
  return buildProviderCandidates({ activePanelId, autoFallback: false })[0];
}

export async function probeAllHomieProviders(activePanelId: string): Promise<CompanionProviderProbeResult[]> {
  if (!isDesktop()) return [];
  const api = oddApi();
  const seen = new Set<HomieProviderKind>();
  const results: CompanionProviderProbeResult[] = [];
  for (const runtime of buildProviderCandidates({ activePanelId, autoFallback: true })) {
    if (seen.has(runtime.provider)) continue;
    seen.add(runtime.provider);
    try {
      const probe = runtime.provider === "ollama"
        ? await api.homieCheck()
        : await (api.homieProviderProbe ? api.homieProviderProbe({ provider: runtime.provider, baseUrl: runtime.baseUrl, apiKey: runtime.apiKey, model: runtime.model } as any) : api.homieChat({ provider: runtime.provider, baseUrl: runtime.baseUrl, apiKey: runtime.apiKey, model: runtime.model, messages: [{ role: "user", content: "ping" }] } as any));
      results.push({
        provider: runtime.provider,
        providerLabel: runtime.providerLabel,
        ok: !!probe?.ok,
        detail: probe?.detail ? String(probe.detail) : "",
        error: probe?.error ? normalizeProviderError(String(probe.error), runtime) : "",
        models: Array.isArray(probe?.models) ? probe.models.map((row: any) => String(row)) : [],
        model: String(probe?.model || runtime.model || ""),
      });
    } catch (error: any) {
      results.push({
        provider: runtime.provider,
        providerLabel: runtime.providerLabel,
        ok: false,
        error: normalizeProviderError(String(error?.message || error || `Could not reach ${runtime.providerLabel}.`), runtime),
        models: [],
        model: runtime.model,
      });
    }
  }
  return results;
}

export async function sendCompanionChat(args: {
  activePanelId: string;
  messages: CompanionMessage[];
  provider?: HomieProviderKind;
  model?: string;
  temperature?: number;
  system?: string;
  baseUrl?: string;
  apiKey?: string;
  autoFallback?: boolean;
  includeContext?: boolean;
  rememberCompanionFacts?: boolean;
  contextMode?: HomieContextMode;
  chatCleanMode?: boolean;
  responseStyle?: HomieResponseStyle;
}): Promise<CompanionChatResult> {
  if (!isDesktop()) {
    return {
      ok: false,
      error: "Real companion chat needs Desktop mode so Homie can reach your AI provider safely.",
      model: args.model || "",
      reply: "",
      provider: args.provider || "ollama",
      providerLabel: getProviderLabel((args.provider as HomieProviderKind) || "ollama"),
      tried: [],
      promptMode: "desktop-required",
      directRequestDetected: false,
      supportModeApplied: false,
      contextIncluded: "none",
      responseStyle: "direct",
    };
  }
  const settings = loadHomieSettings(args.activePanelId);
  const candidates = buildProviderCandidates({
    activePanelId: args.activePanelId,
    provider: args.provider,
    model: args.model,
    temperature: args.temperature,
    system: args.system,
    baseUrl: args.baseUrl,
    apiKey: args.apiKey,
    autoFallback: args.autoFallback,
  });
  const cleanedMessages = sanitizeConversationMessages(args.messages, typeof args.chatCleanMode === "boolean" ? args.chatCleanMode : settings.chatCleanMode);
  const latestUserMessage = [...cleanedMessages].reverse().find((row) => row.role === "user")?.content || "";
  const localDirectReply = buildDirectCommandReply(latestUserMessage);
  const prepared = buildSystemWithMemory({
    activePanelId: args.activePanelId,
    messages: cleanedMessages,
    baseSystem: args.system,
    includeContext: args.includeContext,
    rememberCompanionFacts: args.rememberCompanionFacts,
    contextMode: args.contextMode,
    chatCleanMode: args.chatCleanMode,
    responseStyle: args.responseStyle,
  });
  if (localDirectReply) {
    return {
      ok: true,
      error: "",
      model: "local-direct-command",
      reply: localDirectReply,
      provider: "local-direct",
      providerLabel: "Local direct command",
      tried: ["Local direct command"],
      promptMode: prepared.promptMode,
      directRequestDetected: true,
      supportModeApplied: false,
      contextIncluded: "none",
      responseStyle: "direct",
    };
  }
  const api = oddApi();
  const call = api.homieProviderChat || api.homieChat;
  const tried: string[] = [];
  const errors: string[] = [];
  for (const runtime of candidates) {
    tried.push(runtime.providerLabel);
    const payload = {
      provider: runtime.provider,
      model: String(runtime.model || "llama3.1:8b"),
      temperature: typeof runtime.temperature === "number" ? runtime.temperature : settings.temperature,
      system: prepared.system,
      baseUrl: runtime.baseUrl || "",
      apiKey: runtime.apiKey || "",
      messages: prepared.messagesForTurn
        .map((row) => ({ role: row.role, content: row.content })),
    };
    try {
      const res = await call(payload as any);
      if (res?.ok && String(res.reply || "").trim()) {
        noteHomieInteraction("action", `Homie companion reply via ${runtime.providerLabel}`, args.activePanelId);
        saveLastWorkingProvider(String(res?.provider || runtime.provider));
        return {
          ok: true,
          error: "",
          model: String(res?.model || payload.model),
          reply: String(res?.reply || ""),
          provider: String(res?.provider || runtime.provider),
          providerLabel: runtime.providerLabel,
          tried,
          promptMode: prepared.promptMode,
          directRequestDetected: prepared.directRequestDetected,
          supportModeApplied: prepared.supportModeApplied,
          contextIncluded: prepared.contextIncluded,
          responseStyle: prepared.responseStyle,
        };
      }
      errors.push(normalizeProviderError(String(res?.error || `No reply returned from ${runtime.providerLabel}.`), runtime));
    } catch (error: any) {
      errors.push(normalizeProviderError(String(error?.message || error || `Could not reach ${runtime.providerLabel}.`), runtime));
    }
  }
  return {
    ok: false,
    error: errors.filter(Boolean).join(" | ") || `Homie could not reach ${tried.join(" → ") || "your configured provider"}.`,
    model: String(args.model || candidates[0]?.model || ""),
    reply: "",
    provider: String(candidates[0]?.provider || args.provider || settings.provider || "ollama"),
    providerLabel: candidates[0]?.providerLabel || getProviderLabel(settings.provider),
    tried,
    promptMode: prepared.promptMode,
    directRequestDetected: prepared.directRequestDetected,
    supportModeApplied: prepared.supportModeApplied,
    contextIncluded: prepared.contextIncluded,
    responseStyle: prepared.responseStyle,
  };
}

export function makeCompanionMessage(role: CompanionRole, content: string): CompanionMessage {
  const clean = String(content || "").trim();
  return {
    id: uid(role),
    role,
    content: clean,
    ts: Date.now(),
  };
}

export function queueCompanionInteraction(text: string, activePanelId: string) {
  noteHomieInteraction("action", text, activePanelId);
}
