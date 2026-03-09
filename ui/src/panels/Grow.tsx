import React, { useCallback, useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { pushNotif } from "../lib/notifs";
import { isDesktop, oddApi } from "../lib/odd";
import { loadPrefs } from "../lib/prefs";
import { acknowledgePanelAction, getPanelActions, PANEL_ACTION_EVENT, rememberActionOutcome, type PanelActionEnvelope } from "../lib/brain";
import { PanelHeader } from "../components/PanelHeader";

type Profile = {
  name: string;
  size: string;
  stage: "seedling" | "veg" | "flower" | "dry";
  lightsOn: string;
  lightsOff: string;
  notes: string;
};

type ReadingSource = "manual" | "live" | "demo";
type Reading = { ts: number; tempF: number; rh: number; vpd: number; source?: ReadingSource };

type LiveCfg = {
  enabled: boolean;
  source: "ha_acinfinity";
  haUrl: string;
  token: string;
  tempEntity: string;
  rhEntity: string;
  deviceSlug: string;
  pollSec: number;
  autoLog: boolean;
  lastSyncTs: number | null;
  lastError: string;
};

type PlannerCfg = {
  enabled: boolean;
  runName: string;
  cultivar: string;
  medium: string;
  roomCount: number;
  startDate: string;
  vegWeeks: number;
  flowerWeeks: number;
  dryDays: number;
  targetTempDay: number;
  targetRhDay: number;
  targetTempNight: number;
  targetRhNight: number;
  notes: string;
};

type DemoScenario = "veg_day" | "flower_day" | "lights_off" | "hot_dry_stress" | "cold_wet_stress";
type DemoCfg = {
  enabled: boolean;
  autoRun: boolean;
  autoLog: boolean;
  intervalSec: number;
  scenario: DemoScenario;
  lastTickTs: number | null;
};

type StatusBadge = { label: string; tone: "good" | "warn" | "bad" | "muted" };

const KEY_P = "oddengine:grow:profile";
const KEY_R = "oddengine:grow:readings";
const KEY_PY = "oddengine:grow:pythonCmd";
const KEY_L = "oddengine:grow:live:v2";
const KEY_PLAN = "oddengine:grow:planner:v1";
const KEY_DEMO = "oddengine:grow:demo:v1";
const KEY_SESSION = "oddengine:grow:session:v1";

function calcVpd(tempF: number, rh: number) {
  const tempC = (tempF - 32) * (5 / 9);
  const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const avp = svp * (rh / 100);
  return Math.max(0, svp - avp);
}

function normalizeSlug(v: string) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function acInfinityEntitySuggestions(deviceSlug: string) {
  const slug = normalizeSlug(deviceSlug);
  if (!slug) return { temp: "", rh: "" };
  return {
    temp: `sensor.${slug}_temperature`,
    rh: `sensor.${slug}_humidity`,
  };
}

function convertTempToF(value: number, unit?: string) {
  const u = String(unit || "").trim().toLowerCase();
  if (u === "°c" || u === "c" || u === "celsius") return value * 9 / 5 + 32;
  return value;
}

function readNumericField(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function prettyAgo(ts: number | null) {
  if (!ts) return "Never";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 5) return "Just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number) {
  if (!iso) return "";
  const base = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + days);
  return toIsoDate(base);
}

function diffDaysFromToday(iso: string) {
  if (!iso) return null;
  const target = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const todayMid = new Date(`${toIsoDate(today)}T12:00:00`);
  return Math.round((target.getTime() - todayMid.getTime()) / 86_400_000);
}

function isLightsOnNow(profile: Profile) {
  const nowHour = new Date().getHours();
  const lightsOnHour = Number(String(profile.lightsOn || "06:00").split(":")[0] || 6);
  const lightsOffHour = Number(String(profile.lightsOff || "00:00").split(":")[0] || 0);
  return lightsOnHour === lightsOffHour
    ? true
    : lightsOnHour < lightsOffHour
      ? nowHour >= lightsOnHour && nowHour < lightsOffHour
      : nowHour >= lightsOnHour || nowHour < lightsOffHour;
}

function stageRoutineCopy(stage: Profile["stage"]) {
  switch (stage) {
    case "seedling":
      return {
        title: "Seedling routine",
        body: "Keep the root zone gentle, avoid overwatering, and focus on stable temperature / RH instead of chasing speed.",
        steps: ["Low-intensity lights", "Gentle air movement", "Check moisture before each watering"],
      };
    case "veg":
      return {
        title: "Veg routine",
        body: "Push healthy structure, keep VPD in range, and prep the room for a clean flip instead of reacting late.",
        steps: ["Train + canopy check", "Watch dryback rhythm", "Prep flip date + room reset list"],
      };
    case "flower":
      return {
        title: "Flower routine",
        body: "Protect airflow and consistency. Prioritize stable RH, support weight, and catch stress before it steals quality.",
        steps: ["Inspect support + airflow", "Keep RH tighter at night", "Watch EC / uptake / fade notes"],
      };
    case "dry":
      return {
        title: "Dry routine",
        body: "Think slow and steady. Protect terps, avoid overdrying, and log finish timing for the next run.",
        steps: ["Lower airflow aggression", "Track RH swing", "Log trim / jar timing"],
      };
    default:
      return {
        title: "Grow routine",
        body: "Stay consistent and keep the room readable before making changes.",
        steps: ["Check climate", "Review feed plan", "Log what changed"],
      };
  }
}

function scenarioPreset(s: DemoScenario) {
  switch (s) {
    case "veg_day": return { tempF: 79, rh: 63, label: "Veg day" };
    case "flower_day": return { tempF: 77, rh: 53, label: "Flower day" };
    case "lights_off": return { tempF: 69, rh: 60, label: "Lights off" };
    case "hot_dry_stress": return { tempF: 87, rh: 38, label: "Hot / dry stress" };
    case "cold_wet_stress": return { tempF: 64, rh: 78, label: "Cold / wet stress" };
    default: return { tempF: 78, rh: 55, label: "Demo" };
  }
}

function nextDemoReading(s: DemoScenario) {
  const preset = scenarioPreset(s);
  const cycle = Date.now() / 60_000;
  const wobbleA = Math.sin(cycle / 1.7) * 1.2;
  const wobbleB = Math.cos(cycle / 2.3) * 2.8;
  const tempF = Number((preset.tempF + wobbleA).toFixed(1));
  const rh = Number(Math.max(20, Math.min(90, preset.rh + wobbleB)).toFixed(1));
  return { tempF, rh, label: preset.label };
}

function badgeStyle(tone: StatusBadge["tone"]): React.CSSProperties {
  if (tone === "good") return { borderColor: "rgba(16,185,129,0.35)", color: "#34d399", background: "rgba(16,185,129,0.08)" };
  if (tone === "warn") return { borderColor: "rgba(245,158,11,0.35)", color: "#fbbf24", background: "rgba(245,158,11,0.08)" };
  if (tone === "bad") return { borderColor: "rgba(244,63,94,0.35)", color: "#fb7185", background: "rgba(244,63,94,0.08)" };
  return { borderColor: "rgba(148,163,184,0.25)", color: "#cbd5e1", background: "rgba(148,163,184,0.07)" };
}

