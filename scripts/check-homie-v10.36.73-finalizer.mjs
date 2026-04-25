
import fs from "node:fs"; import path from "node:path";
const VERSION="v10.36.73"; const root=process.cwd();
const buddyPath=path.join(root,"ui","src","components","HomieBuddy.tsx");
const coachPath=path.join(root,"ui","src","lib","homieCompanionCoach.ts");
const cssPath=path.join(root,"ui","src","components","homieRebuild.css");
const batPath=path.join(root,"RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.73.bat");
function fail(m){console.error(`[${VERSION}] ${m}`);process.exit(1)}
function count(t,n){return t.split(n).length-1}
for(const p of [buddyPath,coachPath,cssPath,batPath]) if(!fs.existsSync(p)) fail(`Missing ${p}`);
const buddy=fs.readFileSync(buddyPath,"utf8"), coach=fs.readFileSync(coachPath,"utf8"), css=fs.readFileSync(cssPath,"utf8"), bat=fs.readFileSync(batPath,"utf8");
for(const n of ["normalizeHomieBridgeBaseUrl","isDesktopBridgeUnavailable","homieBridgeFetchJson","callHomieVoiceBridgeProbe","callHomieVoiceBridgeTranscribe"]){const c=count(buddy,`function ${n}`)+count(buddy,`async function ${n}`); if(c!==1) fail(`Expected one ${n}, found ${c}`)}
for(const s of ["v10.36.73 checker-safe marker","runHomieLocalBridgeSayTest","activateHomieLocalBridgeNow",'data-homie-bridge-say-test="v10.36.73"','data-homie-visible-bridge-controls="v10.36.73"','data-homie-bridge-proof="v10.36.73"',"Bridge transcript captured"]){if(!buddy.includes(s)) fail(`Missing HomieBuddy marker: ${s}`)}
if(buddy.includes("External/local voice bridge transcription is only available in desktop mode.")) fail("Old desktop-only transcribe guard remains");
if(!coach.includes("v10.36.73 checker-safe marker")) fail("Missing coach marker");
if(coach.includes("Useful read: keep Homie as an informational family/OS companion first")) fail("Old repetitive boilerplate remains");
if(!css.includes("v10.36.73 Homie Bridge Proof UI")) fail("Missing CSS marker");
if(!bat.includes("HOMIE_WHISPER_MODEL=base.en")) fail("High accuracy bridge starter missing base.en");
console.log(`[${VERSION}] Check passed.`); console.log("Next: cd ui; npm run typecheck; npm run build");
