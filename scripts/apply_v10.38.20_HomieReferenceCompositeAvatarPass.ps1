$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payloadAssets = Join-Path $root "payload\assets\homie"
$publicHomie = Join-Path $root "ui\public\homie"

if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payloadAssets)) { throw "Missing payload\assets\homie. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.20] Applying Homie reference composite avatar..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Force -Path $publicHomie | Out-Null
Copy-Item -Force (Join-Path $payloadAssets "homie-composite-hoodie-avatar.png") (Join-Path $publicHomie "homie-composite-hoodie-avatar.png")
Copy-Item -Force (Join-Path $payloadAssets "homie-composite-hoodie-avatar-512.png") (Join-Path $publicHomie "homie-composite-hoodie-avatar-512.png")
Copy-Item -Force (Join-Path $payloadAssets "homie-composite-hoodie-avatar-256.png") (Join-Path $publicHomie "homie-composite-hoodie-avatar-256.png")
Copy-Item -Force (Join-Path $payloadAssets "homie-fullbody-hoodie-jeans.png") (Join-Path $publicHomie "homie-fullbody-hoodie-jeans.png")
Copy-Item -Force (Join-Path $payloadAssets "homie-fullbody-hoodie-jeans-512.png") (Join-Path $publicHomie "homie-fullbody-hoodie-jeans-512.png")
Copy-Item -Force (Join-Path $payloadAssets "homie-fullbody-hoodie-jeans-256.png") (Join-Path $publicHomie "homie-fullbody-hoodie-jeans-256.png")

$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$start = "/* ===== v10.38.20 Homie Reference Composite Avatar ===== */"
$end = "/* ===== v10.38.20 Homie Reference Composite Avatar END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()

$block = @'
/* ===== v10.38.20 Homie Reference Composite Avatar ===== */
/* Direct composite from user-provided hoodie-body reference + FairlyOdd/Homie head reference. */
.homieHumanStage::before{
  inset:-4% -1% -9% -1%!important;
  background-image:url("/homie/homie-composite-hoodie-avatar.png")!important;
  background-size:contain!important;
  background-position:center!important;
}

.homieRebuildStage::before{
  inset:-2% 2% -8% 2%!important;
  background-image:url("/homie/homie-composite-hoodie-avatar-512.png")!important;
  background-size:contain!important;
  background-position:center!important;
}

.homieHumanStage,
.homieRebuildStage{
  background:
    radial-gradient(450px 350px at 50% 32%,rgba(154,230,255,.15),rgba(154,230,255,0) 72%),
    radial-gradient(365px 290px at 50% 87%,rgba(255,209,102,.08),rgba(255,209,102,0) 66%),
    rgba(3,7,16,.36)!important;
}

.homieHumanStage{min-height:462px!important}
.homieRebuildStage{min-height:382px!important}
/* ===== v10.38.20 Homie Reference Composite Avatar END ===== */
'@

[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.20";')
  if ($ver -notmatch 'HOMIE_REFERENCE_COMPOSITE_AVATAR_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_REFERENCE_COMPOSITE_AVATAR_PASS = "v10.38.20_HomieReferenceCompositeAvatarPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.20] Applied. Homie now uses a direct composite hoodie avatar asset." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
