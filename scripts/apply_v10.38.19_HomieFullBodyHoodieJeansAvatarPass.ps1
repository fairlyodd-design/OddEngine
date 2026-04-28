$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payloadAssets = Join-Path $root "payload\assets\homie"
$publicHomie = Join-Path $root "ui\public\homie"

if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payloadAssets)) { throw "Missing payload\assets\homie. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.19] Applying Homie full body hoodie + jeans avatar..." -ForegroundColor Cyan
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

New-Item -ItemType Directory -Force -Path $publicHomie | Out-Null
Copy-Item -Force (Join-Path $payloadAssets "homie-fullbody-hoodie-jeans.png") (Join-Path $publicHomie "homie-fullbody-hoodie-jeans.png")
Copy-Item -Force (Join-Path $payloadAssets "homie-fullbody-hoodie-jeans-512.png") (Join-Path $publicHomie "homie-fullbody-hoodie-jeans-512.png")
Copy-Item -Force (Join-Path $payloadAssets "homie-fullbody-hoodie-jeans-256.png") (Join-Path $publicHomie "homie-fullbody-hoodie-jeans-256.png")

$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$start = "/* ===== v10.38.19 Homie Full Body Hoodie Jeans Avatar ===== */"
$end = "/* ===== v10.38.19 Homie Full Body Hoodie Jeans Avatar END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()

$block = @'
/* ===== v10.38.19 Homie Full Body Hoodie Jeans Avatar ===== */
/* Asset-backed full-body Homie. CSS/portrait avatar remains underneath as fallback. */
.homieHumanStage,
.homieRebuildStage{
  position:relative!important;
  overflow:hidden!important;
  background:
    radial-gradient(420px 330px at 50% 36%,rgba(154,230,255,.15),rgba(154,230,255,0) 72%),
    radial-gradient(340px 270px at 50% 86%,rgba(255,209,102,.085),rgba(255,209,102,0) 66%),
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
  z-index:6;
  pointer-events:none;
  background-repeat:no-repeat;
  background-position:center;
  background-size:contain;
  filter:
    drop-shadow(0 30px 42px rgba(0,0,0,.36))
    drop-shadow(0 0 18px rgba(154,230,255,.10));
}

.homieHumanStage::before{
  inset:0% 2% -5% 2%;
  background-image:url("/homie/homie-fullbody-hoodie-jeans.png");
}

.homieRebuildStage::before{
  inset:1% 5% -4% 5%;
  background-image:url("/homie/homie-fullbody-hoodie-jeans-512.png");
}

.homieHumanStage::after,
.homieRebuildStage::after{
  content:"";
  position:absolute;
  z-index:4;
  inset:10%;
  pointer-events:none;
  border-radius:34px;
  background:
    radial-gradient(circle at 50% 28%,rgba(255,255,255,.08),rgba(255,255,255,0) 42%),
    radial-gradient(circle at 50% 60%,rgba(154,230,255,.10),rgba(154,230,255,0) 68%);
}

.homieHumanStage{min-height:430px!important}
.homieRebuildStage{min-height:360px!important}

/* Keep captions/buttons above stage overlays. */
.homieHumanStage figcaption,
.homieRebuildStage figcaption,
.homieHumanStage .small,
.homieRebuildStage .small{
  position:relative!important;
  z-index:8!important;
}
/* ===== v10.38.19 Homie Full Body Hoodie Jeans Avatar END ===== */
'@

[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.19";')
  if ($ver -notmatch 'HOMIE_FULLBODY_HOODIE_JEANS_AVATAR_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_FULLBODY_HOODIE_JEANS_AVATAR_PASS = "v10.38.19_HomieFullBodyHoodieJeansAvatarPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.19] Applied. Homie is now full-body hoodie + jeans avatar." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run typecheck"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
