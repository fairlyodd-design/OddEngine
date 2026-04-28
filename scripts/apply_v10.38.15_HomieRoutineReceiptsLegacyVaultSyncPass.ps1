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

Write-Host "[v10.38.15] Applying Homie routine receipts + legacy sync..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# CSS
$cssPayload = Join-Path $payload "HOMIE_ROUTINE_RECEIPTS_LEGACY_SYNC.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.15 Homie Routine Receipts + Legacy Vault Sync ===== */"
$end = "/* ===== v10.38.15 Homie Routine Receipts + Legacy Vault Sync END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

# Homie.tsx helpers
$h = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)
if ($h -notmatch 'HOMIE_ROUTINE_RECEIPTS_KEY') {
$helpers = @'
const HOMIE_ROUTINE_RECEIPTS_KEY = "oddengine:homie:routine-receipts:v1";
const HOMIE_LEGACY_SYNC_KEY = "oddengine:homie:legacy-vault-sync:v1";

type HomieRoutineReceipt = {
  id: string;
  kind: "checkin" | "reflect" | "legacy" | "export" | "clear";
  title: string;
  detail: string;
  createdAt: number;
};

function readHomieRoutineReceipts(): HomieRoutineReceipt[] {
  try {
    const raw = localStorage.getItem(HOMIE_ROUTINE_RECEIPTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function writeHomieRoutineReceipts(receipts: HomieRoutineReceipt[]) {
  try {
    localStorage.setItem(HOMIE_ROUTINE_RECEIPTS_KEY, JSON.stringify(receipts.slice(0, 50)));
    window.dispatchEvent(new CustomEvent("homie:routine-receipts-updated"));
  } catch {}
}

function addHomieRoutineReceipt(kind: HomieRoutineReceipt["kind"], title: string, detail: string) {
  const receipt: HomieRoutineReceipt = { id: `receipt_${Date.now()}_${kind}`, kind, title, detail, createdAt: Date.now() };
  const next = [receipt, ...readHomieRoutineReceipts()].slice(0, 50);
  writeHomieRoutineReceipts(next);
  return receipt;
}

function syncHomieLegacyDraftToVault(prompt: string) {
  const item = { id: `legacy_sync_${Date.now()}`, title: "Homie family legacy draft", body: prompt, source: "Homie Companion Routine", createdAt: Date.now() };
  try {
    const raw = localStorage.getItem(HOMIE_LEGACY_SYNC_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const next = [item, ...(Array.isArray(parsed) ? parsed : [])].slice(0, 50);
    localStorage.setItem(HOMIE_LEGACY_SYNC_KEY, JSON.stringify(next));
    localStorage.setItem("oddengine:homie:latest-legacy-draft:v1", prompt);
    window.dispatchEvent(new CustomEvent("homie:legacy-draft-updated", { detail: item }));
  } catch {}
  return item;
}

function exportHomieLocalMemoryBundle() {
  const legacyDrafts = (() => {
    try {
      const raw = localStorage.getItem(HOMIE_LEGACY_SYNC_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();
  const bundle = { exportedAt: new Date().toISOString(), moodLedger: readHomieMoodLedger(), routineReceipts: readHomieRoutineReceipts(), legacyDrafts };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `homie-memory-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  addHomieRoutineReceipt("export", "Homie memory exported", "Downloaded local Homie memory bundle.");
}

'@
  $h = $h.Replace('export default function Homie', $helpers + 'export default function Homie')
}

if ($h -notmatch 'const \[homieRoutineReceipts') {
  $anchor = 'const [homieRoutineReceipt, setHomieRoutineReceipt] = useState<string>("");'
  if ($h.Contains($anchor)) {
    $h = $h.Replace($anchor, $anchor + "`r`n" + '  const [homieRoutineReceipts, setHomieRoutineReceipts] = useState<HomieRoutineReceipt[]>(() => readHomieRoutineReceipts());')
  } else {
    $anchor = 'const [homieMoodLedger, setHomieMoodLedger] = useState<HomieMoodLedgerEntry[]>(() => readHomieMoodLedger());'
    if ($h.Contains($anchor)) {
      $h = $h.Replace($anchor, 'const [homieRoutineReceipts, setHomieRoutineReceipts] = useState<HomieRoutineReceipt[]>(() => readHomieRoutineReceipts());' + "`r`n  " + $anchor)
    }
  }
}

# Keep receipt state synced with local events.
if ($h -notmatch 'homie:routine-receipts-updated') {
  $h = $h.Replace('const onUpdate = () => setHomieMoodLedger(readHomieMoodLedger());', 'const onUpdate = () => { setHomieMoodLedger(readHomieMoodLedger()); setHomieRoutineReceipts(readHomieRoutineReceipts()); };')
  $h = $h.Replace('window.addEventListener("homie:mood-ledger-updated", onUpdate as EventListener);', 'window.addEventListener("homie:mood-ledger-updated", onUpdate as EventListener);' + "`r`n" + '    window.addEventListener("homie:routine-receipts-updated", onUpdate as EventListener);')
  $h = $h.Replace('window.removeEventListener("homie:mood-ledger-updated", onUpdate as EventListener);', 'window.removeEventListener("homie:mood-ledger-updated", onUpdate as EventListener);' + "`r`n" + '      window.removeEventListener("homie:routine-receipts-updated", onUpdate as EventListener);')
}

# Upgrade runHomieCompanionRoutine if present.
$h = $h.Replace('return "Check-in saved: mind, body, family, next move.";','addHomieRoutineReceipt("checkin", "Check-in saved", "Mind, body, family, and next move were written to local Homie memory.");' + "`r`n    return " + '"Check-in saved: mind, body, family, next move.";')
$h = $h.Replace('return `Reflection ready from latest themes: ${themeText}.`;','addHomieRoutineReceipt("reflect", "Reflection drafted", `Latest themes reflected: ${themeText}.`);' + "`r`n    return " + '`Reflection ready from latest themes: ${themeText}.`;')
$h = $h.Replace('localStorage.setItem("oddengine:homie:latest-legacy-draft:v1", legacyText);', 'syncHomieLegacyDraftToVault(legacyText);' + "`r`n    addHomieRoutineReceipt(" + '"legacy", "Legacy draft synced", "Family note and Open First handoff starter saved locally.");' + "`r`n    localStorage.setItem(" + '"oddengine:homie:latest-legacy-draft:v1", legacyText);')

# UI ledger in main Homie.
if ($h -notmatch 'data-homie-routine-ledger="v10.38.15"') {
  $anchor = '<div className="homieMoodLedgerCard" data-homie-mood-ledger="v10.38.10">'
  if ($h.Contains($anchor)) {
$ui = @'
        <div className="homieRoutineLedgerCard" data-homie-routine-ledger="v10.38.15">
          <div className="homieRoutineLedgerHead">
            <div>
              <b>Routine receipts</b>
              <span>{homieRoutineReceipts[0] ? `${homieRoutineReceipts[0].title}: ${homieRoutineReceipts[0].detail}` : "No routine receipts yet. Check in, reflect, or draft a family note."}</span>
            </div>
            <div className="homieRoutineLedgerActions">
              <button className="tabBtn" onClick={() => exportHomieLocalMemoryBundle()}>Export Homie memory</button>
              <button className="tabBtn" onClick={() => { writeHomieRoutineReceipts([]); setHomieRoutineReceipts([]); }}>Clear receipts</button>
              <button className="tabBtn" onClick={() => { writeHomieMoodLedger([]); setHomieMoodLedger([]); addHomieRoutineReceipt("clear", "Mood ledger cleared", "Local Homie mood/check-in ledger cleared."); setHomieRoutineReceipts(readHomieRoutineReceipts()); }}>Clear mood ledger</button>
            </div>
          </div>
          <div className="homieRoutineLedgerList">
            {homieRoutineReceipts.slice(0, 3).map((receipt) => (
              <div key={receipt.id} className="homieRoutineLedgerItem">
                <b>{receipt.title}</b>
                <p>{receipt.detail}</p>
                <small>{new Date(receipt.createdAt).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </div>

'@
    $h = $h.Replace($anchor, $ui + $anchor)
  }
}
[System.IO.File]::WriteAllText($homie, $h, $utf8NoBom)

# HomieBuddy helpers/status.
$b = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)
if ($b -notmatch 'function homieBuddyReadRoutineReceipts') {
$buddyHelpers = @'
function homieBuddyReadRoutineReceipts() {
  try {
    const raw = localStorage.getItem("oddengine:homie:routine-receipts:v1");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function homieBuddyAddRoutineReceipt(kind: string, title: string, detail: string) {
  const receipt = { id: `buddy_receipt_${Date.now()}_${kind}`, kind, title, detail, createdAt: Date.now() };
  try {
    const next = [receipt, ...homieBuddyReadRoutineReceipts()].slice(0, 50);
    localStorage.setItem("oddengine:homie:routine-receipts:v1", JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("homie:routine-receipts-updated"));
  } catch {}
}

function buildHomieBuddyRoutineSummary() {
  const latest = homieBuddyReadRoutineReceipts()[0];
  if (!latest) return "No routine receipt yet.";
  return `${latest.title}: ${latest.detail}`;
}

'@
  $anchor = 'function readHomieMoodLedgerForBuddy()'
  if ($b.Contains($anchor)) {
    $b = $b.Replace($anchor, $buddyHelpers + $anchor)
  } elseif ($b.Contains('export default function HomieBuddy')) {
    $b = $b.Replace('export default function HomieBuddy', $buddyHelpers + 'export default function HomieBuddy')
  }
}

if ($b -notmatch 'homieBuddyRoutineSummary') {
  $anchor = 'const homieBuddyMoodSummary = buildHomieBuddyMoodSummary();'
  if ($b.Contains($anchor)) {
    $b = $b.Replace($anchor, $anchor + "`r`n" + '  const homieBuddyRoutineSummary = buildHomieBuddyRoutineSummary();')
  }
}

# Add routine receipts into buddy routine function by prompt markers.
$b = $b.Replace('homieBuddySetCompanionDraft("Homie, ask me how I am really doing, then help me name one honest feeling and one tiny next step.");', 'homieBuddyAddRoutineReceipt("checkin", "Check-in saved", "HomieBuddy saved a local check-in.");' + "`r`n      " + 'homieBuddySetCompanionDraft("Homie, ask me how I am really doing, then help me name one honest feeling and one tiny next step.");')
$b = $b.Replace('homieBuddySetCompanionDraft(`Homie, reflect my latest check-in (${lane}: ${themes.join(", ")}) and suggest one tiny next step.`);', 'homieBuddyAddRoutineReceipt("reflect", "Reflection drafted", `Latest themes reflected: ${themes.join(", ")}.`);' + "`r`n      " + 'homieBuddySetCompanionDraft(`Homie, reflect my latest check-in (${lane}: ${themes.join(", ")}) and suggest one tiny next step.`);')
$b = $b.Replace('homieBuddySetCompanionDraft(legacyPrompt);', 'homieBuddyAddRoutineReceipt("legacy", "Legacy draft synced", "Family note and Open First handoff starter saved locally.");' + "`r`n    " + 'homieBuddySetCompanionDraft(legacyPrompt);')

# Sync legacy prompt list in buddy legacy branch.
$b = $b.Replace('localStorage.setItem("oddengine:homie:latest-legacy-draft:v1", legacyPrompt);', 'localStorage.setItem("oddengine:homie:latest-legacy-draft:v1", legacyPrompt);' + "`r`n      " + 'const rawLegacy = localStorage.getItem("oddengine:homie:legacy-vault-sync:v1");' + "`r`n      " + 'const parsedLegacy = rawLegacy ? JSON.parse(rawLegacy) : [];' + "`r`n      " + 'const legacyList = Array.isArray(parsedLegacy) ? parsedLegacy : [];' + "`r`n      " + 'localStorage.setItem("oddengine:homie:legacy-vault-sync:v1", JSON.stringify([{ id: `buddy_legacy_${now}`, title: "Homie family legacy draft", body: legacyPrompt, source: "HomieBuddy Companion Routine", createdAt: now }, ...legacyList].slice(0, 50)));')

if ($b -notmatch 'data-homiebuddy-routine-status="v10.38.15"') {
  $anchor = '<div className="homieBuddyCompanionMiniDeck" data-homiebuddy-companion-behavior="v10.38.13">'
  if ($b.Contains($anchor)) {
$status = @'
          <div className="homieBuddyRoutineStatus" data-homiebuddy-routine-status="v10.38.15">
            <b>Latest routine</b>
            {homieBuddyRoutineSummary}
          </div>

'@
    $b = $b.Replace($anchor, $status + $anchor)
  }
}
[System.IO.File]::WriteAllText($buddy, $b, $utf8NoBom)

# Version
if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.15";')
  if ($ver -notmatch 'HOMIE_ROUTINE_RECEIPTS_LEGACY_SYNC_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_ROUTINE_RECEIPTS_LEGACY_SYNC_PASS = "v10.38.15_HomieRoutineReceiptsLegacyVaultSyncPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}
Write-Host "[v10.38.15] Applied. Routine receipts and legacy sync added." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
