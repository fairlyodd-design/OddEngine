import React, { useEffect, useMemo, useState } from "react";
import { isDesktop } from "../lib/odd";
import { loadJSON, saveJSON } from "../lib/storage";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import { addQuickEvent, fmtDate } from "../lib/calendarStore";
import { pushNotif } from "../lib/notifs";

const KEY = "oddengine:security:v1";
const PLUGIN_KEY = "oddengine:plugins:user:v1";

type Sec = { ipLock: boolean };

export default function Security({ onNavigate }: { onNavigate?: (id: string) => void } = {}) {
  const nav = onNavigate || (() => {});
  const [sec, setSec] = useState<Sec>(() => loadJSON(KEY, { ipLock: true }));
  const plugins = loadJSON<any[]>(PLUGIN_KEY, []);

  useEffect(() => { saveJSON(KEY, sec); }, [sec]);

  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const blocked = useMemo(() => sec.ipLock && !isLocal, [sec.ipLock, isLocal]);
  const localMode = sec.ipLock && isLocal;

  const trustCards = [
    { title: "Surface", body: localMode ? "Local-only session" : "LAN-friendly / broader exposure", level: localMode ? "good" : "warn" },
    { title: "Runtime", body: isDesktop() ? "Desktop / Electron runtime" : "Browser / Vite runtime", level: isDesktop() ? "good" : "warn" },
    { title: "Plugins", body: `${plugins.length} local plugin records`, level: plugins.length ? "warn" : "good" },
    { title: "Host", body: host, level: isLocal ? "good" : "warn" },
  ];

  const badges = [
    { label: localMode ? "Local-only" : sec.ipLock ? "IP lock on" : "IP lock off", tone: localMode ? "good" : sec.ipLock ? "warn" : "warn" as any },
    { label: isDesktop() ? "Desktop" : "Web", tone: isDesktop() ? "good" : "muted" as any },
    { label: `${plugins.length} plugins`, tone: plugins.length ? "warn" : "good" as any },
    { label: host, tone: isLocal ? "good" : "warn" as any },
  ];

  const securityMetrics = [
    { label: "Lock posture", value: sec.ipLock ? "Locked" : "Open", note: localMode ? "localhost only" : isLocal ? "can allow LAN" : "remote host" },
    { label: "Runtime", value: isDesktop() ? "Desktop" : "Web", note: isDesktop() ? "local shell access" : "browser restrictions" },
    { label: "Plugin load", value: String(plugins.length), note: plugins.length ? "review permissions" : "clean local bay" },
    { label: "Host", value: isLocal ? "Local" : "LAN", note: host },
  ];

  const toolsMenu = (
    <ActionMenu
      title="Security tools"
      items={[
        { label: "Open Calendar", onClick: () => nav("Calendar") },
        { label: "Add security audit", onClick: () => { addQuickEvent({ title: "Security: audit", panelId: "Security", date: fmtDate(new Date()), notes: "Review IP lock, plugins, backups, updates." }); pushNotif({ title: "Security", body: "Added audit to Calendar.", tags: ["Security"], level: "good" as any }); } },
        { label: sec.ipLock ? "Disable IP lock (allow LAN)" : "Enable IP lock (local only)", onClick: () => setSec({ ipLock: !sec.ipLock }), tone: sec.ipLock ? "danger" : "default" },
      ]}
    />
  );

  if (blocked) {
    return (
      <div className="page">
        <PanelHeader
          title="🛡️ Security Sentinel"
          subtitle="Trust center for local-only mode, plugin count, host awareness, and hardening reminders."
          panelId="Security"
          storagePrefix="oddengine:security"
          storageActionsMode="menu"
          badges={badges as any}
          rightSlot={toolsMenu}
        />
        <div className="card softCard">
          <div className="bannerLan" style={{ marginTop: 0 }}>
            <b>Blocked:</b> IP Lock is ON, and you opened this on <code>{host}</code>.<br />
            Use <code>http://localhost:5173</code> instead.
          </div>
          <button onClick={() => setSec({ ipLock: false })}>Disable IP Lock (allow LAN)</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PanelHeader
        title="🛡️ Security Sentinel"
        subtitle="Trust center for local-only mode, plugin count, host awareness, and hardening reminders."
        panelId="Security"
        storagePrefix="oddengine:security"
        storageActionsMode="menu"
        badges={badges as any}
        rightSlot={toolsMenu}
      />


      <div className="card opsHeroCard">
        <div className="opsHeroBar">
          <div>
            <div className="small shellEyebrow">OPS / TRUST CENTER</div>
            <div className="opsHeroTitle">Security Sentinel</div>
            <div className="opsHeroSub">Local-only posture, runtime trust, plugin exposure, and hardening cadence in one calmer command surface.</div>
          </div>
          <div className="row wrap opsHeroBadges" style={{ justifyContent: "flex-end" }}>
            <span className={`badge ${sec.ipLock ? "good" : "warn"}`}>{sec.ipLock ? "IP Lock On" : "IP Lock Off"}</span>
            <span className={`badge ${isDesktop() ? "good" : "warn"}`}>{isDesktop() ? "Desktop" : "Web"}</span>
            <span className={`badge ${isLocal ? "good" : "warn"}`}>{isLocal ? "Local host" : host}</span>
          </div>
        </div>
        <div className="opsMetricStrip">
          {securityMetrics.map((item) => (
            <div key={item.label} className="opsMetricCard">
              <div className="small shellEyebrow">{item.label}</div>
              <div className="opsMetricValue">{item.value}</div>
              <div className="small">{item.note}</div>
            </div>
          ))}
        </div>
      </div>

      <PanelScheduleCard
        panelId="Security"
        title="Security schedule"
        subtitle="Quick-add hardening reminders + upcoming items."
        presets={[
          { label: "+ Audit", title: "Security: audit", notes: "Review IP lock, plugins, updates, backups." },
          { label: "+ Backup", title: "Security: backup", offsetDays: 7, notes: "Snapshot configs + exports." },
          { label: "+ Update", title: "Security: update check", offsetDays: 7, notes: "OS, browser, node, dependencies." },
          { label: "+ Passwords", title: "Security: rotate passwords", offsetDays: 30, notes: "Rotate key logins + 2FA." },
        ]}
        onNavigate={nav}
      />

      {!sec.ipLock && !isLocal && (
        <div className="bannerLan">
          <b>LAN Access Enabled:</b> IP Lock is OFF. Anyone on your network can open this UI if reachable.
        </div>
      )}

      <div className="grid2">
        {trustCards.map((c) => (
          <div key={c.title} className="card softCard">
            <div className="h">{c.title}</div>
            <div className="sub">{c.body}</div>
          </div>
        ))}
      </div>

      <div className="card softCard">
        <div className="h">Controls</div>
        <div className="row" style={{ marginTop: 10, flexWrap: "wrap", gap: 10 }}>
          <label className="row" style={{ gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={sec.ipLock} onChange={(e) => setSec({ ipLock: e.target.checked })} />
            <span className="small"><b>IP Lock</b> (recommended): allow only localhost access</span>
          </label>
        </div>

        <div className="small" style={{ marginTop: 10 }}>
          Tip: Keep IP Lock ON unless you intentionally want LAN access (e.g., phone on same Wi‑Fi).
        </div>
      </div>
    </div>
  );
}
