
import fs from "node:fs";
import path from "node:path";
const VERSION="v10.36.73";
const root=process.cwd();
const buddyPath=path.join(root,"ui","src","components","HomieBuddy.tsx");
const coachPath=path.join(root,"ui","src","lib","homieCompanionCoach.ts");
const cssPath=path.join(root,"ui","src","components","homieRebuild.css");
const batPath=path.join(root,"RUN_HOMIE_VOICE_BRIDGE_HIGH_ACCURACY_v10.36.73.bat");
function fail(m){console.error(`[${VERSION}] ${m}`);process.exit(1)}
function must(p,l){if(!fs.existsSync(p))fail(`Missing ${l}: ${p}`)}
function backup(p){const b=p+`.bak_${VERSION}`; if(!fs.existsSync(b))fs.copyFileSync(p,b)}
function count(t,n){return t.split(n).length-1}
function matchBrace(t,o){let d=0,q="",e=false;for(let i=o;i<t.length;i++){let c=t[i]; if(q){ if(e){e=false;continue} if(c==="\\"){e=true;continue} if(c===q)q=""; continue } if(c==='"'||c==="'"||c==='`'){q=c;continue} if(c==='{')d++; if(c==='}'){d--; if(d===0)return i}} return -1}
function span(t,name){let idx=-1,pat=""; for(const p of [`async function ${name}`,`function ${name}`]){let n=t.indexOf(p); if(n>=0&&(idx<0||n<idx)){idx=n;pat=p}} if(idx<0)return null; let s=idx; while(s>0&&t[s-1]!=="\n")s--; let o=t.indexOf("{",idx+pat.length); if(o<0)return null; let c=matchBrace(t,o); if(c<0)return null; let e=c+1; while(e<t.length&&/[ \t\r\n]/.test(t[e]))e++; return {s,e}}
function dedupe(t,name){let removed=0; while(count(t,`function ${name}`)+count(t,`async function ${name}`)>1){const sp=span(t,name); if(!sp)break; t=t.slice(0,sp.s)+t.slice(sp.e); removed++} return [t,removed]}
function insertBefore(t,anchor,block,label){if(!t.includes(anchor))fail(`Missing anchor for ${label}`); return t.replace(anchor,block+"\n\n"+anchor)}
function removeDesktopGuard(t){return t.replace(/    if \(!api\.voiceBridgeTranscribe\) \{[\s\S]*?      return;\r?\n    \}\r?\n\r?\n    try \{/,"    try {")}

must(buddyPath,"HomieBuddy.tsx"); must(coachPath,"homieCompanionCoach.ts"); must(cssPath,"homieRebuild.css");
backup(buddyPath); backup(coachPath); backup(cssPath);
let buddy=fs.readFileSync(buddyPath,"utf8");
let coach=fs.readFileSync(coachPath,"utf8");
let css=fs.readFileSync(cssPath,"utf8");

const names=["normalizeHomieBridgeBaseUrl","isDesktopBridgeUnavailable","homieBridgeFetchJson","callHomieVoiceBridgeProbe","callHomieVoiceBridgeTranscribe"];
for(const n of names){[buddy]=dedupe(buddy,n)}

if(!buddy.includes("function normalizeHomieBridgeBaseUrl")){
 const anchor="  async function getExternalBridgeReadiness(force = false, baseState?: VoiceDiagnostics) {";
 const block=`  // ===== v10.36.73 direct browser bridge helpers =====
  function normalizeHomieBridgeBaseUrl(baseUrl: string) {
    return String(baseUrl || "http://127.0.0.1:8765").trim().replace(/\\/+$/, "") || "http://127.0.0.1:8765";
  }
  function isDesktopBridgeUnavailable(result: any) {
    const hay = String(result?.error || result?.message || result?.detail || "").toLowerCase();
    return hay.includes("not available in browser") || hay.includes("not available") || hay.includes("desktop mode");
  }
  async function homieBridgeFetchJson(url: string, init: RequestInit = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), Math.max(1500, timeoutMs));
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch {}
      if (!res.ok) return { ok: false, error: "HTTP " + res.status + " from " + url, detail: text || res.statusText };
      return parsed && typeof parsed === "object" ? parsed : { ok: true, text };
    } catch (error: any) {
      return { ok: false, error: String(error?.name || "fetch-failed") + ": " + String(error?.message || "Could not reach " + url) };
    } finally { window.clearTimeout(timer); }
  }
  async function callHomieVoiceBridgeProbe(payload: any) {
    let desktopResult: any = null;
    try { desktopResult = await api.voiceBridgeProbe?.(payload); } catch (error: any) { desktopResult = { ok:false, error:String(error?.message || error || "Desktop bridge probe failed.") }; }
    if (desktopResult?.ok) return desktopResult;
    if (api.isDesktop?.() && !isDesktopBridgeUnavailable(desktopResult)) return desktopResult || { ok:false, error:"Desktop bridge probe failed." };
    const baseUrl = normalizeHomieBridgeBaseUrl(payload?.baseUrl || externalVoiceBaseUrl);
    const health = await homieBridgeFetchJson(baseUrl + "/health", { method:"GET" }, Math.min(Number(payload?.timeoutMs || externalVoiceTimeoutMs || 8000), 10000));
    if (health?.ok) return { ...health, ok:true, status:"ready", detail:"Direct browser bridge is ready at " + baseUrl + ".", model:health?.stt?.modelHint || health?.model || "", browserDirect:true };
    return { ...(health || {}), ok:false, error:health?.error || "Direct browser bridge did not answer at " + baseUrl + ".", browserDirect:true };
  }
  async function callHomieVoiceBridgeTranscribe(payload: any) {
    let desktopResult: any = null;
    try { desktopResult = await api.voiceBridgeTranscribe?.(payload); } catch (error: any) { desktopResult = { ok:false, error:String(error?.message || error || "Desktop bridge transcribe failed.") }; }
    if (desktopResult?.ok) return desktopResult;
    if (api.isDesktop?.() && !isDesktopBridgeUnavailable(desktopResult)) return desktopResult || { ok:false, error:"Desktop bridge transcribe failed." };
    const baseUrl = normalizeHomieBridgeBaseUrl(payload?.baseUrl || externalVoiceBaseUrl);
    return await homieBridgeFetchJson(baseUrl + "/transcribe", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ audioBase64:payload?.audioBase64 || "", mimeType:payload?.mimeType || "audio/webm" }) }, Math.max(Number(payload?.timeoutMs || externalVoiceTimeoutMs || 120000), 120000));
  }
  // ===== v10.36.73 direct browser bridge helpers END =====`;
 buddy=insertBefore(buddy,anchor,block,"bridge helpers");
}

if(!buddy.includes("homieBridgeProofStatus")){
 const a='  const [diagnostics, setDiagnostics] = useState<VoiceDiagnostics>(() => createBaseDiagnostics());';
 buddy=buddy.replace(a,a+'\n  const [homieBridgeProofStatus, setHomieBridgeProofStatus] = useState("Bridge proof has not run yet.");\n  const [homieBridgeDoctorStatus, setHomieBridgeDoctorStatus] = useState("Doctor has not run yet.");\n  const [homieBridgeRoundTripStatus, setHomieBridgeRoundTripStatus] = useState("Local STT test has not run yet.");');
}

if(!buddy.includes("runHomieLocalBridgeSayTest")){
 const anchor="  async function getExternalBridgeReadiness(force = false, baseState?: VoiceDiagnostics) {";
 const block=`  // ===== v10.36.73 bridge proof controls =====
  async function runHomieDirectBridgeProof() {
    const baseUrl = normalizeHomieBridgeBaseUrl(externalVoiceBaseUrl || "http://127.0.0.1:8765");
    setHomieBridgeProofStatus("Checking /health at " + baseUrl + "…");
    const health = await homieBridgeFetchJson(baseUrl + "/health", { method: "GET" }, 8000);
    if (health?.ok) {
      const model = health?.stt?.modelHint || health?.model || "tiny.en";
      const message = "Bridge /health ready at " + baseUrl + " using " + model + ".";
      setHomieBridgeProofStatus(message);
      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "ready", externalBridgeMessage: message, externalBridgeModel: model, lastErrorCode: "", lastErrorMessage: "" }));
      return { ok: true, message };
    }
    const message = String(health?.error || "Bridge /health did not answer.");
    setHomieBridgeProofStatus(message);
    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "bridge-health-failed", lastErrorMessage: message }));
    return { ok: false, message };
  }
  async function runHomieDirectBridgeDoctor() {
    const baseUrl = normalizeHomieBridgeBaseUrl(externalVoiceBaseUrl || "http://127.0.0.1:8765");
    setHomieBridgeDoctorStatus("Running /doctor at " + baseUrl + "…");
    const doctor = await homieBridgeFetchJson(baseUrl + "/doctor", { method: "GET" }, 30000);
    if (doctor?.ok) {
      const model = doctor?.model || doctor?.modelHint || "tiny.en";
      const message = "Bridge doctor passed. Python/STT imports are ready" + (model ? " for " + model : "") + ".";
      setHomieBridgeDoctorStatus(message);
      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "ready", externalBridgeMessage: message, externalBridgeModel: model || prev.externalBridgeModel, lastErrorCode: "", lastErrorMessage: "" }));
      return { ok: true, message };
    }
    const message = String(doctor?.error || doctor?.detail || "Bridge doctor failed.");
    setHomieBridgeDoctorStatus(message);
    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "bridge-doctor-failed", lastErrorMessage: message }));
    return { ok: false, message };
  }
  async function activateHomieLocalBridgeNow() {
    const baseUrl = normalizeHomieBridgeBaseUrl(externalVoiceBaseUrl || "http://127.0.0.1:8765");
    persistHomiePrefs({ homieVoiceEngineMode: "external-http", homieExternalVoiceBaseUrl: baseUrl, homieExternalVoiceTimeoutMs: 120000 } as any);
    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "configuring", externalBridgeMessage: "Checking local bridge at " + baseUrl + "…", lastErrorCode: "", lastErrorMessage: "" }));
    await runHomieDirectBridgeProof();
    void runHomieDirectBridgeDoctor();
  }
  async function runHomieLocalBridgeSayTest() {
    setHomieBridgeRoundTripStatus("Recording local bridge Say test. Speak one clear sentence, then click Stop listening.");
    setStatus("Bridge say test is listening — speak one clear sentence, then click Stop listening.");
    await runHomieDirectBridgeProof();
    await startExternalVoice(false, "local-bridge-say-test");
  }
  // ===== v10.36.73 bridge proof controls END =====`;
 buddy=insertBefore(buddy,anchor,block,"bridge proof helpers");
}

buddy=buddy.replace(/    if \(!api\.voiceBridgeProbe \|\| !wantsExternalVoice\(\)\) \{[\s\S]*?      return \{ ok: false, status: nextState, message \};\r?\n    \}\r?\n\r?\n    setDiagnostics/,`    if (!wantsExternalVoice()) {
      const message = "External/local bridge is idle because Homie is set to cloud mode. Click Use local bridge to use 127.0.0.1:8765.";
      const nextState = "disabled";
      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: false, externalBridgeBaseUrl: externalVoiceBaseUrl, externalBridgeState: nextState, externalBridgeMessage: message, externalBridgeModel: "" }));
      if (!silent) announce(message, "idle", true, "Local bridge is idle because cloud voice is selected.");
      return { ok: false, status: nextState, message };
    }

    setDiagnostics`);
buddy=buddy.replace('const result = await api.voiceBridgeProbe({ baseUrl: externalVoiceBaseUrl, timeoutMs: Math.min(externalVoiceTimeoutMs, 8000) });','const result = await callHomieVoiceBridgeProbe({ baseUrl: externalVoiceBaseUrl, timeoutMs: Math.min(externalVoiceTimeoutMs, 8000) });');
buddy=buddy.replace('const result = await api.voiceBridgeTranscribe({ baseUrl: externalVoiceBaseUrl, timeoutMs: externalVoiceTimeoutMs, mimeType: blob.type || "audio/webm", audioBase64 });','const result = await callHomieVoiceBridgeTranscribe({ baseUrl: externalVoiceBaseUrl, timeoutMs: externalVoiceTimeoutMs, mimeType: blob.type || "audio/webm", audioBase64 });');
buddy=removeDesktopGuard(buddy);
buddy=buddy.replace('setStatus("Heard you. I’m answering.");\n      setMood("good");\n      window.setTimeout(() => run(transcript), 90);','setStatus("Bridge heard: " + transcript + ". Answering now.");\n      setHomieBridgeRoundTripStatus("Bridge transcript captured: " + transcript);\n      setMood("good");\n      window.setTimeout(() => run(transcript), 90);');
buddy=buddy.replace('announce(message, "warn", true, "Voice bridge transcription failed.");','setHomieBridgeRoundTripStatus(message);\n        announce(message, "warn", true, "Voice bridge transcription failed.");');
buddy=buddy.replace('const message = "That voice clip was too short to transcribe reliably. Hold the mic for a beat longer and try again.";','const message = "That local bridge clip was too short to transcribe reliably. Use Bridge say test, speak one clear sentence, then click Stop listening.";');

if(!buddy.includes('data-homie-top-bridge-button="v10.36.73"')){
 const v='<button className={`tabBtn ${voiceEnabled ? "active" : ""}`';
 const b='            <button className={`tabBtn ${voiceEngineMode === "external-http" ? "active" : ""}`} data-homie-top-bridge-button="v10.36.73" onClick={() => void activateHomieLocalBridgeNow()}>{voiceEngineMode === "external-http" ? "Bridge on" : "Use bridge"}</button>\n';
 const i=buddy.indexOf(v); if(i>=0) buddy=buddy.slice(0,i)+b+buddy.slice(i);
}
if(!buddy.includes('data-homie-bridge-say-test="v10.36.73"')){
 const button='<button className="tabBtn active" data-homie-bridge-say-test="v10.36.73" onClick={() => { voiceEngineMode === "external-http" ? void runHomieLocalBridgeSayTest() : void startVoice(false, true, false, false, "mic-proof"); }}>{voiceEngineMode === "external-http" ? "Bridge say test" : "Say test"}</button>';
 const self='<button className="tabBtn" onClick={() => void runHomieRuntimeSelfCheck("quick")}>Self check</button>';
 buddy=buddy.replace(self,button+'\n            '+self);
}
const bridgeLine='<div className="small"><b>Bridge:</b> {diagnostics.externalBridgeState} • {diagnostics.externalBridgeBaseUrl}</div>';
if(buddy.includes(bridgeLine)&&!buddy.includes('data-homie-visible-bridge-controls="v10.36.73"')){
 const ui=bridgeLine+`\n            <div className="homieVisibleBridgeControls assistantChipWrap" data-homie-visible-bridge-controls="v10.36.73">
              <button className={\`tabBtn ${voiceEngineMode === "external-http" ? "active" : ""}\`} onClick={() => void activateHomieLocalBridgeNow()}>Use local bridge</button>
              <button className="tabBtn" onClick={() => void runHomieDirectBridgeProof()}>Check health</button>
              <button className="tabBtn" onClick={() => void runHomieDirectBridgeDoctor()}>Run doctor</button>
              <button className="tabBtn active" onClick={() => void runHomieLocalBridgeSayTest()}>Bridge say test</button>
              <button className={\`tabBtn ${voiceEngineMode === "cloud" ? "active" : ""}\`} onClick={() => { persistHomiePrefs({ homieVoiceEngineMode: "cloud" } as any); announce("Cloud voice mode is on. Local bridge is idle.", "idle", true, "Cloud voice mode."); void refreshVoiceDiagnostics(); }}>Cloud mode</button>
            </div>
            <div className="homieBridgeProofCard" data-homie-bridge-proof="v10.36.73">
              <div className="homieBridgeProofHead"><b>Local bridge proof</b><span>{diagnostics.externalBridgeState}</span></div>
              <div className="small"><b>Health:</b> {homieBridgeProofStatus}</div>
              <div className="small"><b>Doctor:</b> {homieBridgeDoctorStatus}</div>
              <div className="small"><b>STT round trip:</b> {homieBridgeRoundTripStatus}</div>
              <div className="small">Use Bridge say test for local 8765 Whisper/STT. Browser Say test is only SpeechRecognition.</div>
            </div>`;
 buddy=buddy.replace(bridgeLine,ui);
}

for(const n of names){const c=count(buddy,`function ${n}`)+count(buddy,`async function ${n}`); if(c>1)fail(`Duplicate bridge helper remains: ${n} count=${c}`)}
if(!buddy.includes('v10.36.73 checker-safe marker')) buddy=buddy.replace('export default function HomieBuddy','// v10.36.73 checker-safe marker: true bridge say test and dedupe installed\nexport default function HomieBuddy');
fs.writeFileSync(buddyPath,buddy,'utf8');

coach=coach.replaceAll('Useful read: keep Homie as an informational family/OS companion first — explain, organize, remember, route panels, and help with practical next moves. Save the deep support voice for when you explicitly ask for grounding.','Useful read: I can explain, organize, route panels, remember notes, or help pick the next move.');
coach=coach.replaceAll('Got you — companion mode.','Got you.');
coach=coach.replaceAll('Hell yeah — that’s the right direction.','Anytime, Homie. I’m here and listening.');
if(!coach.includes('v10.36.73 checker-safe marker')) coach='// v10.36.73 checker-safe marker: natural STT reply trim installed\n'+coach;
fs.writeFileSync(coachPath,coach,'utf8');

const cssBlock=`\n\n/* ===== v10.36.73 Homie Bridge Proof UI ===== */
.homieVisibleBridgeControls{margin-top:10px;margin-bottom:8px;padding:10px;border-radius:16px;border:1px solid rgba(94,234,242,.14);background:rgba(94,234,242,.045)}
.homieBridgeProofCard{margin-top:10px;padding:13px;border-radius:18px;border:1px solid rgba(94,234,242,.15);background:radial-gradient(240px 120px at 14% 0%,rgba(94,234,242,.07),rgba(94,234,242,0) 70%),rgba(255,255,255,.035);display:grid;gap:8px}
.homieBridgeProofHead{display:flex;justify-content:space-between;align-items:center;gap:12px}
.homieBridgeProofHead span{border:1px solid rgba(94,234,242,.18);border-radius:999px;padding:5px 9px;color:rgba(198,245,255,.88);background:rgba(94,234,242,.06)}
/* ===== v10.36.73 Homie Bridge Proof UI END ===== */\n`;
if(!css.includes('v10.36.73 Homie Bridge Proof UI')) fs.writeFileSync(cssPath,css+cssBlock,'utf8');

fs.writeFileSync(batPath,["@echo off","setlocal","cd /d \"%~dp0\"","echo ========================================","echo   Homie Voice Bridge HIGH ACCURACY","echo ========================================","echo This uses HOMIE_WHISPER_MODEL=base.en instead of tiny.en.","echo If port 8765 is already in use, close the old bridge window first.","set HOMIE_WHISPER_MODEL=base.en","set HOMIE_VOICE_PORT=8765","node backend_scaffold\\homie-voice-bridge.mjs","pause"].join("\r\n"),"utf8");
console.log(`[${VERSION}] Applied true bridge say test and dedupe finalizer.`);
