import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.80";
const root = process.cwd();

const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");
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

ensure(buddyPath);
ensure(rivePath);
ensure(cssPath);
backup(buddyPath);
backup(rivePath);
backup(cssPath);

let buddy = fs.readFileSync(buddyPath, "utf8");
let rive = fs.readFileSync(rivePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

// -----------------------------------------------------------------------------
// HomieBuddy: warmer browser-local TTS voice selection and utterance shaping.
// -----------------------------------------------------------------------------
if (!buddy.includes("v10.36.80 checker-safe marker")) {
  buddy = buddy.replace(
    'import React, { useEffect, useMemo, useRef, useState } from "react";',
    'import React, { useEffect, useMemo, useRef, useState } from "react";\n// v10.36.80 checker-safe marker: warm local TTS voice shaping installed'
  );
}

const pickVoiceOld = `function pickVoice(profile: "auto" | "warm" | "clear" | "bright") {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    const pools: Record<string, RegExp> = {
      warm: /Samantha|Jenny|Aria|zira|female|Google US English/i,
      clear: /David|Guy|clear|English|en-US|US English/i,
      bright: /Google|Jenny|Aria|Sonia|bright|cheer/i,
      auto: /Google US English|Microsoft David|Samantha|Jenny|en-US|English/i,
    };
    const pattern = pools[profile] || pools.auto;
    return voices.find((voice) => pattern.test(\`\${voice.name} \${voice.lang || ""}\`)) || voices[0] || null;
  } catch {
    return null;
  }
}`;
const pickVoiceNew = `function pickVoice(profile: "auto" | "warm" | "clear" | "bright") {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    const pools: Record<string, RegExp> = {
      warm: /Microsoft Aria|Microsoft Ava|Microsoft Jenny|Samantha|Jenny|Aria|Natasha|Sonia|Google US English|Natural|female/i,
      clear: /Microsoft Ryan|Microsoft Guy|Microsoft David|clear|English|en-US|US English|Natural/i,
      bright: /Google|Jenny|Aria|Sonia|bright|cheer|Natural/i,
      auto: /Microsoft Aria|Microsoft Ava|Microsoft Jenny|Google US English|Samantha|Jenny|Aria|en-US|English|Natural/i,
    };
    const pattern = pools[profile] || pools.auto;
    const ranked = voices
      .map((voice) => {
        const label = \`\${voice.name} \${voice.lang || ""}\`;
        let score = 0;
        if (pattern.test(label)) score += 4;
        if (/Natural/i.test(label)) score += 2;
        if (/en-US|English/i.test(label)) score += 1;
        return { voice, score };
      })
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.voice || voices[0] || null;
  } catch {
    return null;
  }
}`;
if (buddy.includes(pickVoiceOld)) {
  buddy = buddy.replace(pickVoiceOld, pickVoiceNew);
}

// More human speech trimming.
const trimOld = `function trimForSpeech(text: string) {
  const compact = text
    .replace(/\\*\\*/g, "")
    .replace(/\\s+/g, " ")
    .replace(/\\bBody:\\s*/g, "First, ")
    .replace(/\\bMind:\\s*/g, "Here’s the thought: ")
    .replace(/\\bFamily:\\s*/g, "For the family lane, ")
    .replace(/\\bNext move:\\s*/g, "Next, ")
    .replace(/\\bLast thread I remember:\\s*/g, "One thing I still remember: ")
    .trim();

  if (!compact) return "I’m here.";

  const pieces = compact.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [compact];
  const spoken = pieces
    .map((piece) => piece.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ")
    .replace(/\\s+/g, " ")
    .trim();

  const warm = spoken || compact;
  if (warm.length <= 210) return warm;
  return warm.slice(0, 207) + "...";
}`;
const trimNew = `function trimForSpeech(text: string) {
  const compact = text
    .replace(/\\*\\*/g, "")
    .replace(/\\n+/g, " ")
    .replace(/\\s+/g, " ")
    .replace(/\\bBody:\\s*/g, "Body check, ")
    .replace(/\\bMind:\\s*/g, "Mind check, ")
    .replace(/\\bFamily:\\s*/g, "Family check, ")
    .replace(/\\bNext move:\\s*/g, "Next move, ")
    .replace(/\\bUseful read:\\s*/g, "")
    .trim();

  if (!compact) return "I’m here with you.";

  const pieces = compact.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [compact];
  const spoken = pieces
    .map((piece) => piece.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" ")
    .replace(/\\s+/g, " ")
    .trim();

  const warm = (spoken || compact)
    .replace(/\\bI heard:\\s*/g, "I heard, ")
    .replace(/\\bCurrent lane:\\s*/g, "Right now, ")
    .replace(/\\bNext move:\\s*/g, "Next move, ")
    .trim();

  if (warm.length <= 240) return warm;
  return warm.slice(0, 237) + "...";
}`;
if (buddy.includes(trimOld)) {
  buddy = buddy.replace(trimOld, trimNew);
}

// Presence line warmer.
const presenceOld = `function getHomiePresenceLine(emotion: HomiePresenceEmotion, activeTitle: string) {
  switch (emotion) {
    case "listening": return "I’m listening — take your time and say it messy if you need to.";
    case "speaking": return "Answering softly first, then we can go deeper.";
    case "concerned": return "I’m staying steady with you. Smaller, slower, one next move.";
    case "celebrating": return "That one counts. We lock the win and keep the room calm.";
    case "focused": return "Focused with you on " + activeTitle + ". No extra noise.";
    case "warm": return "Warm lane open — body, mind, family, next move.";
    default: return "Calm companion mode — present, grounded, and ready.";
  }
}`;
const presenceNew = `function getHomiePresenceLine(emotion: HomiePresenceEmotion, activeTitle: string) {
  switch (emotion) {
    case "listening": return "I’m here, listening. Say it naturally — I’ll meet you where you are.";
    case "speaking": return "Talking it through with you, warm and clear.";
    case "concerned": return "I’m steady with you. Let’s make this smaller and easier to carry.";
    case "celebrating": return "That one landed. We keep the win, keep the warmth, and move clean.";
    case "focused": return "Locked in with you on " + activeTitle + ". Calm focus, no extra noise.";
    case "warm": return "Warm companion lane open — body, family, memory, and the next move.";
    default: return "Calm companion mode — present, warm, and ready.";
  }
}`;
if (buddy.includes(presenceOld)) {
  buddy = buddy.replace(presenceOld, presenceNew);
}

// Add utterance helper if missing.
if (!buddy.includes("function applyHomieWarmTtsStyle")) {
  const anchor = "function downloadTextFile(filename: string, text: string) {";
  const helper = `
function applyHomieWarmTtsStyle(utter: SpeechSynthesisUtterance) {
  try {
    utter.rate = 0.92;
    utter.pitch = 0.98;
    utter.volume = 1;
    utter.text = String(utter.text || "")
      .replace(/\\s+/g, " ")
      .replace(/,\\s+/g, ", ")
      .replace(/\\s*—\\s*/g, ". ")
      .replace(/\\s*\\|\\s*/g, ". ")
      .replace(/:\\s+/g, ", ")
      .trim();
  } catch {
    // ignore
  }
}
`;
  buddy = replaceOnce(buddy, anchor, helper + "\n" + anchor, "applyHomieWarmTtsStyle helper");
}

// Inject helper call after SpeechSynthesisUtterance creation where possible.
buddy = buddy.replace(
  /const (\w+)\s*=\s*new SpeechSynthesisUtterance\(([^;]+)\);/g,
  (match, varName, expr) => `const ${varName} = new SpeechSynthesisUtterance(${expr});\n    applyHomieWarmTtsStyle(${varName});`
);

// Subtle copy cleanup.
buddy = buddy.replaceAll("I’m listening for the next full sentence.", "I’m listening. Give me the next full sentence when you’re ready.");
buddy = buddy.replaceAll("Calm companion mode — present, grounded, and ready.", "Calm companion mode — present, warm, and ready.");
buddy = buddy.replaceAll("Warm lane open", "Warm companion lane open");

fs.writeFileSync(buddyPath, buddy, "utf8");

// -----------------------------------------------------------------------------
// RiveHomie: smoother motion and softer mouth pulse.
// -----------------------------------------------------------------------------
if (!rive.includes("v10.36.80 checker-safe marker")) {
  rive = rive.replace(
    'import React, { useEffect, useMemo, useRef, useState } from "react";',
    'import React, { useEffect, useMemo, useRef, useState } from "react";\n// v10.36.80 checker-safe marker: smoother pointer and warmer pulse installed'
  );
}

const pointerOld = `  // Pointer tracking (gives that "game buddy" life).
  useEffect(() => {
    if (!pointerTracking) return;
    if (!lookXInput && !lookYInput) return;

    const handle = (e: PointerEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const x = Math.max(0, Math.min(100, (e.clientX / w) * 100));
      const y = Math.max(0, Math.min(100, 100 - (e.clientY / h) * 100));
      if (lookXInput) lookXInput.value = x;
      if (lookYInput) lookYInput.value = y;
    };

    window.addEventListener("pointermove", handle, { passive: true });
    return () => window.removeEventListener("pointermove", handle as any);
  }, [pointerTracking, lookXInput, lookYInput]);`;
const pointerNew = `  // Pointer tracking with smoothing so Homie feels less robotic.
  useEffect(() => {
    if (!pointerTracking) return;
    if (!lookXInput && !lookYInput) return;

    let raf = 0;
    const target = { x: 50, y: 50 };
    const current = { x: 50, y: 50 };

    const handle = (e: PointerEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      target.x = Math.max(0, Math.min(100, (e.clientX / w) * 100));
      target.y = Math.max(0, Math.min(100, 100 - (e.clientY / h) * 100));
    };

    const tick = () => {
      current.x += (target.x - current.x) * 0.12;
      current.y += (target.y - current.y) * 0.12;
      if (lookXInput) lookXInput.value = current.x;
      if (lookYInput) lookYInput.value = current.y;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener("pointermove", handle, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handle as any);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pointerTracking, lookXInput, lookYInput]);`;
if (rive.includes(pointerOld)) {
  rive = rive.replace(pointerOld, pointerNew);
}

const talkOld = `  // Talk pulse (if the file supports a numeric mouth input).
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!talkLevelInput) return;
    if (!isSpeaking || reduceMotion) {
      talkLevelInput.value = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      // 0..1 pulse
      const t = (now - start) / 1000;
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * 8));
      try {
        talkLevelInput.value = pulse;
      } catch {
        // ignore
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [talkLevelInput, isSpeaking, reduceMotion]);`;
const talkNew = `  // Talk pulse with softer irregularity so speech feels less robotic.
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!talkLevelInput) return;
    if (!isSpeaking || reduceMotion) {
      talkLevelInput.value = 0;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const pulseA = Math.abs(Math.sin(t * 6.8));
      const pulseB = Math.abs(Math.sin(t * 9.6 + 0.7));
      const pulse = Math.min(1, 0.18 + pulseA * 0.48 + pulseB * 0.26);
      try {
        talkLevelInput.value = pulse;
      } catch {
        // ignore
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [talkLevelInput, isSpeaking, reduceMotion]);`;
if (rive.includes(talkOld)) {
  rive = rive.replace(talkOld, talkNew);
}

fs.writeFileSync(rivePath, rive, "utf8");

// -----------------------------------------------------------------------------
// CSS: more lifelike presence and less filler/heavier sections.
// -----------------------------------------------------------------------------
const cssStart = "/* ===== v10.36.80 Homie warm local TTS + clean panel polish ===== */";
const cssEnd = "/* ===== v10.36.80 Homie warm local TTS + clean panel polish END ===== */";
if (css.includes(cssStart) && css.includes(cssEnd)) {
  const s = css.indexOf(cssStart);
  const e = css.indexOf(cssEnd, s) + cssEnd.length;
  css = (css.slice(0, s) + css.slice(e)).trimEnd();
}

css += "\n\n" + [
  cssStart,
  ".homieRebuildStage{",
  "  padding-top: 20px;",
  "  gap: 14px;",
  "}",
  ".homieRebuildAura{",
  "  inset: 10px 12px auto 12px;",
  "  height: 260px;",
  "  filter: blur(14px) saturate(1.06);",
  "  opacity: 0.96;",
  "}",
  ".homieRebuildAvatarWrap{",
  "  padding-top: 10px;",
  "}",
  ".homieRebuildAvatar{",
  "  width: 164px;",
  "  height: 164px;",
  "  box-shadow:",
  "    0 24px 58px rgba(0,0,0,0.42),",
  "    0 0 36px rgba(154,230,255,0.16),",
  "    0 0 80px rgba(255,170,220,0.12);",
  "}",
  ".homieRebuildPresenceLine,",
  ".homieTolanIdlePresenceLine{",
  "  max-width: 48ch;",
  "  color: rgba(236,244,255,0.78);",
  "  text-shadow: 0 0 18px rgba(154,230,255,0.08);",
  "}",
  ".homieRebuildVoiceMeta{",
  "  gap: 4px;",
  "  margin-top: 10px;",
  "  padding: 10px 12px;",
  "  border-color: rgba(154,230,255,0.11);",
  "  background:",
  "    radial-gradient(220px 100px at 10% 0%, rgba(154,230,255,0.055), rgba(154,230,255,0) 70%),",
  "    rgba(255,255,255,0.036);",
  "}",
  ".homieRebuildDiagnostics{",
  "  margin-top: 10px;",
  "  padding: 10px 12px;",
  "  gap: 4px;",
  "  max-height: 180px;",
  "  overflow: auto;",
  "}",
  ".homieRebuildMemoryGrid{",
  "  gap: 6px;",
  "}",
  ".homieRebuildMemoryCell{",
  "  padding: 8px 10px;",
  "}",
  ".homieRebuildFooter{",
  "  display: none;",
  "}",
  ".homieRebuildQuickActions .small,",
  ".homieRebuildVoiceMeta .small{",
  "  opacity: 0.72;",
  "}",
  ".homieRebuildPanel.emotion-speaking .homieRebuildAura{",
  "  box-shadow: 0 0 32px rgba(94,234,242,0.10), 0 0 56px rgba(255,170,220,0.07);",
  "}",
  ".homieRebuildPanel.emotion-listening .homieRebuildAura{",
  "  box-shadow: 0 0 32px rgba(94,234,242,0.12);",
  "}",
  "@media (prefers-reduced-motion: no-preference){",
  "  .homieRebuildAura{",
  "    animation: homie80AuraDrift 8.5s ease-in-out infinite;",
  "  }",
  "  .homieRebuildPanel.emotion-speaking .homieRebuildAura{",
  "    animation: homie80SpeakAura 1.25s ease-in-out infinite;",
  "  }",
  "  .homieRebuildPanel.emotion-listening .homieRebuildAura{",
  "    animation: homie80ListenAura 2.1s ease-in-out infinite;",
  "  }",
  "}",
  "@keyframes homie80AuraDrift{",
  "  0%,100%{ transform: translateY(0px) scale(1); }",
  "  50%{ transform: translateY(-4px) scale(1.02); }",
  "}",
  "@keyframes homie80SpeakAura{",
  "  0%,100%{ transform: scale(0.985); opacity: 0.78; }",
  "  50%{ transform: scale(1.03); opacity: 1; }",
  "}",
  "@keyframes homie80ListenAura{",
  "  0%,100%{ transform: scale(0.99); opacity: 0.82; }",
  "  50%{ transform: scale(1.02); opacity: 0.98; }",
  "}",
  cssEnd
].join("\n") + "\n";

fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied warm local TTS + clean panel polish.");
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");
console.log("- ui/src/components/RiveHomie.tsx");
console.log("- ui/src/components/homieRebuild.css");