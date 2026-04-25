import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useRive,
  useStateMachineInput,
  Layout,
  Fit,
  Alignment,
} from "@rive-app/react-webgl2";

// v10.36.91 checker-safe marker: Homie memoji-inspired full-body hoodie avatar installed

export type HomieMood = "idle" | "good" | "warn";
export type HomieGesture = "none" | "wink" | "wave" | "nod" | "tilt" | "spark";

export type RiveHomieProps = {
  enabled: boolean;
  src: string;
  artboard?: string;
  stateMachine: string;
  pointerTracking: boolean;
  mood: HomieMood;
  isSpeaking: boolean;
  isListening: boolean;
  gesture: HomieGesture;
  reduceMotion: boolean;
  className?: string;
  fallback: React.ReactNode;
};

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

type CanvasFallbackProps = {
  mood: HomieMood;
  isSpeaking: boolean;
  isListening: boolean;
  pointerTracking: boolean;
  gesture: HomieGesture;
  reduceMotion: boolean;
  className?: string;
  badge?: string;
  fallback?: React.ReactNode;
};

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function CanvasHomieFallback({
  mood,
  isSpeaking,
  isListening,
  pointerTracking,
  gesture,
  reduceMotion,
  className,
  badge,
  fallback,
}: CanvasFallbackProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setCanvasReady(true);

    let raf = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const gaze = { x: 0, y: 0, tx: 0, ty: 0 };

    const handlePointer = (e: PointerEvent) => {
      if (!pointerTracking) return;
      const rect = canvas.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      const py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
      pointer.tx = Math.max(-1, Math.min(1, px));
      pointer.ty = Math.max(-1, Math.min(1, py));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(360, Math.round(rect.width * dpr));
      canvas.height = Math.max(448, Math.round(rect.height * dpr));
    };

    const drawGlowDot = (x: number, y: number, r: number, inner: string, outer = "rgba(255,255,255,0)") => {
      const g = ctx.createRadialGradient(x, y, 0.5, x, y, r);
      g.addColorStop(0, inner);
      g.addColorStop(1, outer);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointer, { passive: true });

    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w * 0.5;
      const cy = h * 0.51;
      const time = t / 1000;

      pointer.x += (pointer.tx - pointer.x) * 0.08;
      pointer.y += (pointer.ty - pointer.y) * 0.08;

      const moodWarn = mood === "warn";
      const moodGood = mood === "good";
      const wave = gesture === "wave" ? 1 : 0;
      const wink = gesture === "wink" ? 1 : 0;
      const nod = gesture === "nod" ? 1 : 0;
      const tilt = gesture === "tilt" ? 1 : 0;
      const spark = gesture === "spark" ? 1 : 0;

      const breathe = reduceMotion ? 0 : Math.sin(time * 1.12) * 4.6;
      const bodySway = reduceMotion ? 0 : Math.sin(time * 0.78) * 0.032;
      const idleLift = reduceMotion ? 0 : Math.sin(time * 0.56 + 0.4) * 2.4;
      const nodOffset = nod ? Math.sin(time * 6.4) * 5.5 : 0;
      const tiltOffset = tilt ? Math.sin(time * 4.1) * 0.11 : 0;
      const speakingBounce = isSpeaking && !reduceMotion ? Math.sin(time * 5.6) * 1.4 : 0;

      const saccadeX = reduceMotion ? 0 : Math.sin(time * 0.92) * 0.08 + Math.sin(time * 1.84 + 1.2) * 0.04;
      const saccadeY = reduceMotion ? 0 : Math.sin(time * 0.81 + 0.7) * 0.05;
      gaze.tx = (pointerTracking ? pointer.x * 0.7 : 0) + saccadeX;
      gaze.ty = (pointerTracking ? pointer.y * 0.35 : 0) + saccadeY;
      gaze.x += (gaze.tx - gaze.x) * 0.11;
      gaze.y += (gaze.ty - gaze.y) * 0.11;

      const eyeShiftX = gaze.x * 5.8;
      const eyeShiftY = gaze.y * 2.8;

      const blinkA = reduceMotion ? 1 : Math.sin(time * 0.86) > 0.989 ? 0.08 : 1;
      const blinkB = reduceMotion ? 1 : Math.sin(time * 1.12 + 1.85) > 0.996 ? 0.18 : 1;
      const blink = Math.min(blinkA, blinkB);
      const leftBlink = wink ? 0.12 : blink;
      const rightBlink = blink;

      const listeningLift = isListening ? 3 : 0;
      const browRaise = moodGood ? 2 : moodWarn ? -1.4 : 0.7 + (isListening ? 1.6 : 0);
      const browTilt = moodWarn ? 0.12 : isListening ? -0.08 : -0.03;

      const mouthBase = moodWarn ? 1.7 : moodGood ? 8.6 : 6.2;
      const mouthSpeak = isSpeaking ? 11 + Math.sin(time * 13.4) * 4.6 : 0;
      const mouthSmile = mouthBase + mouthSpeak + (isListening ? 1.8 : 0);

      const auraScale = isSpeaking
        ? 1 + (reduceMotion ? 0 : Math.sin(time * 5.2) * 0.055)
        : isListening
        ? 1 + (reduceMotion ? 0 : Math.sin(time * 2.6) * 0.028)
        : 1 + (reduceMotion ? 0 : Math.sin(time * 0.98) * 0.014);

      ctx.clearRect(0, 0, w, h);

      // Panel / pod
      const podBg = ctx.createLinearGradient(0, 0, 0, h);
      podBg.addColorStop(0, "#182337");
      podBg.addColorStop(0.52, "#10172a");
      podBg.addColorStop(1, "#090e18");
      roundedRectPath(ctx, w * 0.12, h * 0.08, w * 0.76, h * 0.80, 38);
      ctx.fillStyle = podBg;
      ctx.fill();

      const innerGlass = ctx.createLinearGradient(0, h * 0.11, 0, h * 0.76);
      innerGlass.addColorStop(0, "rgba(255,255,255,0.12)");
      innerGlass.addColorStop(0.24, "rgba(255,255,255,0.03)");
      innerGlass.addColorStop(1, "rgba(255,255,255,0)");
      roundedRectPath(ctx, w * 0.15, h * 0.11, w * 0.70, h * 0.72, 32);
      ctx.fillStyle = innerGlass;
      ctx.fill();

      // aura
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(auraScale + spark * 0.035, auraScale + spark * 0.035);
      ctx.translate(-cx, -cy);
      const aura = ctx.createRadialGradient(cx, cy - 20, 8, cx, cy, Math.min(w, h) * 0.36);
      if (moodWarn) {
        aura.addColorStop(0, "rgba(255,210,118,0.26)");
        aura.addColorStop(0.44, "rgba(255,170,220,0.10)");
        aura.addColorStop(1, "rgba(0,0,0,0)");
      } else {
        aura.addColorStop(0, "rgba(154,230,255,0.24)");
        aura.addColorStop(0.44, "rgba(255,170,220,0.11)");
        aura.addColorStop(1, "rgba(0,0,0,0)");
      }
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.24, h * 0.30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // ambient lights
      drawGlowDot(cx - 42, cy - 72 + Math.sin(time * 1.1) * 7, 9, "rgba(255,196,132,0.82)");
      drawGlowDot(cx + 35, cy - 34 + Math.sin(time * 1.45 + 0.3) * 7, 7, "rgba(153,235,255,0.86)");
      drawGlowDot(cx - 6, cy + 10 + Math.sin(time * 0.8) * 6, 6, "rgba(255,255,255,0.86)");
      if (spark) {
        drawGlowDot(cx + 52, cy - 12 + Math.sin(time * 1.7) * 9, 8, "rgba(255,214,102,0.88)");
        drawGlowDot(cx - 55, cy + 26 + Math.sin(time * 1.4 + 1) * 8, 7, "rgba(255,214,102,0.78)");
      }

      // floor shadow
      ctx.fillStyle = "rgba(3,5,12,0.48)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + 172, 86, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy + breathe + idleLift + nodOffset + speakingBounce);
      ctx.rotate(bodySway + tiltOffset);

      // hoodie shadow wings
      const wingGlow = (x: number, rot: number) => {
        const g = ctx.createRadialGradient(x, 36, 10, x, 36, 72);
        g.addColorStop(0, "rgba(126,158,255,0.16)");
        g.addColorStop(1, "rgba(126,158,255,0)");
        ctx.save();
        ctx.rotate(rot);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, 36, 62, 34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      wingGlow(-98, -0.1);
      wingGlow(98, 0.1);

      // jeans legs
      const jeanGrad = ctx.createLinearGradient(0, 120, 0, 232);
      jeanGrad.addColorStop(0, "#4d6fbb");
      jeanGrad.addColorStop(0.62, "#3e5f9d");
      jeanGrad.addColorStop(1, "#293f72");
      ctx.fillStyle = jeanGrad;
      roundedRectPath(ctx, -29, 118, 22, 82, 12);
      ctx.fill();
      roundedRectPath(ctx, 7, 118, 22, 82, 12);
      ctx.fill();

      // shoes
      const shoeGrad = ctx.createLinearGradient(0, 196, 0, 216);
      shoeGrad.addColorStop(0, "#1d2437");
      shoeGrad.addColorStop(1, "#0d1119");
      ctx.fillStyle = shoeGrad;
      roundedRectPath(ctx, -40, 194, 38, 18, 10);
      ctx.fill();
      roundedRectPath(ctx, 2, 194, 38, 18, 10);
      ctx.fill();

      // hoodie torso
      const hoodie = ctx.createLinearGradient(0, 4, 0, 160);
      hoodie.addColorStop(0, "#8d939b");
      hoodie.addColorStop(0.28, "#7e868e");
      hoodie.addColorStop(0.72, "#5f6770");
      hoodie.addColorStop(1, "#484f59");
      ctx.fillStyle = hoodie;
      roundedRectPath(ctx, -64, -2, 128, 142, 34);
      ctx.fill();

      // hoodie opening
      const hoodieInner = ctx.createLinearGradient(0, 12, 0, 96);
      hoodieInner.addColorStop(0, "#3b4249");
      hoodieInner.addColorStop(1, "#20262d");
      ctx.fillStyle = hoodieInner;
      roundedRectPath(ctx, -30, 10, 60, 42, 18);
      ctx.fill();

      // zipper + strings
      ctx.strokeStyle = "rgba(230,238,248,0.54)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.lineTo(0, 136);
      ctx.stroke();

      ctx.strokeStyle = "rgba(220,228,238,0.66)";
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(-12, 16);
      ctx.lineTo(-16, 40);
      ctx.moveTo(12, 16);
      ctx.lineTo(16, 42);
      ctx.stroke();
      drawGlowDot(-16, 40, 2.5, "rgba(255,255,255,0.9)");
      drawGlowDot(16, 42, 2.5, "rgba(255,255,255,0.9)");

      // sleeves + hands
      const handY = 90 + (wave ? Math.sin(time * 8.8) * 18 - 26 : 0);
      ctx.fillStyle = "#7e868e";
      roundedRectPath(ctx, -88, 32, 34, 78, 16);
      ctx.fill();
      roundedRectPath(ctx, 54, 32, 34, 78, 16);
      ctx.fill();

      ctx.fillStyle = "#d4a37f";
      ctx.beginPath();
      ctx.arc(-71, handY, 14, 0, Math.PI * 2);
      ctx.arc(71, 94, 14, 0, Math.PI * 2);
      ctx.fill();

      // neck
      ctx.fillStyle = "#d5a37c";
      roundedRectPath(ctx, -16, -26, 32, 24, 12);
      ctx.fill();

      // ears
      ctx.fillStyle = "#d19b72";
      ctx.beginPath();
      ctx.arc(-60, -56, 10, 0, Math.PI * 2);
      ctx.arc(60, -56, 10, 0, Math.PI * 2);
      ctx.fill();

      // head
      const faceGrad = ctx.createLinearGradient(0, -138, 0, -14);
      faceGrad.addColorStop(0, "#e4bb93");
      faceGrad.addColorStop(0.56, "#d7a57d");
      faceGrad.addColorStop(1, "#c79066");
      ctx.fillStyle = faceGrad;
      roundedRectPath(ctx, -58, -134, 116, 122, 46);
      ctx.fill();

      // cap
      const capGrad = ctx.createLinearGradient(0, -158, 0, -92);
      capGrad.addColorStop(0, "#dfe3e7");
      capGrad.addColorStop(0.7, "#cfd5da");
      capGrad.addColorStop(1, "#bbc2c8");
      ctx.fillStyle = capGrad;
      roundedRectPath(ctx, -62, -144, 124, 52, 28);
      ctx.fill();

      ctx.fillStyle = "#d6dbe0";
      ctx.beginPath();
      ctx.moveTo(-34, -96);
      ctx.quadraticCurveTo(0, -78, 34, -96);
      ctx.quadraticCurveTo(0, -84, -34, -96);
      ctx.fill();

      // eyebrows
      const browY = -88 - browRaise - listeningLift * 0.45;
      ctx.strokeStyle = "#5e3e2b";
      ctx.lineWidth = 5.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-40, browY);
      ctx.lineTo(-12, browY + 4 + browTilt * 20);
      ctx.moveTo(12, browY + 4 + browTilt * 20);
      ctx.lineTo(40, browY);
      ctx.stroke();

      // glasses
      ctx.strokeStyle = "rgba(170,185,206,0.88)";
      ctx.lineWidth = 3;
      roundedRectPath(ctx, -40, -82, 34, 22, 8);
      ctx.stroke();
      roundedRectPath(ctx, 6, -82, 34, 22, 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-6, -72);
      ctx.lineTo(6, -72);
      ctx.stroke();

      // eyes
      const eyeY = -70 + eyeShiftY - listeningLift * 0.3;
      ctx.save();
      ctx.translate(eyeShiftX, 0);

      // sclera
      ctx.fillStyle = "#f4f7fb";
      roundedRectPath(ctx, -35, eyeY - 10, 24, 18, 8);
      ctx.fill();
      roundedRectPath(ctx, 11, eyeY - 10, 24, 18, 8);
      ctx.fill();

      // iris + pupil
      const leftEyeHeight = 18 * leftBlink;
      const rightEyeHeight = 18 * rightBlink;
      ctx.fillStyle = "#5d6e85";
      roundedRectPath(ctx, -30, eyeY - leftEyeHeight * 0.5, 12, leftEyeHeight, 6);
      ctx.fill();
      roundedRectPath(ctx, 18, eyeY - rightEyeHeight * 0.5, 12, rightEyeHeight, 6);
      ctx.fill();

      ctx.fillStyle = "#1d2633";
      roundedRectPath(ctx, -28, eyeY - leftEyeHeight * 0.42, 7, leftEyeHeight * 0.84, 4);
      ctx.fill();
      roundedRectPath(ctx, 21, eyeY - rightEyeHeight * 0.42, 7, rightEyeHeight * 0.84, 4);
      ctx.fill();

      drawGlowDot(-24, eyeY - 5, 1.6, "rgba(255,255,255,0.92)");
      drawGlowDot(24, eyeY - 5, 1.6, "rgba(255,255,255,0.92)");
      ctx.restore();

      // nose
      ctx.strokeStyle = "rgba(167,112,83,0.9)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -58);
      ctx.lineTo(-3, -38);
      ctx.quadraticCurveTo(0, -34, 6, -37);
      ctx.stroke();

      // cheeks
      ctx.fillStyle = moodWarn ? "rgba(255,204,170,0.16)" : "rgba(255,180,200,0.22)";
      ctx.beginPath();
      ctx.arc(-31, -38, 9, 0, Math.PI * 2);
      ctx.arc(31, -38, 9, 0, Math.PI * 2);
      ctx.fill();

      // beard
      const beardGrad = ctx.createLinearGradient(0, -22, 0, 72);
      beardGrad.addColorStop(0, "#5b341e");
      beardGrad.addColorStop(0.42, "#6e4127");
      beardGrad.addColorStop(1, "#3d2414");
      ctx.fillStyle = beardGrad;
      ctx.beginPath();
      ctx.moveTo(-42, -16);
      ctx.quadraticCurveTo(-34, 6, -28, 16);
      ctx.quadraticCurveTo(-18, 36, 0, 54);
      ctx.quadraticCurveTo(18, 36, 28, 16);
      ctx.quadraticCurveTo(34, 6, 42, -16);
      ctx.quadraticCurveTo(16, -4, 0, -2);
      ctx.quadraticCurveTo(-16, -4, -42, -16);
      ctx.closePath();
      ctx.fill();

      // smile mouth
      ctx.strokeStyle = moodWarn ? "rgba(130,88,60,0.94)" : "rgba(88,54,38,0.94)";
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(-18, -22);
      ctx.quadraticCurveTo(0, -10 + mouthSmile, 18, -22);
      ctx.stroke();

      // teeth smile hint
      if (isSpeaking || moodGood) {
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        roundedRectPath(ctx, -10, -18, 20, 7, 4);
        ctx.fill();
      }

      // hoodie pocket
      ctx.strokeStyle = "rgba(235,240,246,0.34)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-34, 82);
      ctx.quadraticCurveTo(0, 108, 34, 82);
      ctx.stroke();

      ctx.restore();

      // inner frame line
      ctx.strokeStyle = "rgba(154,230,255,0.12)";
      ctx.lineWidth = 2;
      roundedRectPath(ctx, w * 0.15, h * 0.11, w * 0.70, h * 0.72, 32);
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointer as any);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mood, isSpeaking, isListening, pointerTracking, gesture, reduceMotion]);

  return (
    <span className={`homieCanvasFallbackWrap ${className || ""}`.trim()}>
      <span className="homieCanvasFallbackClip">
        <canvas ref={canvasRef} className="homieCanvasFallbackCanvas" />
      </span>
      {badge ? <span className="homieCanvasFallbackBadge" title={badge}>{badge}</span> : null}
      {!canvasReady && fallback ? <span className="homieCanvasFallbackNode">{fallback}</span> : null}
    </span>
  );
}

