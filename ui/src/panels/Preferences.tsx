import React, { useEffect, useMemo, useState } from "react";
import { pushNotif } from "../lib/notifs";
import { DEFAULT_PREFS, loadPrefs, type Prefs, savePrefs } from "../lib/prefs";
import { oddApi } from "../lib/odd";
import { installUpgradePack, isUpgradePackInstalled } from "../lib/plugins";
import { getVoiceEngineBadges, loadVoiceEngineSnapshot, summarizeVoiceEngine, type VoiceEngineSnapshot } from "../lib/voice";
import {
  CONNECTION_SERVICES,
  buildConnectionsMarkdown,
  buildConnectionsSummary,
  loadConnections,
  maskSecret,
  saveConnections,
  updateConnectionValues,
  type SavedConnections,
} from "../lib/connectionsCenter";

function summarizeBridgeHealth(snapshot: VoiceEngineSnapshot, fallbackUrl: string) {
  const message = snapshot.message || "";
  const lower = message.toLowerCase();
  if (snapshot.externalState === "ready") {
    return {
      label: "Reachable",
      tone: "good",
      detail: `Bridge ready at ${snapshot.externalBaseUrl || fallbackUrl}.`,
      next: "You can stay in Hybrid or switch to strict External/local HTTP now.",
    } as const;
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return {
      label: "Timeout",
      tone: "warn",
      detail: message || `Bridge timed out at ${snapshot.externalBaseUrl || fallbackUrl}.`,
      next: "Wait for the model to finish loading, then probe again.",
    } as const;
  }
  if (lower.includes("invalid json") || lower.includes("unexpected token") || lower.includes("bad response") || lower.includes("missing route") || lower.includes("/health")) {
    return {
      label: "Bad response",
      tone: "warn",
      detail: message || "Bridge answered, but the response was not what OddEngine expected.",
      next: "Check the bridge guide and confirm /health and /transcribe are available.",
    } as const;
  }
  if (
    snapshot.externalState === "disabled" ||
    lower.includes("cloud mode") ||
    lower.includes("not active yet") ||
    lower.includes("unreachable") ||
    lower.includes("did not answer") ||
    lower.includes("not running") ||
    lower.includes("fetch failed") ||
    lower.includes("refused")
  ) {
    return {
      label: "Not running",
      tone: snapshot.externalState === "disabled" ? "" : "warn",
      detail:
        snapshot.externalState === "disabled"
          ? "Bridge is idle because Homie is not using the external lane yet."
          : message || `Bridge is not answering at ${snapshot.externalBaseUrl || fallbackUrl}.`,
      next: "Start the local bridge, then use Save + probe bridge.",
    } as const;
  }
  return {
    label: snapshot.externalState === "degraded" ? "Degraded" : "Waiting",
    tone: snapshot.externalState === "degraded" ? "warn" : "",
    detail: message || "Probe the bridge to get the latest health result.",
    next: "Hybrid is the safest mode while you are still testing.",
  } as const;
}

function fieldStyleWide() {
  return { gridColumn: "1 / -1" } as React.CSSProperties;
}

function sectionGrid(columns: 2 | 3 = 2): React.CSSProperties {
  return {
    display: "grid",
    gap: 12,
    gridTemplateColumns: columns === 3 ? "repeat(auto-fit, minmax(220px, 1fr))" : "repeat(auto-fit, minmax(280px, 1fr))",
    alignItems: "start",
  };
}

function statusBadge(tone?: string) {
  return `badge ${tone || ""}`.trim();
}

