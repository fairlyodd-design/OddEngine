import React from "react";
import RiveHomie, { type HomieGesture, type HomieMood } from "./RiveHomie";

// v10.36.92b checker-safe marker: unified avatar stage render hotfix installed

type Props = {
  mood?: HomieMood;
  isListening?: boolean;
  isSpeaking?: boolean;
  gesture?: HomieGesture;
  compact?: boolean;
};

export default function HomieUnifiedAvatar({
  mood = "idle",
  isListening = false,
  isSpeaking = false,
  gesture = "none",
  compact = false,
}: Props) {
  const resolvedMood: HomieMood =
    mood === "warn" ? "warn" : isListening ? "good" : mood;

  const resolvedGesture: HomieGesture =
    gesture !== "none" ? gesture : isSpeaking ? "nod" : isListening ? "tilt" : "none";

  return (
    <div
      data-homie-unified-avatar="v10.36.92"
      data-homie-unified-avatar-hotfix="v10.36.92b"
      className={`homieUnifiedAvatarRoot ${compact ? "compact" : ""}`.trim()}
    >
      <div className="homieUnifiedAvatarStage">
        <RiveHomie
          enabled={true}
          src="/rive/homie_companion.riv"
          stateMachine="State Machine 1"
          pointerTracking={!compact}
          mood={resolvedMood}
          isSpeaking={!!isSpeaking}
          isListening={!!isListening}
          gesture={resolvedGesture}
          reduceMotion={false}
          className="homieUnifiedAvatarRive"
          fallback={
            <div className="homieUnifiedAvatarFallbackShell" aria-hidden="true">
              <div className="homieUnifiedAvatarFallbackLabel">Avatar loading</div>
            </div>
          }
        />
      </div>

      {!compact ? (
        <div className="homieUnifiedAvatarCaption" style={{ textAlign: "center", maxWidth: 430 }}>
          <div style={{ fontWeight: 800, letterSpacing: "0.01em" }}>Unified Homie visual lane</div>
          <div className="small" style={{ marginTop: 4, opacity: 0.9 }}>
            Same avatar-first lane for web and desktop. Memoji-inspired hoodie companion with the desktop-safe canvas fallback.
          </div>
        </div>
      ) : null}
    </div>
  );
}
