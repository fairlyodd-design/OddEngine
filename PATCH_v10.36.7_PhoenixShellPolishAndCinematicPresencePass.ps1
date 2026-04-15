    $ErrorActionPreference = "Stop"

    function Resolve-RepoRoot {
      $scriptDir = $null
      if ($PSScriptRoot) {
        $scriptDir = $PSScriptRoot
      } elseif ($PSCommandPath) {
        $scriptDir = Split-Path -Parent $PSCommandPath
      } elseif ($MyInvocation -and $MyInvocation.MyCommand -and $MyInvocation.MyCommand.Path) {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
      }

      $cwd = $null
      try { $cwd = (Get-Location).Path } catch { $cwd = $null }

      $candidates = @(
        $scriptDir,
        $cwd,
        $(if ($scriptDir) { Split-Path $scriptDir -Parent } else { $null }),
        $(if ($cwd) { Split-Path $cwd -Parent } else { $null })
      ) | Where-Object { $_ } | Select-Object -Unique

      foreach ($candidate in $candidates) {
        $stylePath = Join-Path $candidate "ui\src\styles.css"
        if (Test-Path -LiteralPath $stylePath) {
          return $candidate
        }
      }

      throw "Could not find ui\src\styles.css from any candidate root. Checked: $($candidates -join ', ')"
    }

    $repoRoot = Resolve-RepoRoot
    $stylePath = Join-Path $repoRoot "ui\src\styles.css"

    $styleText = Get-Content -Raw -LiteralPath $stylePath
    $styleText = $styleText -replace "`r`n", "`n"

    $markerStart = "/* === v10.36.7_PHOENIX_SHELL_POLISH_AND_CINEMATIC_PRESENCE_PASS_BEGIN === */"
    $markerEnd = "/* === v10.36.7_PHOENIX_SHELL_POLISH_AND_CINEMATIC_PRESENCE_PASS_END === */"

    $patchBlock = @'
    /* === v10.36.7_PHOENIX_SHELL_POLISH_AND_CINEMATIC_PRESENCE_PASS_BEGIN === */
@keyframes phoenixGradientDrift{
  0%{ transform: translate3d(-2%, -1%, 0) scale(1); opacity: 0.28; }
  50%{ transform: translate3d(2%, 1%, 0) scale(1.04); opacity: 0.38; }
  100%{ transform: translate3d(-1%, 2%, 0) scale(1.02); opacity: 0.30; }
}

@keyframes phoenixSheenSweep{
  0%{ transform: translateX(-48%) rotate(14deg); opacity: 0; }
  12%{ opacity: 0.16; }
  54%{ opacity: 0.20; }
  100%{ transform: translateX(60%) rotate(14deg); opacity: 0; }
}

@keyframes phoenixSoftFloat{
  0%,100%{ transform: translateY(0px); }
  50%{ transform: translateY(-2px); }
}

.layoutWide .main{
  isolation: isolate;
}

.layoutWide .main::before{
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  z-index:0;
  background:
    radial-gradient(900px 360px at 18% 0%, rgba(255,88,200,0.10) 0%, rgba(255,88,200,0) 65%),
    radial-gradient(820px 320px at 82% 8%, rgba(94,234,242,0.08) 0%, rgba(94,234,242,0) 62%),
    radial-gradient(860px 320px at 52% 100%, rgba(255,209,102,0.06) 0%, rgba(255,209,102,0) 65%);
  animation: phoenixGradientDrift 22s ease-in-out infinite;
  mix-blend-mode: screen;
}

.layoutWide .main > *,
.layoutWide .rail > *,
.layoutWide .activityRail > *{
  position: relative;
  z-index: 1;
}

.shellHero,
.shellBar,
.brandRailCard,
.commandBar,
.activityRail .card,
.assistantWrap,
.panelMain > .card{
  position: relative;
  overflow: hidden;
  border-color: rgba(121,87,255,0.26);
  box-shadow:
    0 18px 48px rgba(0,0,0,0.34),
    0 0 0 1px rgba(255,255,255,0.02) inset,
    0 0 34px rgba(143,98,255,0.08);
}

.shellHero::before,
.shellBar::before,
.brandRailCard::before,
.commandBar::before,
.activityRail .card::before,
.assistantWrap::before,
.panelMain > .card::before{
  content:"";
  position:absolute;
  top:-20%;
  bottom:-20%;
  left:-20%;
  width: 48%;
  pointer-events:none;
  background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.06), rgba(94,234,242,0.10), rgba(255,255,255,0));
  filter: blur(10px);
  opacity: 0;
  animation: phoenixSheenSweep 18s linear infinite;
}

.shellHero{
  box-shadow:
    0 22px 56px rgba(0,0,0,0.36),
    0 0 0 1px rgba(255,255,255,0.03) inset,
    0 0 46px rgba(255,88,200,0.10);
}

.shellBar{
  box-shadow:
    0 18px 42px rgba(0,0,0,0.30),
    0 0 0 1px rgba(255,255,255,0.03) inset,
    0 0 28px rgba(94,234,242,0.08);
}

