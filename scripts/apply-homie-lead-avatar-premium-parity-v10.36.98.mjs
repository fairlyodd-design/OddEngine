import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.98";
const root = process.cwd();
const target = path.join(root, "ui", "src", "panels", "Homie.tsx");

function fail(message) {
  console.error(`[${VERSION}] ${message}`);
  process.exit(1);
}
function ensure(filePath) {
  if (!fs.existsSync(filePath)) fail(`Missing file: ${filePath}`);
}
function backup(filePath) {
  const bak = filePath + `.bak_${VERSION}`;
  if (!fs.existsSync(bak)) fs.copyFileSync(filePath, bak);
}

ensure(target);
backup(target);

let src = fs.readFileSync(target, "utf8");

if (!src.includes("HomieLeadAvatarParityStage")) {
  fail("Expected v10.36.97b parity stage not found. Apply 97b first.");
}

const startMarker = "function HomieLeadAvatarParityStage({";
const endMarker = "export default function Homie(";
const start = src.indexOf(startMarker);
const end = src.indexOf(endMarker);
if (start === -1 || end === -1 || end <= start) {
  fail("Could not locate avatar stage function block.");
}

const premiumFn = `function HomieLeadAvatarPremiumStage({
  listening,
  speaking,
}: {
  listening: boolean;
  speaking: boolean;
}) {
  const lift = speaking ? -3 : listening ? -1 : 0;
  const auraScale = speaking ? 1.04 : listening ? 1.02 : 1;
  const faceGlow = listening
    ? "0 0 58px rgba(154,230,255,0.34), 0 0 92px rgba(214,146,255,0.12)"
    : "0 0 42px rgba(154,230,255,0.22), 0 0 74px rgba(214,146,255,0.08)";
  const coreGlow = speaking ? "0 0 28px rgba(255,208,92,0.58)" : "0 0 18px rgba(255,208,92,0.34)";

  return (
    <div
      data-homie-lead-avatar-premium="v10.36.98"
      style={{
        width: "100%",
        minHeight: 440,
        display: "grid",
        placeItems: "center",
        borderRadius: 30,
        border: "1px solid rgba(154,230,255,0.12)",
        background:
          "radial-gradient(360px 200px at 50% 0%, rgba(154,230,255,0.12), rgba(154,230,255,0) 74%), radial-gradient(320px 200px at 50% 100%, rgba(255,170,220,0.08), rgba(255,170,220,0) 74%), rgba(5,10,20,0.28)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 396,
          maxWidth: "100%",
          display: "grid",
          justifyItems: "center",
          gap: 12,
          padding: "8px 6px 0",
        }}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "1 / 1.16",
            borderRadius: 34,
            position: "relative",
            overflow: "hidden",
            border: "1px solid rgba(154,230,255,0.15)",
            background:
              "radial-gradient(280px 180px at 50% 18%, rgba(255,255,255,0.08), rgba(255,255,255,0) 72%), radial-gradient(280px 250px at 50% 46%, rgba(154,230,255,0.11), rgba(154,230,255,0) 72%), linear-gradient(180deg, rgba(24,31,52,0.98) 0%, rgba(10,14,26,0.99) 100%)",
            boxShadow:
              "inset 0 0 0 1px rgba(154,230,255,0.04), 0 26px 62px rgba(0,0,0,0.42), 0 0 56px rgba(94,234,242,0.12), 0 0 82px rgba(255,170,220,0.08)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 18,
              borderRadius: 28,
              border: "1px solid rgba(154,230,255,0.18)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 22,
              width: 140,
              height: 20,
              transform: "translateX(-50%)",
              borderRadius: 999,
              background: "rgba(3,5,12,0.44)",
              filter: "blur(2px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "52%",
              transform: \`translate(-50%, calc(-50% + \${lift}px)) scale(\${auraScale})\`,
              width: 196,
              height: 252,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 38,
                top: 30,
                width: 120,
                height: 176,
                borderRadius: 999,
                background: "radial-gradient(circle at 50% 40%, rgba(154,230,255,0.28), rgba(154,230,255,0.06) 54%, rgba(154,230,255,0) 72%)",
                filter: "blur(10px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 48,
                top: 42,
                width: 100,
                height: 144,
                borderRadius: 999,
                background: "linear-gradient(180deg, rgba(206,221,228,0.28) 0%, rgba(130,145,170,0.16) 100%)",
                opacity: 0.68,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 28,
                top: 84,
                width: 140,
                height: 146,
                borderRadius: 56,
                background: "linear-gradient(180deg, rgba(18,25,46,1) 0%, rgba(10,15,28,1) 100%)",
                boxShadow: "0 18px 34px rgba(0,0,0,0.22)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 60,
                top: 118,
                width: 76,
                height: 34,
                borderRadius: 20,
                background: "rgba(120,140,180,0.20)",
                border: "1px solid rgba(185,195,224,0.10)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 40,
                top: 22,
                width: 116,
                height: 126,
                borderRadius: 48,
                background:
                  "linear-gradient(180deg, rgba(162,221,255,1) 0%, rgba(129,148,255,0.98) 50%, rgba(214,146,255,0.98) 100%)",
                boxShadow: faceGlow,
              }}
            />
            <div style={{ position: "absolute", left: 34, top: 12, width: 28, height: 28, borderRadius: 999, background: "rgba(255,206,92,0.98)", boxShadow: "0 0 14px rgba(255,206,92,0.55)" }} />
            <div style={{ position: "absolute", right: 34, top: 12, width: 28, height: 28, borderRadius: 999, background: "rgba(255,206,92,0.98)", boxShadow: "0 0 14px rgba(255,206,92,0.55)" }} />
            <div style={{ position: "absolute", left: 48, top: 22, width: 44, height: 16, borderTop: "3px solid rgba(154,230,255,0.74)", borderRadius: 999, transform: "rotate(-10deg)" }} />
            <div style={{ position: "absolute", right: 48, top: 22, width: 44, height: 16, borderTop: "3px solid rgba(154,230,255,0.74)", borderRadius: 999, transform: "rotate(10deg)" }} />
            <div style={{ position: "absolute", left: 58, top: 62, width: 26, height: 8, borderRadius: 999, background: "rgba(233,241,255,0.92)", transform: "rotate(-8deg)" }} />
            <div style={{ position: "absolute", right: 58, top: 62, width: 26, height: 8, borderRadius: 999, background: "rgba(233,241,255,0.92)", transform: "rotate(8deg)" }} />
            <div style={{ position: "absolute", left: 52, top: 82, width: 26, height: 30, borderRadius: 11, background: "rgba(10,16,28,0.98)" }} />
            <div style={{ position: "absolute", right: 52, top: 82, width: 26, height: 30, borderRadius: 11, background: "rgba(10,16,28,0.98)" }} />
            <div style={{ position: "absolute", left: 83, top: 110, width: 30, height: 6, borderRadius: 999, background: "rgba(81,42,78,0.88)" }} />
            <div style={{ position: "absolute", left: 79, top: 108, width: 38, height: 16, borderBottom: "4px solid rgba(81,42,78,0.88)", borderRadius: 999 }} />
            <div style={{ position: "absolute", left: 46, top: 96, width: 18, height: 12, borderRadius: 999, background: "rgba(255,186,206,0.26)" }} />
            <div style={{ position: "absolute", right: 46, top: 96, width: 18, height: 12, borderRadius: 999, background: "rgba(255,186,206,0.26)" }} />
            <div style={{ position: "absolute", left: 16, top: 142, width: 26, height: 26, borderRadius: 999, background: "rgba(189,225,255,0.92)", boxShadow: "0 0 18px rgba(189,225,255,0.44)" }} />
            <div style={{ position: "absolute", right: 16, top: 142, width: 26, height: 26, borderRadius: 999, background: "rgba(189,225,255,0.92)", boxShadow: "0 0 18px rgba(189,225,255,0.44)" }} />
            <div style={{ position: "absolute", left: 80, top: 216, width: 36, height: 18, borderRadius: 999, background: "linear-gradient(180deg, rgba(40,50,90,1) 0%, rgba(16,22,38,1) 100%)" }} />
            <div style={{ position: "absolute", left: 78, top: 166, width: 40, height: 40, display: "grid", placeItems: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: 999, background: "rgba(255,208,92,0.98)", boxShadow: coreGlow }} />
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontWeight: 800, letterSpacing: "0.01em" }}>Unified Homie visual lane</div>
          <div className="small" style={{ marginTop: 4, opacity: 0.9 }}>
            Premium-polished lead avatar with tighter proportions, softer glow, and cleaner framing to better match the right-side companion lane.
          </div>
        </div>
      </div>
    </div>
  );
}

`;

