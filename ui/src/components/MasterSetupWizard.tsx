import React, { useMemo, useState } from "react";
import { pushNotif } from "../lib/notifs";
import { loadPrefs, savePrefs, type Prefs } from "../lib/prefs";
import { loadOperatorVault, saveOperatorVault, type OperatorVault } from "../lib/operatorVault";
import {
  DEFAULT_MASTER_SETUP,
  applyMasterSetupToPanels,
  buildMasterSetupFromVaultAndPrefs,
  countMasterSetupFilled,
  loadMasterSetup,
  mergeMasterSetupIntoPrefs,
  mergeMasterSetupIntoVault,
  saveMasterSetup,
  sanitizeMasterSetup,
  type MasterSetup,
} from "../lib/masterSetup";

function updateSection<K extends keyof MasterSetup>(
  setState: React.Dispatch<React.SetStateAction<MasterSetup>>,
  section: K,
  patch: Partial<MasterSetup[K]>,
) {
  setState((current) => sanitizeMasterSetup({
    ...current,
    [section]: {
      ...current[section],
      ...patch,
    },
  }));
}

export default function MasterSetupWizard({ onApplied }: { onApplied?: (prefs: Prefs, vault: OperatorVault) => void }) {
  const [setup, setSetup] = useState<MasterSetup>(() => loadMasterSetup());
  const [busy, setBusy] = useState<"idle" | "saving" | "loading">("idle");
  const stats = useMemo(() => countMasterSetupFilled(setup), [setup]);

  async function reloadFromCurrent() {
    setBusy("loading");
    try {
      const [vault, prefs] = await Promise.all([loadOperatorVault(), Promise.resolve(loadPrefs())]);
      const next = buildMasterSetupFromVaultAndPrefs(vault, prefs, setup);
      setSetup(next);
      saveMasterSetup(next);
      pushNotif({ kind: "Workspace", title: "Master setup loaded", detail: "Pulled the latest values from your vault + saved defaults." });
    } finally {
      setBusy("idle");
    }
  }

  async function applyNow() {
    setBusy("saving");
    try {
      const clean = sanitizeMasterSetup(setup);
      const currentPrefs = loadPrefs();
      const currentVault = await loadOperatorVault();
      const nextPrefs = mergeMasterSetupIntoPrefs(currentPrefs, clean);
      const nextVault = mergeMasterSetupIntoVault(currentVault, clean);
      saveMasterSetup(clean);
      savePrefs(nextPrefs);
      const vaultResult = await saveOperatorVault(nextVault);
      applyMasterSetupToPanels(clean);
      pushNotif({
        kind: "Workspace",
        title: vaultResult.ok ? "Master setup applied" : "Setup applied with vault warning",
        detail: vaultResult.ok
          ? "Saved your operator setup and pushed it into the live panels."
          : (vaultResult.error || "Panel defaults updated, but the secure vault save reported an issue."),
      });
      onApplied?.(nextPrefs, nextVault);
    } finally {
      setBusy("idle");
    }
  }

  function resetDraft() {
    const next = DEFAULT_MASTER_SETUP;
    setSetup(next);
    saveMasterSetup(next);
    pushNotif({ kind: "Workspace", title: "Wizard reset", detail: "Master Setup Wizard reset to the starter defaults." });
  }

  return (
    <div className="card softCard masterSetupWizardCard">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="h">🧠 Master Setup Wizard</div>
          <div className="sub">Enter your real info once, then push it into the vault, preferences, Trading, Mining, Grow, Cameras, and Routine Launcher automatically.</div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="tabBtn" disabled={busy !== "idle"} onClick={() => { void reloadFromCurrent(); }}>Load current</button>
          <button className="tabBtn" disabled={busy !== "idle"} onClick={resetDraft}>Reset draft</button>
          <button className="tabBtn active" disabled={busy !== "idle"} onClick={() => { void applyNow(); }}>{busy === "saving" ? "Applying…" : "Apply + push to panels"}</button>
        </div>
      </div>

      <div className="panelFinishMetrics" style={{ marginTop: 14 }}>
        <div className="finishMetricCard"><div className="small shellEyebrow">COMPLETION</div><div className="finishMetricLabel">{stats.filled}/{stats.total}</div><div className="small">fields filled</div></div>
        <div className="finishMetricCard"><div className="small shellEyebrow">TARGETS</div><div className="finishMetricLabel">${setup.money.weeklyIncomeTarget || "—"} / ${setup.money.monthlyIncomeTarget || "—"}</div><div className="small">weekly / monthly income</div></div>
        <div className="finishMetricCard"><div className="small shellEyebrow">TRADING</div><div className="finishMetricLabel">{setup.trading.defaultSymbol || "SPY"}</div><div className="small">{setup.trading.watchlist || "watchlist not set"}</div></div>
        <div className="finishMetricCard"><div className="small shellEyebrow">RECOVERY</div><div className="finishMetricLabel">{setup.money.roughDayMinutes || "15"}m / {setup.money.goodDayMinutes || "90"}m</div><div className="small">rough / good-day money time</div></div>
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card" style={{ background: "rgba(13,17,25,0.36)" }}>
          <div className="h">Identity + business</div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">Display name<input className="input" value={setup.profile.displayName} onChange={(e) => updateSection(setSetup, "profile", { displayName: e.target.value })} /></label>
            <label className="field">Preferred name<input className="input" value={setup.profile.preferredName} onChange={(e) => updateSection(setSetup, "profile", { preferredName: e.target.value })} /></label>
            <label className="field">City / area<input className="input" value={setup.profile.city} onChange={(e) => updateSection(setSetup, "profile", { city: e.target.value })} /></label>
            <label className="field">Time zone<input className="input" value={setup.profile.timeZone} onChange={(e) => updateSection(setSetup, "profile", { timeZone: e.target.value })} /></label>
            <label className="field">Business email<input className="input" value={setup.profile.businessEmail} onChange={(e) => updateSection(setSetup, "profile", { businessEmail: e.target.value })} /></label>
            <label className="field">Top income lanes<textarea className="input" rows={3} value={setup.money.topLanes} onChange={(e) => updateSection(setSetup, "money", { topLanes: e.target.value })} placeholder="GPTs, templates, affiliate, trading" /></label>
          </div>
        </div>

        <div className="card" style={{ background: "rgba(13,17,25,0.36)" }}>
          <div className="h">Money targets + content</div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">Weekly income target<input className="input" value={setup.money.weeklyIncomeTarget} onChange={(e) => updateSection(setSetup, "money", { weeklyIncomeTarget: e.target.value })} placeholder="500" /></label>
            <label className="field">Monthly income target<input className="input" value={setup.money.monthlyIncomeTarget} onChange={(e) => updateSection(setSetup, "money", { monthlyIncomeTarget: e.target.value })} placeholder="2000" /></label>
            <label className="field">Rough-day time (minutes)<input className="input" value={setup.money.roughDayMinutes} onChange={(e) => updateSection(setSetup, "money", { roughDayMinutes: e.target.value })} /></label>
            <label className="field">Good-day time (minutes)<input className="input" value={setup.money.goodDayMinutes} onChange={(e) => updateSection(setSetup, "money", { goodDayMinutes: e.target.value })} /></label>
            <label className="field">KDP email<input className="input" value={setup.content.kdpEmail} onChange={(e) => updateSection(setSetup, "content", { kdpEmail: e.target.value })} /></label>
            <label className="field">Gumroad email<input className="input" value={setup.content.gumroadEmail} onChange={(e) => updateSection(setSetup, "content", { gumroadEmail: e.target.value })} /></label>
            <label className="field">Gumroad API key<input className="input" value={setup.content.gumroadApiKey} onChange={(e) => updateSection(setSetup, "content", { gumroadApiKey: e.target.value })} /></label>
            <label className="field">OpenAI API key<input className="input" value={setup.content.openaiApiKey} onChange={(e) => updateSection(setSetup, "content", { openaiApiKey: e.target.value })} /></label>
            <label className="field">Affiliate tag<input className="input" value={setup.content.affiliateTag} onChange={(e) => updateSection(setSetup, "content", { affiliateTag: e.target.value })} /></label>
          </div>
        </div>

        <div className="card" style={{ background: "rgba(13,17,25,0.36)" }}>
          <div className="h">Trading + mining</div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">Broker<input className="input" value={setup.trading.broker} onChange={(e) => updateSection(setSetup, "trading", { broker: e.target.value })} /></label>
            <label className="field">Default symbol<input className="input" value={setup.trading.defaultSymbol} onChange={(e) => updateSection(setSetup, "trading", { defaultSymbol: e.target.value })} /></label>
            <label className="field">Watchlist<textarea className="input" rows={3} value={setup.trading.watchlist} onChange={(e) => updateSection(setSetup, "trading", { watchlist: e.target.value })} /></label>
            <label className="field">Scanner URL<input className="input" value={setup.trading.scannerUrl} onChange={(e) => updateSection(setSetup, "trading", { scannerUrl: e.target.value })} /></label>
            <label className="field">Trading account ID<input className="input" value={setup.trading.accountId} onChange={(e) => updateSection(setSetup, "trading", { accountId: e.target.value })} /></label>
            <label className="field">Trading API key<input className="input" value={setup.trading.apiKey} onChange={(e) => updateSection(setSetup, "trading", { apiKey: e.target.value })} /></label>
            <label className="field">Trading API secret<input className="input" value={setup.trading.apiSecret} onChange={(e) => updateSection(setSetup, "trading", { apiSecret: e.target.value })} /></label>
            <label className="field">Mining wallet label<input className="input" value={setup.mining.walletLabel} onChange={(e) => updateSection(setSetup, "mining", { walletLabel: e.target.value })} /></label>
            <label className="field">Mining wallet address<textarea className="input" rows={2} value={setup.mining.walletAddress} onChange={(e) => updateSection(setSetup, "mining", { walletAddress: e.target.value })} /></label>
            <label className="field">Pool name<input className="input" value={setup.mining.poolName} onChange={(e) => updateSection(setSetup, "mining", { poolName: e.target.value })} /></label>
            <label className="field">Worker name<input className="input" value={setup.mining.workerName} onChange={(e) => updateSection(setSetup, "mining", { workerName: e.target.value })} /></label>
            <label className="field">Dashboard URL<input className="input" value={setup.mining.dashboardUrl} onChange={(e) => updateSection(setSetup, "mining", { dashboardUrl: e.target.value })} /></label>
            <label className="field">Power cost / kWh<input className="input" value={setup.mining.powerCostKwh} onChange={(e) => updateSection(setSetup, "mining", { powerCostKwh: e.target.value })} /></label>
          </div>
        </div>

        <div className="card" style={{ background: "rgba(13,17,25,0.36)" }}>
          <div className="h">Grow + cameras + games</div>
          <div className="grid2" style={{ marginTop: 10 }}>
            <label className="field">Grow room label<input className="input" value={setup.grow.roomLabel} onChange={(e) => updateSection(setSetup, "grow", { roomLabel: e.target.value })} /></label>
            <label className="field">Grow stage<select className="input" value={setup.grow.stage} onChange={(e) => updateSection(setSetup, "grow", { stage: e.target.value as MasterSetup["grow"]["stage"] })}><option value="seedling">Seedling</option><option value="veg">Veg</option><option value="flower">Flower</option><option value="dry">Dry</option></select></label>
            <label className="field">Lights on<input className="input" value={setup.grow.lightsOn} onChange={(e) => updateSection(setSetup, "grow", { lightsOn: e.target.value })} /></label>
            <label className="field">Lights off<input className="input" value={setup.grow.lightsOff} onChange={(e) => updateSection(setSetup, "grow", { lightsOff: e.target.value })} /></label>
            <label className="field">Home Assistant URL<input className="input" value={setup.grow.haUrl} onChange={(e) => updateSection(setSetup, "grow", { haUrl: e.target.value })} /></label>
            <label className="field">HA token<input className="input" value={setup.grow.haToken} onChange={(e) => updateSection(setSetup, "grow", { haToken: e.target.value })} /></label>
            <label className="field">Device slug<input className="input" value={setup.grow.deviceSlug} onChange={(e) => updateSection(setSetup, "grow", { deviceSlug: e.target.value })} /></label>
            <label className="field">Temp entity<input className="input" value={setup.grow.tempEntity} onChange={(e) => updateSection(setSetup, "grow", { tempEntity: e.target.value })} /></label>
            <label className="field">RH entity<input className="input" value={setup.grow.rhEntity} onChange={(e) => updateSection(setSetup, "grow", { rhEntity: e.target.value })} /></label>
            <label className="field">Camera wall label<input className="input" value={setup.cameras.wallLabel} onChange={(e) => updateSection(setSetup, "cameras", { wallLabel: e.target.value })} /></label>
            <label className="field">Frigate URL<input className="input" value={setup.cameras.frigateUrl} onChange={(e) => updateSection(setSetup, "cameras", { frigateUrl: e.target.value })} /></label>
            <label className="field">Grid<select className="input" value={setup.cameras.defaultGrid} onChange={(e) => updateSection(setSetup, "cameras", { defaultGrid: e.target.value as MasterSetup["cameras"]["defaultGrid"] })}><option value="2x2">2x2</option><option value="3x2">3x2</option><option value="3x3">3x3</option><option value="4x3">4x3</option><option value="6x2">6x2</option></select></label>
            <label className="field">NVR host<input className="input" value={setup.cameras.nvrHost} onChange={(e) => updateSection(setSetup, "cameras", { nvrHost: e.target.value })} /></label>
            <label className="field">NVR user<input className="input" value={setup.cameras.nvrUser} onChange={(e) => updateSection(setSetup, "cameras", { nvrUser: e.target.value })} /></label>
            <label className="field">NVR password<input className="input" value={setup.cameras.nvrPass} onChange={(e) => updateSection(setSetup, "cameras", { nvrPass: e.target.value })} /></label>
            <label className="field">ZBD handle<input className="input" value={setup.games.zbdHandle} onChange={(e) => updateSection(setSetup, "games", { zbdHandle: e.target.value })} /></label>
            <label className="field">ZBD API key<input className="input" value={setup.games.zbdApiKey} onChange={(e) => updateSection(setSetup, "games", { zbdApiKey: e.target.value })} /></label>
            <label className="field">Prolific email<input className="input" value={setup.games.prolificEmail} onChange={(e) => updateSection(setSetup, "games", { prolificEmail: e.target.value })} /></label>
            <label className="field">Survey email<input className="input" value={setup.games.surveyEmail} onChange={(e) => updateSection(setSetup, "games", { surveyEmail: e.target.value })} /></label>
            <label className="field">Preferred emulator<select className="input" value={setup.games.preferredEmulator} onChange={(e) => updateSection(setSetup, "games", { preferredEmulator: e.target.value as MasterSetup["games"]["preferredEmulator"] })}><option value="auto">Auto</option><option value="bluestacks">BlueStacks</option><option value="ldplayer">LDPlayer</option><option value="nox">Nox</option><option value="memu">MEmu</option><option value="androidstudio">Android Studio</option></select></label>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, background: "rgba(13,17,25,0.36)" }}>
        <div className="h">Routine seeds</div>
        <div className="sub">These get pushed into Routine Launcher automatically when you apply the wizard.</div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <label className="field">Morning routine<textarea className="input" rows={4} value={setup.routines.morning} onChange={(e) => updateSection(setSetup, "routines", { morning: e.target.value })} /></label>
          <label className="field">Recovery routine<textarea className="input" rows={4} value={setup.routines.recovery} onChange={(e) => updateSection(setSetup, "routines", { recovery: e.target.value })} /></label>
          <label className="field">Money routine<textarea className="input" rows={4} value={setup.routines.money} onChange={(e) => updateSection(setSetup, "routines", { money: e.target.value })} /></label>
          <label className="field">Shutdown routine<textarea className="input" rows={4} value={setup.routines.shutdown} onChange={(e) => updateSection(setSetup, "routines", { shutdown: e.target.value })} /></label>
        </div>
      </div>
    </div>
  );
}
