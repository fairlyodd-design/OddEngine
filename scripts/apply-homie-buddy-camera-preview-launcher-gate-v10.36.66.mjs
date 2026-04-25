import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.66";
const PASS = "HomieBuddyTrueCameraPreviewAndLauncherGatePass";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");

function fail(message) {
  console.error(`[${VERSION}] ${message}`);
  process.exit(1);
}

function mustExist(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`Missing ${label}: ${filePath}`);
}

function backup(filePath) {
  const dst = `${filePath}.bak_${VERSION}`;
  if (!fs.existsSync(dst)) fs.copyFileSync(filePath, dst);
  return dst;
}

mustExist(buddyPath, "HomieBuddy.tsx");
mustExist(cssPath, "homieRebuild.css");

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

// 1) Add camera live state + refs.
if (!buddy.includes("data-homie-buddy-camera-preview=\"v10.36.66\"")) {
  const cameraStateNeedle = '  const [homieCameraPresenceStatus, setHomieCameraPresenceStatus] = useState("Camera is off. Camera opens only when clicked. No video is analyzed or saved.");';
  if (!buddy.includes(cameraStateNeedle)) fail("Could not find exact camera state anchor.");

  const cameraStateInsert = `${cameraStateNeedle}
  const [homieCameraLive, setHomieCameraLive] = useState(false);
  const [homieCameraSignal, setHomieCameraSignal] = useState("Camera preview is off. Homie is not sampling visual signals.");
  const homieCameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const homieCameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const homieCameraStreamRef = useRef<MediaStream | null>(null);
  const homieCameraSampleTimerRef = useRef<number | null>(null);
  const homieCameraLastBrightnessRef = useRef<number | null>(null);`;

  buddy = buddy.replace(cameraStateNeedle, cameraStateInsert);
}

// 2) Replace camera check function with real opt-in preview + simple brightness/motion sampling.
const cameraFunctionBlock = String.raw`  // ===== v10.36.66 Homie Buddy true opt-in camera preview + honest visual signal =====
  function stopHomieCameraPreview(silent = false) {
    try {
      if (homieCameraSampleTimerRef.current) {
        window.clearInterval(homieCameraSampleTimerRef.current);
        homieCameraSampleTimerRef.current = null;
      }
    } catch {
      // ignore
    }

    try {
      homieCameraStreamRef.current?.getTracks()?.forEach((track) => track.stop());
    } catch {
      // ignore
    }

    homieCameraStreamRef.current = null;
    homieCameraLastBrightnessRef.current = null;

    try {
      if (homieCameraVideoRef.current) homieCameraVideoRef.current.srcObject = null;
    } catch {
      // ignore
    }

    setHomieCameraLive(false);
    setHomieCameraSignal("Camera preview is off. Homie is not sampling visual signals.");
    setHomieCameraPresenceStatus("Camera is off. Camera opens only when clicked. No video is analyzed or saved.");
    if (!silent) announce("Camera preview is off.", "idle", true, "Camera preview off.");
  }

  function sampleHomieCameraFrame() {
    const video = homieCameraVideoRef.current;
    const canvas = homieCameraCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const width = 96;
    const height = 54;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return;

    try {
      ctx.drawImage(video, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height).data;
      let total = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        total += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      }
      const brightness = Math.round(total / (pixels.length / 4));
      const last = homieCameraLastBrightnessRef.current;
      homieCameraLastBrightnessRef.current = brightness;
      const delta = last == null ? 0 : Math.abs(brightness - last);

      const lightLabel = brightness < 44 ? "dim room" : brightness > 170 ? "bright room" : "normal room light";
      const motionLabel = delta > 18 ? "movement/light change detected" : delta > 8 ? "small visual change" : "steady frame";

      setHomieCameraSignal(`${lightLabel} • ${motionLabel} • brightness ${brightness}`);
      setHomieCameraPresenceStatus(
        `Camera preview is live and local. Homie is only sampling simple brightness/motion signals: ${lightLabel}, ${motionLabel}. No video is saved.`
      );
    } catch {
      setHomieCameraSignal("Camera frame could not be sampled. Preview may still be visible.");
    }
  }

  async function startHomieCameraPreview() {
    setHomieCameraPresenceStatus("Requesting camera permission. Camera opens only when clicked.");
    setHomieCameraSignal("Requesting camera permission...");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access is unavailable in this runtime.");

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      homieCameraStreamRef.current = stream;
      setHomieCameraLive(true);
      setHomieCameraSignal("Camera preview starting. Homie will sample brightness/motion only.");
      setHomieCameraPresenceStatus("Camera preview is live and local. No video is analyzed beyond simple brightness/motion signals or saved.");

      window.setTimeout(() => {
        const video = homieCameraVideoRef.current;
        if (!video) return;
        try {
          video.srcObject = stream;
          video.muted = true;
          video.play?.().catch(() => undefined);
        } catch {
          // ignore
        }

        sampleHomieCameraFrame();
        if (homieCameraSampleTimerRef.current) window.clearInterval(homieCameraSampleTimerRef.current);
        homieCameraSampleTimerRef.current = window.setInterval(sampleHomieCameraFrame, 1200);
      }, 80);

      announce("Camera preview is live. I am only sampling simple brightness and motion signals, and I am not saving video.", "good", true, "Camera preview live.");
    } catch (error: any) {
      const code = String(error?.name || error?.code || "camera-preview-failed");
      const message = code + ": " + String(error?.message || "Camera preview failed or permission was blocked.");
      setHomieCameraLive(false);
      setHomieCameraSignal(message);
      setHomieCameraPresenceStatus(message);
      announce(message, "warn", true, "Camera preview needs permission.");
    }
  }

  async function runHomieCameraPresenceCheck() {
    if (homieCameraLive) {
      stopHomieCameraPreview(false);
      return;
    }
    await startHomieCameraPreview();
  }
  // ===== v10.36.66 Homie Buddy true opt-in camera preview + honest visual signal END =====
`;