src = src.slice(0, start) + premiumFn + src.slice(end);
src = src.replace(/HomieLeadAvatarParityStage/g, "HomieLeadAvatarPremiumStage");
src = src.replace('data-homie-lead-avatar-parity-hotfix="v10.36.97b"', 'data-homie-premium-parity-polish="v10.36.98"');
src = src.replace("Lead avatar mount parity", "Premium parity polish");
src = src.replace(
  "This pass refines the lead avatar to feel closer to the right-side companion without disturbing the fixed ownership structure from 97. It improves facial proportion, eye placement, body silhouette, glow softness, and stage framing.",
  "This pass refines the lead avatar to better match the right-side companion without disturbing the fixed ownership structure from 97. It improves face proportion, eye placement, body silhouette, glow softness, and stage framing."
);
src = src.replace(
  '<span className="badge">Lead avatar visible</span>',
  '<span className="badge">Face proportion refined</span>'
);
src = src.replace(
  '<span className="badge">Single lead lane</span>',
  '<span className="badge">Eye placement improved</span>'
);
src = src.replace(
  '<span className="badge">Legacy collapsed</span>',
  '<span className="badge">Glow softened</span>'
);
src = src.replace(
  '<span className="badge">Visual parity hotfix</span>',
  '<span className="badge">Stage framing cleaner</span>'
);
src = src.replace(
  "The top lead card should now visually match the companion lane closely enough to stop the ownership confusion.",
  "The page hierarchy is already fixed, so this pass is purely about making the lead avatar feel more premium and more like the companion lane."
);
src = src.replace('data-homie-legacy-preview="v10.36.97"', 'data-homie-legacy-preview="v10.36.98"');
src = src.replace('data-homie-guide-tab="v10.36.97"', 'data-homie-guide-tab="v10.36.98"');

fs.writeFileSync(target, src, "utf8");
console.log(`[${VERSION}] Applied Homie lead avatar premium parity polish pass.`);
console.log("Touched:");
console.log("- ui/src/panels/Homie.tsx");