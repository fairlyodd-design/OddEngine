import React, { useEffect, useMemo, useState } from "react";
import { pushNotif } from "../lib/notifs";
import { DEFAULT_PREFS, loadPrefs, Prefs, savePrefs } from "../lib/prefs";
import { oddApi } from "../lib/odd";
import { installUpgradePack, isUpgradePackInstalled } from "../lib/plugins";
import { getVoiceEngineBadges, loadVoiceEngineSnapshot, summarizeVoiceEngine, type VoiceEngineSnapshot } from "../lib/voice";
import { HOMIE_PRESENCE_EVENT, enableHomieMissionControlBaseline, getHomieMissionReadiness, loadHomiePresence, patchHomiePresence } from "../lib/homiePresence";
import { HOMIE_WAKE_FLOW_EVENT, enableWakeConversationBaseline, getWakeConversationReadiness, loadHomieWakeFlow, markAssistantTurn, markUserTurn, markWakeHeard, patchHomieWakeFlow } from "../lib/homieWakeFlow";
import { HOMIE_COMPANION_EVENT, describeCompanion, loadHomieCompanion, patchHomieCompanion } from "../lib/homieCompanion";

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
  if (snapshot.externalState === "disabled" || lower.includes("cloud mode") || lower.includes("not active yet") || lower.includes("unreachable") || lower.includes("did not answer") || lower.includes("not running") || lower.includes("fetch failed") || lower.includes("refused")) {
    return {
      label: "Not running",
      tone: snapshot.externalState === "disabled" ? "" : "warn",
      detail: snapshot.externalState === "disabled"
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


export default function Preferences(){
  const api = oddApi();
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());

  const sections = useMemo(() => ([
    { id:"grow", title:"Grow", sub:"Defaults for tent/room" },
    { id:"cameras", title:"Cameras", sub:"Wall + preview defaults" },
    { id:"zbd", title:"ZBD / Crypto Games", sub:"Wallet + emulator preference" },
    { id:"desktop", title:"Desktop Mode", sub:"Start panel + safe fixes" },
    { id:"cannabis", title:"Cannabis", sub:"Zip + filters + deal scoring defaults" },
    { id:"ai", title:"AI Assistants", sub:"Shared Brain + dock defaults" },
  ]), []);

  const [newCat, setNewCat] = useState("");
  const [newTier, setNewTier] = useState("");
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceEngineSnapshot>(() => loadVoiceEngineSnapshot());
  const [bridgeDir, setBridgeDir] = useState("voice_bridge");
  const [bridgeReadmePath, setBridgeReadmePath] = useState("voice_bridge/README.md");
  const [bridgeRequirementsPath, setBridgeRequirementsPath] = useState("voice_bridge/requirements.txt");
  const [bridgeRunner, setBridgeRunner] = useState<"py" | "python">("py");
  const [bridgeStatus, setBridgeStatus] = useState("Waiting for bridge setup.");
  const [bridgeRunId, setBridgeRunId] = useState("");
  const [bridgeLog, setBridgeLog] = useState<string[]>([]);
  const [bridgeBusy, setBridgeBusy] = useState<"idle" | "saving" | "installing" | "starting" | "probing" | "opening">("idle");
  const [homieTick, setHomieTick] = useState(0);

  async function launchCompanion(){
    if (!api.openWindow) return;
    await api.openWindow({
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
  const refresh = () => setHomieTick((x) => x + 1);
  try {
    window.addEventListener(HOMIE_PRESENCE_EVENT as any, refresh);
    window.addEventListener(HOMIE_WAKE_FLOW_EVENT as any, refresh);
    window.addEventListener(HOMIE_COMPANION_EVENT as any, refresh);
    window.addEventListener("storage", refresh as EventListener);
  } catch {
    // ignore
  }
  return () => {
    try {
      window.removeEventListener(HOMIE_PRESENCE_EVENT as any, refresh);
      window.removeEventListener(HOMIE_WAKE_FLOW_EVENT as any, refresh);
      window.removeEventListener(HOMIE_COMPANION_EVENT as any, refresh);
      window.removeEventListener("storage", refresh as EventListener);
    } catch {
      // ignore
    }
  };
}, []);

  function applyPrefs(nextPrefs: Prefs, options?: { silent?: boolean; launchCompanion?: boolean }){
    savePrefs(nextPrefs);
    setPrefs(nextPrefs);
    if (!options?.silent) {
      pushNotif({ kind:"Workspace", title:"Saved", detail:"Preferences saved locally." });
    }
    if (options?.launchCompanion || nextPrefs.ai.homieCompanionWindow) {
      void launchCompanion();
    }
  }

  function save(){
    applyPrefs(prefs);
  }

  function updateAi(nextAi: Prefs["ai"] | ((current: Prefs["ai"]) => Prefs["ai"])){
    setPrefs((current) => {
      const resolvedAi = typeof nextAi === "function" ? (nextAi as (value: Prefs["ai"]) => Prefs["ai"])(current.ai) : nextAi;
      const nextPrefs = { ...current, ai: resolvedAi };
      savePrefs(nextPrefs);
      return nextPrefs;
    });
  }

  function sanitizePath(base: string) {
    return base.replace(/[\/]+$/, "");
  }

  function launchCommandFor(runner: "py" | "python") {
    return runner === "py"
      ? 'py -3 -m uvicorn faster_whisper_bridge_example:app --host 127.0.0.1 --port 8765'
      : 'python -m uvicorn faster_whisper_bridge_example:app --host 127.0.0.1 --port 8765';
  }

  function installCommandFor(runner: "py" | "python") {
    return runner === "py"
      ? 'py -3 -m pip install -r requirements.txt'
      : 'python -m pip install -r requirements.txt';
  }

  function classifyBridgeProbeError(raw: string) {
    const lower = String(raw || "").toLowerCase();
    if (!raw) return `Bridge did not answer at ${prefs.ai.homieExternalVoiceBaseUrl}.`;
    if (lower.includes('fetch failed') || lower.includes('econnrefused') || lower.includes('failed to fetch')) {
      return `Bridge unreachable at ${prefs.ai.homieExternalVoiceBaseUrl}. Start the local bridge, then probe again.`;
    }
    if (lower.includes('timeout') || lower.includes('timed out')) {
      return `Bridge timed out at ${prefs.ai.homieExternalVoiceBaseUrl}. It may still be loading the speech model.`;
    }
    if (lower.includes('404') || lower.includes('not found')) {
      return 'Bridge answered, but the expected /health route was missing.';
    }
    return raw;
  }

  async function resolveBridgePaths() {
    try {
      const info = await api.getSystemInfo?.();
      const roots = [info?.cwd, info?.appPath, window.location?.origin === 'null' ? '' : ''].filter(Boolean) as string[];
      const preferredRoot = roots[0] || '';
      const normalized = preferredRoot ? `${sanitizePath(preferredRoot)}/voice_bridge` : 'voice_bridge';
      setBridgeDir(normalized);
      setBridgeReadmePath(`${normalized}/README.md`);
      setBridgeRequirementsPath(`${normalized}/requirements.txt`);
    } catch {
      setBridgeDir('voice_bridge');
      setBridgeReadmePath('voice_bridge/README.md');
      setBridgeRequirementsPath('voice_bridge/requirements.txt');
    }
  }

  useEffect(() => {
    void resolveBridgePaths();
  }, []);

  useEffect(() => {
    if (!api.onRunOutput) return;
    const off = api.onRunOutput((msg: any) => {
      if (!bridgeRunId || String(msg?.id || '') !== bridgeRunId) return;
      if (msg?.type === 'stdout' || msg?.type === 'stderr') {
        setBridgeLog((current) => [...current.slice(-14), String(msg.line || '').trim()].filter(Boolean));
      }
      if (msg?.type === 'exit') {
        setBridgeBusy('idle');
        const code = Number(msg.code ?? -1);
        setBridgeStatus(code === 0 ? 'Bridge command exited cleanly.' : `Bridge command exited with code ${code}. Check the log below.`);
      }
    });
    return off;
  }, [api, bridgeRunId]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string }>).detail || {};
      if (detail.action === 'open-folder') void openBridgeFolder();
      if (detail.action === 'install-deps') void installBridgeDeps();
      if (detail.action === 'launch-bridge') void startBridgeProcess();
      if (detail.action === 'copy-command') void copyBridgeLaunchCommand();
    };
    window.addEventListener('oddengine:bridge-assistant', handler as EventListener);
    return () => window.removeEventListener('oddengine:bridge-assistant', handler as EventListener);
  }, [bridgeDir, bridgeRunner, prefs]);

  async function openBridgeFolder() {
    setBridgeBusy('opening');
    try {
      const result = await api.openPath(bridgeDir);
      setBridgeStatus(result?.ok === false ? (result?.error || `Could not open ${bridgeDir}.`) : `Opened ${bridgeDir}.`);
    } finally {
      setBridgeBusy('idle');
    }
  }

  async function openBridgeReadme() {
    setBridgeBusy('opening');
    try {
      const result = await api.openPath(bridgeReadmePath);
      setBridgeStatus(result?.ok === false ? (result?.error || 'Could not open the bridge README.') : 'Opened the bridge README.');
    } finally {
      setBridgeBusy('idle');
    }
  }

  async function copyBridgeLaunchCommand() {
    const cmd = launchCommandFor(bridgeRunner);
    try {
      await navigator.clipboard.writeText(cmd);
      setBridgeStatus(`Copied launch command: ${cmd}`);
      pushNotif({ kind: 'Workspace', title: 'Copied', detail: 'Bridge launch command copied to clipboard.' });
    } catch {
      setBridgeStatus(`Copy failed. Manual command: ${cmd}`);
    }
  }

  async function runBridgeTask(kind: 'installing' | 'starting', cmd: string, args: string[], successMessage: string) {
    setBridgeBusy(kind);
    setBridgeLog([]);
    const result = await api.run({ cmd, args, cwd: bridgeDir });
    if (!result?.ok) {
      setBridgeBusy('idle');
      setBridgeStatus(result?.error || `Could not start the ${kind === 'installing' ? 'dependency install' : 'bridge process'}.`);
      return false;
    }
    setBridgeRunId(String(result.id || ''));
    setBridgeStatus(successMessage);
    pushNotif({ kind: 'Workspace', title: kind === 'installing' ? 'Bridge deps' : 'Bridge launch', detail: successMessage });
    return true;
  }

  async function installBridgeDeps() {
    applyPrefs(prefs, { silent: true });
    const cmd = bridgeRunner === 'py' ? 'py' : 'python';
    const args = bridgeRunner === 'py'
      ? ['-3', '-m', 'pip', 'install', '-r', 'requirements.txt']
      : ['-m', 'pip', 'install', '-r', 'requirements.txt'];
    await runBridgeTask('installing', cmd, args, `Started bridge dependency install with ${installCommandFor(bridgeRunner)}.`);
  }

  async function startBridgeProcess() {
    applyPrefs(prefs, { silent: true });
    const cmd = bridgeRunner === 'py' ? 'py' : 'python';
    const args = bridgeRunner === 'py'
      ? ['-3', '-m', 'uvicorn', 'faster_whisper_bridge_example:app', '--host', '127.0.0.1', '--port', '8765']
      : ['-m', 'uvicorn', 'faster_whisper_bridge_example:app', '--host', '127.0.0.1', '--port', '8765'];
    const ok = await runBridgeTask('starting', cmd, args, `Started the bridge with ${launchCommandFor(bridgeRunner)}.`);
    if (ok) {
      window.setTimeout(() => { void probeBridgeNow(); }, 2200);
    }
  }

  async function probeBridgeNow() {
    applyPrefs(prefs, { silent: true });
    setBridgeBusy('probing');
    try {
      const result = await api.voiceBridgeProbe?.({ baseUrl: prefs.ai.homieExternalVoiceBaseUrl, timeoutMs: Math.min(prefs.ai.homieExternalVoiceTimeoutMs || 20000, 8000) });
      if (result?.ok) {
        setBridgeStatus(result.detail || `Bridge ready at ${prefs.ai.homieExternalVoiceBaseUrl}.`);
        pushNotif({ kind: 'Workspace', title: 'Voice bridge ready', detail: result.detail || 'External/local bridge responded.' });
      } else {
        setBridgeStatus(classifyBridgeProbeError(result?.error || ''));
      }
      window.dispatchEvent(new CustomEvent('oddengine:homie-voice-action', { detail: { action: 'probe-external', source: 'preferences-assistant' } }));
    } finally {
      setBridgeBusy('idle');
    }
  }

  function reset(){
    setPrefs(DEFAULT_PREFS);
    pushNotif({ kind:"Workspace", title:"Reset", detail:"Reset to defaults (not saved yet)." });
  }

  function clearLocalStorageByPrefix(prefixes: string[]) {
    let cleared = 0;
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i) || "";
        if (!k) continue;
        if (prefixes.some((p) => k.startsWith(p))) {
          localStorage.removeItem(k);
          cleared++;
        }
      }
    } catch (_e) {
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
    } catch (_e) {}
    pushNotif({ kind: "Workspace", title: "Full layout reset", detail: `Cleared ${cleared} layout keys${api.resetWindowBounds ? " and popout bounds" : ""}.` });
    window.location.reload();
  }

  function addCategory(){
    const c = newCat.trim();
    if(!c) return;
    if(prefs.cannabis.categories.includes(c)) return;
    setPrefs(p => ({...p, cannabis:{...p.cannabis, categories:[...p.cannabis.categories, c]}}));
    setNewCat("");
  }

  function addTier(){
    const t = newTier.trim();
    if(!t) return;
    if(prefs.cannabis.priceTiers.includes(t)) return;
    setPrefs(p => ({...p, cannabis:{...p.cannabis, priceTiers:[...p.cannabis.priceTiers, t]}}));
    setNewTier("");
  }

