import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.66b";
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

if (!buddy.includes("export default function HomieBuddy")) {
  fail("HomieBuddy.tsx does not look like the expected component.");
}
if (!buddy.includes("homieCameraPresenceStatus")) {
  fail("Could not find Homie camera status state anchor.");
}

/*
  v10.36.66b repairs the v10.36.66 installer syntax issue.
  Important: all inserted TSX avoids nested JS template literals so the MJS patcher parses cleanly.
*/

// 1) Add true opt-in camera preview state and refs.
if (!buddy.includes("homieCameraVideoRef")) {
  const cameraStateNeedle = '  const [homieCameraPresenceStatus, setHomieCameraPresenceStatus] = useState("Camera is off. Camera opens only when clicked. No video is analyzed or saved.");';
  const cameraStateInsert = [
    cameraStateNeedle,
    '  const [homieCameraLive, setHomieCameraLive] = useState(false);',
    '  const [homieCameraSignal, setHomieCameraSignal] = useState("Camera preview is off. Homie is not sampling visual signals.");',
    '  const homieCameraVideoRef = useRef<HTMLVideoElement | null>(null);',
    '  const homieCameraCanvasRef = useRef<HTMLCanvasElement | null>(null);',
    '  const homieCameraStreamRef = useRef<MediaStream | null>(null);',
    '  const homieCameraSampleTimerRef = useRef<number | null>(null);',
    '  const homieCameraLastBrightnessRef = useRef<number | null>(null);'
  ].join("\n");
  buddy = replaceOnce(buddy, cameraStateNeedle, cameraStateInsert, "camera preview state");
}

