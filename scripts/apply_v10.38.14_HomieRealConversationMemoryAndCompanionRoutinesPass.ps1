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

Write-Host "[v10.38.14] Applying Homie real conversation memory + companion routines..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# -----------------------------
# CSS append/replace.
# -----------------------------
$cssPayload = Join-Path $payload "HOMIE_REAL_CONVERSATION_MEMORY_ROUTINES.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.14 Homie Real Conversation Memory + Companion Routines ===== */"
$end = "/* ===== v10.38.14 Homie Real Conversation Memory + Companion Routines END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

# -----------------------------
# Homie.tsx: add routine helper + receipt surface.
# -----------------------------
$h = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)

if ($h -notmatch 'function runHomieCompanionRoutine') {
$helper = @'
function runHomieCompanionRoutine(kind: "checkin" | "reflect" | "legacy", addPrompt: (prompt: string) => void) {
  const entries = readHomieMoodLedger();
  const latest = entries[0];
  const now = Date.now();
  const baseThemes = latest?.themes?.length ? latest.themes : ["body", "mind", "family", "next move"];
  const latestLane = latest?.lane || "mind";

  if (kind === "checkin") {
    const entry: HomieMoodLedgerEntry = {
      id: `routine_${now}_checkin`,
      lane: "mind",
      mood: "honest check-in",
      themes: ["mind", "body", "family", "next move"],
      note: "Homie check-in started. Name what feels true, then pick one tiny step.",
      createdAt: now,
    };
    const next = [entry, ...entries].slice(0, 50);
    writeHomieMoodLedger(next);
    addPrompt("Homie, ask me how I am really doing, then help me name one honest feeling and one tiny next step.");
    return "Check-in saved: mind, body, family, next move.";
  }

  if (kind === "reflect") {
    const themeText = baseThemes.join(", ");
    addPrompt(`Homie, reflect my latest check-in (${latestLane}: ${themeText}) and suggest one tiny next step.`);
    return `Reflection ready from latest themes: ${themeText}.`;
  }

  const legacyText = latest
    ? `Homie, turn my latest check-in (${latest.lane}: ${baseThemes.join(", ")}) into a kind family legacy note and one Open First handoff.`
    : "Homie, help me draft a kind family legacy note and one Open First handoff.";
  addPrompt(legacyText);
  try {
    localStorage.setItem("oddengine:homie:latest-legacy-draft:v1", legacyText);
    window.dispatchEvent(new CustomEvent("homie:legacy-draft-updated", { detail: { prompt: legacyText, createdAt: now } }));
  } catch {
    // local-only best effort
  }
  return "Legacy draft started: family note + Open First handoff.";
}

'@
  if ($h.Contains('export default function Homie')) {
    $h = $h.Replace('export default function Homie', $helper + 'export default function Homie')
  } else {
    throw "Could not find Homie export anchor."
  }
}

if ($h -notmatch 'const \[homieRoutineReceipt') {
  $anchor = 'const [homieMoodLedger, setHomieMoodLedger] = useState<HomieMoodLedgerEntry[]>(() => readHomieMoodLedger());'
  if ($h.Contains($anchor)) {
    $h = $h.Replace($anchor, 'const [homieRoutineReceipt, setHomieRoutineReceipt] = useState<string>("");' + "`r`n  " + $anchor)
  } else {
    throw "Could not find homie mood ledger state anchor."
  }
}

# Replace main behavior deck buttons to run real routines.
$h = $h.Replace('onClick={() => addQuick("Homie, ask me a gentle check-in and help me name what I actually feel.")}', 'onClick={() => setHomieRoutineReceipt(runHomieCompanionRoutine("checkin", addQuick))}')
$h = $h.Replace('onClick={() => addQuick("Homie, reflect my mood and give me one tiny next step.")}', 'onClick={() => setHomieRoutineReceipt(runHomieCompanionRoutine("reflect", addQuick))}')
$h = $h.Replace('onClick={() => addQuick("Homie, help me make this useful for my family as a legacy note.")}', 'onClick={() => setHomieRoutineReceipt(runHomieCompanionRoutine("legacy", addQuick))}')

