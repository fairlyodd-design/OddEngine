$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$component = Join-Path $root "ui\src\components\FairlyGodModeHUD.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $component)) { throw "Missing ui\src\components\FairlyGodModeHUD.tsx. Apply v10.37.7 first." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.37.8] Applying FairlyGodMode Workspace Modes Deepening..." -ForegroundColor Cyan

$tsx = Get-Content $component -Raw

# Add mode history key if missing.
if ($tsx -notmatch 'MODE_HISTORY_KEY') {
  $tsx = $tsx.Replace(
    'const MODE_KEY = "oddengine:fairlygodmode:activeMode:v1";',
    'const MODE_KEY = "oddengine:fairlygodmode:activeMode:v1";' + "`r`n" + 'const MODE_HISTORY_KEY = "oddengine:fairlygodmode:modeHistory:v1";'
  )
}

# Deepen applyMode with body dataset + history + receipts without touching panel logic.
$oldApply = @'
function applyMode(mode: typeof WORKSPACE_MODES[number], onNavigate: (id: string) => void) {
  writeJSON(MODE_KEY, { ...mode, appliedAt: Date.now() });
  writeJSON("oddengine:pinnedPanels", mode.pins);
  writeJSON("oddengine:shellMode", mode.shellMode);
  writeJSON("oddengine:cmdMode", mode.commandMode);
  writeJSON("oddengine:homie:toneHint:v1", mode.tone);
  onNavigate(mode.activePanel);
  window.dispatchEvent(new CustomEvent("oddengine:fairlygodmode-mode", { detail: mode }));
}
'@

$newApply = @'
function applyMode(mode: typeof WORKSPACE_MODES[number], onNavigate: (id: string) => void) {
  const receipt = {
    ...mode,
    appliedAt: Date.now(),
    appliedBy: "FairlyGodMode Workspace Modes",
    safeScope: [
      "active panel",
      "pinned panels",
      "shell density",
      "command density",
      "Homie tone hint",
      "mode visual tone",
    ],
  };

  writeJSON(MODE_KEY, receipt);
  writeJSON("oddengine:pinnedPanels", mode.pins);
  writeJSON("oddengine:shellMode", mode.shellMode);
  writeJSON("oddengine:cmdMode", mode.commandMode);
  writeJSON("oddengine:homie:toneHint:v1", mode.tone);
  writeJSON("oddengine:navCollapsedSections", mode.id === "trading"
    ? { "APPS": true, "OS": true }
    : mode.id === "legacy"
      ? { "TRADING": true, "APPS": true }
      : {});

  const history = readJSON<any[]>(MODE_HISTORY_KEY, []);
  writeJSON(MODE_HISTORY_KEY, [receipt, ...history].slice(0, 24));

  try {
    document.body.dataset.fgmMode = mode.id;
  } catch {}

  onNavigate(mode.activePanel);
  window.dispatchEvent(new CustomEvent("oddengine:fairlygodmode-mode", { detail: receipt }));
}
'@

if ($tsx.Contains($oldApply)) {
  $tsx = $tsx.Replace($oldApply, $newApply)
}

# Add body dataset restore effect after keyboard effect once.
if ($tsx -notmatch 'restore FairlyGodMode workspace visual mode') {
  $needle = @'
  useEffect(() => {
    if (!receipts.length) setReceipts(scanReceipts());
  }, []);
'@
  $insert = @'
  useEffect(() => {
    if (!receipts.length) setReceipts(scanReceipts());
  }, []);

  // restore FairlyGodMode workspace visual mode on reload
  useEffect(() => {
    const mode = readJSON<any>(MODE_KEY, null);
    try {
      if (mode?.id) document.body.dataset.fgmMode = mode.id;
    } catch {}
  }, []);
'@
  if ($tsx.Contains($needle)) {
    $tsx = $tsx.Replace($needle, $insert)
  }
}

