$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payloadAssets = Join-Path $root "payload\assets\homie"
$publicHomie = Join-Path $root "ui\public\homie"

if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payloadAssets)) { throw "Missing payload\assets\homie. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.19b] Applying Homie improved hoodie/jeans body..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Force -Path $publicHomie | Out-Null
Copy-Item -Force (Join-Path $payloadAssets "homie-fullbody-hoodie-jeans.png") (Join-Path $publicHomie "homie-fullbody-hoodie-jeans.png")
Copy-Item -Force (Join-Path $payloadAssets "homie-fullbody-hoodie-jeans-512.png") (Join-Path $publicHomie "homie-fullbody-hoodie-jeans-512.png")
Copy-Item -Force (Join-Path $payloadAssets "homie-fullbody-hoodie-jeans-256.png") (Join-Path $publicHomie "homie-fullbody-hoodie-jeans-256.png")

$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$start = "/* ===== v10.38.19b Homie Body Proportion Realism Wardrobe Fit ===== */"
$end = "/* ===== v10.38.19b Homie Body Proportion Realism Wardrobe Fit END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()

$block = @'
/* ===== v10.38.19b Homie Body Proportion Realism Wardrobe Fit ===== */
/* Better full-body asset: slimmer hoodie, tapered jeans, more natural body proportion. */
.homieHumanStage::before{
  inset:-1% 1% -7% 1%!important;
  background-image:url("/homie/homie-fullbody-hoodie-jeans.png")!important;
  background-size:contain!important;
}

.homieRebuildStage::before{
  inset:0% 5% -6% 5%!important;
  background-image:url("/homie/homie-fullbody-hoodie-jeans-512.png")!important;
  background-size:contain!important;
}

.homieHumanStage,
.homieRebuildStage{
  background:
    radial-gradient(420px 330px at 50% 34%,rgba(154,230,255,.145),rgba(154,230,255,0) 72%),
    radial-gradient(340px 270px at 50% 86%,rgba(255,209,102,.08),rgba(255,209,102,0) 66%),
    rgba(3,7,16,.36)!important;
}

.homieHumanStage{min-height:440px!important}
.homieRebuildStage{min-height:365px!important}
/* ===== v10.38.19b Homie Body Proportion Realism Wardrobe Fit END ===== */
'@

[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.19b";')
  if ($ver -notmatch 'HOMIE_BODY_PROPORTION_REALISM_WARDROBE_FIT_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_BODY_PROPORTION_REALISM_WARDROBE_FIT_PASS = "v10.38.19b_HomieBodyProportionRealismAndWardrobeFitPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.19b] Applied. Homie body is slimmer and more hoodie/jeans character-like." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
