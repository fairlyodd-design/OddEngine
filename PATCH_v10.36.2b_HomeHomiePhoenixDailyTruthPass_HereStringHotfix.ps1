$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$candidates = @(
  $scriptDir,
  (Split-Path -Parent $scriptDir)
) | Select-Object -Unique

$root = $null
foreach ($c in $candidates) {
  if (Test-Path (Join-Path $c "ui\src\panels\Home.tsx")) {
    $root = $c
    break
  }
}
if (-not $root) {
  throw "Could not find OddEngine root from $scriptDir"
}

$homePath = Join-Path $root "ui\src\panels\Home.tsx"
$homiePath = Join-Path $root "ui\src\panels\Homie.tsx"

function Replace-Once {
  param(
    [string]$Text,
    [string]$Find,
    [string]$ReplaceWith,
    [string]$Label
  )
  if ($Text.Contains($ReplaceWith)) { return $Text }
  if (-not $Text.Contains($Find)) { throw "Could not find anchor for $Label" }
  return $Text.Replace($Find, $ReplaceWith)
}

# -------------------------
# Home.tsx
# -------------------------
$home = Get-Content -Raw -LiteralPath $homePath

$anchorImportHome = 'import { PHOENIX_WATCHLIST, topPhoenixSignals } from "../lib/marketDataPhoenix";'
$replaceImportHome = @'
import { PHOENIX_WATCHLIST, topPhoenixSignals } from "../lib/marketDataPhoenix";
import { getOperatorBrainSnapshot } from "../lib/operatorBrain";
'@
$home = Replace-Once -Text $home -Find $anchorImportHome -ReplaceWith $replaceImportHome -Label "Home import"

$anchorTruthHome = '  const quota = storage?.quota || 0;'
$replaceTruthHome = @'
  const dailyTruth = useMemo(() => getOperatorBrainSnapshot(), [calTick, entTick, doneTick]);
  const quota = storage?.quota || 0;
'@
$home = Replace-Once -Text $home -Find $anchorTruthHome -ReplaceWith $replaceTruthHome -Label "Home daily truth"

$anchorUiHome = '          <div className="homeSectionTitle compact">Mission control (from Calendar)</div>'
$replaceUiHome = @'
          <div className="card softCard mt-5">
            <div className="small shellEyebrow">PHOENIX DAILY TRUTH</div>
            <div className="h">What matters now</div>
            <div className="sub">Shared operator brain snapshot across the shell, Home, and Homie.</div>

            <div className="homeZoneGrid mt-4">
              <div className="homeZoneCard">
                <div className="homeZoneTop">
                  <div>
                    <div className="homeZoneTitle">🔥 What matters now</div>
                    <div className="homeZoneSub">{dailyTruth.whatMattersNow.title}</div>
                  </div>
                  <span className="badge good">Now</span>
                </div>
                <div className="homeZoneList mt-3">
                  <div className="homeZoneItem">
                    <div className="homeZoneItemIcon">🧠</div>
                    <div className="homeZoneItemBody">
                      <div className="homeZoneItemTitle">{appMap.get(normalizePanelId(dailyTruth.whatMattersNow.panelId))?.title || dailyTruth.whatMattersNow.panelId}</div>
                      <div className="homeZoneItemSub">{dailyTruth.whatMattersNow.text}</div>
                    </div>
                    <button className="tabBtn" onClick={() => onNavigate(dailyTruth.whatMattersNow.panelId)}>Open</button>
                  </div>
                </div>
              </div>

              <div className="homeZoneCard">
                <div className="homeZoneTop">
                  <div>
                    <div className="homeZoneTitle">🏡 Family lane</div>
                    <div className="homeZoneSub">{dailyTruth.familyLane.title}</div>
                  </div>
                  <span className="badge">Family</span>
                </div>
                <div className="homeZoneList mt-3">
                  <div className="homeZoneItem">
                    <div className="homeZoneItemIcon">❤️</div>
                    <div className="homeZoneItemBody">
                      <div className="homeZoneItemTitle">{appMap.get(normalizePanelId(dailyTruth.familyLane.panelId))?.title || dailyTruth.familyLane.panelId}</div>
                      <div className="homeZoneItemSub">{dailyTruth.familyLane.text}</div>
                    </div>
                    <button className="tabBtn" onClick={() => onNavigate(dailyTruth.familyLane.panelId)}>Open</button>
                  </div>
                </div>
              </div>

              <div className="homeZoneCard">
                <div className="homeZoneTop">
                  <div>
                    <div className="homeZoneTitle">⚡ Operator lane</div>
                    <div className="homeZoneSub">{dailyTruth.operatorLane.title}</div>
                  </div>
                  <span className="badge warn">Ops</span>
                </div>
                <div className="homeZoneList mt-3">
                  <div className="homeZoneItem">
                    <div className="homeZoneItemIcon">🎯</div>
                    <div className="homeZoneItemBody">
                      <div className="homeZoneItemTitle">{appMap.get(normalizePanelId(dailyTruth.operatorLane.panelId))?.title || dailyTruth.operatorLane.panelId}</div>
                      <div className="homeZoneItemSub">{dailyTruth.operatorLane.text}</div>
                    </div>
                    <button className="tabBtn" onClick={() => onNavigate(dailyTruth.operatorLane.panelId)}>Open</button>
                  </div>
                </div>
              </div>

              <div className="homeZoneCard">
                <div className="homeZoneTop">
                  <div>
                    <div className="homeZoneTitle">🚀 Do this next</div>
                    <div className="homeZoneSub">{dailyTruth.whatToDoNext.title}</div>
                  </div>
                  <span className="badge good">Next</span>
                </div>
                <div className="homeZoneList mt-3">
                  <div className="homeZoneItem">
                    <div className="homeZoneItemIcon">🐦‍🔥</div>
                    <div className="homeZoneItemBody">
                      <div className="homeZoneItemTitle">{appMap.get(normalizePanelId(dailyTruth.whatToDoNext.panelId))?.title || dailyTruth.whatToDoNext.panelId}</div>
                      <div className="homeZoneItemSub">{dailyTruth.whatToDoNext.text}</div>
                    </div>
                    <button className="tabBtn" onClick={() => onNavigate(dailyTruth.whatToDoNext.panelId)}>Open</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="homeSectionTitle compact">Mission control (from Calendar)</div>