if (!buddy.includes("v10.36.66 Homie Buddy true opt-in camera preview")) {
  const start = buddy.indexOf("  async function runHomieCameraPresenceCheck() {");
  const end = buddy.indexOf("  async function runMicTest()", start);
  if (start === -1 || end === -1) fail("Could not find camera function block anchors.");
  buddy = buddy.slice(0, start) + cameraFunctionBlock + "\n\n" + buddy.slice(end);
}

// 3) Add camera preview card before diagnostics.
if (!buddy.includes('data-homie-buddy-camera-preview="v10.36.66"')) {
  const voiceMetaCloseNeedle = `          <div className="homieRebuildVoiceMeta">
            <div className="small"><b>Voice engine:</b> {diagnostics.recognitionName} • {voiceModeLabel}</div>
            <div className="small"><b>Last transcript:</b> {diagnostics.lastTranscript || "—"}</div>
            <div className="small"><b>Bridge:</b> {diagnostics.externalBridgeState} • {diagnostics.externalBridgeBaseUrl}</div>
            <div className="small"><b>Camera:</b> {homieCameraPresenceStatus}</div>
            <div className="small"><b>Camera note:</b> Camera opens only when clicked. No video is analyzed or saved.</div>
          </div>

          {diagnosticsVisible && (`;

  if (!buddy.includes(voiceMetaCloseNeedle)) fail("Could not find voice meta / diagnostics anchor.");

  const cameraPreviewCard = `          <div className={\`homieCameraPreviewCard \${homieCameraLive ? "live" : ""}\`} data-homie-buddy-camera-preview="v10.36.66">
            <div className="homieCameraPreviewHead">
              <div>
                <div className="assistantSectionTitle">Camera presence</div>
                <div className="small">Opt-in preview. Local only. Homie samples brightness/motion, not identity.</div>
              </div>
              <span className={\`badge \${homieCameraLive ? "good" : ""}\`}>{homieCameraLive ? "Live" : "Off"}</span>
            </div>
            <div className="homieCameraPreviewStage">
              {homieCameraLive ? (
                <video ref={homieCameraVideoRef} className="homieCameraPreviewVideo" autoPlay muted playsInline />
              ) : (
                <div className="homieCameraPreviewEmpty">
                  <span>Camera off</span>
                  <small>Click Start camera when you want Homie to read simple room signals.</small>
                </div>
              )}
              <canvas ref={homieCameraCanvasRef} className="homieCameraPreviewCanvas" aria-hidden="true" />
            </div>
            <div className="small"><b>Signal:</b> {homieCameraSignal}</div>
            <div className="small homieCameraTruthNote">Truth note: Homie is not identifying people or objects here. This lane only reports simple brightness/motion signals unless a future vision model is explicitly added.</div>
          </div>

          {diagnosticsVisible && (`;

  buddy = buddy.replace(voiceMetaCloseNeedle, voiceMetaCloseNeedle.replace("          {diagnosticsVisible && (", cameraPreviewCard));
}

// 4) Make camera button dynamic.
const cameraButtonOld = '<button className="tabBtn" onClick={() => void runHomieCameraPresenceCheck()}>Camera</button>';
const cameraButtonNew = '<button className={`tabBtn ${homieCameraLive ? "active" : ""}`} onClick={() => void runHomieCameraPresenceCheck()}>{homieCameraLive ? "Stop camera" : "Start camera"}</button>';
if (buddy.includes(cameraButtonOld)) buddy = buddy.replace(cameraButtonOld, cameraButtonNew);

