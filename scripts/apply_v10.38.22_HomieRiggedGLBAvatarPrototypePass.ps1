$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"
$assetsPayload = Join-Path $payload "assets\homie"
$publicHomie = Join-Path $root "ui\public\homie"

if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $assetsPayload)) { throw "Missing payload\assets\homie. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.22] Applying Homie rigged GLB prototype lane..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Force -Path $publicHomie | Out-Null
Copy-Item -Force (Join-Path $assetsPayload "homie-rigged-prototype.glb") (Join-Path $publicHomie "homie-rigged-prototype.glb")
Copy-Item -Force (Join-Path $assetsPayload "homie-rigged-prototype.manifest.json") (Join-Path $publicHomie "homie-rigged-prototype.manifest.json")

# Append/replace CSS cleanup block.
$cssPayload = Join-Path $payload "HOMIE_RIGGED_GLB_PROTOTYPE_LANE.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.22 Homie Rigged GLB Prototype Lane ===== */"
$end = "/* ===== v10.38.22 Homie Rigged GLB Prototype Lane END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

# Version marker.
if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.22";')
  if ($ver -notmatch 'HOMIE_RIGGED_GLB_AVATAR_PROTOTYPE_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_RIGGED_GLB_AVATAR_PROTOTYPE_PASS = "v10.38.22_HomieRiggedGLBAvatarPrototypePass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.22] Applied. Prototype GLB asset + clean 3D lane installed." -ForegroundColor Green
Write-Host "Installed:"
Write-Host "  ui\public\homie\homie-rigged-prototype.glb"
Write-Host "  ui\public\homie\homie-rigged-prototype.manifest.json"
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