// 2) Replace old camera permission-check function with true preview + honest brightness/motion sampling.
if (!buddy.includes("v10.36.66b Homie Buddy true opt-in camera preview")) {
  const start = buddy.indexOf("  async function runHomieCameraPresenceCheck() {");
  const end = buddy.indexOf("  async function runMicTest()", start);
  if (start === -1 || end === -1) fail("Could not find camera function block anchors.");

  const cameraFunctionBlock = [
    '  // ===== v10.36.66b Homie Buddy true opt-in camera preview + honest visual signal =====',
    '  function stopHomieCameraPreview(silent = false) {',
    '    try {',
    '      if (homieCameraSampleTimerRef.current) {',
    '        window.clearInterval(homieCameraSampleTimerRef.current);',
    '        homieCameraSampleTimerRef.current = null;',
    '      }',
    '    } catch {',
    '      // ignore',
    '    }',
    '',
    '    try {',
    '      homieCameraStreamRef.current?.getTracks()?.forEach((track) => track.stop());',
    '    } catch {',
    '      // ignore',
    '    }',
    '',
    '    homieCameraStreamRef.current = null;',
    '    homieCameraLastBrightnessRef.current = null;',
    '',
    '    try {',
    '      if (homieCameraVideoRef.current) homieCameraVideoRef.current.srcObject = null;',
    '    } catch {',
    '      // ignore',
    '    }',
    '',
    '    setHomieCameraLive(false);',
    '    setHomieCameraSignal("Camera preview is off. Homie is not sampling visual signals.");',
    '    setHomieCameraPresenceStatus("Camera is off. Camera opens only when clicked. No video is analyzed or saved.");',
    '    if (!silent) announce("Camera preview is off.", "idle", true, "Camera preview off.");',
    '  }',
    '',
    '  function sampleHomieCameraFrame() {',
    '    const video = homieCameraVideoRef.current;',
    '    const canvas = homieCameraCanvasRef.current;',
    '    if (!video || !canvas || video.readyState < 2) return;',
    '',
    '    const width = 96;',
    '    const height = 54;',
    '    canvas.width = width;',
    '    canvas.height = height;',
    '',
    '    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;',
    '    if (!ctx) return;',
    '',
    '    try {',
    '      ctx.drawImage(video, 0, 0, width, height);',
    '      const pixels = ctx.getImageData(0, 0, width, height).data;',
    '      let total = 0;',
    '      for (let i = 0; i < pixels.length; i += 4) {',
    '        total += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;',
    '      }',
    '      const brightness = Math.round(total / (pixels.length / 4));',
    '      const last = homieCameraLastBrightnessRef.current;',
    '      homieCameraLastBrightnessRef.current = brightness;',
    '      const delta = last == null ? 0 : Math.abs(brightness - last);',
    '',
    '      const lightLabel = brightness < 44 ? "dim room" : brightness > 170 ? "bright room" : "normal room light";',
    '      const motionLabel = delta > 18 ? "movement/light change detected" : delta > 8 ? "small visual change" : "steady frame";',
    '',
    '      setHomieCameraSignal(lightLabel + " • " + motionLabel + " • brightness " + brightness);',
    '      setHomieCameraPresenceStatus("Camera preview is live and local. Homie is only sampling simple brightness/motion signals: " + lightLabel + ", " + motionLabel + ". No video is saved.");',
    '    } catch {',
    '      setHomieCameraSignal("Camera frame could not be sampled. Preview may still be visible.");',
    '    }',
    '  }',
    '',
    '  async function startHomieCameraPreview() {',
    '    setHomieCameraPresenceStatus("Requesting camera permission. Camera opens only when clicked.");',
    '    setHomieCameraSignal("Requesting camera permission...");',
    '    try {',
    '      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is unavailable in this runtime.");',
    '',
    '      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });',
    '      homieCameraStreamRef.current = stream;',
    '      setHomieCameraLive(true);',
    '      setHomieCameraSignal("Camera preview starting. Homie will sample brightness/motion only.");',
    '      setHomieCameraPresenceStatus("Camera preview is live and local. No video is analyzed beyond simple brightness/motion signals or saved.");',
    '',
    '      window.setTimeout(() => {',
    '        const video = homieCameraVideoRef.current;',
    '        if (!video) return;',
    '        try {',
    '          video.srcObject = stream;',
    '          video.muted = true;',
    '          video.play?.().catch(() => undefined);',
    '        } catch {',
    '          // ignore',
    '        }',
    '',
    '        sampleHomieCameraFrame();',
    '        if (homieCameraSampleTimerRef.current) window.clearInterval(homieCameraSampleTimerRef.current);',
    '        homieCameraSampleTimerRef.current = window.setInterval(sampleHomieCameraFrame, 1200);',
    '      }, 80);',
    '',
    '      announce("Camera preview is live. I am only sampling simple brightness and motion signals, and I am not saving video.", "good", true, "Camera preview live.");',
    '    } catch (error: any) {',
    '      const code = String(error?.name || error?.code || "camera-preview-failed");',
    '      const message = code + ": " + String(error?.message || "Camera preview failed or permission was blocked.");',
    '      setHomieCameraLive(false);',
    '      setHomieCameraSignal(message);',
    '      setHomieCameraPresenceStatus(message);',
    '      announce(message, "warn", true, "Camera preview needs permission.");',
    '    }',
    '  }',
    '',
    '  async function runHomieCameraPresenceCheck() {',
    '    if (homieCameraLive) {',
    '      stopHomieCameraPreview(false);',
    '      return;',
    '    }',
    '    await startHomieCameraPreview();',
    '  }',
    '  // ===== v10.36.66b Homie Buddy true opt-in camera preview + honest visual signal END ====='
  ].join("\n");

  buddy = buddy.slice(0, start) + cameraFunctionBlock + "\n\n" + buddy.slice(end);
}

// 3) Dynamic camera button label.
const cameraButtonOld = '<button className="tabBtn" onClick={() => void runHomieCameraPresenceCheck()}>Camera</button>';
const cameraButtonNew = '<button className={"tabBtn " + (homieCameraLive ? "active" : "")} onClick={() => void runHomieCameraPresenceCheck()}>{homieCameraLive ? "Stop camera" : "Start camera"}</button>';
if (buddy.includes(cameraButtonOld)) buddy = buddy.replace(cameraButtonOld, cameraButtonNew);

