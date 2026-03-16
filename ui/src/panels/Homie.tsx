import React, { useEffect, useMemo, useRef, useState } from "react";
import { isDesktop, oddApi } from "../lib/odd";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";

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
const LS_AUTOFIX = "oddengine:homie:autofix:v1";
const LS_TARGET = "oddengine:homie:targetProject:v1";
const PREFS_KEY = "oddengine:prefs:v1";


const DEFAULT_SYSTEM =
  "You are Homie👊, the built-in assistant for OddEngine.\n" +
  "- Be short, clear, and practical.\n" +
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
  const [model, setModel] = useState(() => loadJSON(LS_SETTINGS, { model: "llama3.1:8b", temperature: 0.2, includeContext: true, system: DEFAULT_SYSTEM }).model);
  const [temperature, setTemperature] = useState(() => loadJSON(LS_SETTINGS, { model: "llama3.1:8b", temperature: 0.2, includeContext: true, system: DEFAULT_SYSTEM }).temperature);
  const [includeContext, setIncludeContext] = useState(() => loadJSON(LS_SETTINGS, { model: "llama3.1:8b", temperature: 0.2, includeContext: true, system: DEFAULT_SYSTEM }).includeContext);
  const [systemPrompt, setSystemPrompt] = useState(() => loadJSON(LS_SETTINGS, { model: "llama3.1:8b", temperature: 0.2, includeContext: true, system: DEFAULT_SYSTEM }).system);

  useEffect(() => {
    saveJSON(LS_SETTINGS, { model, temperature, includeContext, system: systemPrompt });
  }, [model, temperature, includeContext, systemPrompt]);

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

  // Chat
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadJSON<ChatMsg[]>(LS_CHAT, []));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);

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

    const ctx = includeContext
      ? `\n\n[OddEngine Context]\nHost: ${window.location.hostname}\nActive panel: ${activePanelId || "(unknown)"}\nTime: ${new Date().toISOString()}\n`
      : "";

    const userMsg: ChatMsg = { id: uid(), role: "user", content: text + ctx, ts: Date.now() };
    const next = [...messages, userMsg].slice(-80);
    setMessages(next);
    setInput("");

    if (!desktop) {
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: "AI chat needs **Desktop mode** (Electron) so Homie can talk to your local Ollama safely.\n\nRun: **npm run dev:desktop** (or build the EXE) and try again.", ts: Date.now() }]);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        model,
        temperature,
        system: systemPrompt,
        messages: next
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content }))
      };

      const r = await oddApi().homieChat(payload as any);
      if (!r.ok) {
        const err = r.error || "Homie request failed";
        setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `⚠️ ${err}\n\nIf you haven't installed Ollama yet:\n1) Install Ollama\n2) Run: **ollama pull ${model}**\n3) Confirm server is up (localhost:11434) then hit **Check Ollama**.`, ts: Date.now() }]);
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
        subtitle="Dev buddy + local AI helper (Desktop mode)"
        badges={[
          { label: desktop ? "Desktop" : "Web", tone: desktop ? "good" : "warn" },
          { label: ollamaRunning === null ? "Ollama: ?" : ollamaRunning ? "Ollama: running" : "Ollama: off", tone: ollamaRunning ? "good" : ollamaRunning === false ? "bad" : "muted" },
          { label: (devSnap?.runningCount || 0) > 0 ? `DevEngine: running (${devSnap?.runningCount || 0})` : "DevEngine: idle", tone: (devSnap?.runningCount || 0) > 0 ? "warn" : "muted" },
        ]}
        rightSlot={
          <ActionMenu
            items={[
              { label: "Open DevEngine", onClick: () => onNavigate?.("DevEngine") },
              { label: "Open Calendar", onClick: () => onNavigate?.("Calendar") },
              { label: "Pick Project", onClick: () => pickTargetProject(), disabled: !desktop },
              { label: "Refresh Dev Snapshot", onClick: () => refreshDevSnapshot(), disabled: !desktop },
              { label: checking ? "Checking Ollama…" : "Check Ollama", onClick: () => checkOllama(), disabled: !desktop || checking },
              { label: "Reset chat", onClick: () => resetChat(), tone: "danger" },
            ]}
          />
        }
      />

      <div className="creativeHeroBand homieHeroBand">
        <div className="creativeHeroCard">
          <div className="small shellEyebrow">WORLD / HOMIE</div>
          <div className="creativeHeroTitle">Homie Command Deck</div>
          <div className="creativeHeroSub">Your built-in dev buddy, local AI helper, and calm fix-it command station.</div>
        </div>
        <div className="creativeMetricStrip">
          <div className="creativeMetricCard"><div className="small shellEyebrow">MODE</div><div className="h">{desktop ? "Desktop" : "Web"}</div></div>
          <div className="creativeMetricCard"><div className="small shellEyebrow">OLLAMA</div><div className="h">{ollamaRunning === null ? "?" : ollamaRunning ? "Running" : "Offline"}</div></div>
          <div className="creativeMetricCard"><div className="small shellEyebrow">RUNS</div><div className="h">{devSnap?.runningCount || 0}</div></div>
          <div className="creativeMetricCard"><div className="small shellEyebrow">TARGET</div><div className="h">{targetProject ? "Linked" : "Unset"}</div></div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 10 }}>
        <button className={"tabBtn " + (tab === "ai" ? "active" : "")} onClick={() => setTab("ai")}>AI</button>
        <button className={"tabBtn " + (tab === "guide" ? "active" : "")} onClick={() => setTab("guide")}>Guide</button>
        <button className="tabBtn" onClick={() => onOpenHowTo?.()} title="How to Use (F1)">ℹ</button>
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
                <button className="tabBtn active" onClick={() => onNavigate?.("DevEngine")}>DevEngine</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Homie AI Status</div>
                <div className="small">Uses local Ollama on 127.0.0.1 (no cloud required)</div>
              </div>
              <div className="row">
                <span className={"badge " + (ollamaRunning ? "good" : ollamaRunning === false ? "bad" : "")}>{ollamaRunning === null ? "Unknown" : ollamaRunning ? "Ollama Running" : "Not Running"}</span>
                <button onClick={checkOllama} disabled={!desktop || checking}>{checking ? "Checking…" : "Check Ollama"}</button>
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
                Detected models: {ollamaModels.slice(0, 6).join(", ")}{ollamaModels.length > 6 ? "…" : ""}
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
            <div className="row">
              <div style={{ flex: 1 }}>
                <div className="small">Model</div>
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="llama3.1:8b" />
              </div>
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
              <div style={{ width: 220 }}>
                <div className="small">Context</div>
                <select value={includeContext ? "on" : "off"} onChange={(e) => setIncludeContext(e.target.value === "on")}> 
                  <option value="on">Include panel/host</option>
                  <option value="off">No context</option>
                </select>
              </div>
            </div>
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