.shellTitle,
.shellBarTitle,
.brandWord{
  text-shadow:
    0 0 18px rgba(255,88,200,0.10),
    0 0 28px rgba(94,234,242,0.08);
  letter-spacing: 0.01em;
}

.shellEyebrow,
.shellBarEyebrow,
.assistantSectionTitle,
.assistantTitle{
  letter-spacing: 0.14em;
}

.brandLogo,
.shellLogo{
  filter:
    drop-shadow(0 0 14px rgba(255,88,200,0.12))
    drop-shadow(0 0 24px rgba(94,234,242,0.08));
}

.commandBar,
.assistantWrap,
.activityRail .card{
  backdrop-filter: blur(14px);
}

.panelMain > .card,
.assistantWrap .card,
.activityRail .card,
.navItem,
.tabBtn,
button,
.homeAppTile,
.homeAppGridTile,
.homeTickerTile,
.missionCard,
.timelineCard{
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    filter 160ms ease,
    background 160ms ease;
}

.panelMain > .card:hover,
.assistantWrap .card:hover,
.activityRail .card:hover{
  transform: translateY(-2px);
  border-color: rgba(94,234,242,0.22);
  box-shadow:
    0 24px 56px rgba(0,0,0,0.38),
    0 0 0 1px rgba(255,255,255,0.03) inset,
    0 0 44px rgba(94,234,242,0.09);
}

.brandRailCard:hover,
.shellHero:hover,
.shellBar:hover{
  transform: translateY(-1px);
}

.tabBtn:hover,
button:hover{
  filter: brightness(1.06) saturate(1.05);
}

.tabBtn.active{
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.03) inset,
    0 0 18px rgba(94,234,242,0.10);
}

.hudNavSearch input,
.commandBar input,
input,
textarea,
select{
  box-shadow: 0 0 0 1px rgba(255,255,255,0.01) inset;
}

.hudNavSearch input:focus,
.commandBar input:focus,
input:focus,
textarea:focus,
select:focus{
  outline: none;
  border-color: rgba(94,234,242,0.28);
  box-shadow:
    0 0 0 2px rgba(94,234,242,0.12),
    0 0 22px rgba(94,234,242,0.06);
}

.panelMain{
  gap: 14px;
}

.activityRail .card,
.assistantWrap{
  animation: phoenixSoftFloat 9s ease-in-out infinite;
}

.activityRail .card:nth-child(2n),
.panelMain > .card:nth-child(2n){
  animation-delay: 1.4s;
}

.homeHeroCard,
.homePulseCard,
.homeSavingsDeck{
  border-color: rgba(255,255,255,0.10);
  background:
    radial-gradient(720px 260px at 0% 0%, rgba(255,88,200,0.08) 0%, rgba(0,0,0,0) 55%),
    radial-gradient(720px 260px at 100% 0%, rgba(94,234,242,0.08) 0%, rgba(0,0,0,0) 55%),
    rgba(8,12,18,0.30);
}

.homeTickerTile,
.homeAppTile,
.homeAppGridTile,
.homeZoneCard,
.homeHubCard{
  box-shadow: 0 10px 24px rgba(0,0,0,0.16);
}

.activityRail{
  scrollbar-width: thin;
  scrollbar-color: rgba(143,98,255,0.45) rgba(255,255,255,0.04);
}

*::-webkit-scrollbar{
  width: 10px;
  height: 10px;
}

*::-webkit-scrollbar-track{
  background: rgba(255,255,255,0.03);
  border-radius: 999px;
}

*::-webkit-scrollbar-thumb{
  background: linear-gradient(180deg, rgba(143,98,255,0.55), rgba(94,234,242,0.45));
  border-radius: 999px;
  border: 2px solid rgba(8,12,18,0.35);
}

*::-webkit-scrollbar-thumb:hover{
  background: linear-gradient(180deg, rgba(255,88,200,0.62), rgba(94,234,242,0.52));
}

@media(max-width: 980px){
  .shellHero,
  .shellBar,
  .brandRailCard{
    box-shadow:
      0 16px 36px rgba(0,0,0,0.28),
      0 0 0 1px rgba(255,255,255,0.03) inset;
  }

  .panelMain > .card:hover,
  .assistantWrap .card:hover,
  .activityRail .card:hover{
    transform: translateY(-1px);
  }
}
/* === v10.36.7_PHOENIX_SHELL_POLISH_AND_CINEMATIC_PRESENCE_PASS_END === */

'@
    $patchBlock = $patchBlock -replace "`r`n", "`n"

    if ($styleText.Contains($markerStart) -and $styleText.Contains($markerEnd)) {
      $pattern = [regex]::Escape($markerStart) + "[\s\S]*?" + [regex]::Escape($markerEnd)
      $styleText = [regex]::Replace($styleText, $pattern, $patchBlock)
    } else {
      $styleText = $styleText.TrimEnd() + "`n`n" + $patchBlock + "`n"
    }

    $outText = $styleText -replace "`n", "`r`n"
    Set-Content -LiteralPath $stylePath -Value $outText -NoNewline -Encoding utf8

    Write-Host "Patched styles.css successfully for v10.36.7."
    Write-Host "Restart OddEngine now."
