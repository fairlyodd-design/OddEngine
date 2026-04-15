$ErrorActionPreference = "Stop"

$rootCandidates = @(
  $PSScriptRoot,
  (Split-Path -Parent $PSScriptRoot)
) | Select-Object -Unique

$root = $null
foreach ($candidate in $rootCandidates) {
  $homeCandidate = Join-Path $candidate "ui\src\panels\Home.tsx"
  $homieCandidate = Join-Path $candidate "ui\src\panels\Homie.tsx"
  if ((Test-Path -LiteralPath $homeCandidate) -and (Test-Path -LiteralPath $homieCandidate)) {
    $root = $candidate
    break
  }
}

if (-not $root) {
  throw "Could not find ui\src\panels\Home.tsx and ui\src\panels\Homie.tsx under $PSScriptRoot or its parent."
}

$homePath = Join-Path $root "ui\src\panels\Home.tsx"
$homiePath = Join-Path $root "ui\src\panels\Homie.tsx"

function Normalize-LF([string]$text) {
  return ($text -replace "`r`n", "`n")
}

function Require-Replace([string]$text, [string]$find, [string]$replace, [string]$label) {
  if (-not $text.Contains($find)) {
    throw "Could not find anchor for $label"
  }
  return $text.Replace($find, $replace)
}

$homeText = Normalize-LF (Get-Content -Raw -LiteralPath $homePath)
$homieText = Normalize-LF (Get-Content -Raw -LiteralPath $homiePath)

$homeText = Require-Replace $homeText 'import { PHOENIX_WATCHLIST, topPhoenixSignals } from "../lib/marketDataPhoenix";' @'
import { PHOENIX_WATCHLIST, topPhoenixSignals } from "../lib/marketDataPhoenix";
import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "../lib/operatorBrain";
'@ 'Home import operatorBrain'

$homeText = Require-Replace $homeText '  const activeSignal = topSignals[0] || null;' @'
  const activeSignal = topSignals[0] || null;
  const operatorBrain = useMemo(() => getOperatorBrainSnapshot(), [calTick, doneTick, entTick]);
'@ 'Home operatorBrain snapshot'

$homeTruthBlock = @'
          <div className="card softCard mt-5">
            <div className="small shellEyebrow">PHOENIX DAILY TRUTH</div>
            <div className="h">Shared daily truth</div>
            <div className="sub">{operatorBrain.whatMattersNow.title} — {operatorBrain.whatMattersNow.text}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
              <div className="card" style={{ gridColumn: "span 3" }}>
                <div className="small">What matters now</div>
                <div style={{ fontWeight: 900, marginTop: 8 }}>{operatorBrain.whatMattersNow.title}</div>
                <div className="small" style={{ marginTop: 6 }}>{operatorBrain.whatMattersNow.text}</div>
                <div className="cluster wrap mt-3">
                  <button className="tabBtn" onClick={() => onNavigate(operatorBrain.whatMattersNow.panelId)}>Open</button>
                </div>
              </div>

              <div className="card" style={{ gridColumn: "span 3" }}>
                <div className="small">Family lane</div>
                <div style={{ fontWeight: 900, marginTop: 8 }}>{operatorBrain.familyLane.title}</div>
                <div className="small" style={{ marginTop: 6 }}>{operatorBrain.familyLane.text}</div>
                <div className="cluster wrap mt-3">
                  <button className="tabBtn" onClick={() => onNavigate(operatorBrain.familyLane.panelId)}>Open</button>
                </div>
              </div>

              <div className="card" style={{ gridColumn: "span 3" }}>
                <div className="small">Operator lane</div>
                <div style={{ fontWeight: 900, marginTop: 8 }}>{operatorBrain.operatorLane.title}</div>
                <div className="small" style={{ marginTop: 6 }}>{operatorBrain.operatorLane.text}</div>
                <div className="cluster wrap mt-3">
                  <button className="tabBtn" onClick={() => onNavigate(operatorBrain.operatorLane.panelId)}>Open</button>
                </div>
              </div>

              <div className="card" style={{ gridColumn: "span 3" }}>
                <div className="small">Do this next</div>
                <div style={{ fontWeight: 900, marginTop: 8 }}>{operatorBrain.whatToDoNext.title}</div>
                <div className="small" style={{ marginTop: 6 }}>{operatorBrain.whatToDoNext.text}</div>
                <div className="cluster wrap mt-3">
                  <button className="tabBtn" onClick={() => { runOperatorBrainNextAction(); onNavigate(operatorBrain.whatToDoNext.panelId); }}>Do it now</button>
                  <button className="tabBtn" onClick={() => onNavigate(operatorBrain.whereToGo.panelId)}>Route me</button>
                </div>
              </div>
            </div>
          </div>

