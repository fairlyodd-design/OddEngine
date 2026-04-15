$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += $PSScriptRoot }
  if ($PSCommandPath) { $candidates += (Split-Path -Parent $PSCommandPath) }
  $candidates += (Get-Location).Path

  foreach ($base in $candidates) {
    if (-not $base) { continue }
    $tryPaths = @(
      $base,
      (Join-Path $base 'C:\OddEngine'),
      (Join-Path $base '..'),
      (Join-Path $base '..\..')
    )
    foreach ($p in $tryPaths) {
      try {
        $full = [System.IO.Path]::GetFullPath($p)
      } catch {
        continue
      }
      if (Test-Path (Join-Path $full 'ui\src\styles.css')) {
        return $full
      }
    }
  }

  if (Test-Path 'C:\OddEngine\ui\src\styles.css') { return 'C:\OddEngine' }
  throw 'Could not find C:\OddEngine\ui\src\styles.css'
}

$repoRoot = Resolve-RepoRoot
$stylesPath = Join-Path $repoRoot 'ui\src\styles.css'
$styles = Get-Content -Raw -LiteralPath $stylesPath
$marker = '/* v10.36.10d Right rail breathing + docked buddy freeze pass */'

if ($styles.Contains($marker)) {
  Write-Host 'v10.36.10d CSS block already present.'
  Write-Host 'Restart OddEngine now.'
  exit 0
}

$block = @'

/* v10.36.10d Right rail breathing + docked buddy freeze pass */
.layoutWide,
.panelShell,
.activityRail,
.assistantWrap,
.homieBuddy,
.homieBuddyPanel,
.homieOrb,
.homieOrbCore,
.homieOrbRing,
.homieMemojiOuter,
.homieMemojiInner,
.homieMemojiFx,
.homieRiveWrap,
.homieRiveClip,
.homieRiveCanvas,
.houseAvatar,
.houseShadow,
.houseRug {
  will-change: auto !important;
}

.activityRail,
.assistantWrap,
.homieBuddyPanel,
.activityRail .card,
.activityRail .timelineCard,
.activityRail .missionCard {
  backdrop-filter: none !important;
  filter: none !important;
  transform: none !important;
  transition: none !important;
}

.activityRail,
.assistantWrap {
  contain: layout paint style !important;
  isolation: isolate !important;
  backface-visibility: hidden !important;
  transform: translateZ(0) !important;
}

.activityRail .card,
.activityRail .timelineCard,
.activityRail .missionCard,
.homieBuddyPanel {
  background: linear-gradient(180deg, rgba(10,14,22,0.98), rgba(8,12,18,0.98)) !important;
  box-shadow: 0 8px 18px rgba(0,0,0,0.18) !important;
}

.activityRail .card:hover,
.activityRail .timelineCard:hover,
.activityRail .missionCard:hover,
.activityRail .tabBtn:hover,
.homieBuddyPanel .tabBtn:hover {
  transform: none !important;
}

.homieBuddy {
  transform: translateZ(0) !important;
  contain: layout paint style !important;
  isolation: isolate !important;
}

.homieOrb,
.homieOrb.good,
.homieOrb.warn,
.homieOrb.listening,
.homieOrb.speaking,
.homieOrbRing,
.homieOrbRing.ringTwo,
.homieOrb.speaking .homieMouth,
.homieOrb.speaking:not(.skin-lil-homie) .homieOrbBrow,
.homieOrb:not(.skin-lil-homie) .homieEye,
.homieOrb:not(.skin-lil-homie) .homieEye::after,
.homieMemojiOuter.anim.hype,
.homieMemojiOuter.emote-fistbump .homieMemojiFx,
.homieMemojiOuter.emote-celebrate .homieMemojiFx,
.homieMemojiOuter.emote-alert .homieMemojiFx,
.homieMemojiOuter.emote-facepalm .homieMemojiFx,
.homieHouseScene .houseAvatar.skin-lil-homie .homieLilBody,
.homieOrb.good.skin-lil-homie .homieLilBody,
.homieOrb.speaking.skin-lil-homie .homieLilHead,
.homieOrb.speaking.skin-lil-homie .homieLilBody,
.homieOrb.listening.skin-lil-homie .homieLilArm.left,
.homieOrb.listening.skin-lil-homie .homieLilArm.right,
.deskSteam {
  animation: none !important;
}

.homieOrb,
.homieOrbCore,
.homieMemojiOuter,
.homieMemojiInner,
.homieMemojiFx,
.houseAvatar,
.houseShadow,
.houseRug,
.houseFloorGlow,
.houseAtmosGlow,
.houseDeskSurface,
.houseWallFeature,
.homieHouseScene,
.homieHouseRoom,
.homieStatusLine,
.homieHouseSummary,
.homieBuddyPanel,
.homieBuddyPanel * {
  transition: none !important;
}

.homieOrb,
.homieOrbCore,
.homieMemojiOuter,
.homieMemojiInner,
.homieMemojiFx,
.houseAvatar,
.houseShadow,
.houseRug {
  transform: none !important;
}

.homieOrb,
.homieBuddyPanel {
  box-shadow: 0 10px 22px rgba(0,0,0,0.26) !important;
}

.homieOrbRing,
.homieMemojiFx,
.houseAtmosGlow,
.houseFloorGlow,
.houseRug {
  opacity: 0.18 !important;
}

.activityRail,
.homieBuddy,
.homieBuddyPanel,
.homieOrb {
  opacity: 1 !important;
}

@media (prefers-reduced-motion: no-preference) {
  .activityRail,
  .assistantWrap,
  .homieBuddy,
  .homieBuddyPanel,
  .homieOrb,
  .homieOrbCore,
  .homieOrbRing,
  .houseAvatar,
  .houseShadow,
  .houseRug {
    scroll-behavior: auto !important;
  }
}
'@

[System.IO.File]::WriteAllText($stylesPath, ($styles + $block), [System.Text.UTF8Encoding]::new($false))
Write-Host 'Appended v10.36.10d right-rail freeze CSS block.'
Write-Host 'Patched styles.css successfully for v10.36.10d.'
Write-Host 'Restart OddEngine now.'
