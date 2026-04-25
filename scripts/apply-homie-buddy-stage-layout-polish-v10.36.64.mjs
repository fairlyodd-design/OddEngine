import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.64";
const PASS = "HomieBuddyCompanionStageLayoutPolishPass";
const repoRoot = process.cwd();

function fail(msg) {
  console.error(`[${VERSION}] ${msg}`);
  process.exit(1);
}
function mustExist(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`Missing ${label}: ${filePath}`);
}
function backup(filePath) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dst = `${filePath}.bak_${VERSION}_${ts}`;
  fs.copyFileSync(filePath, dst);
  return dst;
}

const cssPath = path.join(repoRoot, "ui", "src", "components", "homieRebuild.css");
mustExist(cssPath, "Homie rebuild CSS");
const cssBackup = backup(cssPath);
let css = fs.readFileSync(cssPath, "utf8");

const cssBlock = String.raw`

/* ===== v10.36.64 Homie Buddy Companion Stage Layout Polish ===== */
/*
  This is intentionally CSS-only. v10.36.63 gave Homie a body;
  v10.36.64 gives that body a real stage so it stops sitting on top
  of the text, pills, and memory cards.
*/
.homieRebuildPanel{
  width: min(650px, calc(100vw - 104px));
}

.homieRebuildPanel.standalone{
  width: min(100%, 940px);
}

.homieRebuildStage{
  min-height: 545px;
  padding: 22px 18px 18px;
  gap: 12px;
  align-content: start;
}

.homieRebuildStage::before{
  content: "";
  position: absolute;
  left: 18px;
  right: 18px;
  top: 16px;
  height: 342px;
  border-radius: 30px;
  background:
    radial-gradient(210px 145px at 50% 22%, rgba(154,230,255,0.115), rgba(154,230,255,0) 70%),
    radial-gradient(230px 150px at 52% 82%, rgba(255,170,220,0.075), rgba(255,170,220,0) 72%),
    linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012));
  border: 1px solid rgba(154,230,255,0.075);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.012) inset,
    0 18px 42px rgba(0,0,0,0.16);
  pointer-events: none;
}

.homieRebuildAura{
  inset: 18px 28px auto 28px;
  height: 342px;
  opacity: 0.82;
  filter: blur(18px) saturate(1.08);
}

.homieRebuildAvatarWrap{
  width: 100%;
  height: 332px;
  display: grid;
  place-items: center;
  padding-top: 4px;
  margin: 0 0 6px;
  z-index: 2;
}

.homieRebuildAvatar{
  width: 232px !important;
  height: 300px !important;
  transform-origin: 50% 68%;
  margin: 0 auto !important;
}

.homieRebuildAvatar .homieFullBodyCore{
  transform: translateY(2px) scale(0.94);
  transform-origin: 50% 50%;
}

.homieRebuildPresence,
.homiePresenceConsentRow,
.homieRebuildStageText,
.homieRebuildMemoryGrid,
.homieLegacyVaultMini{
  position: relative;
  z-index: 3;
}

.homieRebuildPresence{
  margin-top: 2px;
}

.homiePresenceConsentRow{
  margin-top: -1px;
}

.homieRebuildStageText{
  width: min(100%, 460px);
  margin: 0 auto;
  padding: 10px 12px;
  border-radius: 18px;
  background: rgba(5,9,18,0.22);
  border: 1px solid rgba(255,255,255,0.055);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.012) inset;
}

.homieRebuildStageText .assistantSectionTitle{
  letter-spacing: 0.11em;
}

.homieRebuildMemoryGrid{
  margin-top: 2px;
}

.homieRebuildMemoryCell,
.homieLegacyVaultMini{
  backdrop-filter: blur(9px);
}

.homieFullBodyName{
  top: 278px;
  opacity: 0.82;
}

.homieFullBodyShadow{
  bottom: 28px;
  opacity: 0.72;
}

.homieRebuildLauncher{
  width: 104px !important;
  height: 132px !important;
  border-radius: 34px !important;
}

.homieRebuildLauncher .homieFullBodyCore{
  transform: translateY(-72px) scale(0.45);
  transform-origin: 50% 50%;
}

.homieRebuildLauncher .homieFullBodyName{
  opacity: 0;
}

@media (prefers-reduced-motion: no-preference){
  .homieRebuildAvatar{
    animation: homieFullStageCompanionFloat 6.4s ease-in-out infinite !important;
  }

  .homieRebuildAvatar.emotion-speaking{
    animation: homieFullStageCompanionSpeak 1.28s ease-in-out infinite !important;
  }

  .homieRebuildAvatar.emotion-listening{
    animation: homieFullStageCompanionListen 2.35s ease-in-out infinite !important;
  }
}

@keyframes homieFullStageCompanionFloat{
  0%,100%{ transform: translateY(0) scale(1); }
  50%{ transform: translateY(-4px) scale(1.006); }
}

@keyframes homieFullStageCompanionSpeak{
  0%,100%{ transform: translateY(-1px) scale(1.004); }
  50%{ transform: translateY(-5px) scale(1.012); }
}

@keyframes homieFullStageCompanionListen{
  0%,100%{ transform: translateY(0) rotate(-0.25deg) scale(1.004); }
  50%{ transform: translateY(-5px) rotate(0.35deg) scale(1.015); }
}

@media (max-width: 720px){
  .homieRebuildPanel{ width:min(94vw, 570px); }
  .homieRebuildStage{ min-height: 515px; }
  .homieRebuildStage::before{ height: 315px; }
  .homieRebuildAvatarWrap{ height: 305px; }
  .homieRebuildAvatar{ width: 210px !important; height: 280px !important; }
  .homieRebuildAvatar .homieFullBodyCore{ transform: translateY(-6px) scale(0.88); }
}
/* ===== v10.36.64 Homie Buddy Companion Stage Layout Polish END ===== */
`;

if (!css.includes("v10.36.64 Homie Buddy Companion Stage Layout Polish")) {
  css += cssBlock;
}

fs.writeFileSync(cssPath, css, "utf8");
console.log(`[${VERSION}] ${PASS} applied.`);
console.log(`[${VERSION}] Backup created: ${path.relative(repoRoot, cssBackup)}`);
console.log(`[${VERSION}] Updated: ui/src/components/homieRebuild.css`);
console.log(`[${VERSION}] CSS-only polish: avatar stage spacing, reserved avatar area, no text overlap.`);
