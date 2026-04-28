$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payloadAssets = Join-Path $root "payload\assets\homie"
$publicHomie = Join-Path $root "ui\public\homie"

if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payloadAssets)) { throw "Missing payload\assets\homie. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.18] Applying Homie generated portrait asset swap..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Force -Path $publicHomie | Out-Null
Copy-Item -Force (Join-Path $payloadAssets "homie-reference-portrait.png") (Join-Path $publicHomie "homie-reference-portrait.png")
Copy-Item -Force (Join-Path $payloadAssets "homie-reference-portrait-256.png") (Join-Path $publicHomie "homie-reference-portrait-256.png")

$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$start = "/* ===== v10.38.18 Homie Generated Portrait Asset Swap ===== */"
$end = "/* ===== v10.38.18 Homie Generated Portrait Asset Swap END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()

$block = @'
/* ===== v10.38.18 Homie Generated Portrait Asset Swap ===== */
/* Asset-backed Homie portrait. CSS avatar remains underneath as fallback. */
.homieHumanStage,
.homieRebuildStage{
  position:relative!important;
  overflow:hidden!important;
}

.homieHumanStage .homieHumanAura,
.homieRebuildStage .homieHumanBuddyCore{
  opacity:0!important;
  transform:scale(.985)!important;
  transition:opacity .18s ease!important;
}

.homieHumanStage::before,
.homieRebuildStage::before{
  content:"";
  position:absolute;
  inset:8% 8% 6% 8%;
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

.homieHumanStage::after,
.homieRebuildStage::after{
  content:"";
  position:absolute;
  inset:10%;
  z-index:4;
  pointer-events:none;
  border-radius:32px;
  background:
    radial-gradient(circle at 50% 36%,rgba(255,255,255,.10),rgba(255,255,255,0) 42%),
    radial-gradient(circle at 50% 54%,rgba(154,230,255,.13),rgba(154,230,255,0) 68%),
    radial-gradient(circle at 50% 86%,rgba(255,209,102,.09),rgba(255,209,102,0) 62%);
}

.homieHumanStage{
  min-height:390px!important;
}

.homieRebuildStage::before{
  inset:10% 9% 8% 9%;
  background-image:url("/homie/homie-reference-portrait-256.png");
}

.homieRebuildStage{
  min-height:320px!important;
}

.homieCompanionBehaviorCard,
.homieRoutineLedgerCard,
.homieBuddyRoutineStatus{
  backdrop-filter:blur(18px)!important;
}
/* ===== v10.38.18 Homie Generated Portrait Asset Swap END ===== */
'@

[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.18";')
  if ($ver -notmatch 'HOMIE_GENERATED_PORTRAIT_ASSET_SWAP_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_GENERATED_PORTRAIT_ASSET_SWAP_PASS = "v10.38.18_HomieGeneratedPortraitAssetSwapPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.18] Applied. Generated portrait is now the lead Homie visual." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
