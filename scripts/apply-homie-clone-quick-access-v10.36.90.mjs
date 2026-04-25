import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.90";
const root = process.cwd();
const homiePath = path.join(root, "ui", "src", "panels", "Homie.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}
function ensure(filePath) {
  if (!fs.existsSync(filePath)) fail("Missing file: " + filePath);
}
function backup(filePath) {
  const dst = filePath + ".bak_" + VERSION;
  if (!fs.existsSync(dst)) fs.copyFileSync(filePath, dst);
}

ensure(homiePath);
backup(homiePath);

let src = fs.readFileSync(homiePath, "utf8");

const marker = 'data-homie-clone-quick-access="v10.36.90"';
if (!src.includes(marker)) {
  const anchor = '<div className="card softCard" style={{ marginTop: 12, borderColor: "rgba(56,189,248,0.28)" }}>';
  if (!src.includes(anchor)) fail("Could not find recovery card anchor in Homie.tsx");

  const block = `
          <div className="card softCard" data-homie-clone-quick-access="v10.36.90" data-homie-clone-bridge-readiness="v10.36.90" style={{ marginTop: 12, borderColor: "rgba(154,230,255,0.24)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="h">Homie clone studio quick access</div>
                <div className="sub">Shape Homie from inside the OS: tone, likeness notes, family phrases, preview shaping, and consent-first voice training workflow.</div>
              </div>
              <span className="badge warn">Bridge: 127.0.0.1:8776</span>
            </div>

            <div className="timelineCard" style={{ marginTop: 12 }}>
              <b>Best next move:</b> open Clone Studio, save your signature tone, add 5–10 family phrases, then generate a manifest only from approved voice samples.
            </div>

            <div className="assistantChipWrap" style={{ marginTop: 12 }}>
              <span className="badge">Clone profile</span>
              <span className="badge">Family phrases</span>
              <span className="badge">Preview shaping</span>
              <span className="badge warn">Consent-first training</span>
            </div>

            <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
              <button className="tabBtn active" onClick={() => onNavigate("HomieCloneStudio")}>Open Clone Studio</button>
              <button className="tabBtn" onClick={() => addQuick("Help me shape Homie to feel more like me without sounding fake or corporate.")}>Ask clone guide</button>
              <button className="tabBtn" onClick={() => onNavigate("Books")}>Open Writers Lounge</button>
              <button className="tabBtn" onClick={() => onNavigate(activePanelId || "Home")}>Back to current panel</button>
            </div>

            <div className="small" style={{ marginTop: 10 }}>
              Honest lane: this shapes tone, phrases, memory, and workflow. It does not pretend a perfect identity clone already exists.
            </div>
          </div>

`;

  src = src.replace(anchor, block + anchor);
}

fs.writeFileSync(homiePath, src, "utf8");

console.log("[" + VERSION + "] Applied Homie Clone Studio quick access + bridge readiness card.");
console.log("Touched:");
console.log("- ui/src/panels/Homie.tsx");