$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Resolve-RepoRoot {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += (Split-Path -Parent $PSScriptRoot) }
  if ($PSCommandPath) { $candidates += (Split-Path -Parent (Split-Path -Parent $PSCommandPath)) }
  $candidates += (Get-Location).Path
  foreach ($base in $candidates) {
    if (-not $base) { continue }
    $style = Join-Path $base 'ui\src\styles.css'
    if (Test-Path -LiteralPath $style) { return $base }
  }
  throw 'Could not find repo root containing ui\src\styles.css'
}

$repoRoot = Resolve-RepoRoot
$stylesPath = Join-Path $repoRoot 'ui\src\styles.css'
$text = Get-Content -Raw -LiteralPath $stylesPath
$marker = '/* ===== v10.36.11 SingleScrollShellAndStaticRailsPass ===== */'

if ($text.Contains($marker)) {
  Write-Host 'v10.36.11 block already present in styles.css.'
} else {
  $block = @'

/* ===== v10.36.11 SingleScrollShellAndStaticRailsPass ===== */
.layout,
.layoutWide{
  height: 100vh;
  overflow: hidden;
}

.layoutWide{
  align-items: stretch;
}

.layoutWide .rail,
.layoutWide .activityRail,
.layoutWide .assistantWrap{
  overflow: hidden !important;
  overscroll-behavior: contain;
  contain: layout paint style;
  will-change: auto;
}

.layoutWide .rail{
  position: sticky;
  top: 0;
  height: 100vh;
  max-height: 100vh;
}

.layoutWide .activityRail,
.layoutWide .assistantWrap{
  position: sticky;
  top: 0 !important;
  height: 100vh;
  max-height: 100vh !important;
  padding-bottom: 24px !important;
}

.main{
  height: 100vh !important;
  max-height: 100vh !important;
  min-height: 0;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  contain: layout paint;
}

.panelShell,
.panelMain,
.panelSolo{
  min-height: 0;
}

.layoutWide .main,
.layoutWide .panelMain,
.layoutWide .panelSolo,
.layoutWide .page{
  transform: translateZ(0);
  backface-visibility: hidden;
}

.layoutWide .activityRail .card,
.layoutWide .assistantWrap .card,
.layoutWide .rail .card,
.layoutWide .activityRail .timelineCard,
.layoutWide .activityRail .missionCard{
  transition: none !important;
  animation: none !important;
}

.homieBuddy,
.homieBuddyPanel,
.homieOrb,
.homieOrbRing,
.homieOrbCore,
.homieMemojiOuter,
.homieMemojiInner,
.homieMemojiFx,
.houseAvatar,
.houseShadow,
.houseRug,
.houseAtmosGlow,
.houseFloorGlow{
  transition: none !important;
}

.homieOrb,
.homieOrbRing,
.homieOrbCore,
.homieMemojiOuter.anim.hype,
.homieOrb.speaking .homieMouth,
.homieOrb.listening .homieOrbRing,
.homieOrb.good.skin-lil-homie .homieLilBody,
.homieHouseScene .houseAvatar.skin-lil-homie .homieLilBody,
.homieHouseScene.desk-tea-notes .deskSteam{
  animation: none !important;
}

.homieBuddy,
.homieBuddyPanel,
.layoutWide .activityRail,
.layoutWide .assistantWrap{
  contain: layout paint style;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.layoutWide .activityRail,
.layoutWide .assistantWrap,
.homieBuddyPanel{
  backdrop-filter: none !important;
}

.layoutWide .activityRail .card,
.layoutWide .assistantWrap .card,
.homieBuddyPanel,
.layoutWide .rail,
.layoutWide .activityRail,
.layoutWide .assistantWrap{
  background-image: none !important;
}

.layoutWide .activityRail,
.layoutWide .assistantWrap,
.homieBuddyPanel{
  background-color: rgba(8,12,18,0.96) !important;
}

.layoutWide .main::-webkit-scrollbar{
  width: 10px;
}

.layoutWide .main::-webkit-scrollbar-thumb{
  background: rgba(148,163,184,0.28);
  border-radius: 999px;
}

@media (max-width: 1450px){
  .layoutWide,
  .layout{
    overflow: auto;
    height: auto;
  }

  .layoutWide .rail,
  .layoutWide .activityRail,
  .layoutWide .assistantWrap,
  .main{
    position: relative;
    top: auto !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
}
'@
  $updated = $text.TrimEnd() + "`r`n" + $block.Trim() + "`r`n"
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($stylesPath, $updated, $utf8NoBom)
  Write-Host 'Appended v10.36.11 single-scroll/static-rails CSS block.'
  Write-Host 'Patched styles.css successfully for v10.36.11.'
}

Write-Host 'Restart OddEngine now.'
