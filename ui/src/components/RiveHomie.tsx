import React from "react";

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

export default function RiveHomie(props: RiveHomieProps) {
  if (!props.enabled) return <>{props.fallback}</>;
  return (
    <div className={`homieRiveWrap ${props.className || ""}`.trim()} aria-label="Homie animated fallback">
      {props.fallback}
      <span className="homieRiveMissing" title={`Rive disabled in this build for ${props.src}`}>
        Homie live layer
      </span>
    </div>
  );
}
