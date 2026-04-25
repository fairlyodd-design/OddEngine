import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.68";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");
const coachPath = path.join(root, "ui", "src", "lib", "homieCompanionCoach.ts");

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
ensureFile(coachPath, "homieCompanionCoach.ts");

backup(buddyPath);
backup(cssPath);
backup(coachPath);

let buddy = fs.readFileSync(buddyPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");
let coach = fs.readFileSync(coachPath, "utf8");

if (!buddy.includes("export default function HomieBuddy")) fail("HomieBuddy.tsx shape not recognized.");
if (!buddy.includes("homieCameraPresenceStatus")) fail("HomieBuddy camera lane anchor missing.");
if (!coach.includes("buildHomieCompanionReply")) fail("homieCompanionCoach.ts shape not recognized.");

// ===== State + refs =====
if (!buddy.includes("homieMicProofStatus")) {
  const cameraStatusNeedle = '  const [homieCameraPresenceStatus, setHomieCameraPresenceStatus] = useState("Camera is off. Camera is visual only; use mic buttons for hearing. No video is saved.");';
  const fallbackNeedle = '  const [homieCameraPresenceStatus, setHomieCameraPresenceStatus] = useState("Camera is off. Camera opens only when clicked. No video is analyzed or saved.");';
  const needle = buddy.includes(cameraStatusNeedle) ? cameraStatusNeedle : fallbackNeedle;
  const insert = [
    needle,
    '  const [homieMicProofStatus, setHomieMicProofStatus] = useState("Mic proof has not run yet.");',
    '  const [homieMicLevel, setHomieMicLevel] = useState(0);',
    '  const [homieMicPeak, setHomieMicPeak] = useState(0);',
  ].join("\n");
  buddy = replaceOnce(buddy, needle, insert, "mic proof state near camera status");
}

if (!buddy.includes("homieMicProofStreamRef")) {
  const refNeedle = '  const homieCameraLastBrightnessRef = useRef<number | null>(null);';
  const fallbackRefNeedle = '  const externalStopTimerRef = useRef<number | null>(null);';
  if (buddy.includes(refNeedle)) {
    buddy = replaceOnce(buddy, refNeedle, [
      refNeedle,
      '  const homieMicProofStreamRef = useRef<MediaStream | null>(null);',
      '  const homieMicProofAudioCtxRef = useRef<AudioContext | null>(null);',
      '  const homieMicProofRafRef = useRef<number | null>(null);',
      '  const homieMicProofTimerRef = useRef<number | null>(null);',
      '  const homieMicProofPeakRef = useRef(0);',
      '  const homieMicProofActiveRef = useRef(false);'
    ].join("\n"), "mic proof refs after camera refs");
  } else {
    buddy = replaceOnce(buddy, fallbackRefNeedle, [
      fallbackRefNeedle,
      '  const homieMicProofStreamRef = useRef<MediaStream | null>(null);',
      '  const homieMicProofAudioCtxRef = useRef<AudioContext | null>(null);',
      '  const homieMicProofRafRef = useRef<number | null>(null);',
      '  const homieMicProofTimerRef = useRef<number | null>(null);',
      '  const homieMicProofPeakRef = useRef(0);',
      '  const homieMicProofActiveRef = useRef(false);'
    ].join("\n"), "mic proof refs fallback");
  }
}

// ===== Mic proof helpers =====
if (!buddy.includes("v10.36.68 Homie mic proof meter helpers")) {
  const functionAnchor = "  async function runHomieCameraPresenceCheck() {";
  const fallbackAnchor = "  async function runMicTest() {";
  const anchor = buddy.includes(functionAnchor) ? functionAnchor : fallbackAnchor;

  const helperBlock = [
    '  // ===== v10.36.68 Homie mic proof meter helpers =====',
    '  function stopHomieMicLevelProbe(silent = false) {',
    '    try {',
    '      if (homieMicProofRafRef.current) window.cancelAnimationFrame(homieMicProofRafRef.current);',
    '    } catch {',
    '      // ignore',
    '    }',
    '    try {',
    '      if (homieMicProofTimerRef.current) window.clearTimeout(homieMicProofTimerRef.current);',
    '    } catch {',
    '      // ignore',
    '    }',
    '    homieMicProofRafRef.current = null;',
    '    homieMicProofTimerRef.current = null;',
    '    try {',
    '      homieMicProofStreamRef.current?.getTracks()?.forEach((track) => track.stop());',
    '    } catch {',
    '      // ignore',
    '    }',
    '    homieMicProofStreamRef.current = null;',
    '    try {',
    '      void homieMicProofAudioCtxRef.current?.close?.();',
    '    } catch {',
    '      // ignore',
    '    }',
    '    homieMicProofAudioCtxRef.current = null;',
    '    setHomieMicLevel(0);',
    '    if (!silent) setHomieMicProofStatus("Mic proof stopped.");',
    '  }',
    '',
    '  function finishHomieMicProofWithoutTranscript(reason = "ended") {',
    '    if (!homieMicProofActiveRef.current) return;',
    '    const peak = homieMicProofPeakRef.current || 0;',
    '    homieMicProofActiveRef.current = false;',
    '    const pct = Math.round(Math.min(1, peak) * 100);',
    '    if (peak > 0.035) {',
    '      const message = "Mic level detected (" + pct + "% peak), but SpeechRecognition did not return words. Your input device is probably sending audio; the browser speech transcript path is the weak link. Try Say test again, speak one short sentence, or switch to the local voice bridge."; ',
    '      setHomieMicProofStatus(message);',
    '      setDiagnostics((prev) => ({ ...prev, lastErrorCode: "mic-audio-no-transcript", lastErrorMessage: message }));',
    '      announce(message, "warn", true, "Mic level detected, but no transcript returned.");',
    '    } else {',
    '      const message = "No useful mic level detected during the proof test. Check Windows input device, browser mic permission, and whether the right microphone is selected."; ',
    '      setHomieMicProofStatus(message);',
    '      setDiagnostics((prev) => ({ ...prev, lastErrorCode: "mic-level-too-low", lastErrorMessage: message }));',
    '      announce(message, "warn", true, "No useful mic level detected.");',
    '    }',
    '    stopHomieMicLevelProbe(true);',
    '  }',
    '',
    '  async function startHomieMicLevelProbe(durationMs = 6500) {',
    '    stopHomieMicLevelProbe(true);',
    '    homieMicProofPeakRef.current = 0;',
    '    setHomieMicLevel(0);',
    '    setHomieMicPeak(0);',
    '    setHomieMicProofStatus("Requesting mic signal. Speak after the browser starts listening.");',
    '',
    '    if (!navigator.mediaDevices?.getUserMedia) {',
    '      const message = "Mic level probe is unavailable because getUserMedia is missing in this runtime."; ',
    '      setHomieMicProofStatus(message);',
    '      throw new Error(message);',
    '    }',
    '',
    '    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });',
    '    homieMicProofStreamRef.current = stream;',
    '    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;',
    '    if (!AudioContextCtor) {',
    '      const message = "AudioContext is unavailable, so Homie cannot meter mic level in this runtime."; ',
    '      setHomieMicProofStatus(message);',
    '      throw new Error(message);',
    '    }',
    '',
    '    const ctx = new AudioContextCtor();',
    '    homieMicProofAudioCtxRef.current = ctx;',
    '    if (ctx.state === "suspended") {',
    '      try { await ctx.resume(); } catch { /* ignore */ }',
    '    }',
    '    const sourceNode = ctx.createMediaStreamSource(stream);',
    '    const analyser = ctx.createAnalyser();',
    '    analyser.fftSize = 1024;',
    '    sourceNode.connect(analyser);',
    '    const data = new Uint8Array(analyser.fftSize);',
    '',
    '    const tick = () => {',
    '      try {',
    '        analyser.getByteTimeDomainData(data);',
    '        let sum = 0;',
    '        for (let i = 0; i < data.length; i += 1) {',
    '          const v = (data[i] - 128) / 128;',
    '          sum += v * v;',
    '        }',
    '        const rms = Math.sqrt(sum / data.length);',
    '        const level = Math.min(1, rms * 5);',
    '        homieMicProofPeakRef.current = Math.max(homieMicProofPeakRef.current, level);',
    '        setHomieMicLevel(level);',
    '        setHomieMicPeak(homieMicProofPeakRef.current);',
    '      } catch {',
    '        // ignore',
    '      }',
    '      homieMicProofRafRef.current = window.requestAnimationFrame(tick);',
    '    };',
    '    tick();',
    '',
    '    homieMicProofTimerRef.current = window.setTimeout(() => {',
    '      finishHomieMicProofWithoutTranscript("timeout");',
    '    }, durationMs);',
    '  }',
    '',
    '  async function runHomieMicProofTest() {',
    '    homieMicProofActiveRef.current = true;',
    '    setDiagnostics((prev) => ({ ...prev, lastTranscript: "", lastErrorCode: "", lastErrorMessage: "" }));',
    '    setStatus("Mic proof is listening — say: Homie can hear me.");',
    '    setHomieMicProofStatus("Starting mic proof. Say: Homie can hear me.");',
    '    try {',
    '      await startHomieMicLevelProbe(7600);',
    '      await startVoice(false, true, false, false, "mic-proof");',
    '    } catch (error: any) {',
    '      homieMicProofActiveRef.current = false;',
    '      stopHomieMicLevelProbe(true);',
    '      const message = String(error?.message || "Mic proof could not start.");',
    '      setHomieMicProofStatus(message);',
    '      announce(message, "warn", true, "Mic proof could not start.");',
    '    }',
    '  }',
    '  // ===== v10.36.68 Homie mic proof meter helpers END =====',
    ''
  ].join("\n");

  buddy = replaceOnce(buddy, anchor, helperBlock + anchor, "insert mic proof helpers before camera/mic test");
}

// ===== Patch recognition outcomes to update proof =====
const resultNeedle = 'setStatus("Mic heard: " + transcript + ". Answering now.");\n        setMood("good");\n        window.setTimeout(() => run(transcript), 90);';
if (buddy.includes(resultNeedle) && !buddy.includes("Transcript captured: ")) {
  buddy = buddy.replace(resultNeedle, [
    'setStatus("Mic heard: " + transcript + ". Answering now.");',
    '        if (homieMicProofActiveRef.current) {',
    '          homieMicProofActiveRef.current = false;',
    '          setHomieMicProofStatus("Transcript captured: " + transcript);',
    '          stopHomieMicLevelProbe(true);',
    '        }',
    '        setMood("good");',
    '        window.setTimeout(() => run(transcript), 90);'
  ].join("\n"));
}

const cloudErrorNeedle = 'announce(message, "warn", true, "Voice recognition issue.");';
if (buddy.includes(cloudErrorNeedle) && !buddy.includes("finishHomieMicProofWithoutTranscript(code);")) {
  buddy = buddy.replace(cloudErrorNeedle, [
    'if (homieMicProofActiveRef.current) finishHomieMicProofWithoutTranscript(code);',
    '        announce(message, "warn", true, "Voice recognition issue.");'
  ].join("\n"));
}

const onEndNeedle = 'emitVoiceStatus({ source, status: "ended", message: "Voice session ended.", mode: "cloud" });';
if (buddy.includes(onEndNeedle) && !buddy.includes('finishHomieMicProofWithoutTranscript("speech-end")')) {
  buddy = buddy.replace(onEndNeedle, [
    onEndNeedle,
    '        if (homieMicProofActiveRef.current) finishHomieMicProofWithoutTranscript("speech-end");'
  ].join("\n"));
}

// ===== Button + UI =====
const sayButtonOld1 = '<button className="tabBtn" onClick={() => { setStatus("Mic proof is listening — say: Homie can hear me."); void startVoice(false, true, false, false, "mic-proof"); }}>Say test</button>';
const sayButtonOld2 = '<button className="tabBtn" onClick={() => { void runHomieMicProofTest(); }}>Say test</button>';
const sayButtonNew = '<button className="tabBtn active" onClick={() => { void runHomieMicProofTest(); }}>Say test</button>';
if (buddy.includes(sayButtonOld1)) buddy = buddy.replace(sayButtonOld1, sayButtonNew);
else if (buddy.includes(sayButtonOld2)) buddy = buddy.replace(sayButtonOld2, sayButtonNew);

if (!buddy.includes("homieMicProofMeter")) {
  const micRealityNeedle = '<div className="small" data-homie-mic-reality="v10.36.67"><b>Mic reality:</b> Camera is visual only. For hearing, click Say test and watch Last transcript.</div>';
  const fallbackNeedle = '<div className="small"><b>Last transcript:</b> {diagnostics.lastTranscript || "—"}</div>';
  const meterBlock = [
    '            <div className="homieMicProofMeter" data-homie-mic-proof="v10.36.68">',
    '              <div className="homieMicProofMeterHead">',
    '                <span><b>Mic proof:</b> {homieMicProofStatus}</span>',
    '                <span>{Math.round(homieMicPeak * 100)}% peak</span>',
    '              </div>',
    '              <div className="homieMicLevelTrack" aria-label="Mic signal meter">',
    '                <span style={{ width: Math.max(4, Math.round(homieMicLevel * 100)) + "%" }} />',
    '              </div>',
    '              <div className="small">Permission means the browser may use the mic. Signal means audio moved. Transcript means Homie actually caught words.</div>',
    '            </div>'
  ].join("\n");

  if (buddy.includes(micRealityNeedle)) {
    buddy = replaceOnce(buddy, micRealityNeedle, micRealityNeedle + "\n" + meterBlock, "mic proof meter after mic reality");
  } else {
    buddy = replaceOnce(buddy, fallbackNeedle, fallbackNeedle + "\n" + meterBlock, "mic proof meter fallback");
  }
}

// Text retune inside visible Homie UI.
buddy = buddy.replace(
  "Warm short replies first. Deeper support when you stay in the lane.",
  "Clear family/OS companion replies. Grounding only when you ask for it."
);
buddy = buddy.replace(
  "Check-ins, memory notes, legacy files, voice, and one small next move.",
  "Explain, organize, remember, route panels, voice, legacy files, and one small next move."
);
buddy = buddy.replace(
  "Mic opens only when clicked. Camera stays separate and opt-in.",
  "Mic listens only when clicked. Camera is visual only and separate."
);

// Cleanup should stop mic meter too.
const cleanupWithCamera = [
  '  useEffect(() => () => {',
  '    stopVoice(true);',
  '    stopHomieCameraPreview(true);',
  '  }, []);'
].join("\n");
const cleanupWithMic = [
  '  useEffect(() => () => {',
  '    stopVoice(true);',
  '    stopHomieCameraPreview(true);',
  '    stopHomieMicLevelProbe(true);',
  '  }, []);'
].join("\n");
if (buddy.includes(cleanupWithCamera)) buddy = buddy.replace(cleanupWithCamera, cleanupWithMic);
else if (buddy.includes("stopHomieCameraPreview(true);") && !buddy.includes("stopHomieMicLevelProbe(true);")) {
  buddy = buddy.replace("stopHomieCameraPreview(true);", "stopHomieCameraPreview(true);\n    stopHomieMicLevelProbe(true);");
}

if (!buddy.includes("v10.36.68 checker-safe marker")) {
  buddy = buddy.replace(
    "export default function HomieBuddy",
    "// v10.36.68 checker-safe marker: mic proof meter and normal companion mode installed\nexport default function HomieBuddy"
  );
}

fs.writeFileSync(buddyPath, buddy, "utf8");

// ===== CSS =====
const cssStart = "/* ===== v10.36.68 Homie Mic Proof Meter ===== */";
const cssEnd = "/* ===== v10.36.68 Homie Mic Proof Meter END ===== */";
if (css.includes(cssStart) && css.includes(cssEnd)) {
  const s = css.indexOf(cssStart);
  const e = css.indexOf(cssEnd, s) + cssEnd.length;
  css = (css.slice(0, s) + css.slice(e)).trimEnd();
}

const cssBlock = [
  cssStart,
  ".homieMicProofMeter{",
  "  margin-top: 10px;",
  "  padding: 12px;",
  "  border-radius: 16px;",
  "  border: 1px solid rgba(94,234,242,0.14);",
  "  background: rgba(94,234,242,0.045);",
  "  display: grid;",
  "  gap: 8px;",
  "}",
  ".homieMicProofMeterHead{",
  "  display: flex;",
  "  justify-content: space-between;",
  "  align-items: baseline;",
  "  gap: 12px;",
  "  color: rgba(238,246,255,0.9);",
  "}",
  ".homieMicProofMeterHead span:first-child{",
  "  min-width: 0;",
  "}",
  ".homieMicLevelTrack{",
  "  height: 11px;",
  "  border-radius: 999px;",
  "  overflow: hidden;",
  "  background: rgba(255,255,255,0.08);",
  "  border: 1px solid rgba(255,255,255,0.07);",
  "}",
  ".homieMicLevelTrack span{",
  "  display: block;",
  "  height: 100%;",
  "  border-radius: inherit;",
  "  background: linear-gradient(90deg, rgba(94,234,242,0.65), rgba(133,92,255,0.78), rgba(255,220,120,0.9));",
  "  box-shadow: 0 0 16px rgba(94,234,242,0.20);",
  "  transition: width 80ms linear;",
  "}",
  cssEnd
].join("\n");

css = css.trimEnd() + "\n\n" + cssBlock + "\n";
fs.writeFileSync(cssPath, css, "utf8");

// ===== Coach nudge: normal mode wording if v67 helper exists =====
if (coach.includes("Useful read: keep Homie as a helpful family/OS companion first") && !coach.includes("v10.36.68 tone nudge")) {
  coach = coach.replace(
    "Useful read: keep Homie as a helpful family/OS companion first — explain, organize, remember, and route. Save the deep support voice for when you actually ask for grounding.",
    "Useful read: keep Homie as an informational family/OS companion first — explain, organize, remember, route panels, and help with practical next moves. Save the deep support voice for when you explicitly ask for grounding."
  );
  coach = "// v10.36.68 tone nudge: normal companion mode stays informational by default\n" + coach;
}
fs.writeFileSync(coachPath, coach, "utf8");

console.log("[" + VERSION + "] Applied Homie mic proof meter and normal companion mode polish.");
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");
console.log("- ui/src/components/homieRebuild.css");
console.log("- ui/src/lib/homieCompanionCoach.ts");