'@

$homeText = Require-Replace $homeText '          <div className="homeSectionTitle compact">Mission control (from Calendar)</div>' ($homeTruthBlock + '          <div className="homeSectionTitle compact">Mission control (from Calendar)</div>') 'Home daily truth UI'

$homieText = Require-Replace $homieText 'import { DAILY_CHORES_EVENT, buildDailyChoresContext, computeDailyChoresSnapshot, loadDailyChoresState } from "../lib/dailyChoresCommand";' @'
import { DAILY_CHORES_EVENT, buildDailyChoresContext, computeDailyChoresSnapshot, loadDailyChoresState } from "../lib/dailyChoresCommand";
import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "../lib/operatorBrain";
'@ 'Homie import operatorBrain'

$homieText = Require-Replace $homieText @'
  const choresSnapshot = useMemo(() => {
    void choresTick;
    return computeDailyChoresSnapshot(loadDailyChoresState());
  }, [choresTick]);
'@ @'
  const choresSnapshot = useMemo(() => {
    void choresTick;
    return computeDailyChoresSnapshot(loadDailyChoresState());
  }, [choresTick]);
  const operatorBrain = useMemo(() => getOperatorBrainSnapshot(), [choresTick, activePanelId]);
'@ 'Homie operatorBrain snapshot'

$homieTruthBlock = @'
          <div className="card softCard" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Phoenix daily truth</div>
                <div className="sub">Homie is now reading the same shared daily truth as Home and the shell.</div>
              </div>
              <span className="badge good">Synced</span>
            </div>

            <div className="timelineCard" style={{ marginTop: 12 }}>
              <b>What matters now:</b> {operatorBrain.whatMattersNow.title}
              <div className="small" style={{ marginTop: 6 }}>{operatorBrain.whatMattersNow.text}</div>
            </div>

            <div className="assistantChipWrap" style={{ marginTop: 12 }}>
              <span className="badge">Family: {operatorBrain.familyLane.title}</span>
              <span className="badge">Operator: {operatorBrain.operatorLane.title}</span>
              <span className="badge">Next: {operatorBrain.whatToDoNext.title}</span>
            </div>

            <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={() => onNavigate(operatorBrain.familyLane.panelId)}>Open family lane</button>
              <button className="tabBtn" onClick={() => onNavigate(operatorBrain.operatorLane.panelId)}>Open operator lane</button>
              <button className="tabBtn" onClick={() => { runOperatorBrainNextAction(); onNavigate(operatorBrain.whatToDoNext.panelId); }}>Do next action</button>
              <button className="tabBtn" onClick={() => addQuick("What matters most right now for the family and where should I go next?")}>Ask in chat</button>
            </div>
          </div>

'@

$homieAiStatusAnchor = @'
          <div className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Homie AI Status</div>
'@

$homieText = Require-Replace $homieText $homieAiStatusAnchor ($homieTruthBlock + $homieAiStatusAnchor) 'Homie daily truth UI'

Set-Content -LiteralPath $homePath -Value ($homeText -replace "`n", "`r`n") -NoNewline
Set-Content -LiteralPath $homiePath -Value ($homieText -replace "`n", "`r`n") -NoNewline

Write-Host "Patched Home and Homie successfully."
