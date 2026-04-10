import React, { useEffect, useMemo, useRef, useState } from "react";
import { isDesktop, oddApi } from "../lib/odd";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import { consumeHomieDraft, buildHomieCoreSnapshot, seedHomieDraft } from "../lib/homieCore";
import { addHomieMilestone, buildHomieRelationshipMemory, buildPanelCompanionMemory, loadHomieCompanionLaneMemory, pinHomieFact } from "../lib/homieMemory";
import { buildPhoenixIncomeForgeBoard } from "../lib/incomeForge";
import { buildEmbodiedCompanionPrompt, buildProviderSetupWizard, getProviderLabel, loadCompanionMemoryState, loadHomieSettings, probeAllHomieProviders, saveHomieSettings, sendCompanionChat, type CompanionProviderProbeResult, type HomieContextMode, type HomieProviderKind, type HomieResponseStyle, type HomieVoiceChatMode } from "../lib/homieCompanion";

type DevIssue = {
  id: string;
  title: string;
  severity: "error" | "warn" | "info";
  explanation?: string;
  recommendedPlaybooks?: string[];
  evidence?: string;
};

type DevSnapshot = {
  ok: boolean;
  runningCount: number;
  runs: Array<{ id: string; cmd: string; args: string[]; cwd: string; startedAt: number }>;
  lastExit?: { id: string; code: number; ts: number } | null;
  tail: Array<{ ts: number; type: string; id?: string; text: string }>;
  issues: DevIssue[];
  playbooks?: Array<{ id: string; name: string; safe: boolean; description: string }>;
};

type OllamaDoctorResult = {
  ok: boolean;
  installed?: boolean;
  reachable?: boolean;
  binary?: string;
  version?: string;
  models?: string[];
  detail?: string;
  error?: string;
  started?: boolean;
  model?: string;
};

type Props = {
  onNavigate: (panelId: string) => void;
  activePanelId?: string;
  onOpenHowTo?: () => void;
};

type ChatMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
};

const LS_CHAT = "oddengine:homie:chat:v1";
const LS_SETTINGS = "oddengine:homie:settings:v1";
const LS_AUTOFIX = "oddengine:homie:autofix:v1";
const LS_TARGET = "oddengine:homie:targetProject:v1";
const PREFS_KEY = "oddengine:prefs:v1";


const DEFAULT_SYSTEM =
  "You are Homie👊, the built-in assistant for FairlyOdd OS.\n" +
  "- Be warm, grounded, and practical.\n" +
  "- You can help, guide, talk, listen, and stay with the user while they work.\n" +
  "- Keep replies human, clear, and action-oriented instead of robotic.\n" +
  "- When suggesting commands, prefer PowerShell on Windows.\n" +
  "- Ask before running anything that writes/deletes files.\n" +
  "- If the user shows an error, explain it in plain English then give the safest fix steps.";

function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, val: any) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore
  }
}


function loadInitialHomieSettings() {
  const saved = loadJSON<any>(LS_SETTINGS, null as any) || {};
  return {
    model: String(saved.model || "llama3.1:8b"),
    temperature: Number.isFinite(Number(saved.temperature)) ? Number(saved.temperature) : 0.35,
    includeContext: typeof saved.includeContext === "boolean" ? !!saved.includeContext : true,
    system: String(saved.system || DEFAULT_SYSTEM),
  };
}

