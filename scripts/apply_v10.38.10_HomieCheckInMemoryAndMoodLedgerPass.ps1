$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"
if (!(Test-Path $homie)) { throw "Missing ui\src\panels\Homie.tsx. Run from C:\OddEngine." }
if (!(Test-Path $buddy)) { throw "Missing ui\src\components\HomieBuddy.tsx. Run from C:\OddEngine." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }
Write-Host "[v10.38.10] Applying Homie check-in memory + mood ledger..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$h = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)
if ($h -notmatch 'HOMIE_MOOD_LEDGER_KEY') {
$helpers = @'
const HOMIE_MOOD_LEDGER_KEY = "oddengine:homie:mood-ledger:v1";
type HomieMoodLedgerEntry = { id: string; lane: "body" | "mind" | "family" | "money" | "creative"; mood: string; themes: string[]; note: string; createdAt: number; };
function readHomieMoodLedger(): HomieMoodLedgerEntry[] { try { const raw = localStorage.getItem(HOMIE_MOOD_LEDGER_KEY); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed.slice(0, 50) : []; } catch { return []; } }
function writeHomieMoodLedger(entries: HomieMoodLedgerEntry[]) { try { localStorage.setItem(HOMIE_MOOD_LEDGER_KEY, JSON.stringify(entries.slice(0, 50))); window.dispatchEvent(new CustomEvent("homie:mood-ledger-updated")); } catch {} }
function homieMoodLaneThemes(lane: HomieMoodLedgerEntry["lane"]) { const map: Record<HomieMoodLedgerEntry["lane"], string[]> = { body:["body","energy","rest"], mind:["mind","overwhelmed","focused"], family:["family care","legacy","handoff"], money:["money pressure","safety","next move"], creative:["creative push","studio","build"] }; return map[lane] || ["next move"]; }
function homieMoodLaneNote(lane: HomieMoodLedgerEntry["lane"]) { const map: Record<HomieMoodLedgerEntry["lane"], string> = { body:"Body check-in saved. Start with water, food, breath, rest, or pain level.", mind:"Mind check-in saved. We can make the next step smaller.", family:"Family check-in saved. This can become a kind note or Open First guidance.", money:"Money check-in saved. We can pick the safest practical move.", creative:"Creative check-in saved. We can turn momentum into one finished artifact." }; return map[lane] || "Check-in saved. One calm next step."; }
function buildHomieMoodSummary(entries: HomieMoodLedgerEntry[]) { const latest = entries[0]; if (!latest) return "No check-ins saved yet. Pick body, mind, family, money, or creative."; const date = new Date(latest.createdAt).toLocaleString([], { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }); return `Last check-in: ${latest.lane} at ${date}. Themes: ${latest.themes.join(", ")}.`; }
function buildHomieMoodThemes(entries: HomieMoodLedgerEntry[]) { const counts: Record<string, number> = {}; entries.slice(0, 12).forEach((entry) => entry.themes.forEach((theme) => counts[theme] = (counts[theme] || 0) + 1)); return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 8).map(([theme,count]) => ({ theme, count })); }

