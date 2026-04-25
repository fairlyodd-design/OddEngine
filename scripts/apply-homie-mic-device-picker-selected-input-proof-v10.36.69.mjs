import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.69";
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

if (!buddy.includes("v10.36.68 checker-safe marker")) {
  fail("Expected v10.36.68 mic proof meter to be applied first.");
}

// ===== Add selected mic device state =====
if (!buddy.includes("homieMicDevices")) {
  const stateNeedle = '  const [homieMicPeak, setHomieMicPeak] = useState(0);';
  const stateInsert = [
    stateNeedle,
    '  const [homieMicDevices, setHomieMicDevices] = useState<Array<{ deviceId: string; label: string }>>([]);',
    '  const [homieSelectedMicDeviceId, setHomieSelectedMicDeviceId] = useState(() => {',
    '    try {',
    '      return localStorage.getItem("oddengine:homie:selected-mic-device:v1") || "";',
    '    } catch {',
    '      return "";',
    '    }',
    '  });',
    '  const [homieMicDeviceStatus, setHomieMicDeviceStatus] = useState("Using system default microphone until you choose one.");'
  ].join("\n");
  buddy = replaceOnce(buddy, stateNeedle, stateInsert, "mic devices state");
}

// ===== Add helpers before v68 meter helpers =====
if (!buddy.includes("v10.36.69 Homie selected mic device helpers")) {
  const helperAnchor = '  // ===== v10.36.68 Homie mic proof meter helpers =====';
  const helpers = [
    '  // ===== v10.36.69 Homie selected mic device helpers =====',
    '  function getSelectedHomieMicLabel() {',
    '    const found = homieMicDevices.find((device) => device.deviceId === homieSelectedMicDeviceId);',
    '    if (found?.label) return found.label;',
    '    if (homieSelectedMicDeviceId) return "selected microphone";',
    '    return "system default microphone";',
    '  }',
    '',
    '  function getHomieMicAudioConstraints(): MediaStreamConstraints {',
    '    if (homieSelectedMicDeviceId) {',
    '      return { audio: { deviceId: { exact: homieSelectedMicDeviceId } }, video: false };',
    '    }',
    '    return { audio: true, video: false };',
    '  }',
    '',
    '  function setHomieSelectedMicDevice(deviceId: string) {',
    '    setHomieSelectedMicDeviceId(deviceId);',
    '    try {',
    '      if (deviceId) localStorage.setItem("oddengine:homie:selected-mic-device:v1", deviceId);',
    '      else localStorage.removeItem("oddengine:homie:selected-mic-device:v1");',
    '    } catch {',
    '      // ignore',
    '    }',
    '    const label = deviceId ? (homieMicDevices.find((device) => device.deviceId === deviceId)?.label || "selected microphone") : "system default microphone";',
    '    setHomieMicDeviceStatus("Selected mic: " + label + ". Run Test selected mic before Say test.");',
    '    setHomieMicProofStatus("Selected mic: " + label + ". Run Test selected mic before Say test.");',
    '  }',
    '',
    '  async function refreshHomieMicDevices(reason = "manual") {',
    '    if (!navigator.mediaDevices?.enumerateDevices) {',
    '      setHomieMicDeviceStatus("Browser cannot list microphones in this runtime.");',
    '      return [] as Array<{ deviceId: string; label: string }>; ',
    '    }',
    '',
    '    try {',
    '      let devices = await navigator.mediaDevices.enumerateDevices();',
    '      let audioInputs = devices.filter((device) => device.kind === "audioinput");',
    '',
    '      const labelsMissing = audioInputs.length > 0 && audioInputs.every((device) => !device.label);',
    '      if (labelsMissing && reason !== "boot" && navigator.mediaDevices?.getUserMedia) {',
    '        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });',
    '        try {',
    '          stream.getTracks().forEach((track) => track.stop());',
    '        } catch {',
    '          // ignore',
    '        }',
    '        devices = await navigator.mediaDevices.enumerateDevices();',
    '        audioInputs = devices.filter((device) => device.kind === "audioinput");',
    '      }',
    '',
    '      const mapped = audioInputs.map((device, index) => ({',
    '        deviceId: device.deviceId,',
    '        label: device.label || ("Microphone " + (index + 1)),',
    '      }));',
    '      setHomieMicDevices(mapped);',
    '',
    '      if (homieSelectedMicDeviceId && !mapped.some((device) => device.deviceId === homieSelectedMicDeviceId)) {',
    '        setHomieSelectedMicDeviceId("");',
    '        try { localStorage.removeItem("oddengine:homie:selected-mic-device:v1"); } catch { /* ignore */ }',
    '      }',
    '',
    '      const status = mapped.length',
    '        ? "Found " + mapped.length + " mic input" + (mapped.length === 1 ? "" : "s") + ". Current: " + getSelectedHomieMicLabel() + "."',
    '        : "No microphone inputs found by the browser."; ',
    '      setHomieMicDeviceStatus(status);',
    '      return mapped;',
    '    } catch (error: any) {',
    '      const message = String(error?.name || "mic-device-refresh-failed") + ": " + String(error?.message || "Could not refresh microphone list.");',
    '      setHomieMicDeviceStatus(message);',
    '      setHomieMicProofStatus(message);',
    '      return [] as Array<{ deviceId: string; label: string }>; ',
    '    }',
    '  }',
    '  // ===== v10.36.69 Homie selected mic device helpers END =====',
    '',
    helperAnchor
  ].join("\n");

  buddy = replaceOnce(buddy, helperAnchor, helpers, "selected mic helpers");
}

