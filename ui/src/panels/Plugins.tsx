import React, { useEffect, useMemo, useRef, useState } from "react";
import { isDesktop, oddApi } from "../lib/odd";
import { loadJSON, saveJSON } from "../lib/storage";
import { pushNotif } from "../lib/notifs";
import { downloadZip } from "../lib/files";
import { localGenerate } from "../lib/generators";
import { PanelHeader } from "../components/PanelHeader";
import ActionMenu from "../components/ActionMenu";
import { PanelScheduleCard } from "../components/PanelScheduleCard";
import { addQuickEvent, fmtDate } from "../lib/calendarStore";
import {
  USER_PLUGIN_KEY,
  UPGRADE_PACKS_EVENT,
  getUpgradeBayStats,
  getUpgradePackHistory,
  getUpgradePackSummaries,
  grantUpgradePackPermission,
  installUpgradePack,
  repairUpgradePackDependencies,
  setUpgradePackEnabled,
  uninstallUpgradePack,
  updateAllUpgradePacks,
} from "../lib/plugins";

type Plugin = {
  id: string;
  name: string;
  version: string;
  description?: string;
  ui?: string;
  actions?: Array<{ id: string; label: string; type: "open_url" | "generate" | "run"; payload?: any }>;
  _source?: string;
};

async function fetchJson(path: string) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export default function Plugins({ onNavigate }: { onNavigate?: (id: string) => void } = {}) {
  const desktop = isDesktop();
  const nav = onNavigate || (() => {});
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [user, setUser] = useState<Plugin[]>(() => loadJSON(USER_PLUGIN_KEY, []));
  const [desktopPlugins, setDesktopPlugins] = useState<Plugin[]>([]);
  const [builtins, setBuiltins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  function saveUser(next: Plugin[]) {
    setUser(next);
    saveJSON(USER_PLUGIN_KEY, next);
    setTick((v) => v + 1);
  }

  async function loadBuiltins() {
    try {
      // IMPORTANT: Use relative paths so file:// (Electron packaged) works.
      const reg = await fetchJson("plugins/registry.json");
      const files: string[] = Array.isArray(reg?.files) ? reg.files : [];
      const list: Plugin[] = [];
      for (const f of files) {
        try {
          const j = await fetchJson(`plugins/${f}`);
          list.push({ ...j, _source: "builtin" });
        } catch {}
      }
      setBuiltins(list);
    } catch {
      setBuiltins([]);
    }
  }

  async function loadDesktop() {
    if (!desktop) return;
    try {
      const r = await oddApi().listPlugins();
      if (r.ok) {
        setDesktopPlugins((r.plugins || []).map((p: any) => ({ ...p, _source: "desktop" })));
      }
    } catch {}
  }

  async function refresh() {
    setLoading(true);
    await Promise.all([loadBuiltins(), loadDesktop()]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const handler = () => setTick((v) => v + 1);
    window.addEventListener(UPGRADE_PACKS_EVENT, handler as EventListener);
    return () => window.removeEventListener(UPGRADE_PACKS_EVENT, handler as EventListener);
  }, []);

  const upgradePacks = useMemo(() => getUpgradePackSummaries(), [tick]);
  const bayStats = useMemo(() => getUpgradeBayStats(), [tick]);
  const upgradeHistory = useMemo(() => getUpgradePackHistory().slice(0, 10), [tick]);

  const all = useMemo(() => {
    const map = new Map<string, Plugin>();
    for (const p of [...desktopPlugins, ...builtins, ...user]) map.set(p.id, p);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [desktopPlugins, builtins, user]);

  const pluginMetrics = [
    { label: "Installed", value: String(bayStats.installed), note: `${bayStats.healthy} healthy packs` },
    { label: "Updates", value: String(bayStats.updates), note: bayStats.updates ? "sync available" : "all current" },
    { label: "Sources", value: String(all.length), note: `${builtins.length} built-in • ${user.length} user` },
    { label: "Mode", value: desktop ? "Desktop" : "Web", note: desktop ? "folder actions live" : "web-safe mode" },
  ];

  async function openPluginsFolder() {
    if (!desktop) {
      pushNotif({ title: "Plugins", body: "Desktop mode required to open plugins folder.", tags: ["Plugins"], level: "warn" });
      return;
    }
    try {
      const r = await oddApi().openPluginsFolder();
      pushNotif({ title: "Plugins", body: `Opened: ${r.path}`, tags: ["Plugins"], level: "good" });
    } catch (e: any) {
      pushNotif({ title: "Plugins", body: String(e?.message || e), tags: ["Plugins"], level: "warn" });
    }
  }

  function importJsonFile() {
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const raw = await f.text();
      const j = JSON.parse(raw);
      if (!j.id) throw new Error("Missing plugin id");
      const p: Plugin = {
        id: String(j.id),
        name: String(j.name || j.id),
        version: String(j.version || "0.0.0"),
        description: j.description ? String(j.description) : "",
        ui: j.ui ? String(j.ui) : "",
        actions: Array.isArray(j.actions) ? j.actions : [],
        _source: "user",
      };
      saveUser([p, ...user.filter((x) => x.id !== p.id)]);
      pushNotif({ title: "Plugins", body: `Imported ${p.name}.`, tags: ["Plugins"], level: "good" });
    } catch (err: any) {
      pushNotif({ title: "Plugins", body: String(err?.message || err), tags: ["Plugins"], level: "warn" });
    }
  }

  function removeUser(id: string) {
    saveUser(user.filter((p) => p.id !== id));
  }

  function openUrl(u: string) {
    try {
      const raw = String(u || "").trim();
      if (!raw) return;

      // Internal navigation helper:
      // Many manifests use "/?panel=News" etc. That breaks under file:// because
      // it becomes file:///?panel=News. Normalize to a relative URL.
      const normalized = /^https?:\/\//i.test(raw)
        ? raw
        : raw.startsWith("/")
        ? `.${raw}`
        : raw;

      const href = new URL(normalized, window.location.href).toString();
      window.open(href, "_blank", "noopener,noreferrer");
    } catch {}
  }

  function formatWhen(at?: number) {
    if (!at) return "never";
    try {
      return new Date(at).toLocaleString();
    } catch {
      return "recently";
    }
  }

  async function runAction(a: any) {
    try {
      if (a.type === "open_url" && a.payload?.url) {
        openUrl(a.payload.url);
        return;
      }
      if (a.type === "generate") {
        const genType = a.payload?.type || a.id;
        if (desktop) {
          const odd = oddApi();
          const res = await odd.generate({ ...(a.payload || {}), type: genType, opts: { brand: "FairlyOdd" } });
          if (res?.ok) pushNotif({ title: "Plugins", body: `Generated ${genType} → ${res.outDir}`, tags: ["Plugins"], level: "success" });
          else pushNotif({ title: "Plugins", body: res?.error || "Generate failed", tags: ["Plugins"], level: "warn" });
        } else {
          const files = localGenerate(genType);
          if (!files.length) pushNotif({ title: "Plugins", body: `Web mode can’t run "${genType}" (no local template). Use Desktop mode.`, tags: ["Plugins"], level: "warn" });
          else {
            await downloadZip(`${genType}.zip`, files, genType);
            pushNotif({ title: "Plugins", body: `Downloaded ${genType}.zip`, tags: ["Plugins"], level: "success" });
          }
        }
        return;
      }
      if (a.type === "run") {
        if (!desktop) {
          pushNotif({ title: "Plugins", body: "Run actions require Desktop mode.", tags: ["Plugins"], level: "warn" });
          return;
        }
        const odd = oddApi();
        const payload = a.payload || {};
        if (!payload.cmd) {
          pushNotif({ title: "Plugins", body: "Run action missing payload.cmd", tags: ["Plugins"], level: "warn" });
          return;
        }
        await odd.run(payload);
        pushNotif({ title: "Plugins", body: `Started: ${payload.cmd}`, tags: ["Plugins"], level: "success" });
        return;
      }
      pushNotif({ title: "Plugins", body: "Unknown action type.", tags: ["Plugins"], level: "warn" });
    } catch (e: any) {
      pushNotif({ title: "Plugins", body: String(e?.message || e), tags: ["Plugins"], level: "warn" });
    }
  }

  return (
    <div className="page">
      <PanelHeader
        panelId="Plugins"
        title="🧩 Plugins"
        subtitle="Install panel-upgrade packs so new sections can grow without core rewrites."
        storagePrefix="oddengine:plugins"
        storageActionsMode="menu"
        badges={[
          { label: `${bayStats.installed}/${bayStats.total} installed`, tone: "good" },
          { label: `${bayStats.updates} updates`, tone: bayStats.updates ? "warn" : "good" },
          { label: `${bayStats.permissionIssues} permission issues`, tone: bayStats.permissionIssues ? "warn" : "good" },
          { label: `${bayStats.dependencyIssues} dependency issues`, tone: bayStats.dependencyIssues ? "warn" : "good" },
          { label: `${bayStats.healthy} healthy`, tone: bayStats.healthy === bayStats.installed ? "good" : "warn" },
        ]}
        primaryAction={{ label: loading ? "Refreshing…" : "Refresh", onClick: () => { if(!loading) refresh(); } }}
        rightSlot={
          <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="tabBtn active" onClick={() => { updateAllUpgradePacks(); setTick((v) => v + 1); pushNotif({ title: "Plugins", body: "Upgrade bay synced all outdated packs.", tags: ["Plugins"], level: "success" }); }}>
              Update all packs
            </button>
            <ActionMenu
              title="Plugin tools"
              items={[
                { label: "Open Calendar", onClick: () => nav("Calendar") },
                { label: "Add update reminder (today)", onClick: () => addQuickEvent({ title: "Plugins: update packs", panelId: "Plugins", date: fmtDate(new Date()), notes: "Run Update all packs + verify permissions." }) },
                { label: "Open Plugins Folder", onClick: openPluginsFolder, disabled: !desktop },
                { label: "Import .plugin.json", onClick: importJsonFile },
                { label: "Update stable channel", onClick: () => { updateAllUpgradePacks("stable"); setTick((v) => v + 1); pushNotif({ title: "Plugins", body: "Stable-channel packs were checked for updates.", tags: ["Plugins"], level: "success" }); } },
                { label: "Repair dependencies", onClick: () => { upgradePacks.filter((pack) => pack.dependencyIssues?.length).forEach((pack) => repairUpgradePackDependencies(pack.id)); setTick((v) => v + 1); pushNotif({ title: "Plugins", body: "Dependency repair flow ran for packs that needed it.", tags: ["Plugins"], level: "success" }); }, disabled: !upgradePacks.some((pack) => pack.dependencyIssues?.length) },
              ]}
            />
            <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={onFile} />
          </div>
        }
      />

      <div className="card opsHeroCard">
        <div className="opsHeroBar">
          <div>
            <div className="small shellEyebrow">OPS / UPGRADE BAY</div>
            <div className="opsHeroTitle">Plugins</div>
            <div className="opsHeroSub">Upgrade packs, local plugin sources, and dependency health arranged like an actual ops bay instead of a flat registry list.</div>
          </div>
          <div className="row wrap opsHeroBadges" style={{ justifyContent: "flex-end" }}>
            <span className="badge good">{bayStats.installed}/{bayStats.total} installed</span>
            <span className={`badge ${bayStats.updates ? "warn" : "good"}`}>{bayStats.updates} updates</span>
            <span className={`badge ${desktop ? "good" : "warn"}`}>{desktop ? "Desktop" : "Web"}</span>
          </div>
        </div>
        <div className="opsMetricStrip">
          {pluginMetrics.map((item) => (
            <div key={item.label} className="opsMetricCard">
              <div className="small shellEyebrow">{item.label}</div>
              <div className="opsMetricValue">{item.value}</div>
              <div className="small">{item.note}</div>
            </div>
          ))}
        </div>
      </div>

      <PanelScheduleCard
        panelId="Plugins"
        title="Plugin schedule"
        subtitle="Quick-add upgrade reminders + upcoming items."
        presets={[
          { label: "+ Update packs", title: "Plugins: update packs", notes: "Run Update all packs + verify permissions." },
          { label: "+ Repair deps", title: "Plugins: repair dependencies", notes: "Run repair for packs with dependency issues." },
          { label: "+ Permission audit", title: "Plugins: permission audit", offsetDays: 7, notes: "Review permission prompts + security." },
          { label: "+ Backup list", title: "Plugins: backup plugin list", offsetDays: 7, notes: "Export plugin records / snapshots." },
        ]}
        onNavigate={nav}
      />



      <div className="card softCard">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="h">Upgrade packs</div>
            <div className="sub">Mission-ready installable enhancements for News, Family Health, and Grocery Meals.</div>
          </div>
          <span className="badge good">{bayStats.available} available</span>
        </div>
        <div className="assistantStack" style={{ marginTop: 12 }}>
          {upgradePacks.map((pack) => (
            <div key={pack.id} className="timelineCard">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ fontWeight: 900 }}>{pack.name} <span className="badge">{pack.version}</span> <span className="badge">{pack.category}</span></div>
                  <div className="small" style={{ marginTop: 6 }}>{pack.description}</div>
                  <div className="assistantChipWrap" style={{ marginTop: 10 }}>
                    {pack.targetPanels.map((panel) => <span key={panel} className="badge">{panel}</span>)}
                    <span className="badge">channel: {pack.updateChannel || "stable"}</span>
                    {!!pack.commands?.length && <span className="badge good">{pack.commands.length} commands</span>}
                    {!!pack.actionLabels?.length && <span className="badge good">{pack.actionLabels.length} actions</span>}
                    {pack.missingPermissions?.length ? <span className="badge warn">{pack.missingPermissions.length} permissions needed</span> : null}
                    {pack.dependencyIssues?.length ? <span className="badge warn">{pack.dependencyIssues.length} dependencies</span> : null}
                    {pack.outdated ? <span className="badge warn">update ready</span> : null}
                    {pack.healthy ? <span className="badge good">healthy</span> : null}
                    {pack.enabled ? <span className="badge good">enabled</span> : pack.installed ? <span className="badge warn">disabled</span> : <span className="badge">not installed</span>}
                  </div>
                  <div className="small" style={{ marginTop: 8 }}>{pack.summaryMessage}</div>
                  <div className="small" style={{ marginTop: 6 }}>Update feed: <b>{pack.updateFeedLabel || "FairlyOdd Stable"}</b></div>
                  {pack.installed && pack.installedVersion && pack.installedVersion !== pack.version ? <div className="small" style={{ marginTop: 6 }}>Installed <b>{pack.installedVersion}</b> → Available <b>{pack.version}</b></div> : null}
                  {pack.latestHistory ? <div className="small" style={{ marginTop: 6 }}>Latest maintenance: <b>{pack.latestHistory.action}</b> • {pack.latestHistory.detail} • {formatWhen(pack.latestHistory.at)}</div> : <div className="small" style={{ marginTop: 6 }}>Latest maintenance: <b>none yet</b></div>}
                  {!!pack.releaseNotes?.length && (
                    <div className="assistantStack" style={{ marginTop: 10 }}>
                      {pack.releaseNotes.map((note: string) => <div key={note} className="small">• {note}</div>)}
                    </div>
                  )}
                  {!!pack.missingPermissions?.length && (
                    <div className="assistantStack" style={{ marginTop: 10 }}>
                      {pack.missingPermissions.map((perm) => (
                        <div key={perm.id} className="timelineCard" style={{ background: "rgba(70,50,10,0.25)" }}>
                          <div style={{ fontWeight: 800 }}>{perm.label}</div>
                          <div className="small" style={{ marginTop: 4 }}>{perm.description}</div>
                          <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                            <button className="tabBtn active" onClick={() => { grantUpgradePackPermission(pack.id, perm.id, true); pushNotif({ title: pack.name, body: `Granted ${perm.label}.`, tags: ["Plugins"], level: "success" }); setTick((v) => v + 1); }}>Grant permission</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!!pack.dependencyIssues?.length && (
                    <div className="small" style={{ marginTop: 10 }}>Dependencies to repair: <b>{pack.dependencyIssues.join(", ")}</b></div>
                  )}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {!pack.installed && <button className="tabBtn active" onClick={() => { installUpgradePack(pack.id); pushNotif({ title: "Plugins", body: `${pack.name} installed.`, tags: ["Plugins"], level: "success" }); setTick((v) => v + 1); }}>{pack.installPrompt || `Install ${pack.name}`}</button>}
                  {pack.installed && pack.outdated && <button className="tabBtn active" onClick={() => { installUpgradePack(pack.id); pushNotif({ title: "Plugins", body: `${pack.name} updated to ${pack.version}.`, tags: ["Plugins"], level: "success" }); setTick((v) => v + 1); }}>Update</button>}
                  {pack.installed && !!pack.dependencyIssues?.length && <button className="tabBtn active" onClick={() => { repairUpgradePackDependencies(pack.id); pushNotif({ title: "Plugins", body: `${pack.name} dependency repair complete.`, tags: ["Plugins"], level: "success" }); setTick((v) => v + 1); }}>Repair deps</button>}
                  {pack.installed && !pack.enabled && <button className="tabBtn active" onClick={() => { setUpgradePackEnabled(pack.id, true); setTick((v) => v + 1); }}>Enable</button>}
                  {pack.installed && pack.enabled && <button className="tabBtn" onClick={() => { setUpgradePackEnabled(pack.id, false); setTick((v) => v + 1); }}>Disable</button>}
                  {pack.installed && <button className="tabBtn" onClick={() => { uninstallUpgradePack(pack.id); pushNotif({ title: "Plugins", body: `${pack.name} removed.`, tags: ["Plugins"], level: "warn" }); setTick((v) => v + 1); }}>Remove</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card softCard">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div className="h">Update history</div>
            <div className="sub">Recent plugin installs, updates, permission grants, and dependency repairs so you can see what changed in the upgrade bay.</div>
          </div>
          <span className="badge good">{bayStats.history.success} success</span>
        </div>
        <div className="assistantStack" style={{ marginTop: 12 }}>
          {upgradeHistory.length === 0 && <div className="small">No upgrade history yet.</div>}
          {upgradeHistory.map((entry) => (
            <div key={entry.id} className="timelineCard" style={{ background: "rgba(8,12,18,0.32)" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 900 }}>{entry.packName}</div>
                <div className="assistantChipWrap">
                  <span className={`badge ${entry.status === "success" ? "good" : entry.status === "warn" ? "warn" : "muted"}`}>{entry.action}</span>
                  {entry.channel ? <span className="badge">{entry.channel}</span> : null}
                </div>
              </div>
              <div className="small" style={{ marginTop: 6 }}>{entry.detail}</div>
              <div className="small" style={{ marginTop: 6 }}>When: <b>{formatWhen(entry.at)}</b>{entry.fromVersion || entry.toVersion ? <> • {entry.fromVersion ? `from ${entry.fromVersion}` : ""}{entry.fromVersion && entry.toVersion ? " → " : ""}{entry.toVersion ? `to ${entry.toVersion}` : ""}</> : null}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card softCard">
        <div style={{ fontWeight: 900 }}>Installed manifests</div>
        <div className="small">Built-ins + Desktop plugins + imported manifests (local).</div>
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {all.length === 0 && <div className="small">No plugin manifests yet.</div>}
          {all.map((p) => (
            <div key={p.id} className="card" style={{ background: "rgba(8,12,18,0.35)" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{p.name} <span className="badge">{p.version}</span> {p._source && <span className="badge">{p._source}</span>}</div>
                  <div className="small" style={{ marginTop: 6 }}>{p.description || "No description."}</div>
                  {p.ui && <div className="small" style={{ marginTop: 6 }}>UI: <code>{p.ui}</code></div>}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {p.ui && <button onClick={() => openUrl(p.ui!)}>Open UI</button>}
                  {p._source === "user" && <button onClick={() => removeUser(p.id)}>Remove</button>}
                </div>
              </div>
              {Array.isArray(p.actions) && p.actions.length > 0 && (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {p.actions.map((a: any) => (
                    <div key={a.id || a.label} className="row" style={{ justifyContent: "space-between", border: "1px solid var(--line)", borderRadius: 12, padding: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{a.label}</div>
                        <div className="small">{a.type}</div>
                      </div>
                      <button onClick={() => runAction(a)}>Run</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="small" style={{ marginTop: 12, opacity: 0.85 }}>
        Desktop plugins live in your user data folder. Upgrade packs are managed locally and can light up panel widgets, commands, assistant skills, and automations.
      </div>
    </div>
  );
}
