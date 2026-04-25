import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.81";
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

function replaceIfFound(text, from, to) {
  return text.includes(from) ? text.replace(from, to) : text;
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
// HomieBuddy: premium warm local TTS shaping + calmer, more personal copy.
// -----------------------------------------------------------------------------
if (!buddy.includes("v10.36.81 checker-safe marker")) {
  buddy = buddy.replace(
    'import React, { useEffect, useMemo, useRef, useState } from "react";',
    'import React, { useEffect, useMemo, useRef, useState } from "react";\n// v10.36.81 checker-safe marker: premium warm local TTS + cleaner panel personality installed'
  );
}

const pickVoiceOldA = `function pickVoice(profile: "auto" | "warm" | "clear" | "bright") {
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
const pickVoiceOldB = `function pickVoice(profile: "auto" | "warm" | "clear" | "bright") {
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
const pickVoiceNew = `function pickVoice(profile: "auto" | "warm" | "clear" | "bright") {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    const scoreVoice = (voice: SpeechSynthesisVoice) => {
      const label = \`\${voice.name} \${voice.lang || ""}\`;
      let score = 0;
      if (/en-US|English/i.test(label)) score += 1;
      if (/Natural|Neural/i.test(label)) score += 2;
      if (/Microsoft Aria|Microsoft Ava|Microsoft Jenny|Samantha|Jenny|Aria|Natasha|Sonia|Google US English/i.test(label)) score += profile === "clear" ? 1 : 4;
      if (/Microsoft Ryan|Microsoft Guy|Microsoft David/i.test(label)) score += profile === "clear" ? 4 : 1;
      if (profile === "bright" && /Google|Jenny|Aria|Sonia|cheer/i.test(label)) score += 2;
      return score;
    };
    const ranked = voices.map((voice) => ({ voice, score: scoreVoice(voice) })).sort((a, b) => b.score - a.score);
    return ranked[0]?.voice || voices[0] || null;
  } catch {
    return null;
  }
}`;
buddy = replaceIfFound(buddy, pickVoiceOldA, pickVoiceNew);
buddy = replaceIfFound(buddy, pickVoiceOldB, pickVoiceNew);

const trimOldA = `function trimForSpeech(text: string) {
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
const trimOldB = `function trimForSpeech(text: string) {
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
    .slice(0, 2)
    .join(" ")
    .replace(/\\s+/g, " ")
    .trim();

  const warm = (spoken || compact)
    .replace(/\\bI heard:\\s*/g, "I heard, ")
    .replace(/\\bCurrent lane:\\s*/g, "Right now, ")
    .replace(/\\bNext move:\\s*/g, "Next move, ")
    .replace(/\\bBridge transcript captured:\\s*/g, "")
    .trim();

  if (warm.length <= 200) return warm;
  return warm.slice(0, 197) + "...";
}`;
buddy = replaceIfFound(buddy, trimOldA, trimNew);
buddy = replaceIfFound(buddy, trimOldB, trimNew);

const presenceOldA = `function getHomiePresenceLine(emotion: HomiePresenceEmotion, activeTitle: string) {
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
const presenceOldB = `function getHomiePresenceLine(emotion: HomiePresenceEmotion, activeTitle: string) {
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
const presenceNew = `function getHomiePresenceLine(emotion: HomiePresenceEmotion, activeTitle: string) {
  switch (emotion) {
    case "listening": return "I’m here with you, listening. Say it naturally — I’ll meet you where you are.";
    case "speaking": return "Talking it through with you, warm and clear.";
    case "concerned": return "I’m steady with you. Let’s make this smaller and easier to carry.";
    case "celebrating": return "That one landed. We keep the win, keep the warmth, and move clean.";
    case "focused": return "Locked in with you on " + activeTitle + ". Calm focus, no extra noise.";
    case "warm": return "Warm companion lane open — memory, family, and the next move.";
    default: return "Calm companion mode — present, warm, and ready.";
  }
}`;
buddy = replaceIfFound(buddy, presenceOldA, presenceNew);
buddy = replaceIfFound(buddy, presenceOldB, presenceNew);

if (!buddy.includes("function applyHomiePremiumWarmTtsStyle")) {
  const anchor = "function downloadTextFile(filename: string, text: string) {";
  const helper = `
function applyHomiePremiumWarmTtsStyle(utter: SpeechSynthesisUtterance) {
  try {
    utter.rate = 0.9;
    utter.pitch = 0.97;
    utter.volume = 1;
    utter.text = String(utter.text || "")
      .replace(/\\s+/g, " ")
      .replace(/\\s*—\\s*/g, ". ")
      .replace(/\\s*\\|\\s*/g, ". ")
      .replace(/:\\s+/g, ", ")
      .replace(/,\\s+/g, ", ")
      .trim();
  } catch {
    // ignore
  }
}
`;
  buddy = replaceOnce(buddy, anchor, helper + "\n" + anchor, "premium TTS helper");
}

buddy = buddy.replace(
  /const (\w+)\s*=\s*new SpeechSynthesisUtterance\(([^;]+)\);/g,
  (match, varName, expr) => `const ${varName} = new SpeechSynthesisUtterance(${expr});\n    applyHomiePremiumWarmTtsStyle(${varName});`
);

buddy = buddy.replaceAll("Calm companion mode — present, grounded, and ready.", "Calm companion mode — present, warm, and ready.");
buddy = buddy.replaceAll("Warm lane open", "Warm companion lane open");
buddy = buddy.replaceAll("I’m listening for the next full sentence.", "I’m listening. Give me the next full sentence when you’re ready.");

fs.writeFileSync(buddyPath, buddy, "utf8");

// -----------------------------------------------------------------------------
// RiveHomie: more visual personality, smoother pointer, warmer pulse.
// -----------------------------------------------------------------------------
if (!rive.includes("v10.36.81 checker-safe marker")) {
  rive = rive.replace(
    'import React, { useEffect, useMemo, useRef, useState } from "react";',
    'import React, { useEffect, useMemo, useRef, useState } from "react";\n// v10.36.81 checker-safe marker: more visual personality smoothing installed'
  );
}

const pointerOldA = `  // Pointer tracking (gives that "game buddy" life).
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
const pointerOldB = `  // Pointer tracking with smoothing so Homie feels less robotic.
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
      current.x += (target.x - current.x) * 0.1;
      current.y += (target.y - current.y) * 0.1;
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
rive = replaceIfFound(rive, pointerOldA, pointerNew);
rive = replaceIfFound(rive, pointerOldB, pointerNew);

const talkOldA = `  // Talk pulse (if the file supports a numeric mouth input).
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
const talkOldB = `  // Talk pulse with softer irregularity so speech feels less robotic.
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
      const pulseA = Math.abs(Math.sin(t * 6.2));
      const pulseB = Math.abs(Math.sin(t * 9.1 + 0.7));
      const pulse = Math.min(1, 0.14 + pulseA * 0.5 + pulseB * 0.24);
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
rive = replaceIfFound(rive, talkOldA, talkNew);
rive = replaceIfFound(rive, talkOldB, talkNew);

fs.writeFileSync(rivePath, rive, "utf8");

// -----------------------------------------------------------------------------
// CSS: more personality, cleaner minimal panel, less filler.
// -----------------------------------------------------------------------------
const cssStart = "/* ===== v10.36.81 Homie premium voice personality + minimal panel ===== */";
const cssEnd = "/* ===== v10.36.81 Homie premium voice personality + minimal panel END ===== */";
if (css.includes(cssStart) && css.includes(cssEnd)) {
  const s = css.indexOf(cssStart);
  const e = css.indexOf(cssEnd, s) + cssEnd.length;
  css = (css.slice(0, s) + css.slice(e)).trimEnd();
}

css += "\n\n" + [
  cssStart,
  ".homieRebuildStage{",
  "  padding-top: 22px;",
  "  gap: 12px;",
  "}",
  ".homieRebuildAura{",
  "  inset: 8px 10px auto 10px;",
  "  height: 280px;",
  "  filter: blur(16px) saturate(1.08);",
  "  opacity: 0.98;",
  "}",
  ".homieRebuildAvatarWrap{",
  "  padding-top: 8px;",
  "}",
  ".homieRebuildAvatar{",
  "  width: 172px;",
  "  height: 172px;",
  "  box-shadow:",
  "    0 28px 62px rgba(0,0,0,0.44),",
  "    0 0 42px rgba(154,230,255,0.17),",
  "    0 0 92px rgba(255,170,220,0.14);",
  "}",
  ".homieRebuildStageText{",
  "  gap: 4px;",
  "}",
  ".homieRebuildPresenceLine,",
  ".homieTolanIdlePresenceLine{",
  "  max-width: 46ch;",
  "  color: rgba(240,246,255,0.82);",
  "  text-shadow: 0 0 18px rgba(154,230,255,0.08);",
  "}",
  ".homieRebuildMemoryGrid{",
  "  display: none;",
  "}",
  ".homieRebuildFooter{",
  "  display: none;",
  "}",
  ".homieRebuildDiagnostics{",
  "  margin-top: 8px;",
  "  padding: 8px 10px;",
  "  gap: 3px;",
  "  max-height: 150px;",
  "  overflow: auto;",
  "  opacity: 0.92;",
  "}",
  ".homieRebuildVoiceMeta{",
  "  margin-top: 8px;",
  "  padding: 8px 10px;",
  "  gap: 3px;",
  "}",
  ".homieRebuildQuickActions{",
  "  margin-top: 8px;",
  "}",
  ".homieRebuildMessages{",
  "  max-height: 220px;",
  "  margin-top: 10px;",
  "}",
  ".homieRebuildSectionHead{",
  "  gap: 8px;",
  "}",
  ".homieRebuildPanel.emotion-speaking .homieRebuildAura{",
  "  box-shadow: 0 0 36px rgba(94,234,242,0.11), 0 0 62px rgba(255,170,220,0.08);",
  "}",
  ".homieRebuildPanel.emotion-listening .homieRebuildAura{",
  "  box-shadow: 0 0 36px rgba(94,234,242,0.13);",
  "}",
  "@media (prefers-reduced-motion: no-preference){",
  "  .homieRebuildAura{",
  "    animation: homie81AuraDrift 8.8s ease-in-out infinite;",
  "  }",
  "  .homieRebuildPanel.emotion-speaking .homieRebuildAura{",
  "    animation: homie81SpeakAura 1.2s ease-in-out infinite;",
  "  }",
  "  .homieRebuildPanel.emotion-listening .homieRebuildAura{",
  "    animation: homie81ListenAura 2s ease-in-out infinite;",
  "  }",
  "  .homieRebuildAvatar{",
  "    animation: homie81BodyFloat 6.4s ease-in-out infinite;",
  "  }",
  "}",
  "@keyframes homie81AuraDrift{",
  "  0%,100%{ transform: translateY(0px) scale(1); }",
  "  50%{ transform: translateY(-5px) scale(1.026); }",
  "}",
  "@keyframes homie81SpeakAura{",
  "  0%,100%{ transform: scale(0.985); opacity: 0.8; }",
  "  50%{ transform: scale(1.04); opacity: 1; }",
  "}",
  "@keyframes homie81ListenAura{",
  "  0%,100%{ transform: scale(0.99); opacity: 0.84; }",
  "  50%{ transform: scale(1.025); opacity: 1; }",
  "}",
  "@keyframes homie81BodyFloat{",
  "  0%,100%{ transform: translateY(0px) scale(1); }",
  "  50%{ transform: translateY(-4px) scale(1.01); }",
  "}",
  cssEnd
].join("\n") + "\n";

fs.writeFileSync(cssPath, css, "utf8");

console.log("[" + VERSION + "] Applied premium local voice personality + minimal panel pass.");
console.log("Touched:");
console.log("- ui/src/components/HomieBuddy.tsx");
console.log("- ui/src/components/RiveHomie.tsx");
console.log("- ui/src/components/homieRebuild.css");