export default function Grow() {
  const [profile, setProfile] = useState<Profile>(() => loadJSON(KEY_P, {
    name: "", size: "", stage: "veg", lightsOn: "06:00", lightsOff: "00:00", notes: ""
  }));
  useEffect(() => {
    try {
      const has = localStorage.getItem(KEY_P);
      if (!has) {
        const prefs = loadPrefs();
        if (prefs?.grow) {
          setProfile((p) => ({ ...p, ...prefs.grow }));
          pushNotif({ title: "Grow defaults", body: "Loaded defaults from Preferences.", tags: ["Grow"], level: "success" });
        }
      }
    } catch {}
  }, []);

  const [readings, setReadings] = useState<Reading[]>(() => loadJSON(KEY_R, []));
  const growSession = loadJSON<any>(KEY_SESSION, { tempF: 78, rh: 55 });
  const [tempF, setTempF] = useState(() => Number(growSession?.tempF ?? 78));
  const [rh, setRh] = useState(() => Number(growSession?.rh ?? 55));
  const [sys, setSys] = useState<{ ok: boolean; userData?: string; bundlesDir?: string; growOsDir?: string; packaged?: boolean; appVersion?: string } | null>(null);
  const [pythonCmd, setPythonCmd] = useState<string>(() => loadJSON(KEY_PY, "python"));
  const [live, setLive] = useState<LiveCfg>(() => loadJSON(KEY_L, {
    enabled: false,
    source: "ha_acinfinity",
    haUrl: "http://homeassistant.local:8123",
    token: "",
    tempEntity: "",
    rhEntity: "",
    deviceSlug: "",
    pollSec: 15,
    autoLog: true,
    lastSyncTs: null,
    lastError: "",
  }));
  const [planner, setPlanner] = useState<PlannerCfg>(() => loadJSON(KEY_PLAN, {
    enabled: true,
    runName: "Next tent run",
    cultivar: "",
    medium: "Coco",
    roomCount: 1,
    startDate: toIsoDate(new Date()),
    vegWeeks: 4,
    flowerWeeks: 9,
    dryDays: 10,
    targetTempDay: 79,
    targetRhDay: 62,
    targetTempNight: 69,
    targetRhNight: 58,
    notes: "Prep room, clean tent, stage feed plan, calibrate sensors.",
  }));
  const [demo, setDemo] = useState<DemoCfg>(() => loadJSON(KEY_DEMO, {
    enabled: false,
    autoRun: false,
    autoLog: false,
    intervalSec: 20,
    scenario: "veg_day",
    lastTickTs: null,
  }));
  const [growRunId, setGrowRunId] = useState<string | null>(null);
  const [embedGodMode, setEmbedGodMode] = useState<boolean>(false);

  const vpd = useMemo(() => calcVpd(tempF, rh), [tempF, rh]);
  const acHints = useMemo(() => acInfinityEntitySuggestions(live.deviceSlug), [live.deviceSlug]);

  const plannerDerived = useMemo(() => {
    const start = planner.startDate || toIsoDate(new Date());
    const flipDate = addDays(start, Math.max(0, Math.round(planner.vegWeeks * 7)));
    const harvestDate = addDays(flipDate, Math.max(0, Math.round(planner.flowerWeeks * 7)));
    const dryDoneDate = addDays(harvestDate, Math.max(0, Math.round(planner.dryDays)));
    const daysToFlip = diffDaysFromToday(flipDate);
    const daysToHarvest = diffDaysFromToday(harvestDate);
    const today = toIsoDate(new Date());
    let stage: Profile["stage"] = "seedling";
    if (today >= harvestDate) stage = "dry";
    else if (today >= flipDate) stage = "flower";
    else stage = "veg";
    return { start, flipDate, harvestDate, dryDoneDate, daysToFlip, daysToHarvest, stage };
  }, [planner]);

  const liveHasConfig = Boolean(live.haUrl && live.token && live.tempEntity && live.rhEntity);
  const liveStale = Boolean(live.enabled && live.lastSyncTs && (Date.now() - live.lastSyncTs) > Math.max(90_000, (Number(live.pollSec || 15) * 1000 * 2.5)));

  const sourceBadges = useMemo<StatusBadge[]>(() => {
    const out: StatusBadge[] = [];
    if (planner.enabled) out.push({ label: "Planner mode", tone: "muted" });
    if (demo.enabled) out.push({ label: demo.autoRun ? "Demo streaming" : "Demo ready", tone: "warn" });
    if (live.enabled) {
      if (!liveHasConfig) out.push({ label: "Waiting for HA config", tone: "warn" });
      else if (live.lastError) out.push({ label: "Sync error", tone: "bad" });
      else if (!live.lastSyncTs) out.push({ label: "Waiting first sync", tone: "warn" });
      else if (liveStale) out.push({ label: "Live source stale", tone: "warn" });
      else out.push({ label: "Live source connected", tone: "good" });
    } else if (!demo.enabled) {
      out.push({ label: "Tent offline / cleaning", tone: "muted" });
    }
    return out;
  }, [demo.autoRun, demo.enabled, live.enabled, live.lastError, live.lastSyncTs, liveHasConfig, liveStale, planner.enabled]);

  const activeStage = planner.enabled ? plannerDerived.stage : profile.stage;
  const stageRoutine = useMemo(() => stageRoutineCopy(activeStage), [activeStage]);
  const lightsOnNow = useMemo(() => isLightsOnNow(profile), [profile]);

  const envTrend = useMemo(() => {
    const recent = (readings || []).slice(0, 6);
    if (!recent.length) {
      return {
        title: "No logged trend yet",
        body: "Save or stream a few readings to unlock trend bias, drift warnings, and stage-aware coaching.",
        badgeTone: "muted" as const,
        chips: ["Need 1+ readings", `${tempF.toFixed(1)}F live panel`, `${rh.toFixed(1)}% RH current`],
      };
    }
    const ordered = [...recent].reverse();
    const avgTemp = ordered.reduce((sum, item) => sum + item.tempF, 0) / ordered.length;
    const avgRh = ordered.reduce((sum, item) => sum + item.rh, 0) / ordered.length;
    const latest = recent[0];
    const oldest = ordered[0];
    const tempDelta = latest.tempF - oldest.tempF;
    const rhDelta = latest.rh - oldest.rh;
    const driftBits: string[] = [];
    if (Math.abs(tempDelta) >= 1.5) driftBits.push(`${tempDelta > 0 ? "+" : ""}${tempDelta.toFixed(1)}F temp drift`);
    if (Math.abs(rhDelta) >= 3) driftBits.push(`${rhDelta > 0 ? "+" : ""}${rhDelta.toFixed(1)}% RH drift`);
    const badgeTone: "good" | "warn" | "bad" | "muted" = Math.abs(tempDelta) > 4 || Math.abs(rhDelta) > 8 ? "bad" : Math.abs(tempDelta) > 2 || Math.abs(rhDelta) > 4 ? "warn" : "good";
    const title = !driftBits.length ? "Stable canopy climate" : tempDelta > 1.5 && rhDelta < -2 ? "Room is running hotter / drier" : tempDelta < -1.5 && rhDelta > 2 ? "Room is cooling with moisture building" : "Climate drift detected";
    return {
      title,
      body: `Last ${recent.length} readings average ${avgTemp.toFixed(1)}F / ${avgRh.toFixed(1)}% RH. ${driftBits.length ? driftBits.join(" • ") : "Trend is holding steady enough to trust your next move."}`,
      badgeTone,
      chips: [`Avg VPD ${ (ordered.reduce((sum, item) => sum + item.vpd, 0) / ordered.length).toFixed(2) }`, `${prettyAgo(latest.ts)} latest log`, latest.source ? `${latest.source} source` : "manual source"],
    };
  }, [readings, rh, tempF]);

  const stressWatch = useMemo(() => {
    const notes: string[] = [];
    const actions: string[] = [];
    let tone: "good" | "warn" | "bad" | "muted" = "good";
    const currentVpd = Number(vpd.toFixed(2));
    if (activeStage === "veg") {
      if (currentVpd > 1.35) { notes.push("Veg VPD is running a little thirsty."); actions.push("Raise RH or ease leaf-temp pressure before pushing feed harder."); tone = "warn"; }
      if (currentVpd < 0.75) { notes.push("Veg VPD is a bit too soft."); actions.push("Reduce humidity or increase airflow so uptake stays moving."); tone = tone === "warn" ? "warn" : "bad"; }
    } else if (activeStage === "flower") {
      if (currentVpd > 1.55) { notes.push("Flower room is leaning dry."); actions.push("Watch edge curl / heavy transpiration before increasing power."); tone = "warn"; }
      if (rh > 60) { notes.push("Flower RH is elevated for density."); actions.push("Night-time RH control and airflow are the priority."); tone = "bad"; }
    } else if (activeStage === "dry") {
      if (tempF > 72) { notes.push("Dry room is warmer than ideal."); actions.push("Cool the room slightly to protect terps."); tone = "warn"; }
      if (rh < 52) { notes.push("Dry room may finish too fast."); actions.push("Bring RH up gently to avoid brittle finish."); tone = tone === "warn" ? "warn" : "bad"; }
    }
    if (tempF >= 85) { notes.push("Leaf zone is hot enough to stress the plant."); actions.push("Back off heat or intensity before making feed changes."); tone = "bad"; }
    if (rh >= 78) { notes.push("Humidity is high enough to create wet-pressure risk."); actions.push("Increase exchange and inspect dead spots."); tone = "bad"; }
    if (!notes.length) {
      return {
        title: "No major stress flags",
        body: `Current environment is ${tempF.toFixed(1)}F / ${rh.toFixed(1)}% RH with VPD ${currentVpd.toFixed(2)}. Keep the room boring and consistent.`,
        tone: "good" as const,
        actions: [lightsOnNow ? "Stay on daytime targets." : "Guard the lights-off humidity swing.", planner.enabled ? `Flip target ${plannerDerived.flipDate}` : "Planner disabled"],
      };
    }
    return {
      title: notes[0],
      body: notes.join(" "),
      tone,
      actions: actions.slice(0, 3),
    };
  }, [activeStage, lightsOnNow, planner.enabled, plannerDerived.flipDate, rh, tempF, vpd]);

  const plannerFocus = useMemo(() => {
    const nextGate = plannerDerived.stage === "flower" ? plannerDerived.harvestDate : plannerDerived.flipDate;
    const nextLabel = plannerDerived.stage === "flower" ? "Harvest gate" : "Flip gate";
    const daysOut = plannerDerived.stage === "flower" ? plannerDerived.daysToHarvest : plannerDerived.daysToFlip;
    return {
      title: `${nextLabel}: ${nextGate}`,
      body: planner.enabled
        ? `${planner.runName || "Planner"} is staged for ${plannerDerived.stage}. ${daysOut === null ? "Set a start date to calculate timing." : daysOut >= 0 ? `${daysOut} day${daysOut === 1 ? "" : "s"} until the next major handoff.` : `${Math.abs(daysOut)} day${Math.abs(daysOut) === 1 ? "" : "s"} past the target gate — update the run plan.`}`
        : "Enable planner mode to track the next flip, harvest, and dry milestones.",
      chips: [planner.medium || "Medium TBD", planner.cultivar || "Cultivar TBD", `${planner.roomCount} room${planner.roomCount === 1 ? "" : "s"}`],
    };
  }, [planner.enabled, planner.medium, planner.cultivar, planner.roomCount, planner.runName, plannerDerived.daysToFlip, plannerDerived.daysToHarvest, plannerDerived.flipDate, plannerDerived.harvestDate, plannerDerived.stage]);

  useEffect(() => {
    if (!isDesktop()) return;
    oddApi().getSystemInfo().then((r: any) => setSys(r)).catch(() => {});
  }, []);

  useEffect(() => {
    try { saveJSON(KEY_L, live); } catch {}
  }, [live]);

  useEffect(() => {
    try { saveJSON(KEY_PLAN, planner); } catch {}
  }, [planner]);

  useEffect(() => {
    try { saveJSON(KEY_DEMO, demo); } catch {}
  }, [demo]);

  useEffect(() => {
    try { saveJSON(KEY_SESSION, { tempF, rh }); } catch {}
  }, [tempF, rh]);

  async function fetchHaState(entityId: string) {
    const base = String(live.haUrl || "").replace(/\/+$/, "");
    const url = `${base}/api/states/${encodeURIComponent(entityId)}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (live.token) headers["Authorization"] = `Bearer ${live.token}`;
    if (isDesktop()) {
      const r: any = await oddApi().fetchText({ url, headers, timeoutMs: 12000, maxBytes: 800_000 });
      if (!r?.ok) throw new Error(r?.error || "fetch failed");
      return JSON.parse(String(r.text || "{}"));
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  function parseHaTemp(obj: any) {
    const direct = readNumericField(obj?.state);
    const attrs = obj?.attributes || {};
    const attrCandidate = [attrs.temperature, attrs.temp, attrs.value].map(readNumericField).find(Number.isFinite);
    const value = Number.isFinite(direct) ? direct : attrCandidate;
    if (!Number.isFinite(value)) return NaN;
    return convertTempToF(Number(value), attrs.unit_of_measurement || attrs.unit);
  }

  function parseHaRh(obj: any) {
    const direct = readNumericField(obj?.state);
    const attrs = obj?.attributes || {};
    const attrCandidate = [attrs.humidity, attrs.relative_humidity, attrs.rh, attrs.value].map(readNumericField).find(Number.isFinite);
    const value = Number.isFinite(direct) ? direct : attrCandidate;
    if (!Number.isFinite(value)) return NaN;
    return Number(value);
  }

  const appendReading = useCallback((nextTempF: number, nextRh: number, source: ReadingSource) => {
    const next: Reading = {
      ts: Date.now(),
      tempF: Number(nextTempF.toFixed(1)),
      rh: Number(nextRh.toFixed(1)),
      vpd: Number(calcVpd(nextTempF, nextRh).toFixed(2)),
      source,
    };
    setReadings((prev) => {
      const last = prev?.[0];
      const tooSoon = last && (Date.now() - last.ts) < 45_000;
      const sameEnough = last && Math.abs(last.tempF - next.tempF) < 0.15 && Math.abs(last.rh - next.rh) < 0.15 && last.source === source;
      const merged = (tooSoon && sameEnough)
        ? [{ ...last, ...next }, ...(prev || []).slice(1)]
        : [next, ...(prev || [])].slice(0, 300);
      saveJSON(KEY_R, merged);
      return merged;
    });
  }, []);

  const syncLiveNow = useCallback(async (showToast = false) => {
    if (!live.haUrl || !live.token || !live.tempEntity || !live.rhEntity) {
      throw new Error("Fill Home Assistant URL, token, temp entity, and RH entity.");
    }
    const [tObj, hObj] = await Promise.all([fetchHaState(live.tempEntity), fetchHaState(live.rhEntity)]);
    const nextTempF = parseHaTemp(tObj);
    const nextRh = parseHaRh(hObj);
    if (!Number.isFinite(nextTempF) || !Number.isFinite(nextRh)) throw new Error("Could not parse sensor values.");
    setTempF(Number(nextTempF.toFixed(1)));
    setRh(Number(nextRh.toFixed(1)));
    setLive((v) => ({ ...v, lastSyncTs: Date.now(), lastError: "" }));
    if (live.autoLog) appendReading(nextTempF, nextRh, "live");
    if (showToast) {
      pushNotif({ title: "Grow", body: `AC Infinity live sync OK: ${nextTempF.toFixed(1)}F / ${nextRh.toFixed(1)}%`, tags: ["Grow"], level: "success" });
    }
    return { nextTempF, nextRh };
  }, [appendReading, live.autoLog, live.haUrl, live.rhEntity, live.tempEntity, live.token]);

  const runDemoTick = useCallback((showToast = false) => {
    const next = nextDemoReading(demo.scenario);
    setTempF(next.tempF);
    setRh(next.rh);
    setDemo((v) => ({ ...v, lastTickTs: Date.now() }));
    if (demo.autoLog) appendReading(next.tempF, next.rh, "demo");
    if (showToast) {
      pushNotif({ title: "Grow", body: `${next.label} demo applied: ${next.tempF.toFixed(1)}F / ${next.rh.toFixed(1)}%`, tags: ["Grow"], level: "info" });
    }
    return next;
  }, [appendReading, demo.autoLog, demo.scenario]);

  useEffect(() => {
    if (!live.enabled) return;
    if (!liveHasConfig) return;
    let stopped = false;
    const pollMs = Math.max(5, Number(live.pollSec || 15)) * 1000;
    const runOnce = async () => {
      try {
        await syncLiveNow(false);
      } catch (e: any) {
        if (!stopped) {
          const msg = e?.message || String(e);
          setLive((v) => ({ ...v, lastError: msg }));
        }
      }
    };
    runOnce();
    const id = window.setInterval(runOnce, pollMs);
    return () => { stopped = true; window.clearInterval(id); };
  }, [live.enabled, live.pollSec, liveHasConfig, syncLiveNow]);

  useEffect(() => {
    if (!demo.enabled || !demo.autoRun) return;
    const intervalMs = Math.max(5, Number(demo.intervalSec || 20)) * 1000;
    runDemoTick(false);
    const id = window.setInterval(() => runDemoTick(false), intervalMs);
    return () => window.clearInterval(id);
  }, [demo.autoRun, demo.enabled, demo.intervalSec, runDemoTick]);

  function saveProfile() {
    saveJSON(KEY_P, profile.name.trim() ? profile : null);
    pushNotif({ title: "Grow", body: "Saved tent profile.", tags: ["Grow"], level: "success" });
  }

  function saveManualReading() {
    appendReading(tempF, rh, "manual");
    pushNotif({ title: "Grow", body: `Saved reading: ${tempF}F / ${rh}% (VPD ${vpd.toFixed(2)})`, tags: ["Grow"], level: "info" });
  }

  function persistPython(cmd: string) {
    setPythonCmd(cmd);
    saveJSON(KEY_PY, cmd);
  }

  function applyAcInfinityPreset() {
    const suggested = acInfinityEntitySuggestions(live.deviceSlug || profile.name || "tent");
    setLive((v) => ({
      ...v,
      source: "ha_acinfinity",
      haUrl: v.haUrl || "http://homeassistant.local:8123",
      tempEntity: suggested.temp || v.tempEntity,
      rhEntity: suggested.rh || v.rhEntity,
      pollSec: Math.max(10, Number(v.pollSec || 15)),
    }));
    pushNotif({ title: "Grow", body: "Applied AC Infinity/Home Assistant preset. Review entity IDs before enabling live import.", tags: ["Grow"], level: "success" });
  }

  function applyPlannerTargets() {
    const nowHour = new Date().getHours();
    const lightsOnHour = Number(String(profile.lightsOn || "06:00").split(":")[0] || 6);
    const lightsOffHour = Number(String(profile.lightsOff || "00:00").split(":")[0] || 0);
    const isDay = lightsOnHour === lightsOffHour ? true : (lightsOnHour < lightsOffHour ? (nowHour >= lightsOnHour && nowHour < lightsOffHour) : (nowHour >= lightsOnHour || nowHour < lightsOffHour));
    const nextTemp = isDay ? planner.targetTempDay : planner.targetTempNight;
    const nextRh = isDay ? planner.targetRhDay : planner.targetRhNight;
    setTempF(nextTemp);
    setRh(nextRh);
    pushNotif({ title: "Grow", body: `Planner targets loaded (${isDay ? "day" : "night"}): ${nextTemp}F / ${nextRh}%`, tags: ["Grow"], level: "success" });
  }

  function loadPlannerIntoProfile() {
    setProfile((p) => ({
      ...p,
      name: planner.runName || p.name,
      size: p.size || `${Math.max(1, Number(planner.roomCount || 1))} room`,
      stage: plannerDerived.stage,
      notes: [planner.notes, planner.cultivar ? `Cultivar: ${planner.cultivar}` : "", planner.medium ? `Medium: ${planner.medium}` : ""].filter(Boolean).join("\n"),
    }));
    pushNotif({ title: "Grow", body: "Planner loaded into the tent profile draft.", tags: ["Grow"], level: "success" });
  }


async function sendPlannerToGodMode(showToast = true) {
  if (!isDesktop()) {
    if (showToast) pushNotif({ title: "Grow", body: "Desktop mode required to hand off planner data to GOD MODE.", tags: ["Grow"], level: "warn" });
    return null;
  }
  const payload = {
    profile,
    planner,
    derived: plannerDerived,
    environment: {
      tempF,
      rh,
      vpd: Number(vpd.toFixed(2)),
    },
    live: {
      deviceSlug: live.deviceSlug,
      tempEntity: live.tempEntity,
      rhEntity: live.rhEntity,
      haUrl: live.haUrl,
    },
  };
  const res: any = await oddApi().growPlannerHandoff(payload);
  if (res?.ok) {
    if (showToast) {
      pushNotif({
        title: "Grow",
        body: `Planner sent to GOD MODE${res?.roomsUpdated ? ` (${res.roomsUpdated} room${res.roomsUpdated === 1 ? "" : "s"})` : ""}.`,
        tags: ["Grow"],
        level: "success"
      });
    }
    return res;
  }
  const msg = res?.error || "unknown";
  if (showToast) pushNotif({ title: "Grow", body: `Planner handoff failed: ${msg}`, tags: ["Grow"], level: "error" });
  throw new Error(msg);
}

  async function installGrowDeps() {
    if (!isDesktop()) return pushNotif({ title: "Grow", body: "Desktop mode required to run installers.", tags: ["Grow"], level: "warn" });
    const growDir = sys?.growOsDir;
    if (!growDir) return pushNotif({ title: "Grow", body: "Grow OS bundle path not found.", tags: ["Grow"], level: "error" });
    const res = await oddApi().run({ cmd: pythonCmd, args: ["-m", "pip", "install", "-r", "requirements.txt"], cwd: growDir });
    if (res?.ok) {
      pushNotif({ title: "Grow", body: "Installing Grow OS deps… check Dev Engine logs.", tags: ["Grow"], level: "info" });
    } else {
      pushNotif({ title: "Grow", body: `Install failed: ${res?.error || "unknown"}`, tags: ["Grow"], level: "error" });
    }
  }

  async function launchGrowOS() {
    if (!isDesktop()) return pushNotif({ title: "Grow", body: "Desktop mode required to launch Grow OS.", tags: ["Grow"], level: "warn" });
    const growDir = sys?.growOsDir;
    if (!growDir) return pushNotif({ title: "Grow", body: "Grow OS bundle path not found.", tags: ["Grow"], level: "error" });
    try {
      await sendPlannerToGodMode(false);
    } catch {}
    const res = await oddApi().run({
      cmd: pythonCmd,
      args: [
        "-m", "streamlit", "run", "app.py",
        "--server.address", "127.0.0.1",
        "--server.port", "8501",
        "--server.headless", "true",
        "--server.enableCORS", "false",
        "--server.enableXsrfProtection", "false",
      ],
      cwd: growDir
    });
    if (res?.ok) {
      setGrowRunId(res.id);
      pushNotif({ title: "Grow", body: "Grow OS launching…", tags: ["Grow"], level: "success" });
      if (!embedGodMode) window.open("http://127.0.0.1:8501", "_blank");
    } else {
      pushNotif({ title: "Grow", body: `Launch failed: ${res?.error || "unknown"}`, tags: ["Grow"], level: "error" });
    }
  }

  async function stopGrowOS() {
    if (!isDesktop() || !growRunId) return;
    await oddApi().stopRun(growRunId);
    setGrowRunId(null);
    pushNotif({ title: "Grow", body: "Stopped Grow OS process.", tags: ["Grow"], level: "info" });
  }

  async function updateGrowBundle() {
    if (!isDesktop()) return pushNotif({ title: "Grow", body: "Desktop mode required.", tags: ["Grow"], level: "warn" });
    const res: any = await oddApi().updateGrowBundle();
    if (res?.ok) {
      try { const info: any = await oddApi().getSystemInfo(); setSys(info); } catch {}
      pushNotif({ title: "Grow", body: `Grow OS bundle updated${res?.version ? ` (${res.version})` : ""}.`, tags: ["Grow"], level: "success" });
    } else {
      pushNotif({ title: "Grow", body: `Update failed: ${res?.error || "unknown"}`, tags: ["Grow"], level: "error" });
    }
  }

  function handlePanelAction(envelope: PanelActionEnvelope) {
    try {
      if (envelope.actionId === "grow:apply-targets") {
        applyPlannerTargets();
        return;
      }
      if (envelope.actionId === "grow:save-reading") {
        saveManualReading();
        return;
      }
      if (envelope.actionId === "grow:load-planner-profile") {
        const next = {
          ...profile,
          name: planner.runName || profile.name,
          size: profile.size || `${Math.max(1, Number(planner.roomCount || 1))} room`,
          stage: plannerDerived.stage,
          notes: [planner.notes, planner.cultivar ? `Cultivar: ${planner.cultivar}` : "", planner.medium ? `Medium: ${planner.medium}` : ""].filter(Boolean).join("\n"),
        };
        setProfile(next);
        saveJSON(KEY_P, next.name.trim() ? next : null);
        pushNotif({ title: "Grow", body: "AI loaded planner details into the saved room profile.", tags: ["Grow", "AI"], level: "success" });
        return;
      }
      if (envelope.actionId === "grow:ac-infinity-preset") {
        applyAcInfinityPreset();
        return;
      }
    } finally {
      acknowledgePanelAction(envelope.id);
    }
  }

  useEffect(() => {
    [...getPanelActions("Grow")].reverse().forEach(handlePanelAction);
    const onAction = (evt: Event) => {
      const detail = (evt as CustomEvent<PanelActionEnvelope>).detail;
      if (detail?.panelId === "Grow") handlePanelAction(detail);
    };
    window.addEventListener(PANEL_ACTION_EVENT, onAction as EventListener);
    return () => window.removeEventListener(PANEL_ACTION_EVENT, onAction as EventListener);
  }, [planner, plannerDerived.stage, profile, tempF, rh, vpd]);

  return (
    <div className="card growPanelRoot">
      <PanelHeader panelId="Grow" title="Grow" storagePrefix="oddengine:grow:" />

      <div className="growHeroBar" style={{ marginTop: 14 }}>
        <div>
          <div className="small shellEyebrow">GROW COMMAND CENTER</div>
          <div className="growHeroTitle">Room status, climate rhythm, and next-run planning in one surface.</div>
          <div className="small growHeroSub">Use live AC Infinity import, planner timing, and stress watch together so the room stays readable before you make changes.</div>
        </div>
        <div className="row wrap growHeroBadges" style={{ justifyContent: "flex-end" }}>
          <span className="badge">Stage {activeStage.toUpperCase()}</span>
          <span className="badge">{lightsOnNow ? "Day targets live" : "Night targets live"}</span>
          <span className="badge">{planner.enabled ? `Flip ${plannerDerived.flipDate}` : "Planner off"}</span>
          <span className="badge" style={badgeStyle(stressWatch.tone)}>{stressWatch.tone === "good" ? "Room steady" : stressWatch.tone === "warn" ? "Adjust soon" : "Priority issue"}</span>
        </div>
      </div>

      <div className="growMetricStrip">
        <div className="card growMetricCard">
          <div className="small shellEyebrow">ROOM CLIMATE</div>
          <div className="growMetricValue">{tempF.toFixed(1)}°F / {rh.toFixed(1)}%</div>
          <div className="small">VPD {vpd.toFixed(2)} kPa • {sourceBadges[0]?.label || "Manual mode"}</div>
        </div>
        <div className="card growMetricCard">
          <div className="small shellEyebrow">TREND BIAS</div>
          <div className="growMetricValue">{envTrend.title}</div>
          <div className="small">{envTrend.chips.slice(0,2).join(" • ")}</div>
        </div>
        <div className="card growMetricCard">
          <div className="small shellEyebrow">NEXT GATE</div>
          <div className="growMetricValue">{plannerFocus.title}</div>
          <div className="small">{planner.enabled ? `${planner.medium || "Medium TBD"} • ${planner.cultivar || "Cultivar TBD"}` : "Enable planner mode for next-run timing."}</div>
        </div>
      </div>

      <div className="quickActionGrid growSpotlightGrid" style={{ marginTop: 14 }}>
        <div className="card spotlightCard">
          <div className="small shellEyebrow">Stage routine</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 4 }}>{stageRoutine.title}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>{stageRoutine.body}</div>
          <div className="small" style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{stageRoutine.steps.map((step, idx) => `${idx + 1}. ${step}`).join("\n")}</div>
          <div className="assistantChipWrap">
            <span className="badge good">{activeStage.toUpperCase()}</span>
            <span className="badge">{lightsOnNow ? "Day targets live" : "Night targets live"}</span>
          </div>
        </div>
        <div className="card spotlightCard">
          <div className="small shellEyebrow">Environment trend</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 4 }}>{envTrend.title}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>{envTrend.body}</div>
          <div className="assistantChipWrap">
            <span className="badge" style={badgeStyle(envTrend.badgeTone)}>{envTrend.badgeTone === "good" ? "Stable bias" : envTrend.badgeTone === "warn" ? "Watch drift" : envTrend.badgeTone === "bad" ? "High drift" : "Trend pending"}</span>
            {envTrend.chips.map((chip) => <span key={chip} className="badge">{chip}</span>)}
          </div>
        </div>
        <div className="card spotlightCard">
          <div className="small shellEyebrow">Stress / deficiency watch</div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 4 }}>{stressWatch.title}</div>
          <div className="small" style={{ marginTop: 8, lineHeight: 1.5 }}>{stressWatch.body}</div>
          <div className="small" style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{stressWatch.actions.map((step) => `• ${step}`).join("\n")}</div>
          <div className="assistantChipWrap">
            <span className="badge" style={badgeStyle(stressWatch.tone)}>{stressWatch.tone === "good" ? "Room looks steady" : stressWatch.tone === "warn" ? "Corrective move" : "Priority issue"}</span>
            <span className="badge">VPD {vpd.toFixed(2)}</span>
            <span className="badge">{plannerFocus.title}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="card growSectionCard">
          <div className="growSectionTitle">Tent / room profile</div>
          <label className="small">Name</label>
          <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="My Tent / Grow Room" />
          <label className="small">Size</label>
          <input value={profile.size} onChange={(e) => setProfile({ ...profile, size: e.target.value })} placeholder="2x4, 4x4, etc." />
          <label className="small">Stage</label>
          <select value={profile.stage} onChange={(e) => setProfile({ ...profile, stage: e.target.value as any })}>
            <option value="seedling">Seedling</option>
            <option value="veg">Veg</option>
            <option value="flower">Flower</option>
            <option value="dry">Dry</option>
          </select>
          <div className="row" style={{ marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="small">Lights ON</label>
              <input value={profile.lightsOn} onChange={(e) => setProfile({ ...profile, lightsOn: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="small">Lights OFF</label>
              <input value={profile.lightsOff} onChange={(e) => setProfile({ ...profile, lightsOff: e.target.value })} />
            </div>
          </div>
          <label className="small">Notes</label>
          <textarea value={profile.notes} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} rows={4} placeholder="Strain, feed plan, reminders..." />
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <button onClick={saveProfile}>Save profile</button>
            <button onClick={() => {
              const prefs = loadPrefs();
              setProfile((p) => ({ ...p, ...prefs.grow }));
              pushNotif({ title: "Grow", body: "Preferences defaults applied.", tags: ["Grow"], level: "success" });
            }}>Use Preferences defaults</button>
            <button onClick={loadPlannerIntoProfile}>Load planner into profile</button>
            <button onClick={() => {
              setProfile({ name: "", size: "", stage: "veg", lightsOn: "06:00", lightsOff: "00:00", notes: "" });
              try { localStorage.removeItem(KEY_P); } catch {}
            }}>Clear</button>
          </div>
        </div>

        <div className="card growSectionCard">
          <div className="growSectionTitle">Environment</div>

          <div style={{ marginTop: 10 }} className="card">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div>
                <div className="growSubsectionTitle">AC Infinity Live Import</div>
                <div className="small">Home Assistant bridge for live tent readings.</div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className="badge" style={badgeStyle(live.enabled ? (live.lastError ? "bad" : liveStale ? "warn" : "good") : "muted")}>{live.enabled ? "LIVE ON" : "LIVE OFF"}</span>
                <span className="badge" style={badgeStyle(live.lastError ? "bad" : "muted")}>{live.lastError ? "Error" : `Last sync ${prettyAgo(live.lastSyncTs)}`}</span>
              </div>
            </div>

            <div className="small" style={{ marginTop: 8 }}>
              Recommended flow: Controller 69 / UIS device → AC Infinity cloud → Home Assistant → OddEngine Desktop.
            </div>

            <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={live.enabled} onChange={(e) => setLive((v) => ({ ...v, enabled: e.target.checked }))} />
                Enable live import
              </label>
              <label className="row" style={{ gap: 8 }}>
                <input type="checkbox" checked={live.autoLog} onChange={(e) => setLive((v) => ({ ...v, autoLog: e.target.checked }))} />
                Auto-log readings
              </label>
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input className="input" style={{ minWidth: 220 }} value={live.deviceSlug} onChange={(e) => setLive((v) => ({ ...v, deviceSlug: e.target.value }))} placeholder="Device slug (example: flower_tent)" />
                <button onClick={applyAcInfinityPreset}>Use AC Infinity preset</button>
                <button onClick={() => setLive((v) => ({ ...v, tempEntity: acHints.temp || v.tempEntity, rhEntity: acHints.rh || v.rhEntity }))}>Fill entities from slug</button>
              </div>
              <div className="small">Suggested: <span className="mono">{acHints.temp || "sensor.<device>_temperature"}</span> and <span className="mono">{acHints.rh || "sensor.<device>_humidity"}</span></div>

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input className="input" style={{ minWidth: 260 }} value={live.haUrl} onChange={(e) => setLive((v) => ({ ...v, haUrl: e.target.value }))} placeholder="Home Assistant URL (http://homeassistant.local:8123)" />
                <input className="input" style={{ minWidth: 260 }} value={live.token} onChange={(e) => setLive((v) => ({ ...v, token: e.target.value }))} placeholder="Home Assistant long-lived access token" />
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input className="input" style={{ minWidth: 240 }} value={live.tempEntity} onChange={(e) => setLive((v) => ({ ...v, tempEntity: e.target.value }))} placeholder="Temp entity (sensor.my_tent_temperature)" />
                <input className="input" style={{ minWidth: 240 }} value={live.rhEntity} onChange={(e) => setLive((v) => ({ ...v, rhEntity: e.target.value }))} placeholder="RH entity (sensor.my_tent_humidity)" />
                <input className="input" style={{ width: 110 }} type="number" min={5} value={Number.isFinite(live.pollSec) ? live.pollSec : 15} onChange={(e) => setLive((v) => ({ ...v, pollSec: Number(e.target.value || 15) }))} placeholder="Poll sec" />
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button onClick={async () => {
                  try {
                    await syncLiveNow(true);
                  } catch (err: any) {
                    const msg = err?.message || String(err);
                    setLive((v) => ({ ...v, lastError: msg }));
                    pushNotif({ title: "Grow", body: `Live test failed: ${msg}`, tags: ["Grow"], level: "error" });
                  }
                }}>Test live sync</button>
                <button onClick={() => setLive((v) => ({ ...v, lastError: "" }))}>Clear error</button>
                {!isDesktop() && <div className="small">Desktop is recommended so the Home Assistant call is not blocked by CORS.</div>}
              </div>
              {live.lastError && <div className="small" style={{ color: "#f59e0b" }}>Last error: {live.lastError}</div>}
            </div>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="small">Temp (°F)</label>
              <input type="number" value={tempF} onChange={(e) => setTempF(Number(e.target.value))} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="small">RH (%)</label>
              <input type="number" value={rh} onChange={(e) => setRh(Number(e.target.value))} />
            </div>
          </div>
          <div style={{ marginTop: 10 }} className="row">
            <span className="badge" style={badgeStyle(vpd > 1.7 || vpd < 0.7 ? "warn" : "good")}>VPD {vpd.toFixed(2)} kPa</span>
            <span className="small">Current panel reading {tempF.toFixed(1)}F / {rh.toFixed(1)}%</span>
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <button onClick={saveManualReading}>Save reading</button>
            <button onClick={() => syncLiveNow(true).catch((err: any) => pushNotif({ title: "Grow", body: `Sync failed: ${err?.message || String(err)}`, tags: ["Grow"], level: "error" }))}>Sync now</button>
            <button onClick={applyPlannerTargets}>Use planner targets</button>
            <button onClick={() => runDemoTick(true)}>Use demo reading</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="growSubsectionTitle" style={{ marginBottom: 6 }}>Recent readings</div>
            {readings.length === 0 && <div className="small">No readings yet.</div>}
            {readings.slice(0, 6).map((r, i) => (
              <div key={i} className="row growReadingRow" style={{ justifyContent: "space-between", borderRadius: 12, padding: "8px 10px", marginBottom: 6 }}>
                <div className="small">{new Date(r.ts).toLocaleString()}</div>
                <div className="small">{r.tempF}F / {r.rh}% • VPD {r.vpd} {r.source ? `• ${r.source}` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="card growSectionCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div>
              <div className="growSectionTitle">Offline planning mode</div>
              <div className="small">Plan the next run while the tent is offline, cleaned out, or between cycles.</div>
            </div>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={planner.enabled} onChange={(e) => setPlanner((v) => ({ ...v, enabled: e.target.checked }))} />
              Planner on
            </label>
          </div>

          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <input style={{ flex: 1, minWidth: 220 }} value={planner.runName} onChange={(e) => setPlanner((v) => ({ ...v, runName: e.target.value }))} placeholder="Run name" />
            <input style={{ flex: 1, minWidth: 180 }} value={planner.cultivar} onChange={(e) => setPlanner((v) => ({ ...v, cultivar: e.target.value }))} placeholder="Cultivar / strain" />
          </div>
          <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
            <input style={{ minWidth: 160 }} value={planner.medium} onChange={(e) => setPlanner((v) => ({ ...v, medium: e.target.value }))} placeholder="Medium" />
            <input type="number" style={{ width: 110 }} min={1} value={planner.roomCount} onChange={(e) => setPlanner((v) => ({ ...v, roomCount: Number(e.target.value || 1) }))} placeholder="Rooms" />
            <input type="date" style={{ minWidth: 170 }} value={planner.startDate} onChange={(e) => setPlanner((v) => ({ ...v, startDate: e.target.value }))} />
          </div>
          <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
            <input type="number" style={{ width: 120 }} min={0} step={1} value={planner.vegWeeks} onChange={(e) => setPlanner((v) => ({ ...v, vegWeeks: Number(e.target.value || 0) }))} placeholder="Veg weeks" />
            <input type="number" style={{ width: 120 }} min={0} step={1} value={planner.flowerWeeks} onChange={(e) => setPlanner((v) => ({ ...v, flowerWeeks: Number(e.target.value || 0) }))} placeholder="Flower weeks" />
            <input type="number" style={{ width: 120 }} min={0} step={1} value={planner.dryDays} onChange={(e) => setPlanner((v) => ({ ...v, dryDays: Number(e.target.value || 0) }))} placeholder="Dry days" />
          </div>

          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="small">Day target</label>
              <div className="row" style={{ gap: 8 }}>
                <input type="number" value={planner.targetTempDay} onChange={(e) => setPlanner((v) => ({ ...v, targetTempDay: Number(e.target.value || 0) }))} />
                <input type="number" value={planner.targetRhDay} onChange={(e) => setPlanner((v) => ({ ...v, targetRhDay: Number(e.target.value || 0) }))} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="small">Night target</label>
              <div className="row" style={{ gap: 8 }}>
                <input type="number" value={planner.targetTempNight} onChange={(e) => setPlanner((v) => ({ ...v, targetTempNight: Number(e.target.value || 0) }))} />
                <input type="number" value={planner.targetRhNight} onChange={(e) => setPlanner((v) => ({ ...v, targetRhNight: Number(e.target.value || 0) }))} />
              </div>
            </div>
          </div>

          <textarea style={{ marginTop: 10 }} rows={4} value={planner.notes} onChange={(e) => setPlanner((v) => ({ ...v, notes: e.target.value }))} placeholder="Cleaning checklist, transplant plan, feed notes, gear swaps..." />

          <div className="card growMiniCard" style={{ marginTop: 10 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="badge" style={badgeStyle("muted")}>Planned stage: {plannerDerived.stage}</span>
              <span className="badge" style={badgeStyle((plannerDerived.daysToFlip ?? 0) < 0 ? "muted" : "warn")}>Flip: {plannerDerived.flipDate}{plannerDerived.daysToFlip !== null ? ` (${plannerDerived.daysToFlip}d)` : ""}</span>
              <span className="badge" style={badgeStyle((plannerDerived.daysToHarvest ?? 0) < 0 ? "muted" : "good")}>Harvest: {plannerDerived.harvestDate}{plannerDerived.daysToHarvest !== null ? ` (${plannerDerived.daysToHarvest}d)` : ""}</span>
              <span className="badge" style={badgeStyle("muted")}>Dry done: {plannerDerived.dryDoneDate}</span>
            </div>
          </div>

          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <button onClick={loadPlannerIntoProfile}>Load planner into profile</button>
            <button onClick={applyPlannerTargets}>Apply planner targets</button>
            {isDesktop() && <button onClick={() => sendPlannerToGodMode(true)}>Send planner to GOD MODE</button>}
            <button onClick={() => {
              setPlanner({
                enabled: true,
                runName: "Next tent run",
                cultivar: "",
                medium: "Coco",
                roomCount: 1,
                startDate: toIsoDate(new Date()),
                vegWeeks: 4,
                flowerWeeks: 9,
                dryDays: 10,
                targetTempDay: 79,
                targetRhDay: 62,
                targetTempNight: 69,
                targetRhNight: 58,
                notes: "Prep room, clean tent, stage feed plan, calibrate sensors.",
              });
              pushNotif({ title: "Grow", body: "Planner reset to next-run defaults.", tags: ["Grow"], level: "info" });
            }}>Reset planner</button>
          </div>
        </div>

        <div className="card growSectionCard">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div>
              <div className="growSectionTitle">Demo sensor mode</div>
              <div className="small">Preview the panel with realistic readings even when no hardware is online.</div>
            </div>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={demo.enabled} onChange={(e) => setDemo((v) => ({ ...v, enabled: e.target.checked }))} />
              Demo on
            </label>
          </div>

          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <select value={demo.scenario} onChange={(e) => setDemo((v) => ({ ...v, scenario: e.target.value as DemoScenario }))} style={{ minWidth: 220 }}>
              <option value="veg_day">Veg day</option>
              <option value="flower_day">Flower day</option>
              <option value="lights_off">Lights off</option>
              <option value="hot_dry_stress">Hot / dry stress</option>
              <option value="cold_wet_stress">Cold / wet stress</option>
            </select>
            <input type="number" min={5} style={{ width: 120 }} value={demo.intervalSec} onChange={(e) => setDemo((v) => ({ ...v, intervalSec: Number(e.target.value || 20) }))} placeholder="Sec" />
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={demo.autoRun} onChange={(e) => setDemo((v) => ({ ...v, autoRun: e.target.checked }))} />
              Auto-run
            </label>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={demo.autoLog} onChange={(e) => setDemo((v) => ({ ...v, autoLog: e.target.checked }))} />
              Auto-log
            </label>
          </div>

          <div className="card growMiniCard" style={{ marginTop: 10 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="badge" style={badgeStyle(demo.enabled ? "warn" : "muted")}>{demo.enabled ? "Demo armed" : "Demo off"}</span>
              <span className="badge" style={badgeStyle(demo.autoRun ? "warn" : "muted")}>{demo.autoRun ? `Streaming every ${demo.intervalSec}s` : "Manual ticks"}</span>
              <span className="badge" style={badgeStyle("muted")}>Last demo {prettyAgo(demo.lastTickTs)}</span>
            </div>
            <div className="small" style={{ marginTop: 8 }}>
              Preset now: {scenarioPreset(demo.scenario).label} • base {scenarioPreset(demo.scenario).tempF}F / {scenarioPreset(demo.scenario).rh}% RH
            </div>
          </div>

          <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => runDemoTick(true)}>Run demo now</button>
            <button onClick={() => {
              const preset = scenarioPreset(demo.scenario);
              setTempF(preset.tempF);
              setRh(preset.rh);
              pushNotif({ title: "Grow", body: `Loaded ${preset.label} preset into the panel.`, tags: ["Grow"], level: "success" });
            }}>Load base preset</button>
            <button onClick={() => {
              setDemo({ enabled: false, autoRun: false, autoLog: false, intervalSec: 20, scenario: "veg_day", lastTickTs: null });
              pushNotif({ title: "Grow", body: "Demo mode reset.", tags: ["Grow"], level: "info" });
            }}>Reset demo</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }} className="card">
        <div style={{ fontWeight: 900 }}>Fairly Odd Grow OS — GOD MODE bundle</div>
        {!isDesktop() && (
          <div className="small" style={{ marginTop: 6 }}>
            Desktop mode required to run Grow OS (it needs Python/Streamlit). The profile + readings above still work in the browser.
          </div>
        )}

        {isDesktop() && (
          <>
            <div className="small" style={{ marginTop: 6 }}>
              Desktop toast + Discord alerts, multi-room watchlist, terminal tape, VPD candles, auto flip, deficiency warnings, paper-trade feed changes, pump/doser mapping, Dakine schedule scaling, and now the OddEngine planner handoff stay inside the bundle below.
            </div>

            <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 260 }}>
                <label className="small">Python command</label>
                <input value={pythonCmd} onChange={(e) => persistPython(e.target.value)} placeholder="python (or py)" />
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={() => sys?.growOsDir && oddApi().openPath(sys.growOsDir || "")}>Open bundle folder</button>
              <button onClick={updateGrowBundle}>Update bundle</button>
              <button onClick={() => sendPlannerToGodMode(true)}>Send planner to GOD MODE</button>
              <button onClick={installGrowDeps}>Install deps</button>
              {!growRunId ? <button onClick={launchGrowOS}>Launch GOD MODE</button> : <button onClick={stopGrowOS}>Stop Grow OS</button>}
              <button onClick={() => window.open("http://127.0.0.1:8501", "_blank")}>Open UI</button>
              <label className="small" style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
                <input type="checkbox" checked={embedGodMode} onChange={(e) => setEmbedGodMode(e.target.checked)} />
                Embed in panel
              </label>
            </div>

            <div className="small" style={{ marginTop: 8 }}>
              Bundle path: <span className="mono">{sys?.growOsDir || "…"}</span> • planner handoff file: <span className="mono">oddengine_planner_handoff.json</span>
            </div>

            {embedGodMode && (
              <div style={{ marginTop: 10 }} className="card">
                <div className="small" style={{ marginBottom: 8 }}>
                  Embedded view (if this shows blank, click <b>Open UI</b>). Launch GOD MODE first.
                </div>
                <iframe src="http://127.0.0.1:8501" title="Fairly Odd Grow OS GOD MODE" style={{ width: "100%", height: "70vh", border: "1px solid var(--line)", borderRadius: 12 }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
