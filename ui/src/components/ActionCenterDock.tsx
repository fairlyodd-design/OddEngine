import React, { useEffect, useMemo, useState } from "react";
import { getPanelMeta } from "../lib/brain";
import {
  buildResumeActions,
  dismissPulse,
  getActionCenterEventName,
  getLiveStatus,
  getPinnedPanelIds,
  getPulseItems,
  getRecentPanelVisits,
  markPulseSeen,
  togglePinnedPanel,
} from "../lib/osActionCenter";

export default function ActionCenterDock({
  activePanelId,
  onNavigate,
  mode = "expanded",
}: {
  activePanelId: string;
  onNavigate: (id: string) => void;
  mode?: "expanded" | "compact" | "collapsed";
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((value) => value + 1);
    const eventName = getActionCenterEventName();
    window.addEventListener(eventName, bump as EventListener);
    window.addEventListener("storage", bump as EventListener);
    return () => {
      window.removeEventListener(eventName, bump as EventListener);
      window.removeEventListener("storage", bump as EventListener);
    };
  }, []);

  const live = useMemo(() => {
    void tick;
    return getLiveStatus(activePanelId);
  }, [activePanelId, tick]);
  const resume = useMemo(() => {
    void tick;
    return buildResumeActions(activePanelId);
  }, [activePanelId, tick]);
  const pulses = useMemo(() => {
    void tick;
    return getPulseItems(4);
  }, [tick]);
  const recent = useMemo(() => {
    void tick;
    return getRecentPanelVisits(4);
  }, [tick]);
  const pinned = useMemo(() => {
    void tick;
    return getPinnedPanelIds().slice(0, 4).map((id) => getPanelMeta(id));
  }, [tick]);

  if (mode === "collapsed") {
    return (
      <div className="liveStatusDock compact">
        <span className="liveStatusChip">{live.activeIcon} {live.activeTitle}</span>
        <span className="liveStatusChip">{live.focusLane}</span>
        <span className="liveStatusChip">{live.pulseCount} pulse</span>
      </div>
    );
  }

  return (
    <div className="actionCenterDock card softCard">
      <div className="liveStatusDock">
        <span className="liveStatusChip active">{live.activeIcon} {live.activeTitle}</span>
        <span className="liveStatusChip">Focus • {live.focusLane}</span>
        <span className="liveStatusChip">{live.pulseCount} pulse</span>
        <span className="liveStatusChip">{live.recentCount} recent</span>
        <span className="liveStatusChip">{live.pinnedCount} pinned</span>
      </div>

      <div className="actionCenterGrid">
        <section className="actionCenterCard">
          <div className="actionCenterHeader">
            <div>
              <div className="small shellEyebrow">Resume</div>
              <div className="h">Continue where you left off</div>
            </div>
            <button className="tabBtn" onClick={() => togglePinnedPanel(activePanelId)}>Pin active</button>
          </div>
          <div className="actionChipWrap">
            {resume.map((item) => (
              <button key={item.panelId} className="actionJumpChip" onClick={() => onNavigate(item.panelId)}>
                <span>{item.icon} {item.label}</span>
                <small>{item.sub}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="actionCenterCard">
          <div className="actionCenterHeader">
            <div>
              <div className="small shellEyebrow">Action center</div>
              <div className="h">Pulse + suggested moves</div>
            </div>
          </div>
          <div className="actionPulseStack">
            {pulses.length ? pulses.map((pulse) => (
              <div key={pulse.id} className={`pulseCard ${pulse.kind}`}>
                <div>
                  <div className="pulseTitle">{pulse.label}</div>
                  <div className="sub">{pulse.body}</div>
                </div>
                <div className="pulseActions">
                  {pulse.panelId ? <button className="tabBtn" onClick={() => { markPulseSeen(pulse.id); onNavigate(pulse.panelId!); }}>Open</button> : null}
                  <button className="tabBtn" onClick={() => markPulseSeen(pulse.id)}>Seen</button>
                  <button className="tabBtn" onClick={() => dismissPulse(pulse.id)}>Dismiss</button>
                </div>
              </div>
            )) : <div className="sub">No active pulses. This lane will light up as you move between Home, Trading, Family, Studio, and Homie.</div>}
          </div>
        </section>
      </div>

      <div className="actionCenterFooter">
        <div className="actionFooterBlock">
          <div className="small shellEyebrow">Recent panels</div>
          <div className="assistantChipWrap">
            {recent.map((item) => (
              <button key={item.panelId + item.ts} className="tabBtn" onClick={() => onNavigate(item.panelId)}>{item.icon} {item.title}</button>
            ))}
          </div>
        </div>
        <div className="actionFooterBlock">
          <div className="small shellEyebrow">Pinned</div>
          <div className="assistantChipWrap">
            {pinned.length ? pinned.map((item) => (
              <button key={item.id} className="tabBtn active" onClick={() => onNavigate(item.id)}>{item.icon} {item.title}</button>
            )) : <span className="small">Pin a few rooms you use a lot.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
