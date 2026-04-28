$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$styles = Join-Path $root "ui\src\styles.css"
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$version = Join-Path $root "ui\src\lib\version.ts"
$componentPayload = Join-Path $root "payload\components\HomieTrue3DAvatar.tsx"
$componentTarget = Join-Path $root "ui\src\components\HomieTrue3DAvatar.tsx"
$cssPayload = Join-Path $root "payload\HOMIE_3D_STAGE_FORCE_RENDERER_LEGACY_KILL.css"

if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $homie)) { throw "Missing ui\src\panels\Homie.tsx. Run from C:\OddEngine." }
if (!(Test-Path $buddy)) { throw "Missing ui\src\components\HomieBuddy.tsx. Run from C:\OddEngine." }
if (!(Test-Path $componentPayload)) { throw "Missing payload\components\HomieTrue3DAvatar.tsx. Extract this ZIP into C:\OddEngine first." }
if (!(Test-Path $cssPayload)) { throw "Missing payload\HOMIE_3D_STAGE_FORCE_RENDERER_LEGACY_KILL.css. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.22b] Forcing Homie 3D stage and killing legacy visuals..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Copy-Item -Force $componentPayload $componentTarget

# CSS: remove previous 22b block and append hard-kill block.
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.22b Homie 3D Stage Force Renderer + Legacy Visual Kill ===== */"
$end = "/* ===== v10.38.22b Homie 3D Stage Force Renderer + Legacy Visual Kill END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

function EnsureImport {
  param([string]$Path, [string]$ImportLine)
  $text = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  if ($text -notmatch 'HomieTrue3DAvatar') {
    $text = $ImportLine + "`r`n" + $text
  }
  return $text
}

# Main Homie: import, remove unsafe mood props, inject mount if missing.
$h = EnsureImport $homie 'import { HomieTrue3DAvatar } from "../components/HomieTrue3DAvatar";'
$h = $h.Replace('<HomieTrue3DAvatar size="main" mood={livingPresenceState || "idle"} />', '<HomieTrue3DAvatar size="main" />')
$h = $h.Replace('<HomieTrue3DAvatar size="main" mood={livingPresenceState ?? "idle"} />', '<HomieTrue3DAvatar size="main" />')
$h = $h.Replace('<HomieTrue3DAvatar size="main" mood={livingPresenceState} />', '<HomieTrue3DAvatar size="main" />')
if ($h -notmatch 'data-homie-true-3d="main-stage"') {
  $stagePattern = '(<div[^>]*className="[^"]*homieHumanStage[^"]*"[^>]*>)'
  if ([regex]::IsMatch($h, $stagePattern)) {
    $h = [regex]::Replace($h, $stagePattern, '$1' + "`r`n" + '          <div data-homie-true-3d="main-stage"><HomieTrue3DAvatar size="main" /></div>', 1)
  } else {
    Write-Host "[v10.38.22b] Warning: homieHumanStage anchor not found in Homie.tsx." -ForegroundColor Yellow
  }
}
[System.IO.File]::WriteAllText($homie, $h, $utf8NoBom)

# Buddy: import, remove unsafe mood props, inject mount if missing.
$b = EnsureImport $buddy 'import { HomieTrue3DAvatar } from "./HomieTrue3DAvatar";'
$b = $b.Replace('<HomieTrue3DAvatar size="buddy" mood={livingPresenceState || "idle"} />', '<HomieTrue3DAvatar size="buddy" />')
$b = $b.Replace('<HomieTrue3DAvatar size="buddy" mood={livingPresenceState ?? "idle"} />', '<HomieTrue3DAvatar size="buddy" />')
$b = $b.Replace('<HomieTrue3DAvatar size="buddy" mood={livingPresenceState} />', '<HomieTrue3DAvatar size="buddy" />')
if ($b -notmatch 'data-homie-true-3d="buddy-stage"') {
  $stagePattern = '(<div[^>]*className="[^"]*homieRebuildStage[^"]*"[^>]*>)'
  if ([regex]::IsMatch($b, $stagePattern)) {
    $b = [regex]::Replace($b, $stagePattern, '$1' + "`r`n" + '          <div data-homie-true-3d="buddy-stage"><HomieTrue3DAvatar size="buddy" /></div>', 1)
  } else {
    Write-Host "[v10.38.22b] Warning: homieRebuildStage anchor not found in HomieBuddy.tsx." -ForegroundColor Yellow
  }
}
[System.IO.File]::WriteAllText($buddy, $b, $utf8NoBom)

# Version marker.
if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.22b";')
  if ($ver -notmatch 'HOMIE_3D_STAGE_FORCE_RENDERER_LEGACY_VISUAL_KILL_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_3D_STAGE_FORCE_RENDERER_LEGACY_VISUAL_KILL_PASS = "v10.38.22b_Homie3DStageForceRendererAndLegacyVisualKillPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.22b] Applied. 3D canvas is forced and legacy avatar layers are hidden." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
