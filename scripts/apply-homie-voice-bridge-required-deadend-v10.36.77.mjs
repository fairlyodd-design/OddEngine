
import fs from "node:fs";
import path from "node:path";
const VERSION="v10.36.77";
const root=process.cwd();
const buddyPath=path.join(root,"ui","src","components","HomieBuddy.tsx");
const cssPath=path.join(root,"ui","src","components","homieRebuild.css");
function fail(m){console.error("["+VERSION+"] "+m);process.exit(1)}
function ensure(p,l){if(!fs.existsSync(p))fail("Missing "+l+": "+p)}
function backup(p){const b=p+".bak_"+VERSION;if(!fs.existsSync(b))fs.copyFileSync(p,b)}
function findMatchingBrace(t,o){let d=0,q="",e=false,lc=false,bc=false;for(let i=o;i<t.length;i++){const c=t[i],n=t[i+1];if(lc){if(c==="\n")lc=false;continue}if(bc){if(c==="*"&&n==="/"){bc=false;i++}continue}if(q){if(e){e=false;continue}if(c==="\\"){e=true;continue}if(c===q)q="";continue}if(c==="/"&&n==="/"){lc=true;i++;continue}if(c==="/"&&n==="*"){bc=true;i++;continue}if(c==='"'||c==="'"||c==='`'){q=c;continue}if(c==="{")d++;if(c==="}"){d--;if(d===0)return i}}return-1}
function span(t,name){let s=t.indexOf("function "+name+"(");let a=t.indexOf("async function "+name+"(");if(s<0)s=a;else if(a>=0)s=Math.min(s,a);if(s<0)return null;let ls=s;while(ls>0&&t[ls-1]!=="\n")ls--;const o=t.indexOf("{",s);if(o<0)return null;const c=findMatchingBrace(t,o);if(c<0)return null;let end=c+1;while(end<t.length&&/[ \t\r\n]/.test(t[end]))end++;return{start:ls,end}}
function replaceFn(t,name,body){const sp=span(t,name);if(!sp)fail("Could not find function "+name);return t.slice(0,sp.start)+body.trimEnd()+"\n\n"+t.slice(sp.end)}
function before(t,anchor,block,label){if(!t.includes(anchor))fail("Missing anchor for "+label);return t.replace(anchor,block.trimEnd()+"\n\n"+anchor)}
ensure(buddyPath,"HomieBuddy.tsx");ensure(cssPath,"homieRebuild.css");backup(buddyPath);backup(cssPath);
let buddy=fs.readFileSync(buddyPath,"utf8");let css=fs.readFileSync(cssPath,"utf8");
if(!buddy.includes("export default function HomieBuddy"))fail("HomieBuddy shape not recognized");
if(!buddy.includes("function wantsExternalVoice"))fail("Missing wantsExternalVoice");
if(!buddy.includes("async function probeExternalVoice"))fail("Missing probeExternalVoice");
if(!buddy.includes("async function transcribeExternalBlob"))fail("Missing transcribeExternalBlob");
if(!buddy.includes("v10.36.77 direct bridge helpers")){
const helpers=`
  // ===== v10.36.77 direct bridge helpers =====
  function homieV77BridgeBaseUrl(baseUrl: string) {
    return String(baseUrl || "http://127.0.0.1:8765").trim().replace(/\\/+$/, "") || "http://127.0.0.1:8765";
  }
  function homieV77BridgeError(errorLike: any, baseUrl: string) {
    const raw = String(errorLike || "Bridge did not answer.");
    const lower = raw.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("abort")) {
      return "Local voice bridge is not reachable at " + baseUrl + ". Start the bridge BAT, keep that window open, then click Probe 8765.";
    }
    return classifyExternalBridgeError(raw, baseUrl);
  }
  async function homieV77FetchJson(url: string, init: RequestInit = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), Math.max(2000, timeoutMs));
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
      if (!res.ok) return { ok: false, error: "HTTP " + res.status + " from " + url, detail: text || res.statusText };
      return parsed && typeof parsed === "object" ? parsed : { ok: true, text };
    } catch (error: any) {
      return { ok: false, error: String(error?.name || "fetch-failed") + ": " + String(error?.message || "Could not reach " + url) };
    } finally { window.clearTimeout(timer); }
  }
  async function homieV77ProbeBridge(baseUrl = externalVoiceBaseUrl, timeoutMs = 12000) {
    const cleanBase = homieV77BridgeBaseUrl(baseUrl);
    const result = await homieV77FetchJson(cleanBase + "/health", { method: "GET" }, timeoutMs);
    if (result?.ok) return { ...result, ok: true, status: "ready", baseUrl: cleanBase, detail: result.detail || "Direct browser bridge is ready at " + cleanBase + ".", model: result?.stt?.modelHint || result?.model || result?.sttModel || "", browserDirect: true };
    return { ...(result || {}), ok: false, status: "degraded", baseUrl: cleanBase, error: homieV77BridgeError(result?.error || result?.detail, cleanBase), browserDirect: true };
  }
  async function homieV77TranscribeBridge(payload: any) {
    const cleanBase = homieV77BridgeBaseUrl(payload?.baseUrl || externalVoiceBaseUrl);
    const result = await homieV77FetchJson(cleanBase + "/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audioBase64: payload?.audioBase64 || "", mimeType: payload?.mimeType || "audio/webm" }) }, Math.max(Number(payload?.timeoutMs || externalVoiceTimeoutMs || 180000), 180000));
    return { ...(result || {}), browserDirect: true };
  }
  async function homieV77UseLocalBridgeNow() {
    const baseUrl = homieV77BridgeBaseUrl(externalVoiceBaseUrl || "http://127.0.0.1:8765");
    persistHomiePrefs({ homieVoiceEngineMode: "external-http", homieExternalVoiceBaseUrl: baseUrl, homieExternalVoiceTimeoutMs: 180000 } as any);
    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "configuring", externalBridgeMessage: "Checking local bridge at " + baseUrl + "…", lastErrorCode: "", lastErrorMessage: "" }));
    const result = await homieV77ProbeBridge(baseUrl, 12000);
    if (result?.ok) {
      const message = result.detail || "Local voice bridge is ready at " + baseUrl + ".";
      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "ready", externalBridgeMessage: message, externalBridgeModel: result.model || prev.externalBridgeModel || "", lastErrorCode: "", lastErrorMessage: "" }));
      announce(message + " Now use Bridge say test.", "good", true, "Local bridge ready.");
      return;
    }
    const message = result?.error || "Local bridge did not answer at " + baseUrl + ".";
    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "bridge-unreachable", lastErrorMessage: message }));
    announce(message, "warn", true, "Local bridge not reachable.");
  }
  // ===== v10.36.77 direct bridge helpers END =====`;
buddy=before(buddy,"  async function getExternalBridgeReadiness(force = false, baseState?: VoiceDiagnostics) {",helpers,"v77 helpers");
}
const probe=`
  async function probeExternalVoice(silent = false, baseState?: VoiceDiagnostics) {
    const current = baseState || diagnostics;
    const baseUrl = homieV77BridgeBaseUrl(externalVoiceBaseUrl || "http://127.0.0.1:8765");
    if (!wantsExternalVoice()) {
      const message = "External/local bridge is idle because Homie is set to cloud mode. Click Use local bridge to use 127.0.0.1:8765.";
      setDiagnostics((prev) => ({ ...prev, ...current, externalBridgeConfigured: false, externalBridgeBaseUrl: baseUrl, externalBridgeState: "disabled", externalBridgeMessage: message, externalBridgeModel: "" }));
      if (!silent) announce(message, "idle", true, "Local bridge is idle.");
      return { ok: false, status: "disabled", message };
    }
    setDiagnostics((prev) => ({ ...prev, ...current, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "configuring", externalBridgeMessage: "Checking " + baseUrl + "…", lastErrorCode: "", lastErrorMessage: "" }));
    let result: any = null;
    try { if (api.voiceBridgeProbe) result = await api.voiceBridgeProbe({ baseUrl, timeoutMs: Math.min(externalVoiceTimeoutMs, 12000) }); }
    catch (error: any) { result = { ok: false, error: String(error?.message || error || "Desktop bridge probe failed.") }; }
    if (!result?.ok) result = await homieV77ProbeBridge(baseUrl, 12000);
    if (result?.ok) {
      const message = result.detail || "Direct browser bridge is ready at " + baseUrl + ".";
      setDiagnostics((prev) => ({ ...prev, ...current, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "ready", externalBridgeMessage: message, externalBridgeModel: result.model || prev.externalBridgeModel || "", lastErrorCode: "", lastErrorMessage: "" }));
      if (!silent) announce(message, "good", true, "Voice bridge ready.");
      return { ok: true, status: "ready", message, model: result.model || "" };
    }
    const message = homieV77BridgeError(result?.error || result?.detail || "External/local voice bridge did not respond.", baseUrl);
    setDiagnostics((prev) => ({ ...prev, ...current, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: "degraded", externalBridgeMessage: message, externalBridgeModel: "", lastErrorCode: "external-bridge-unreachable", lastErrorMessage: message, activeRecognitionMode: "idle" }));
    if (!silent) announce(message, "warn", true, "Voice bridge not reachable.");
    return { ok: false, status: "degraded", message };
  }`;
