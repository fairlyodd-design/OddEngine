import React, { useEffect, useMemo, useState } from "react";
import { PanelHeader } from "../components/PanelHeader";
import { downloadTextFile } from "../lib/files";
import { pushNotif } from "../lib/notifs";
import { acknowledgePanelAction, getPanelActions, getPanelMeta, PANEL_ACTION_EVENT, PANEL_META, queuePanelAction } from "../lib/brain";
import { loadJSON, saveJSON } from "../lib/storage";
import { isDesktop, oddApi } from "../lib/odd";

type Persisted = {
  collapsed?: boolean;
  floating?: boolean;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};

type GlobalSetsStore = {
  sets: Record<string, { templates: Record<string, Persisted[]> }>;
};

type Routine = {
  id: string;
  name: string;
  setName: string;
  sequence: string[];
  mode: "windows" | "main";
  tileStyle?: "grid" | "left-main" | "hero";
  tilePreset?: "single" | "trader-main-3mon";
  displayAssignments?: Record<string, string>;
  notes?: string;
  updatedAt?: number;
};

type RoutineStore = {
  activeId: string;
  routines: Routine[];
};

const KEY = "oddengine:routines:v1";
const GLOBAL_SETS_KEY = "oddengine:godglobalsets:v1";


type ExportBundle = {
  version: string;
  exportedAt: string;
  routines: RoutineStore;
  globalSets: GlobalSetsStore;
};

function exportRoutinesBundle() {
  const routines = (loadJSON<RoutineStore>(KEY, { activeId: "", routines: [] }) || { activeId: "", routines: [] }) as RoutineStore;
  const globalSets = (loadJSON<GlobalSetsStore>(GLOBAL_SETS_KEY, { sets: {} }) || { sets: {} }) as GlobalSetsStore;
  const bundle: ExportBundle = {
    version: "10.19.8",
    exportedAt: new Date().toISOString(),
    routines,
    globalSets,
  };
  downloadTextFile(`oddengine_routines_${Date.now()}.json`, JSON.stringify(bundle, null, 2));
  pushNotif({ kind: "Routine Launcher", title: "Exported", detail: "Routines + global sets exported." });
}

async function importRoutinesBundle(file: File) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const routines = parsed?.routines;
  if (!routines || !Array.isArray(routines.routines)) {
    pushNotif({ kind: "Routine Launcher", title: "Import failed", detail: "That file doesn't look like an OddEngine routines export." });
    return;
  }
  saveJSON(KEY, routines);
  if (parsed?.globalSets) {
    saveJSON(GLOBAL_SETS_KEY, parsed.globalSets);
  }
  pushNotif({ kind: "Routine Launcher", title: "Imported", detail: "Routines imported. Reloading…" });
  window.location.reload();
}

function uid(prefix = "r") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function loadSets(): GlobalSetsStore {
  return (loadJSON<GlobalSetsStore>(GLOBAL_SETS_KEY, { sets: {} }) as GlobalSetsStore) || { sets: {} };
}

function applyGlobalSet(setName: string) {
  const gs = loadSets();
  const templates = gs.sets?.[setName]?.templates || {};
  const panels = Object.keys(templates);
  panels.forEach((pid) => {
    saveJSON(`oddengine:godtemplate:${pid}`, templates[pid] || []);
  });
  return panels.length;
}

