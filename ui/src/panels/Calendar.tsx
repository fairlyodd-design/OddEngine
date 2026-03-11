import React, { useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { pushNotif } from "../lib/notifs";
import { PanelHeader } from "../components/PanelHeader";
import { PANEL_META, normalizePanelId } from "../lib/brain";
import { CALENDAR_FOCUS_EVENT, readAndClearCalendarFocus } from "../lib/calendarStore";

type CalEvent = {
  id: string;
  ts: number;
  date: string; // YYYY-MM-DD
  title: string;
  time?: string; // HH:MM (optional)
  notes?: string;
  panelId?: string; // optional deep link
};

const KEY = "oddengine:calendar:v1";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function weekdayShort(i: number) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i] || "";
}

function uid() {
  return `cal_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function isSameDay(a: string, b: string) {
  return a === b;
}

function safeTimeSort(t?: string) {
  if (!t) return "99:99";
  return t;
}

export default function Calendar({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const [store, setStore] = useState<{ events: CalEvent[] }>(() => loadJSON(KEY, { events: [] }));
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string>(() => fmtDate(new Date()));
  const [editing, setEditing] = useState<CalEvent | null>(null);

  useEffect(() => {
    const applyFocus = (dateStr: string) => {
      const d = String(dateStr || "").trim();
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(d)) return;
      setSelected(d);
      try {
        const dt = new Date(d + "T00:00:00");
        setCursor(startOfMonth(dt));
      } catch {
        // ignore
      }
    };

    const boot = readAndClearCalendarFocus();
    if (boot?.date) applyFocus(boot.date);

    const handler = (evt: any) => {
      const d = String(evt?.detail?.date || "");
      applyFocus(d);
    };

    try {
      window.addEventListener(CALENDAR_FOCUS_EVENT as any, handler as any);
    } catch {
      // ignore
    }

    return () => {
      try {
        window.removeEventListener(CALENDAR_FOCUS_EVENT as any, handler as any);
      } catch {
        // ignore
      }
    };
  }, []);


  function save(next: { events: CalEvent[] }) {
    setStore(next);
    saveJSON(KEY, next);
    try {
      window.dispatchEvent(new CustomEvent("oddengine:calendar-changed", { detail: { ts: Date.now() } }));
    } catch {
      // ignore
    }
  }

  const todayStr = useMemo(() => fmtDate(new Date()), []);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of store.events || []) {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => safeTimeSort(a.time).localeCompare(safeTimeSort(b.time)) || (b.ts - a.ts));
      map.set(k, list);
    }
    return map;
  }, [store.events]);

  const selectedEvents = useMemo(() => {
    return (eventsByDay.get(selected) || []).slice();
  }, [eventsByDay, selected]);

  const monthCells = useMemo(() => {
    const first = startOfMonth(cursor);
    const firstWeekday = first.getDay();
    const start = new Date(first);
    start.setDate(first.getDate() - firstWeekday);

    const cells: Array<{ date: Date; inMonth: boolean; key: string }> = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const inMonth = d.getMonth() === first.getMonth();
      cells.push({ date: d, inMonth, key: fmtDate(d) });
    }
    return cells;
  }, [cursor]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const nowKey = fmtDate(now);
    const all = (store.events || []).slice();
    all.sort((a, b) => (a.date + safeTimeSort(a.time)).localeCompare(b.date + safeTimeSort(b.time)));
    return all.filter((e) => e.date >= nowKey).slice(0, 12);
  }, [store.events]);

  const monthlyCount = useMemo(() => monthCells.filter((cell) => cell.inMonth).reduce((sum, cell) => sum + (eventsByDay.get(cell.key)?.length || 0), 0), [monthCells, eventsByDay]);
  const linkedCount = useMemo(() => (store.events || []).filter((e) => !!e.panelId).length, [store.events]);
  const busiestDay = useMemo(() => {
    let best = { date: selected, count: selectedEvents.length };
    for (const cell of monthCells) {
      if (!cell.inMonth) continue;
      const count = eventsByDay.get(cell.key)?.length || 0;
      if (count > best.count) best = { date: cell.key, count };
    }
    return best;
  }, [monthCells, eventsByDay, selected, selectedEvents.length]);

  function openNew(date: string) {
    setEditing({ id: uid(), ts: Date.now(), date, title: "", time: "", notes: "", panelId: "" });
  }

  function openEdit(ev: CalEvent) {
    setEditing({ ...ev });
  }

  function upsertEvent(ev: CalEvent) {
    const next = (store.events || []).slice();
    const idx = next.findIndex((x) => x.id === ev.id);
    if (idx >= 0) next[idx] = { ...ev, panelId: ev.panelId ? normalizePanelId(ev.panelId) : undefined };
    else next.unshift({ ...ev, panelId: ev.panelId ? normalizePanelId(ev.panelId) : undefined });
    save({ events: next });
    pushNotif({ title: "Calendar", body: "Saved event.", tags: ["Calendar"], level: "good" });
  }

  function deleteEvent(id: string) {
    const next = (store.events || []).slice().filter((e) => e.id !== id);
    save({ events: next });
    pushNotif({ title: "Calendar", body: "Deleted event.", tags: ["Calendar"], level: "muted" as any });
  }

  const panelOptions = useMemo(() => {
    return PANEL_META
      .map((p) => ({ id: normalizePanelId(p.id), title: p.title, section: p.section }))
      .sort((a, b) => (a.section + a.title).localeCompare(b.section + b.title));
  }, []);

  return (
    <div className="card">
      <PanelHeader panelId="Calendar" title="Calendar" storagePrefix="oddengine:calendar" />

      <div className="calendarWrap panelBody">
        <div className="subCard glass productivityHeroCard">
          <div className="productivityHeroBar">
            <div>
              <div className="small shellEyebrow">PRODUCTIVITY COMMAND</div>
              <div className="productivityHeroTitle">Calendar</div>
              <div className="small productivityHeroSub">Plan your day, launch linked panels from reminders, and keep the cockpit moving without losing the month view.</div>
            </div>
            <div className="row wrap productivityHeroBadges" style={{ justifyContent: "flex-end" }}>
              <span className="badge">This month {monthlyCount}</span>
              <span className="badge">Upcoming {upcoming.length}</span>
              <span className="badge">Linked {linkedCount}</span>
              <span className="badge">Focus {selected}</span>
            </div>
          </div>
          <div className="productivityMetricsRow">
            <div className="productivityMetricCard">
              <div className="small shellEyebrow">TODAY</div>
              <div className="h mt-1">{(eventsByDay.get(todayStr) || []).length}</div>
              <div className="small mt-2">Events on deck</div>
            </div>
            <div className="productivityMetricCard">
              <div className="small shellEyebrow">BUSIEST DAY</div>
              <div className="h mt-1">{busiestDay.count}</div>
              <div className="small mt-2">{busiestDay.date}</div>
            </div>
            <div className="productivityMetricCard">
              <div className="small shellEyebrow">SELECTED DAY</div>
              <div className="h mt-1">{selectedEvents.length}</div>
              <div className="small mt-2">Items in focus</div>
            </div>
            <div className="productivityMetricCard">
              <div className="small shellEyebrow">PANEL LINKS</div>
              <div className="h mt-1">{linkedCount}</div>
              <div className="small mt-2">Deep-link reminders</div>
            </div>
          </div>
        </div>
        <div className="subCard glass">
          <div className="calendarTop">
            <div>
              <div className="small">Schedule</div>
              <div className="h mt-1">📅 {monthLabel(cursor)}</div>
              <div className="small mt-2" style={{ opacity: 0.9 }}>
                Click a day to view/add. Stored locally.
              </div>
            </div>
            <div className="row wrap" style={{ justifyContent: "flex-end" }}>
              <button className="tabBtn" onClick={() => setCursor(addMonths(cursor, -1))}>←</button>
              <button className="tabBtn" onClick={() => { const d = startOfMonth(new Date()); setCursor(d); setSelected(fmtDate(new Date())); }}>Today</button>
              <button className="tabBtn" onClick={() => setCursor(addMonths(cursor, 1))}>→</button>
              <button className="btn" onClick={() => openNew(selected)}>+ Add</button>
            </div>
          </div>

          <div className="calendarWeekdays">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="calendarWeekday">{weekdayShort(i)}</div>
            ))}
          </div>

          <div className="calendarGrid">
            {monthCells.map((cell) => {
              const key = cell.key;
              const isToday = isSameDay(key, todayStr);
              const isSel = isSameDay(key, selected);
              const dots = (eventsByDay.get(key) || []).slice(0, 3);
              return (
                <div
                  key={cell.key}
                  className={[
                    "calendarCell",
                    cell.inMonth ? "inMonth" : "outMonth",
                    isToday ? "today" : "",
                    isSel ? "selected" : "",
                  ].join(" ")}
                  onClick={() => setSelected(key)}
                  onDoubleClick={() => openNew(key)}
                  title="Click to select • Double-click to add"
                >
                  <div className="calendarCellTop">
                    <div className="calendarDayNum">{cell.date.getDate()}</div>
                    {!!dots.length && <div className="calendarDotRow">{dots.map((d) => <span key={d.id} className="calendarDot" />)}</div>}
                  </div>
                  {!!dots.length && (
                    <div className="calendarCellPeek">
                      {dots.map((ev) => (
                        <div key={ev.id} className="calendarPeekLine">
                          <span className="calendarPeekTime">{ev.time || ""}</span>
                          <span className="calendarPeekTitle">{ev.title || "(untitled)"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid loose">
          <div className="subCard glass">
            <div className="cluster wrap spread end">
              <div>
                <div className="small">Selected day</div>
                <div className="h mt-1">{selected}</div>
              </div>
              <div className="row wrap" style={{ gap: 10 }}>
                <button className="tabBtn" onClick={() => openNew(selected)}>+ Add</button>
                <button className="tabBtn" onClick={() => { setSelected(todayStr); setCursor(startOfMonth(new Date())); }}>Jump to today</button>
              </div>
            </div>

            <div className="grid mt-4">
              {selectedEvents.length === 0 ? (
                <div className="small" style={{ opacity: 0.85 }}>No events yet. Double-click a day to add one.</div>
              ) : (
                selectedEvents.map((ev) => (
                  <div key={ev.id} className="subCard dim">
                    <div className="cluster wrap spread">
                      <div style={{ minWidth: 0 }}>
                        <div className="cluster wrap" style={{ fontWeight: 900 }}>
                          <span className="badge">{ev.time || "Anytime"}</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title || "(untitled)"}</span>
                        </div>
                        {ev.notes && <div className="small mt-2" style={{ opacity: 0.9 }}>{ev.notes}</div>}
                        {ev.panelId && <div className="small mt-2" style={{ opacity: 0.85 }}>Panel link: <b>{ev.panelId}</b></div>}
                      </div>
                      <div className="row wrap" style={{ gap: 10 }}>
                        {ev.panelId && !!onNavigate && (
                          <button className="tabBtn" onClick={() => onNavigate(normalizePanelId(ev.panelId || ""))}>Open panel</button>
                        )}
                        <button className="tabBtn" onClick={() => openEdit(ev)}>Edit</button>
                        <button className="tabBtn" onClick={() => { if (window.confirm("Delete this event?")) deleteEvent(ev.id); }}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="subCard glass">
            <div style={{ fontWeight: 900 }}>Upcoming</div>
            <div className="small" style={{ opacity: 0.85 }}>Next few scheduled items.</div>

            <div className="grid mt-4">
              {upcoming.length === 0 ? (
                <div className="small" style={{ opacity: 0.85 }}>Nothing scheduled. Add a few key reminders (bill due dates, routines, grow flips).</div>
              ) : (
                upcoming.map((ev) => (
                  <div key={ev.id} className="row spread" style={{ alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>{ev.date} <span className="badge" style={{ marginLeft: 8 }}>{ev.time || "Anytime"}</span></div>
                      <div className="small" style={{ opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title || "(untitled)"}</div>
                    </div>
                    <button className="tabBtn" onClick={() => { setSelected(ev.date); setCursor(startOfMonth(new Date(ev.date + "T00:00:00"))); }}>View</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <div className="modalOverlay" role="dialog" aria-modal="true" onMouseDown={() => setEditing(null)}>
          <div className="modalCard" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className="modalHeader">
              <div className="modalTitle">{editing.title ? "Edit" : "New"} event</div>
              <button className="modalClose" onClick={() => setEditing(null)} aria-label="Close">✕</button>
            </div>
            <div className="modalBody">
              <div className="grid">
                <div className="cluster wrap">
                  <div style={{ minWidth: 160, flex: 1 }}>
                    <div className="small">Date</div>
                    <input value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
                  </div>
                  <div style={{ width: 140 }}>
                    <div className="small">Time (optional)</div>
                    <input value={editing.time || ""} placeholder="HH:MM" onChange={(e) => setEditing({ ...editing, time: e.target.value })} />
                  </div>
                </div>

                <div>
                  <div className="small">Title</div>
                  <input value={editing.title} placeholder="What’s happening?" onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                </div>

                <div>
                  <div className="small">Notes</div>
                  <textarea value={editing.notes || ""} placeholder="Optional notes" onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
                </div>

                <div>
                  <div className="small">Optional panel link</div>
                  <select value={editing.panelId || ""} onChange={(e) => setEditing({ ...editing, panelId: e.target.value })}>
                    <option value="">None</option>
                    {panelOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.section} • {p.title}</option>
                    ))}
                  </select>
                  <div className="small mt-2" style={{ opacity: 0.85 }}>Tip: Link reminders straight into Trading, Grow, Budget, etc.</div>
                </div>
              </div>
            </div>
            <div className="modalFooter">
              <button className="modalPrimary" onClick={() => { upsertEvent(editing); setEditing(null); }}>Save</button>
              <button className="modalSecondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
