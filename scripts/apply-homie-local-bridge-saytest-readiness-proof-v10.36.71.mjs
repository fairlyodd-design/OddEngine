import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.71";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) fail("Missing " + label + ": " + filePath);
}

function backup(filePath) {
  const dst = filePath + ".bak_" + VERSION;
  if (!fs.existsSync(dst)) fs.copyFileSync(filePath, dst);
}

function replaceOnce(text, needle, replacement, label) {
  if (!text.includes(needle)) fail("Could not find anchor: " + label);
  return text.replace(needle, replacement);
}

ensureFile(buddyPath, "HomieBuddy.tsx");
ensureFile(cssPath, "homieRebuild.css");
backup(buddyPath);
backup(cssPath);

let buddy = fs.readFileSync(buddyPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

if (!buddy.includes("v10.36.70b checker-safe marker")) {
  fail("Expected v10.36.70b visible bridge hotfix to be applied first.");
}
if (!buddy.includes("callHomieVoiceBridgeProbe") || !buddy.includes("callHomieVoiceBridgeTranscribe")) {
  fail("Direct bridge helpers are missing.");
}

// 1) Add bridge proof state.
if (!buddy.includes("homieBridgeProofStatus")) {
  const stateNeedle = '  const [homieMicPeak, setHomieMicPeak] = useState(0);';
  const stateInsert = [
    stateNeedle,
    '  const [homieBridgeProofStatus, setHomieBridgeProofStatus] = useState("Bridge proof has not run yet.");',
    '  const [homieBridgeDoctorStatus, setHomieBridgeDoctorStatus] = useState("Doctor has not run yet.");',
    '  const [homieBridgeRoundTripStatus, setHomieBridgeRoundTripStatus] = useState("Local STT test has not run yet.");'
  ].join("\n");
  buddy = replaceOnce(buddy, stateNeedle, stateInsert, "bridge proof state");
}

// 2) Add direct doctor and local-bridge say-test helpers.
if (!buddy.includes("v10.36.71 Homie local bridge proof helpers")) {
  const anchor = "  async function runHomieSelectedMicLevelCheck() {";
  const helpers = [
    "  // ===== v10.36.71 Homie local bridge proof helpers =====",
    "  async function runHomieDirectBridgeProof() {",
    "    const baseUrl = normalizeHomieBridgeBaseUrl(externalVoiceBaseUrl || \"http://127.0.0.1:8765\");",
    "    setHomieBridgeProofStatus(\"Checking /health at \" + baseUrl + \"…\");",
    "    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: \"configuring\", externalBridgeMessage: \"Checking direct /health at \" + baseUrl + \"…\" }));",
    "    const health = await homieBridgeFetchJson(baseUrl + \"/health\", { method: \"GET\" }, 8000);",
    "    if (health?.ok) {",
    "      const model = health?.stt?.modelHint || health?.model || \"tiny.en\";",
    "      const message = \"Bridge /health ready at \" + baseUrl + \" using \" + model + \".\";",
    "      setHomieBridgeProofStatus(message);",
    "      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: \"ready\", externalBridgeMessage: message, externalBridgeModel: model, lastErrorCode: \"\", lastErrorMessage: \"\" }));",
    "      return { ok: true, model, message };",
    "    }",
    "    const message = String(health?.error || \"Bridge /health did not answer at \" + baseUrl + \".\");",
    "    setHomieBridgeProofStatus(message);",
    "    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: \"degraded\", externalBridgeMessage: message, lastErrorCode: \"bridge-health-failed\", lastErrorMessage: message }));",
    "    return { ok: false, message };",
    "  }",
    "",
    "  async function runHomieDirectBridgeDoctor() {",
    "    const baseUrl = normalizeHomieBridgeBaseUrl(externalVoiceBaseUrl || \"http://127.0.0.1:8765\");",
    "    setHomieBridgeDoctorStatus(\"Running /doctor at \" + baseUrl + \"…\");",
    "    const doctor = await homieBridgeFetchJson(baseUrl + \"/doctor\", { method: \"GET\" }, 30000);",
    "    if (doctor?.ok) {",
    "      const model = doctor?.model || doctor?.modelHint || \"tiny.en\";",
    "      const message = \"Bridge doctor passed. Python/STT imports are ready\" + (model ? \" for \" + model : \"\") + \".\";",
    "      setHomieBridgeDoctorStatus(message);",
    "      setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: \"ready\", externalBridgeMessage: message, externalBridgeModel: model || prev.externalBridgeModel, lastErrorCode: \"\", lastErrorMessage: \"\" }));",
    "      return { ok: true, message };",
    "    }",
    "    const message = String(doctor?.error || doctor?.detail || \"Bridge doctor failed.\");",
    "    setHomieBridgeDoctorStatus(message);",
    "    setDiagnostics((prev) => ({ ...prev, externalBridgeConfigured: true, externalBridgeBaseUrl: baseUrl, externalBridgeState: \"degraded\", externalBridgeMessage: message, lastErrorCode: \"bridge-doctor-failed\", lastErrorMessage: message }));",
    "    return { ok: false, message };",
    "  }",
    "",
    "  async function runHomieLocalBridgeSayTest() {",
    "    setHomieMicProofStatus(\"Local bridge Say test is recording. Say one short sentence, then wait for Whisper.\");",
    "    setHomieBridgeRoundTripStatus(\"Recording local bridge Say test. Speak now.\");",
    "    setStatus(\"Local bridge Say test is listening — say one short sentence now.\");",
    "    await runHomieDirectBridgeProof();",
    "    await startExternalVoice(false, \"local-bridge-say-test\");",
    "  }",
    "",
    "  // ===== v10.36.71 Homie local bridge proof helpers END =====",
    "",
    anchor
  ].join("\n");
  buddy = replaceOnce(buddy, anchor, helpers, "local bridge proof helpers");
}

// 3) Make Say test route to local bridge when local bridge is active.
const sayButtonOld = '<button className="tabBtn active" onClick={() => { void runHomieMicProofTest(); }}>Say test</button>';
const sayButtonNew = '<button className="tabBtn active" onClick={() => { voiceEngineMode === "external-http" ? void runHomieLocalBridgeSayTest() : void runHomieMicProofTest(); }}>{voiceEngineMode === "external-http" ? "Bridge say test" : "Say test"}</button>';
if (buddy.includes(sayButtonOld)) {
  buddy = buddy.replace(sayButtonOld, sayButtonNew);
} else if (!buddy.includes("Bridge say test")) {
  fail("Could not find Say test button anchor.");
}

// 4) Add bridge proof card under visible bridge controls.
if (!buddy.includes('data-homie-bridge-proof="v10.36.71"')) {
  const visibleControlsEnd = [
    '            <div className="small homieBridgeInlineTip">Bridge tip: your 8765 bridge can be healthy while Homie still says disabled if Cloud voice is selected. Use local bridge flips the saved mode.</div>'
  ].join("\n");

  const proofCard = [
    visibleControlsEnd,
    '            <div className="homieBridgeProofCard" data-homie-bridge-proof="v10.36.71">',
    '              <div className="homieBridgeProofHead">',
    '                <b>Local bridge proof</b>',
    '                <span>{diagnostics.externalBridgeState}</span>',
    '              </div>',
    '              <div className="small"><b>Health:</b> {homieBridgeProofStatus}</div>',
    '              <div className="small"><b>Doctor:</b> {homieBridgeDoctorStatus}</div>',
    '              <div className="small"><b>STT round trip:</b> {homieBridgeRoundTripStatus}</div>',
    '              <div className="assistantChipWrap" style={{ marginTop: 10 }}>',
    '                <button className="tabBtn" onClick={() => void runHomieDirectBridgeProof()}>Check health</button>',
    '                <button className="tabBtn" onClick={() => void runHomieDirectBridgeDoctor()}>Run doctor</button>',
    '                <button className="tabBtn active" onClick={() => void runHomieLocalBridgeSayTest()}>Bridge say test</button>',
    '              </div>',
    '              <div className="small">Heads up: browser Say test uses SpeechRecognition. Bridge say test records audio and sends it to the local 8765 Whisper bridge.</div>',
    '            </div>'
  ].join("\n");
  buddy = replaceOnce(buddy, visibleControlsEnd, proofCard, "bridge proof card");
}

// 5) When bridge transcription returns, update bridge roundtrip proof too.
const externalTranscriptNeedle = 'setStatus("Heard you. I’m answering.");\n      setMood("good");\n      window.setTimeout(() => run(transcript), 90);';
const externalTranscriptReplacement = [
  'setStatus("Bridge heard: " + transcript + ". Answering now.");',
  '      setHomieBridgeRoundTripStatus("Bridge transcript captured: " + transcript);',
  '      setHomieMicProofStatus("Local bridge transcript captured: " + transcript);',
  '      setMood("good");',
  '      window.setTimeout(() => run(transcript), 90);'
].join("\n");
if (buddy.includes(externalTranscriptNeedle)) {
  buddy = buddy.replace(externalTranscriptNeedle, externalTranscriptReplacement);
}

// 6) When transcribe fails, record bridge roundtrip error.
const externalFailNeedle = 'announce(message, "warn", true, "Voice bridge transcription failed.");';
if (buddy.includes(externalFailNeedle) && !buddy.includes('setHomieBridgeRoundTripStatus(message);')) {
  buddy = buddy.replace(externalFailNeedle, 'setHomieBridgeRoundTripStatus(message);\n        ' + externalFailNeedle);
}

// 7) Improve too-short and no-audio feedback.
buddy = buddy.replace(
  'const message = "That voice clip was too short to transcribe reliably. Hold the mic for a beat longer and try again.";',
  'const message = "That local bridge clip was too short to transcribe reliably. Use Bridge say test, speak one short sentence, then wait for Whisper.";'
);
buddy = buddy.replace(
  'announce("No audio was captured before listening stopped.", "warn", true, "No audio captured.");',
  'setHomieBridgeRoundTripStatus("No audio was captured before listening stopped. Hold the mic a beat longer or use Bridge say test.");\n          announce("No audio was captured before listening stopped.", "warn", true, "No audio captured.");'
);

// 8) Auto-proof after flipping bridge.
if (!buddy.includes('runHomieDirectBridgeDoctor();')) {
  buddy = buddy.replace(
    'announce(message + " Use Start listening or Hold to talk now.", "good", true, "Local bridge ready.");',
    'announce(message + " Use Start listening, Hold to talk, or Bridge say test now.", "good", true, "Local bridge ready.");\n      void runHomieDirectBridgeDoctor();'
  );
}

// 9) Marker.
if (!buddy.includes("v10.36.71 checker-safe marker")) {
  buddy = buddy.replace(
    "export default function HomieBuddy",
    "// v10.36.71 checker-safe marker: local bridge say test and readiness proof installed\nexport default function HomieBuddy"
  );
}

fs.writeFileSync(buddyPath, buddy, "utf8");

// CSS.
const cssStart = "/* ===== v10.36.71 Homie Local Bridge Proof Card ===== */";
const cssEnd = "/* ===== v10.36.71 Homie Local Bridge Proof Card END ===== */";
if (css.includes(cssStart) && css.includes(cssEnd)) {
  const s = css.indexOf(cssStart);
  const e = css.indexOf(cssEnd, s) + cssEnd.length;
  css = (css.slice(0, s) + css.slice(e)).trimEnd();
}

const cssBlock = [
  cssStart,
  ".homieBridgeProofCard{",
  "  margin-top: 10px;",
  "  padding: 13px;",
  "  border-radius: 18px;",
  "  border: 1px solid rgba(94,234,242,0.15);",
  "  background:",
  "    radial-gradient(240px 120px at 14% 0%, rgba(94,234,242,0.07), rgba(94,234,242,0) 70%),",
  "    rgba(255,255,255,0.035);",
  "  display: grid;",
  "  gap: 8px;",
  "}",
  ".homieBridgeProofHead{",
  "  display: flex;",
  "  justify-content: space-between;",
  "  align-items: center;",
  "  gap: 12px;",
  "}",
  ".homieBridgeProofHead b{",
  "  color: rgba(242,247,255,0.94);",
  "}",
  ".homieBridgeProofHead span{",
  "  border: 1px solid rgba(94,234,242,0.18);",
  "  border-radius: 999px;",
  "  padding: 5px 9px;",
  "  color: rgba(198,245,255,0.88);",
  "  background: rgba(94,234,242,0.06);",
  "}",
  cssEnd
].join("\n");

css = css.trimEnd() + "\n\n" + cssBlock + "\n";
fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied local bridge say test and readiness proof pass.");
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");
console.log("- ui/src/components/homieRebuild.css");