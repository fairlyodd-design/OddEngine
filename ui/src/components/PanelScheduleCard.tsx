import React, { useEffect, useMemo, useState } from "react";
import ActionMenu from "./ActionMenu";
import { CALENDAR_EVENT, addQuickEvent, fmtDate, listUpcoming } from "../lib/calendarStore";

type Preset = { label: string; title: string; time?: string; offsetDays?: number; notes?: string };

export function PanelScheduleCard({
  panelId,
  title = "Schedule",
  subtitle = "Quick-add reminders + upcoming items.",
  presets,
  onNavigate,
  showAllUpcoming = false,
}: {
  panelId?: string;
  title?: string;
  subtitle?: string;
  presets?: Preset[];
  onNavigate?: (panelId: string) => void;
  showAllUpcoming?: boolean;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((v) => v + 1);
    window.addEventListener(CALENDAR_EVENT, bump as EventListener);
    window.addEventListener("storage", bump as EventListener);
    return () => {
      window.removeEventListener(CALENDAR_EVENT, bump as EventListener);
      window.removeEventListener("storage", bump as EventListener);
    };
  }, []);

  const upcoming = useMemo(() => {
    return listUpcoming({ panelId: showAllUpcoming ? undefined : panelId, limit: 8 });
  }, [panelId, showAllUpcoming, tick]);

  const defaultPresets: Preset[] = useMemo(
    () =>
      presets || [
        { label: "+ Review", title: "Review" },
        { label: "+ Check-in", title: "Check-in" },
      ],
    [presets]
  );

  const addPreset = (p: Preset) => {
    const base = new Date();
    if (p.offsetDays) base.setDate(base.getDate() + p.offsetDays);
    addQuickEvent({
      title: p.title,
      panelId,
      date: fmtDate(base),
      time: p.time,
      notes: p.notes,
    });
  };

  const presetMenu = useMemo(
    () =>
      defaultPresets.slice(0, 8).map((p) => ({
        label: p.label,
        onClick: () => addPreset(p),
      })),
    [defaultPresets]
  );

  return (
    <div className="card softCard" data-title={title}>
      <div className="widgetHeader">
        <div className="widgetHeaderLeft">
          <div className="widgetTitle">{title}</div>
          <div className="widgetSubtitle">{subtitle}</div>
        </div>
        <div className="widgetHeaderRight">
          <ActionMenu label="+ Add ▾" title="Quick add" items={presetMenu} />
          <button className="tabBtn active" onClick={() => onNavigate?.("Calendar")}>
            Open Calendar
          </button>
        </div>
      </div>

      <div className="widgetBody">
        <div className="assistantStack">
          {upcoming.length === 0 ? <div className="small">No upcoming items yet.</div> : null}
          {upcoming.map((ev) => (
            <div key={ev.id} className="timelineCard" onClick={() => ev.panelId && onNavigate?.(ev.panelId)}>
              <div
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}
              >
                <div style={{ fontWeight: 800 }}>{ev.title || "(untitled)"}</div>
                <span className="badge">
                  {ev.date}
                  {ev.time ? ` ${ev.time}` : ""}
                </span>
              </div>
              {ev.panelId ? (
                <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>
                  Opens: {ev.panelId}
                </div>
              ) : null}
              {ev.notes ? <div className="small" style={{ marginTop: 6 }}>{ev.notes}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
