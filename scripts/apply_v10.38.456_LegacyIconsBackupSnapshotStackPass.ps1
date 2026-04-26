$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$app = Join-Path $root "ui\src\App.tsx"
$hud = Join-Path $root "ui\src\components\FairlyGodModeHUD.tsx"
$componentDir = Join-Path $root "ui\src\components"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"
if (!(Test-Path $app)) { throw "Missing ui\src\App.tsx. Run from C:\OddEngine." }
if (!(Test-Path $hud)) { throw "Missing ui\src\components\FairlyGodModeHUD.tsx. Apply v10.38.2b+ first." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract ZIP contents into C:\OddEngine first." }
Write-Host "[v10.38.456] Applying stack..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
Copy-Item -Force (Join-Path $payload "OddIcon.tsx") (Join-Path $componentDir "OddIcon.tsx")
$appText = [System.IO.File]::ReadAllText($app, [System.Text.Encoding]::UTF8)
if ($appText -notmatch 'import OddIcon from "./components/OddIcon";') {
  $appText = $appText.Replace('import CardGODMode from "./components/CardGODMode";', 'import CardGODMode from "./components/CardGODMode";' + "`r`n" + 'import OddIcon from "./components/OddIcon";')
}
$appText = $appText.Replace('<div className="navIcon">{it.icon}</div>', '<div className="navIcon"><OddIcon id={it.id} /></div>')
[System.IO.File]::WriteAllText($app, $appText, $utf8NoBom)
$tsx = [System.IO.File]::ReadAllText($hud, [System.Text.Encoding]::UTF8)
if ($tsx -notmatch 'import OddIcon from "./OddIcon";') {
  $tsx = $tsx.Replace('import "./FairlyGodModeHUD.css";', 'import "./FairlyGodModeHUD.css";' + "`r`n" + 'import OddIcon from "./OddIcon";')
}
if ($tsx -notmatch 'BACKUP_SNAPSHOT_KEY') {
  $tsx = $tsx.Replace('const LEGACY_EXPORT_KEY = "oddengine:fairlygodmode:legacyLastExport:v1";', 'const LEGACY_EXPORT_KEY = "oddengine:fairlygodmode:legacyLastExport:v1";' + "`r`n" + 'const BACKUP_SNAPSHOT_KEY = "oddengine:fairlygodmode:backupSnapshots:v1";')
}
if ($tsx -notmatch 'function downloadTextFile') {
$helper = @'
function downloadTextFile(filename: string, text: string, type = "text/plain") {
  try { const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); window.setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0); return true; } catch { return false; }
}
function collectFairlyGodModeBackup() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) { const key = localStorage.key(i) || ""; if (key.startsWith("oddengine:fairlygodmode:") || key.startsWith("oddengine:godlayout:") || key.startsWith("oddengine:godpresets:") || key.startsWith("oddengine:godtemplate:") || key.startsWith("oddengine:godcard:") || key === "oddengine:pinnedPanels" || key === "oddengine:navCollapsedSections" || key === "oddengine:shellMode" || key === "oddengine:cmdMode" || key === "oddengine:homie:toneHint:v1") keys.push(key); }
  const data: Record<string, any> = {}; keys.sort().forEach((key) => { data[key] = readJSON<any>(key, localStorage.getItem(key)); }); return { app: "OddEngine", type: "FairlyGodModeBackup", version: "v10.38.456", exportedAt: Date.now(), keyCount: keys.length, data };
}
function restoreFairlyGodModeBackup(backup: any) { if (!backup || backup.type !== "FairlyGodModeBackup" || !backup.data) throw new Error("Not a FairlyGodMode backup file."); const entries = Object.entries(backup.data); entries.forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value))); return entries.length; }
'@
$tsx = $tsx.Replace('function isEmptyState(value: any) {', $helper + "`r`n" + 'function isEmptyState(value: any) {')
}
if ($tsx -notmatch 'backupImportText') {
  $tsx = $tsx.Replace('const [showLegacyExport, setShowLegacyExport] = useState(false);', 'const [showLegacyExport, setShowLegacyExport] = useState(false);' + "`r`n" + '  const [backupImportText, setBackupImportText] = useState("");' + "`r`n" + '  const [showBackupJson, setShowBackupJson] = useState(false);')
}
if ($tsx -notmatch 'function downloadLegacyMarkdown') {
$funcs = @'
  function downloadLegacyMarkdown() { const summary = buildLegacySummary(); writeJSON(LEGACY_EXPORT_KEY, { exportedAt: Date.now(), summary, data: legacyDraft }); downloadTextFile("FairlyOdd_Open_First_Legacy.md", summary, "text/markdown"); }
  function downloadLegacyJson() { const data = { exportedAt: Date.now(), data: legacyDraft }; writeJSON(LEGACY_EXPORT_KEY, data); downloadTextFile("FairlyOdd_Open_First_Legacy.json", JSON.stringify(data, null, 2), "application/json"); }
  function createBackupSnapshot() { const backup = collectFairlyGodModeBackup(); const snapshots = readJSON<any[]>(BACKUP_SNAPSHOT_KEY, []); writeJSON(BACKUP_SNAPSHOT_KEY, [{ id: `snapshot_${Date.now()}`, ...backup }, ...snapshots].slice(0, 12)); window.alert(`Snapshot created with ${backup.keyCount} key(s).`); }
  function downloadBackupSnapshot() { const backup = collectFairlyGodModeBackup(); downloadTextFile(`OddEngine_FairlyGodMode_Backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), "application/json"); }
  function restoreBackupFromText() { const ok = window.confirm("Restore this FairlyGodMode backup into localStorage? This can change layouts, modes, receipts, legacy notes, and operator logs."); if (!ok) return; try { const parsed = JSON.parse(backupImportText); const count = restoreFairlyGodModeBackup(parsed); window.alert(`Restored ${count} key(s). Reload the app to fully apply layouts and modes.`); } catch (err: any) { window.alert(`Restore failed: ${err?.message || String(err)}`); } }
  function restoreSnapshot(snapshot: any) { const ok = window.confirm("Restore this local snapshot? This can change layouts, modes, receipts, legacy notes, and operator logs."); if (!ok) return; try { const count = restoreFairlyGodModeBackup(snapshot); window.alert(`Restored ${count} key(s). Reload the app to fully apply layouts and modes.`); } catch (err: any) { window.alert(`Restore failed: ${err?.message || String(err)}`); } }
'@
$tsx = $tsx.Replace('  function clearVisualMode() {', $funcs + "`r`n" + '  function clearVisualMode() {')
}
$tsx = $tsx.Replace('<span className="fgGodPanelIcon">{getPanelMeta(r.panelId).icon}</span>', '<span className="fgGodPanelIcon"><OddIcon id={r.panelId} /></span>')
$tsx = $tsx.Replace('<button className="tabBtn" onClick={exportLegacySummary}>Copy/export summary</button>', '<button className="tabBtn" onClick={exportLegacySummary}>Copy/export summary</button>' + "`r`n" + '                    <button className="tabBtn" onClick={downloadLegacyMarkdown}>Download markdown</button>' + "`r`n" + '                    <button className="tabBtn" onClick={downloadLegacyJson}>Download JSON</button>')
if ($tsx -notmatch 'Download backup JSON') {
$backupUi = @'
                <div className="fgGodBackupGrid"><div className="fgGodBackupCard"><b>Backup / snapshot</b><p>Back up FairlyGodMode state: legacy notes, receipts, modes, Homie operator logs, pinned panels, collapsed nav, and CardGODMode layout keys.</p><div className="fgGodBackupActions"><button className="tabBtn active" onClick={createBackupSnapshot}>Create local snapshot</button><button className="tabBtn" onClick={downloadBackupSnapshot}>Download backup JSON</button><button className="tabBtn" onClick={() => setShowBackupJson((v) => !v)}>{showBackupJson ? "Hide JSON" : "Preview JSON"}</button></div></div><div className="fgGodBackupCard"><b>Restore backup</b><p>Paste a backup JSON file here. Restore requires confirmation and may change layouts/modes/legacy notes.</p><textarea className="fgGodLegacyTextArea" value={backupImportText} onChange={(e) => setBackupImportText(e.target.value)} placeholder="Paste backup JSON here..." /><div className="fgGodBackupActions"><button className="tabBtn danger" disabled={!backupImportText.trim()} onClick={restoreBackupFromText}>Restore pasted backup</button></div></div></div>{showBackupJson && <pre className="fgGodLegacyExportBox">{JSON.stringify(collectFairlyGodModeBackup(), null, 2)}</pre>}<div className="fgGodBackupCard"><b>Local snapshots</b><span>Recent snapshots are kept locally in this browser/Electron profile.</span><div className="fgGodSnapshotList">{readJSON<any[]>(BACKUP_SNAPSHOT_KEY, []).slice(0, 12).map((snapshot) => (<div key={snapshot.id} className="fgGodSnapshotItem"><div><b>{safeDate(snapshot.exportedAt)}</b><span>{snapshot.keyCount || 0} key(s) - {snapshot.version || "backup"}</span></div><button className="tabBtn" onClick={() => restoreSnapshot(snapshot)}>Restore</button></div>))}{!readJSON<any[]>(BACKUP_SNAPSHOT_KEY, []).length && (<div className="fgGodSnapshotItem"><div><b>No snapshots yet</b><span>Create a local snapshot to begin.</span></div></div>)}</div></div>
'@
$tsx = $tsx.Replace('                <div className="fgGodSafetyList">', $backupUi + "`r`n" + '                <div className="fgGodSafetyList">')
}
[System.IO.File]::WriteAllText($hud, $tsx, $utf8NoBom)
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText((Join-Path $payload "LEGACY_ICONS_BACKUP_STACK.css"), [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.456 Legacy Export + Icon System + Backup Snapshot Stack ===== */"
$end = "/* ===== v10.38.456 Legacy Export + Icon System + Backup Snapshot Stack END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)
if (Test-Path $version) { $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8); $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.456";'); if ($ver -notmatch 'LEGACY_ICONS_BACKUP_STACK_PASS') { $ver = $ver.TrimEnd() + "`r`n" + 'export const LEGACY_ICONS_BACKUP_STACK_PASS = "v10.38.456_LegacyIconsBackupSnapshotStackPass";' + "`r`n" }; [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom) }
Write-Host "[v10.38.456] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
