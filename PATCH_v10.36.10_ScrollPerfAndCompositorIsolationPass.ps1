$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  $candidates = @()
  if ($PSScriptRoot) { $candidates += $PSScriptRoot }
  if ($PSCommandPath) { $candidates += (Split-Path -Parent $PSCommandPath) }
  $candidates += (Get-Location).Path

  foreach ($base in $candidates) {
    if (-not $base) { continue }
    $dir = $base
    for ($i = 0; $i -lt 5; $i++) {
      $stylesPath = Join-Path $dir 'ui\src\styles.css'
      if (Test-Path -LiteralPath $stylesPath) { return $dir }
      $parent = Split-Path -Parent $dir
      if (-not $parent -or $parent -eq $dir) { break }
      $dir = $parent
    }
  }

  throw 'Could not locate OddEngine repo root (missing ui\\src\\styles.css). Run this from C:\OddEngine or unzip there first.'
}

function Write-Utf8NoBom([string]$path, [string]$text) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
}

$repoRoot = Resolve-RepoRoot
$stylesPath = Join-Path $repoRoot 'ui\src\styles.css'
if (-not (Test-Path -LiteralPath $stylesPath)) {
  throw "Could not find styles.css at $stylesPath"
}

$startMarker = '/* ===== v10.36.10_SCROLL_PERF_AND_COMPOSITOR_ISOLATION_PASS_START ===== */'
$endMarker = '/* ===== v10.36.10_SCROLL_PERF_AND_COMPOSITOR_ISOLATION_PASS_END ===== */'

$perfCss = @'
/* ===== v10.36.10_SCROLL_PERF_AND_COMPOSITOR_ISOLATION_PASS_START ===== */
/* Scroll/compositor isolation: reduce repaint cost in Electron during long-panel scroll */
html, body {
  scroll-behavior: auto;
}

.layout,
.layoutWide,
.main,
.rail,
.panelMain,
.activityRail,
.assistantWrap,
.tradingPanelRoot,
.tableWrap,
.chatWrap,
.writersChat {
  backface-visibility: hidden;
  transform: translateZ(0);
}

.main,
.rail,
.activityRail,
.assistantWrap {
  contain: layout paint style;
  overscroll-behavior: contain;
  will-change: scroll-position;
}

.panelMain,
.tradingPanelRoot,
.grid2,
.tradingSplit,
.quickActionGrid,
.homeGrid,
.homeTop,
.homeBottom,
.homeAppsGrid,
.homeAppsRow {
  contain: layout style;
}

/* Heavy cards below the fold should skip full rendering until needed */
.panelMain > .card,
.panelMain > div > .card,
.tradingPanelRoot > .card,
.tradingPanelRoot .card,
.activityRail .card,
.assistantWrap .card,
.homeMain > .card,
.homeLeft > .card,
.homeBottom > .card,
.writersLeft > .card,
.writersCenter > .card,
.writersRight > .card {
  content-visibility: auto;
  contain-intrinsic-size: 320px 240px;
}

/* Keep sticky side lanes cheaper while center column scrolls */
.activityRail,
.assistantWrap {
  contain: strict;
}

/* Isolate the chart, tables, SVGs, and drawers into their own paint layers */
#trading_chart,
#trading_source,
#trading_contracts,
#trading_drawer,
#trading_ticket,
#trading_plan,
.optionDrawer,
.tableWrap,
.dataTable,
.dataTable tbody,
.dataTable thead,
svg,
iframe {
  contain: layout paint style;
  backface-visibility: hidden;
  transform: translateZ(0);
}

/* Reduce the heaviest glass/shadow pressure while preserving the look */
.card {
  box-shadow: 0 10px 22px rgba(0,0,0,0.18);
  backdrop-filter: blur(6px);
}

.assistantWrap .card,
.activityRail .card,
.panelMain .card,
.heroCard,
.softCard,
.spotlightCard,
.shellHero,
.shellBar,
.brandRailCard {
  box-shadow: 0 8px 18px rgba(0,0,0,0.16);
  backdrop-filter: blur(5px);
}

/* Stop tiny hover transforms from adding extra motion during scroll */
.commandBar .tabBtn:hover,
.tabBtn:hover,
.quickActionCard:hover,
.navItem:hover,
.missionCard:hover,
.timelineCard:hover,
.homeAppTile:hover,
.homeAppGridTile:hover,
.entTile:hover {
  transform: none;
}

