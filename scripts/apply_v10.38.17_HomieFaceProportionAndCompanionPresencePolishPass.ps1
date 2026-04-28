$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.17] Applying Homie face proportion + companion presence polish..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$cssPayload = Join-Path $payload "HOMIE_FACE_PROPORTION_COMPANION_PRESENCE.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.17 Homie Face Proportion + Companion Presence Polish ===== */"
$end = "/* ===== v10.38.17 Homie Face Proportion + Companion Presence Polish END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $homie) {
  $h = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)
  $h = $h.Replace('Homie is not a clone of another companion. Homie is the single FairlyOdd family guide: warm, grounded, lightly playful, and built to help with one clear next step.', 'Homie is the FairlyOdd family companion: here to protect what matters, remember the small human details, and help with one calm next step.')
  $h = $h.Replace('Homie is your FairlyOdd family companion: warm, grounded, lightly playful, and steady enough to notice the human part before the next step.', 'Homie is the FairlyOdd family companion: warm, grounded, lightly playful, and here to remember the human part before the next step.')
  $h = $h.Replace('Present: "I am here with you. No rush. Tell me what feels true first."', 'Present: "I am here. Tell me what feels true, then we will choose one calm step."')
  $h = $h.Replace('Grounded: helps body, mind, family, money, home, and creative work.', 'Grounded: helps body, mind, family, money, home, legacy, and creative work.')
  [System.IO.File]::WriteAllText($homie, $h, $utf8NoBom)
}

if (Test-Path $buddy) {
  $b = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)
  $b = $b.Replace('Homie is here with you: warm, steady, and ready to notice what feels true first.', 'Homie is here with you: warm, steady, and here to remember what matters.')
  $b = $b.Replace('Tiny companion routines: check in, reflect what feels true, or save something useful for family.', 'Tiny companion routines: check in, reflect what feels true, or save something your family can understand later.')
  $b = $b.Replace('Ready for one tiny step, a plan, a memory, a family note, or one quiet minute.', 'Ready for one calm step, a plan, a memory, a family note, or one quiet minute.')
  [System.IO.File]::WriteAllText($buddy, $b, $utf8NoBom)
}

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.17";')
  if ($ver -notmatch 'HOMIE_FACE_PROPORTION_COMPANION_PRESENCE_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_FACE_PROPORTION_COMPANION_PRESENCE_PASS = "v10.38.17_HomieFaceProportionAndCompanionPresencePolishPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.17] Applied. CSS + copy only." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