buddy=replaceFn(buddy,"probeExternalVoice",probe);
const transcribe=`
  async function transcribeExternalBlob(blob: Blob, source = "homie") {
    if (blob.size < HOMIE_VOICE_MIN_AUDIO_BLOB_BYTES) {
      const message = "That voice clip was too short to transcribe reliably. Use Bridge say test, speak one clear full sentence, then click Stop listening.";
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "ready", externalBridgeMessage: message, lastErrorCode: "external-clip-too-short", lastErrorMessage: message, activeRecognitionMode: "idle" }));
      announce(message, "warn", true, "Voice clip too short.");
      return;
    }
    try {
      const baseUrl = homieV77BridgeBaseUrl(externalVoiceBaseUrl || "http://127.0.0.1:8765");
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "transcribing", externalBridgeMessage: "Transcribing with " + baseUrl + "…", activeRecognitionMode: "external" }));
      const audioBase64 = await blobToBase64(blob);
      let result: any = null;
      try { if (api.voiceBridgeTranscribe) result = await api.voiceBridgeTranscribe({ baseUrl, timeoutMs: externalVoiceTimeoutMs, mimeType: blob.type || "audio/webm", audioBase64 }); }
      catch (error: any) { result = { ok: false, error: String(error?.message || error || "Desktop bridge transcribe failed.") }; }
      if (!result?.ok) result = await homieV77TranscribeBridge({ baseUrl, timeoutMs: externalVoiceTimeoutMs, mimeType: blob.type || "audio/webm", audioBase64 });
      if (!result?.ok || !result.text) {
        const message = homieV77BridgeError(result?.error || result?.detail || "External/local voice bridge returned no transcript.", baseUrl);
        setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "external-transcribe-failed", lastErrorMessage: message, activeRecognitionMode: "idle" }));
        announce(message, "warn", true, "Voice bridge transcription failed.");
        return;
      }
      const transcript = String(result.text || "").trim();
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "ready", externalBridgeMessage: result.detail || "External/local voice bridge ready at " + baseUrl + ".", externalBridgeModel: result.model || prev.externalBridgeModel, lastTranscript: transcript || prev.lastTranscript, lastErrorCode: "", lastErrorMessage: "", activeRecognitionMode: "idle" }));
      if (!transcript) { announce("The bridge heard audio but returned an empty transcript.", "warn", true, "No transcript returned."); return; }
      emitVoiceStatus({ source, status: "transcript", message: "Heard: " + transcript, transcript, mode: "external" });
      setStatus("Bridge heard: " + transcript + ". Answering now.");
      setMood("good");
      window.setTimeout(() => run(transcript), 90);
    } catch (error: any) {
      const code = String(error?.name || "external-transcribe-error");
      const message = homieV77BridgeError(code + ": " + String(error?.message || "External/local transcription failed."), externalVoiceBaseUrl);
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: code, lastErrorMessage: message, activeRecognitionMode: "idle" }));
      announce(message, "warn", true, "Voice bridge issue.");
    }
  }`;