const homieSnapshot = useMemo(() => {
  void homieTick;
  const presence = loadHomiePresence();
  const wake = loadHomieWakeFlow();
  const companion = loadHomieCompanion();
  const mission = getHomieMissionReadiness(presence, prefs);
  const conversation = getWakeConversationReadiness(wake, presence, prefs);
  return { presence, wake, companion, mission, conversation, companionCopy: describeCompanion(companion) };
}, [homieTick, prefs]);

  const voiceSummary = summarizeVoiceEngine(voiceSnapshot);
  const bridgeHealth = summarizeBridgeHealth(voiceSnapshot, prefs.ai.homieExternalVoiceBaseUrl);

  return (
    <div className="page">
      <div className="card productivityHeroCard">
        <div className="productivityHeroBar">
          <div>
            <div className="small shellEyebrow">PRODUCTIVITY COMMAND</div>
            <div className="productivityHeroTitle">Preferences</div>
            <div className="small productivityHeroSub">Tune the cockpit defaults once, then let every panel boot with the same calm desktop behavior.</div>
          </div>
          <div className="row wrap productivityHeroBadges" style={{ justifyContent: "flex-end" }}>
            <span className={`badge ${bridgeHealth.tone || ""}`}>{bridgeHealth.label}</span>
            <span className="badge">Voice {voiceSummary.headline}</span>
            <span className="badge">Start {prefs.desktop.startPanel || "OddBrain"}</span>
            <span className="badge">Snap {prefs.fairlygod.snapEnabled ? "On" : "Off"}</span>
          </div>
        </div>
        <div className="productivityMetricsRow">
          <div className="productivityMetricCard">
            <div className="small shellEyebrow">BRIDGE</div>
            <div className="h mt-1">{bridgeHealth.label}</div>
            <div className="small mt-2">{bridgeHealth.next}</div>
          </div>
          <div className="productivityMetricCard">
            <div className="small shellEyebrow">VOICE MODE</div>
            <div className="h mt-1">{prefs.ai.homieVoiceMode}</div>
            <div className="small mt-2">{voiceSummary.subline}</div>
          </div>
          <div className="productivityMetricCard">
            <div className="small shellEyebrow">START PANEL</div>
            <div className="h mt-1">{prefs.desktop.startPanel || "OddBrain"}</div>
            <div className="small mt-2">Default launch surface</div>
          </div>
          <div className="productivityMetricCard">
            <div className="small shellEyebrow">GRID</div>
            <div className="h mt-1">{prefs.fairlygod.gridSize}px</div>
            <div className="small mt-2">Workspace snap sizing</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{justifyContent:"space-between", alignItems:"baseline"}}>
          <div>
            <div className="h">Preferences</div>
            <div className="sub">Saved locally. Used as defaults by panels on first run.</div>
          </div>
          <div className="row" style={{gap:8}}>
            <button onClick={reset} title="Reset to defaults (not saved)">Reset</button>
            <button onClick={save} className="primary">Save</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h">🧩 Layout & Windows</div>
        <div className="sub">Clean + reliable sizing. Reset if anything feels off (cards, popouts, weird bounds).</div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button className="tabBtn" onClick={resetCardLayouts}>Reset card layouts</button>
          <button className="tabBtn" disabled={!api.resetWindowBounds} onClick={resetPopoutBounds} title={api.resetWindowBounds ? "" : "Desktop-only"}>Reset popout bounds</button>
          <button className="tabBtn active" onClick={resetAllLayouts}>Reset ALL</button>
        </div>
        <div className="small" style={{ marginTop: 10, opacity: 0.8 }}>
          This only clears saved layout state (sizes/positions). Your data and content stay intact.
        </div>
      </div>

      {/* Grow */}
      <div className="card">
        <div className="h">🌱 Grow</div>
        <div className="sub">Defaults used when you haven’t set a Grow profile yet.</div>
        <div className="grid2">
          <label className="field">Tent/Room Name
            <input value={prefs.grow.name} onChange={e => setPrefs(p => ({...p, grow:{...p.grow, name:e.target.value}}))} placeholder="Grow Tent 1" />
          </label>
          <label className="field">Size
            <input value={prefs.grow.size} onChange={e => setPrefs(p => ({...p, grow:{...p.grow, size:e.target.value}}))} placeholder='e.g. 4x4 or "Bedroom"' />
          </label>
          <label className="field">Stage
            <select value={prefs.grow.stage} onChange={e => setPrefs(p => ({...p, grow:{...p.grow, stage:e.target.value as any}}))}>
              <option value="seedling">Seedling</option>
              <option value="veg">Veg</option>
              <option value="flower">Flower</option>
              <option value="dry">Dry</option>
            </select>
          </label>
          <label className="field">Lights On
            <input value={prefs.grow.lightsOn} onChange={e => setPrefs(p => ({...p, grow:{...p.grow, lightsOn:e.target.value}}))} placeholder="06:00" />
          </label>
          <label className="field">Lights Off
            <input value={prefs.grow.lightsOff} onChange={e => setPrefs(p => ({...p, grow:{...p.grow, lightsOff:e.target.value}}))} placeholder="00:00" />
          </label>
        </div>
      </div>

      {/* Cameras */}
      <div className="card">
        <div className="h">📷 Cameras</div>
        <div className="sub">Default wall grid + live preview behavior.</div>
        <div className="grid2">
          <label className="field">Grid
            <select value={prefs.cameras.grid} onChange={e => setPrefs(p => ({...p, cameras:{...p.cameras, grid:e.target.value as any}}))}>
              <option value="2x2">2x2</option>
              <option value="3x2">3x2</option>
              <option value="3x3">3x3</option>
              <option value="4x3">4x3</option>
              <option value="6x2">6x2</option>
            </select>
          </label>
          <label className="field">Live previews
            <select value={String(prefs.cameras.livePreviews)} onChange={e => setPrefs(p => ({...p, cameras:{...p.cameras, livePreviews:e.target.value==="true"}}))}>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>
          <label className="field">Snapshot interval (ms)
            <input type="number" value={prefs.cameras.snapshotIntervalMs} onChange={e => setPrefs(p => ({...p, cameras:{...p.cameras, snapshotIntervalMs: Math.max(200, Number(e.target.value)||0)}}))} />
          </label>
        </div>
      </div>

      {/* ZBD */}
      <div className="card">
        <div className="h">🎮 ZBD / Crypto Games</div>
        <div className="sub">Saved wallet + preferred emulator. (Auto-detect still works.)</div>
        <div className="grid2">
          <label className="field">Wallet address
            <input value={prefs.zbd.walletAddress} onChange={e => setPrefs(p => ({...p, zbd:{...p.zbd, walletAddress:e.target.value}}))} placeholder="BTC / Lightning / ZBD address" />
          </label>
          <label className="field">Preferred emulator
            <select value={prefs.zbd.preferredEmulator} onChange={e => setPrefs(p => ({...p, zbd:{...p.zbd, preferredEmulator:e.target.value as any}}))}>
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

      {/* Desktop */}
      <div className="card">
        <div className="h">🧩 Desktop Mode</div>
        <div className="sub">Default panel at launch + safe-fix behavior.</div>
        <div className="grid2">
          <label className="field">Start panel
            <input value={prefs.desktop.startPanel} onChange={e => setPrefs(p => ({...p, desktop:{...p.desktop, startPanel:e.target.value}}))} placeholder="OddBrain" />
          </label>
          <label className="field">Auto-run safe fixes
            <select value={String(prefs.desktop.autoRunSafeFixes)} onChange={e => setPrefs(p => ({...p, desktop:{...p.desktop, autoRunSafeFixes:e.target.value==="true"}}))}>
              <option value="false">Off</option>
              <option value="true">On</option>
            </select>
          </label>
        </div>
      </div>