function openUndockedPanel(panelId: string, index: number, routineId: string) {
  const meta = getPanelMeta(panelId);
  const offset = 20 * index;
  const width = 1180;
  const height = 820;
  if (isDesktop() && oddApi().openWindow) {
    oddApi().openWindow({
      routineId,
      title: `${meta.icon} ${meta.title}`,
      query: { panel: panelId, undock: "routine" },
      width,
      height,
      x: 80 + offset,
      y: 60 + offset,
      resizable: true,
      frame: true,
    } as any);
    return;
  }
  // Web fallback: open in a new tab/window.
  const url = `${window.location.origin}${window.location.pathname}?panel=${encodeURIComponent(panelId)}&undock=routine&rid=${encodeURIComponent(routineId)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function RoutineLauncher({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const [store, setStore] = useState<RoutineStore>(() => {
    const fallback: RoutineStore = { activeId: "", routines: [] };
    const loaded = loadJSON<RoutineStore>(KEY, fallback) || fallback;
    if (!Array.isArray(loaded.routines)) loaded.routines = [];
    return loaded;
  });
  const [toast, setToast] = useState<string>("");


const [displays, setDisplays] = useState<Array<{ id: string; label?: string; isPrimary?: boolean }>>([]);

useEffect(() => {
  if (!isDesktop() || !oddApi().getDisplays) return;
  oddApi().getDisplays().then((res: any) => {
    if (res?.ok && Array.isArray(res.displays)) {
      setDisplays(res.displays.map((d: any) => ({ id: String(d.id), label: d.label || (d.isPrimary ? "Primary" : "Display"), isPrimary: !!d.isPrimary })));
    }
  }).catch(()=>{});
}, []);

  const sets = useMemo(() => {
    const gs = loadSets();
    return Object.keys(gs.sets || {}).sort((a, b) => a.localeCompare(b));
  }, [store.activeId, store.routines.length]);

  const panels = useMemo(() => PANEL_META.map((p) => p.id).sort((a, b) => a.localeCompare(b)), []);

  const active = useMemo(() => {
    const found = store.routines.find((r) => r.id === store.activeId);
    return found || store.routines[0] || null;
  }, [store]);

  const persist = (next: RoutineStore) => {
    setStore(next);
    saveJSON(KEY, next);
  };

  const ensureDefault = () => {
    if (store.routines.length) return;
    const defaultRoutine: Routine = {
      id: uid("routine"),
      name: "Morning Routine",
      setName: "Morning Routine",
      sequence: ["Trading", "News", "Grow", "Money"],
      mode: "windows",
      tileStyle: "left-main",
      tilePreset: "single",
      displayAssignments: {},
      notes: "Apply Morning Routine set + open the core cockpit panels.",
      updatedAt: Date.now(),
    };
    persist({ activeId: defaultRoutine.id, routines: [defaultRoutine] });
  };

  useEffect(() => {
    ensureDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySet = (routine: Routine | null) => {
    if (!routine?.setName) {
      setToast("Pick a routine with a set name first.");
      return false;
    }
    const count = applyGlobalSet(routine.setName);
    if (!count) {
      setToast(`Set '${routine.setName}' is empty or missing. Use Save→Set from any panel first.`);
      return false;
    }
    setToast(`Applied set '${routine.setName}' to ${count} panel(s).`);
    return true;
  };

  const launch = (routine: Routine | null) => {
    if (!routine) return;
    const ok = applySet(routine);
    if (!ok) return;
    const seq = (routine.sequence || []).filter(Boolean);
    if (!seq.length) {
      setToast("Add at least one panel to the routine sequence.");
      return;
    }

    saveJSON("oddengine:routines:lastRun", { id: routine.id, name: routine.name, ts: Date.now(), sequence: seq });

    if (routine.mode === "windows") {
      const api = oddApi();
      seq.forEach((pid, idx) => openUndockedPanel(pid, idx, routine.id));
      // Auto-stack (tile) after a short tick so windows exist.
      if (isDesktop() && api.tileRoutineWindows) {
        setTimeout(() => {
          api.tileRoutineWindows?.({ routineId: routine.id, style: routine.tileStyle || "grid", preset: routine.tilePreset || "single", assignments: routine.displayAssignments || {} });
        }, 250);
      }
      setToast(`Launched '${routine.name}' in ${seq.length} window(s).`);
      return;
    }
    // main navigation mode: jump to first, and queue next steps.
    onNavigate?.(seq[0]);
    saveJSON("oddengine:routines:runState", { id: routine.id, idx: 0, sequence: seq, ts: Date.now() });
    setToast(`Launched '${routine.name}'. Use Next Panel to step through.`);
  };

  // Panel action hooks (from Mission Control / chips)
  useEffect(() => {
    const run = () => {
      const actions = getPanelActions("RoutineLauncher");
      if (!actions.length) return;
      actions.forEach((a) => {
        if (a.actionId === "routine:apply-set") {
          applySet(active);
          acknowledgePanelAction(a.id);
        }
        if (a.actionId === "routine:launch") {
          launch(active);
          acknowledgePanelAction(a.id);
        }
      });
    };
    run();
    const handler = () => run();
    window.addEventListener(PANEL_ACTION_EVENT, handler as any);
    return () => window.removeEventListener(PANEL_ACTION_EVENT, handler as any);
  }, [active]);

  const updateActive = (patch: Partial<Routine>) => {
    if (!active) return;
    const nextRoutine = { ...active, ...patch, updatedAt: Date.now() };
    const next: RoutineStore = {
      ...store,
      routines: store.routines.map((r) => (r.id === active.id ? nextRoutine : r)),
    };
    persist(next);
  };

  const addRoutine = () => {
    const r: Routine = {
      id: uid("routine"),
      name: `Routine ${store.routines.length + 1}`,
      setName: sets[0] || "",
      sequence: ["Trading", "News", "Grow", "Money"],
      mode: "windows",
      tileStyle: "grid",
      notes: "",
      updatedAt: Date.now(),
    };
    persist({ activeId: r.id, routines: [r, ...store.routines] });
    setToast("Added a routine.");
  };

  const deleteRoutine = () => {
    if (!active) return;
    const ok = window.confirm(`Delete routine '${active.name}'?`);
    if (!ok) return;
    const remaining = store.routines.filter((r) => r.id !== active.id);
    persist({ activeId: remaining[0]?.id || "", routines: remaining });
    setToast("Deleted routine.");
  };

  const togglePanelInSequence = (pid: string) => {
    if (!active) return;
    const set = new Set(active.sequence || []);
    if (set.has(pid)) set.delete(pid);
    else set.add(pid);
    updateActive({ sequence: Array.from(set) });
  };

  const runState = loadJSON<any>("oddengine:routines:runState", null as any);
  const canNext = !!(runState?.sequence?.length && typeof runState.idx === "number");
  const activeCount = active?.sequence?.length || 0;
  const launchModeLabel = active?.mode === "main" ? "Main shell" : "Windows";
  const nextPanel = () => {
    if (!onNavigate || !canNext) return;
    const seq: string[] = runState.sequence || [];
    const idx: number = runState.idx || 0;
    const nextIdx = Math.min(seq.length - 1, idx + 1);
    saveJSON("oddengine:routines:runState", { ...runState, idx: nextIdx, ts: Date.now() });
    onNavigate(seq[nextIdx]);
  };

  const tileNow = () => {
    if (!active) return;
    const api = oddApi();
    if (!isDesktop() || !api.tileRoutineWindows) {
      setToast("Tiling is only available in Desktop mode.");
      return;
    }
    api.tileRoutineWindows({ routineId: active.id, style: active.tileStyle || "grid", preset: active.tilePreset || "single", assignments: active.displayAssignments || {} } as any).then((res: any) => {
      if (!res?.ok) setToast(res?.error || "Failed to tile windows.");
      else setToast(`Tiled ${res?.count || ""} window(s) — style: ${res?.style || active.tileStyle || "grid"}.`);
    });
  };

  const closeNow = () => {
    if (!active) return;
    const api = oddApi();
    if (!isDesktop() || !api.closeRoutineWindows) {
      setToast("Close windows is only available in Desktop mode.");
      return;
    }
    api.closeRoutineWindows({ routineId: active.id } as any).then((res: any) => {
      if (!res?.ok) setToast(res?.error || "Failed to close routine windows.");
      else setToast(`Closed ${res?.closed ?? 0} routine window(s).`);
    });
  };

  return (
    <div>
      <PanelHeader panelId="RoutineLauncher" title="🚀 Routine Launcher" subtitle="Apply a global set + open a panel sequence in one click." />

      <div className="card softCard familyCohesionCard" style={{ marginTop: 12, marginBottom: 14 }}>
        <div className="familyCohesionTop">
          <div>
            <div className="small shellEyebrow">FAMILY FLOW</div>
            <div className="familyCohesionTitle">Launch the house in repeatable rhythms</div>
            <div className="small familyCohesionSub">Bundle meals, budget check-ins, chores, and calendar blocks into routines the household can actually reuse.</div>
          </div>
          <div className="familyRouteRow">
            <button className="tabBtn" onClick={() => onNavigate?.("Home")}>Open Home</button>
            <button className="tabBtn" onClick={() => onNavigate?.("GroceryMeals")}>Meals + Grocery</button>
            <button className="tabBtn" onClick={() => onNavigate?.("FamilyBudget")}>Budget</button>
            <button className="tabBtn" onClick={() => onNavigate?.("DailyChores")}>Chores</button>
          </div>
        </div>
      </div>

      <div className="card productivityHeroCard" style={{ marginTop: 12 }}>
        <div className="productivityHeroBar">
          <div>
            <div className="small shellEyebrow">PRODUCTIVITY COMMAND</div>
            <div className="productivityHeroTitle">Routine Launcher</div>
            <div className="small productivityHeroSub">Bundle your saved layouts, launch modes, and panel sequences into one reliable cockpit routine.</div>
          </div>
          <div className="row wrap productivityHeroBadges" style={{ justifyContent: "flex-end" }}>
            <span className="badge">Routines {store.routines.length}</span>
            <span className="badge">Set {active?.setName || "None"}</span>
            <span className="badge">Panels {activeCount}</span>
            <span className="badge">Launch {launchModeLabel}</span>
          </div>
        </div>
        <div className="productivityMetricsRow">
          <div className="productivityMetricCard">
            <div className="small shellEyebrow">ACTIVE</div>
            <div className="h mt-1">{active?.name || "No routine"}</div>
            <div className="small mt-2">Current focus routine</div>
          </div>
          <div className="productivityMetricCard">
            <div className="small shellEyebrow">SETS</div>
            <div className="h mt-1">{sets.length}</div>
            <div className="small mt-2">Saved global layouts</div>
          </div>
          <div className="productivityMetricCard">
            <div className="small shellEyebrow">STEP MODE</div>
            <div className="h mt-1">{canNext ? "Ready" : "Idle"}</div>
            <div className="small mt-2">Next-panel handoff</div>
          </div>
          <div className="productivityMetricCard">
            <div className="small shellEyebrow">DISPLAYS</div>
            <div className="h mt-1">{displays.length || 1}</div>
            <div className="small mt-2">Desktop targets detected</div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="banner" style={{ marginTop: 10 }}>
          {toast}
          <button className="btn ghost" style={{ marginLeft: 10 }} onClick={() => setToast("")}>Dismiss</button>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="h">Routines</div>
            <div className="sub">Save a routine = {"{set + sequence + launch mode}"}. Use windows mode for a true cockpit.</div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="tabBtn" onClick={addRoutine}>+ New Routine</button>
            <button className="tabBtn" onClick={() => applySet(active)}>Apply Set</button>
            <button className="btn" onClick={() => launch(active)}>🚀 Launch</button>
            <button className="tabBtn" onClick={tileNow}>🧩 Tile</button>
            <button className="tabBtn danger" onClick={closeNow}>🧹 Close</button>
            {canNext && <button className="tabBtn" onClick={nextPanel}>Next Panel →</button>}
          </div>
        </div>

        <div className="row" style={{ gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <select
            className="input"
            value={store.activeId}
            onChange={(e) => persist({ ...store, activeId: e.target.value })}
            style={{ minWidth: 260 }}
          >
            {store.routines.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <input
            className="input"
            value={active?.name || ""}
            onChange={(e) => updateActive({ name: e.target.value })}
            placeholder="Routine name"
            style={{ minWidth: 240 }}
          />
          <select
            className="input"
            value={active?.mode || "windows"}
            onChange={(e) => updateActive({ mode: (e.target.value as any) })}
            style={{ minWidth: 200 }}
          >
            <option value="windows">Launch: Windows</option>
            <option value="main">Launch: Main shell</option>
          </select>

          <select
            className="input"
            value={active?.tileStyle || "grid"}
            onChange={(e) => updateActive({ tileStyle: (e.target.value as any) })}
            style={{ minWidth: 200 }}
            title="How to tile routine windows after launch"
          >
            <option value="grid">Tile: Grid</option>
            <option value="left-main">Tile: Left-main + stack</option>
            <option value="hero">Tile: 2×2 Hero</option>

</select>
<select
  className="input"
  value={active?.tilePreset || "single"}
  onChange={(e) => {
    const v = e.target.value as any;
    const next: any = { tilePreset: v };
    // Auto-assign panels to displays for trader preset when possible
    if (v === "trader-main-3mon" && displays.length) {
      const map: Record<string, string> = { ...(active.displayAssignments || {}) };
      const orderedDisplays = [...displays].sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
      const primaryId = orderedDisplays[0]?.id;
      const others = orderedDisplays.slice(1).map((d) => d.id);
      const seq = active.sequence || [];
      if (seq[0] && primaryId) map[seq[0]] = primaryId;
      for (let i = 1; i < seq.length && i - 1 < others.length; i++) map[seq[i]] = others[i - 1];
      next.displayAssignments = map;
    }
    updateActive(next);
  }}
  style={{ minWidth: 220 }}
  title="Multi-monitor tiling preset"
>
  <option value="single">Preset: Single monitor</option>
  <option value="trader-main-3mon">Preset: Trader main + 3 monitors</option>
</select>

{(isDesktop() && displays.length > 1) ? (
  <div className="card" style={{ marginTop: 10 }}>
    <div style={{ fontWeight: 700, marginBottom: 6 }}>🖥️ Window assignments</div>
    <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 8 }}>
      Choose which display each panel window should open on. (Used by tiling + presets)
    </div>
    <div style={{ display: "grid", gap: 8 }}>
      {(active.sequence || []).map((pid) => (
        <div key={pid} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ minWidth: 190 }}>{getPanelMeta(pid).icon} {getPanelMeta(pid).title}</div>
          <select
            className="input"
            value={(active.displayAssignments && active.displayAssignments[pid]) || ""}
            onChange={(e) => {
              const map = { ...(active.displayAssignments || {}) } as any;
              const val = e.target.value;
              if (!val) delete map[pid];
              else map[pid] = val;
              updateActive({ displayAssignments: map });
            }}
            style={{ minWidth: 220 }}
          >
            <option value="">Auto</option>
            {displays.map((d) => (
              <option key={d.id} value={d.id}>
                {(d.isPrimary ? "Primary" : "Display") + " " + d.id}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  </div>
) : null}

<select
  className="input"
  value={active?.setName || ""}

            onChange={(e) => updateActive({ setName: e.target.value })}
            style={{ minWidth: 260 }}
          >
            <option value="">Set…</option>
            {sets.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="tabBtn" onClick={() => queuePanelAction("RoutineLauncher", "routine:launch")}>Queue Launch</button>
          <button className="tabBtn danger" onClick={deleteRoutine}>Delete</button>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="small" style={{ opacity: 0.9 }}>Panels in this sequence</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {panels.map((pid) => {
              const selected = !!active?.sequence?.includes(pid);
              return (
                <button
                  key={pid}
                  className={"tabBtn"}
                  onClick={() => togglePanelInSequence(pid)}
                  title={getPanelMeta(pid).title}
                  style={{
                    borderColor: selected ? "rgba(34,197,94,0.55)" : undefined,
                    background: selected ? "rgba(34,197,94,0.12)" : undefined,
                  }}
                >
                  {selected ? "✅" : "➕"} {pid}
                </button>
              );
            })}
          </div>
          <div className="small" style={{ marginTop: 10, opacity: 0.8 }}>
            Tip: Save layouts into a global set using the per-panel Layout Bar → <b>Save→Set</b>. Then pick that set here and Launch.
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="small" style={{ opacity: 0.9 }}>Notes</div>
          <textarea
            className="input"
            rows={3}
            value={active?.notes || ""}
            onChange={(e) => updateActive({ notes: e.target.value })}
            placeholder="What does this routine do?"
            style={{ width: "100%", marginTop: 6 }}
          />
        </div>
      </div>

      <div className="card softCard" style={{ marginTop: 12 }}>
        <div className="h">Pro moves</div>
        <div className="small" style={{ marginTop: 8, lineHeight: 1.45 }}>
          <ul>
            <li><b>Windows mode</b> = true cockpit (multiple panels visible at once).</li>
            <li><b>Main shell mode</b> = single-window focus; use <b>Next Panel</b> to step through the sequence.</li>
            <li>If a set is missing: open any panel → build layout → <b>Save→Set</b> → come back here and pick it.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
