$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payloadAssets = Join-Path $root "payload\assets\homie"
$publicHomie = Join-Path $root "ui\public\homie"

if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payloadAssets)) { throw "Missing payload\assets\homie. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.18b] Applying corrected reference portrait asset..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Force -Path $publicHomie | Out-Null
Copy-Item -Force (Join-Path $payloadAssets "homie-reference-portrait.png") (Join-Path $publicHomie "homie-reference-portrait.png")
Copy-Item -Force (Join-Path $payloadAssets "homie-reference-portrait-256.png") (Join-Path $publicHomie "homie-reference-portrait-256.png")
Copy-Item -Force (Join-Path $payloadAssets "homie-reference-portrait-512.png") (Join-Path $publicHomie "homie-reference-portrait-512.png")

$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)

# Replace old v10.38.18 block with corrected sizing.
$start = "/* ===== v10.38.18 Homie Generated Portrait Asset Swap ===== */"
$end = "/* ===== v10.38.18 Homie Generated Portrait Asset Swap END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline)

$start2 = "/* ===== v10.38.18b Homie Reference Portrait Asset Correction ===== */"
$end2 = "/* ===== v10.38.18b Homie Reference Portrait Asset Correction END ===== */"
$pattern2 = [regex]::Escape($start2) + "[\s\S]*?" + [regex]::Escape($end2)
$css = [regex]::Replace($css, $pattern2, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()

$block = @'
/* ===== v10.38.18b Homie Reference Portrait Asset Correction ===== */
/* Uses the user-provided reference-style portrait asset. CSS avatar remains as fallback underneath. */
.homieHumanStage,
.homieRebuildStage{
  position:relative!important;
  overflow:hidden!important;
  background:
    radial-gradient(380px 300px at 50% 36%,rgba(154,230,255,.14),rgba(154,230,255,0) 72%),
    radial-gradient(320px 250px at 50% 86%,rgba(255,209,102,.08),rgba(255,209,102,0) 65%),
    rgba(3,7,16,.36)!important;
}

.homieHumanStage .homieHumanAura,
.homieRebuildStage .homieHumanBuddyCore{
  opacity:0!important;
}

.homieHumanStage::before,
.homieRebuildStage::before{
  content:"";
  position:absolute;
  z-index:5;
  pointer-events:none;
  background-image:url("/homie/homie-reference-portrait.png");
  background-repeat:no-repeat;
  background-position:center;
  background-size:contain;
  filter:
    drop-shadow(0 26px 38px rgba(0,0,0,.34))
    drop-shadow(0 0 18px rgba(154,230,255,.10));
}

.homieHumanStage::before{
  inset:4% 4% 2% 4%;
}

.homieRebuildStage::before{
  inset:5% 6% 3% 6%;
  background-image:url("/homie/homie-reference-portrait-512.png");
}

.homieHumanStage::after,
.homieRebuildStage::after{
  content:"";
  position:absolute;
  z-index:4;
  inset:10%;
  pointer-events:none;
  border-radius:32px;
  background:
    radial-gradient(circle at 50% 36%,rgba(255,255,255,.08),rgba(255,255,255,0) 42%),
    radial-gradient(circle at 50% 54%,rgba(154,230,255,.10),rgba(154,230,255,0) 68%);
}

.homieHumanStage{min-height:390px!important}
.homieRebuildStage{min-height:320px!important}

/* Keep small label readable below the portrait area. */
.homieHumanStage figcaption,
.homieRebuildStage figcaption{
  position:relative!important;
  z-index:8!important;
}
/* ===== v10.38.18b Homie Reference Portrait Asset Correction END ===== */
'@

[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.18b";')
  if ($ver -notmatch 'HOMIE_REFERENCE_PORTRAIT_CORRECTION_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_REFERENCE_PORTRAIT_CORRECTION_PASS = "v10.38.18b_HomieReferencePortraitAssetCorrectionPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.18b] Applied. Weird generated portrait replaced by corrected reference portrait asset." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
