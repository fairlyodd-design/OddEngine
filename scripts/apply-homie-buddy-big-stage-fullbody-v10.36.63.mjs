
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "v10.36.63";
const PASS = "HomieBuddyBigStageFullBodyCompanionPass";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

const buddyPath = path.join(repoRoot, "ui", "src", "components", "HomieBuddy.tsx");
const cssPath = path.join(repoRoot, "ui", "src", "components", "homieRebuild.css");
mustExist(buddyPath, "HomieBuddy component");
mustExist(cssPath, "Homie rebuild CSS");

const buddyBackup = backup(buddyPath);
const cssBackup = backup(cssPath);

let buddy = fs.readFileSync(buddyPath, "utf8");

const replacement = String.raw`  // ===== v10.36.63 Homie Buddy big full-body companion avatar =====
  const avatarContents = (
    <span className="homieFullBodyCore" data-homie-buddy-fullbody-avatar="v10.36.63" aria-label="Homie full-body companion avatar">
      <span className="homieFullBodyHalo" />
      <span className="homieFullBodyWing left" />
      <span className="homieFullBodyWing right" />
      <span className="homieFullBodyShadow" />
      <span className="homieFullBodyLeg left"><span className="homieFullBodyFoot" /></span>
      <span className="homieFullBodyLeg right"><span className="homieFullBodyFoot" /></span>
      <span className="homieFullBodyArm left"><span className="homieFullBodyHand" /></span>
      <span className="homieFullBodyArm right"><span className="homieFullBodyHand" /></span>
      <span className="homieFullBodyTorso">
        <span className="homieFullBodyChest" />
        <span className="homieFullBodyCoreLight" />
      </span>
      <span className="homieFullBodyNeck" />
      <span className="homieFullBodyHead">
        <span className="homieFullBodyAntenna left"><span /></span>
        <span className="homieFullBodyAntenna right"><span /></span>
        <span className="homieFullBodyFacePlate" />
        <span className="homieFullBodyBrow left" />
        <span className="homieFullBodyBrow right" />
        <span className="homieFullBodyEye left" />
        <span className="homieFullBodyEye right" />
        <span className="homieFullBodyCheek left" />
        <span className="homieFullBodyCheek right" />
        <span className="homieFullBodyMouth" />
      </span>
      <span className="homieFullBodyName">HOMIE</span>
    </span>
  );
  // ===== v10.36.63 Homie Buddy big full-body companion avatar END =====
`;

if (!buddy.includes('data-homie-buddy-fullbody-avatar="v10.36.63"')) {
  const start = buddy.indexOf("  const orbFallbackFace = (");
  const end = buddy.indexOf("  const panel = (", start);
  if (start === -1 || end === -1) fail("Could not find HomieBuddy avatar block anchors.");
  buddy = buddy.slice(0, start) + replacement + "\n" + buddy.slice(end);
}

if (!buddy.includes("v10.36.63 checker-safe marker")) {
  const marker = "// v10.36.63 checker-safe marker: Homie Buddy big-stage full-body companion avatar installed";
  const exportAnchor = "export default function HomieBuddy";
  if (!buddy.includes(exportAnchor)) fail("Could not find HomieBuddy export anchor.");
  buddy = buddy.replace(exportAnchor, `${marker}\n${exportAnchor}`);
}

fs.writeFileSync(buddyPath, buddy, "utf8");