// ===== Use selected mic constraints in probe/test/external record =====
buddy = buddy.split("navigator.mediaDevices.getUserMedia({ audio: true, video: false })").join("navigator.mediaDevices.getUserMedia(getHomieMicAudioConstraints())");
buddy = buddy.split("navigator.mediaDevices.getUserMedia({ audio: true })").join("navigator.mediaDevices.getUserMedia(getHomieMicAudioConstraints())");

// ===== Extend startHomieMicLevelProbe with level-only mode =====
buddy = buddy.replace(
  "async function startHomieMicLevelProbe(durationMs = 6500) {",
  'async function startHomieMicLevelProbe(durationMs = 6500, mode: "transcript" | "level-only" = "transcript") {'
);

buddy = buddy.replace(
  'setHomieMicProofStatus("Requesting mic signal. Speak after the browser starts listening.");',
  'setHomieMicProofStatus("Requesting mic signal from " + getSelectedHomieMicLabel() + ". Speak after the browser starts listening.");'
);

const timerNeedle = [
  'homieMicProofTimerRef.current = window.setTimeout(() => {',
  '      finishHomieMicProofWithoutTranscript("timeout");',
  '    }, durationMs);'
].join("\n");

const timerReplacement = [
  'homieMicProofTimerRef.current = window.setTimeout(() => {',
  '      if (mode === "level-only") {',
  '        const peak = homieMicProofPeakRef.current || 0;',
  '        const pct = Math.round(Math.min(1, peak) * 100);',
  '        if (peak > 0.035) {',
  '          setHomieMicProofStatus("Selected mic has signal: " + pct + "% peak from " + getSelectedHomieMicLabel() + ". If Say test still has no transcript, make this mic the Windows default or use the local voice bridge.");',
  '        } else {',
  '          setHomieMicProofStatus("Selected mic shows no useful signal: " + pct + "% peak from " + getSelectedHomieMicLabel() + ". Pick another mic or check Windows input settings.");',
  '        }',
  '        stopHomieMicLevelProbe(true);',
  '      } else {',
  '        finishHomieMicProofWithoutTranscript("timeout");',
  '      }',
  '    }, durationMs);'
].join("\n");

if (buddy.includes(timerNeedle)) {
  buddy = buddy.replace(timerNeedle, timerReplacement);
}

// ===== Add selected mic level test function =====
if (!buddy.includes("runHomieSelectedMicLevelCheck")) {
  const proofTestAnchor = "  async function runHomieMicProofTest() {";
  const fn = [
    '  async function runHomieSelectedMicLevelCheck() {',
    '    setHomieMicProofStatus("Testing selected mic level. Speak normally for five seconds.");',
    '    setStatus("Testing selected mic level — speak normally.");',
    '    homieMicProofActiveRef.current = false;',
    '    try {',
    '      await refreshHomieMicDevices("level-check");',
    '      await startHomieMicLevelProbe(5200, "level-only");',
    '    } catch (error: any) {',
    '      stopHomieMicLevelProbe(true);',
    '      const message = String(error?.message || "Selected mic level test failed.");',
    '      setHomieMicProofStatus(message);',
    '      announce(message, "warn", true, "Selected mic test failed.");',
    '    }',
    '  }',
    '',
    proofTestAnchor
  ].join("\n");
  buddy = replaceOnce(buddy, proofTestAnchor, fn, "selected mic level check");
}

// Refresh devices in Say test before proof.
buddy = buddy.replace(
  "await startHomieMicLevelProbe(7600);",
  'await refreshHomieMicDevices("say-test");\n      await startHomieMicLevelProbe(7600, "transcript");'
);

// The mic proof fallback should mention selected mic.
buddy = buddy.replace(
  'const message = "No useful mic level detected during the proof test. Check Windows input device, browser mic permission, and whether the right microphone is selected."; ',
  'const message = "No useful mic level detected from " + getSelectedHomieMicLabel() + ". Pick another mic, refresh devices, or check Windows input settings."; '
);

