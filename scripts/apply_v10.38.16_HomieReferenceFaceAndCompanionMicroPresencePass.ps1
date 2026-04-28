$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.16] Applying Homie reference face + companion micro-presence..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$cssPayload = Join-Path $payload "HOMIE_REFERENCE_FACE_MICRO_PRESENCE.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)

$start = "/* ===== v10.38.16 Homie Reference Face + Companion Micro-Presence ===== */"
$end = "/* ===== v10.38.16 Homie Reference Face + Companion Micro-Presence END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

# Copy-only micro-presence polish. These are no-op if exact strings have drifted.
if (Test-Path $homie) {
  $h = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)
  $h = $h.Replace('Homie is your FairlyOdd family companion: warm, grounded, lightly playful, and steady enough to sit with the real human part before the next step.', 'Homie is your FairlyOdd family companion: warm, grounded, lightly playful, and steady enough to notice the human part before the next step.')
  $h = $h.Replace('Present: "I am here with you. No rush. One honest step at a time."', 'Present: "I am here with you. No rush. Tell me what feels true first."')
  $h = $h.Replace('Ready for one tiny step, a plan, a memory, a family note, or just a minute to breathe.', 'Ready for one tiny step, a plan, a memory, a family note, or one quiet minute.')
  [System.IO.File]::WriteAllText($homie, $h, $utf8NoBom)
}

if (Test-Path $buddy) {
  $b = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)
  $b = $b.Replace('Homie is here with you: warm, steady, and ready to sit with the real human part first.', 'Homie is here with you: warm, steady, and ready to notice what feels true first.')
  $b = $b.Replace('These are real local routines now: save a check-in, reflect the latest mood, or draft a family handoff.', 'Tiny companion routines: check in, reflect what feels true, or save something useful for family.')
  $b = $b.Replace('Ready for one tiny step, a plan, a memory, a family note, or just a minute to breathe.', 'Ready for one tiny step, a plan, a memory, a family note, or one quiet minute.')
  [System.IO.File]::WriteAllText($buddy, $b, $utf8NoBom)
}

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.16";')
  if ($ver -notmatch 'HOMIE_REFERENCE_FACE_MICRO_PRESENCE_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_REFERENCE_FACE_MICRO_PRESENCE_PASS = "v10.38.16_HomieReferenceFaceAndCompanionMicroPresencePass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.16] Applied. CSS + copy only." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