'@
  $h = $h.Replace('export default function Homie', $helpers + 'export default function Homie')
}
if ($h -notmatch 'const homieMoodLedger') {
  $anchor = 'const homieVoicePlain = useMemo(() => explainVoicePlain(voiceSnapshot), [voiceSnapshot]);'
  if (-not $h.Contains($anchor)) { $anchor = 'const homieLegacyBrief = useMemo(() => getLegacyOpenFirstBrief(), [messages.length, activePanelId]);' }
  if ($h.Contains($anchor)) {
    $insert = $anchor + "`r`n" + @'
  const [homieMoodLedger, setHomieMoodLedger] = useState<HomieMoodLedgerEntry[]>(() => readHomieMoodLedger());
  const homieMoodSummary = useMemo(() => buildHomieMoodSummary(homieMoodLedger), [homieMoodLedger]);
  const homieMoodThemes = useMemo(() => buildHomieMoodThemes(homieMoodLedger), [homieMoodLedger]);
  useEffect(() => { const onUpdate = () => setHomieMoodLedger(readHomieMoodLedger()); window.addEventListener("homie:mood-ledger-updated", onUpdate as EventListener); return () => window.removeEventListener("homie:mood-ledger-updated", onUpdate as EventListener); }, []);
  function saveHomieMoodCheckIn(lane: HomieMoodLedgerEntry["lane"]) {
    const entry: HomieMoodLedgerEntry = { id: `checkin_${Date.now()}_${lane}`, lane, mood: lane === "mind" ? "overwhelmed/focused" : lane === "family" ? "family care" : lane === "money" ? "money pressure" : lane === "creative" ? "creative push" : "body check", themes: homieMoodLaneThemes(lane), note: homieMoodLaneNote(lane), createdAt: Date.now() };
    const next = [entry, ...readHomieMoodLedger()].slice(0, 50);
    writeHomieMoodLedger(next); setHomieMoodLedger(next);
    addQuick(`Homie, I checked in on ${lane}. ${entry.note} Want one tiny step, a plan, or a family note?`);
  }
'@
    $h = $h.Replace($anchor, $insert)
  } else { throw "Could not find Homie.tsx memo anchor." }
}
if ($h -notmatch 'data-homie-mood-ledger="v10.38.10"') {
  $anchor = '<div className="homiePresencePane" style={{ marginTop: 12 }}>'
  if (-not $h.Contains($anchor)) { $anchor = '<div className="homiePresenceTitle">{homieLegacyBrief.title} family handoff</div>' }
  if ($h.Contains($anchor)) {
$ledgerUi = @'
        <div className="homieMoodLedgerCard" data-homie-mood-ledger="v10.38.10">
          <div className="homieMoodLedgerHead"><div><b>Check-in memory ledger</b><span>{homieMoodSummary}</span></div><button className="tabBtn" onClick={() => { writeHomieMoodLedger([]); setHomieMoodLedger([]); }}>Clear</button></div>
          <div className="homieMoodLedgerGrid">
            <button className="homieMoodLedgerBtn" onClick={() => saveHomieMoodCheckIn("body")}><b>Body</b><span>energy, rest, pain, food</span></button>
            <button className="homieMoodLedgerBtn" onClick={() => saveHomieMoodCheckIn("mind")}><b>Mind</b><span>overwhelmed, focus, mood</span></button>
            <button className="homieMoodLedgerBtn" onClick={() => saveHomieMoodCheckIn("family")}><b>Family</b><span>care, legacy, handoff</span></button>
            <button className="homieMoodLedgerBtn" onClick={() => saveHomieMoodCheckIn("money")}><b>Money</b><span>safety, pressure, next move</span></button>
            <button className="homieMoodLedgerBtn" onClick={() => saveHomieMoodCheckIn("creative")}><b>Creative</b><span>studio, build, finish</span></button>
          </div>
          <div className="homieMoodLedgerSummary"><div className="homieMoodLedgerLine">Want one tiny step, a plan, or a family note?</div></div>
          <div className="homieMoodLedgerThemes">{homieMoodThemes.length ? homieMoodThemes.map((item) => <span key={item.theme} className={`homieMoodLedgerTheme ${item.count > 1 ? "hot" : ""}`}>{item.theme}</span>) : <span className="homieMoodLedgerTheme">local-only memory</span>}</div>
        </div>

'@
    $h = $h.Replace($anchor, $ledgerUi + $anchor)
  } else { throw "Could not find Homie.tsx UI anchor." }
}
[System.IO.File]::WriteAllText($homie, $h, $utf8NoBom)

$b = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)
if ($b -notmatch 'function readHomieMoodLedgerForBuddy') {
$buddyHelpers = @'
function readHomieMoodLedgerForBuddy() { try { const raw = localStorage.getItem("oddengine:homie:mood-ledger:v1"); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed.slice(0, 12) : []; } catch { return []; } }
function buildHomieBuddyMoodSummary() { const entries = readHomieMoodLedgerForBuddy(); const latest = entries[0]; if (!latest) return "No local check-in saved yet."; const themes = Array.isArray(latest.themes) ? latest.themes.join(", ") : latest.lane || "next move"; return `Last check-in: ${latest.lane || "check-in"} - ${themes}.`; }

'@
  if ($b.Contains('export default function HomieBuddy')) { $b = $b.Replace('export default function HomieBuddy', $buddyHelpers + 'export default function HomieBuddy') }
  elseif ($b.Contains('export function HomieBuddy')) { $b = $b.Replace('export function HomieBuddy', $buddyHelpers + 'export function HomieBuddy') }
}
if ($b -notmatch 'homieBuddyMoodSummary') {
  $anchor = 'const panel = ('
  if ($b.Contains($anchor)) { $b = $b.Replace($anchor, '  const homieBuddyMoodSummary = buildHomieBuddyMoodSummary();' + "`r`n`r`n" + '  ' + $anchor) }
}
if ($b -notmatch 'data-homie-buddy-mood-ledger="v10.38.10"') {
  $anchor = '<div className="homieRebuildStageText">'
  if ($b.Contains($anchor)) {
    $insert = @'
          <div className="homieMoodLedgerLine" data-homie-buddy-mood-ledger="v10.38.10">
            {homieBuddyMoodSummary} Want one tiny step, a plan, or a family note?
          </div>

'@
    $b = $b.Replace($anchor, $insert + $anchor)
  }
}
$b = $b.Replace('Ready for one calm next step: body, family, money, or creative.', 'Ready for one tiny step, a plan, or a family note.')
[System.IO.File]::WriteAllText($buddy, $b, $utf8NoBom)

$cssPayload = Join-Path $payload "HOMIE_CHECKIN_MOOD_LEDGER.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.10 Homie Check-In Memory + Mood Ledger ===== */"
$end = "/* ===== v10.38.10 Homie Check-In Memory + Mood Ledger END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.10";')
  if ($ver -notmatch 'HOMIE_CHECKIN_MOOD_LEDGER_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_CHECKIN_MOOD_LEDGER_PASS = "v10.38.10_HomieCheckInMemoryAndMoodLedgerPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}
Write-Host "[v10.38.10] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
