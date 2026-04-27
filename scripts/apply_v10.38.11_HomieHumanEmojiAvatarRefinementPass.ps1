$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.11] Applying Homie human emoji avatar refinement..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$cssPayload = Join-Path $payload "HOMIE_HUMAN_EMOJI_AVATAR_REFINEMENT.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)

$start = "/* ===== v10.38.11 Homie Human Emoji Avatar Refinement ===== */"
$end = "/* ===== v10.38.11 Homie Human Emoji Avatar Refinement END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()

[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.11";')
  if ($ver -notmatch 'HOMIE_HUMAN_EMOJI_AVATAR_REFINEMENT_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_HUMAN_EMOJI_AVATAR_REFINEMENT_PASS = "v10.38.11_HomieHumanEmojiAvatarRefinementPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.11] Applied. CSS-only avatar refinement." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