# Replace mode tab block with deeper version if original signature is present.
$oldModesStart = '{tab === "Modes" && ('
$oldModesSnippet = @'
            {tab === "Modes" && (
              <div className="fgGodSection">
                <div className="fgGodReasonCard">
                  <div className="fgGodReasonTitle">Workspace Modes</div>
                  <div className="fgGodReasonText">Modes set active panel, pinned panels, command/shell density, and Homie tone hints. They do not delete data or rewrite panel logic.</div>
                </div>
                <div className="fgGodModeGrid">
                  {WORKSPACE_MODES.map((mode) => (
                    <div key={mode.id} className="fgGodModeCard card softCard">
                      <div className="fgGodModeTitle">{mode.icon} {mode.name}</div>
                      <div className="sub">{mode.description}</div>
                      <div className="small" style={{ marginTop: 8 }}>Pins: {mode.pins.slice(0, 5).join(", ")}{mode.pins.length > 5 ? "…" : ""}</div>
                      <button className="tabBtn active" style={{ marginTop: 10 }} onClick={() => applyMode(mode, onNavigate)}>Apply mode</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
'@

$newModesSnippet = @'
            {tab === "Modes" && (
              <div className="fgGodSection">
                {(() => {
                  const activeMode = readJSON<any>(MODE_KEY, null);
                  const history = readJSON<any[]>(MODE_HISTORY_KEY, []);
                  return (
                    <>
                      {activeMode?.id && (
                        <div className="fgGodModeBanner">
                          <div className="fgGodModeBannerLeft">
                            <div className="fgGodModeBannerTitle">Active mode: {activeMode.icon} {activeMode.name}</div>
                            <div className="fgGodModeBannerSub">{activeMode.description}</div>
                          </div>
                          <div className="fgGodModeBannerActions">
                            <button className="tabBtn" onClick={() => onNavigate(activeMode.activePanel)}>Open mode panel</button>
                            <button className="tabBtn danger" onClick={() => {
                              localStorage.removeItem(MODE_KEY);
                              localStorage.removeItem("oddengine:homie:toneHint:v1");
                              try { delete document.body.dataset.fgmMode; } catch {}
                              window.alert("Workspace mode cleared. Pinned panels were left alone for safety.");
                            }}>Clear visual mode</button>
                          </div>
                        </div>
                      )}

                      <div className="fgGodModePreview">
                        <div className="fgGodReasonTitle">Workspace Modes</div>
                        <div className="fgGodReasonText">Modes are safe presets for how the OS feels and what panels are easiest to reach. They do not delete data or rewrite panel logic.</div>
                        <div className="fgGodModePreviewGrid">
                          <div className="fgGodModePreviewCell"><b>Changes</b><span>active panel, pins, shell density</span></div>
                          <div className="fgGodModePreviewCell"><b>Safe</b><span>no Trading/CardGODMode rewrite</span></div>
                          <div className="fgGodModePreviewCell"><b>Homie tone</b><span>{activeMode?.tone || "none selected"}</span></div>
                          <div className="fgGodModePreviewCell"><b>History</b><span>{history.length} mode receipt(s)</span></div>
                        </div>
                      </div>

                      <div className="fgGodModeGrid">
                        {WORKSPACE_MODES.map((mode) => (
                          <div key={mode.id} className="fgGodModeCard card softCard">
                            <div className="fgGodModeTitle">{mode.icon} {mode.name}</div>
                            <div className="fgGodModeIntent">{mode.description}</div>
                            <div className="fgGodModeMeta">
                              <span className="badge">Open: {getPanelMeta(mode.activePanel).title}</span>
                              <span className="badge">{mode.pins.length} pins</span>
                              <span className="badge">Tone: {mode.tone}</span>
                            </div>
                            <div className="small" style={{ marginTop: 8 }}>Pins: {mode.pins.slice(0, 6).join(", ")}{mode.pins.length > 6 ? "…" : ""}</div>
                            <div className="fgGodModeActions">
                              <button className="tabBtn active" onClick={() => applyMode(mode, onNavigate)}>Apply mode</button>
                              <button className="tabBtn" onClick={() => {
                                writeJSON(MODE_KEY, { ...mode, previewedAt: Date.now(), previewOnly: true });
                                try { document.body.dataset.fgmMode = mode.id; } catch {}
                                window.alert(`Previewed ${mode.name}. Apply mode to pin/open panels.`);
                              }}>Preview tone</button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="fgGodReasonCard">
                        <div className="fgGodReasonTitle">Mode history</div>
                        <div className="fgGodReasonText">Every applied mode writes a local receipt so the OS can explain what changed.</div>
                      </div>
                      <div className="fgGodModeHistory">
                        {history.length ? history.slice(0, 8).map((item, idx) => (
                          <div key={`${item.id}-${item.appliedAt || idx}`} className="fgGodModeHistoryItem">
                            <div>
                              <b>{item.icon} {item.name}</b>
                              <span>{item.appliedAt ? new Date(item.appliedAt).toLocaleString() : "preview"} • {item.description}</span>
                            </div>
                            <button className="tabBtn" onClick={() => applyMode(item, onNavigate)}>Reapply</button>
                          </div>
                        )) : (
                          <div className="fgGodModeHistoryItem">
                            <div><b>No mode receipts yet</b><span>Apply a mode to start the local history.</span></div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
'@

if ($tsx.Contains($oldModesSnippet)) {
  $tsx = $tsx.Replace($oldModesSnippet, $newModesSnippet)
} else {
  Write-Host "[v10.37.8] Modes block did not match exact v10.37.7 text; component CSS/history restore still applied." -ForegroundColor Yellow
}

Set-Content -Path $component -Value $tsx -Encoding UTF8

# Append/replace CSS block once.
$cssPayload = Join-Path $payload "FAIRLYGODMODE_WORKSPACE_MODES_DEEPENING.css"
$css = Get-Content $styles -Raw
$block = Get-Content $cssPayload -Raw
$start = "/* ===== v10.37.8 FairlyGodMode Workspace Modes Deepening ===== */"
$end = "/* ===== v10.37.8 FairlyGodMode Workspace Modes Deepening END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
Set-Content -Path $styles -Value ($css + "`r`n`r`n" + $block + "`r`n") -Encoding UTF8

# Safe version marker update.
if (Test-Path $version) {
  $ver = Get-Content $version -Raw
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.37.8";')
  if ($ver -notmatch 'FAIRLYGODMODE_WORKSPACE_MODES_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const FAIRLYGODMODE_WORKSPACE_MODES_PASS = "v10.37.8_FairlyGodModeWorkspaceModesDeepeningPass";' + "`r`n"
  }
  Set-Content -Path $version -Value $ver -Encoding UTF8
}

Write-Host "[v10.37.8] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
