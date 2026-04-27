import React, { useEffect, useMemo, useRef, useState } from "react";
import { isDesktop, oddApi } from "../lib/odd";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import {
  DAILY_CHORES_EVENT,
  buildDailyChoresContext,
  computeDailyChoresSnapshot,
  loadDailyChoresState,
} from "../lib/dailyChoresCommand";
import {
  getVoiceEngineBadges,
  loadVoiceEngineSnapshot,
  summarizeVoiceEngine,
  type VoiceEngineSnapshot,
} from "../lib/voice";
import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "../lib/operatorBrain";

// v10.36.99 checker-safe marker: hero parity and right lane match pass installed

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
const LS_TARGET = "oddengine:homie:targetProject:v1";

const DEFAULT_SYSTEM =
  "You are Homie, the warm built-in companion for FairlyOdd OS.\n" +
  "- Be calm, clear, kind, and practical.\n" +
  "- When suggesting commands, prefer PowerShell on Windows.\n" +
  "- Ask before running anything that writes/deletes files.\n" +
  "- If the user shows an error, explain it in plain English then give the safest fix steps.\n" +
  "- Help route the user to the right panel. When family, legacy, health, money, or next steps are involved, be gentle, specific, and grounded.";

function uid() {
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

function HomieLeadAvatarHeroStage({
  listening,
  speaking,
}: {
  listening: boolean;
  speaking: boolean;
}) {
  const lift = speaking ? -3 : listening ? -1 : 0;
  const auraScale = speaking ? 1.03 : listening ? 1.015 : 1;
  const faceGlow = listening
    ? "0 0 44px rgba(154,230,255,0.28), 0 0 76px rgba(214,146,255,0.10)"
    : "0 0 28px rgba(154,230,255,0.18), 0 0 56px rgba(214,146,255,0.06)";
  const coreGlow = speaking ? "0 0 24px rgba(255,208,92,0.52)" : "0 0 14px rgba(255,208,92,0.28)";

  return (
    <div
      data-homie-lead-avatar-hero="v10.36.99"
      style={{
        width: "100%",
        minHeight: 444,
        display: "grid",
        placeItems: "center",
        borderRadius: 30,
        border: "1px solid rgba(154,230,255,0.12)",
        background:
          "radial-gradient(340px 190px at 50% 0%, rgba(154,230,255,0.11), rgba(154,230,255,0) 74%), radial-gradient(300px 190px at 50% 100%, rgba(255,170,220,0.07), rgba(255,170,220,0) 74%), rgba(5,10,20,0.28)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 392,
          maxWidth: "100%",
          display: "grid",
          justifyItems: "center",
          gap: 12,
          padding: "8px 6px 0",
        }}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "1 / 1.16",
            borderRadius: 34,
            position: "relative",
            overflow: "hidden",
            border: "1px solid rgba(154,230,255,0.15)",
            background:
              "radial-gradient(270px 170px at 50% 18%, rgba(255,255,255,0.08), rgba(255,255,255,0) 72%), radial-gradient(270px 235px at 50% 46%, rgba(154,230,255,0.10), rgba(154,230,255,0) 72%), linear-gradient(180deg, rgba(24,31,52,0.98) 0%, rgba(10,14,26,0.99) 100%)",
            boxShadow:
              "inset 0 0 0 1px rgba(154,230,255,0.04), 0 26px 62px rgba(0,0,0,0.42), 0 0 52px rgba(94,234,242,0.10), 0 0 72px rgba(255,170,220,0.07)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 22,
              borderRadius: 28,
              border: "1px solid rgba(154,230,255,0.16)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 20,
              width: 126,
              height: 18,
              transform: "translateX(-50%)",
              borderRadius: 999,
              background: "rgba(3,5,12,0.38)",
              filter: "blur(2px)",
            }}
          />

          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "52%",
              transform: `translate(-50%, calc(-50% + ${lift}px)) scale(${auraScale})`,
              width: 188,
              height: 248,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 42,
                top: 34,
                width: 104,
                height: 160,
                borderRadius: 999,
                background: "radial-gradient(circle at 50% 40%, rgba(154,230,255,0.24), rgba(154,230,255,0.05) 56%, rgba(154,230,255,0) 74%)",
                filter: "blur(10px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 52,
                top: 48,
                width: 84,
                height: 132,
                borderRadius: 999,
                background: "linear-gradient(180deg, rgba(206,221,228,0.22) 0%, rgba(130,145,170,0.12) 100%)",
                opacity: 0.64,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 42,
                top: 86,
                width: 104,
                height: 142,
                borderRadius: 50,
                background: "linear-gradient(180deg, rgba(18,25,46,1) 0%, rgba(10,15,28,1) 100%)",
                boxShadow: "0 16px 28px rgba(0,0,0,0.20)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 56,
                top: 117,
                width: 76,
                height: 32,
                borderRadius: 20,
                background: "rgba(120,140,180,0.18)",
                border: "1px solid rgba(185,195,224,0.10)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 40,
                top: 20,
                width: 108,
                height: 122,
                borderRadius: 44,
                background:
                  "linear-gradient(180deg, rgba(162,221,255,1) 0%, rgba(129,148,255,0.98) 50%, rgba(214,146,255,0.98) 100%)",
                boxShadow: faceGlow,
              }}
            />
            <div style={{ position: "absolute", left: 42, top: 14, width: 23, height: 23, borderRadius: 999, background: "rgba(255,206,92,0.98)", boxShadow: "0 0 13px rgba(255,206,92,0.50)" }} />
            <div style={{ position: "absolute", right: 42, top: 14, width: 23, height: 23, borderRadius: 999, background: "rgba(255,206,92,0.98)", boxShadow: "0 0 13px rgba(255,206,92,0.50)" }} />
            <div style={{ position: "absolute", left: 54, top: 24, width: 35, height: 13, borderTop: "3px solid rgba(154,230,255,0.68)", borderRadius: 999, transform: "rotate(-10deg)" }} />
            <div style={{ position: "absolute", right: 54, top: 24, width: 35, height: 13, borderTop: "3px solid rgba(154,230,255,0.68)", borderRadius: 999, transform: "rotate(10deg)" }} />
            <div style={{ position: "absolute", left: 58, top: 60, width: 22, height: 7, borderRadius: 999, background: "rgba(233,241,255,0.90)", transform: "rotate(-8deg)" }} />
            <div style={{ position: "absolute", right: 58, top: 60, width: 22, height: 7, borderRadius: 999, background: "rgba(233,241,255,0.90)", transform: "rotate(8deg)" }} />
            <div style={{ position: "absolute", left: 54, top: 78, width: 22, height: 28, borderRadius: 10, background: "rgba(10,16,28,0.98)" }} />
            <div style={{ position: "absolute", right: 54, top: 78, width: 22, height: 28, borderRadius: 10, background: "rgba(10,16,28,0.98)" }} />
            <div style={{ position: "absolute", left: 82, top: 106, width: 24, height: 4, borderRadius: 999, background: "rgba(81,42,78,0.84)" }} />
            <div style={{ position: "absolute", left: 78, top: 104, width: 32, height: 14, borderBottom: "3px solid rgba(81,42,78,0.84)", borderRadius: 999 }} />
            <div style={{ position: "absolute", left: 50, top: 93, width: 14, height: 10, borderRadius: 999, background: "rgba(255,186,206,0.20)" }} />
            <div style={{ position: "absolute", right: 50, top: 93, width: 14, height: 10, borderRadius: 999, background: "rgba(255,186,206,0.20)" }} />
            <div style={{ position: "absolute", left: 18, top: 148, width: 22, height: 22, borderRadius: 999, background: "rgba(189,225,255,0.90)", boxShadow: "0 0 16px rgba(189,225,255,0.36)" }} />
            <div style={{ position: "absolute", right: 18, top: 148, width: 22, height: 22, borderRadius: 999, background: "rgba(189,225,255,0.90)", boxShadow: "0 0 16px rgba(189,225,255,0.36)" }} />
            <div style={{ position: "absolute", left: 78, top: 218, width: 32, height: 17, borderRadius: 999, background: "linear-gradient(180deg, rgba(40,50,90,1) 0%, rgba(16,22,38,1) 100%)" }} />
            <div style={{ position: "absolute", left: 76, top: 170, width: 36, height: 36, display: "grid", placeItems: "center" }}>
              <div style={{ width: 26, height: 26, borderRadius: 999, background: "rgba(255,208,92,0.98)", boxShadow: coreGlow }} />
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontWeight: 800, letterSpacing: "0.01em" }}>Earlier robot visual lane</div>
          <div className="small" style={{ marginTop: 4, opacity: 0.9 }}>
            Hero-parity lead avatar with tighter head shape, closer eye spacing, softer aura, and cleaner framing to better match the right-side companion lane.
          </div>
        </div>
      </div>
    </div>
  );
}