let css = fs.readFileSync(cssPath, "utf8");
const cssBlock = String.raw`

/* ===== v10.36.63 Homie Buddy Big Stage Full-Body Companion ===== */
.homieRebuildPanel{
  width: min(640px, calc(100vw - 110px));
}

.homieRebuildPanel.standalone{
  width: min(100%, 920px);
}

.homieRebuildStage{
  min-height: 468px;
  padding: 24px 18px 18px;
  gap: 13px;
}

.homieRebuildAura{
  inset: 24px 34px auto 34px;
  height: 315px;
  opacity: 1;
  filter: blur(13px) saturate(1.08);
}

.homieRebuildAvatar{
  width: 250px !important;
  height: 318px !important;
  border-radius: 42px !important;
  overflow: visible !important;
  border: 1px solid rgba(154,230,255,0.18) !important;
  background:
    radial-gradient(160px 110px at 50% 22%, rgba(154,230,255,0.17), rgba(154,230,255,0) 68%),
    radial-gradient(180px 120px at 50% 74%, rgba(255,170,220,0.10), rgba(255,170,220,0) 72%),
    linear-gradient(180deg, rgba(22,20,42,0.64), rgba(9,12,23,0.34)) !important;
  box-shadow:
    0 26px 68px rgba(0,0,0,0.48),
    0 0 46px rgba(154,230,255,0.18),
    0 0 80px rgba(255,170,220,0.12) !important;
}

.homieRebuildLauncher{
  width: 96px !important;
  height: 124px !important;
  border-radius: 32px !important;
  overflow: visible !important;
}

.homieFullBodyCore{
  position: absolute;
  inset: 0;
  display: block;
  transform-style: preserve-3d;
  pointer-events: none;
  --homie-body-cyan: #8feaff;
  --homie-body-blue: #38bdf8;
  --homie-body-violet: #a78bfa;
  --homie-body-pink: #ff9fd6;
  --homie-body-gold: #ffd166;
}

.homieRebuildAvatar .homieFullBodyCore{
  transform: translateY(2px) scale(1);
}

.homieRebuildLauncher .homieFullBodyCore{
  transform: translateY(-76px) scale(0.42);
  transform-origin: 50% 50%;
}

.homieFullBodyHalo{
  position:absolute;
  left:50%;
  top:52%;
  width:230px;
  height:260px;
  transform: translate(-50%,-50%);
  border-radius: 999px;
  background:
    radial-gradient(circle at 50% 33%, rgba(143,234,255,0.24), rgba(143,234,255,0) 55%),
    radial-gradient(circle at 50% 72%, rgba(255,159,214,0.13), rgba(255,159,214,0) 65%);
  filter: blur(3px);
  opacity: 0.92;
}

.homieFullBodyShadow{
  position:absolute;
  left:50%;
  bottom:24px;
  width:122px;
  height:22px;
  transform: translateX(-50%);
  border-radius:999px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.52), rgba(0,0,0,0));
}

.homieFullBodyWing{
  position:absolute;
  top:105px;
  width:78px;
  height:118px;
  border-radius: 72% 28% 74% 32%;
  background:
    linear-gradient(145deg, rgba(143,234,255,0.26), rgba(167,139,250,0.08)),
    radial-gradient(circle at 35% 18%, rgba(255,255,255,0.28), rgba(255,255,255,0) 42%);
  border: 1px solid rgba(154,230,255,0.18);
  box-shadow: inset 0 0 18px rgba(255,255,255,0.08), 0 0 22px rgba(154,230,255,0.08);
  opacity: 0.85;
}
.homieFullBodyWing.left{ left:38px; transform: rotate(-18deg) skewY(-6deg); }
.homieFullBodyWing.right{ right:38px; transform: scaleX(-1) rotate(-18deg) skewY(-6deg); }

.homieFullBodyTorso{
  position:absolute;
  left:50%;
  top:145px;
  width:94px;
  height:118px;
  transform: translateX(-50%);
  border-radius: 42px 42px 34px 34px;
  background:
    radial-gradient(circle at 50% 18%, rgba(255,255,255,0.14), rgba(255,255,255,0) 33%),
    linear-gradient(180deg, #232142, #111528 64%, #0b1020);
  border: 1px solid rgba(154,230,255,0.20);
  box-shadow:
    inset 0 8px 22px rgba(255,255,255,0.05),
    inset 0 -14px 24px rgba(0,0,0,0.22),
    0 16px 34px rgba(0,0,0,0.32);
}

.homieFullBodyChest{
  position:absolute;
  left:50%;
  top:14px;
  width:58px;
  height:27px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(143,234,255,0.18), rgba(255,159,214,0.12));
  border: 1px solid rgba(255,255,255,0.08);
}

.homieFullBodyCoreLight{
  position:absolute;
  left:50%;
  top:50px;
  width:24px;
  height:24px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: var(--homie-body-gold);
  box-shadow: 0 0 18px rgba(255,209,102,0.72), 0 0 38px rgba(143,234,255,0.18);
}

.homieFullBodyNeck{
  position:absolute;
  left:50%;
  top:128px;
  width:34px;
  height:32px;
  transform: translateX(-50%);
  border-radius: 16px;
  background: linear-gradient(180deg, #2a2548, #17172b);
  border: 1px solid rgba(154,230,255,0.14);
}

.homieFullBodyHead{
  position:absolute;
  left:50%;
  top:58px;
  width:108px;
  height:98px;
  transform: translateX(-50%);
  border-radius: 46% 46% 42% 42%;
  background:
    radial-gradient(circle at 50% 22%, rgba(255,255,255,0.22), rgba(255,255,255,0) 34%),
    linear-gradient(160deg, #8feaff 0%, #6f7dff 55%, #ff9fd6 100%);
  box-shadow:
    inset 0 -14px 26px rgba(27,18,57,0.28),
    inset 0 12px 26px rgba(255,255,255,0.13),
    0 15px 38px rgba(0,0,0,0.34),
    0 0 38px rgba(143,234,255,0.22);
}

.homieFullBodyFacePlate{
  position:absolute;
  left:50%;
  top:27px;
  width:74px;
  height:45px;
  transform: translateX(-50%);
  border-radius: 28px;
  background: rgba(248,250,252,0.18);
  border: 1px solid rgba(255,255,255,0.19);
  box-shadow: inset 0 0 18px rgba(255,255,255,0.08);
}

.homieFullBodyEye{
  position:absolute;
  top:43px;
  width:12px;
  height:16px;
  border-radius:999px;
  background:#06111f;
  box-shadow: 0 0 0 3px rgba(255,255,255,0.15), 0 0 14px rgba(56,189,248,0.86);
}
.homieFullBodyEye.left{ left:35px; }
.homieFullBodyEye.right{ right:35px; }

.homieFullBodyBrow{
  position:absolute;
  top:34px;
  width:23px;
  height:4px;
  border-radius:999px;
  background: rgba(240,249,255,0.78);
  box-shadow:0 0 9px rgba(143,234,255,0.28);
}
.homieFullBodyBrow.left{ left:28px; transform: rotate(8deg); }
.homieFullBodyBrow.right{ right:28px; transform: rotate(-8deg); }

.homieFullBodyCheek{
  position:absolute;
  top:58px;
  width:14px;
  height:8px;
  border-radius:999px;
  background: rgba(255,159,214,0.38);
  filter: blur(0.2px);
}
.homieFullBodyCheek.left{ left:24px; }
.homieFullBodyCheek.right{ right:24px; }

.homieFullBodyMouth{
  position:absolute;
  left:50%;
  top:66px;
  width:30px;
  height:12px;
  transform: translateX(-50%);
  border-radius: 0 0 999px 999px;
  border-bottom: 4px solid rgba(8,15,29,0.75);
}

.homieFullBodyAntenna{
  position:absolute;
  top:-24px;
  width:36px;
  height:42px;
  border-top: 3px solid rgba(143,234,255,0.78);
  border-radius: 999px 999px 0 0;
}
.homieFullBodyAntenna.left{ left:20px; transform: rotate(-28deg); }
.homieFullBodyAntenna.right{ right:20px; transform: rotate(28deg); }
.homieFullBodyAntenna span{
  position:absolute;
  top:-7px;
  width:11px;
  height:11px;
  border-radius:999px;
  background: var(--homie-body-gold);
  box-shadow: 0 0 14px rgba(255,209,102,0.78);
}
.homieFullBodyAntenna.left span{ left:-2px; }
.homieFullBodyAntenna.right span{ right:-2px; }

.homieFullBodyArm,
.homieFullBodyLeg{
  position:absolute;
  background: linear-gradient(180deg, #2b294f, #111629);
  border:1px solid rgba(154,230,255,0.13);
  box-shadow: inset 0 8px 14px rgba(255,255,255,0.04);
}
.homieFullBodyArm{
  top:160px;
  width:24px;
  height:88px;
  border-radius:999px;
  transform-origin: 50% 10%;
}
.homieFullBodyArm.left{ left:73px; transform: rotate(20deg); }
.homieFullBodyArm.right{ right:73px; transform: rotate(-20deg); }
.homieFullBodyHand{
  position:absolute;
  bottom:-8px;
  left:50%;
  width:26px;
  height:24px;
  transform: translateX(-50%);
  border-radius:999px;
  background: linear-gradient(160deg, var(--homie-body-cyan), var(--homie-body-violet));
  box-shadow: 0 0 16px rgba(143,234,255,0.23);
}
.homieFullBodyLeg{
  top:245px;
  width:24px;
  height:56px;
  border-radius:999px;
}
.homieFullBodyLeg.left{ left:104px; transform: rotate(5deg); }
.homieFullBodyLeg.right{ right:104px; transform: rotate(-5deg); }
.homieFullBodyFoot{
  position:absolute;
  bottom:-8px;
  left:50%;
  width:42px;
  height:18px;
  transform: translateX(-50%);
  border-radius:999px;
  background: linear-gradient(180deg, #2e2b52, #14192b);
  border:1px solid rgba(154,230,255,0.12);
}

.homieFullBodyName{
  position:absolute;
  left:50%;
  top:284px;
  transform: translateX(-50%);
  font-size: 10px;
  letter-spacing: 0.22em;
  font-weight: 900;
  color: rgba(236,248,255,0.78);
  text-shadow: 0 0 11px rgba(143,234,255,0.32);
}

.homieRebuildAvatar.emotion-listening .homieFullBodyEar,
.homieRebuildAvatar.emotion-listening .homieFullBodyCoreLight,
.homieRebuildLauncher.emotion-listening .homieFullBodyCoreLight{
  box-shadow: 0 0 22px rgba(255,209,102,0.92), 0 0 48px rgba(143,234,255,0.28);
}

.homieRebuildAvatar.emotion-speaking .homieFullBodyMouth,
.homieRebuildLauncher.emotion-speaking .homieFullBodyMouth{
  animation: homieFullBodyTalk 420ms ease-in-out infinite;
}

.homieRebuildAvatar.emotion-concerned .homieFullBodyBrow.left,
.homieRebuildLauncher.emotion-concerned .homieFullBodyBrow.left{ transform: rotate(-10deg); }
.homieRebuildAvatar.emotion-concerned .homieFullBodyBrow.right,
.homieRebuildLauncher.emotion-concerned .homieFullBodyBrow.right{ transform: rotate(10deg); }

@media (prefers-reduced-motion: no-preference){
  .homieFullBodyCore{ animation: homieFullBodyBreathe 5.6s ease-in-out infinite; }
  .homieFullBodyWing.left{ animation: homieFullBodyWingLeft 4.8s ease-in-out infinite; }
  .homieFullBodyWing.right{ animation: homieFullBodyWingRight 4.8s ease-in-out infinite; }
  .homieFullBodyAntenna span{ animation: homieFullBodySpark 2.6s ease-in-out infinite; }
  .homieFullBodyEye{ animation: homieFullBodyBlink 7.8s ease-in-out infinite; }
  .homieRebuildAvatar.emotion-listening .homieFullBodyHead,
  .homieRebuildLauncher.emotion-listening .homieFullBodyHead{ animation: homieFullBodyListen 2.2s ease-in-out infinite; }
}

@keyframes homieFullBodyBreathe{
  0%,100%{ translate: 0 0; }
  50%{ translate: 0 -5px; }
}
@keyframes homieFullBodyWingLeft{
  0%,100%{ transform: rotate(-18deg) skewY(-6deg); }
  50%{ transform: rotate(-23deg) skewY(-7deg) translateY(-2px); }
}
@keyframes homieFullBodyWingRight{
  0%,100%{ transform: scaleX(-1) rotate(-18deg) skewY(-6deg); }
  50%{ transform: scaleX(-1) rotate(-23deg) skewY(-7deg) translateY(-2px); }
}
@keyframes homieFullBodySpark{
  0%,100%{ opacity:0.8; transform: scale(1); }
  50%{ opacity:1; transform: scale(1.18); }
}
@keyframes homieFullBodyBlink{
  0%, 46%, 52%, 100%{ transform: scaleY(1); }
  49%{ transform: scaleY(0.16); }
}
@keyframes homieFullBodyListen{
  0%,100%{ transform: translateX(-50%) rotate(-1deg); }
  50%{ transform: translateX(-50%) rotate(1.2deg); }
}
@keyframes homieFullBodyTalk{
  0%,100%{ height:12px; border-bottom-width:4px; }
  50%{ height:19px; border-bottom-width:7px; }
}

@media (max-width: 720px){
  .homieRebuildPanel{ width:min(94vw, 560px); }
  .homieRebuildAvatar{ width:220px !important; height:292px !important; }
  .homieRebuildAvatar .homieFullBodyCore{ transform: translateY(-4px) scale(0.9); }
  .homieRebuildStage{ min-height:430px; }
}
/* ===== v10.36.63 Homie Buddy Big Stage Full-Body Companion END ===== */
`;

if (!css.includes("v10.36.63 Homie Buddy Big Stage Full-Body Companion")) {
  css += cssBlock;
}
fs.writeFileSync(cssPath, css, "utf8");

console.log(`[${VERSION}] ${PASS} applied.`);
console.log(`[${VERSION}] Backup created: ${path.relative(repoRoot, buddyBackup)}`);
console.log(`[${VERSION}] Backup created: ${path.relative(repoRoot, cssBackup)}`);
console.log(`[${VERSION}] Updated: ui/src/components/HomieBuddy.tsx`);
console.log(`[${VERSION}] Updated: ui/src/components/homieRebuild.css`);
console.log(`[${VERSION}] Homie should no longer be a tiny orb/mascot in the buddy rail.`);