export default function Homie({ onNavigate, activePanelId, onOpenHowTo }: Props) {
  const desktop = isDesktop();

  const [devSnap, setDevSnap] = useState<DevSnapshot | null>(null);
  const [targetProject, setTargetProject] = useState<string>(() => {
    try{ return localStorage.getItem(LS_TARGET) || localStorage.getItem("oddengine:dev:projectDir") || ""; }catch(e){ return ""; }
  });
  const [autoFixEnabled, setAutoFixEnabled] = useState<boolean>(() => {
  const stored:any = loadJSON(LS_AUTOFIX, null as any);
  if(stored && typeof stored.enabled === "boolean") return stored.enabled;
  const prefs:any = loadJSON(PREFS_KEY, null as any);
  return !!prefs?.desktop?.autoRunSafeFixes;
});
  const [confirmPb, setConfirmPb] = useState<{ id: string; name: string; description: string; safe: boolean } | null>(null);
  const [autoCountdown, setAutoCountdown] = useState<number>(0);
  const [autoPb, setAutoPb] = useState<{ playbookId: string; reason: string } | null>(null);
  const [tab, setTab] = useState<"ai" | "guide">("ai");

  // Settings
  const initialSettings = useMemo(() => loadHomieSettings(activePanelId || "Homie"), [activePanelId]);
  const [provider, setProvider] = useState<HomieProviderKind>(() => initialSettings.provider);
  const [ollamaModel, setOllamaModel] = useState(() => initialSettings.ollamaModel);
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(() => initialSettings.openaiBaseUrl);
  const [openaiApiKey, setOpenaiApiKey] = useState(() => initialSettings.openaiApiKey);
  const [openaiModel, setOpenaiModel] = useState(() => initialSettings.openaiModel);
  const [bridgeBaseUrl, setBridgeBaseUrl] = useState(() => initialSettings.bridgeBaseUrl);
  const [bridgeModel, setBridgeModel] = useState(() => initialSettings.bridgeModel);
  const [temperature, setTemperature] = useState(() => initialSettings.temperature);
  const [contextMode, setContextMode] = useState<HomieContextMode>(() => initialSettings.contextMode);
  const [chatCleanMode, setChatCleanMode] = useState(() => initialSettings.chatCleanMode);
  const [responseStyle, setResponseStyle] = useState<HomieResponseStyle>(() => initialSettings.responseStyle);
  const [voiceMode, setVoiceMode] = useState<HomieVoiceChatMode>(() => initialSettings.voiceMode);
  const [autoSpeakReplies, setAutoSpeakReplies] = useState(() => initialSettings.autoSpeakReplies);
  const [autoFallback, setAutoFallback] = useState(() => initialSettings.autoFallback);
  const [rememberCompanionFacts, setRememberCompanionFacts] = useState(() => initialSettings.rememberCompanionFacts);
  const [systemPrompt, setSystemPrompt] = useState(() => initialSettings.system);
  const activeModel = provider === "openai_compat" ? openaiModel : provider === "bridge" ? bridgeModel : ollamaModel;
  const activeBaseUrl = provider === "openai_compat" ? openaiBaseUrl : provider === "bridge" ? bridgeBaseUrl : "";
  const activeApiKey = provider === "openai_compat" ? openaiApiKey : "";
  const activeProviderLabel = getProviderLabel(provider);
  const [providerMatrix, setProviderMatrix] = useState<CompanionProviderProbeResult[]>([]);
  const [ollamaDoctor, setOllamaDoctor] = useState<OllamaDoctorResult | null>(null);
  const [doctoring, setDoctoring] = useState(false);
  const [startingOllama, setStartingOllama] = useState(false);
  const [pullingOllamaModel, setPullingOllamaModel] = useState(false);

  function patchAiPrefs(partial: Record<string, any>) {
    try {
      const raw:any = loadJSON(PREFS_KEY, null as any) || {};
      const next = { ...raw, ai: { ...(raw.ai || {}), ...partial } };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("oddengine:prefs-changed", { detail: { prefs: next } }));
      return next;
    } catch {
      return null;
    }
  }

  const homieUiPrefs:any = loadJSON(PREFS_KEY, null as any)?.ai || {};
  const [voiceEngineMode, setVoiceEngineMode] = useState<"cloud" | "external-http" | "hybrid">(() => (homieUiPrefs.homieVoiceEngineMode || "cloud") as any);
  const [externalVoiceBaseUrl, setExternalVoiceBaseUrl] = useState<string>(() => String(homieUiPrefs.homieExternalVoiceBaseUrl || "http://127.0.0.1:8765"));
  const detachedCompanion = homieUiPrefs.homieCompanionWindow !== false;
  const avatarShellMode = homieUiPrefs.homieAvatarShellMode || "hybrid-hero";
  const homie3DModelUrl = homieUiPrefs.homie3DModelUrl || "/models/lilhomie.glb";

  useEffect(() => {
    saveHomieSettings({
      provider,
      model: activeModel,
      ollamaModel,
      openaiBaseUrl,
      openaiApiKey,
      openaiModel,
      bridgeBaseUrl,
      bridgeModel,
      temperature,
      contextMode,
      includeContext: contextMode !== "clean",
      chatCleanMode,
      responseStyle,
      voiceMode,
      autoSpeakReplies,
      autoFallback,
      rememberCompanionFacts,
      system: systemPrompt,
    }, activePanelId || "Homie");
  }, [provider, activeModel, ollamaModel, openaiBaseUrl, openaiApiKey, openaiModel, bridgeBaseUrl, bridgeModel, temperature, contextMode, chatCleanMode, responseStyle, voiceMode, autoSpeakReplies, autoFallback, rememberCompanionFacts, systemPrompt, activePanelId]);


  useEffect(() => {
    patchAiPrefs({ homieVoiceEngineMode: voiceEngineMode, homieExternalVoiceBaseUrl: externalVoiceBaseUrl });
  }, [voiceEngineMode, externalVoiceBaseUrl]);

  useEffect(() => {
    saveJSON(LS_AUTOFIX, { enabled: autoFixEnabled });
  }, [autoFixEnabled]);

  useEffect(() => {
    try{ localStorage.setItem(LS_TARGET, targetProject || ""); }catch(e){}
  }, [targetProject]);

  // If target project isn't set yet, default to the OddEngine folder (dev mode).
  useEffect(() => {
    if(!desktop) return;
    if(targetProject) return;
    (async () => {
      try{
        const info = await oddApi().getSystemInfo();
        if(info && info.ok && !info.packaged && info.cwd){
          setTargetProject(info.cwd);
          try{ localStorage.setItem("oddengine:dev:projectDir", info.cwd); }catch(e){}
        }
      }catch(e){}
    })();
  }, [desktop, targetProject]);

  // Ollama status
  const [checking, setChecking] = useState(false);
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaError, setOllamaError] = useState<string>("");
  const activeProviderProbe = useMemo(() => {
    const row = providerMatrix.find((item) => item.provider === provider);
    if (row) {
      return {
        provider: row.provider,
        ok: row.ok,
        error: row.error,
        detail: row.detail,
        models: row.models,
        model: row.model,
      };
    }
    if (ollamaRunning === null && !ollamaError && !ollamaModels.length) return null;
    return {
      provider,
      ok: !!ollamaRunning,
      error: ollamaRunning ? "" : ollamaError,
      detail: "",
      models: ollamaModels,
      model: activeModel,
    };
  }, [providerMatrix, provider, ollamaRunning, ollamaError, ollamaModels, activeModel]);
  const providerWizard = useMemo(() => buildProviderSetupWizard({
    activePanelId: activePanelId || "Homie",
    provider,
    ollamaModel,
    openaiBaseUrl,
    openaiApiKey,
    openaiModel,
    bridgeBaseUrl,
    bridgeModel,
    desktop,
    probe: activeProviderProbe,
  }), [activePanelId, provider, ollamaModel, openaiBaseUrl, openaiApiKey, openaiModel, bridgeBaseUrl, bridgeModel, desktop, activeProviderProbe]);

  async function checkOllama() {
    if (!desktop) return;
    setChecking(true);
    setOllamaError("");
    try {
      const api = oddApi();
      const r = provider === "ollama"
        ? await api.homieCheck()
        : await (api.homieProviderProbe ? api.homieProviderProbe({ provider, baseUrl: activeBaseUrl, apiKey: activeApiKey, model: activeModel } as any) : api.homieChat({ provider, baseUrl: activeBaseUrl, apiKey: activeApiKey, model: activeModel, messages: [{ role: "user", content: "ping" }] } as any));
      if (r && r.ok) {
        setOllamaRunning(true);
        const probeModels = Array.isArray((r as any).models) ? (r as any).models : ((r as any).model ? [(r as any).model] : []);
        setOllamaModels(probeModels);
      } else {
        setOllamaRunning(false);
        setOllamaModels([]);
        setOllamaError((r && (r as any).error) || `${activeProviderLabel} is not reachable.`);
      }
    } catch (e: any) {
      setOllamaRunning(false);
      setOllamaModels([]);
      setOllamaError(String(e));
    } finally {
      setChecking(false);
    }
  }

  async function runProviderDoctor() {
    if (!desktop) return;
    if (provider !== "ollama") {
      await checkOllama();
      return;
    }
    const api = oddApi();
    if (!api.homieOllamaDoctor) {
      await checkOllama();
      return;
    }
    setDoctoring(true);
    setOllamaError("");
    try {
      const result = await api.homieOllamaDoctor();
      setOllamaDoctor(result as any);
      if (result?.reachable) {
        setOllamaRunning(true);
        setOllamaModels(Array.isArray(result.models) ? result.models : []);
      } else {
        setOllamaRunning(false);
        if (result?.error) setOllamaError(String(result.error));
      }
    } catch (error: any) {
      const message = String(error?.message || error || "Could not diagnose Local Ollama.");
      setOllamaDoctor({ ok: false, installed: false, reachable: false, error: message });
      setOllamaError(message);
    } finally {
      setDoctoring(false);
    }
  }

  async function startLocalOllama() {
    if (!desktop || provider !== "ollama") return;
    const api = oddApi();
    if (!api.homieStartOllama) return;
    setStartingOllama(true);
    setOllamaError("");
    try {
      const result = await api.homieStartOllama();
      setOllamaDoctor((prev) => ({ ...(prev || {}), ...(result as any) }));
      if (!result?.ok) {
        setOllamaError(String(result?.error || "Could not start Ollama."));
      }
      window.setTimeout(() => { void runProviderDoctor(); void checkOllama(); }, result?.ok ? 1400 : 0);
    } catch (error: any) {
      setOllamaError(String(error?.message || error || "Could not start Ollama."));
    } finally {
      setStartingOllama(false);
    }
  }

  async function openOllamaDownload() {
    try {
      await oddApi().openExternal?.("https://ollama.com/download");
    } catch {}
  }

  async function pullSelectedOllamaModel() {
    if (!desktop || provider !== "ollama") return;
    const api = oddApi();
    if (!api.homieOllamaPull) return;
    const model = String(ollamaModel || "llama3.1:8b").trim() || "llama3.1:8b";
    setPullingOllamaModel(true);
    setOllamaError("");
    try {
      const result = await api.homieOllamaPull({ model });
      setOllamaDoctor((prev) => ({ ...(prev || {}), ...(result as any), model }));
      if (!result?.ok) setOllamaError(String(result?.error || `Could not start pulling ${model}.`));
      if (result?.ok) window.setTimeout(() => { void runProviderDoctor(); void checkOllama(); }, 1600);
    } catch (error: any) {
      setOllamaError(String(error?.message || error || `Could not start pulling ${model}.`));
    } finally {
      setPullingOllamaModel(false);
    }
  }


  function refreshMemoryLane() {
    setMemoryLaneTick((value) => value + 1);
  }

  function pinCurrentCompanionFocus() {
    const text = companionMemory.lastUserNeed || companionMemory.currentFocus || relationshipMemory.mainGoal || getPanelLabel(activePanelId || "Home");
    pinHomieFact(text, activePanelId || "Homie");
    refreshMemoryLane();
  }

  function markCompanionMilestone(text?: string) {
    const label = String(text || `${getPanelLabel(activePanelId || "Home")} check-in completed`).trim();
    addHomieMilestone(label, activePanelId || "Homie");
    refreshMemoryLane();
  }

  async function checkAllProviders() {
    if (!desktop) return;
    setChecking(true);
    setOllamaError("");
    try {
      const rows = await probeAllHomieProviders(activePanelId || "Homie");
      setProviderMatrix(rows);
      const activeRow = rows.find((row) => row.provider === provider);
      if (activeRow) {
        setOllamaRunning(activeRow.ok);
        setOllamaModels(activeRow.models || (activeRow.model ? [activeRow.model] : []));
        setOllamaError(activeRow.ok ? "" : String(activeRow.error || `${activeProviderLabel} is not reachable.`));
      }
    } catch (e: any) {
      setOllamaError(String(e));
    } finally {
      setChecking(false);
    }
  }

  function applyProviderWizardFixes() {
    const patch = providerWizard.patch || {};
    if (typeof patch.ollamaModel === "string") setOllamaModel(patch.ollamaModel);
    if (typeof patch.openaiBaseUrl === "string") setOpenaiBaseUrl(patch.openaiBaseUrl);
    if (typeof patch.openaiModel === "string") setOpenaiModel(patch.openaiModel);
    if (typeof patch.bridgeBaseUrl === "string") setBridgeBaseUrl(patch.bridgeBaseUrl);
    if (typeof patch.bridgeModel === "string") setBridgeModel(patch.bridgeModel);
  }

  function applyVoiceFirstCompanionPreset() {
    setVoiceMode("companion");
    setAutoSpeakReplies(true);
    setAutoFallback(false);
    setIncludeContext(true);
    setRememberCompanionFacts(true);
    if (!String(systemPrompt || "").toLowerCase().includes("embodied companion style")) {
      setSystemPrompt(buildEmbodiedCompanionPrompt(activePanelId || "Homie"));
    }
  }

  function applySyntheticCompanionPreset() {
    applyVoiceFirstCompanionPreset();
    setTemperature(0.42);
    setDetachedHomieDefaults();
  }

  function setDetachedHomieDefaults() {
    patchAiPrefs({
      homieCompanionWindow: true,
      homieAvatarShellMode: "hybrid-hero",
      homieVoiceEnabled: true,
      homieVoiceContinuous: true,
    });
  }

  function switchWizardLane(next: HomieProviderKind) {
    setProvider(next);
    setAutoFallback(false);
    if (next === "ollama" && !String(ollamaModel || "").trim()) setOllamaModel("llama3.1:8b");
    if (next === "openai_compat" && !String(openaiBaseUrl || "").trim()) setOpenaiBaseUrl("http://127.0.0.1:1234/v1");
    if (next === "bridge" && !String(bridgeBaseUrl || "").trim()) setBridgeBaseUrl("http://127.0.0.1:8787");
  }

  // Chat
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadJSON<ChatMsg[]>(LS_CHAT, []));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const companionMemory = useMemo(() => loadCompanionMemoryState(), [messages.length, busy, activePanelId]);
  const [memoryLaneTick, setMemoryLaneTick] = useState(0);
  const laneMemory = useMemo(() => loadHomieCompanionLaneMemory(), [activePanelId, messages.length, memoryLaneTick, companionMemory.updatedAt]);
  const panelCompanion = useMemo(() => buildPanelCompanionMemory(activePanelId), [activePanelId, messages.length, memoryLaneTick, companionMemory.updatedAt]);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const homieSnapshot = useMemo(() => buildHomieCoreSnapshot(activePanelId || "Homie"), [activePanelId, messages.length, busy]);
  const relationshipMemory = useMemo(() => buildHomieRelationshipMemory(activePanelId || "Homie"), [activePanelId, messages.length]);
  const incomeForge = useMemo(() => buildPhoenixIncomeForgeBoard(4), [messages.length, busy]);

  useEffect(() => {
    const applyDraft = () => {
      const draft = consumeHomieDraft();
      if (!draft?.text) return;
      setTab("ai");
      setInput(draft.text);
    };
    applyDraft();
    window.addEventListener("oddengine:homie-draft", applyDraft as EventListener);
    return () => window.removeEventListener("oddengine:homie-draft", applyDraft as EventListener);
  }, []);

  useEffect(() => {
    saveJSON(LS_CHAT, messages.slice(-80));
  }, [messages]);

  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, busy]);

  function resetChat() {
    setMessages([]);
    saveJSON(LS_CHAT, []);
  }

  function addQuick(text: string) {
    setInput(text);
    setTab("ai");
  }

  
  async function refreshDevSnapshot() {
    if (!desktop) return;
    try{
      const r = await oddApi().getDevSnapshot({ limit: 260 } as any);
      if (r && r.ok) setDevSnap(r as any);
    }catch(e){}
  }

  async function pickTargetProject() {
    if (!desktop) return;
    try{
      const r = await oddApi().pickDirectory({ title: "Pick target project folder" } as any);
      if (r && r.ok && r.path) setTargetProject(r.path);
    }catch(e){}
  }

  async function requestPlaybookRun(pbId: string) {
    if (!desktop) return;
    const pb = (devSnap?.playbooks || []).find((p) => p.id === pbId);
    const cwd = targetProject || (devSnap?.runs?.[0]?.cwd || "");
    if (!cwd) {
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: "⚠️ No target project selected. Click **Pick Project** in Homie.", ts: Date.now() }]);
      return;
    }
    if (!pb) {
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `⚠️ Unknown playbook: ${pbId}`, ts: Date.now() }]);
      return;
    }
    setConfirmPb({ id: pb.id, name: pb.name, description: pb.description, safe: !!pb.safe });
  }

  async function runConfirmedPlaybook() {
    if(!desktop || !confirmPb) return;
    const cwd = targetProject || (devSnap?.runs?.[0]?.cwd || "");
    if (!cwd) return;
    const ok = window.confirm(`Run playbook: ${confirmPb.name}\n\nTarget: ${cwd}\n\nThis will modify files in that folder.`);
    if(!ok){ setConfirmPb(null); return; }
    try{
      const r = await oddApi().runPlaybook({ playbookId: confirmPb.id, cwd } as any);
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `✅ Running playbook **${confirmPb.name}** on\n${cwd}\n\nWatch DevEngine logs for progress.`, ts: Date.now() }]);
    }catch(e:any){
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `⚠️ Failed to start playbook: ${String(e)}`, ts: Date.now() }]);
    }finally{
      setConfirmPb(null);
      setAutoCountdown(0);
      setAutoPb(null);
    }
  }