{/* FairlyGOD */}
<div className="card">
  <div className="h">🧠🔥 FairlyGOD Workspace</div>
  <div className="sub">Defaults for move/shrink cards, grid snapping, and routine tiling.</div>
  <div className="grid3">
    <label className="field">Grid size
      <input type="number" min={8} max={64} step={1}
        value={prefs.fairlygod.gridSize}
        onChange={e => setPrefs(p => ({...p, fairlygod:{...p.fairlygod, gridSize: Math.max(8, Math.min(64, Number(e.target.value)||16))}}))} />
    </label>
    <label className="field">Snap enabled
      <select value={String(prefs.fairlygod.snapEnabled)} onChange={e => setPrefs(p => ({...p, fairlygod:{...p.fairlygod, snapEnabled: e.target.value==="true"}}))}>
        <option value="true">On</option>
        <option value="false">Off</option>
      </select>
    </label>
    <label className="field">Auto-lock after (sec)
      <input type="number" min={0} max={3600} step={5}
        value={prefs.fairlygod.autoLockAfterSec}
        onChange={e => setPrefs(p => ({...p, fairlygod:{...p.fairlygod, autoLockAfterSec: Math.max(0, Math.min(3600, Number(e.target.value)||0))}}))} />
    </label>
    <label className="field">Default routine mode
      <select value={prefs.fairlygod.defaultRoutineMode} onChange={e => setPrefs(p => ({...p, fairlygod:{...p.fairlygod, defaultRoutineMode: e.target.value as any}}))}>
        <option value="windows">Windows</option>
        <option value="main">Main shell</option>
      </select>
    </label>
    <label className="field">Default tile style
      <select value={prefs.fairlygod.defaultTileStyle} onChange={e => setPrefs(p => ({...p, fairlygod:{...p.fairlygod, defaultTileStyle: e.target.value as any}}))}>
        <option value="grid">Grid</option>
        <option value="left-main">Left-main + stack</option>
        <option value="hero">2×2 Hero</option>
      </select>
    </label>
    <label className="field">Default tile preset
      <select value={prefs.fairlygod.defaultTilePreset} onChange={e => setPrefs(p => ({...p, fairlygod:{...p.fairlygod, defaultTilePreset: e.target.value as any}}))}>
        <option value="single">Single monitor</option>
        <option value="trader-main-3mon">Trader main + 3 monitors</option>
      </select>
    </label>
  </div>
  <div className="small" style={{marginTop:8}}>
    Tip: Existing panels keep their own saved layouts. These settings apply when a panel has no saved layout yet.
  </div>
