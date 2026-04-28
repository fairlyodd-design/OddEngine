$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$styles = Join-Path $root "ui\src\styles.css"
$homie = Join-Path $root "ui\src\panels\Homie.tsx"
$buddy = Join-Path $root "ui\src\components\HomieBuddy.tsx"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"
$componentPayload = Join-Path $payload "components\HomieTrue3DAvatar.tsx"
$componentTarget = Join-Path $root "ui\src\components\HomieTrue3DAvatar.tsx"
$specTargetDir = Join-Path $root "ui\public\homie"
$specPayload = Join-Path $payload "assets\homie\homie-starter-3d-avatar.json"

if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $homie)) { throw "Missing ui\src\panels\Homie.tsx. Run from C:\OddEngine." }
if (!(Test-Path $buddy)) { throw "Missing ui\src\components\HomieBuddy.tsx. Run from C:\OddEngine." }
if (!(Test-Path $componentPayload)) { throw "Missing payload\components\HomieTrue3DAvatar.tsx. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.21] Applying Homie true 3D avatar viewer..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Install component + spec.
Copy-Item -Force $componentPayload $componentTarget
New-Item -ItemType Directory -Force -Path $specTargetDir | Out-Null
if (Test-Path $specPayload) {
  Copy-Item -Force $specPayload (Join-Path $specTargetDir "homie-starter-3d-avatar.json")
}

# CSS block.
$cssPayload = Join-Path $payload "HOMIE_TRUE_3D_AVATAR_VIEWER.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.21 Homie True 3D Avatar Viewer ===== */"
$end = "/* ===== v10.38.21 Homie True 3D Avatar Viewer END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

function Add-ImportIfMissing {
  param([string]$Path, [string]$ImportLine)
  $text = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
  if ($text -notmatch [regex]::Escape("HomieTrue3DAvatar")) {
    $text = $ImportLine + "`r`n" + $text
    [System.IO.File]::WriteAllText($Path, $text, $utf8NoBom)
  }
}

# Homie panel import and mount.
$h = [System.IO.File]::ReadAllText($homie, [System.Text.Encoding]::UTF8)
if ($h -notmatch 'HomieTrue3DAvatar') {
  $h = 'import { HomieTrue3DAvatar } from "../components/HomieTrue3DAvatar";' + "`r`n" + $h
}
if ($h -notmatch 'data-homie-true-3d="main-stage"') {
  $stagePattern = '(<div[^>]*className="[^"]*homieHumanStage[^"]*"[^>]*>)'
  if ([regex]::IsMatch($h, $stagePattern)) {
    $h = [regex]::Replace($h, $stagePattern, '$1' + "`r`n" + '          <div data-homie-true-3d="main-stage"><HomieTrue3DAvatar size="main" mood={livingPresenceState || "idle"} /></div>', 1)
  } else {
    Write-Host "[v10.38.21] Warning: homieHumanStage anchor not found. Component installed; manual mount may be needed." -ForegroundColor Yellow
  }
}
[System.IO.File]::WriteAllText($homie, $h, $utf8NoBom)

# HomieBuddy import and mount.
$b = [System.IO.File]::ReadAllText($buddy, [System.Text.Encoding]::UTF8)
if ($b -notmatch 'HomieTrue3DAvatar') {
  $b = 'import { HomieTrue3DAvatar } from "./HomieTrue3DAvatar";' + "`r`n" + $b
}
if ($b -notmatch 'data-homie-true-3d="buddy-stage"') {
  $stagePattern = '(<div[^>]*className="[^"]*homieRebuildStage[^"]*"[^>]*>)'
  if ([regex]::IsMatch($b, $stagePattern)) {
    $b = [regex]::Replace($b, $stagePattern, '$1' + "`r`n" + '          <div data-homie-true-3d="buddy-stage"><HomieTrue3DAvatar size="buddy" mood={livingPresenceState || "idle"} /></div>', 1)
  } else {
    Write-Host "[v10.38.21] Warning: homieRebuildStage anchor not found. Component installed; manual mount may be needed." -ForegroundColor Yellow
  }
}
[System.IO.File]::WriteAllText($buddy, $b, $utf8NoBom)

# Version marker.
if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.21";')
  if ($ver -notmatch 'HOMIE_TRUE_3D_AVATAR_VIEWER_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_TRUE_3D_AVATAR_VIEWER_PASS = "v10.38.21_HomieTrue3DAvatarAssetAndViewerPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.21] Applied. Starter true 3D avatar viewer installed." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
