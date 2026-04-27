$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$version = Join-Path $root "ui\src\lib\version.ts"

if (!(Test-Path $buddy)) { throw "Missing ui\src\components\HomieBuddy.tsx. Run from C:\OddEngine." }

Write-Host "[v10.38.10b] Fixing HomieBuddy mood ledger summary reference..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tsx = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)

# Ensure helper functions exist before HomieBuddy export.
if ($tsx -notmatch 'function readHomieMoodLedgerForBuddy') {
$helpers = @'
function readHomieMoodLedgerForBuddy() {
  try {
    const raw = localStorage.getItem("oddengine:homie:mood-ledger:v1");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function buildHomieBuddyMoodSummary() {
  const entries = readHomieMoodLedgerForBuddy();
  const latest = entries[0];
  if (!latest) return "No local check-in saved yet.";
  const themes = Array.isArray(latest.themes) ? latest.themes.join(", ") : latest.lane || "next move";
  return `Last check-in: ${latest.lane || "check-in"} - ${themes}.`;
}

'@
  if ($tsx.Contains('export default function HomieBuddy')) {
    $tsx = $tsx.Replace('export default function HomieBuddy', $helpers + 'export default function HomieBuddy')
  } elseif ($tsx.Contains('export function HomieBuddy')) {
    $tsx = $tsx.Replace('export function HomieBuddy', $helpers + 'export function HomieBuddy')
  } else {
    throw "Could not find HomieBuddy export anchor."
  }
}

# Remove any duplicate/mis-scoped definition from previous attempt.
$tsx = [regex]::Replace($tsx, '\s*const homieBuddyMoodSummary = buildHomieBuddyMoodSummary\(\);\s*', "`r`n")

# Insert the const directly before the component returns the panel.
$panelAnchor = '  const panel = ('
if (-not $tsx.Contains($panelAnchor)) {
  $panelAnchor = 'const panel = ('
}
if (-not $tsx.Contains($panelAnchor)) {
  throw "Could not find 'const panel = (' anchor in HomieBuddy.tsx."
}

$tsx = $tsx.Replace($panelAnchor, '  const homieBuddyMoodSummary = buildHomieBuddyMoodSummary();' + "`r`n`r`n" + $panelAnchor)

# Defensive fallback for the JSX expression.
$tsx = $tsx.Replace('{homieBuddyMoodSummary} Want one tiny step, a plan, or a family note?', '{homieBuddyMoodSummary || "No local check-in saved yet."} Want one tiny step, a plan, or a family note?')

[System.IO.File]::WriteAllText($buddy, $tsx, $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.10b";')
  if ($ver -notmatch 'HOMIE_MOOD_LEDGER_BUDDY_REFERENCE_FIX_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_MOOD_LEDGER_BUDDY_REFERENCE_FIX_PASS = "v10.38.10b_HomieMoodLedgerBuddyReferenceFixPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.10b] Applied. homieBuddyMoodSummary is now defined before panel JSX." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
