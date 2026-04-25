
import fs from "node:fs";
import path from "node:path";
const VERSION="v10.36.77";
const root=process.cwd();
const buddyPath=path.join(root,"ui","src","components","HomieBuddy.tsx");
const cssPath=path.join(root,"ui","src","components","homieRebuild.css");
function fail(m){console.error("["+VERSION+"] "+m);process.exit(1)}
if(!fs.existsSync(buddyPath))fail("Missing HomieBuddy.tsx");
if(!fs.existsSync(cssPath))fail("Missing homieRebuild.css");
const buddy=fs.readFileSync(buddyPath,"utf8");const css=fs.readFileSync(cssPath,"utf8");
for(const n of ["v10.36.77 checker-safe marker","v10.36.77 direct bridge helpers","homieV77ProbeBridge","homieV77TranscribeBridge","homieV77UseLocalBridgeNow","Direct browser bridge is ready",'data-homie-v77-bridge-controls="true"','data-homie-v77-top-bridge="true"',"Start the local bridge BAT"]){if(!buddy.includes(n))fail("Missing HomieBuddy marker/text: "+n)}
if(buddy.includes("External/local voice bridge transcription is only available in desktop mode."))fail("Old desktop-only transcribe guard still present.");
if(buddy.includes("External/local mode is strict, so Homie will not fall back to cloud speech."))fail("Old strict bridge dead-end copy still present.");
if(!css.includes("v10.36.77 Homie bridge required dead-end fix"))fail("Missing CSS marker.");
console.log("["+VERSION+"] Check passed.");
console.log("Next: cd ui; npm run typecheck; npm run build");