/* Long tables and chats should not trigger expensive layout outside themselves */
.tableWrap,
.chatWrap,
.writersChat,
.homeTaskList,
.entRow,
.entList {
  contain: content;
}

/* Sticky helpers and buddy should sit on their own layer, not force center repaints */
.homieBuddy,
.godLayoutBar,
.helpFab,
.activityRail,
.assistantWrap {
  transform: translateZ(0);
}

/* Opening a panel should feel stable, not animated-heavy */
.panelMain {
  animation: none;
}

/* Prefer stable scrollbars so the layout does not wobble */
.main,
.rail,
.activityRail,
.assistantWrap {
  scrollbar-gutter: stable both-edges;
}

/* Small-screen fallback: even cheaper glass */
@media (max-width: 1100px) {
  .card,
  .assistantWrap .card,
  .activityRail .card,
  .panelMain .card {
    backdrop-filter: blur(3px);
    box-shadow: 0 6px 14px rgba(0,0,0,0.14);
  }
}
/* ===== v10.36.10_SCROLL_PERF_AND_COMPOSITOR_ISOLATION_PASS_END ===== */
'@

$stylesText = Get-Content -Raw -LiteralPath $stylesPath
if ($stylesText.Contains($startMarker) -and $stylesText.Contains($endMarker)) {
  $pattern = [regex]::Escape($startMarker) + '[\s\S]*?' + [regex]::Escape($endMarker)
  $stylesText = [regex]::Replace($stylesText, $pattern, $perfCss)
  Write-Host 'Updated existing v10.36.10 perf CSS block.'
} else {
  if (-not $stylesText.EndsWith("`n")) { $stylesText += "`r`n" }
  $stylesText += "`r`n" + $perfCss + "`r`n"
  Write-Host 'Appended v10.36.10 perf CSS block.'
}
Write-Utf8NoBom $stylesPath $stylesText
Write-Host 'Patched styles.css successfully for v10.36.10.'

$activityRailPath = Join-Path $repoRoot 'ui\src\components\ActivityRail.tsx'
if (Test-Path -LiteralPath $activityRailPath) {
  $activityText = Get-Content -Raw -LiteralPath $activityRailPath
  $activityOriginal = $activityText

  if ($activityText -match 'import React, \{ useEffect, useMemo, useState \} from "react";') {
    $activityText = $activityText -replace 'import React, \{ useEffect, useMemo, useState \} from "react";', 'import React, { useEffect, useMemo, useRef, useState } from "react";'
  }

  if ($activityText -notmatch 'const scrollingRef = useRef\(false\);') {
    $activityText = $activityText -replace 'const \[tab, setTab\] = useState<[^\n]+\n', "$0  const scrollingRef = useRef(false);`r`n"
  }

  if ($activityText -notmatch 'window\.addEventListener\("scroll", onScroll, true\)') {
    $scrollHook = @'
  useEffect(() => {
    let settleId: number | null = null;
    const onScroll = () => {
      scrollingRef.current = true;
      if (settleId) window.clearTimeout(settleId);
      settleId = window.setTimeout(() => {
        scrollingRef.current = false;
        setTick((v) => v + 1);
      }, 180);
    };
    window.addEventListener("scroll", onScroll, true);
    return () => {
      if (settleId) window.clearTimeout(settleId);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);
'@
    $activityText = $activityText -replace 'useEffect\(\(\) => \{\s*const id = window\.setInterval\(\(\) => setTick\(\(v\) => v \+ 1\), 2500\);\s*return \(\) => window\.clearInterval\(id\);\s*\}, \[\]\);', "$scrollHook`r`n  useEffect(() => {`r`n    const id = window.setInterval(() => {`r`n      if (!scrollingRef.current) setTick((v) => v + 1);`r`n    }, 4500);`r`n    return () => window.clearInterval(id);`r`n  }, []);"
  }

  if ($activityText -ne $activityOriginal) {
    Write-Utf8NoBom $activityRailPath $activityText
    Write-Host 'Softened ActivityRail live updates for v10.36.10.'
  } else {
    Write-Host 'ActivityRail live-update softening skipped (file shape did not match exactly).'
  }
} else {
  Write-Host 'ActivityRail.tsx not found — skipped rail timer softening.'
}

Write-Host 'Restart OddEngine now.'