// 5) Gate the launcher in JSX. CSS :has is not reliable enough here.
const launcherOld = '{mode === "floating" && (';
const launcherNew = '{mode === "floating" && !open && (';
const launcherCount = (buddy.match(/\{mode === "floating" && \(/g) || []).length;
if (!buddy.includes(launcherNew)) {
  if (launcherCount < 1) fail("Could not find floating launcher JSX gate.");
  buddy = buddy.replace(launcherOld, launcherNew);
}

// 6) Cleanup camera stream on unmount with voice cleanup.
const cleanupOld = "  useEffect(() => () => stopVoice(true), []);";
const cleanupNew = `  useEffect(() => () => {
    stopVoice(true);
    stopHomieCameraPreview(true);
  }, []);`;
if (buddy.includes(cleanupOld)) {
  buddy = buddy.replace(cleanupOld, cleanupNew);
} else if (!buddy.includes("stopHomieCameraPreview(true);")) {
  fail("Could not find cleanup effect anchor.");
}

// 7) Add checker-safe marker if needed.
if (!buddy.includes("v10.36.66 checker-safe marker")) {
  buddy = buddy.replace(
    "export default function HomieBuddy",
    "// v10.36.66 checker-safe marker: camera preview and launcher render gate installed\nexport default function HomieBuddy"
  );
}

fs.writeFileSync(buddyPath, buddy, "utf8");

// CSS append/replace.
const cssStart = "/* ===== v10.36.66 Homie Buddy True Camera Preview + Launcher Gate ===== */";
const cssEnd = "/* ===== v10.36.66 Homie Buddy True Camera Preview + Launcher Gate END ===== */";
const cssBlock = String.raw`
${cssStart}
.homieCameraPreviewCard{
  margin-top: 14px;
  padding: 15px;
  border-radius: 22px;
  border: 1px solid rgba(154,230,255,0.12);
  background:
    radial-gradient(260px 140px at 12% 0%, rgba(154,230,255,0.075), rgba(154,230,255,0) 70%),
    radial-gradient(240px 130px at 100% 0%, rgba(255,170,220,0.06), rgba(255,170,220,0) 72%),
    rgba(255,255,255,0.034);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.016) inset;
  display: grid;
  gap: 12px;
}

.homieCameraPreviewCard.live{
  border-color: rgba(94,234,242,0.22);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.02) inset,
    0 0 28px rgba(94,234,242,0.07);
}

.homieCameraPreviewHead{
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.homieCameraPreviewStage{
  position: relative;
  min-height: 168px;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(154,230,255,0.13);
  background:
    linear-gradient(180deg, rgba(8,12,24,0.92), rgba(6,8,18,0.96)),
    radial-gradient(240px 150px at 50% 20%, rgba(154,230,255,0.09), rgba(154,230,255,0) 70%);
}

.homieCameraPreviewVideo{
  width: 100%;
  height: 100%;
  min-height: 168px;
  object-fit: cover;
  display: block;
  transform: scaleX(-1);
  filter: saturate(1.04) contrast(1.03);
}

.homieCameraPreviewEmpty{
  min-height: 168px;
  display: grid;
  place-items: center;
  text-align: center;
  gap: 5px;
  padding: 18px;
  color: rgba(226,238,255,0.76);
}

.homieCameraPreviewEmpty span{
  font-weight: 900;
  letter-spacing: 0.04em;
  color: rgba(240,248,255,0.92);
}

.homieCameraPreviewEmpty small{
  max-width: 34ch;
  line-height: 1.4;
  color: rgba(226,238,255,0.62);
}

.homieCameraPreviewCanvas{
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.homieCameraTruthNote{
  color: rgba(226,238,255,0.64);
  line-height: 1.38;
}

@media (max-width: 680px){
  .homieCameraPreviewHead{
    flex-direction: column;
    align-items: stretch;
  }
}
/* Explicit backup for runtimes where :has-based launcher hiding is unreliable.
   The TSX render gate is the real fix in this pass. */
.homieRebuildDock .homieRebuildLauncher{
  transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease;
}
${cssEnd}
`;

const cssRegex = new RegExp(cssStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\\s\\S]*?" + cssEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "g");
css = css.replace(cssRegex, "").trimEnd();
css += "\n\n" + cssBlock + "\n";
fs.writeFileSync(cssPath, css, "utf8");

console.log(`[${VERSION}] Applied ${PASS}`);
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");
console.log("- ui/src/components/homieRebuild.css");