type HomieRiveBoundaryProps = {
  fallback: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  mood: HomieMood;
  isSpeaking: boolean;
  isListening: boolean;
  pointerTracking: boolean;
  gesture: HomieGesture;
  reduceMotion: boolean;
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
    // keep UI stable and use the full-body canvas fallback instead
  }

  render() {
    if (this.state.hasError) {
      return (
        <CanvasHomieFallback
          mood={this.props.mood}
          isSpeaking={this.props.isSpeaking}
          isListening={this.props.isListening}
          pointerTracking={this.props.pointerTracking}
          gesture={this.props.gesture}
          reduceMotion={this.props.reduceMotion}
          className={this.props.className}
          badge="Desktop-safe avatar"
          fallback={this.props.fallback}
        />
      );
    }
    return this.props.children as any;
  }
}

export default function RiveHomie(props: RiveHomieProps) {
  const {
    enabled,
    src,
    artboard,
    stateMachine,
    pointerTracking,
    mood,
    isSpeaking,
    isListening,
    gesture,
    reduceMotion,
    className,
    fallback,
  } = props;

  const [availability, setAvailability] = useState<"unknown" | "ok" | "missing">("unknown");
  const [webglStatus, setWebglStatus] = useState<"unknown" | "ok" | "unsupported">("unknown");

  useEffect(() => {
    if (!enabled) return;
    setWebglStatus(supportsHomieWebGL() ? "ok" : "unsupported");
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const ctrl = new AbortController();
    const timeout = window.setTimeout(() => ctrl.abort(), 2500);

    fetch(src, { method: "GET", signal: ctrl.signal, cache: "no-store" })
      .then((r) => {
        if (cancelled) return;
        setAvailability(r.ok ? "ok" : "missing");
      })
      .catch(() => {
        if (cancelled) return;
        setAvailability("missing");
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      ctrl.abort();
    };
  }, [enabled, src]);

  if (!enabled) return <>{fallback}</>;

  if (webglStatus === "unsupported") {
    return (
      <CanvasHomieFallback
        mood={mood}
        isSpeaking={isSpeaking}
        isListening={isListening}
        pointerTracking={pointerTracking}
        gesture={gesture}
        reduceMotion={reduceMotion}
        className={className}
        badge="Desktop-safe avatar"
        fallback={fallback}
      />
    );
  }

  if (availability === "missing") {
    return (
      <CanvasHomieFallback
        mood={mood}
        isSpeaking={isSpeaking}
        isListening={isListening}
        pointerTracking={pointerTracking}
        gesture={gesture}
        reduceMotion={reduceMotion}
        className={className}
        badge="Avatar fallback"
        fallback={fallback}
      />
    );
  }

  if (availability === "unknown" || webglStatus === "unknown") {
    return (
      <CanvasHomieFallback
        mood={mood}
        isSpeaking={isSpeaking}
        isListening={isListening}
        pointerTracking={pointerTracking}
        gesture={gesture}
        reduceMotion={reduceMotion}
        className={className}
        badge="Loading avatar"
        fallback={fallback}
      />
    );
  }

  return (
    <HomieRiveBoundary
      fallback={fallback}
      className={className}
      mood={mood}
      isSpeaking={isSpeaking}
      isListening={isListening}
      pointerTracking={pointerTracking}
      gesture={gesture}
      reduceMotion={reduceMotion}
    >
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
  );
}

function RiveHomieInner({
  src,
  artboard,
  stateMachine,
  pointerTracking,
  mood,
  isSpeaking,
  isListening,
  gesture,
  reduceMotion,
  className,
}: Omit<RiveHomieProps, "enabled" | "fallback">) {
  const layout = useMemo(
    () => new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    []
  );

  const { rive, RiveComponent } = useRive({
    src,
    artboard: artboard || undefined,
    stateMachines: stateMachine,
    autoplay: !reduceMotion,
    layout,
  });

  const talkA = useStateMachineInput(rive, stateMachine, "isTalking");
  const talkB = useStateMachineInput(rive, stateMachine, "talking");
  const talkC = useStateMachineInput(rive, stateMachine, "isSpeaking");
  const talkD = useStateMachineInput(rive, stateMachine, "speaking");

  const listenA = useStateMachineInput(rive, stateMachine, "isListening");
  const listenB = useStateMachineInput(rive, stateMachine, "listening");
  const listenC = useStateMachineInput(rive, stateMachine, "listen");

  const moodA = useStateMachineInput(rive, stateMachine, "mood");
  const moodB = useStateMachineInput(rive, stateMachine, "Mood");
  const alertA = useStateMachineInput(rive, stateMachine, "alert");

  const lookXA = useStateMachineInput(rive, stateMachine, "lookX");
  const lookXB = useStateMachineInput(rive, stateMachine, "Axis_X");
  const lookXC = useStateMachineInput(rive, stateMachine, "pointerX");

  const lookYA = useStateMachineInput(rive, stateMachine, "lookY");
  const lookYB = useStateMachineInput(rive, stateMachine, "Axis_Y");
  const lookYC = useStateMachineInput(rive, stateMachine, "pointerY");

  const talkLevelA = useStateMachineInput(rive, stateMachine, "talk");
  const talkLevelB = useStateMachineInput(rive, stateMachine, "mouth");
  const talkLevelC = useStateMachineInput(rive, stateMachine, "mouthOpen");

  const trigWaveA = useStateMachineInput(rive, stateMachine, "wave");
  const trigWaveB = useStateMachineInput(rive, stateMachine, "triggerWave");
  const trigWinkA = useStateMachineInput(rive, stateMachine, "wink");
  const trigWinkB = useStateMachineInput(rive, stateMachine, "triggerWink");
  const trigCelebrateA = useStateMachineInput(rive, stateMachine, "celebrate");
  const trigCelebrateB = useStateMachineInput(rive, stateMachine, "spark");

  const talkInput: any = talkA || talkB || talkC || talkD;
  const listenInput: any = listenA || listenB || listenC;
  const moodInput: any = moodA || moodB || alertA;
  const lookXInput: any = lookXA || lookXB || lookXC;
  const lookYInput: any = lookYA || lookYB || lookYC;
  const talkLevelInput: any = talkLevelA || talkLevelB || talkLevelC;

  const waveTrigger: any = trigWaveA || trigWaveB;
  const winkTrigger: any = trigWinkA || trigWinkB;
  const celebrateTrigger: any = trigCelebrateA || trigCelebrateB;

  useEffect(() => {
    if (talkInput) talkInput.value = !!isSpeaking;
    if (listenInput) listenInput.value = !!isListening;

    if (moodInput) {
      moodInput.value = mood === "warn" ? 2 : mood === "good" ? 1 : 0;
    }

    if (rive) {
      try {
        if (reduceMotion) rive.pause();
        else rive.play();
      } catch {
        // ignore
      }
    }
  }, [talkInput, listenInput, moodInput, isSpeaking, isListening, mood, rive, reduceMotion]);

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
  }, [pointerTracking, lookXInput, lookYInput]);

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
      const pulse = Math.min(1, 0.16 + pulseA * 0.48 + pulseB * 0.22);
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
  }, [talkLevelInput, isSpeaking, reduceMotion]);

  const lastGestureRef = useRef<HomieGesture>("none");
  useEffect(() => {
    if (!gesture || gesture === "none") {
      lastGestureRef.current = "none";
      return;
    }
    if (gesture === lastGestureRef.current) return;
    lastGestureRef.current = gesture;

    try {
      if (gesture === "wave" && waveTrigger?.fire) waveTrigger.fire();
      if (gesture === "wink" && winkTrigger?.fire) winkTrigger.fire();
      if (gesture === "spark" && celebrateTrigger?.fire) celebrateTrigger.fire();
    } catch {
      // ignore
    }
  }, [gesture, waveTrigger, winkTrigger, celebrateTrigger]);

  return (
    <span className={`homieRiveWrap ${className || ""}`.trim()}>
      <span className="homieRiveClip">
        <RiveComponent className="homieRiveCanvas" />
      </span>
    </span>
  );
}