// 4) Add preview card before diagnostics.
if (!buddy.includes('data-homie-buddy-camera-preview="v10.36.66b"')) {
  const diagnosticsAnchor = "          {diagnosticsVisible && (";
  const card = [
    '          <div className={"homieCameraPreviewCard " + (homieCameraLive ? "live" : "")} data-homie-buddy-camera-preview="v10.36.66b">',
    '            <div className="homieCameraPreviewHead">',
    '              <div>',
    '                <div className="assistantSectionTitle">Camera presence</div>',
    '                <div className="small">Opt-in preview. Local only. Homie samples brightness/motion, not identity.</div>',
    '              </div>',
    '              <span className={"badge " + (homieCameraLive ? "good" : "")}>{homieCameraLive ? "Live" : "Off"}</span>',
    '            </div>',
    '            <div className="homieCameraPreviewStage">',
    '              {homieCameraLive ? (',
    '                <video ref={homieCameraVideoRef} className="homieCameraPreviewVideo" autoPlay muted playsInline />',
    '              ) : (',
    '                <div className="homieCameraPreviewEmpty">',
    '                  <span>Camera off</span>',
    '                  <small>Click Start camera when you want Homie to read simple room signals.</small>',
    '                </div>',
    '              )}',
    '              <canvas ref={homieCameraCanvasRef} className="homieCameraPreviewCanvas" aria-hidden="true" />',
    '            </div>',
    '            <div className="small"><b>Signal:</b> {homieCameraSignal}</div>',
    '            <div className="small homieCameraTruthNote">Truth note: Homie is not identifying people or objects here. This lane only reports simple brightness/motion signals unless a future vision model is explicitly added.</div>',
    '          </div>',
    '',
    diagnosticsAnchor
  ].join("\n");
  buddy = replaceOnce(buddy, diagnosticsAnchor, card, "camera preview card before diagnostics");
}

// 5) Hide launcher by render gate while the full house is open.
if (!buddy.includes('{mode === "floating" && !open && (')) {
  buddy = replaceOnce(buddy, '{mode === "floating" && (', '{mode === "floating" && !open && (', "floating launcher gate");
}

// 6) Stop camera stream on unmount.
if (!buddy.includes("stopHomieCameraPreview(true);")) {
  const cleanupOld = "  useEffect(() => () => stopVoice(true), []);";
  const cleanupNew = [
    '  useEffect(() => () => {',
    '    stopVoice(true);',
    '    stopHomieCameraPreview(true);',
    '  }, []);'
  ].join("\n");
  buddy = replaceOnce(buddy, cleanupOld, cleanupNew, "unmount cleanup");
}

// 7) Checker marker.
if (!buddy.includes("v10.36.66b checker-safe marker")) {
  buddy = buddy.replace(
    "export default function HomieBuddy",
    "// v10.36.66b checker-safe marker: true camera preview and launcher gate installed\nexport default function HomieBuddy"
  );
}

fs.writeFileSync(buddyPath, buddy, "utf8");

// CSS: replace old v10.36.66 block if it exists, then append v10.36.66b block.
const cssStartOld = "/* ===== v10.36.66 Homie Buddy True Camera Preview + Launcher Gate ===== */";
const cssEndOld = "/* ===== v10.36.66 Homie Buddy True Camera Preview + Launcher Gate END ===== */";
if (css.includes(cssStartOld) && css.includes(cssEndOld)) {
  const start = css.indexOf(cssStartOld);
  const end = css.indexOf(cssEndOld, start) + cssEndOld.length;
  css = (css.slice(0, start) + css.slice(end)).trimEnd();
}