if ($h -notmatch 'data-homie-routine-receipt="v10.38.14"') {
  $anchor = '<div className="homieMoodLedgerCard" data-homie-mood-ledger="v10.38.10">'
  if ($h.Contains($anchor)) {
$receipt = @'
        {homieRoutineReceipt ? (
          <div className="homieRoutineReceipt" data-homie-routine-receipt="v10.38.14">
            <b>Companion routine saved</b>
            {homieRoutineReceipt}
            <small>Local only. HomieBuddy and this panel share the same memory ledger.</small>
          </div>
        ) : null}

'@
    $h = $h.Replace($anchor, $receipt + $anchor)
  }
}

[System.IO.File]::WriteAllText($homie, $h, $utf8NoBom)

# -----------------------------
# HomieBuddy.tsx: make mini buttons write/read memory directly.
# -----------------------------
$b = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)

if ($b -notmatch 'function homieBuddyRunCompanionRoutine') {
  $anchor = '  function homieBuddySetCompanionDraft(nextPrompt: string) {'
  if (-not $b.Contains($anchor)) {
    $anchor = '  const panel = ('
  }
  if (-not $b.Contains($anchor)) {
    throw "Could not find HomieBuddy helper/panel anchor."
  }

$helper = @'
  function homieBuddyRunCompanionRoutine(kind: "checkin" | "reflect" | "legacy") {
    const key = "oddengine:homie:mood-ledger:v1";
    let entries: any[] = [];
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      entries = Array.isArray(parsed) ? parsed : [];
    } catch {
      entries = [];
    }

    const latest = entries[0];
    const themes = Array.isArray(latest?.themes) && latest.themes.length ? latest.themes : ["body", "mind", "family", "next move"];
    const lane = latest?.lane || "mind";
    const now = Date.now();

    if (kind === "checkin") {
      const entry = {
        id: `buddy_routine_${now}_checkin`,
        lane: "mind",
        mood: "honest check-in",
        themes: ["mind", "body", "family", "next move"],
        note: "HomieBuddy check-in started. Name what feels true, then pick one tiny step.",
        createdAt: now,
      };
      const next = [entry, ...entries].slice(0, 50);
      try {
        localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("homie:mood-ledger-updated"));
      } catch {
        // local-only best effort
      }
      homieBuddySetCompanionDraft("Homie, ask me how I am really doing, then help me name one honest feeling and one tiny next step.");
      return;
    }

    if (kind === "reflect") {
      homieBuddySetCompanionDraft(`Homie, reflect my latest check-in (${lane}: ${themes.join(", ")}) and suggest one tiny next step.`);
      return;
    }

    const legacyPrompt = latest
      ? `Homie, turn my latest check-in (${lane}: ${themes.join(", ")}) into a kind family legacy note and one Open First handoff.`
      : "Homie, help me draft a kind family legacy note and one Open First handoff.";
    try {
      localStorage.setItem("oddengine:homie:latest-legacy-draft:v1", legacyPrompt);
      window.dispatchEvent(new CustomEvent("homie:legacy-draft-updated", { detail: { prompt: legacyPrompt, createdAt: now } }));
    } catch {
      // local-only best effort
    }
    homieBuddySetCompanionDraft(legacyPrompt);
  }

'@
  $b = $b.Replace($anchor, $helper + $anchor)
}

# Replace HomieBuddy mini behavior deck helper calls.
$b = $b.Replace('homieBuddySetCompanionDraft("Homie, ask me a gentle check-in and help me name what I actually feel.")', 'homieBuddyRunCompanionRoutine("checkin")')
$b = $b.Replace('homieBuddySetCompanionDraft("Homie, reflect my mood and give me one tiny next step.")', 'homieBuddyRunCompanionRoutine("reflect")')
$b = $b.Replace('homieBuddySetCompanionDraft("Homie, help me make this useful for my family as a legacy note.")', 'homieBuddyRunCompanionRoutine("legacy")')

$b = $b.Replace('Pick one: name the feeling, choose one tiny step, or save a family note.', 'These are real local routines now: save a check-in, reflect the latest mood, or draft a family handoff.')
$b = $b.Replace('No local check-in saved yet. Want one tiny step, a plan, a memory, or a family note?', 'Shared local memory is ready. Check in, reflect, or draft a family note.')

[System.IO.File]::WriteAllText($buddy, $b, $utf8NoBom)

# -----------------------------
# Version marker.
# -----------------------------
if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.14";')
  if ($ver -notmatch 'HOMIE_REAL_CONVERSATION_MEMORY_ROUTINES_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_REAL_CONVERSATION_MEMORY_ROUTINES_PASS = "v10.38.14_HomieRealConversationMemoryAndCompanionRoutinesPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.14] Applied. Companion buttons now run real local routines." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