export default function Preferences() {
  const api = oddApi();
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [connections, setConnections] = useState<SavedConnections>(() => loadConnections());
  const [selectedServiceId, setSelectedServiceId] = useState<string>(CONNECTION_SERVICES[0]?.id || "studio");
  const [showSecrets, setShowSecrets] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newTier, setNewTier] = useState("");

  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceEngineSnapshot>(() => loadVoiceEngineSnapshot());
  const [bridgeDir, setBridgeDir] = useState("voice_bridge");
  const [bridgeReadmePath, setBridgeReadmePath] = useState("voice_bridge/README.md");
  const [bridgeRunner, setBridgeRunner] = useState<"py" | "python">("py");
  const [bridgeStatus, setBridgeStatus] = useState("Waiting for bridge setup.");
  const [bridgeRunId, setBridgeRunId] = useState("");
  const [bridgeLog, setBridgeLog] = useState<string[]>([]);
  const [bridgeBusy, setBridgeBusy] = useState<"idle" | "saving" | "installing" | "starting" | "probing" | "opening">("idle");

  const selectedService = CONNECTION_SERVICES.find((service) => service.id === selectedServiceId) || CONNECTION_SERVICES[0];
  const connectionSummary = useMemo(() => buildConnectionsSummary(connections), [connections]);
  const voiceSummary = summarizeVoiceEngine(voiceSnapshot);
  const bridgeHealth = summarizeBridgeHealth(voiceSnapshot, prefs.ai.homieExternalVoiceBaseUrl);

  function applyPrefs(nextPrefs: Prefs, options?: { silent?: boolean }) {
    savePrefs(nextPrefs);
    setPrefs(nextPrefs);
    if (!options?.silent) {
      pushNotif({ kind: "Workspace", title: "Saved", detail: "Preferences saved locally." });
    }
  }

  function saveAll() {
    saveConnections(connections);
    applyPrefs(prefs, { silent: true });
    pushNotif({ kind: "Workspace", title: "Saved", detail: "Preferences and connections saved locally." });
  }

  function resetPrefsOnly() {
    setPrefs(DEFAULT_PREFS);
    pushNotif({ kind: "Workspace", title: "Reset", detail: "Reset to defaults (not saved yet)." });
  }

  function launchCompanion() {
    if (!api.openWindow) return Promise.resolve();
    return api.openWindow({
      title: "Homie Buddy",
      query: { buddy: "1" },
      width: 420,
      height: 720,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      skipTaskbar: false,
      resizable: true,
    });
  }

  function updateAi(nextAi: Prefs["ai"] | ((current: Prefs["ai"]) => Prefs["ai"])) {
    setPrefs((current) => {
      const resolvedAi = typeof nextAi === "function" ? nextAi(current.ai) : nextAi;
      const nextPrefs = { ...current, ai: resolvedAi };
      savePrefs(nextPrefs);
      return nextPrefs;
    });
  }

  function sanitizePath(base: string) {
    return base.replace(/[\\/]+$/, "");
  }

  function launchCommandFor(runner: "py" | "python") {
    return runner === "py"
      ? "py -3 -m uvicorn faster_whisper_bridge_example:app --host 127.0.0.1 --port 8765"
      : "python -m uvicorn faster_whisper_bridge_example:app --host 127.0.0.1 --port 8765";
  }

  function installCommandFor(runner: "py" | "python") {
    return runner === "py"
      ? "py -3 -m pip install -r requirements.txt"
      : "python -m pip install -r requirements.txt";
  }

  function classifyBridgeProbeError(raw: string) {
    const lower = String(raw || "").toLowerCase();
    if (!raw) return `Bridge did not answer at ${prefs.ai.homieExternalVoiceBaseUrl}.`;
    if (lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("failed to fetch")) {
      return `Bridge unreachable at ${prefs.ai.homieExternalVoiceBaseUrl}. Start the local bridge, then probe again.`;
    }
    if (lower.includes("timeout") || lower.includes("timed out")) {
      return `Bridge timed out at ${prefs.ai.homieExternalVoiceBaseUrl}. It may still be loading the speech model.`;
    }
    if (lower.includes("404") || lower.includes("not found")) {
      return "Bridge answered, but the expected /health route was missing.";
    }
    return raw;
  }

  async function resolveBridgePaths() {
    try {
      const info = await api.getSystemInfo?.();
      const roots = [info?.cwd, info?.appPath].filter(Boolean) as string[];
      const preferredRoot = roots[0] || "";
      const normalized = preferredRoot ? `${sanitizePath(preferredRoot)}/voice_bridge` : "voice_bridge";
      setBridgeDir(normalized);
      setBridgeReadmePath(`${normalized}/README.md`);
    } catch {
      setBridgeDir("voice_bridge");
      setBridgeReadmePath("voice_bridge/README.md");
    }
  }

  useEffect(() => {
    void resolveBridgePaths();
  }, []);

  useEffect(() => {
    const refreshVoice = () => setVoiceSnapshot(loadVoiceEngineSnapshot());
    window.addEventListener("oddengine:voice-engine-changed", refreshVoice as EventListener);
    window.addEventListener("storage", refreshVoice as EventListener);
    return () => {
      window.removeEventListener("oddengine:voice-engine-changed", refreshVoice as EventListener);
      window.removeEventListener("storage", refreshVoice as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!api.onRunOutput) return;
    const off = api.onRunOutput((msg: any) => {
      if (!bridgeRunId || String(msg?.id || "") !== bridgeRunId) return;
      if (msg?.type === "stdout" || msg?.type === "stderr") {
        setBridgeLog((current) => [...current.slice(-14), String(msg.line || "").trim()].filter(Boolean));
      }
      if (msg?.type === "exit") {
        setBridgeBusy("idle");
        const code = Number(msg.code ?? -1);
        setBridgeStatus(code === 0 ? "Bridge command exited cleanly." : `Bridge command exited with code ${code}. Check the log below.`);
      }
    });
    return off;
  }, [api, bridgeRunId]);

  async function openBridgeFolder() {
    setBridgeBusy("opening");
    try {
      const result = await api.openPath?.(bridgeDir as any);
      setBridgeStatus(result?.ok === false ? result?.error || `Could not open ${bridgeDir}.` : `Opened ${bridgeDir}.`);
    } finally {
      setBridgeBusy("idle");
    }
  }

  async function openBridgeReadme() {
    setBridgeBusy("opening");
    try {
      const result = await api.openPath?.(bridgeReadmePath as any);
      setBridgeStatus(result?.ok === false ? result?.error || "Could not open the bridge README." : "Opened the bridge README.");
    } finally {
      setBridgeBusy("idle");
    }
  }

  async function copyBridgeLaunchCommand() {
    const cmd = launchCommandFor(bridgeRunner);
    try {
      await navigator.clipboard.writeText(cmd);
      setBridgeStatus(`Copied launch command: ${cmd}`);
      pushNotif({ kind: "Workspace", title: "Copied", detail: "Bridge launch command copied to clipboard." });
    } catch {
      setBridgeStatus(`Copy failed. Manual command: ${cmd}`);
    }
  }

  async function runBridgeTask(kind: "installing" | "starting", cmd: string, args: string[], successMessage: string) {
    setBridgeBusy(kind);
    setBridgeLog([]);
    const result = await api.run?.({ cmd, args, cwd: bridgeDir } as any);
    if (!result?.ok) {
      setBridgeBusy("idle");
      setBridgeStatus(result?.error || `Could not start the ${kind === "installing" ? "dependency install" : "bridge process"}.`);
      return false;
    }
    setBridgeRunId(String(result.id || ""));
    setBridgeStatus(successMessage);
    pushNotif({ kind: "Workspace", title: kind === "installing" ? "Bridge deps" : "Bridge launch", detail: successMessage });
    return true;
  }

  async function installBridgeDeps() {
    applyPrefs(prefs, { silent: true });
    const cmd = bridgeRunner === "py" ? "py" : "python";
    const args = bridgeRunner === "py"
      ? ["-3", "-m", "pip", "install", "-r", "requirements.txt"]
      : ["-m", "pip", "install", "-r", "requirements.txt"];
    await runBridgeTask("installing", cmd, args, `Started bridge dependency install with ${installCommandFor(bridgeRunner)}.`);
  }

  async function startBridgeProcess() {
    applyPrefs(prefs, { silent: true });
    const cmd = bridgeRunner === "py" ? "py" : "python";
    const args = bridgeRunner === "py"
      ? ["-3", "-m", "uvicorn", "faster_whisper_bridge_example:app", "--host", "127.0.0.1", "--port", "8765"]
      : ["-m", "uvicorn", "faster_whisper_bridge_example:app", "--host", "127.0.0.1", "--port", "8765"];
    const ok = await runBridgeTask("starting", cmd, args, `Started the bridge with ${launchCommandFor(bridgeRunner)}.`);
    if (ok) {
      window.setTimeout(() => {
        void probeBridgeNow();
      }, 2200);
    }
  }

  async function probeBridgeNow() {
    applyPrefs(prefs, { silent: true });
    setBridgeBusy("probing");
    try {
      const result = await api.voiceBridgeProbe?.({ baseUrl: prefs.ai.homieExternalVoiceBaseUrl, timeoutMs: Math.min(prefs.ai.homieExternalVoiceTimeoutMs || 20000, 8000) } as any);
      if (result?.ok) {
        setBridgeStatus(result.detail || `Bridge ready at ${prefs.ai.homieExternalVoiceBaseUrl}.`);
        pushNotif({ kind: "Workspace", title: "Voice bridge ready", detail: result.detail || "External/local bridge responded." });
      } else {
        setBridgeStatus(classifyBridgeProbeError(result?.error || ""));
      }
    } finally {
      setBridgeBusy("idle");
    }
  }

  function clearLocalStorageByPrefix(prefixes: string[]) {
    let cleared = 0;
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i) || "";
        if (prefixes.some((prefix) => key.startsWith(prefix))) {
          localStorage.removeItem(key);
          cleared++;
        }
      }
    } catch {
      // ignore
    }
    return cleared;
  }

  function resetCardLayouts() {
    const ok = window.confirm("Reset all saved card layouts/sizes? (Your data stays.)");
    if (!ok) return;
    const prefixes = [
      "oddengine:godcard:",
      "oddengine:godlayout:",
      "oddengine:godpresets:",
      "oddengine:godtemplate:",
      "oddengine:cardframe:",
      "oddengine:godglobalsets:",
    ];
    const cleared = clearLocalStorageByPrefix(prefixes);
    pushNotif({ kind: "Workspace", title: "Layout reset", detail: `Cleared ${cleared} saved layout keys.` });
    window.location.reload();
  }

  async function resetPopoutBounds() {
    const ok = window.confirm("Reset saved popout window positions/sizes? (Desktop only)");
    if (!ok) return;
    if (!api.resetWindowBounds) {
      window.alert("Popout reset is only available in Desktop mode.");
      return;
    }
    const res = await api.resetWindowBounds();
    if (res?.ok) {
      pushNotif({ kind: "Workspace", title: "Window bounds reset", detail: "Cleared saved popout bounds. New windows will open fresh." });
    } else {
      window.alert(res?.error || "Could not reset window bounds.");
    }
  }

  async function resetAllLayouts() {
    const ok = window.confirm("Reset ALL layout state (cards + popout bounds)?");
    if (!ok) return;
    const prefixes = [
      "oddengine:godcard:",
      "oddengine:godlayout:",
      "oddengine:godpresets:",
      "oddengine:godtemplate:",
      "oddengine:cardframe:",
      "oddengine:godglobalsets:",
    ];
    const cleared = clearLocalStorageByPrefix(prefixes);
    try {
      if (api.resetWindowBounds) await api.resetWindowBounds();
    } catch {
      // ignore
    }
    pushNotif({ kind: "Workspace", title: "Full layout reset", detail: `Cleared ${cleared} layout keys${api.resetWindowBounds ? " and popout bounds" : ""}.` });
    window.location.reload();
  }

  function addCategory() {
    const value = newCat.trim();
    if (!value || prefs.cannabis.categories.includes(value)) return;
    setPrefs((current) => ({
      ...current,
      cannabis: { ...current.cannabis, categories: [...current.cannabis.categories, value] },
    }));
    setNewCat("");
  }

  function addTier() {
    const value = newTier.trim();
    if (!value || prefs.cannabis.priceTiers.includes(value)) return;
    setPrefs((current) => ({
      ...current,
      cannabis: { ...current.cannabis, priceTiers: [...current.cannabis.priceTiers, value] },
    }));
    setNewTier("");
  }

  async function copyConnectionsSummary() {
    try {
      await navigator.clipboard.writeText(buildConnectionsMarkdown(connections));
      pushNotif({ kind: "Workspace", title: "Copied", detail: "Connections summary copied to clipboard." });
    } catch {
      pushNotif({ kind: "Workspace", title: "Copy failed", detail: "Could not copy the connections summary." });
    }
  }

  const selectedValues = connections[selectedService.id] || {};

  return (
    <div className="page" style={{ display: "grid", gap: 16 }}>
      <div className="card productivityHeroCard">
        <div className="productivityHeroBar">
          <div>
            <div className="small shellEyebrow">PREFERENCES / SETUP HUB</div>
            <div className="productivityHeroTitle">Connections, defaults, and OS behavior</div>
            <div className="small productivityHeroSub">
              Save your defaults once, keep your bridges healthy, and manage usernames, passwords, API keys, and provider settings from one clean place.
            </div>
          </div>
          <div className="row wrap productivityHeroBadges" style={{ justifyContent: "flex-end", gap: 8 }}>
            <span className={statusBadge(bridgeHealth.tone)}>{bridgeHealth.label}</span>
            <span className="badge">Voice {voiceSummary.headline}</span>
            <span className="badge">Connections {connectionSummary.readiness}%</span>
            <span className="badge">Start {prefs.desktop.startPanel || "OddBrain"}</span>
          </div>
        </div>

        <div className="productivityMetricsRow">
          <div className="productivityMetricCard">
            <div className="small shellEyebrow">CONNECTIONS</div>
            <div className="h mt-1">{connectionSummary.filledServices}/{connectionSummary.totalServices}</div>
            <div className="small mt-2">Service groups with at least one saved input.</div>
          </div>
          <div className="productivityMetricCard">
            <div className="small shellEyebrow">BRIDGE</div>
            <div className="h mt-1">{bridgeHealth.label}</div>
            <div className="small mt-2">{bridgeHealth.next}</div>
          </div>
          <div className="productivityMetricCard">
            <div className="small shellEyebrow">VOICE MODE</div>
            <div className="h mt-1">{prefs.ai.homieVoiceEngineMode}</div>
            <div className="small mt-2">{voiceSummary.subline}</div>
          </div>
          <div className="productivityMetricCard">
            <div className="small shellEyebrow">GRID</div>
            <div className="h mt-1">{prefs.fairlygod.gridSize}px</div>
            <div className="small mt-2">Workspace snap sizing</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row wrap" style={{ justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div className="h">Save locally</div>
            <div className="sub">Preferences and secrets stay local. Do not commit real credentials to GitHub.</div>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="tabBtn" onClick={resetPrefsOnly}>Reset defaults</button>
            <button className="tabBtn" onClick={() => setConnections({})}>Clear connections (not saved)</button>
            <button className="primary" onClick={saveAll}>Save all</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h">Connections & Secrets Center</div>
        <div className="sub">This is the proper OS-level place for usernames, passwords, API keys, tokens, webhook URLs, and provider setup.</div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "280px minmax(0, 1fr)", alignItems: "start", marginTop: 12 }}>
          <div className="card softCard" style={{ display: "grid", gap: 10 }}>
            <div className="small shellEyebrow">SERVICES</div>
            {connectionSummary.services.map((service) => (
              <button
                key={service.id}
                className="card softCard"
                style={{
                  textAlign: "left",
                  padding: 12,
                  border: selectedServiceId === service.id ? "1px solid rgba(255,255,255,0.28)" : "1px solid transparent",
                  display: "grid",
                  gap: 6,
                }}
                onClick={() => setSelectedServiceId(service.id)}
              >
                <div className="small shellEyebrow">{service.title}</div>
                <div className="small">{service.filled}/{service.total} fields</div>
                <div className="small">{service.sub}</div>
              </button>
            ))}
          </div>

          <div className="card softCard">
            <div className="row wrap" style={{ justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div className="small shellEyebrow">{selectedService.title.toUpperCase()}</div>
                <div className="sub mt-2">{selectedService.sub}</div>
              </div>
              <div className="row wrap" style={{ gap: 8 }}>
                <button className="tabBtn" onClick={() => setShowSecrets((value) => !value)}>
                  {showSecrets ? "Hide secrets" : "Show secrets"}
                </button>
                <button className="tabBtn active" onClick={() => void copyConnectionsSummary()}>
                  Copy markdown summary
                </button>
              </div>
            </div>

            <div style={{ ...sectionGrid(2), marginTop: 12 }}>
              {selectedService.fields.map((field) => {
                const value = String(selectedValues[field.key] || "");
                const displayValue = field.type === "password" ? maskSecret(value, showSecrets) : value;
                const inputType = field.type === "password" ? (showSecrets ? "text" : "password") : field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "number" ? "number" : "text";

                return (
                  <label key={field.key} className="field">
                    {field.label}
                    {field.type === "textarea" ? (
                      <textarea
                        className="input mt-2"
                        rows={4}
                        value={value}
                        onChange={(e) => setConnections((current) => updateConnectionValues(current, selectedService.id, { [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                      />
                    ) : (
                      <input
                        className="input mt-2"
                        type={inputType}
                        value={field.type === "password" && !showSecrets ? displayValue : value}
                        onChange={(e) => setConnections((current) => updateConnectionValues(current, selectedService.id, { [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                      />
                    )}
                    {field.help ? <div className="small mt-2">{field.help}</div> : null}
                  </label>
                );
              })}
            </div>

            <div className="note mt-4">
              These values are intended for local use. Keep real secrets out of repo files and GitHub commits.
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h">Layout & Windows</div>
        <div className="sub">Clean + reliable sizing. Reset if anything feels off in cards, popouts, or saved bounds.</div>
        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
          <button className="tabBtn" onClick={resetCardLayouts}>Reset card layouts</button>
          <button className="tabBtn" disabled={!api.resetWindowBounds} onClick={() => void resetPopoutBounds()}>Reset popout bounds</button>
          <button className="tabBtn active" onClick={() => void resetAllLayouts()}>Reset ALL</button>
        </div>
      </div>

      <div className="card">
        <div className="h">Workspace defaults</div>
        <div style={sectionGrid(3)}>
          <label className="field">Start panel
            <input value={prefs.desktop.startPanel} onChange={(e) => setPrefs((p) => ({ ...p, desktop: { ...p.desktop, startPanel: e.target.value } }))} />
          </label>
          <label className="field">Auto-run safe fixes
            <select value={String(prefs.desktop.autoRunSafeFixes)} onChange={(e) => setPrefs((p) => ({ ...p, desktop: { ...p.desktop, autoRunSafeFixes: e.target.value === "true" } }))}>
              <option value="false">Off</option>
              <option value="true">On</option>
            </select>
          </label>
          <label className="field">Grid size
            <input type="number" min={8} max={64} step={1} value={prefs.fairlygod.gridSize} onChange={(e) => setPrefs((p) => ({ ...p, fairlygod: { ...p.fairlygod, gridSize: Math.max(8, Math.min(64, Number(e.target.value) || 16)) } }))} />
          </label>
          <label className="field">Snap enabled
            <select value={String(prefs.fairlygod.snapEnabled)} onChange={(e) => setPrefs((p) => ({ ...p, fairlygod: { ...p.fairlygod, snapEnabled: e.target.value === "true" } }))}>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>
          <label className="field">Routine mode
            <select value={prefs.fairlygod.defaultRoutineMode} onChange={(e) => setPrefs((p) => ({ ...p, fairlygod: { ...p.fairlygod, defaultRoutineMode: e.target.value as any } }))}>
              <option value="windows">Windows</option>
              <option value="main">Main shell</option>
            </select>
          </label>
          <label className="field">Tile preset
            <select value={prefs.fairlygod.defaultTilePreset} onChange={(e) => setPrefs((p) => ({ ...p, fairlygod: { ...p.fairlygod, defaultTilePreset: e.target.value as any } }))}>
              <option value="single">Single monitor</option>
              <option value="trader-main-3mon">Trader main + 3 monitors</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="h">Panel defaults</div>
        <div style={sectionGrid(2)}>
          <label className="field">Grow name
            <input value={prefs.grow.name} onChange={(e) => setPrefs((p) => ({ ...p, grow: { ...p.grow, name: e.target.value } }))} />
          </label>
          <label className="field">Grow size
            <input value={prefs.grow.size} onChange={(e) => setPrefs((p) => ({ ...p, grow: { ...p.grow, size: e.target.value } }))} />
          </label>
          <label className="field">Cameras grid
            <select value={prefs.cameras.grid} onChange={(e) => setPrefs((p) => ({ ...p, cameras: { ...p.cameras, grid: e.target.value as any } }))}>
              <option value="2x2">2x2</option>
              <option value="3x2">3x2</option>
              <option value="3x3">3x3</option>
              <option value="4x3">4x3</option>
              <option value="6x2">6x2</option>
            </select>
          </label>
          <label className="field">Cameras live previews
            <select value={String(prefs.cameras.livePreviews)} onChange={(e) => setPrefs((p) => ({ ...p, cameras: { ...p.cameras, livePreviews: e.target.value === "true" } }))}>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>
          <label className="field">ZBD wallet
            <input value={prefs.zbd.walletAddress} onChange={(e) => setPrefs((p) => ({ ...p, zbd: { ...p.zbd, walletAddress: e.target.value } }))} />
          </label>
          <label className="field">Preferred emulator
            <select value={prefs.zbd.preferredEmulator} onChange={(e) => setPrefs((p) => ({ ...p, zbd: { ...p.zbd, preferredEmulator: e.target.value as any } }))}>
              <option value="auto">Auto-detect</option>
              <option value="bluestacks">BlueStacks</option>
              <option value="ldplayer">LDPlayer</option>
              <option value="nox">Nox</option>
              <option value="memu">MEmu</option>
              <option value="androidstudio">Android Studio</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <div className="h">Cannabis defaults</div>
        <div className="sub">Defaults for ZIP + filters used in the Cannabis panel.</div>
        <div style={sectionGrid(2)}>
          <label className="field">Default ZIP
            <input value={prefs.cannabis.zip} onChange={(e) => setPrefs((p) => ({ ...p, cannabis: { ...p.cannabis, zip: e.target.value } }))} placeholder="89101" />
          </label>
          <label className="field">Min deal score
            <input type="number" value={prefs.cannabis.minDealScore} onChange={(e) => setPrefs((p) => ({ ...p, cannabis: { ...p.cannabis, minDealScore: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } }))} />
          </label>
        </div>

        <div style={{ ...sectionGrid(2), marginTop: 12 }}>
          <div className="card softCard">
            <div className="small shellEyebrow">CATEGORIES</div>
            <div className="row wrap mt-3" style={{ gap: 8 }}>
              {prefs.cannabis.categories.map((category) => (
                <button key={category} className="tabBtn active" onClick={() => setPrefs((p) => ({ ...p, cannabis: { ...p.cannabis, categories: p.cannabis.categories.filter((value) => value !== category) } }))}>
                  {category} ✕
                </button>
              ))}
            </div>
            <div className="row wrap mt-3" style={{ gap: 8 }}>
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Add category" />
              <button onClick={addCategory}>Add</button>
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">PRICE TIERS</div>
            <div className="row wrap mt-3" style={{ gap: 8 }}>
              {prefs.cannabis.priceTiers.map((tier) => (
                <button key={tier} className="tabBtn active" onClick={() => setPrefs((p) => ({ ...p, cannabis: { ...p.cannabis, priceTiers: p.cannabis.priceTiers.filter((value) => value !== tier) } }))}>
                  {tier} ✕
                </button>
              ))}
            </div>
            <div className="row wrap mt-3" style={{ gap: 8 }}>
              <input value={newTier} onChange={(e) => setNewTier(e.target.value)} placeholder="Add tier" />
              <button onClick={addTier}>Add</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h">Voice engine status</div>
        <div className="sub">Live status from Homie so you can see whether cloud speech, push-to-talk, and typed commands are ready before you talk.</div>
        <div className="assistantChipWrap" style={{ marginTop: 12 }}>
          {getVoiceEngineBadges(voiceSnapshot).map((badge) => (
            <span key={badge.label} className={statusBadge(badge.tone)}>{badge.label}</span>
          ))}
        </div>
        <div className="small" style={{ marginTop: 10 }}>{voiceSummary.subline}</div>
        <div className="small" style={{ marginTop: 6 }}>
          Mic permission: <b>{voiceSnapshot.permissionState}</b> • Audio inputs: <b>{voiceSnapshot.audioInputCount}</b> • Updated: <b>{voiceSnapshot.updatedAt ? new Date(voiceSnapshot.updatedAt).toLocaleTimeString() : "not yet"}</b>
        </div>
      </div>

      <div className="card">
        <div className="h">External Bridge Setup Assistant</div>
        <div className="sub">Keep voice setup practical: save the mode, install the bridge, start it, and probe it from one place.</div>

        <div style={{ ...sectionGrid(2), marginTop: 12 }}>
          <div className="card softCard">
            <div className="small shellEyebrow">VOICE SETUP</div>
            <div className="small mt-3"><b>Now:</b> {bridgeHealth.detail}</div>
            <div className="small mt-2"><b>Next:</b> {bridgeHealth.next}</div>
            <div className="row wrap mt-3" style={{ gap: 8 }}>
              <button className="tabBtn active" onClick={() => applyPrefs({ ...prefs, ai: { ...prefs.ai, homieVoiceEngineMode: "hybrid" } }, { silent: true })}>Use Hybrid</button>
              <button className="tabBtn" onClick={() => void installBridgeDeps()}>Install deps</button>
              <button className="tabBtn active" onClick={() => void startBridgeProcess()}>Start bridge</button>
              <button className="tabBtn" onClick={() => void probeBridgeNow()}>Save + probe</button>
            </div>
          </div>

          <div className="card softCard">
            <div className="small shellEyebrow">BRIDGE HELPER</div>
            <div className="small mt-3">Runner: <b>{bridgeRunner}</b></div>
            <div className="small mt-2">Install: <b>{installCommandFor(bridgeRunner)}</b></div>
            <div className="small mt-2">Launch: <b>{launchCommandFor(bridgeRunner)}</b></div>
            <div className="row wrap mt-3" style={{ gap: 8 }}>
              <button className="tabBtn" onClick={() => setBridgeRunner("py")}>Use py -3</button>
              <button className="tabBtn" onClick={() => setBridgeRunner("python")}>Use python</button>
              <button className="tabBtn" onClick={() => void copyBridgeLaunchCommand()}>Copy command</button>
              <button className="tabBtn" onClick={() => void openBridgeFolder()}>Open bridge folder</button>
              <button className="tabBtn" onClick={() => void openBridgeReadme()}>Open bridge guide</button>
            </div>
          </div>
        </div>

        <div className="card softCard mt-4">
          <div className="small shellEyebrow">BRIDGE STATUS</div>
          <div className="small mt-3">{bridgeStatus}</div>
          <div className="small mt-2">URL: <b>{prefs.ai.homieExternalVoiceBaseUrl}</b></div>
          {!!bridgeLog.length && (
            <div className="timelineCard" style={{ marginTop: 10, maxHeight: 140, overflow: "auto" }}>
              {bridgeLog.map((line, index) => (
                <div key={`${index}-${line.slice(0, 18)}`} className="small" style={{ marginTop: index ? 6 : 0 }}>{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="h">AI assistant defaults</div>
        <div style={sectionGrid(2)}>
          <label className="field">Tone
            <select value={prefs.ai.tone} onChange={(e) => updateAi((p) => ({ ...p, tone: e.target.value as any }))}>
              <option value="coach">Coach</option>
              <option value="builder">Builder</option>
              <option value="operator">Operator</option>
            </select>
          </label>
          <label className="field">Verbosity
            <select value={prefs.ai.verbosity} onChange={(e) => updateAi((p) => ({ ...p, verbosity: e.target.value as any }))}>
              <option value="tight">Tight</option>
              <option value="balanced">Balanced</option>
              <option value="deep">Deep</option>
            </select>
          </label>
          <label className="field">Auto-pin assistant notes
            <select value={String(prefs.ai.autoPinNotes)} onChange={(e) => updateAi((p) => ({ ...p, autoPinNotes: e.target.value === "true" }))}>
              <option value="false">Off</option>
              <option value="true">On</option>
            </select>
          </label>
          <label className="field">Assistant docks open by default
            <select value={String(prefs.ai.defaultDockOpen)} onChange={(e) => updateAi((p) => ({ ...p, defaultDockOpen: e.target.value === "true" }))}>
              <option value="true">Open</option>
              <option value="false">Collapsed</option>
            </select>
          </label>
          <label className="field">Homie voice
            <select value={String(prefs.ai.homieVoiceEnabled)} onChange={(e) => updateAi((p) => ({ ...p, homieVoiceEnabled: e.target.value === "true" }))}>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>
          <label className="field">Voice profile
            <select value={prefs.ai.homieVoiceProfile} onChange={(e) => updateAi((p) => ({ ...p, homieVoiceProfile: e.target.value as any }))}>
              <option value="auto">Auto</option>
              <option value="warm">Warm</option>
              <option value="clear">Clear</option>
              <option value="bright">Bright</option>
            </select>
          </label>
          <label className="field">Voice engine mode
            <select value={prefs.ai.homieVoiceEngineMode} onChange={(e) => updateAi((p) => ({ ...p, homieVoiceEngineMode: e.target.value as any }))}>
              <option value="cloud">Cloud speech</option>
              <option value="external-http">External/local HTTP</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          <label className="field">External/local bridge URL
            <input value={prefs.ai.homieExternalVoiceBaseUrl} onChange={(e) => updateAi((p) => ({ ...p, homieExternalVoiceBaseUrl: e.target.value }))} placeholder="http://127.0.0.1:8765" />
          </label>
          <label className="field">Bridge timeout (ms)
            <input type="number" value={prefs.ai.homieExternalVoiceTimeoutMs} onChange={(e) => updateAi((p) => ({ ...p, homieExternalVoiceTimeoutMs: Math.max(1000, Number(e.target.value) || 8000) }))} />
          </label>
          <label className="field">Companion window
            <select value={String(prefs.ai.homieCompanionWindow)} onChange={(e) => updateAi((p) => ({ ...p, homieCompanionWindow: e.target.value === "true" }))}>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>
          <label className="field">Avatar skin
            <select value={prefs.ai.homieAvatarSkin} onChange={(e) => updateAi((p) => ({ ...p, homieAvatarSkin: e.target.value as any }))}>
              <option value="classic">Classic</option>
              <option value="lil-homie">Lil Homie</option>
              <option value="memoji">Memoji</option>
            </select>
          </label>
          <div className="field" style={fieldStyleWide()}>
            <div className="row wrap" style={{ gap: 8 }}>
              <button className="tabBtn" onClick={() => void launchCompanion()}>Open Homie House</button>
              <button className="tabBtn" onClick={() => void installUpgradePack("homie-room-pack-cyber-noir" as any)}>Install Cyber Noir pack</button>
              <button className="tabBtn" onClick={() => void installUpgradePack("homie-room-pack-mission-ops" as any)}>Install Mission Ops pack</button>
            </div>
            <div className="small mt-2">
              Installed packs: Cyber Noir <b>{isUpgradePackInstalled("homie-room-pack-cyber-noir") ? "Yes" : "No"}</b> • Mission Ops <b>{isUpgradePackInstalled("homie-room-pack-mission-ops") ? "Yes" : "No"}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
