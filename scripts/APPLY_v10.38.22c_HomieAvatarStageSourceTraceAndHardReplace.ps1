param(
  [string]$RepoRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

function Write-Step($Text) { Write-Host "[v10.38.22c] $Text" -ForegroundColor Cyan }
function Write-Good($Text) { Write-Host "[v10.38.22c] $Text" -ForegroundColor Green }
function Write-Warn2($Text) { Write-Host "[v10.38.22c] $Text" -ForegroundColor Yellow }

$RepoRoot = (Resolve-Path $RepoRoot).Path
$UiRoot = Join-Path $RepoRoot "ui"
$ComponentsDir = Join-Path $UiRoot "src\components"
$DocsDir = Join-Path $RepoRoot "docs"
$PatchRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$PatchComponentsDir = Join-Path $PatchRoot "ui\src\components"
$BackupDir = Join-Path $RepoRoot ".oddengine-backups\v10.38.22c_$(Get-Date -Format yyyyMMdd_HHmmss)"

if (!(Test-Path $UiRoot)) { throw "Could not find ui folder. Run this from C:\OddEngine or pass -RepoRoot C:\OddEngine." }
if (!(Test-Path $ComponentsDir)) { throw "Could not find ui\src\components." }
New-Item -ItemType Directory -Force -Path $DocsDir, $BackupDir | Out-Null

$TraceTerms = @(
  "homie-composite-hoodie-avatar",
  "homie-fullbody-hoodie-jeans",
  "homieHumanStage::before",
  "homieRebuildStage::before",
  "HomieTrue3DAvatar",
  "data-homie-true-3d"
)

$TracePath = Join-Path $DocsDir "v10.38.22c_HomieAvatarStageSourceTrace.md"
$trace = New-Object System.Collections.Generic.List[string]
$trace.Add("# v10.38.22c Homie Avatar Stage Source Trace")
$trace.Add("")
$trace.Add("Generated: $(Get-Date -Format o)")
$trace.Add("RepoRoot: $RepoRoot")
$trace.Add("")

Write-Step "Tracing source winner terms..."
$SearchRoots = @((Join-Path $UiRoot "src"), (Join-Path $UiRoot "public")) | Where-Object { Test-Path $_ }
foreach ($term in $TraceTerms) {
  $trace.Add("## $term")
  $matches = @()
  foreach ($root in $SearchRoots) {
    $matches += Get-ChildItem -Path $root -Recurse -File -Include *.tsx,*.ts,*.css,*.scss,*.html,*.json 2>$null | Select-String -Pattern ([regex]::Escape($term)) -SimpleMatch:$false
  }
  if ($matches.Count -eq 0) {
    $trace.Add("- No exact match found.")
  } else {
    foreach ($m in $matches) {
      $rel = $m.Path.Replace($RepoRoot + [IO.Path]::DirectorySeparatorChar, "")
      $trace.Add("- `$rel` line $($m.LineNumber): ``$($m.Line.Trim())``")
    }
  }
  $trace.Add("")
}
$trace | Set-Content -Path $TracePath -Encoding UTF8
Write-Good "Trace written to docs\v10.38.22c_HomieAvatarStageSourceTrace.md"

Write-Step "Installing hard 3D canvas component + isolation CSS..."
Copy-Item -Force (Join-Path $PatchComponentsDir "HomieTrue3DAvatar.tsx") (Join-Path $ComponentsDir "HomieTrue3DAvatar.tsx")
Copy-Item -Force (Join-Path $PatchComponentsDir "homieTrue3DStageHardReplace.css") (Join-Path $ComponentsDir "homieTrue3DStageHardReplace.css")
Write-Good "Installed HomieTrue3DAvatar.tsx and homieTrue3DStageHardReplace.css"

$HomieBuddyPath = Join-Path $ComponentsDir "HomieBuddy.tsx"
if (!(Test-Path $HomieBuddyPath)) { throw "Could not find ui\src\components\HomieBuddy.tsx" }
Copy-Item -Force $HomieBuddyPath (Join-Path $BackupDir "HomieBuddy.tsx.bak")
$hb = Get-Content $HomieBuddyPath -Raw
$originalHb = $hb

if ($hb -notmatch 'HomieTrue3DAvatar') {
  $hb = $hb -replace 'import React,', 'import { HomieTrue3DAvatar } from "./HomieTrue3DAvatar";`r`nimport React,'
}

$hardStageMarkup = @'
<div className="homieRebuildAvatarWrap homie3DHardStage" data-homie-stage-source="true-3d-hard-replace">
  <HomieTrue3DAvatar size={mode === "standalone" ? "main" : "buddy"} mood={avatarState === "listening" ? "listening" : avatarState === "speaking" ? "speaking" : presenceEmotion === "concerned" ? "caring" : presenceEmotion === "celebrating" ? "legacy" : "idle"} />
</div>
'@

$replaced = $false
$patterns = @(
  '<div\s+className="homieRebuildAvatarWrap"[\s\S]*?</div>\s*(?=<div\s+className="homieRebuildStageText")',
  '<div\s+className="homieRebuildAvatarWrap"[\s\S]*?</div>\s*(?=<div\s+className="homieRebuildPresence")',
  '<div\s+className="homieRebuildAvatarWrap"[\s\S]*?</div>\s*(?=<section|<div\s+className="homieLegacy|</div>)'
)
foreach ($pattern in $patterns) {
  if ($hb -match $pattern) {
    $hb = [regex]::Replace($hb, $pattern, $hardStageMarkup, 1)
    $replaced = $true
    break
  }
}

if (-not $replaced) {
  # Fallback insertion: put the hard stage at the start of the rebuild stage if the exact avatar slot changed.
  $stagePattern = '(<(?:section|div)[^>]*className=\{?[^>]*homieRebuildStage[^>]*>)'
  if ($hb -match $stagePattern) {
    $hb = [regex]::Replace($hb, $stagePattern, "`$1`r`n$hardStageMarkup", 1)
    $replaced = $true
  }
}

if ($replaced) {
  Set-Content -Path $HomieBuddyPath -Value $hb -Encoding UTF8
  Write-Good "HomieBuddy visible avatar slot now points at HomieTrue3DAvatar only."
} else {
  Write-Warn2 "Could not find the exact HomieBuddy stage slot. CSS hard-neutralizers were still installed. Check trace doc."
}

$RebuildCssPath = Join-Path $ComponentsDir "homieRebuild.css"
if (Test-Path $RebuildCssPath) {
  Copy-Item -Force $RebuildCssPath (Join-Path $BackupDir "homieRebuild.css.bak")
  $css = Get-Content $RebuildCssPath -Raw
  if ($css -notmatch 'v10\.38\.22c_HomieAvatarStageSourceTraceAndHardReplacePass') {
    $css += @'

/* ===== v10.38.22c_HomieAvatarStageSourceTraceAndHardReplacePass legacy neutralizers ===== */
.homieHumanStage::before,
.homieHumanStage::after,
.homieRebuildStage::before,
.homieRebuildStage::after {
  content: none !important;
  display: none !important;
  background: none !important;
  background-image: none !important;
  opacity: 0 !important;
}
.homie-composite-hoodie-avatar,
.homie-fullbody-hoodie-jeans,
img[src*="homie-composite-hoodie-avatar"],
img[src*="homie-fullbody-hoodie-jeans"] {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
/* ===== v10.38.22c END ===== */
'@
    Set-Content -Path $RebuildCssPath -Value $css -Encoding UTF8
    Write-Good "Appended non-:has legacy CSS neutralizers to homieRebuild.css."
  } else {
    Write-Good "homieRebuild.css already contains v10.38.22c neutralizers."
  }
}

# Optional: make HomieBuddy standalone/lil stage use the same component if the roaming agent is present.
$LilAgentPath = Join-Path $ComponentsDir "LilHomieAgent.tsx"
if (Test-Path $LilAgentPath) {
  Copy-Item -Force $LilAgentPath (Join-Path $BackupDir "LilHomieAgent.tsx.bak")
  $la = Get-Content $LilAgentPath -Raw
  $laOriginal = $la
  if ($la -notmatch 'HomieTrue3DAvatar') {
    $la = $la -replace 'import React,', 'import { HomieTrue3DAvatar } from "./HomieTrue3DAvatar";`r`nimport React,'
  }
  $agentPattern = '<div\s+className="homieLilBody lilAgentBody"[\s\S]*?</div>\s*(?=\s*</div>\s*\)?)'
  if ($la -match $agentPattern) {
    $agentReplacement = '<div className="homieLilBody lilAgentBody homie3DHardStage" data-homie-stage-source="true-3d-hard-replace"><HomieTrue3DAvatar size="buddy" mood="idle" /></div>'
    $la = [regex]::Replace($la, $agentPattern, $agentReplacement, 1)
  }
  if ($la -ne $laOriginal) {
    Set-Content -Path $LilAgentPath -Value $la -Encoding UTF8
    Write-Good "LilHomieAgent routed to the clean 3D canvas where safely detectable."
  }
}

$VersionPath = Join-Path $UiRoot "src\lib\version.ts"
if (Test-Path $VersionPath) {
  Copy-Item -Force $VersionPath (Join-Path $BackupDir "version.ts.bak")
  $version = Get-Content $VersionPath -Raw
  $version = $version -replace 'v10\.38\.22[b-z]?(?:-clean)?', 'v10.38.22c-clean'
  if ($version -notmatch '10\.38\.22c') {
    $version = $version -replace 'APP_VERSION\s*=\s*"[^"]+"', 'APP_VERSION = "v10.38.22c-clean"'
  }
  Set-Content -Path $VersionPath -Value $version -Encoding UTF8
}

Write-Step "Running requested validation commands..."
Push-Location $RepoRoot
try {
  npm --prefix ui run typecheck
  npm --prefix ui run build
  Write-Good "typecheck + build passed."
} finally {
  Pop-Location
}

Write-Good "Patch complete. Suggested tag: git tag v10.38.22c-clean && git push origin v10.38.22c-clean"
Write-Good "Backup folder: $BackupDir"
