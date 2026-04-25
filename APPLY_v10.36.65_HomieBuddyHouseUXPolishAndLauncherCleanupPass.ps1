param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$cssPath = Join-Path $root "ui\src\components\homieRebuild.css"

Write-Host "[v10.36.65_HomieBuddyHouseUXPolishAndLauncherCleanupPass] Applying from $root"

if (!(Test-Path $cssPath)) {
  throw "Missing ui\src\components\homieRebuild.css. Run this from C:\OddEngine."
}

$css = Get-Content $cssPath -Raw

if ($css -notmatch "homieRebuildPanel") {
  throw "homieRebuild.css does not look like the Homie rebuild stylesheet."
}

$backupPath = "$cssPath.bak_v10.36.65"
if (!(Test-Path $backupPath)) {
  Copy-Item $cssPath $backupPath
  Write-Host "Backup created: $backupPath"
}

$start = "/\* ===== v10\.36\.65 Homie Buddy House UX Polish \+ Launcher Cleanup ===== \*/"
$end = "/\* ===== v10\.36\.65 Homie Buddy House UX Polish \+ Launcher Cleanup END ===== \*/"

$css = [regex]::Replace(
  $css,
  "$start[\s\S]*?$end\s*",
  "",
  [System.Text.RegularExpressions.RegexOptions]::Singleline
).TrimEnd()

$block = @'
/* ===== v10.36.65 Homie Buddy House UX Polish + Launcher Cleanup ===== */
/*
  Scope:
  - Homie Buddy floating companion house only
  - CSS-only polish
  - No Trading, CardGODMode, Writers Lounge, backend, or layout-system changes
*/

.homieRebuildDock:has(.homieRebuildPanel){
  right: 16px;
  bottom: 14px;
  align-items: flex-end;
  max-width: min(560px, calc(100vw - 72px));
}

/* When the full Homie house is open, the tiny launcher no longer floats over the OS. */
.homieRebuildDock:has(.homieRebuildPanel) .homieRebuildLauncher{
  opacity: 0 !important;
  pointer-events: none !important;
  transform: translateY(16px) scale(0.72) !important;
  filter: blur(2px);
}

.homieRebuildPanel{
  width: min(540px, calc(100vw - 86px)) !important;
  max-height: calc(100vh - 34px) !important;
  border-radius: 28px !important;
  padding: 18px !important;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}

.homieRebuildPanel::-webkit-scrollbar,
.homieRebuildMessages::-webkit-scrollbar{
  width: 10px;
}

.homieRebuildPanel::-webkit-scrollbar-thumb,
.homieRebuildMessages::-webkit-scrollbar-thumb{
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(121,92,255,0.74), rgba(94,234,242,0.56));
  border: 3px solid rgba(7,10,18,0.72);
}

.homieRebuildPanel::-webkit-scrollbar-track,
.homieRebuildMessages::-webkit-scrollbar-track{
  background: rgba(255,255,255,0.025);
  border-radius: 999px;
}

.homieRebuildHeader{
  position: sticky;
  top: -18px;
  z-index: 12;
  margin: -18px -18px 14px;
  padding: 16px 18px 13px;
  border-radius: 28px 28px 18px 18px;
  background:
    radial-gradient(260px 120px at 12% 0%, rgba(154,230,255,0.08), rgba(154,230,255,0) 70%),
    linear-gradient(180deg, rgba(13,18,32,0.96), rgba(10,13,24,0.82));
  border-bottom: 1px solid rgba(154,230,255,0.10);
  backdrop-filter: blur(18px);
  box-shadow: 0 12px 26px rgba(0,0,0,0.18);
}

.homieRebuildLayout{
  gap: 16px !important;
}

.homieRebuildStage,
.homieRebuildConversation,
.homieRebuildVoice,
.homieFamilyModeSoftLaunchCard,
.homieLegacyToolsSummaryLine,
.homieLegacyToolDisclosure{
  border-radius: 24px !important;
}

.homieRebuildStage{
  padding: 22px 18px 18px !important;
  gap: 13px !important;
  min-height: auto;
  background:
    radial-gradient(360px 220px at 50% 12%, rgba(154,230,255,0.13), rgba(154,230,255,0) 68%),
    radial-gradient(340px 260px at 50% 24%, rgba(255,170,220,0.10), rgba(255,170,220,0) 72%),
    linear-gradient(180deg, rgba(21,24,46,0.92), rgba(12,14,30,0.88)) !important;
}

.homieRebuildStage::before{
  content: "";
  position: absolute;
  inset: 22px 30px auto;
  height: min(390px, 44vh);
  border-radius: 34px;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.012)),
    radial-gradient(circle at 50% 22%, rgba(154,230,255,0.09), rgba(154,230,255,0) 62%);
  border: 1px solid rgba(154,230,255,0.16);
  box-shadow:
    0 18px 60px rgba(0,0,0,0.24) inset,
    0 0 0 1px rgba(255,255,255,0.025) inset;
}

.homieRebuildAura{
  inset: 26px 30px auto 30px !important;
  height: min(420px, 46vh) !important;
  opacity: 0.76 !important;
}