</div>

      {/* Cannabis */}
      <div className="card">
        <div className="h">🍃 Cannabis</div>
        <div className="sub">Defaults for ZIP + filters used in Cannabis panel. Deal scoring = “best overall” (value + clarity + fewer restrictions).</div>
        <div className="grid2">
          <label className="field">Default ZIP
            <input value={prefs.cannabis.zip} onChange={e => setPrefs(p => ({...p, cannabis:{...p.cannabis, zip:e.target.value}}))} placeholder="e.g. 89101" />
          </label>
          <label className="field">Min deal score
            <input type="number" value={prefs.cannabis.minDealScore} onChange={e => setPrefs(p => ({...p, cannabis:{...p.cannabis, minDealScore: Math.max(0, Math.min(100, Number(e.target.value)||0))}}))} />
          </label>
        </div>

        <div className="row" style={{gap:18, flexWrap:"wrap", marginTop:10}}>
          <div style={{minWidth:280, flex:1}}>
            <div className="sub" style={{marginBottom:6}}>Categories (filter tags)</div>
            <div className="row" style={{gap:8, flexWrap:"wrap"}}>
              {prefs.cannabis.categories.map(c => (
                <button key={c} className="tabBtn active" onClick={() => setPrefs(p => ({...p, cannabis:{...p.cannabis, categories: p.cannabis.categories.filter(x=>x!==c)}}))} title="Remove">
                  {c} ✕
                </button>
              ))}
            </div>
            <div className="row" style={{gap:8, marginTop:8}}>
              <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Add category (e.g. Deals, Dispensary)" />
              <button onClick={addCategory}>Add</button>
            </div>
          </div>

          <div style={{minWidth:280, flex:1}}>
            <div className="sub" style={{marginBottom:6}}>Price tiers (you define)</div>
            <div className="row" style={{gap:8, flexWrap:"wrap"}}>
              {prefs.cannabis.priceTiers.map(t => (
                <button key={t} className="tabBtn active" onClick={() => setPrefs(p => ({...p, cannabis:{...p.cannabis, priceTiers: p.cannabis.priceTiers.filter(x=>x!==t)}}))} title="Remove">
                  {t} ✕
                </button>
              ))}
            </div>
            <div className="row" style={{gap:8, marginTop:8}}>
              <input value={newTier} onChange={e => setNewTier(e.target.value)} placeholder="Add tier (e.g. $$$$$)" />
              <button onClick={addTier}>Add</button>
            </div>
          </div>
        </div>

        <div className="sub" style={{marginTop:10}}>
          Tip: You can override per-deal tiers/categories inside the Cannabis panel.
        </div>
      </div>

      {/* Voice status */}
      <div className="card">
        <div className="h">🎙️ Voice engine status</div>
        <div className="sub">Live status from Homie so you can see whether cloud speech, push-to-talk, and typed commands are ready before you talk.</div>
        <div className="assistantChipWrap" style={{ marginTop: 12 }}>
          {getVoiceEngineBadges(voiceSnapshot).map((badge) => (
            <span key={badge.label} className={`badge ${badge.tone}`}>{badge.label}</span>
          ))}
        </div>
        <div className="small" style={{ marginTop: 10 }}>{summarizeVoiceEngine(voiceSnapshot)}</div>
        <div className="small" style={{ marginTop: 6 }}>Mic permission: <b>{voiceSnapshot.permissionState}</b> • Audio inputs: <b>{voiceSnapshot.audioInputCount}</b> • Updated: <b>{voiceSnapshot.updatedAt ? new Date(voiceSnapshot.updatedAt).toLocaleTimeString() : "not yet"}</b></div>
      </div>

      <div className="card">
        <div className="h">🏠 External Bridge Setup Assistant</div>
        <div className="sub">Keep voice setup separate from Homie House so the room can stay cozy while the bridge work stays practical.</div>
        {(() => {
          const bridgeState = summarizeBridgeHealth(voiceSnapshot, prefs.ai.homieExternalVoiceBaseUrl);
          return (
            <>
              <div className="assistantChipWrap" style={{ marginTop: 12 }}>
                <span className={`badge ${prefs.ai.homieVoiceEngineMode === "external-http" ? "good" : prefs.ai.homieVoiceEngineMode === "hybrid" ? "warn" : ""}`}>Mode: {prefs.ai.homieVoiceEngineMode}</span>
                <span className={`badge ${bridgeState.tone}`}>Bridge: {bridgeState.label}</span>
                <span className={`badge ${bridgeBusy !== "idle" ? "warn" : "good"}`}>{bridgeBusy === "idle" ? 'Assistant idle' : `Assistant ${bridgeBusy}`}</span>
              </div>
              <div className="grid2" style={{ marginTop: 12 }}>
                <div className="card pluginMiniWidget good">
                  <div className="assistantSectionTitle">Voice setup</div>
                  <div className="small" style={{ marginTop: 10 }}><b>Now:</b> {bridgeState.detail}</div>
                  <div className="small" style={{ marginTop: 6 }}><b>Next:</b> {bridgeState.next}</div>
                  <div className="assistantChipWrap" style={{ marginTop: 10 }}>
                    <span className={`badge ${prefs.ai.homieVoiceEngineMode !== 'cloud' ? 'good' : ''}`}>1. mode saved</span>
                    <span className={`badge ${bridgeDir ? 'good' : ''}`}>2. folder ready</span>
                    <span className={`badge ${voiceSnapshot.externalState === 'ready' ? 'good' : voiceSnapshot.externalState === 'degraded' ? 'warn' : ''}`}>3. bridge probe</span>
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button className="tabBtn active" onClick={() => applyPrefs({ ...prefs, ai: { ...prefs.ai, homieVoiceEngineMode: "hybrid" } }, { silent: true })}>Use Hybrid while testing</button>
                    <button className="tabBtn" onClick={() => void installBridgeDeps()}>Install deps</button>
                    <button className="tabBtn active" onClick={() => void startBridgeProcess()}>Start bridge</button>
                    <button className="tabBtn" onClick={() => void probeBridgeNow()}>Save + probe bridge</button>
                  </div>
                </div>
                <div className="card pluginMiniWidget warn">
                  <div className="assistantSectionTitle">Homie room</div>
                  <div className="small" style={{ marginTop: 10 }}>Companion: <b>{prefs.ai.homieCompanionWindow ? 'On' : 'Off'}</b> • Skin: <b>{prefs.ai.homieAvatarSkin}</b></div>
                  <div className="small" style={{ marginTop: 6 }}>Use the Homie mascot + companion window for the most lived-in, always-in-your-corner vibe.</div>
                  <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button className="tabBtn" onClick={() => applyPrefs({ ...prefs, ai: { ...prefs.ai, homieCompanionWindow: true, homieAvatarSkin: "lil-homie" } }, { silent: true, launchCompanion: true })}>Open Homie House</button>
                    <button className="tabBtn" onClick={() => void copyBridgeLaunchCommand()}>Copy launch command</button>
                    <button className="tabBtn" onClick={() => void openBridgeFolder()}>Open bridge folder</button>
                    <button className="tabBtn" onClick={() => void openBridgeReadme()}>Open bridge guide</button>
                  </div>
                </div>
              </div>
              <div className="grid2" style={{ marginTop: 12 }}>
                <label className="field">Bridge helper runner
                  <select value={bridgeRunner} onChange={e => setBridgeRunner(e.target.value as any)}>
                    <option value="py">py -3</option>
                    <option value="python">python</option>
                  </select>
                </label>
                <label className="field">Quick commands
                  <div className="small" style={{ paddingTop: 10, lineHeight: 1.55 }}>
                    Install: <b>{installCommandFor(bridgeRunner)}</b><br/>
                    Launch: <b>{launchCommandFor(bridgeRunner)}</b>
                  </div>
                </label>
              </div>
              <div className="card softCard" style={{ marginTop: 12, background: 'rgba(18,24,30,0.82)' }}>
                <div className="assistantSectionTitle">Bridge assistant status</div>
                <div className="small" style={{ marginTop: 10 }}>{bridgeStatus || bridgeState.detail}</div>
                <div className="small" style={{ marginTop: 6 }}>URL: <b>{prefs.ai.homieExternalVoiceBaseUrl}</b></div>
                {!!bridgeLog.length && (
                  <div className="timelineCard" style={{ marginTop: 10, maxHeight: 120, overflow: 'auto' }}>
                    {bridgeLog.map((line, index) => <div key={`${index}-${line.slice(0, 18)}`} className="small" style={{ marginTop: index ? 6 : 0 }}>{line}</div>)}
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </div>

<div className="card" style={{ marginTop: 18 }}>
  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
    <div>
      <div className="h">👊 Homie embodied companion lane</div>
      <div className="sub">New upgrades, same classic Preferences feel. Tune presence, wake flow, and companion posture without changing the baseline shell.</div>
    </div>
    <div className="cluster wrap">
      <span className="badge good">Mission {homieSnapshot.mission.readiness}%</span>
      <span className="badge">Conversation {homieSnapshot.conversation.readiness}%</span>
    </div>
  </div>
  <div className="grid2" style={{ marginTop: 12 }}>
    <div className="field">
      <div className="small">Presence status</div>
      <div className="sub" style={{ marginTop: 6 }}>{homieSnapshot.presence.statusNote}</div>
      <div className="small" style={{ marginTop: 10 }}>Check-in style: <b>{homieSnapshot.presence.checkInStyle}</b> • Wake word: <b>{homieSnapshot.presence.wakeWordEnabled ? "On" : "Off"}</b> • Vision: <b>{homieSnapshot.presence.visionEnabled ? "On" : "Off"}</b></div>
    </div>
    <div className="field">
      <div className="small">Companion voice</div>
      <div className="sub" style={{ marginTop: 6 }}>{homieSnapshot.companionCopy.attitude}, {homieSnapshot.companionCopy.pace}, {homieSnapshot.companionCopy.checkIn}.</div>
      <div className="small" style={{ marginTop: 10 }}>Signature: <b>{homieSnapshot.companion.signature}</b></div>
    </div>
  </div>
  <div className="grid2" style={{ marginTop: 12 }}>
    <label className="field">Companion attitude
      <select value={homieSnapshot.companion.attitude} onChange={e => patchHomieCompanion({ attitude: e.target.value as any })}>
        <option value="steady">Steady</option>
        <option value="gentle">Gentle</option>
        <option value="focused">Focused</option>
        <option value="playful">Playful</option>
      </select>
    </label>
    <label className="field">Companion proactivity
      <select value={homieSnapshot.companion.proactivity} onChange={e => patchHomieCompanion({ proactivity: e.target.value as any })}>
        <option value="quiet">Quiet</option>
        <option value="balanced">Balanced</option>
        <option value="on-it">On-it</option>
      </select>
    </label>
    <label className="field">Check-in style
      <select value={homieSnapshot.companion.checkInStyle} onChange={e => patchHomieCompanion({ checkInStyle: e.target.value as any })}>
        <option value="light">Light</option>
        <option value="supportive">Supportive</option>
        <option value="direct">Direct</option>
      </select>
    </label>
    <label className="field">Wake phrase
      <input value={homieSnapshot.wake.wakePhrase} onChange={e => patchHomieWakeFlow({ wakePhrase: e.target.value })} placeholder="Hey Homie" />
    </label>
    <label className="field">Wake follow-up window (sec)
      <input type="number" min={8} max={45} step={1} value={homieSnapshot.wake.followupWindowSec} onChange={e => patchHomieWakeFlow({ followupWindowSec: Math.max(8, Math.min(45, Number(e.target.value || 18))) })} />
    </label>
    <label className="field">Presence posture
      <select value={homieSnapshot.presence.checkInStyle} onChange={e => patchHomiePresence({ checkInStyle: e.target.value as any })}>
        <option value="gentle">Gentle</option>
        <option value="balanced">Balanced</option>
        <option value="active">Active</option>
      </select>
    </label>
  </div>
  <div className="cluster wrap" style={{ marginTop: 12 }}>
    <button className="tabBtn" onClick={() => enableHomieMissionControlBaseline()}>Apply mission baseline</button>
    <button className="tabBtn" onClick={() => enableWakeConversationBaseline()}>Apply wake baseline</button>
    <button className="tabBtn" onClick={() => markWakeHeard()}>Simulate wake heard</button>
    <button className="tabBtn" onClick={() => markUserTurn("Help me focus and keep this simple.")}>Simulate user turn</button>
    <button className="tabBtn" onClick={() => markAssistantTurn("I've got you. Let's make the next move clean.")}>Simulate reply</button>
  </div>
</div>

      {/* AI */}
      <div className="card">
        <div className="h">🧠 AI Assistants</div>
        <div className="sub">Defaults used by the shared AI Brain, embedded panel copilots, and Homie companion.</div>
        <div className="grid2">
          <label className="field">Tone
            <select value={prefs.ai.tone} onChange={e => updateAi(p => ({...p, tone:e.target.value as any}))}>
              <option value="coach">Coach</option>
              <option value="builder">Builder</option>
              <option value="operator">Operator</option>
            </select>
          </label>
          <label className="field">Verbosity
            <select value={prefs.ai.verbosity} onChange={e => updateAi(p => ({...p, verbosity:e.target.value as any}))}>
              <option value="tight">Tight</option>
              <option value="balanced">Balanced</option>
              <option value="deep">Deep</option>
            </select>
          </label>
          <label className="field">Auto-pin assistant notes
            <select value={String(prefs.ai.autoPinNotes)} onChange={e => updateAi(p => ({...p, autoPinNotes:e.target.value==="true"}))}>
              <option value="false">Off</option>
              <option value="true">On</option>
            </select>
          </label>
          <label className="field">Assistant docks open by default
            <select value={String(prefs.ai.defaultDockOpen)} onChange={e => updateAi(p => ({...p, defaultDockOpen:e.target.value==="true"}))}>
              <option value="true">Open</option>
              <option value="false">Collapsed</option>
            </select>
          </label>
          <label className="field">Homie voice
            <select value={String(prefs.ai.homieVoiceEnabled)} onChange={e => updateAi(p => ({...p, homieVoiceEnabled:e.target.value==="true"}))}>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>
          <label className="field">Voice profile
            <select value={prefs.ai.homieVoiceProfile} onChange={e => updateAi(p => ({...p, homieVoiceProfile:e.target.value as any}))}>
              <option value="auto">Auto</option>
              <option value="warm">Warm</option>
              <option value="clear">Clear</option>
              <option value="bright">Bright</option>
            </select>
          </label>
          <label className="field">Voice engine mode
            <select value={prefs.ai.homieVoiceEngineMode} onChange={e => updateAi(p => ({...p, homieVoiceEngineMode:e.target.value as any}))}>
              <option value="cloud">Cloud speech</option>
              <option value="external-http">External/local HTTP</option>
              <option value="hybrid">Hybrid (prefer external, fall back to cloud)</option>
            </select>
          </label>
          <label className="field">External/local bridge URL
            <input value={prefs.ai.homieExternalVoiceBaseUrl} onChange={e => updateAi(p => ({...p, homieExternalVoiceBaseUrl:e.target.value}))} placeholder="http://127.0.0.1:8765" />
          </label>
          <label className="field">External bridge timeout (ms)
            <input type="number" min={4000} step={1000} value={prefs.ai.homieExternalVoiceTimeoutMs} onChange={e => updateAi(p => ({...p, homieExternalVoiceTimeoutMs: Math.max(4000, Number(e.target.value || 20000))}))} />
          </label>
          <label className="field">Browser local voice safety note
            <div className="small">Chromium on-device speech stays disabled here to avoid Electron renderer crashes. The safe local path in this build is an external/local HTTP voice bridge.</div>
          </label>
          <label className="field">Avatar skin
            <select value={prefs.ai.homieAvatarSkin} onChange={e => updateAi(p => ({...p, homieAvatarSkin:e.target.value as any}))}>
              <option value="memoji">Fortnite mascot</option>
              <option value="orb">Orb</option>
              <option value="phoenix">Phoenix</option>
              <option value="terminal">Terminal</option>
              <option value="lil-homie">Lil Homie</option>
            </select>
          </label>

          <label className="field">Lil Homie Agent (walking helper)
            <select value={String((prefs.ai as any).homieLilEnabled !== false)} onChange={e => updateAi(p => ({ ...p, homieLilEnabled: e.target.value === "true" } as any))}>
              <option value="true">On (roaming NPC)</option>
              <option value="false">Off</option>
            </select>
            <div className="small" style={{ marginTop: 6 }}>Shows Homie as a living companion in the mascot spot so he can move around, check in, and answer questions without taking over the shell.</div>
          </label>

          <label className="field">Lil Homie render
            <select value={String((prefs.ai as any).homieLil3d !== false)} onChange={e => updateAi(p => ({ ...p, homieLil3d: e.target.value === "true" } as any))}>
              <option value="true">3D (game buddy)</option>
              <option value="false">2D (classic)</option>
            </select>
            <div className="small" style={{ marginTop: 6 }}>3D mode uses Three.js. To upgrade to a fully rigged character, drop <code>ui/public/models/lilhomie.glb</code> (Idle/Walk/Talk animations recommended). Falls back safely if missing.</div>
          </label>

          <label className="field">Lil Homie roam
            <select value={String((prefs.ai as any).homieLilRoam !== false)} onChange={e => updateAi(p => ({ ...p, homieLilRoam: e.target.value === "true" } as any))}>
              <option value="true">On (wanders around)</option>
              <option value="false">Off (stay where you drag him)</option>
            </select>
          </label>

          <label className="field">Lil Homie speech
            <select value={String(!!(prefs.ai as any).homieLilSpeech)} onChange={e => updateAi(p => ({ ...p, homieLilSpeech: e.target.value === "true" } as any))}>
              <option value="false">Off (quiet bubbles)</option>
              <option value="true">On (speechSynthesis)</option>
            </select>
          </label>

          <label className="field">Lil Homie speed
            <input
              type="range"
              min={80}
              max={280}
              step={10}
              value={Number((prefs.ai as any).homieLilSpeed ?? 160)}
              onChange={e => updateAi(p => ({ ...p, homieLilSpeed: Math.max(80, Math.min(280, Number(e.target.value || 160))) } as any))}
            />
            <div className="small" style={{ marginTop: 6 }}>How fast he walks when roaming.</div>
          </label>

          <label className="field">Lil Homie size
            <input
              type="range"
              min={0.7}
              max={1.35}
              step={0.05}
              value={Number((prefs.ai as any).homieLilScale ?? 1)}
              onChange={e => updateAi(p => ({ ...p, homieLilScale: Math.max(0.7, Math.min(1.35, Number(e.target.value || 1))) } as any))}
            />
            <div className="small" style={{ marginTop: 6 }}>Bigger = more mascot presence.</div>
          </label>

          <label className="field">Lil Homie energy (0.3–1.0)
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={Number((prefs.ai as any).homieLilEnergy ?? (prefs.ai as any).homieMascotEnergy ?? 0.9)}
              onChange={e => updateAi(p => ({ ...p, homieLilEnergy: Math.max(0.3, Math.min(1, Number(e.target.value || 0.9))) } as any))}
            />
            <div className="small" style={{ marginTop: 6 }}>Higher = more bounce + more “LET’S GO” energy.</div>
          </label>

          <label className="field">Lil Homie chatter
            <select value={String((prefs.ai as any).homieLilChatter !== false)} onChange={e => updateAi(p => ({ ...p, homieLilChatter: e.target.value === "true" } as any))}>
              <option value="true">On (context tips)</option>
              <option value="false">Off (only when clicked)</option>
            </select>
          </label>
          {prefs.ai.homieAvatarSkin === "memoji" && (
            <>
              <label className="field">Mascot animation (Fortnite buddy)
                <select value={String((prefs.ai as any).homieMascotAnimated !== false)} onChange={e => updateAi(p => ({...p, homieMascotAnimated:e.target.value==="true"} as any))}>
                  <option value="true">Hype mode: On</option>
                  <option value="false">Off (static)</option>
                </select>
              </label>
              <label className="field">Mascot energy (0.3–1.0)
                <input
                  type="range"
                  min={0.3}
                  max={1}
                  step={0.05}
                  value={Number((prefs.ai as any).homieMascotEnergy ?? 0.85)}
                  onChange={e => updateAi(p => ({...p, homieMascotEnergy: Math.max(0.3, Math.min(1, Number(e.target.value || 0.85)))} as any))}
                />
                <div className="small" style={{ marginTop: 6 }}>Higher = more bounce + more “LET’S GO”.</div>
              </label>
            </>
          )}
          <label className="field">Game buddy (Rive)
            <select value={String(prefs.ai.homieRiveEnabled)} onChange={e => updateAi(p => ({...p, homieRiveEnabled:e.target.value==="true"}))}>
              <option value="false">Off (classic CSS buddy)</option>
              <option value="true">On (Rive state machine)</option>
            </select>
          </label>
          <label className="field">Rive source (.riv URL or /rive/homie.riv)
            <input value={prefs.ai.homieRiveSrc} onChange={e => updateAi(p => ({...p, homieRiveSrc:e.target.value}))} placeholder="/rive/homie.riv" />
          </label>
          <label className="field">Rive artboard (optional)
            <input value={prefs.ai.homieRiveArtboard} onChange={e => updateAi(p => ({...p, homieRiveArtboard:e.target.value}))} placeholder="Homie" />
          </label>
          <label className="field">Rive state machine
            <input value={prefs.ai.homieRiveStateMachine} onChange={e => updateAi(p => ({...p, homieRiveStateMachine:e.target.value}))} placeholder="State Machine 1" />
          </label>
          <label className="field">Rive pointer tracking
            <select value={String(prefs.ai.homieRivePointerTracking)} onChange={e => updateAi(p => ({...p, homieRivePointerTracking:e.target.value==="true"}))}>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>
          <label className="field">Rive input names (recommended)
            <div className="small">If your Homie .riv uses these inputs, OddEngine will drive them automatically: <b>isTalking</b> (bool), <b>isListening</b> (bool), <b>mood</b> (number 0=idle 1=good 2=warn), <b>lookX/lookY</b> (numbers 0–100), plus optional triggers <b>wave</b>, <b>wink</b>, <b>celebrate</b>.</div>
          </label>
          <label className="field">Quick test URL
            <div className="small">Need a test file? In Rive docs you can use an example URL like <b>https://cdn.rive.app/animations/vehicles.riv</b> + state machine <b>bumpy</b> to verify the runtime. Then swap to your Homie file.</div>
          </label>
          <label className="field">Always-on companion window
            <select value={String(prefs.ai.homieCompanionWindow)} onChange={e => updateAi(p => ({...p, homieCompanionWindow:e.target.value==="true"}))}>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>
          <label className="field">Reactive idle chatter
            <select value={String(prefs.ai.homieIdleChatter)} onChange={e => updateAi(p => ({...p, homieIdleChatter:e.target.value==="true"}))}>
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
          </label>
          <label className="field">Link Homie room to active panel
            <select value={String((prefs.ai as any).homieRoomAutoLink)} onChange={e => updateAi(p => ({...p, homieRoomAutoLink: e.target.value === "true" } as any))}>
              <option value="false">Off</option>
              <option value="true">On</option>
            </select>
          </label>
          <label className="field">Homie room preset
            <select value={prefs.ai.homieRoomPreset} onChange={e => updateAi(p => {
              const value = e.target.value as any;
              if (value === "trading") return { ...p, homieRoomPreset: value, homieFurnitureTheme: "fairlyodd-neon", homieWallItem: "chart-wall", homieDeskItem: "trading-rig", homieMoodLighting: "neon" };
              if (value === "grow") return { ...p, homieRoomPreset: value, homieFurnitureTheme: "greenhouse-den", homieWallItem: "grow-calendar", homieDeskItem: "grow-sensor", homieMoodLighting: "forest" };
              if (value === "chill") return { ...p, homieRoomPreset: value, homieFurnitureTheme: "studio-loft", homieWallItem: "family-wall", homieDeskItem: "tea-notes", homieMoodLighting: "golden" };
              if (value === "mission-control") return { ...p, homieRoomPreset: value, homieFurnitureTheme: "arcade-rig", homieWallItem: "mission-board", homieDeskItem: "terminal-stack", homieMoodLighting: "sunset" };
              return { ...p, homieRoomPreset: "custom" };
            })}>
              <option value="trading">Trading</option>
              <option value="grow">Grow</option>
              <option value="chill">Chill</option>
              <option value="mission-control">Mission Control</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="field">Furniture theme
            <select value={prefs.ai.homieFurnitureTheme} onChange={e => updateAi(p => ({...p, homieRoomPreset:"custom", homieFurnitureTheme:e.target.value as any}))}>
              <option value="fairlyodd-neon">FairlyOdd neon</option>
              <option value="arcade-rig">Arcade rig</option>
              <option value="studio-loft">Studio loft</option>
              <option value="greenhouse-den">Greenhouse den</option>
              <option value="cyber-noir" disabled={!isUpgradePackInstalled("homie-room-pack-cyber-noir")}>Cyber noir {isUpgradePackInstalled("homie-room-pack-cyber-noir") ? "" : "(locked)"}</option>
              <option value="mission-ops" disabled={!isUpgradePackInstalled("homie-room-pack-mission-ops")}>Mission ops {isUpgradePackInstalled("homie-room-pack-mission-ops") ? "" : "(locked)"}</option>
            </select>
          </label>
          <label className="field">Wall item
            <select value={prefs.ai.homieWallItem} onChange={e => updateAi(p => ({...p, homieRoomPreset:"custom", homieWallItem:e.target.value as any}))}>
              <option value="mission-board">Mission board</option>
              <option value="chart-wall">Chart wall</option>
              <option value="grow-calendar">Grow calendar</option>
              <option value="family-wall">Family wall</option>
            </select>
          </label>
          <label className="field">Desk item
            <select value={prefs.ai.homieDeskItem} onChange={e => updateAi(p => ({...p, homieRoomPreset:"custom", homieDeskItem:e.target.value as any}))}>
              <option value="terminal-stack">Terminal stack</option>
              <option value="trading-rig">Trading rig</option>
              <option value="grow-sensor">Grow sensor</option>
              <option value="tea-notes">Tea + notes</option>
            </select>
          </label>
          <label className="field">Mood lighting
            <select value={prefs.ai.homieMoodLighting} onChange={e => updateAi(p => ({...p, homieRoomPreset:"custom", homieMoodLighting:e.target.value as any}))}>
              <option value="neon">Neon</option>
              <option value="golden">Golden</option>
              <option value="forest">Forest</option>
              <option value="sunset">Sunset</option>
            </select>
          </label>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="small" style={{ marginBottom: 6 }}>Homie room packs (unlock extra furniture themes)</div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className={`tabBtn ${isUpgradePackInstalled("homie-room-pack-cyber-noir") ? "active" : ""}`} onClick={() => { if(!isUpgradePackInstalled("homie-room-pack-cyber-noir")) installUpgradePack("homie-room-pack-cyber-noir"); }}>
                {isUpgradePackInstalled("homie-room-pack-cyber-noir") ? "Cyber Noir installed" : "Install Cyber Noir"}
              </button>
              <button className={`tabBtn ${isUpgradePackInstalled("homie-room-pack-mission-ops") ? "active" : ""}`} onClick={() => { if(!isUpgradePackInstalled("homie-room-pack-mission-ops")) installUpgradePack("homie-room-pack-mission-ops"); }}>
                {isUpgradePackInstalled("homie-room-pack-mission-ops") ? "Mission Ops installed" : "Install Mission Ops"}
              </button>
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button className="tabBtn active" onClick={() => applyPrefs(prefs, { silent: true, launchCompanion: true })}>Launch Homie companion now</button>
          <button className="tabBtn" onClick={() => { applyPrefs(prefs, { silent: true }); window.dispatchEvent(new CustomEvent("oddengine:homie-voice-action", { detail: { action: "probe-external", source: "preferences" } })); }}>Probe external bridge</button>
          <div className="small">Tip: AI/voice/avatar settings now live-apply as you change them. External/local HTTP mode expects a local voice bridge at the URL above.</div>
        </div>
      </div>
    </div>
  );
}