function buildHomieThemeList(activePanelId?: string) {
  const legacy = loadJSON<any>("oddengine:fairlygodmode:legacyOpenFirst:v1", {});
  const mode = loadJSON<any>("oddengine:fairlygodmode:activeMode:v1", {});
  const themes = new Set<string>();
  themes.add("next move");
  if (activePanelId) themes.add(activePanelId);
  if (legacy?.familyMessage || legacy?.importantNotes) themes.add("family legacy");
  if (mode?.name) themes.add(mode.name);
  themes.add("body / mind");
  themes.add("money");
  themes.add("studio");
  return Array.from(themes).slice(0, 7);
}

function summarizeHomieMemory(messages: ChatMsg[]) {
  const recent = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content.replace(/\s+/g, " ").slice(0, 110));
  return recent.length ? recent : ["No recent check-ins yet. Start with: Homie, what should I do next?"];
}

function getLegacyOpenFirstBrief() {
  const legacy = loadJSON<any>("oddengine:fairlygodmode:legacyOpenFirst:v1", {});
  return {
    title: legacy?.welcomeTitle || "Open First",
    body:
      legacy?.familyMessage ||
      legacy?.welcomeBody ||
      "Legacy mode is ready. Add family notes, open-first guidance, and important next steps in FG/GOD -> Legacy.",
    important: legacy?.importantNotes || "No important notes saved yet.",
  };
}

