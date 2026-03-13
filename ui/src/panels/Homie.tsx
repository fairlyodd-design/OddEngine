import React, { useEffect, useMemo, useRef, useState } from "react";
import { isDesktop, oddApi } from "../lib/odd";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import {
  buildHomieDesktopSummary,
  getHomieDesktopActions,
  getHomieDesktopState,
  runHomieDesktopAction,
  type HomieDesktopAction,
} from "../lib/homieDesktopControl";

type Props = {
  onNavigate?: (panelId: string) => void;
  activePanelId?: string;
  onOpenHowTo?: () => void;
};

type ChatMsg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
};

type VoiceState = "idle" | "listening" | "processing" | "speaking" | "muted";
type VisionState = "off" | "ready";

const LS_CHAT = "oddengine:homie:chat:v1";
const LS_SETTINGS = "oddengine:homie:settings:v1";
const LS_TARGET = "oddengine:homie:targetProject:v1";

const DEFAULT_SYSTEM =
  "You are Homie, the onboard assistant for FairlyOdd OS.\n" +
  "- Be short, kind, and practical.\n" +
  "- Prefer PowerShell on Windows when giving commands.\n" +
  "- Keep actions safe and reversible.\n" +
  "- If the user is on Desktop, help them operate the OS with confidence.";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore
  }
}

