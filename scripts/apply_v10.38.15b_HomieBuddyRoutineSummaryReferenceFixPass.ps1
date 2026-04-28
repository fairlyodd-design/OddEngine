$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$version = Join-Path $root "ui\src\lib\version.ts"

if (!(Test-Path $buddy)) { throw "Missing ui\src\components\HomieBuddy.tsx. Run from C:\OddEngine." }

Write-Host "[v10.38.15b] Fixing HomieBuddy routine summary reference..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tsx = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)

# Ensure helper functions exist before HomieBuddy export.
if ($tsx -notmatch 'function homieBuddyReadRoutineReceipts') {
$helpers = @'
function homieBuddyReadRoutineReceipts() {
  try {
    const raw = localStorage.getItem("oddengine:homie:routine-receipts:v1");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function buildHomieBuddyRoutineSummary() {
  const latest = homieBuddyReadRoutineReceipts()[0];
  if (!latest) return "No routine receipt yet.";
  return `${latest.title || "Routine"}: ${latest.detail || "Saved locally."}`;
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

# If helper read exists but summary helper did not, add summary helper after read helper.
if ($tsx -notmatch 'function buildHomieBuddyRoutineSummary') {
  $anchor = 'function homieBuddyReadRoutineReceipts()'
  $idx = $tsx.IndexOf($anchor)
  if ($idx -lt 0) { throw "Could not find homieBuddyReadRoutineReceipts anchor." }
  $insertAfterPattern = 'function homieBuddyReadRoutineReceipts\(\) \{[\s\S]*?\n\}'
  $summaryHelper = @'

function buildHomieBuddyRoutineSummary() {
  const latest = homieBuddyReadRoutineReceipts()[0];
  if (!latest) return "No routine receipt yet.";
  return `${latest.title || "Routine"}: ${latest.detail || "Saved locally."}`;
}

'@
  $tsx = [regex]::Replace($tsx, $insertAfterPattern, { param($m) $m.Value + $summaryHelper }, 1)
}

# Remove duplicate/mis-scoped routine summary consts from prior attempts.
$tsx = [regex]::Replace($tsx, '\s*const homieBuddyRoutineSummary = buildHomieBuddyRoutineSummary\(\);\s*', "`r`n")

# Insert const directly before panel JSX, same safe pattern as earlier fixed summaries.
$panelAnchor = '  const panel = ('
if (-not $tsx.Contains($panelAnchor)) {
  $panelAnchor = 'const panel = ('
}
if (-not $tsx.Contains($panelAnchor)) {
  throw "Could not find 'const panel = (' anchor in HomieBuddy.tsx."
}

$tsx = $tsx.Replace($panelAnchor, '  const homieBuddyRoutineSummary = buildHomieBuddyRoutineSummary();' + "`r`n`r`n" + $panelAnchor)

# Defensive fallback in JSX.
$tsx = $tsx.Replace('{homieBuddyRoutineSummary}', '{homieBuddyRoutineSummary || "No routine receipt yet."}')

[System.IO.File]::WriteAllText($buddy, $tsx, $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.15b";')
  if ($ver -notmatch 'HOMIE_BUDDY_ROUTINE_SUMMARY_REFERENCE_FIX_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_BUDDY_ROUTINE_SUMMARY_REFERENCE_FIX_PASS = "v10.38.15b_HomieBuddyRoutineSummaryReferenceFixPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.15b] Applied. homieBuddyRoutineSummary is now defined before panel JSX." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