'@
$home = Replace-Once -Text $home -Find $anchorUiHome -ReplaceWith $replaceUiHome -Label "Home daily truth UI"

Set-Content -LiteralPath $homePath -Value $home -Encoding UTF8

# -------------------------
# Homie.tsx
# -------------------------
$homie = Get-Content -Raw -LiteralPath $homiePath

$anchorImportHomie = 'import { DAILY_CHORES_EVENT, buildDailyChoresContext, computeDailyChoresSnapshot, loadDailyChoresState } from "../lib/dailyChoresCommand";'
$replaceImportHomie = @'
import { DAILY_CHORES_EVENT, buildDailyChoresContext, computeDailyChoresSnapshot, loadDailyChoresState } from "../lib/dailyChoresCommand";
import { getOperatorBrainSnapshot } from "../lib/operatorBrain";
'@
$homie = Replace-Once -Text $homie -Find $anchorImportHomie -ReplaceWith $replaceImportHomie -Label "Homie import"

$anchorTruthHomie = '  const choresSnapshot = useMemo(() => {'
$replaceTruthHomie = @'
  const dailyTruth = useMemo(() => getOperatorBrainSnapshot(), [choresTick]);
  const choresSnapshot = useMemo(() => {
'@
$homie = Replace-Once -Text $homie -Find $anchorTruthHomie -ReplaceWith $replaceTruthHomie -Label "Homie daily truth"

$anchorQuickHomie = '                <button className="tabBtn" onClick={() => addQuick("What matters at home today? Route me to the right panel and tell me the next chore lane.")}>House guide</button>'
$replaceQuickHomie = @'
                <button className="tabBtn" onClick={() => addQuick("What matters at home today? Route me to the right panel and tell me the next chore lane.")}>House guide</button>
                <button className="tabBtn" onClick={() => addQuick("Read the shared daily truth and tell me the single best next move for family first, then operator mode.")}>Daily truth</button>
'@
$homie = Replace-Once -Text $homie -Find $anchorQuickHomie -ReplaceWith $replaceQuickHomie -Label "Homie quick action"

$anchorUiHomie = '          <div className="card softCard" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Family guide lane</div>'
$replaceUiHomie = @'
          <div className="card softCard" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Phoenix daily truth</div>
                <div className="sub">Homie is reading the same shared operator snapshot as Home and the shell.</div>
              </div>
              <span className="badge good">Shared</span>
            </div>
            <div className="timelineCard" style={{ marginTop: 12 }}>
              <b>What matters now:</b> {dailyTruth.whatMattersNow.title}
              <div className="small" style={{ marginTop: 6 }}>{dailyTruth.whatMattersNow.text}</div>
            </div>
            <div className="timelineCard" style={{ marginTop: 10 }}>
              <b>Family lane:</b> {dailyTruth.familyLane.title}
              <div className="small" style={{ marginTop: 6 }}>{dailyTruth.familyLane.text}</div>
            </div>
            <div className="timelineCard" style={{ marginTop: 10 }}>
              <b>Operator lane:</b> {dailyTruth.operatorLane.title}
              <div className="small" style={{ marginTop: 6 }}>{dailyTruth.operatorLane.text}</div>
            </div>
            <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={() => onNavigate(dailyTruth.familyLane.panelId)}>Open family lane</button>
              <button className="tabBtn" onClick={() => onNavigate(dailyTruth.operatorLane.panelId)}>Open operator lane</button>
              <button className="tabBtn" onClick={() => onNavigate("OddBrain")}>Open OddBrain</button>
            </div>
          </div>

          <div className="card softCard" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Family guide lane</div>'
'@
$homie = Replace-Once -Text $homie -Find $anchorUiHomie -ReplaceWith $replaceUiHomie -Label "Homie daily truth UI"

Set-Content -LiteralPath $homiePath -Value $homie -Encoding UTF8

Write-Host "Patched Home + Homie Phoenix daily truth successfully at $root"