async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const ctx = contextMode === "panel"
      ? `

[OddEngine Context]
Host: ${window.location.hostname}
Active panel: ${activePanelId || "(unknown)"}
Time: ${new Date().toISOString()}
`
      : "";

    const userMsg: ChatMsg = { id: uid(), role: "user", content: text + ctx, ts: Date.now() };
    const next = [...messages, userMsg].slice(-80);
    setMessages(next);
    setInput("");

    if (!desktop) {
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: "AI chat needs **Desktop mode** (Electron) so Homie can talk to your configured companion provider safely.\n\nRun: **npm run dev:desktop** (or build the EXE) and try again.", ts: Date.now() }]);
      return;
    }

    setBusy(true);
    try {
      const r = await sendCompanionChat({
        activePanelId: activePanelId || "Homie",
        messages: next.map((m) => ({ id: m.id, role: m.role, content: m.content, ts: m.ts })),
        provider,
        baseUrl: activeBaseUrl,
        apiKey: activeApiKey,
        model: activeModel,
        temperature,
        system: systemPrompt,
        autoFallback,
        includeContext: contextMode !== "clean",
        contextMode,
        chatCleanMode,
        rememberCompanionFacts,
        responseStyle,
      });
      if (!r.ok) {
        const err = r.error || "Homie request failed";
        const help = provider === "ollama"
          ? `If Ollama isn't ready yet:
1) Install Ollama
2) Run: **ollama pull ${activeModel}**
3) Confirm the local server is up, then hit **Check provider**.`
          : provider === "openai_compat"
            ? `Check the base URL, API key, and model name for your OpenAI-compatible endpoint, then hit **Check provider**.`
            : `Check the bridge URL and model name, then hit **Check provider**.`;
        setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `⚠️ ${err}

${help}`, ts: Date.now() }]);
      } else {
        setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: (r.reply || "").trim() || "(no reply)", ts: Date.now() }]);
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `⚠️ ${String(e)}`, ts: Date.now() }]);
    } finally {
      setBusy(false);
    }
  }

  const guide = useMemo(
    () =>
      [
        {
          title: "Where do I start?",
          body:
            "Start in **OddBrain** (health + integrity), then **Dev Engine** to pick a project and run builds/logs.\n\nIf you want generators, use **Autopilot** (web-safe export) or Desktop mode for writing files."
        },
        {
          title: "Desktop vs Web",
          body:
            "• **Web (npm run dev:web)**: safe UI-only mode. No disk writes.\n• **Desktop (npm run dev:desktop)**: Electron enabled (logs/files/plugins/emulators).\n\nHomie AI runs in **Desktop mode** using **local Ollama** on 127.0.0.1."
        },
        {
          title: "Install Ollama (local AI)",
          body:
            "1) Install Ollama for Windows\n2) In PowerShell: **ollama --version**\n3) Pull a model: **ollama pull llama3.1:8b** (or pick a smaller one)\n4) Keep Ollama running (it hosts on **127.0.0.1:11434**)"
        },
        {
          title: "Safety rule",
          body:
            "Homie will **ask before** running destructive actions. If you want, you can paste logs/errors and Homie will explain + propose the safest fix steps."
        }
      ],
    []
  );

  return (
    <div className="page" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <PanelHeader
        panelId="Homie"
        title="Homie 👊"
        subtitle="OS companion + provider-switchable AI helper (Desktop mode)"
        badges={[
          { label: desktop ? "Desktop" : "Web", tone: desktop ? "good" : "warn" },
          { label: ollamaRunning === null ? `${activeProviderLabel}: ?` : ollamaRunning ? `${activeProviderLabel}: ready` : `${activeProviderLabel}: off`, tone: ollamaRunning ? "good" : ollamaRunning === false ? "bad" : "muted" },
          { label: (devSnap?.runningCount || 0) > 0 ? `DevEngine: running (${devSnap?.runningCount || 0})` : "DevEngine: idle", tone: (devSnap?.runningCount || 0) > 0 ? "warn" : "muted" },
        ]}
        rightSlot={
          <ActionMenu
            items={[
              { label: "Open DevEngine", onClick: () => onNavigate?.("DevEngine") },
              { label: "Open Calendar", onClick: () => onNavigate?.("Calendar") },
              { label: "Pick Project", onClick: () => pickTargetProject(), disabled: !desktop },
              { label: "Refresh Dev Snapshot", onClick: () => refreshDevSnapshot(), disabled: !desktop },
              { label: checking ? "Checking provider…" : "Check provider", onClick: () => checkOllama(), disabled: !desktop || checking },
              { label: checking ? "Checking all…" : "Check all lanes", onClick: () => checkAllProviders(), disabled: !desktop || checking },
              { label: "Reset chat", onClick: () => resetChat(), tone: "danger" },
            ]}
          />
        }
      />

      <div className="card panelFinishHero panelFinishGlow homieFinishHero">
        <div className="panelFinishHeroTop">
          <div>
            <div className="small shellEyebrow">CORE SHELL FINISH • HOMIE</div>
            <div className="panelFinishHeroLead">{homieSnapshot.operatorHeadline}</div>
            <div className="small panelFinishLeadCopy">{homieSnapshot.briefing}</div>
          </div>
          <div className="panelFinishActionStrip">
            <button className="tabBtn active" onClick={() => addQuick("What should I do first today?")}>What now?</button>
            <button className="tabBtn" onClick={() => addQuick("Walk me through the next tiny step.")}>Tiny step</button>
            <button className="tabBtn" onClick={() => addQuick("Check in with me and help me get grounded before I decide what to do.")}>Check in</button>
            <button className="tabBtn" onClick={() => addQuick("Help me sort my thoughts before I take the next step.")}>Sort thoughts</button>
            <button className="tabBtn" onClick={() => onNavigate?.("Money")}>Money HQ</button>
            <button className="tabBtn" onClick={() => onNavigate?.("PhoenixIncomeForge")}>Phoenix Forge</button>
            <button className="tabBtn" onClick={() => onNavigate?.("Brain")}>Mission Control</button>
          </div>
        </div>
        <div className="panelFinishMetrics">
          <div className="finishMetricCard"><div className="small shellEyebrow">GOAL</div><div className="finishMetricLabel">{relationshipMemory.mainGoal}</div><div className="small">current push</div></div>
          <div className="finishMetricCard"><div className="small shellEyebrow">FAVORITE PANEL</div><div className="finishMetricLabel">{relationshipMemory.favoritePanelLabel}</div><div className="small">most-used route lately</div></div>
          <div className="finishMetricCard"><div className="small shellEyebrow">SHIP TODAY</div><div className="finishMetricLabel">{incomeForge.todayShipLane?.title || "Need a lane"}</div><div className="small">{incomeForge.todayShipLane?.platform || "Money / Builder / Writers"}</div></div>
          <div className="finishMetricCard"><div className="small shellEyebrow">RECOVERY</div><div className="finishMetricLabel">{homieSnapshot.energyHeadline}</div><div className="small">{homieSnapshot.conversationReadyLabel}</div></div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 10 }}>
        <button className={"tabBtn " + (tab === "ai" ? "active" : "")} onClick={() => setTab("ai")}>AI</button>
        <button className={"tabBtn " + (tab === "guide" ? "active" : "")} onClick={() => setTab("guide")}>Guide</button>
        <button className="tabBtn" onClick={() => onOpenHowTo?.()} title="How to Use (F1)">ℹ</button>
      </div>

      <div className="card softCard homieCompanionCard" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="h">Companion posture</div>
            <div className="sub">A warmer, grounded Homie mode: understand what is happening, then help you land one real next move.</div>
          </div>
          <div className="assistantChipWrap">
            <span className={`badge ${homieSnapshot.companionMode === "phoenix" ? "good" : homieSnapshot.companionMode === "steady" ? "warn" : "muted"}`}>{homieSnapshot.companionMode}</span>
            <span className="badge good">always ready</span>
          </div>
        </div>
        <div className="grid2" style={{ marginTop: 12, alignItems: "start" }}>
          <div className="timelineCard">
            <div className="small shellEyebrow">Companion read</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>{homieSnapshot.companionHeadline}</div>
            <div className="small" style={{ marginTop: 6 }}>{homieSnapshot.companionBrief}</div>
            <div className="assistantChipWrap homieCompanionChipRow" style={{ marginTop: 10 }}>
              {homieSnapshot.checkInPrompts.map((prompt) => (
                <button key={prompt} className="tabBtn" onClick={() => addQuick(prompt)}>{prompt}</button>
              ))}
            </div>
          </div>
          <div className="timelineCard">
            <div className="small shellEyebrow">Relationship memory</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>{relationshipMemory.relationshipHeadline}</div>
            <div className="small" style={{ marginTop: 6 }}>{relationshipMemory.relationshipBrief}</div>
            <div className="small" style={{ marginTop: 6 }}>{relationshipMemory.patternLine}</div>
          </div>
        </div>
      </div>

      <div className="card softCard" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="h">Homie operator memory</div>
            <div className="sub">What Homie remembers about your goals, working lanes, and the best next income move.</div>
          </div>
          <div className="assistantChipWrap">
            <span className="badge good">{relationshipMemory.favoritePanelLabel}</span>
            <span className="badge warn">{homieSnapshot.energyHeadline}</span>
            {incomeForge.todayShipLane ? <span className="badge good">Ship: {incomeForge.todayShipLane.title}</span> : null}
          </div>
        </div>
        <div className="grid2" style={{ marginTop: 12, alignItems: "start" }}>
          <div className="timelineCard">
            <div className="small shellEyebrow">Relationship memory</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>{relationshipMemory.relationshipHeadline}</div>
            <div className="small" style={{ marginTop: 6 }}>{relationshipMemory.relationshipBrief}</div>
            <div className="small" style={{ marginTop: 6 }}>{relationshipMemory.patternLine}</div>
          </div>
          <div className="timelineCard">
            <div className="small shellEyebrow">Income Forge</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>{incomeForge.todayShipLane ? incomeForge.todayShipLane.title : "Pick one tiny sellable"}</div>
            <div className="small" style={{ marginTop: 6 }}>{incomeForge.shipOneThingToday}</div>
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={() => onNavigate("PhoenixIncomeForge")}>Open Phoenix Forge</button>
              <button className="tabBtn" onClick={() => onNavigate(incomeForge.todayShipLane?.panelId || "Money")}>{incomeForge.todayShipLane?.actionLabel || "Open Money"}</button>
              <button className="tabBtn" onClick={() => { seedHomieDraft(`Coach me through shipping one thing today from Income Forge.`, { source: "homie-panel", panelId: "Homie" }); setInput(`Coach me through shipping one thing today from Income Forge.`); setTab("ai"); }}>Coach me</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card softCard homieCompanionCard" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="h">Companion memory lane</div>
            <div className="sub">Pinned facts, relationship milestones, and panel-aware mood/context memory so Trading Homie feels different from Recovery Homie and Studio Homie.</div>
          </div>
          <div className="assistantChipWrap">
            <span className="badge good">{panelCompanion.current?.mood || relationshipMemory.panelMoodSummary || "steady companion"}</span>
            {laneMemory.milestones?.[0] ? <span className="badge">Milestone live</span> : null}
            {laneMemory.pinnedFacts?.[0] ? <span className="badge">Pinned facts</span> : null}
          </div>
        </div>
        <div className="grid2" style={{ marginTop: 12, alignItems: "start" }}>
          <div className="timelineCard">
            <div className="small shellEyebrow">Pinned facts</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>{laneMemory.pinnedFacts?.[0]?.text || "Pin what Homie should keep warm."}</div>
            <div className="small" style={{ marginTop: 6 }}>{relationshipMemory.panelMoodSummary}</div>
            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              <button className="tabBtn active" onClick={pinCurrentCompanionFocus}>Pin current focus</button>
              <button className="tabBtn" onClick={() => { pinHomieFact(relationshipMemory.mainGoal, activePanelId || "Homie"); refreshMemoryLane(); }}>Pin main goal</button>
              {laneMemory.pinnedFacts.slice(0, 4).map((fact) => (
                <span key={fact.id} className="badge">📌 {fact.text}</span>
              ))}
            </div>
          </div>
          <div className="timelineCard">
            <div className="small shellEyebrow">Relationship milestones</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>{laneMemory.milestones?.[0]?.text || "No milestone saved yet."}</div>
            <div className="small" style={{ marginTop: 6 }}>{panelCompanion.current?.context || relationshipMemory.panelContextSummary || relationshipMemory.relationshipBrief}</div>
            <div className="assistantChipWrap" style={{ marginTop: 10 }}>
              <button className="tabBtn active" onClick={() => markCompanionMilestone(`${getPanelLabel(activePanelId || "Home")} check-in completed`)}>Mark this panel</button>
              <button className="tabBtn" onClick={() => markCompanionMilestone("Stayed steady and kept moving")}>Stayed steady</button>
              {laneMemory.milestones.slice(0, 3).map((milestone) => (
                <span key={milestone.id} className="badge">🏁 {milestone.text}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="grid2" style={{ marginTop: 12, alignItems: "start" }}>
          <div className="timelineCard">
            <div className="small shellEyebrow">Current panel memory</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>{panelCompanion.current?.panelTitle || getPanelLabel(activePanelId || "Home")}</div>
            <div className="small" style={{ marginTop: 6 }}>Mood: <b>{panelCompanion.current?.mood || "steady companion"}</b></div>
            <div className="small" style={{ marginTop: 6 }}>{panelCompanion.current?.context || "Homie is still learning the feel of this lane."}</div>
            {!!panelCompanion.current?.lastNeed && <div className="small" style={{ marginTop: 6 }}>Need: {panelCompanion.current.lastNeed}</div>}
          </div>
          <div className="timelineCard">
            <div className="small shellEyebrow">Recent panel moods</div>
            <div className="assistantChipWrap" style={{ marginTop: 8 }}>
              {panelCompanion.recentPanels.length ? panelCompanion.recentPanels.map((item) => (
                <span key={item.panelId} className="badge">{item.panelTitle} • {item.mood}</span>
              )) : <span className="small">Trading, Recovery, and Studio mood lanes will appear here as you use them.</span>}
            </div>
            <div className="small" style={{ marginTop: 10 }}>{relationshipMemory.moneyLine}</div>
          </div>
        </div>
      </div>

      {tab === "ai" && (
        <>
          <div className="grid2" style={{ alignItems: "start", marginTop: 8 }}>
            <PanelScheduleCard
              panelId="Homie"
              title="Dev schedule"
              subtitle="Quick-add build / backup / review reminders."
              onNavigate={onNavigate}
              presets={[
                { label: "+ Build", title: "Build OddEngine", time: "20:00" },
                { label: "+ Backup", title: "Backup project zip", time: "20:20" },
                { label: "+ Review", title: "Review errors + next tasks", time: "20:40" },
              ]}
            />
            <div className="card softCard">
              <div className="h">Quick actions</div>
              <div className="sub">Common moves Homie helps with.</div>
              <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                <button className="tabBtn" onClick={() => addQuick("Check my logs and tell me the safest fix.")}>Diagnose logs</button>
                <button className="tabBtn" onClick={() => addQuick("Give me the exact Windows commands to run next.")}>Commands</button>
                <button className="tabBtn" onClick={() => addQuick("Package the next build zip cleanly.")}>Ship zip</button>
                <button className="tabBtn" onClick={() => onNavigate?.("PhoenixIncomeForge")}>Phoenix Forge</button>
                <button className="tabBtn active" onClick={() => onNavigate?.("DevEngine")}>DevEngine</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Companion provider status</div>
                <div className="small">Current provider: {activeProviderLabel}{activeBaseUrl ? ` • ${activeBaseUrl}` : ""}</div>
              </div>
              <div className="row">
                <span className={"badge " + (ollamaRunning ? "good" : ollamaRunning === false ? "bad" : "")}>{ollamaRunning === null ? "Unknown" : ollamaRunning ? "Ready" : "Not reachable"}</span>
                <button onClick={checkOllama} disabled={!desktop || checking}>{checking ? "Checking…" : "Check provider"}</button>
                <button onClick={checkAllProviders} disabled={!desktop || checking}>{checking ? "Checking…" : "Check all lanes"}</button>
              </div>
            </div>
            {!desktop && (
              <div className="small" style={{ marginTop: 10 }}>
                ⚠️ You are in **Web mode**. AI chat needs **Desktop mode**.
              </div>
            )}
            {ollamaError && (
              <div className="small" style={{ marginTop: 10, color: "#fbbf24" }}>
                {ollamaError}
              </div>
            )}
            {!!ollamaModels.length && (
              <div className="small" style={{ marginTop: 10 }}>
                Detected options: {ollamaModels.slice(0, 6).join(", ")}{ollamaModels.length > 6 ? "…" : ""}
              </div>
            )}
            {!!providerMatrix.length && (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {providerMatrix.map((row) => (
                  <div key={row.provider} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)", background: row.provider === provider ? "rgba(94,234,242,0.08)" : "transparent" }}>
                    <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{row.providerLabel}</div>
                        <div className="small">{row.model || "model pending"}{row.detail ? ` • ${row.detail}` : ""}</div>
                      </div>
                      <span className={"badge " + (row.ok ? "good" : "bad")}>{row.ok ? "Ready" : "Down"}</span>
                    </div>
                    {!!row.error && <div className="small" style={{ marginTop: 6, color: "#fbbf24" }}>{row.error}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>


          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Dev Engine Awareness</div>
                <div className="small">Homie can read DevEngine status + recent logs, detect common errors, and suggest safe fixes.</div>
              </div>
              <div className="row">
                <span className={"badge " + ((devSnap?.runningCount || 0) > 0 ? "warn" : "good")}>
                  {(devSnap?.runningCount || 0) > 0 ? `Running (${devSnap?.runningCount || 0})` : "Idle"}
                </span>
                <button onClick={refreshDevSnapshot} disabled={!desktop}>Refresh</button>
              </div>
            </div>

            <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
              <div className="small" style={{ opacity: 0.9 }}>
                <b>Target Project:</b>{" "}
                <span style={{ opacity: 0.9 }}>{targetProject ? targetProject : "(not set)"}</span>
              </div>
              <button onClick={pickTargetProject} disabled={!desktop}>Pick Project</button>
              <label className="row small" style={{ gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={autoFixEnabled}
                  onChange={(e) => setAutoFixEnabled(e.target.checked)}
                />
                Auto-run safe fixes (with confirm)
              </label>
            </div>

            {autoPb && autoCountdown > 0 && (
              <div className="small" style={{ marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)" }}>
                ⚙️ <b>Auto-fix detected:</b> {autoPb.reason} → will suggest a safe fix in <b>{autoCountdown}s</b>.
                <button style={{ marginLeft: 10 }} onClick={() => { setAutoPb(null); setAutoCountdown(0); }}>Cancel</button>
              </div>
            )}

            {devSnap?.issues && devSnap.issues.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Detected Issues</div>
                {devSnap.issues.slice(0, 4).map((iss) => (
                  <div key={iss.id} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)", marginBottom: 10 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{iss.title}</div>
                        <div className="small" style={{ opacity: 0.9, marginTop: 4 }}>{iss.explanation}</div>
                      </div>
                      <span className={"badge " + (iss.severity === "error" ? "bad" : iss.severity === "warn" ? "warn" : "good")}>
                        {iss.severity.toUpperCase()}
                      </span>
                    </div>
                    {!!(iss.recommendedPlaybooks && iss.recommendedPlaybooks.length) && (
                      <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                        {(iss.recommendedPlaybooks || []).map((pbId) => {
                          const pb = (devSnap.playbooks || []).find((p) => p.id === pbId);
                          return (
                            <button key={pbId} onClick={() => requestPlaybookRun(pbId)} disabled={!desktop}>
                              Run: {pb ? pb.name : pbId}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="small" style={{ marginTop: 12, opacity: 0.8 }}>
                No issues detected in the last log window.
              </div>
            )}

            {confirmPb && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(59,130,246,0.35)", background: "rgba(59,130,246,0.08)" }}>
                <div style={{ fontWeight: 700 }}>Confirm playbook</div>
                <div className="small" style={{ marginTop: 6 }}>
                  <b>{confirmPb.name}</b> — {confirmPb.description}
                </div>
                <div className="small" style={{ marginTop: 6 }}>
                  Target: <code>{targetProject || devSnap?.runs?.[0]?.cwd || "(not set)"}</code>
                </div>
                <div className="row" style={{ marginTop: 10, gap: 8 }}>
                  <button onClick={runConfirmedPlaybook} disabled={!desktop}>Run</button>
                  <button onClick={() => setConfirmPb(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Companion memory + voice flow</div>
                <div className="small">Homie now carries a rolling local memory, can auto-speak replies, and can route voice to either companion chat or direct commands.</div>
              </div>
              <div className="assistantChipWrap">
                <span className="badge good">{voiceMode === "companion" ? "Voice → companion" : voiceMode === "commands" ? "Voice → commands" : "Voice → smart"}</span>
                <span className="badge">{autoFallback ? "Fallback on" : "Single provider"}</span>
              </div>
            </div>
            <div className="small" style={{ marginTop: 10 }}>
              Focus: <b>{companionMemory.lastUserNeed || companionMemory.currentFocus || "Stay steady and keep moving."}</b>
              {companionMemory.rememberedFacts?.[0] ? ` • Remembers: ${companionMemory.rememberedFacts[0]}` : ""}
            </div>
            {!!companionMemory.sessionSummary && <div className="small" style={{ marginTop: 6 }}>{companionMemory.sessionSummary}</div>}
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Detached actor shell</div>
                <div className="small">Make Homie live in its own companion window and choose between the friendly hybrid hero shell, the 3D rig lane, or the older 2.5D house surface.</div>
              </div>
              <div className="assistantChipWrap">
                <span className="badge good">{detachedCompanion ? "Detached" : "Inline"}</span>
                <span className="badge">{avatarShellMode === "actor-3d" ? "3D shell" : avatarShellMode === "hybrid-hero" ? "Hybrid hero" : "2.5D house"}</span>
              </div>
            </div>
            <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap", alignItems: "end" }}>
              <div style={{ width: 220 }}>
                <div className="small">Homie window</div>
                <select value={String(detachedCompanion)} onChange={(e) => patchAiPrefs({ homieCompanionWindow: e.target.value === "true" })}>
                  <option value="true">Detached companion</option>
                  <option value="false">Inline main shell</option>
                </select>
              </div>
              <div style={{ width: 220 }}>
                <div className="small">Avatar shell</div>
                <select value={avatarShellMode} onChange={(e) => patchAiPrefs({ homieAvatarShellMode: e.target.value })}>
                  <option value="hybrid-hero">Friendly hybrid hero shell</option>
                  <option value="actor-3d">3D actor shell</option>
                  <option value="house-2d">2.5D Homie House</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div className="small">3D model URL/path</div>
                <input value={homie3DModelUrl} onChange={(e) => patchAiPrefs({ homie3DModelUrl: e.target.value || "/models/lilhomie.glb" })} placeholder="/models/lilhomie.glb" />
              </div>
            </div>
            <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
              <button className="tabBtn" onClick={async () => {
                const api = oddApi();
                if (api.ensureHomieCompanionWindow) {
                  await api.ensureHomieCompanionWindow({ width: 620, height: 920, alwaysOnTop: true, resetBounds: true });
                  return;
                }
                await api.openWindow?.({
                  title: "Homie Buddy",
                  query: { buddy: "1" },
                  windowType: "homie-buddy",
                  width: 620,
                  height: 920,
                  frame: false,
                  transparent: false,
                  skipTaskbar: false,
                  resizable: true,
                  alwaysOnTop: true,
                });
              }}>Launch / focus detached Homie</button>
            </div>
            <div className="small" style={{ marginTop: 8 }}>Drop a rigged GLB with Idle / Walk / Talk / Listen clips into <code>ui/public/models/</code>. This pass also adds a sibling <code>lilhomie.manifest.json</code> alias map so your real character rig can map custom animation names, mouth morphs, and blink morphs without code edits. If the GLB is missing, Homie keeps the lightweight built-in 3D fallback so the detached shell still feels alive.</div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Hero rig personalization lane</div>
                <div className="small">Lock the final face, hoodie, cap, and palette from reference images before you move into the full Blender hero-rig rebuild.</div>
              </div>
              <div className="assistantChipWrap">
                <span className="badge good">Reference pack ready</span>
                <span className="badge">/models/references</span>
              </div>
            </div>
            <div className="small" style={{ marginTop: 10 }}>
              Drop real images into <code>ui/public/models/references/</code>, then run <code>python scripts/lilhomie_reference_pack_builder.py --front ui/public/models/references/front-face.png</code> and rebuild <code>lilhomie.glb</code>.
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              This pass also adds <code>lilhomie.hero.identity.template.json</code> for the final look lock and <code>scripts/lilhomie_blender_personalization_helper.py</code> for the proper Blender armature + reference-plane path.
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700 }}>True Blender hero rig lane</div>
                <div className="small">Move from the starter actor into a real Blender-driven hero rig with a proper armature, visemes, expressions, and cleaner export flow.</div>
              </div>
              <div className="assistantChipWrap">
                <span className="badge good">Hero rig runtime ready</span>
                <span className="badge">Idle / Walk / Talk / Listen</span>
                <span className="badge">Visemes + expressions</span>
              </div>
            </div>
            <div className="small" style={{ marginTop: 10 }}>
              New helpers in this pass: <code>scripts/lilhomie_blender_hero_rig_setup.py</code>, <code>scripts/lilhomie_blender_action_clips_helper.py</code>, and <code>scripts/lilhomie_blender_export_bundle.py</code>.
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              The runtime now understands a full viseme lane (<code>viseme_sil</code>, <code>viseme_aa</code>, <code>viseme_ee</code>, <code>viseme_ih</code>, <code>viseme_oh</code>, <code>viseme_ou</code>, <code>viseme_fv</code>, <code>viseme_th</code>, <code>viseme_bmp</code>) plus <code>smile</code>, <code>browUp</code>, and <code>browDown</code> expression keys.
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              Fast order: run the hero rig setup helper in Blender, refine the custom head + hoodie weights, run the action clips helper for starter loops, then export with the bundle helper so <code>lilhomie.glb</code> and <code>lilhomie.manifest.json</code> stay aligned.
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Provider setup wizard</div>
                <div className="small">Walk Homie through one provider lane at a time, apply common field fixes, and flip into a more voice-first companion mode.</div>
              </div>
              <div className="assistantChipWrap">
                <span className={"badge " + (providerWizard.ready ? "good" : "warn")}>{providerWizard.ready ? "Ready to talk" : "Needs setup"}</span>
                <span className="badge">{providerWizard.providerLabel}</span>
              </div>
            </div>
            <div className="small" style={{ marginTop: 10 }}>
              <b>{providerWizard.headline}</b> • {providerWizard.summary}
            </div>
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <button className={"tabBtn " + (provider === "ollama" ? "active" : "")} onClick={() => switchWizardLane("ollama")}>Use Ollama quick path</button>
              <button className={"tabBtn " + (provider === "openai_compat" ? "active" : "")} onClick={() => switchWizardLane("openai_compat")}>Use compatible endpoint</button>
              <button className={"tabBtn " + (provider === "bridge" ? "active" : "")} onClick={() => switchWizardLane("bridge")}>Use custom bridge</button>
              <button onClick={applyVoiceFirstCompanionPreset}>Use voice-first companion preset</button>
              <button onClick={applySyntheticCompanionPreset}>Use synthetic companion preset</button>
              {!!Object.keys(providerWizard.patch || {}).length && <button onClick={applyProviderWizardFixes}>Apply common fixes</button>}
              {provider === "ollama" && <button onClick={startLocalOllama} disabled={!desktop || startingOllama}>{startingOllama ? "Starting Ollama…" : "Start Ollama"}</button>}
              {provider === "ollama" && <button onClick={pullSelectedOllamaModel} disabled={!desktop || pullingOllamaModel}>{pullingOllamaModel ? "Pulling model…" : "Pull selected model"}</button>}
              {provider === "ollama" && <button onClick={runProviderDoctor} disabled={!desktop || doctoring}>{doctoring ? "Diagnosing…" : "Diagnose Ollama"}</button>}
              {provider === "ollama" && <button onClick={openOllamaDownload}>Open Ollama download</button>}
              <button onClick={checkOllama} disabled={!desktop || checking}>{checking ? "Checking…" : "Re-check active lane"}</button>
            </div>
            {provider === "ollama" && !!ollamaDoctor && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(15,23,42,0.48)" }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>Local Ollama doctor</div>
                    <div className="small" style={{ marginTop: 4 }}>{ollamaDoctor.reachable ? "The local API is answering now." : (ollamaDoctor.error || "The local API is still offline.")}</div>
                  </div>
                  <div className="assistantChipWrap">
                    <span className={"badge " + (ollamaDoctor.installed ? "good" : "warn")}>{ollamaDoctor.installed ? "CLI found" : "CLI missing"}</span>
                    <span className={"badge " + (ollamaDoctor.reachable ? "good" : "warn")}>{ollamaDoctor.reachable ? "API reachable" : "API offline"}</span>
                  </div>
                </div>
                <div className="small" style={{ marginTop: 8 }}>
                  {ollamaDoctor.version ? `Version: ${ollamaDoctor.version}` : "Version: not detected yet."}
                  {ollamaDoctor.binary ? ` • Binary: ${ollamaDoctor.binary}` : ""}
                </div>
                <div className="small" style={{ marginTop: 6 }}>Quick local target: http://127.0.0.1:11434 • model: {String(ollamaModel || "llama3.1:8b")}</div>
                {!!ollamaDoctor.models?.length && <div className="small" style={{ marginTop: 6 }}>Models: {ollamaDoctor.models.join(", ")}</div>}
              </div>
            )}
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {providerWizard.steps.map((step) => (
                <div key={step.id} style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)", background: step.state === "done" ? "rgba(74,222,128,0.08)" : step.state === "warn" ? "rgba(251,191,36,0.08)" : "rgba(59,130,246,0.08)" }}>
                  <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{step.title}</div>
                      <div className="small" style={{ marginTop: 4 }}>{step.detail}</div>
                    </div>
                    <span className={"badge " + (step.state === "done" ? "good" : step.state === "warn" ? "warn" : "")}>{step.state === "done" ? "Done" : step.state === "warn" ? "Check" : "Do this"}</span>
                  </div>
                  {!!step.command && <div className="small" style={{ marginTop: 8 }}><code>{step.command}</code></div>}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Companion settings lane</div>
                <div className="small">Switch Homie between local Ollama, an OpenAI-compatible endpoint, or your own bridge.</div>
              </div>
              <div className="assistantChipWrap">
                <span className="badge good">{activeProviderLabel}</span>
                <span className="badge">{activeModel || "model pending"}</span>
              </div>
            </div>
            <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap", alignItems: "end" }}>
              <div style={{ width: 220 }}>
                <div className="small">Provider</div>
                <select value={provider} onChange={(e) => setProvider(e.target.value as HomieProviderKind)}>
                  <option value="ollama">Local Ollama</option>
                  <option value="openai_compat">OpenAI-compatible</option>
                  <option value="bridge">Custom bridge</option>
                </select>
              </div>
              {provider === "ollama" && (
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div className="small">Ollama model</div>
                  <input value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} placeholder="llama3.1:8b" />
                </div>
              )}
              {provider === "openai_compat" && (
                <>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div className="small">Base URL</div>
                    <input value={openaiBaseUrl} onChange={(e) => setOpenaiBaseUrl(e.target.value)} placeholder="http://127.0.0.1:1234/v1" />
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="small">Model</div>
                    <input value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} placeholder="gpt-4o-mini" />
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="small">API key</div>
                    <input type="password" value={openaiApiKey} onChange={(e) => setOpenaiApiKey(e.target.value)} placeholder="optional if your endpoint needs auth" />
                  </div>
                </>
              )}
              {provider === "bridge" && (
                <>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div className="small">Bridge URL</div>
                    <input value={bridgeBaseUrl} onChange={(e) => setBridgeBaseUrl(e.target.value)} placeholder="http://127.0.0.1:8787" />
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="small">Bridge model</div>
                    <input value={bridgeModel} onChange={(e) => setBridgeModel(e.target.value)} placeholder="homie-bridge" />
                  </div>
                </>
              )}
              <div style={{ width: 160 }}>
                <div className="small">Temp</div>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                />
              </div>
              <div style={{ width: 240 }}>
                <div className="small">Prompt mode</div>
                <select value={contextMode} onChange={(e) => setContextMode(e.target.value as HomieContextMode)}>
                  <option value="clean">Clean chat only</option>
                  <option value="memory">Rolling memory only</option>
                  <option value="panel">Panel + host + memory</option>
                </select>
              </div>
              <div style={{ width: 220 }}>
                <div className="small">Response style</div>
                <select value={responseStyle} onChange={(e) => setResponseStyle(e.target.value as HomieResponseStyle)}>
                  <option value="direct">Direct</option>
                  <option value="supportive">Supportive</option>
                  <option value="companion">Companion</option>
                </select>
              </div>
              <div style={{ width: 220 }}>
                <div className="small">Voice routing</div>
                <select value={voiceMode} onChange={(e) => setVoiceMode(e.target.value as HomieVoiceChatMode)}>
                  <option value="smart">Smart split</option>
                  <option value="companion">Always companion</option>
                  <option value="commands">Always commands</option>
                </select>
              </div>
              <div style={{ width: 240 }}>
                <div className="small">Voice engine</div>
                <select value={voiceEngineMode} onChange={(e) => setVoiceEngineMode(e.target.value as any)}>
                  <option value="cloud">Cloud speech</option>
                  <option value="external-http">External/local HTTP</option>
                  <option value="hybrid">Hybrid (prefer external)</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div className="small">Voice bridge URL</div>
                <input value={externalVoiceBaseUrl} onChange={(e) => setExternalVoiceBaseUrl(e.target.value)} placeholder="http://127.0.0.1:8765" />
              </div>
            </div>
            <div className="row" style={{ marginTop: 10, gap: 14, flexWrap: "wrap" }}>
              <label className="row small" style={{ gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={autoSpeakReplies} onChange={(e) => setAutoSpeakReplies(e.target.checked)} />
                Auto-speak companion replies
              </label>
              <label className="row small" style={{ gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={chatCleanMode} onChange={(e) => setChatCleanMode(e.target.checked)} />
                Chat clean mode
              </label>
              <label className="row small" style={{ gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={autoFallback} onChange={(e) => setAutoFallback(e.target.checked)} />
                Auto-fallback across providers
              </label>
              <label className="row small" style={{ gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={rememberCompanionFacts} onChange={(e) => setRememberCompanionFacts(e.target.checked)} />
                Keep rolling companion memory
              </label>
            </div>
            <div className="small" style={{ marginTop: 8 }}>Prompt guardrails: clean mode strips old provider/doctor chatter out of normal conversation, prompt mode decides how much panel context joins the live user request, and response style picks whether Homie answers more direct, supportive, or companion-first.</div>
            <div className="small" style={{ marginTop: 8 }}>Voice engine decides how Homie hears you: cloud uses browser speech, external/local uses your bridge at {externalVoiceBaseUrl || "http://127.0.0.1:8765"}, and hybrid prefers the bridge when it is up.</div>
            <div className="small" style={{ marginTop: 8 }}>System prompt (controls Homie’s behavior)</div>
            <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4} />
          </div>


          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700 }}>Chat</div>
              <div className="row">
                <button onClick={() => addQuick("Run a quick health check for OddEngine. If you propose fixes, ask before running them.")}>Health Check</button>
                <button onClick={() => addQuick("Explain this error in plain English and give the safest fix steps.\n\nPASTE ERROR HERE:")}>Explain Error</button>
                <button onClick={resetChat} disabled={busy}>Clear</button>
              </div>
            </div>

            <div ref={chatRef} className="chatWrap" style={{ marginTop: 12 }}>
              {messages.length === 0 && (
                <div className="small">No messages yet. Try: “Explain this error…” or “How do I build the EXE?”</div>
              )}
              {messages.map((m) => (
                <div key={m.id} className="chatRow" style={{ justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div className={"bubble " + (m.role === "user" ? "user" : "assistant")}>
                    {m.content}
                    <div className="chatMeta">{m.role} • {new Date(m.ts).toLocaleString()}</div>
                  </div>
                </div>
              ))}
              {busy && (
                <div className="chatRow"><div className="bubble assistant">Thinking…</div></div>
              )}
            </div>

            <div className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={3}
                placeholder="Ask Homie…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button onClick={send} disabled={busy} style={{ width: 140 }}>
                {busy ? "Sending…" : "Send (Ctrl+Enter)"}
              </button>
            </div>

            <div className="small" style={{ marginTop: 8 }}>
              Tip: Paste your console log, Vite errors, or build output and Homie will translate it + suggest fixes.
            </div>
          </div>
        </>
      )}

      {tab === "guide" && (
        <>
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>Quick links</div>
            <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={() => onNavigate("OddBrain")}>Open OddBrain</button>
              <button onClick={() => onNavigate("DevEngine")}>Open Dev Engine</button>
              <button onClick={() => onNavigate("Autopilot")}>Open Autopilot</button>
              <button onClick={() => onNavigate("Security")}>Open Security</button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {guide.map((g) => (
              <div key={g.title} className="card">
                <div style={{ fontWeight: 800 }}>{g.title}</div>
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{g.body}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}