const cssStart = "/* ===== v10.36.66b Homie Buddy True Camera Preview + Launcher Gate ===== */";
const cssEnd = "/* ===== v10.36.66b Homie Buddy True Camera Preview + Launcher Gate END ===== */";
if (css.includes(cssStart) && css.includes(cssEnd)) {
  const start = css.indexOf(cssStart);
  const end = css.indexOf(cssEnd, start) + cssEnd.length;
  css = (css.slice(0, start) + css.slice(end)).trimEnd();
}

const cssBlock = [
  cssStart,
  ".homieCameraPreviewCard{",
  "  margin-top: 14px;",
  "  padding: 15px;",
  "  border-radius: 22px;",
  "  border: 1px solid rgba(154,230,255,0.12);",
  "  background:",
  "    radial-gradient(260px 140px at 12% 0%, rgba(154,230,255,0.075), rgba(154,230,255,0) 70%),",
  "    radial-gradient(240px 130px at 100% 0%, rgba(255,170,220,0.06), rgba(255,170,220,0) 72%),",
  "    rgba(255,255,255,0.034);",
  "  box-shadow: 0 0 0 1px rgba(255,255,255,0.016) inset;",
  "  display: grid;",
  "  gap: 12px;",
  "}",
  "",
  ".homieCameraPreviewCard.live{",
  "  border-color: rgba(94,234,242,0.22);",
  "  box-shadow:",
  "    0 0 0 1px rgba(255,255,255,0.02) inset,",
  "    0 0 28px rgba(94,234,242,0.07);",
  "}",
  "",
  ".homieCameraPreviewHead{",
  "  display: flex;",
  "  justify-content: space-between;",
  "  align-items: flex-start;",
  "  gap: 12px;",
  "}",
  "",
  ".homieCameraPreviewStage{",
  "  position: relative;",
  "  min-height: 168px;",
  "  border-radius: 20px;",
  "  overflow: hidden;",
  "  border: 1px solid rgba(154,230,255,0.13);",
  "  background:",
  "    linear-gradient(180deg, rgba(8,12,24,0.92), rgba(6,8,18,0.96)),",
  "    radial-gradient(240px 150px at 50% 20%, rgba(154,230,255,0.09), rgba(154,230,255,0) 70%);",
  "}",
  "",
  ".homieCameraPreviewVideo{",
  "  width: 100%;",
  "  height: 100%;",
  "  min-height: 168px;",
  "  object-fit: cover;",
  "  display: block;",
  "  transform: scaleX(-1);",
  "  filter: saturate(1.04) contrast(1.03);",
  "}",
  "",
  ".homieCameraPreviewEmpty{",
  "  min-height: 168px;",
  "  display: grid;",
  "  place-items: center;",
  "  text-align: center;",
  "  gap: 5px;",
  "  padding: 18px;",
  "  color: rgba(226,238,255,0.76);",
  "}",
  "",
  ".homieCameraPreviewEmpty span{",
  "  font-weight: 900;",
  "  letter-spacing: 0.04em;",
  "  color: rgba(240,248,255,0.92);",
  "}",
  "",
  ".homieCameraPreviewEmpty small{",
  "  max-width: 34ch;",
  "  line-height: 1.4;",
  "  color: rgba(226,238,255,0.62);",
  "}",
  "",
  ".homieCameraPreviewCanvas{",
  "  position: absolute;",
  "  width: 1px;",
  "  height: 1px;",
  "  opacity: 0;",
  "  pointer-events: none;",
  "}",
  "",
  ".homieCameraTruthNote{",
  "  color: rgba(226,238,255,0.64);",
  "  line-height: 1.38;",
  "}",
  "",
  "@media (max-width: 680px){",
  "  .homieCameraPreviewHead{",
  "    flex-direction: column;",
  "    align-items: stretch;",
  "  }",
  "}",
  cssEnd
].join("\n");

css = css.trimEnd() + "\n\n" + cssBlock + "\n";
fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied Homie Buddy camera preview installer syntax hotfix.");
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");
console.log("- ui/src/components/homieRebuild.css");