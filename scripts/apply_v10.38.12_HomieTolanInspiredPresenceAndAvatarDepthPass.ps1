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

Write-Host "[v10.38.12] Applying Homie Tolan-inspired presence + avatar depth..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# CSS append/replace.
$cssPayload = Join-Path $payload "HOMIE_TOLAN_INSPIRED_PRESENCE_AVATAR_DEPTH.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.12 Homie Tolan-Inspired Presence + Avatar Depth ===== */"
$end = "/* ===== v10.38.12 Homie Tolan-Inspired Presence + Avatar Depth END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

# Main Homie copy polish, no logic changes.
$h = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)
$h = $h.Replace("Homie is not a clone of another companion. Homie is the single FairlyOdd family guide: warm, grounded, lightly playful, and built to help with one clear next step.", "Homie is your FairlyOdd family companion: warm, grounded, lightly playful, and built to stay with you through one clear next step.")
$h = $h.Replace("Present: \"I am here. We can take this one step at a time.\"", "Present: \"I am here with you. We can take this one step at a time.\"")
$h = $h.Replace("Grounded: helps body, mind, money, home, and creative work.", "Grounded: helps body, mind, family, money, home, and creative work.")
$h = $h.Replace("Family-safe: explains panels without dev jargon.", "Family-safe: explains panels simply and kindly.")
$h = $h.Replace("Legacy-aware: knows Open First matters most.", "Legacy-aware: helps turn today into something useful for family.")
$h = $h.Replace("Ready for one tiny step, a plan, or a family note.", "Ready for one tiny step, a plan, a memory, or a family note.")
[System.IO.File]::WriteAllText($homie, $h, $utf8NoBom)

# Companion copy polish, no logic changes.
$b = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)
$b = $b.Replace("Human Homie companion lane", "Homie companion presence")
$b = $b.Replace("Homie is here with you, warm and steady.", "Homie is here with you: warm, steady, and ready for one small step.")
$b = $b.Replace("Warm human companion lane open - body, mind,", "Warm companion presence open - body, mind,")
$b = $b.Replace("Ready for one tiny step, a plan, or a family note.", "Ready for one tiny step, a plan, a memory, or a family note.")
$b = $b.Replace("No local check-in saved yet. Want one tiny step, a plan, or a family note?", "No local check-in saved yet. Want one tiny step, a plan, a memory, or a family note?")
[System.IO.File]::WriteAllText($buddy, $b, $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.12";')
  if ($ver -notmatch 'HOMIE_TOLAN_INSPIRED_PRESENCE_AVATAR_DEPTH_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_TOLAN_INSPIRED_PRESENCE_AVATAR_DEPTH_PASS = "v10.38.12_HomieTolanInspiredPresenceAndAvatarDepthPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.12] Applied. Visual + copy polish only." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