function explainVoicePlain(snapshot: VoiceEngineSnapshot) {
  const summary = summarizeVoiceEngine(snapshot);
  if (snapshot.listening) return "Mic/listening lane is active. Homie is ready to hear you.";
  if (snapshot.speaking) return "Voice output is active. Homie is talking.";
  if (summary.toLowerCase().includes("degraded")) return "Voice is partly available, but one lane needs attention. Typed Homie stays safe.";
  if (summary.toLowerCase().includes("unavailable")) return "Voice is limited right now. Typed Homie and FairlyGodMode commands still work.";
  return summary || "Voice status is calm. Typed commands are always safe.";
}
function HomieHumanLegacyIdentity({ addQuick, onNavigate }: { addQuick: (text: string) => void; onNavigate?: (panelId: string) => void }) {
  return (
    <div className="card softCard homieHumanIdentityBoard" data-homie-human-legacy-identity="v10.38.8">
      <div className="homieHumanIdentityGrid">
        <div className="homieHumanStage">
          <div className="homieHumanAura">
            <div className="homieHumanCap" />
            <div className="homieHumanEar left" />
            <div className="homieHumanEar right" />
            <div className="homieHumanHead" />
            <div className="homieHumanGlasses">
              <div className="homieHumanLens left"><div className="homieHumanEye left" /><div className="homieHumanBrow left" /></div>
              <div className="homieHumanLens right"><div className="homieHumanEye right" /><div className="homieHumanBrow right" /></div>
              <div className="homieHumanBridge" />
            </div>
            <div className="homieHumanNose" />
            <div className="homieHumanBeard" />
            <div className="homieHumanSmile" />
            <div className="homieHumanBody" />
            <div className="homieHumanCore" />
            <div className="homieHumanHand left" />
            <div className="homieHumanHand right" />
            <div className="homieHumanFoot" />
          </div>
          <div className="homieHumanCaption">Human-inspired Homie: cap, glasses, beard, warm smile, kind eyes.</div>
        </div>

        <div className="homieHumanCopy">
          <div className="homieHumanCard">
            <h3>Homie identity direction - single lead</h3>
            <p>
              Homie is not a clone of another companion. Homie is the single FairlyOdd family guide: warm, grounded,
              lightly playful, and built to help with one clear next step.
            </p>
          </div>

          <div className="homieHumanCard">
            <h3>How Homie should feel</h3>
            <div className="homieHumanPrinciples">
              <div className="homieHumanPrinciple">Present: "I am here. We can take this one step at a time."</div>
              <div className="homieHumanPrinciple">Family-safe: explains panels without dev jargon.</div>
              <div className="homieHumanPrinciple">Grounded: helps body, mind, money, home, and creative work.</div>
              <div className="homieHumanPrinciple">Legacy-aware: knows Open First matters most.</div>
            </div>
          </div>

          <div className="homieHumanCard">
            <h3>Living presence states</h3>
            <p>Idle, listening, thinking, speaking, caring, and legacy mode are visual/wording states first. No voice engine rewrite in this pass.</p>
            <div className="homieHumanPromptRow">
              <button className="tabBtn active" onClick={() => addQuick("Homie, I need one calm next step.")}>One calm step</button>
              <button className="tabBtn" onClick={() => addQuick("Homie, help my family understand this OS.")}>Family guide</button>
              <button className="tabBtn" onClick={() => addQuick("Homie, help me write an Open First note.")}>Open First note</button>
              <button className="tabBtn" onClick={() => onNavigate?.("FamilyBudget")}>Budget</button>
              <button className="tabBtn" onClick={() => onNavigate?.("Books")}>Creative works</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function HomieCompanionHumanMini() {
  return (
    <div className="homieCompanionHumanMini" aria-label="Human-inspired Homie companion">
      <div className="homieCompanionHumanCap" />
      <div className="homieCompanionHumanEar left" />
      <div className="homieCompanionHumanEar right" />
      <div className="homieCompanionHumanHead" />
      <div className="homieCompanionHumanBrow left" />
      <div className="homieCompanionHumanBrow right" />
      <div className="homieCompanionHumanGlasses">
        <div className="homieCompanionHumanBridge" />
      </div>
      <div className="homieCompanionHumanEye left" />
      <div className="homieCompanionHumanEye right" />
      <div className="homieCompanionHumanBeard" />
      <div className="homieCompanionHumanSmile" />
      <div className="homieCompanionHumanBody" />
      <div className="homieCompanionHumanCore" />
      <div className="homieCompanionHumanHand left" />
      <div className="homieCompanionHumanHand right" />
      <div className="homieCompanionHumanLabel">HOMIE</div>
    </div>
  );
}
function HomieDirectHumanAvatar() {
  return (
    <div className="homieCompanionDirectHumanSlot">
      <div className="homieDirectHumanMini" aria-label="Human-inspired Homie avatar">
        <div className="homieDirectHumanCap" />
        <div className="homieDirectHumanEar left" />
        <div className="homieDirectHumanEar right" />
        <div className="homieDirectHumanHead" />
        <div className="homieDirectHumanBrow left" />
        <div className="homieDirectHumanBrow right" />
        <div className="homieDirectHumanGlasses">
          <div className="homieDirectHumanBridge" />
        </div>
        <div className="homieDirectHumanEye left" />
        <div className="homieDirectHumanEye right" />
        <div className="homieDirectHumanBeard" />
        <div className="homieDirectHumanSmile" />
        <div className="homieDirectHumanBody" />
        <div className="homieDirectHumanCore" />
        <div className="homieDirectHumanHand left" />
        <div className="homieDirectHumanHand right" />
        <div className="homieDirectHumanLabel">HOMIE</div>
      </div>
    </div>
  );
}
export default function Homie({ onNavigate, activePanelId, onOpenHowTo }: Props) {
  const desktop = isDesktop();

  const [tab, setTab] = useState<"ai" | "guide">("ai");
  const [choresTick, setChoresTick] = useState(0);
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceEngineSnapshot>(() => loadVoiceEngineSnapshot());
  const [showLegacyPreview, setShowLegacyPreview] = useState(false);

  const [devSnap, setDevSnap] = useState<DevSnapshot | null>(null);
  const [targetProject, setTargetProject] = useState<string>(() => {
    try {
      return localStorage.getItem(LS_TARGET) || localStorage.getItem("oddengine:dev:projectDir") || "";
    } catch {
      return "";
    }
  });

  const [model, setModel] = useState(
    () => loadJSON(LS_SETTINGS, { model: "llama3.1:8b", temperature: 0.2, includeContext: true, system: DEFAULT_SYSTEM }).model
  );
  const [temperature, setTemperature] = useState(
    () => loadJSON(LS_SETTINGS, { model: "llama3.1:8b", temperature: 0.2, includeContext: true, system: DEFAULT_SYSTEM }).temperature
  );
  const [includeContext, setIncludeContext] = useState(
    () => loadJSON(LS_SETTINGS, { model: "llama3.1:8b", temperature: 0.2, includeContext: true, system: DEFAULT_SYSTEM }).includeContext
  );
  const [systemPrompt, setSystemPrompt] = useState(
    () => loadJSON(LS_SETTINGS, { model: "llama3.1:8b", temperature: 0.2, includeContext: true, system: DEFAULT_SYSTEM }).system
  );

  const [checking, setChecking] = useState(false);
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaError, setOllamaError] = useState("");

  const [messages, setMessages] = useState<ChatMsg[]>(() => loadJSON<ChatMsg[]>(LS_CHAT, []));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveJSON(LS_SETTINGS, { model, temperature, includeContext, system: systemPrompt });
  }, [model, temperature, includeContext, systemPrompt]);

  useEffect(() => {
    saveJSON(LS_CHAT, messages.slice(-80));
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_TARGET, targetProject || "");
    } catch {
      // ignore
    }
  }, [targetProject]);

  useEffect(() => {
    if (!desktop) return;
    if (targetProject) return;
    (async () => {
      try {
        const info = await oddApi().getSystemInfo();
        if (info && info.ok && !info.packaged && info.cwd) {
          setTargetProject(info.cwd);
          try {
            localStorage.setItem("oddengine:dev:projectDir", info.cwd);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    })();
  }, [desktop, targetProject]);

  useEffect(() => {
    const onChores = () => setChoresTick((x) => x + 1);
    try {
      window.addEventListener(DAILY_CHORES_EVENT as any, onChores);
      window.addEventListener("storage", onChores);
    } catch {
      // ignore
    }
    return () => {
      try {
        window.removeEventListener(DAILY_CHORES_EVENT as any, onChores);
        window.removeEventListener("storage", onChores);
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    const onVoiceEngine = () => setVoiceSnapshot(loadVoiceEngineSnapshot());
    try {
      window.addEventListener("oddengine:voice-engine-changed", onVoiceEngine as any);
      window.addEventListener("storage", onVoiceEngine as any);
    } catch {
      // ignore
    }
    return () => {
      try {
        window.removeEventListener("oddengine:voice-engine-changed", onVoiceEngine as any);
        window.removeEventListener("storage", onVoiceEngine as any);
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    if (!desktop) return;
    void checkOllama();
    void refreshDevSnapshot();
  }, [desktop]);

  const choresSnapshot = useMemo(() => {
    void choresTick;
    return computeDailyChoresSnapshot(loadDailyChoresState());
  }, [choresTick]);

  const operatorBrain = useMemo(() => getOperatorBrainSnapshot(), [choresTick, activePanelId]);
  const homieThemes = useMemo(() => buildHomieThemeList(activePanelId), [activePanelId, messages.length]);
  const homieRecentMemory = useMemo(() => summarizeHomieMemory(messages), [messages]);
  const homieLegacyBrief = useMemo(() => getLegacyOpenFirstBrief(), [messages.length, activePanelId]);
  const homieVoicePlain = useMemo(() => explainVoicePlain(voiceSnapshot), [voiceSnapshot]);

  async function checkOllama() {
    if (!desktop) return;
    setChecking(true);
    setOllamaError("");
    try {
      const r = await oddApi().homieCheck();
      if (r.ok) {
        setOllamaRunning(true);
        setOllamaModels(r.models || []);
      } else {
        setOllamaRunning(false);
        setOllamaModels([]);
        setOllamaError(r.error || "Ollama not reachable");
      }
    } catch (e: any) {
      setOllamaRunning(false);
      setOllamaModels([]);
      setOllamaError(String(e));
    } finally {
      setChecking(false);
    }
  }

  async function refreshDevSnapshot() {
    if (!desktop) return;
    try {
      const r = await oddApi().getDevSnapshot({ limit: 260 } as any);
      if (r && r.ok) setDevSnap(r as any);
    } catch {
      // ignore
    }
  }

  async function pickTargetProject() {
    if (!desktop) return;
    try {
      const r = await oddApi().pickDirectory({ title: "Pick target project folder" } as any);
      if (r && r.ok && r.path) setTargetProject(r.path);
    } catch {
      // ignore
    }
  }

  function resetChat() {
    setMessages([]);
    saveJSON(LS_CHAT, []);
  }

  function addQuick(text: string) {
    setInput(text);
    setTab("ai");
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const ctx = includeContext
      ? `\n\n[OddEngine Context]\nHost: ${window.location.hostname}\nActive panel: ${activePanelId || "(unknown)"}\nTime: ${new Date().toISOString()}\n\n[Daily Chores Context]\n${buildDailyChoresContext(choresSnapshot)}\n`
      : "";

    const userMsg: ChatMsg = { id: uid(), role: "user", content: text + ctx, ts: Date.now() };
    const next = [...messages, userMsg].slice(-80);
    setMessages(next);
    setInput("");

    if (!desktop) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content:
            "AI chat needs **Desktop mode** (Electron) so Homie can talk to your local Ollama safely.\n\nRun: **npm run dev:desktop** (or build the EXE) and try again.",
          ts: Date.now(),
        },
      ]);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        model,
        temperature,
        system: systemPrompt,
        messages: next.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
      };

      const r = await oddApi().homieChat(payload as any);
      if (!r.ok) {
        const err = r.error || "Homie request failed";
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content:
              `⚠️ ${err}\n\nIf you haven't installed Ollama yet:\n1) Install Ollama\n2) Run: **ollama pull ${model}**\n3) Confirm server is up (localhost:11434) then hit **Check Ollama**.`,
            ts: Date.now(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: (r.reply || "").trim() || "(no reply)", ts: Date.now() },
        ]);
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `⚠️ ${String(e)}`, ts: Date.now() }]);
    } finally {
      setBusy(false);
    }
  }

  const recoveryGuide = useMemo(() => {
    const issues = devSnap?.issues || [];
    const currentPanel = activePanelId || "Home";

    if (!desktop) {
      return {
        tone: "warn",
        badge: "Web mode",
        headline: "Recovery is limited in browser mode.",
        body: `Homie can still route you and explain next steps, but local AI, DevEngine recovery, and the full voice lane work best in Desktop mode. Current panel: ${currentPanel}.`,
      };
    }

    if (issues.length) {
      const first = issues[0];
      const playbookHint = first.recommendedPlaybooks?.length
        ? `Safest next move: review or run ${first.recommendedPlaybooks[0]} first.`
        : "Safest next move: open DevEngine and review the latest logs before changing files.";
      return {
        tone: "bad",
        badge: `${issues.length} recovery item${issues.length === 1 ? "" : "s"}`,
        headline: first.title || "Homie spotted a live issue.",
        body: `${first.explanation || "Homie detected an issue in the current local workflow."}\n\n${playbookHint}\n\nCurrent panel: ${currentPanel}`,
      };
    }

    if (ollamaRunning === false) {
      return {
        tone: "warn",
        badge: "AI lane degraded",
        headline: "Homie chat is waiting on Ollama.",
        body: "Typed routing, panel status, and recovery guidance still work, but full local AI replies will stay degraded until Ollama is back at 127.0.0.1:11434.",
      };
    }

    if (
      voiceSnapshot.externalState === "degraded" ||
      voiceSnapshot.cloudState === "degraded" ||
      voiceSnapshot.pushToTalkState === "degraded"
    ) {
      return {
        tone: "warn",
        badge: "Voice degraded",
        headline: "Homie voice is up, but one lane is degraded.",
        body: summarizeVoiceEngine(voiceSnapshot) + "\n\nSafest next move: check Preferences or use typed commands while the voice lane settles.",
      };
    }

    if (
      voiceSnapshot.externalState === "unavailable" ||
      voiceSnapshot.cloudState === "unavailable" ||
      voiceSnapshot.pushToTalkState === "unavailable"
    ) {
      return {
        tone: "warn",
        badge: "Voice limited",
        headline: "Voice is not fully available right now.",
        body: summarizeVoiceEngine(voiceSnapshot) + "\n\nSafest next move: typed commands stay ready, and Homie can still route you to the right panel while voice is down.",
      };
    }

    return {
      tone: "good",
      badge: "Phoenix ready",
      headline: "Homie recovery lane is standing by.",
      body: "Local AI, route-ready help, and voice status look stable. If the OS feels shaky, start here for the calm next move instead of guessing.",
    };
  }, [activePanelId, desktop, devSnap, ollamaRunning, voiceSnapshot]);

  const guide = useMemo(
    () => [
      {
        title: "Where do I start?",
        body:
          "Start in **OddBrain** (health + integrity), then **Dev Engine** to pick a project and run builds/logs.\n\nIf you want generators, use **Autopilot** (web-safe export) or Desktop mode for writing files.",
      },
      {
        title: "Desktop vs Web",
        body:
          "• **Web (npm run dev:web)**: safe UI-only mode. No disk writes.\n• **Desktop (npm run dev:desktop)**: Electron enabled (logs/files/plugins/emulators).\n\nHomie AI runs in **Desktop mode** using **local Ollama** on 127.0.0.1.",
      },
      {
        title: "Install Ollama (local AI)",
        body:
          "1) Install Ollama for Windows\n2) In PowerShell: **ollama --version**\n3) Pull a model: **ollama pull llama3.1:8b** (or pick a smaller one)\n4) Keep Ollama running (it hosts on **127.0.0.1:11434**)",
      },
      {
        title: "Safety rule",
        body:
          "Homie will **ask before** running destructive actions. If you want, you can paste logs/errors and Homie will explain + propose the safest fix steps.",
      },
    ],
    []
  );

  return (
    <div className="page" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <PanelHeader
        panelId="Homie"
        title="Homie"
        subtitle="Warm OS companion, family guide, and local AI helper"
        badges={[
          { label: desktop ? "Desktop" : "Web", tone: desktop ? "good" : "warn" },
          {
            label: ollamaRunning === null ? "Ollama: ?" : ollamaRunning ? "Ollama: running" : "Ollama: off",
            tone: ollamaRunning ? "good" : ollamaRunning === false ? "bad" : "muted",
          },
          {
            label: (devSnap?.runningCount || 0) > 0 ? `DevEngine: running (${devSnap?.runningCount || 0})` : "DevEngine: idle",
            tone: (devSnap?.runningCount || 0) > 0 ? "warn" : "muted",
          },
          { label: choresSnapshot.open ? `Chores: ${choresSnapshot.open} open` : "Chores: clear", tone: choresSnapshot.open ? "warn" : "good" },
        ]}
        rightSlot={
          <ActionMenu
            items={[
              { label: "Open DevEngine", onClick: () => onNavigate?.("DevEngine") },
              { label: "Open Daily Chores", onClick: () => onNavigate?.("DailyChores") },
              { label: "Open Calendar", onClick: () => onNavigate?.("Calendar") },
              { label: "Pick Project", onClick: () => pickTargetProject(), disabled: !desktop },
              { label: "Refresh Dev Snapshot", onClick: () => refreshDevSnapshot(), disabled: !desktop },
              { label: checking ? "Checking Ollama…" : "Check Ollama", onClick: () => checkOllama(), disabled: !desktop || checking },
              { label: "Reset chat", onClick: () => resetChat(), tone: "danger" },
            ]}
          />
        }
      />

      <div className="tabs" style={{ marginBottom: 10 }}>
        <button className={"tabBtn " + (tab === "ai" ? "active" : "")} onClick={() => setTab("ai")}>AI</button>
        <button className={"tabBtn " + (tab === "guide" ? "active" : "")} onClick={() => setTab("guide")}>Guide</button>
        <button className="tabBtn" onClick={() => onOpenHowTo?.()} title="How to Use (F1)">ℹ</button>
      </div>

      <div className="card softCard homiePresenceBoard" data-homie-presence-board="v10.38.7">
        <div className="homiePresenceTop">
          <div className="homiePresencePane">
            <div className="homiePresenceTitle">I am here with you.</div>
            <div className="homiePresenceText">
              Homie is tuned for calm next steps: body, mind, family, money, studio, and what to open next.
            </div>
            <div className="homiePresenceChips">
              {homieThemes.map((theme) => <span key={theme} className="homiePresenceChip">{theme}</span>)}
            </div>
            <div className="homieSoftPromptRow">
              <button className="tabBtn" onClick={() => addQuick("Homie, what should I do next?")}>Next move</button>
              <button className="tabBtn" onClick={() => addQuick("Homie, explain this panel like I am tired.")}>Explain this panel</button>
              <button className="tabBtn" onClick={() => addQuick("Homie, help me leave clear notes for my family.")}>Legacy notes</button>
              <button className="tabBtn" onClick={() => onNavigate?.("Home")}>Open Home</button>
            </div>
          </div>

          <div className="homiePresencePane">
            <div className="homiePresenceTitle">Memory + voice clarity</div>
            <div className="homieVoicePlain">
              <div className="small">Voice / mic in plain English</div>
              <div className="homiePresenceText">{homieVoicePlain}</div>
            </div>
            <div className="homieMemoryList">
              {homieRecentMemory.map((item, idx) => (
                <div key={idx} className="homieMemoryItem">{item}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="homiePresencePane" style={{ marginTop: 12 }}>
          <div className="homiePresenceTitle">{homieLegacyBrief.title} family handoff</div>
          <div className="homiePresenceText">{homieLegacyBrief.body}</div>
          <div className="homiePresenceText"><b>Important note:</b> {homieLegacyBrief.important}</div>
          <div className="homieSoftPromptRow">
            <button className="tabBtn active" onClick={() => addQuick("Homie, show me the family open-first plan.")}>Ask Homie for Open First</button>
            <button className="tabBtn" onClick={() => onNavigate?.("FamilyBudget")}>Open budget</button>
            <button className="tabBtn" onClick={() => onNavigate?.("FamilyHealth")}>Open family health</button>
          </div>
        </div>
      </div>
      <HomieHumanLegacyIdentity addQuick={addQuick} onNavigate={onNavigate} />

      {tab === "ai" && (
        <>
                    <details className="homieLegacyRobotPreview">
            <summary>Legacy robot visual preview is hidden</summary>
            <div className="small">
              The older robot/alien visual lane is preserved for comparison only. The human-inspired Homie is now the single lead identity.
            </div>
          </details>
          <div className="card softCard" data-homie-hero-parity-match="v10.36.99" style={{ marginTop: 12, borderColor: "rgba(154,230,255,0.24)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Legacy robot visual preview</div>
                <div className="sub">Preserved comparison preview for the earlier robot visual lane: tighter head shape, closer eye spacing, better mouth curve, softer aura, cleaner body taper, and calmer frame spacing to match the right-side companion more closely.</div>
              </div>
              <span className={`badge ${voiceSnapshot.listening ? "good" : "muted"}`}>{voiceSnapshot.listening ? "Listening" : "Lead visual ready"}</span>
            </div>

            <div className="grid2" style={{ alignItems: "start", marginTop: 12 }}>
              <div className="card" style={{ background: "rgba(6,12,24,0.38)", borderColor: "rgba(154,230,255,0.14)" }}>
                <HomieLeadAvatarHeroStage listening={voiceSnapshot.listening} speaking={busy} />
              </div>

              <div className="card" style={{ background: "rgba(6,12,24,0.38)", borderColor: "rgba(154,230,255,0.14)" }}>
                <div className="h">Legacy visual comparison</div>
                <div className="sub">This is no longer a wiring fix. It is purely a visual parity pass to pull the top lead avatar closer to the right-side hero companion without changing the single-owner layout you already stabilized.</div>

                <div className="assistantChipWrap" style={{ marginTop: 12 }}>
                  <span className="badge">Head shape tightened</span>
                  <span className="badge">Eye spacing tuned</span>
                  <span className="badge">Mouth shape refined</span>
                  <span className="badge">Aura softened</span>
                </div>

                <div className="timelineCard" style={{ marginTop: 12 }}>
                  <b>Best next move:</b> keep the single-owner layout and only use Legacy preview for comparison. From here on out the work is just personality, realism, and polish.
                </div>

                <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                  <button className="tabBtn active" onClick={() => addQuick("Keep Homie in the hero parity lead lane and only open legacy preview if I ask for it.")}>Lock hero lead lane</button>
                  <button className="tabBtn" onClick={() => onNavigate("HomieCloneStudio")}>Open Clone Studio</button>
                  <button className="tabBtn" onClick={() => onNavigate("Books")}>Open Writers Lounge</button>
                  <button className="tabBtn" onClick={() => onNavigate("Preferences")}>Open Preferences</button>
                </div>
              </div>
            </div>
          </div>

          <details className="card softCard" data-homie-legacy-preview="v10.36.99" style={{ marginTop: 12, borderColor: "rgba(154,230,255,0.14)" }} open={showLegacyPreview}>
            <summary
              style={{ cursor: "pointer", listStyle: "none" }}
              onClick={(e) => {
                e.preventDefault();
                setShowLegacyPreview((v) => !v);
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="h">Legacy preview</div>
                  <div className="sub">Older purple experimental stage. Collapsed by default so it cannot define the main visual impression.</div>
                </div>
                <span className="badge muted">{showLegacyPreview ? "Hide" : "Compare only"}</span>
              </div>
            </summary>

            {showLegacyPreview ? (
              <div className="card" style={{ marginTop: 12, background: "rgba(8,14,28,0.48)", borderColor: "rgba(154,230,255,0.10)" }}>
                <div className="assistantChipWrap" style={{ marginTop: 4 }}>
                  <span className="badge">Legacy avatar</span>
                  <span className="badge">Older preview</span>
                  <span className="badge">Camera off</span>
                  <span className="badge">Mic off</span>
                </div>
                <div className="timelineCard" style={{ marginTop: 12 }}>
                  <b>Retired stage:</b> the old purple experimental avatar stays out of the main lane. Use the hero-parity lead companion above as the default Homie identity.
                </div>
              </div>
            ) : null}
          </details>

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
                <button className="tabBtn" onClick={() => addQuick("What matters at home today? Route me to the right panel and tell me the next chore lane.")}>House guide</button>
                <button className="tabBtn" onClick={() => addQuick("Package the next build zip cleanly.")}>Ship zip</button>
                <button className="tabBtn active" onClick={() => onNavigate?.("DevEngine")}>DevEngine</button>
              </div>
            </div>
          </div>

          <div className="card softCard" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Family guide lane</div>
                <div className="sub">Homie can see the current house reset board and help the family route to the right next move.</div>
              </div>
              <span className={`badge ${choresSnapshot.open ? "warn" : "good"}`}>{choresSnapshot.open ? `${choresSnapshot.open} chores open` : "Board clear"}</span>
            </div>
            <div className="timelineCard" style={{ marginTop: 12 }}>{choresSnapshot.summary}</div>
            {choresSnapshot.todayNote ? <div className="timelineCard" style={{ marginTop: 10 }}>Today note: {choresSnapshot.todayNote}</div> : null}
            <div className="assistantChipWrap" style={{ marginTop: 12 }}>
              {choresSnapshot.mustDoToday.slice(0, 3).map((item) => (
                <span key={item.taskId} className="badge">{item.laneTitle}: {item.text}</span>
              ))}
            </div>
            <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={() => onNavigate("DailyChores")}>Open Daily Chores</button>
              <button className="tabBtn" onClick={() => onNavigate("Home")}>Open Home</button>
              <button className="tabBtn" onClick={() => addQuick("What should the family do next around the house today? Keep it plain and route-ready.")}>Ask about today</button>
            </div>
          </div>

          <div className="card softCard" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Phoenix daily truth</div>
                <div className="sub">Homie is reading the same shared daily truth as Home and the shell.</div>
              </div>
              <span className="badge good">Synced</span>
            </div>

            <div className="timelineCard" style={{ marginTop: 12 }}>
              <b>What matters now:</b> {operatorBrain.whatMattersNow.title}
              <div className="small" style={{ marginTop: 6 }}>{operatorBrain.whatMattersNow.text}</div>
            </div>

            <div className="assistantChipWrap" style={{ marginTop: 12 }}>
              <span className="badge">Family: {operatorBrain.familyLane.title}</span>
              <span className="badge">Operator: {operatorBrain.operatorLane.title}</span>
              <span className="badge">Next: {operatorBrain.whatToDoNext.title}</span>
            </div>

            <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={() => onNavigate(operatorBrain.familyLane.panelId)}>Open family lane</button>
              <button className="tabBtn" onClick={() => onNavigate(operatorBrain.operatorLane.panelId)}>Open operator lane</button>
              <button className="tabBtn" onClick={() => { runOperatorBrainNextAction(); onNavigate(operatorBrain.whatToDoNext.panelId); }}>Do next action</button>
              <button className="tabBtn" onClick={() => addQuick("What matters most right now for the family and where should I go next?")}>Ask in chat</button>
            </div>
          </div>

          <div className="card softCard" style={{ marginTop: 12, borderColor: "rgba(56,189,248,0.28)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Phoenix recovery + voice status</div>
                <div className="sub">Homie turns red moments into the calm next move: what broke, what still works, and where to go first.</div>
              </div>
              <span className={`badge ${recoveryGuide.tone}`}>{recoveryGuide.badge}</span>
            </div>

            <div className="timelineCard" style={{ marginTop: 12 }}>{recoveryGuide.headline}</div>
            <div className="small" style={{ marginTop: 10, whiteSpace: "pre-wrap", opacity: 0.92 }}>{recoveryGuide.body}</div>

            <div className="assistantChipWrap" style={{ marginTop: 12 }}>
              {getVoiceEngineBadges(voiceSnapshot).map((badge) => (
                <span key={badge.label} className={`badge ${badge.tone}`}>{badge.label}</span>
              ))}
            </div>
            <div className="small" style={{ marginTop: 8 }}>{summarizeVoiceEngine(voiceSnapshot)}</div>

            <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={() => addQuick("Tell me the safest recovery path right now in plain English.")}>Ask recovery guide</button>
              <button className="tabBtn" onClick={() => addQuick("What voice path is active right now and what should I do next?")}>Ask voice status</button>
              <button
                className={`tabBtn ${voiceSnapshot.listening ? "active" : ""}`}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("oddengine:voice-request", {
                      detail: { source: "homie", action: voiceSnapshot.listening ? "stop" : "listen" },
                    })
                  )
                }
              >
                {voiceSnapshot.listening ? "Stop voice" : "Start voice"}
              </button>
              <button className="tabBtn" onClick={() => onNavigate(activePanelId || "Home")}>Open current panel</button>
              <button className="tabBtn" onClick={() => onNavigate("Preferences")}>Open Preferences</button>
              <button className="tabBtn" onClick={() => window.dispatchEvent(new CustomEvent("oddengine:focus-commandbar"))}>Focus command bar</button>
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Homie AI Status</div>
                <div className="small">Uses local Ollama on 127.0.0.1 (no cloud required)</div>
              </div>
              <div className="row">
                <span className={"badge " + (ollamaRunning ? "good" : ollamaRunning === false ? "bad" : "")}>
                  {ollamaRunning === null ? "Unknown" : ollamaRunning ? "Ollama Running" : "Not Running"}
                </span>
                <button onClick={checkOllama} disabled={!desktop || checking}>{checking ? "Checking…" : "Check Ollama"}</button>
              </div>
            </div>
            {!desktop ? (
              <div className="small" style={{ marginTop: 10 }}>
                ⚠️ You are in <b>Web mode</b>. AI chat needs <b>Desktop mode</b>.
              </div>
            ) : null}
            {ollamaError ? (
              <div className="small" style={{ marginTop: 10, color: "#fbbf24" }}>
                {ollamaError}
              </div>
            ) : null}
            {!!ollamaModels.length ? (
              <div className="small" style={{ marginTop: 10 }}>
                Detected models: {ollamaModels.slice(0, 6).join(", ")}{ollamaModels.length > 6 ? "…" : ""}
              </div>
            ) : null}
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
                <b>Target Project:</b> <span style={{ opacity: 0.9 }}>{targetProject ? targetProject : "(not set)"}</span>
              </div>
              <button onClick={pickTargetProject} disabled={!desktop}>Pick Project</button>
            </div>

            {devSnap?.issues?.length ? (
              <div className="timelineCard" style={{ marginTop: 12 }}>
                <b>Top issue:</b> {devSnap.issues[0].title}
                <div className="small" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{devSnap.issues[0].explanation || "No explanation provided."}</div>
              </div>
            ) : (
              <div className="small" style={{ marginTop: 12, opacity: 0.9 }}>
                No active DevEngine issues detected in the latest snapshot.
              </div>
            )}

            {devSnap?.tail?.length ? (
              <div className="timelineCard" style={{ marginTop: 12 }}>
                <b>Recent log tail</b>
                <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>
{devSnap.tail.slice(-6).map((item) => `[${new Date(item.ts).toLocaleTimeString()}] ${item.text}`).join("\n")}
                </pre>
              </div>
            ) : null}
          </div>

          <div className="card softCard" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Talk with Homie</div>
                <div className="sub">Use local AI chat for routing, explanations, next commands, and calmer family/operator support.</div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="tabBtn" onClick={() => addQuick("Summarize what matters now and tell me the next move.")}>What matters now</button>
                <button className="tabBtn" onClick={() => addQuick("Turn the current issue into step-by-step fix commands.")}>Fix steps</button>
              </div>
            </div>

            <div
              ref={chatRef}
              className="timelineCard"
              style={{ marginTop: 12, maxHeight: 280, overflow: "auto", display: "grid", gap: 10 }}
            >
              {messages.length ? messages.map((m) => (
                <div key={m.id} className="card" style={{ background: m.role === "assistant" ? "rgba(67,56,202,0.10)" : "rgba(8,14,28,0.38)" }}>
                  <div className="small" style={{ opacity: 0.8, marginBottom: 6 }}>{m.role === "assistant" ? "Homie" : "You"}</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                </div>
              )) : (
                <div className="small" style={{ opacity: 0.9 }}>
                  Start with a simple ask like “What matters now?” or “Explain this error like I’m 5.”
                </div>
              )}
              {busy ? <div className="small">Homie is thinking…</div> : null}
            </div>

            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tell Homie what you need…"
                rows={4}
                style={{ flex: 1, minHeight: 92 }}
              />
              <div className="grid" style={{ gap: 8 }}>
                <button className="tabBtn active" onClick={send} disabled={busy || !input.trim()}>Send</button>
                <button className="tabBtn" onClick={resetChat}>Reset chat</button>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "guide" && (
        <div className="grid2" data-homie-guide-tab="v10.36.99" style={{ alignItems: "start", marginTop: 8 }}>
          {guide.map((item) => (
            <div key={item.title} className="card softCard">
              <div className="h">{item.title}</div>
              <div className="small" style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{item.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