export default function Homie({ onNavigate, activePanelId, onOpenHowTo }: Props) {
  const desktop = isDesktop();
  const [tab, setTab] = useState<"ai" | "ops" | "guide">("ai");
  const [targetProject, setTargetProject] = useState<string>(() => {
    try {
      return localStorage.getItem(LS_TARGET) || localStorage.getItem("oddengine:dev:projectDir") || "";
    } catch {
      return "";
    }
  });

  const [model, setModel] = useState(() =>
    loadJSON(LS_SETTINGS, { model: "llama3.1:8b", temperature: 0.2, includeContext: true, system: DEFAULT_SYSTEM }).model,
  );
  const [temperature, setTemperature] = useState(() =>
    loadJSON(LS_SETTINGS, { model: "llama3.1:8b", temperature: 0.2, includeContext: true, system: DEFAULT_SYSTEM }).temperature,
  );
  const [includeContext, setIncludeContext] = useState(() =>
    loadJSON(LS_SETTINGS, { model: "llama3.1:8b", temperature: 0.2, includeContext: true, system: DEFAULT_SYSTEM }).includeContext,
  );
  const [systemPrompt, setSystemPrompt] = useState(() =>
    loadJSON(LS_SETTINGS, { model: "llama3.1:8b", temperature: 0.2, includeContext: true, system: DEFAULT_SYSTEM }).system,
  );

  const [checking, setChecking] = useState(false);
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaError, setOllamaError] = useState("");

  const [messages, setMessages] = useState<ChatMsg[]>(() => loadJSON(LS_CHAT, []));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [desktopMsg, setDesktopMsg] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [visionState, setVisionState] = useState<VisionState>("off");
  const chatRef = useRef<HTMLDivElement | null>(null);

  const desktopState = useMemo(() => getHomieDesktopState(), [desktopMsg, tab]);
  const desktopSummary = useMemo(() => buildHomieDesktopSummary(), [desktopMsg, tab]);
  const desktopActions = useMemo(() => getHomieDesktopActions(), []);

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
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    setVoiceState(desktopState.micMuted ? "muted" : "idle");
    setVisionState(desktopState.cameraEnabled ? "ready" : "off");
  }, [desktopState.micMuted, desktopState.cameraEnabled]);

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

  function resetChat() {
    setMessages([]);
    saveJSON(LS_CHAT, []);
  }

  function addQuick(text: string) {
    setInput(text);
    setTab("ai");
  }

  async function pickTargetProject() {
    if (!desktop) return;
    try {
      const r = await oddApi().pickDirectory?.({ title: "Pick target project folder" } as any);
      if (r && (r as any).ok && (r as any).path) setTargetProject((r as any).path);
    } catch {
      // ignore
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const ctx = includeContext
      ? `\n\n[FairlyOdd OS Context]\nActive panel: ${activePanelId || "(unknown)"}\nDesktop: ${desktop ? "yes" : "no"}\nTime: ${new Date().toISOString()}\n`
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
            "Homie chat needs Desktop mode so I can safely talk to local Ollama. Run `npm run dev:desktop` and try again.",
          ts: Date.now(),
        },
      ]);
      return;
    }

    setBusy(true);
    setVoiceState("processing");
    try {
      const r = await oddApi().homieChat({
        model,
        temperature,
        system: systemPrompt,
        messages: next.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
      } as any);

      if (!r.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content:
              `⚠️ ${r.error || "Homie request failed"}\n\n` +
              `Check Ollama, then try again. If needed: \`ollama pull ${model}\`.`,
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
      setVoiceState(getHomieDesktopState().micMuted ? "muted" : "idle");
    }
  }

  async function runDesktopAction(action: HomieDesktopAction) {
    const res = await runHomieDesktopAction(action.id, { onNavigate });
    setDesktopMsg(res.message);
    const nextState = getHomieDesktopState();
    setVoiceState(nextState.micMuted ? "muted" : "idle");
    setVisionState(nextState.cameraEnabled ? "ready" : "off");
  }

  const guide = useMemo(
    () => [
      {
        title: "What Homie does",
        body:
          "Homie is your onboard OS assistant. He can help with Studio, Grocery, Budget, and local dev tasks, while staying local-first in Desktop mode.",
      },
      {
        title: "Desktop control",
        body:
          "In Desktop mode, Homie can open panels, reveal output folders, open packet folders, and help operate the OS without hunting through menus.",
      },
      {
        title: "Voice + vision roadmap",
        body:
          "Voice and camera controls are staged in a safe, opt-in way. Use Preferences as the setup hub, and keep mic/camera off until you want them.",
      },
    ],
    [],
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <PanelHeader
        panelId="Homie"
        title="Homie Command Deck"
        subtitle="Your onboard AI assistant, desktop helper, and calm command station."
        badges={[
          { label: desktop ? "Desktop" : "Web", tone: desktop ? "good" : "warn" },
          { label: ollamaRunning ? "Ollama running" : "Ollama idle", tone: ollamaRunning ? "good" : "muted" },
          { label: `Voice: ${voiceState}`, tone: voiceState === "muted" ? "warn" : "muted" },
          { label: `Vision: ${visionState}`, tone: visionState === "ready" ? "good" : "muted" },
        ]}
        rightSlot={
          <ActionMenu
            title="Homie tools"
            items={[
              { label: "Open Studio", onClick: () => onNavigate?.("Books") },
              { label: "Open Preferences", onClick: () => onNavigate?.("Preferences") },
              { label: "Check Ollama", onClick: () => checkOllama(), disabled: !desktop },
              { label: "Pick Project", onClick: () => pickTargetProject(), disabled: !desktop },
              { label: "How to Use", onClick: () => onOpenHowTo?.() },
            ]}
          />
        }
      />

      <div className="row wrap" style={{ gap: 10 }}>
        <button className={`tabBtn ${tab === "ai" ? "active" : ""}`} onClick={() => setTab("ai")}>AI</button>
        <button className={`tabBtn ${tab === "ops" ? "active" : ""}`} onClick={() => setTab("ops")}>Desktop Control</button>
        <button className={`tabBtn ${tab === "guide" ? "active" : ""}`} onClick={() => setTab("guide")}>Guide</button>
      </div>

      {tab === "ai" ? (
        <>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <div className="card softCard">
              <div className="small shellEyebrow">Quick actions</div>
              <div className="sub mt-2">Common things Homie can help with.</div>
              <div className="row wrap mt-3" style={{ gap: 8 }}>
                <button className="tabBtn" onClick={() => addQuick("Check my local logs and tell me the safest next step.")}>Diagnose</button>
                <button className="tabBtn" onClick={() => addQuick("Give me the exact PowerShell commands to run next.")}>Commands</button>
                <button className="tabBtn" onClick={() => addQuick("Summarize what still needs setup in this OS.")}>OS setup</button>
                <button className="tabBtn" onClick={() => onNavigate?.("Books")}>Open Studio</button>
              </div>
            </div>

            <div className="card softCard">
              <div className="small shellEyebrow">Status</div>
              <div className="small mt-2"><b>Target project:</b> {targetProject || "(not set)"}</div>
              <div className="small mt-2"><b>Models:</b> {ollamaModels.length ? ollamaModels.join(", ") : "(none detected yet)"}</div>
              {ollamaError ? <div className="note mt-3">{ollamaError}</div> : null}
              <div className="row wrap mt-3" style={{ gap: 8 }}>
                <button className="tabBtn" onClick={() => checkOllama()} disabled={!desktop || checking}>{checking ? "Checking…" : "Check Ollama"}</button>
                <button className="tabBtn" onClick={() => pickTargetProject()} disabled={!desktop}>Pick Project</button>
                <button className="tabBtn" onClick={() => resetChat()}>Reset Chat</button>
              </div>
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">Homie AI Chat</div>
            <div ref={chatRef} style={{ marginTop: 12, maxHeight: 340, overflow: "auto", display: "grid", gap: 10 }}>
              {messages.length === 0 ? (
                <div className="small">No messages yet. Ask Homie something practical.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="card softCard">
                    <div className="small shellEyebrow">{m.role.toUpperCase()}</div>
                    <div className="small mt-2" style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{m.content}</div>
                  </div>
                ))
              )}
              {busy ? <div className="small">Homie is thinking…</div> : null}
            </div>

            <div className="mt-3" style={{ display: "grid", gap: 10 }}>
              <textarea
                className="input"
                rows={4}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Homie for the next safest action, commands, or setup help."
              />
              <div className="row wrap" style={{ gap: 8 }}>
                <button className="tabBtn active" onClick={() => send()} disabled={busy || !input.trim()}>{busy ? "Sending…" : "Send"}</button>
                <label className="small" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={includeContext} onChange={(e) => setIncludeContext(e.target.checked)} />
                  Include active panel context
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <div className="card softCard">
              <div className="small shellEyebrow">Model</div>
              <input className="input mt-2" value={model} onChange={(e) => setModel(e.target.value)} />
              <div className="small mt-3">Temperature</div>
              <input className="input mt-2" type="number" step="0.1" min="0" max="1.5" value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
            </div>
            <div className="card softCard">
              <div className="small shellEyebrow">System Prompt</div>
              <textarea className="input mt-2" rows={8} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
            </div>
          </div>
        </>
      ) : null}

      {tab === "ops" ? (
        <>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <div className="card softCard">
              <div className="small shellEyebrow">Desktop state</div>
              <div className="small mt-2"><b>Desktop:</b> {desktopSummary.desktop ? "Yes" : "No"}</div>
              <div className="small mt-2"><b>Mic:</b> {desktopSummary.mic}</div>
              <div className="small mt-2"><b>Camera:</b> {desktopSummary.camera}</div>
              <div className="small mt-2"><b>Output folder:</b> {desktopSummary.outputFolderReady ? "Ready" : "Not set"}</div>
              <div className="small mt-2"><b>Output file:</b> {desktopSummary.outputFileReady ? "Ready" : "Not set"}</div>
              <div className="small mt-2"><b>Packet folder:</b> {desktopSummary.packetFolderReady ? "Ready" : "Not set"}</div>
              {desktopMsg ? <div className="note mt-3">{desktopMsg}</div> : null}
            </div>

            <div className="card softCard">
              <div className="small shellEyebrow">Suggested next actions</div>
              <div className="small mt-2">
                {!desktopSummary.desktop
                  ? "Switch to Desktop mode to unlock file and folder actions."
                  : !desktopSummary.outputFolderReady
                  ? "Generate or import a Studio output so Homie can open the output folder."
                  : !desktopSummary.packetFolderReady
                  ? "Export a packet so Homie can open the packet folder."
                  : "Homie desktop control is ready."}
              </div>
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">Desktop actions</div>
            <div className="sub mt-2">Panel jumps, output folders, and local control actions.</div>
            <div className="mt-3" style={{ display: "grid", gap: 10 }}>
              {desktopActions.map((action) => (
                <div key={action.id} className="card softCard">
                  <div className="cluster wrap spread">
                    <div>
                      <div className="small"><b>{action.label}</b></div>
                      <div className="small mt-2">{action.description}</div>
                    </div>
                    <button
                      className="tabBtn"
                      onClick={() => runDesktopAction(action)}
                      disabled={!!action.requiresDesktop && !desktop}
                    >
                      Run
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <PanelScheduleCard
            panelId="Homie"
            title="Homie reminders"
            subtitle="Quick-add follow-up actions and OS check-ins."
            presets={[
              { label: "+ Check render status", title: "Check render status", offsetDays: 0 },
              { label: "+ Preferences sweep", title: "Preferences sweep", offsetDays: 1 },
              { label: "+ Grocery budget review", title: "Grocery budget review", offsetDays: 2 },
            ]}
            onNavigate={onNavigate}
          />
        </>
      ) : null}

      {tab === "guide" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {guide.map((item) => (
            <div key={item.title} className="card softCard">
              <div className="small shellEyebrow">{item.title}</div>
              <div className="small mt-2" style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{item.body}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
