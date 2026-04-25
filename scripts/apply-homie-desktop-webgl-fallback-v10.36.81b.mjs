import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.81b";
const root = process.cwd();

const rivePath = path.join(root, "ui", "src", "components", "RiveHomie.tsx");
const cssPath = path.join(root, "ui", "src", "components", "homieRebuild.css");

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
function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) fail("Could not find anchor: " + label);
  return text.replace(from, to);
}

ensure(rivePath);
ensure(cssPath);
backup(rivePath);
backup(cssPath);

let rive = fs.readFileSync(rivePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

if (!rive.includes("export default function RiveHomie")) fail("RiveHomie.tsx shape not recognized.");

if (!rive.includes("v10.36.81b checker-safe marker")) {
  rive = rive.replace(
    'import React, { useEffect, useMemo, useRef, useState } from "react";',
    'import React, { useEffect, useMemo, useRef, useState } from "react";\n// v10.36.81b checker-safe marker: desktop webgl fallback guard installed'
  );
}

if (!rive.includes("function supportsHomieWebGL")) {
  const anchor = "export type RiveHomieProps = {";
  const block = `
function supportsHomieWebGL() {
  try {
    const canvas = document.createElement("canvas");
    const attrs: any = { alpha: true, antialias: true, powerPreference: "high-performance" };
    const gl2 = canvas.getContext("webgl2", attrs);
    if (gl2) return true;
    const gl =
      canvas.getContext("webgl", attrs) ||
      canvas.getContext("experimental-webgl", attrs);
    return !!gl;
  } catch {
    return false;
  }
}

type HomieRiveBoundaryProps = {
  fallback: React.ReactNode;
  className?: string;
  reason?: string;
  children: React.ReactNode;
};

type HomieRiveBoundaryState = { hasError: boolean };

class HomieRiveBoundary extends React.Component<HomieRiveBoundaryProps, HomieRiveBoundaryState> {
  constructor(props: HomieRiveBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // keep quiet; fallback handles display
  }

  render() {
    if (this.state.hasError) {
      return (
        <span className={\`homieRiveWrap \${this.props.className || ""}\`.trim()}>
          {this.props.fallback}
          <span className="homieRiveMissing" title={this.props.reason || "WebGL fallback"}>
            Desktop fallback
          </span>
        </span>
      );
    }
    return this.props.children as any;
  }
}

`;
  rive = replaceOnce(rive, anchor, block + anchor, "supportsHomieWebGL insertion");
}

const stateOld = '  const [availability, setAvailability] = useState<"unknown" | "ok" | "missing">("unknown");';
const stateNew = '  const [availability, setAvailability] = useState<"unknown" | "ok" | "missing">("unknown");\n  const [webglStatus, setWebglStatus] = useState<"unknown" | "ok" | "unsupported">("unknown");';
rive = replaceOnce(rive, stateOld, stateNew, "webgl status state");

// Add webgl preflight useEffect if not present.
if (!rive.includes("setWebglStatus(supportsHomieWebGL() ?")) {
  const anchor = "  useEffect(() => {";
  const block = `  useEffect(() => {
    if (!enabled) return;
    setWebglStatus(supportsHomieWebGL() ? "ok" : "unsupported");
  }, [enabled]);

`;
  rive = replaceOnce(rive, anchor, block + anchor, "webgl preflight useEffect");
}

// Add unsupported fallback branch.
const beforeUnknown = '  // While preflight is running, keep fallback visible so the UI stays stable.\n  if (availability === "unknown") return <>{fallback}</>;';
const replacedUnknown = `  if (webglStatus === "unsupported") {
    return (
      <span className={\`homieRiveWrap \${className || ""}\`.trim()}>
        {fallback}
        <span className="homieRiveMissing" title="Desktop WebGL fallback is active">
          Desktop fallback
        </span>
      </span>
    );
  }

  // While preflight is running, keep fallback visible so the UI stays stable.
  if (availability === "unknown" || webglStatus === "unknown") return <>{fallback}</>;`;
rive = replaceOnce(rive, beforeUnknown, replacedUnknown, "unsupported fallback branch");

// Wrap inner component with boundary.
const returnOld = `  return (
    <RiveHomieInner
      src={src}
      artboard={artboard}
      stateMachine={stateMachine}
      pointerTracking={pointerTracking}
      mood={mood}
      isSpeaking={isSpeaking}
      isListening={isListening}
      gesture={gesture}
      reduceMotion={reduceMotion}
      className={className}
    />
  );`;
const returnNew = `  return (
    <HomieRiveBoundary fallback={fallback} className={className} reason="Rive WebGL runtime failed in desktop mode.">
      <RiveHomieInner
        src={src}
        artboard={artboard}
        stateMachine={stateMachine}
        pointerTracking={pointerTracking}
        mood={mood}
        isSpeaking={isSpeaking}
        isListening={isListening}
        gesture={gesture}
        reduceMotion={reduceMotion}
        className={className}
      />
    </HomieRiveBoundary>
  );`;
rive = replaceOnce(rive, returnOld, returnNew, "boundary wrapped return");

fs.writeFileSync(rivePath, rive, "utf8");

// CSS badge polish
const cssStart = "/* ===== v10.36.81b Homie desktop webgl fallback hotfix ===== */";
const cssEnd = "/* ===== v10.36.81b Homie desktop webgl fallback hotfix END ===== */";
if (css.includes(cssStart) && css.includes(cssEnd)) {
  const s = css.indexOf(cssStart);
  const e = css.indexOf(cssEnd, s) + cssEnd.length;
  css = (css.slice(0, s) + css.slice(e)).trimEnd();
}
css += "\n\n" + [
  cssStart,
  ".homieRiveMissing{",
  "  border: 1px solid rgba(94,234,242,0.18);",
  "  background: rgba(94,234,242,0.08);",
  "  color: rgba(221,245,255,0.92);",
  "}",
  cssEnd
].join("\n") + "\n";
fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied desktop webgl fallback hotfix.");
console.log("Touched:");
console.log("- ui/src/components/RiveHomie.tsx");
console.log("- ui/src/components/homieRebuild.css");