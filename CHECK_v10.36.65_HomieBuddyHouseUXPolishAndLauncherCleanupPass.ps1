$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$cssPath = Join-Path $root "ui\src\components\homieRebuild.css"

Write-Host "[v10.36.65_HomieBuddyHouseUXPolishAndLauncherCleanupPass] Checking from $root"

if (!(Test-Path $cssPath)) {
  throw "Missing ui\src\components\homieRebuild.css. Run this from C:\OddEngine."
}

$css = Get-Content $cssPath -Raw

$required = @(
  "v10.36.65 Homie Buddy House UX Polish + Launcher Cleanup",
  ".homieRebuildDock:has(.homieRebuildPanel) .homieRebuildLauncher",
  "scrollbar-gutter: stable",
  ".homieRebuildStage::before",
  ".homieRebuildAvatarWrap",
  ".homieRebuildMessages"
)

foreach ($needle in $required) {
  if ($css -notlike "*$needle*") {
    throw "Missing expected marker/style: $needle"
  }
}

Write-Host "[v10.36.65_HomieBuddyHouseUXPolishAndLauncherCleanupPass] Check passed."
Write-Host "Next: cd ui; npm run typecheck; npm run build"