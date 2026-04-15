import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useRive,
  useStateMachineInput,
  Layout,
  Fit,
  Alignment,
} from "@rive-app/react-webgl2";

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

// Wrapper that preflights the src so the app never "blanks" if the .riv isn't there.
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

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const ctrl = new AbortController();
    const timeout = window.setTimeout(() => ctrl.abort(), 2500);

    // We do a lightweight GET to avoid CORS/HEAD weirdness in some environments.
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

  if (availability === "missing") {
    return (
      <span className={`homieRiveWrap ${className || ""}`.trim()}>
        {fallback}
        <span className="homieRiveMissing" title={`Rive file not found at ${src}`}>
          Rive missing
        </span>
      </span>
    );
  }

  // While preflight is running, keep fallback visible so the UI stays stable.
  if (availability === "unknown") return <>{fallback}</>;

  return (
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

  // --- Inputs (we try a handful of common names so your file can evolve without code churn)
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

  // Apply boolean & mood inputs.
  useEffect(() => {
    if (talkInput) talkInput.value = !!isSpeaking;
    if (listenInput) listenInput.value = !!isListening;

    if (moodInput) {
      // Convention: 0=idle, 1=good, 2=warn
      moodInput.value = mood === "warn" ? 2 : mood === "good" ? 1 : 0;
    }

    // Pause/play for reduce motion.
    if (rive) {
      try {
        if (reduceMotion) rive.pause();
        else rive.play();
      } catch {
        // ignore
      }
    }
  }, [talkInput, listenInput, moodInput, isSpeaking, isListening, mood, rive, reduceMotion]);

  // Pointer tracking (gives that "game buddy" life).
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
  }, [pointerTracking, lookXInput, lookYInput]);

  // Talk pulse (if the file supports a numeric mouth input).
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
  }, [talkLevelInput, isSpeaking, reduceMotion]);

  // Fire gesture triggers.
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