// ===== UI: device picker after meter =====
if (!buddy.includes('data-homie-mic-device-picker="v10.36.69"')) {
  const meterEnd = [
    '              <div className="small">Permission means the browser may use the mic. Signal means audio moved. Transcript means Homie actually caught words.</div>',
    '            </div>'
  ].join("\n");

  const devicePicker = [
    '              <div className="small">Permission means the browser may use the mic. Signal means audio moved. Transcript means Homie actually caught words.</div>',
    '            </div>',
    '            <div className="homieMicDevicePicker" data-homie-mic-device-picker="v10.36.69">',
    '              <div className="homieMicDevicePickerHead">',
    '                <b>Mic input</b>',
    '                <span>{homieMicDeviceStatus}</span>',
    '              </div>',
    '              <select',
    '                value={homieSelectedMicDeviceId}',
    '                onChange={(event) => setHomieSelectedMicDevice(event.target.value)}',
    '                aria-label="Choose Homie microphone input"',
    '              >',
    '                <option value="">System default microphone</option>',
    '                {homieMicDevices.map((device) => (',
    '                  <option key={device.deviceId} value={device.deviceId}>{device.label}</option>',
    '                ))}',
    '              </select>',
    '              <div className="assistantChipWrap">',
    '                <button className="tabBtn" onClick={() => void refreshHomieMicDevices("manual")}>Refresh mics</button>',
    '                <button className="tabBtn active" onClick={() => void runHomieSelectedMicLevelCheck()}>Test selected mic</button>',
    '              </div>',
    '              <div className="small">Heads up: browser SpeechRecognition usually listens to the system default mic. If Test selected mic moves but Say test stays blank, set that mic as Windows default or use the local bridge lane.</div>',
    '            </div>'
  ].join("\n");

  buddy = replaceOnce(buddy, meterEnd, devicePicker, "mic device picker after proof meter");
}

// Boot refresh device list.
if (!buddy.includes('refreshHomieMicDevices("boot")')) {
  const effectNeedle = [
    '  useEffect(() => {',
    '    void refreshVoiceDiagnostics();',
    '  }, [voiceEngineMode, externalVoiceBaseUrl]);'
  ].join("\n");
  const effectReplacement = [
    effectNeedle,
    '',
    '  useEffect(() => {',
    '    void refreshHomieMicDevices("boot");',
    '  }, [homieSelectedMicDeviceId]);'
  ].join("\n");
  buddy = replaceOnce(buddy, effectNeedle, effectReplacement, "boot mic device refresh effect");
}

// Visible copy polish.
buddy = buddy.replace(
  "Mic proof has not run yet.",
  "Mic proof has not run yet. Choose a mic, test selected mic, then run Say test."
);
buddy = buddy.replace(
  "Mic reality:</b> Camera is visual only. For hearing, click Say test and watch Last transcript.",
  "Mic reality:</b> Camera is visual only. For hearing, test selected mic first, then Say test and watch Last transcript."
);

// Marker.
if (!buddy.includes("v10.36.69 checker-safe marker")) {
  buddy = buddy.replace(
    "export default function HomieBuddy",
    "// v10.36.69 checker-safe marker: selected mic picker and input proof installed\nexport default function HomieBuddy"
  );
}

fs.writeFileSync(buddyPath, buddy, "utf8");

// ===== CSS =====
const cssStart = "/* ===== v10.36.69 Homie Mic Device Picker ===== */";
const cssEnd = "/* ===== v10.36.69 Homie Mic Device Picker END ===== */";
if (css.includes(cssStart) && css.includes(cssEnd)) {
  const s = css.indexOf(cssStart);
  const e = css.indexOf(cssEnd, s) + cssEnd.length;
  css = (css.slice(0, s) + css.slice(e)).trimEnd();
}

const cssBlock = [
  cssStart,
  ".homieMicDevicePicker{",
  "  margin-top: 10px;",
  "  padding: 12px;",
  "  border-radius: 16px;",
  "  border: 1px solid rgba(255,255,255,0.08);",
  "  background: rgba(255,255,255,0.035);",
  "  display: grid;",
  "  gap: 10px;",
  "}",
  ".homieMicDevicePickerHead{",
  "  display: grid;",
  "  gap: 3px;",
  "}",
  ".homieMicDevicePickerHead b{",
  "  color: rgba(242,247,255,0.92);",
  "}",
  ".homieMicDevicePickerHead span{",
  "  color: rgba(226,238,255,0.68);",
  "  line-height: 1.35;",
  "}",
  ".homieMicDevicePicker select{",
  "  width: 100%;",
  "  min-height: 42px;",
  "  border-radius: 14px;",
  "  border: 1px solid rgba(154,230,255,0.14);",
  "  background: rgba(5,8,18,0.82);",
  "  color: rgba(240,248,255,0.92);",
  "  padding: 0 12px;",
  "  outline: none;",
  "}",
  ".homieMicDevicePicker select:focus{",
  "  border-color: rgba(94,234,242,0.36);",
  "  box-shadow: 0 0 0 3px rgba(94,234,242,0.09);",
  "}",
  cssEnd
].join("\n");

css = css.trimEnd() + "\n\n" + cssBlock + "\n";
fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied Homie selected mic device picker + input proof.");
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");
console.log("- ui/src/components/homieRebuild.css");