.homieRebuildAvatarWrap{
  min-height: min(390px, 46vh);
  width: 100%;
  display: grid;
  place-items: center;
  position: relative;
  z-index: 2;
  margin-bottom: -4px;
}

.homieRebuildAvatar{
  position: relative;
  z-index: 2;
  max-width: 92%;
  transform-origin: 50% 82%;
}

/* Make the lower info read as cards under the stage instead of random text under a mascot. */
.homieRebuildStageText{
  width: 100%;
  padding: 16px 16px 15px;
  border-radius: 22px;
  border: 1px solid rgba(255,255,255,0.075);
  background:
    radial-gradient(240px 120px at 50% 0%, rgba(154,230,255,0.055), rgba(154,230,255,0) 70%),
    rgba(6,8,18,0.34);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.018) inset;
}

.homieRebuildPresence,
.homiePresenceConsentRow{
  gap: 8px !important;
}

.homieRebuildPresence .badge,
.homiePresenceConsentRow > span,
.homieFamilyFlowReadinessBadge > span{
  min-height: 28px;
  padding: 6px 10px;
}

.homieRebuildMemoryGrid{
  gap: 10px !important;
}

.homieRebuildMemoryCell,
.homieLegacyVaultMini,
.homieFamilyModeStep,
.homieLegacyToolDisclosure,
.homieRebuildVoiceMeta,
.homieRebuildDiagnostics{
  background:
    radial-gradient(180px 80px at 10% 0%, rgba(154,230,255,0.045), rgba(154,230,255,0) 72%),
    rgba(255,255,255,0.038) !important;
  border-color: rgba(154,230,255,0.105) !important;
}

.homieRebuildConversation{
  padding: 18px !important;
}

.homieRebuildMessages{
  max-height: min(260px, 30vh) !important;
  overflow: auto !important;
  padding-right: 4px;
}

.homieCompanionMsg{
  max-width: 100%;
}

.homieCompanionMsg span{
  line-height: 1.42;
}

.homieRebuildComposer{
  grid-template-columns: minmax(0,1fr) auto !important;
  align-items: center;
  gap: 10px !important;
}

.homieRebuildComposer input{
  min-width: 0;
}

.homieRebuildQuickActions{
  gap: 9px !important;
}

.homieRebuildQuickActions .tabBtn,
.homieRebuildVoice .tabBtn{
  min-height: 38px;
}

.homieFamilyModeSoftLaunchCard{
  padding: 16px !important;
}

.homieFamilyModeFirstUseFlow{
  gap: 10px !important;
}

.homieFamilyModeStep{
  min-height: 112px;
  padding: 14px !important;
}

.homieLegacyToolsSummaryLine{
  padding: 15px 16px !important;
}

.homieLegacyToolDisclosure{
  padding: 15px 16px !important;
}

.homieLegacyToolDisclosure > summary.homieLegacyToolSummary{
  min-height: 58px !important;
}

.homieLegacyToolSummaryTitle{
  font-size: 0.94rem !important;
}

.homieLegacyToolSummaryMeta{
  font-size: 0.80rem !important;
}

.homieRebuildVoice{
  padding: 18px !important;
}

.homieRebuildVoiceMeta{
  padding: 16px !important;
  line-height: 1.45;
}

.homieRebuildFooter{
  padding: 2px 2px 0;
  color: rgba(226,238,255,0.72);
}

@media (max-height: 860px){
  .homieRebuildPanel{
    max-height: calc(100vh - 24px) !important;
  }

  .homieRebuildStage{
    padding-top: 18px !important;
  }

  .homieRebuildStage::before{
    height: min(320px, 38vh);
  }

  .homieRebuildAura{
    height: min(340px, 39vh) !important;
  }

  .homieRebuildAvatarWrap{
    min-height: min(330px, 40vh);
  }

  .homieRebuildMessages{
    max-height: 220px !important;
  }

  .homieFamilyModeStep{
    min-height: 96px;
  }
}

@media (max-width: 680px){
  .homieRebuildDock:has(.homieRebuildPanel){
    right: 10px;
    left: 10px;
    bottom: 10px;
    max-width: none;
  }

  .homieRebuildPanel{
    width: 100% !important;
    max-height: calc(100vh - 20px) !important;
  }

  .homieRebuildStage::before{
    inset-left: 18px;
    inset-right: 18px;
  }

  .homieRebuildAvatarWrap{
    min-height: 300px;
  }

  .homieFamilyModeFirstUseFlow{
    grid-template-columns: 1fr !important;
  }

  .homieFamilyModeStep{
    min-height: auto;
  }
}

@media (prefers-reduced-motion: reduce){
  .homieRebuildDock:has(.homieRebuildPanel) .homieRebuildLauncher{
    transition: none !important;
  }
}
/* ===== v10.36.65 Homie Buddy House UX Polish + Launcher Cleanup END ===== */

'@

Set-Content -Path $cssPath -Value ($css + "`r`n`r`n" + $block + "`r`n") -Encoding UTF8

Write-Host "[v10.36.65_HomieBuddyHouseUXPolishAndLauncherCleanupPass] Applied CSS-only Homie house polish."
Write-Host "Touched: ui\src\components\homieRebuild.css"