buddy=replaceFn(buddy,"transcribeExternalBlob",transcribe);
buddy=buddy.replace('const message = `${probe.message} External/local mode is strict, so Homie will not fall back to cloud speech.`;','const message = `${probe.message} Start the local bridge BAT, keep that window open, then click Probe 8765. Or click Cloud mode if you want browser speech instead.`;');
buddy=buddy.replaceAll("Voice bridge required.","Voice bridge not reachable.");
if(!buddy.includes('data-homie-v77-bridge-controls="true"')){
const line='<div className="small"><b>Bridge:</b> {diagnostics.externalBridgeState} • {diagnostics.externalBridgeBaseUrl}</div>';
const controls=[line,'            <div className="assistantChipWrap homieV77BridgeControls" data-homie-v77-bridge-controls="true">','              <button className={`tabBtn ${voiceEngineMode === "external-http" ? "active" : ""}`} onClick={() => void homieV77UseLocalBridgeNow()}>Use local bridge + check</button>','              <button className="tabBtn" onClick={() => void probeExternalVoice(false)}>Probe 8765</button>','              <button className={`tabBtn ${voiceEngineMode === "cloud" ? "active" : ""}`} onClick={() => { persistHomiePrefs({ homieVoiceEngineMode: "cloud" } as any); announce("Cloud mode is on. Local bridge is idle.", "idle", true, "Cloud mode."); void refreshVoiceDiagnostics(); }}>Cloud mode</button>','            </div>','            <div className="small homieV77BridgeHelp">If Homie says bridge not reachable: run the voice bridge BAT in a separate PowerShell and keep it open.</div>'].join("\n");
if(buddy.includes(line))buddy=buddy.replace(line,controls);
}
if(!buddy.includes('data-homie-v77-top-bridge="true"')){
const start='<button className={`tabBtn ${voiceEnabled ? "active" : ""}`';
const btn='            <button className={`tabBtn ${voiceEngineMode === "external-http" ? "active" : ""}`} data-homie-v77-top-bridge="true" onClick={() => void homieV77UseLocalBridgeNow()}>{voiceEngineMode === "external-http" ? "Bridge on" : "Use bridge"}</button>\n';
const i=buddy.indexOf(start);if(i!==-1)buddy=buddy.slice(0,i)+btn+buddy.slice(i);
}
if(!buddy.includes("v10.36.77 checker-safe marker"))buddy=buddy.replace("export default function HomieBuddy","// v10.36.77 checker-safe marker: direct bridge probe/transcribe and bridge-required dead-end fix installed\nexport default function HomieBuddy");
fs.writeFileSync(buddyPath,buddy,"utf8");
const cssStart="/* ===== v10.36.77 Homie bridge required dead-end fix ===== */";const cssEnd="/* ===== v10.36.77 Homie bridge required dead-end fix END ===== */";
while(css.includes(cssStart)&&css.includes(cssEnd)){const s=css.indexOf(cssStart);const e=css.indexOf(cssEnd,s)+cssEnd.length;css=(css.slice(0,s)+css.slice(e)).trimEnd()}
css += "\n\n"+[cssStart,'.homieV77BridgeControls{margin-top:10px;margin-bottom:8px;padding:10px;border-radius:16px;border:1px solid rgba(94,234,242,0.14);background:rgba(94,234,242,0.045);}','.homieV77BridgeHelp{color:rgba(226,238,255,0.68);line-height:1.4;}',cssEnd].join("\n")+"\n";
fs.writeFileSync(cssPath,css,"utf8");
console.log("["+VERSION+"] Applied bridge-required dead-end fix.");
console.log("Touched:\n- ui/src/components/HomieBuddy.tsx\n- ui/src/components/homieRebuild.css");
