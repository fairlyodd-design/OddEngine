import React, { useEffect, useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import CardFrame from "../components/CardFrame";
import { isDesktop, oddApi } from "../lib/odd";
import { PANEL_META, getActivity, getBrainNotes, getGoals, normalizePanelId, logActivity } from "../lib/brain";
import { loadJSON, saveJSON } from "../lib/storage";
import { CALENDAR_EVENT, addQuickEvent, listUpcoming, focusCalendarDate, type CalEvent } from "../lib/calendarStore";

const ENT_EVENT = "oddengine:entertainment-changed";
const DONE_KEY = "oddengine:calendar:done:v1";
const DONE_EVENT = "oddengine:calendar-done-changed";

function fmtBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function useClock() {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

async function getStorageEstimate() {
  try {
    // @ts-ignore
    const est = await navigator.storage?.estimate?.();
    if (!est) return null;
    return { quota: Number(est.quota || 0), usage: Number(est.usage || 0) };
  } catch {
    return null;
  }
}

type Props = {
  onNavigate: (panelId: string) => void;
};

export default function Home({ onNavigate }: Props) {
  const now = useClock();
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }, [now]);

  const [storage, setStorage] = useState<{ quota: number; usage: number } | null>(null);
  const [runtime, setRuntime] = useState<any>(null);
  const [calTick, setCalTick] = useState(0);
  const [entTick, setEntTick] = useState(0);
  const [doneTick, setDoneTick] = useState(0);

  useEffect(() => {
    let alive = true;
    getStorageEstimate().then((s) => alive && setStorage(s));
    const t = window.setInterval(() => getStorageEstimate().then((s) => alive && setStorage(s)), 15000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);


  useEffect(() => {
    if (!isDesktop() || !oddApi().getRuntimeStats) return;
    let alive = true;
    const api = oddApi();
    const pull = async () => {
      try {
        const res = await api.getRuntimeStats();
        if (alive && res?.ok) setRuntime(res);
      } catch {
        // ignore runtime polling failures
      }
    };
    pull();
    const t = window.setInterval(pull, 5000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const onCal = () => setCalTick((x) => x + 1);
    try {
      window.addEventListener(CALENDAR_EVENT as any, onCal);
    } catch {
      // ignore
    }
    return () => {
      try {
        window.removeEventListener(CALENDAR_EVENT as any, onCal);
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    const onEnt = () => setEntTick((x) => x + 1);
    const onDone = () => setDoneTick((x) => x + 1);
    try {
      window.addEventListener(ENT_EVENT as any, onEnt);
      window.addEventListener(DONE_EVENT as any, onDone);
      window.addEventListener("storage", onEnt);
    } catch {
      // ignore
    }
    return () => {
      try {
        window.removeEventListener(ENT_EVENT as any, onEnt);
        window.removeEventListener(DONE_EVENT as any, onDone);
        window.removeEventListener("storage", onEnt);
      } catch {
        // ignore
      }
    };
  }, []);

  const missionsCount = useMemo(() => {
    // Missions are derived from stored state; keep it lightweight here.
    return (loadJSON<any>("oddengine:missions:v1", []) as any[]).length;
  }, []);

  const notes = getBrainNotes();
  const goals = getGoals().split(/\n+/).filter(Boolean);
  const activity = getActivity().slice(0, 6);

  function toast(kind: "ok" | "info" | "warn" | "bad", textMsg: string) {
    try {
      window.dispatchEvent(new CustomEvent("oddengine:toast", { detail: { kind, text: textMsg } }));
    } catch {
      // ignore
    }
  }

  const doneMap = useMemo(() => {
    void doneTick;
    const raw = loadJSON<Record<string, number>>(DONE_KEY, {} as any);
    return raw && typeof raw === "object" ? (raw as Record<string, number>) : {};
  }, [doneTick]);

  function isDone(id: string) {
    return Boolean((doneMap as any)[id]);
  }

  function setDone(ev: CalEvent, done: boolean) {
    const next = { ...(doneMap as any) } as Record<string, number>;
    if (done) next[ev.id] = Date.now();
    else delete next[ev.id];
    saveJSON(DONE_KEY, next);
    setDoneTick((x) => x + 1);
    try {
      window.dispatchEvent(new CustomEvent(DONE_EVENT, { detail: { id: ev.id, done, ts: Date.now() } }));
    } catch {
      // ignore
    }
    try {
      logActivity({ kind: "system", panelId: "Calendar", title: done ? `Completed: ${ev.title}` : `Marked not done: ${ev.title}`, body: `${ev.date} ${ev.time || ""}`.trim() });
    } catch {
      // ignore
    }
  }

  const entState = useMemo(() => {
    void entTick;
    return loadJSON<any>("oddengine:entertainment:v1", null as any);
  }, [entTick]);

  const entNow = entState?.nowPlaying || null;
  const entServices = (entState?.services || []) as any[];
  const entSvc = entNow ? entServices.find((s) => s.id === entNow.serviceId) : null;

  function relAgo(iso?: string) {
    if (!iso) return "";
    const t = new Date(String(iso)).getTime();
    if (!Number.isFinite(t)) return "";
    const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.max(1, Math.round(mins / 60));
    return `${hrs}h ago`;
  }

  async function focusNowPlaying() {
    if (!entSvc) return;
    try {
      const api = oddApi();
      if (isDesktop() && api.focusEntertainmentPlayer) {
        const res = await api.focusEntertainmentPlayer();
        if (!res?.ok) toast("warn", res?.error ? `Focus failed: ${res.error}` : "No player window found.");
        else toast("ok", "Focused Entertainment player.");
        return;
      }
      if (entSvc?.url) window.open(String(entSvc.url), "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast("warn", e?.message || "Focus failed.");
    }
  }

  const todayKey = useMemo(() => {
    const d = new Date();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }, []);

  const upcoming = useMemo(() => {
    // Recompute whenever the calendar store changes.
    void calTick;
    return listUpcoming({ limit: 50 });
  }, [calTick]);

  function parseEventDate(ev: CalEvent) {
    // Local time.
    const base = new Date(ev.date + "T00:00:00");
    if (ev.time && /^\d{2}:\d{2}$/.test(ev.time)) {
      const [hh, mm] = ev.time.split(":").map((x) => Number(x));
      base.setHours(hh || 0, mm || 0, 0, 0);
    }
    return base;
  }

  function relWhen(ev: CalEvent) {
    const d = parseEventDate(ev);
    const nowD = new Date();
    const day = ev.date === todayKey ? "Today" : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    const time = ev.time ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Anytime";
    const deltaMs = d.getTime() - nowD.getTime();
    const mins = Math.round(deltaMs / 60000);
    const soon = mins >= 0 && mins <= 180;
    const hint = soon ? ` • in ~${Math.max(0, mins)}m` : "";
    return `${day} • ${time}${hint}`;
  }

  function matchByPanelOrTitle(ev: CalEvent, panelId: string, titleNeedles: string[]) {
    const pid = normalizePanelId(ev.panelId || "");
    const t = (ev.title || "").toLowerCase();
    const okTitle = titleNeedles.some((s) => t.includes(s));
    return pid === normalizePanelId(panelId) || okTitle;
  }

  const nextFamily = useMemo(() => {
    const familyNeedles = ["family night", "family", "movie night", "game night", "entertainment"];
    const fam = upcoming.filter((e) => matchByPanelOrTitle(e, "Entertainment", familyNeedles));
    // Prefer "tonight" (today) if present.
    const tonight = fam.find((e) => e.date === todayKey);
    return tonight || fam[0] || null;
  }, [upcoming, todayKey]);

  const nextWriting = useMemo(() => {
    const needles = ["writing", "writer", "draft", "chapter", "book", "scene", "outline"];
    const list = upcoming.filter((e) => matchByPanelOrTitle(e, "Books", needles));
    return list[0] || null;
  }, [upcoming]);

  const nextTrading = useMemo(() => {
    const needles = ["trading", "check-in", "check in", "scan", "options", "spy", "plan"];
    const list = upcoming.filter((e) => matchByPanelOrTitle(e, "Trading", needles));
    return list[0] || null;
  }, [upcoming]);



  const todayEvents = useMemo(() => {
    const list = upcoming.filter((e) => e.date === todayKey);
    const safeTime = (t?: string) => (t && /^\d{2}:\d{2}$/.test(t) ? t : "99:99");
    return list.slice().sort((a, b) => (a.date + safeTime(a.time)).localeCompare(b.date + safeTime(b.time)));
  }, [upcoming, todayKey]);

  const currentRoutine = useMemo(() => {
    const nowMs = Date.now();
    const STEP_MIN = 45; // assumed
    // Active step: within its assumed duration
    for (const ev of todayEvents) {
      if (!ev.time) continue;
      if (isDone(ev.id)) continue;
      const start = parseEventDate(ev).getTime();
      const end = start + STEP_MIN * 60 * 1000;
      if (nowMs >= start && nowMs <= end) {
        return { mode: "active" as const, ev };
      }
    }
    // Next step soon (within 3h)
    for (const ev of todayEvents) {
      if (isDone(ev.id)) continue;
      const start = parseEventDate(ev).getTime();
      if (start >= nowMs && start - nowMs <= 3 * 60 * 60 * 1000) {
        return { mode: "next" as const, ev };
      }
    }
    // Fallback: first not-done task today
    const first = todayEvents.find((e) => !isDone(e.id));
    return first ? { mode: "next" as const, ev: first } : null;
  }, [todayEvents, doneMap, todayKey]);

  const top3Tasks = useMemo(() => {
    const list = todayEvents.filter((e) => !isDone(e.id));
    return list.slice(0, 3);
  }, [todayEvents, doneMap]);

  function touchedRecently(panelId?: string) {
    const pid = normalizePanelId(panelId || "");
    const hit = (getActivity() || []).find((a) => normalizePanelId(a.panelId || "") === pid);
    if (!hit) return false;
    return Date.now() - (hit.ts || 0) < 2 * 60 * 60 * 1000;
  }

  function addDefaultFamilyNight() {
    // Default 7:00 PM today.
    addQuickEvent({ title: "Tonight — Family Night", panelId: "Entertainment", date: todayKey, time: "19:00" });
  }

  function addDefaultWritingBlock() {
    // Default 8:00 PM today.
    addQuickEvent({ title: "Writing block", panelId: "Books", date: todayKey, time: "20:00" });
  }

  function addDefaultTradingCheckIn() {
    // Default 9:15 AM next session (today if early, otherwise tomorrow).
    const nowD = new Date();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const tomorrow = new Date(nowD);
    tomorrow.setDate(nowD.getDate() + 1);
    const tomorrowKey = `${tomorrow.getFullYear()}-${pad2(tomorrow.getMonth() + 1)}-${pad2(tomorrow.getDate())}`;
    const useToday = nowD.getHours() < 9;
    addQuickEvent({ title: "Trading check-in", panelId: "Trading", date: useToday ? todayKey : tomorrowKey, time: "09:15" });
  }

  const pinned = useMemo(() => {
    const raw = loadJSON<any>("oddengine:pinnedPanels", []);
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((x) => normalizePanelId(String(x)));
  }, []);

  const pinnedMeta = useMemo(() => {
    const map = new Map(PANEL_META.map((p) => [normalizePanelId(p.id), p]));
    const items = pinned.map((id) => map.get(id)).filter(Boolean) as any[];
    // Home should never show itself in the pinned tiles.
    return items.filter((p) => normalizePanelId(p.id) !== "Home").slice(0, 8);
  }, [pinned]);

  const [q, setQ] = useState("");
  const apps = useMemo(() => {
    const all = PANEL_META.filter((p) => !["Home"].includes(normalizePanelId(p.id)));
    const query = q.trim().toLowerCase();
    const list = !query
      ? all
      : all.filter((p) => (p.title + " " + p.sub + " " + p.section).toLowerCase().includes(query));
    return list;
  }, [q]);

  const runtimeCpu = Number(runtime?.cpu?.percentUsed || 0);
  const runtimeRam = Number(runtime?.memory?.percentUsed || 0);
  const runtimeStorage = runtime?.storage || null;
  const quota = Number(runtimeStorage?.total || storage?.quota || 0);
  const usage = Number(runtimeStorage?.used || storage?.usage || 0);
  const pct = Number(runtimeStorage?.percentUsed || (quota > 0 ? Math.min(100, Math.max(0, Math.round((usage / quota) * 100))) : 0));
  const hostLabel = runtime?.network?.hostname || window.location.hostname || "localhost";
  const primaryIp = runtime?.network?.primaryIp || "";
  const interfaceName = runtime?.network?.interfaceName || "";

  return (
    <div className="panelRoot homeRoot">
      <PanelHeader
        panelId="Home"
        title="FairlyOdd OS — Home"
        subtitle="Smooth launcher + widgets + one-click routes into every panel"
        storagePrefix="oddengine:home"
      />

      <div className="homeGrid">
        {/* Left widget rail (inside the panel) */}
        <div className="homeLeft">
          <div className="card homeWidget">
            <div className="homeTime">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            <div className="homeDate">{now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</div>
          </div>

          <div className="card homeWidget">
            <div className="h">System status</div>
            <div className="sub">Quick health read (local-first). More detailed stats land in Dev Engine.</div>
            <div className="homeMeterRow mt-4">
              <div className="homeRing">
                <div className="homeRingLabel">CPU</div>
                <div className="homeRingValue">{runtime ? `${runtimeCpu}%` : "—"}</div>
              </div>
              <div className="homeRing">
                <div className="homeRingLabel">RAM</div>
                <div className="homeRingValue">{runtime ? `${runtimeRam}%` : "—"}</div>
              </div>
            </div>
            <div className="small mt-3" style={{ opacity: 0.85 }}>
              {isDesktop() ? "Live desktop runtime stats via Electron IPC." : "Browser mode uses limited local fallbacks."}
            </div>
          </div>

          <div className="card homeWidget">
            <div className="h">Storage</div>
            <div className="sub">{runtimeStorage ? "Real disk usage for the local app drive" : "Browser/Electron storage estimate"}</div>
            <div className="stack tight mt-4">
              <div className="cluster spread">
                <div className="small">Used</div>
                <div className="small"><b>{fmtBytes(usage)}</b> / {fmtBytes(quota)}</div>
              </div>
              <div className="homeBar" aria-label="Storage usage">
                <div className="homeBarFill" style={{ width: `${pct}%` }} />
              </div>
              {runtimeStorage?.path ? <div className="small mt-3" style={{ opacity: 0.85 }}>Drive: <b>{runtimeStorage.path}</b></div> : null}
            </div>
          </div>

          <div className="card homeWidget">
            <div className="h">Network</div>
            <div className="sub">LAN-first operator mode</div>
            <div className="small mt-4" style={{ opacity: 0.9 }}>
              Host: <b>{hostLabel}</b>{primaryIp ? <> • IP: <b>{primaryIp}</b></> : null}
            </div>
            {interfaceName ? <div className="small mt-2" style={{ opacity: 0.82 }}>Adapter: <b>{interfaceName}</b></div> : null}
            <div className="cluster wrap mt-4">
              <button className="tabBtn" onClick={() => onNavigate("Security")}>Open Security</button>
              <button className="tabBtn" onClick={() => onNavigate("DevEngine")}>Open Dev Engine</button>
            </div>
          </div>
        </div>

        {/* Main area */}
        <div className="homeMain">
          <div className="homeTop">
            <div className="card homeHeroCard">
              <div className="h">{greeting} 👊</div>
              <div className="sub">Everything you already built is still here — this just makes it faster, cleaner, and more “OS-like”.</div>
              <div className="homePills">
                <span className="badge good"><b>{missionsCount}</b> missions</span>
                <span className="badge"><b>{notes.length}</b> notes</span>
                <span className="badge warn"><b>{goals.length}</b> goals</span>
              </div>
              <div className="cluster wrap mt-5">
                <button className="tabBtn" onClick={() => onNavigate("RoutineLauncher")}>🚀 Run Routine</button>
                <button className="tabBtn" onClick={() => onNavigate("Calendar")}>📅 Open Calendar</button>
                <button className="tabBtn" onClick={() => onNavigate("Brain")}>🧠 Daily Digest</button>
              </div>
            </div>

            <div className="card homeSearchCard">
              <div className="h">Search apps</div>
              <div className="sub">Type a panel name (Trading, Grow, Budget, Writers…).</div>
              <input
                className="input mt-4"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search panels…"
              />
              <div className="cluster wrap mt-4">
                <button className="tabBtn" onClick={() => onNavigate("Trading")}>🎯 Trading</button>
                <button className="tabBtn" onClick={() => onNavigate("Grow")}>🌱 Grow</button>
                <button className="tabBtn" onClick={() => onNavigate("FamilyBudget")}>🏡 Budget</button>
                <button className="tabBtn" onClick={() => onNavigate("Books")}>📚 Writers Lounge</button>
              </div>
            </div>
          </div>

          <div className="homeSectionTitle compact">Mission control (from Calendar)</div>
          <div className="homeMissionRow">
            {/* Tonight’s Family Night */}
            <div className="card homeMissionCard">
              <div className="homeMissionTop">
                <div className="homeMissionKicker">Tonight’s Family Night</div>
                <span className="badge">📅 Live</span>
              </div>
              {nextFamily ? (
                <>
                  <div className="homeMissionTitle">{nextFamily.title || "Family Night"}</div>
                  <div className="homeMissionMeta">{relWhen(nextFamily)}</div>
                  <div className="row homeMissionActions">
                    <button className="tabBtn" onClick={() => onNavigate(nextFamily.panelId || "Entertainment")}>Open</button>
                    <button className="tabBtn" onClick={() => { focusCalendarDate(nextFamily.date); onNavigate("Calendar"); }}>Calendar</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="homeMissionEmpty">No Family Night scheduled yet.</div>
                  <div className="row homeMissionActions">
                    <button className="tabBtn" onClick={addDefaultFamilyNight}>+ Add for 7:00 PM</button>
                    <button className="tabBtn" onClick={() => { focusCalendarDate(todayKey); onNavigate("Calendar"); }}>Calendar</button>
                  </div>
                </>
              )}
            </div>

            {/* Next writing block */}
            <div className="card homeMissionCard">
              <div className="homeMissionTop">
                <div className="homeMissionKicker">Next writing block</div>
                <span className="badge good">✍️ Writers</span>
              </div>
              {nextWriting ? (
                <>
                  <div className="homeMissionTitle">{nextWriting.title || "Writing"}</div>
                  <div className="homeMissionMeta">{relWhen(nextWriting)}</div>
                  <div className="row homeMissionActions">
                    <button className="tabBtn" onClick={() => onNavigate(nextWriting.panelId || "Books")}>Open Writers Lounge</button>
                    <button className="tabBtn" onClick={() => { focusCalendarDate(nextWriting.date); onNavigate("Calendar"); }}>Calendar</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="homeMissionEmpty">No writing block scheduled yet.</div>
                  <div className="row homeMissionActions">
                    <button className="tabBtn" onClick={addDefaultWritingBlock}>+ Add for 8:00 PM</button>
                    <button className="tabBtn" onClick={() => onNavigate("Books")}>Open Writers Lounge</button>
                  </div>
                </>
              )}
            </div>

            {/* Next trading check-in */}
            <div className="card homeMissionCard">
              <div className="homeMissionTop">
                <div className="homeMissionKicker">Next trading check-in</div>
                <span className="badge warn">🎯 Trading</span>
              </div>
              {nextTrading ? (
                <>
                  <div className="homeMissionTitle">{nextTrading.title || "Trading check-in"}</div>
                  <div className="homeMissionMeta">{relWhen(nextTrading)}</div>
                  <div className="row homeMissionActions">
                    <button className="tabBtn" onClick={() => onNavigate(nextTrading.panelId || "Trading")}>Open Trading</button>
                    <button className="tabBtn" onClick={() => { focusCalendarDate(nextTrading.date); onNavigate("Calendar"); }}>Calendar</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="homeMissionEmpty">No trading check-in scheduled yet.</div>
                  <div className="row homeMissionActions">
                    <button className="tabBtn" onClick={addDefaultTradingCheckIn}>+ Add next session</button>
                    <button className="tabBtn" onClick={() => onNavigate("Trading")}>Open Trading</button>
                  </div>
                </>
              )}
            </div>
          </div>



          <div className="homeSectionTitle compact">Live lane (Calendar + activity)</div>
          <div className="homeOpsRow">
            {/* Now Playing */}
            <div className="card homeOpsCard">
              <div className="homeOpsTop">
                <div className="homeOpsKicker">Now Playing</div>
                <span className="badge">🎬 Live</span>
              </div>
              {entSvc ? (
                <>
                  <div className="homeOpsTitle">{entSvc.name}</div>
                  <div className="homeOpsMeta">{entNow?.startedAt ? `Started ${relAgo(entNow.startedAt)}` : ""}</div>
                  {entNow?.note ? <div className="homeOpsNote">{entNow.note}</div> : <div className="homeOpsEmpty">Tip: add a Now Playing note inside Entertainment.</div>}
                  <div className="row homeOpsActions">
                    <button className="tabBtn" onClick={() => onNavigate("Entertainment")}>Open Entertainment</button>
                    <button className="tabBtn" onClick={focusNowPlaying}>{isDesktop() ? "Focus Player" : "Open"}</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="homeOpsEmpty">Nothing playing yet.</div>
                  <div className="row homeOpsActions">
                    <button className="tabBtn" onClick={() => onNavigate("Entertainment")}>Open Entertainment</button>
                    <button className="tabBtn" onClick={() => onNavigate("Calendar")}>Open Calendar</button>
                  </div>
                </>
              )}
            </div>

            {/* Current routine step */}
            <div className="card homeOpsCard">
              <div className="homeOpsTop">
                <div className="homeOpsKicker">Current routine step</div>
                <span className={currentRoutine?.mode === "active" ? "badge good" : "badge"}>{currentRoutine?.mode === "active" ? "⚡ Active" : "⏭️ Up next"}</span>
              </div>
              {currentRoutine?.ev ? (
                <>
                  <div className="homeOpsTitle">{currentRoutine.ev.title || "Routine step"}</div>
                  <div className="homeOpsMeta">{relWhen(currentRoutine.ev)}</div>
                  <div className="row homeOpsActions">
                    <button className="tabBtn" onClick={() => onNavigate(currentRoutine.ev.panelId || "RoutineLauncher")}>Open</button>
                    <button className="tabBtn" onClick={() => setDone(currentRoutine.ev, true)}>Mark done</button>
                    <button className="tabBtn" onClick={() => { focusCalendarDate(currentRoutine.ev.date); onNavigate("Calendar"); }}>Calendar</button>
                  </div>
                  {touchedRecently(currentRoutine.ev.panelId) ? <div className="small mt-3" style={{ opacity: 0.85 }}>You touched this panel recently — nice momentum.</div> : null}
                </>
              ) : (
                <>
                  <div className="homeOpsEmpty">No scheduled steps found for today.</div>
                  <div className="row homeOpsActions">
                    <button className="tabBtn" onClick={() => onNavigate("RoutineLauncher")}>Open Routine Launcher</button>
                    <button className="tabBtn" onClick={() => { focusCalendarDate(todayKey); onNavigate("Calendar"); }}>Calendar</button>
                  </div>
                </>
              )}
            </div>

            {/* Top 3 tasks */}
            <div className="card homeOpsCard">
              <div className="homeOpsTop">
                <div className="homeOpsKicker">Today’s top 3 tasks</div>
                <span className="badge warn">✅ Track</span>
              </div>

              {top3Tasks.length ? (
                <div className="homeTaskList">
                  {top3Tasks.map((ev) => (
                    <div key={ev.id} className="homeTaskItem">
                      <label className="homeCheck">
                        <input
                          type="checkbox"
                          checked={isDone(ev.id)}
                          onChange={(e) => setDone(ev, (e.target as any).checked)}
                        />
                        <span className="homeTaskText">
                          <span className="homeTaskTitle">{ev.title}</span>
                          <span className="homeTaskMeta">{ev.time ? ` • ${ev.time}` : " • Anytime"}</span>
                        </span>
                      </label>
                      <div className="cluster wrap mt-3">
                        <button className="tabBtn" onClick={() => onNavigate(ev.panelId || "Calendar")}>Open</button>
                        <button className="tabBtn" onClick={() => { focusCalendarDate(ev.date); onNavigate("Calendar"); }}>Calendar</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="homeOpsEmpty">No tasks scheduled for today yet.</div>
                  <div className="row homeOpsActions">
                    <button className="tabBtn" onClick={() => { focusCalendarDate(todayKey); onNavigate("Calendar"); }}>Add tasks in Calendar</button>
                    <button className="tabBtn" onClick={() => addQuickEvent({ title: "Quick task", date: todayKey, time: "12:00" })}>+ Quick task</button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="homeSectionTitle">Pinned apps</div>
          <div className="homeAppsRow">
            {pinnedMeta.length ? pinnedMeta.map((p: any) => (
              <button key={p.id} className="homeAppTile" onClick={() => onNavigate(p.id)}>
                <div className="homeAppIcon">{p.icon}</div>
                <div className="homeAppText">
                  <div className="homeAppName">{p.title}</div>
                  <div className="homeAppSub">{p.sub}</div>
                </div>
              </button>
            )) : (
              <div className="card homeEmpty">
                <div className="sub">Pin panels in the left sidebar (★) and they’ll appear here.</div>
              </div>
            )}
          </div>

          <div className="homeSectionTitle mt-6">Apps</div>
          <div className="homeAppsGrid">
            {apps.slice(0, 18).map((p: any) => (
              <button key={p.id} className="homeAppGridTile" onClick={() => onNavigate(p.id)}>
                <div className="homeAppIcon">{p.icon}</div>
                <div className="homeAppName">{p.title}</div>
                <div className="homeAppSub">{p.sub}</div>
              </button>
            ))}
          </div>

          <div className="homeBottom">
            <CardFrame title="Recent activity" subtitle="What you touched last" storageKey="home:activity" className="softCard">
              {activity.length ? (
                <div className="grid">
                  {activity.map((a) => (
                    <div key={a.id} className="homeActivity">
                      <div className="cluster spread">
                        <div style={{ fontWeight: 900 }}>{a.title}</div>
                        <div className="small">{new Date(a.ts).toLocaleString()}</div>
                      </div>
                      <div className="small mt-1" style={{ opacity: 0.9 }}>{a.body}</div>
                      <div className="cluster wrap mt-3">
                        <button className="tabBtn" onClick={() => onNavigate(a.panelId)}>Open {a.panelId}</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="small">No recent activity yet — open a few panels and this becomes your “continue” lane.</div>
              )}
            </CardFrame>

            <CardFrame title="Quick launches" subtitle="One-click routes" storageKey="home:quick" className="softCard">
              <div className="cluster wrap">
                <button className="tabBtn" onClick={() => onNavigate("Entertainment")}>🎬 Family Entertainment</button>
                <button className="tabBtn" onClick={() => onNavigate("News")}>📰 News</button>
                <button className="tabBtn" onClick={() => onNavigate("Cameras")}>📹 Cameras</button>
                <button className="tabBtn" onClick={() => onNavigate("Mining")}>⛏️ Mining</button>
              </div>
              <div className="note mt-4">
                Want a true “dashboard grid” like the reference image? Toggle <b>FairlyGOD grid</b> and drag these cards around.
              </div>
            </CardFrame>
          </div>
        </div>
      </div>
    </div>
  );
}
