$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$appPath = Join-Path $root "ui\src\App.tsx"

if (!(Test-Path $appPath)) {
  throw "Could not find ui\src\App.tsx at $appPath"
}

$content = Get-Content -Raw -Path $appPath

if ($content -match "function PhoenixStrip\(") {
  Write-Host "Phoenix strip already present. No patch needed."
  exit 0
}

$importNeedle = 'import { loadPrefs } from "./lib/prefs";'
$importInsert = @'
import { loadPrefs } from "./lib/prefs";
import { getOperatorBrainSnapshot, runOperatorBrainNextAction } from "./lib/operatorBrain";
'@

if ($content.Contains($importNeedle)) {
  $content = $content.Replace($importNeedle, $importInsert)
} elseif (-not ($content -match 'operatorBrain')) {
  throw "Could not find prefs import anchor in App.tsx"
}

$component = @'

function PhoenixStrip({
  snapshot,
  onNavigate,
}: {
  snapshot: ReturnType<typeof getOperatorBrainSnapshot>;
  onNavigate: (id: string) => void;
}) {
  const lanes = [
    { key: "what", title: "What matters now", data: snapshot.whatMattersNow, tone: "good" },
    { key: "family", title: "Family lane", data: snapshot.familyLane, tone: "warn" },
    { key: "operator", title: "Operator lane", data: snapshot.operatorLane, tone: "bad" },
    { key: "next", title: "Do this next", data: snapshot.whatToDoNext, tone: "good" },
  ].filter((row) => !!row.data);

  const quickRoutes = [
    "Home",
    "Homie",
    "OddBrain",
    "Money",
    "FamilyBudget",
    "Calendar",
    "News",
  ].map((id) => getPanelMeta(id));

  function runNextAction() {
    try {
      const result = runOperatorBrainNextAction() as any;
      const target = normalizePanelId(String(result?.panelId || snapshot.whatToDoNext?.panelId || "OddBrain"));
      onNavigate(target);
    } catch {
      onNavigate(normalizePanelId(String(snapshot.whatToDoNext?.panelId || "OddBrain")));
    }
  }

  return (
    <div
      className="card"
      style={{
        marginTop: 12,
        padding: 14,
        border: "1px solid rgba(250, 204, 21, 0.18)",
        background: "linear-gradient(180deg, rgba(234,179,8,.08), rgba(15,23,42,.68))",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div className="small shellEyebrow">God Mode Phoenix</div>
          <div style={{ fontWeight: 900, fontSize: 22, marginTop: 4 }}>Mission Control from the clean checkpoint</div>
          <div className="small" style={{ marginTop: 8, maxWidth: 980, lineHeight: 1.6 }}>
            This layer keeps the whole OS pointed at one trustworthy next move instead of making the family dig through panels.
          </div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="tabBtn" onClick={runNextAction}>
            {snapshot.whatToDoNext?.actionLabel || "Run next move"}
          </button>
          <button className="tabBtn" onClick={() => onNavigate(normalizePanelId(String(snapshot.whereToGo?.panelId || "OddBrain")))}>
            Open {getPanelMeta(normalizePanelId(String(snapshot.whereToGo?.panelId || "OddBrain"))).title}
          </button>
          <button className="tabBtn" onClick={() => onNavigate("Calendar")}>Today</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
        {lanes.map((lane) => {
          const meta = getPanelMeta(normalizePanelId(String(lane.data?.panelId || "Home")));
          return (
            <div key={lane.key} className="card" style={{ gridColumn: "span 3", padding: 12 }}>
              <div className="small shellEyebrow">{lane.title}</div>
              <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>{meta.icon} {lane.data?.title || meta.title}</div>
              <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>{lane.data?.text || `Open ${meta.title}.`}</div>
              <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                <span className={`badge ${lane.tone}`}>{meta.title}</span>
                <button className="tabBtn" onClick={() => onNavigate(meta.id)}>Open</button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div className="assistantChipWrap">
          <span className="badge">{snapshot.todayTasks?.length || 0} today tasks</span>
          <span className="badge">{snapshot.priorities?.length || 0} priorities</span>
          <span className="badge">{snapshot.actionQueue?.length || 0} queued actions</span>
          <span className="badge">{snapshot.panelHealth?.length || 0} health checks</span>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {quickRoutes.map((meta) => (
            <button key={meta.id} className="tabBtn" onClick={() => onNavigate(meta.id)}>
              {meta.icon} {meta.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
'@

$exportNeedle = 'export default function App() {'
if ($content.Contains($exportNeedle)) {
  $content = $content.Replace($exportNeedle, $component + "`r`n" + $exportNeedle)
} else {
  throw "Could not find App export anchor in App.tsx"
}

$stateNeedle = '  const activeId = normalizePanelId(active);'
$stateInsert = @'
  const activeId = normalizePanelId(active);
  const phoenix = useMemo(() => getOperatorBrainSnapshot(), [activeId, familyNight]);
'@
if ($content.Contains($stateNeedle)) {
  $content = $content.Replace($stateNeedle, $stateInsert)
} else {
  throw "Could not find activeId anchor in App.tsx"
}

$forcedNeedle = @'
		  </ErrorBoundary>
          <ErrorBoundary panelId={forcedPanel} label="Command bar" onNavigate={setActive}><CommandBar mode={cmdMode} setMode={setCmdMode} activePanelId={forcedPanel} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} /></ErrorBoundary>
'@
$forcedInsert = @'
		  </ErrorBoundary>
          <PhoenixStrip snapshot={phoenix} onNavigate={setActive} />
          <ErrorBoundary panelId={forcedPanel} label="Command bar" onNavigate={setActive}><CommandBar mode={cmdMode} setMode={setCmdMode} activePanelId={forcedPanel} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} /></ErrorBoundary>
'@
if ($content.Contains($forcedNeedle)) {
  $content = $content.Replace($forcedNeedle, $forcedInsert)
} else {
  throw "Could not find forced-panel shell insertion anchor in App.tsx"
}

$mainNeedle = @'
		</ErrorBoundary>
        <ErrorBoundary panelId={activeId} label="Command bar" onNavigate={setActive}><CommandBar mode={cmdMode} setMode={setCmdMode} activePanelId={activeId} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} /></ErrorBoundary>
'@
$mainInsert = @'
		</ErrorBoundary>
        <PhoenixStrip snapshot={phoenix} onNavigate={setActive} />
        <ErrorBoundary panelId={activeId} label="Command bar" onNavigate={setActive}><CommandBar mode={cmdMode} setMode={setCmdMode} activePanelId={activeId} onNavigate={setActive} onOpenHowTo={() => setHelpOpen(true)} /></ErrorBoundary>
'@
if ($content.Contains($mainNeedle)) {
  $content = $content.Replace($mainNeedle, $mainInsert)
} else {
  throw "Could not find main-shell insertion anchor in App.tsx"
}

Set-Content -Path $appPath -Value $content -Encoding UTF8
Write-Host "Patched App.tsx successfully."