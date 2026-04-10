import React from "react";
import fairlyOddLogo from "../assets/fairlyodd-logo.png";
import HomieHybridAvatar from "./HomieHybridAvatar";
import RiveHomie, { type HomieGesture, type HomieMood } from "./RiveHomie";

type StageMode = "idle" | "listening" | "thinking" | "talking" | "celebrating";
type CameraBeat = "hero" | "close" | "focus-left" | "focus-right";

type Props = {
  title: string;
  subtitle: string;
  stageMode: StageMode;
  cameraBeat?: CameraBeat;
  mood: HomieMood;
  stageLabel: string;
  providerLabel: string;
  providerReady: boolean;
  voiceLabel: string;
  focusText: string;
  memoryText?: string;
  runtimeText?: string;
  gesture?: HomieGesture;
  riveEnabled?: boolean;
  riveSrc?: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  primaryLabel?: string;
  secondaryLabel?: string;
};

const MOOD_TRAITS: Record<HomieMood, string[]> = {
  idle: ["steady", "grounded", "easy pace"],
  good: ["warm", "encouraging", "light"],
  warn: ["careful", "supportive", "watchful"],
};

const STAGE_COPY: Record<StageMode, { eyebrow: string; headline: string; detail: string }> = {
  idle: {
    eyebrow: "Present",
    headline: "Homie is here with you.",
    detail: "Quiet presence, soft motion, ready when you are.",
  },
  listening: {
    eyebrow: "Listening",
    headline: "Homie is tuned in.",
    detail: "Capturing what matters before replying.",
  },
  thinking: {
    eyebrow: "Thinking",
    headline: "Homie is working the next move.",
    detail: "Turning signal into a clean answer.",
  },
  talking: {
    eyebrow: "Speaking",
    headline: "Homie is with you in the moment.",
    detail: "Answering with a warmer, steadier rhythm.",
  },
  celebrating: {
    eyebrow: "Momentum",
    headline: "Homie is feeling the win.",
    detail: "Keep the streak alive and ship the next thing.",
  },
};

export default function HomiePresenceShell({
  title,
  subtitle,
  stageMode,
  cameraBeat = "hero",
  mood,
  stageLabel,
  providerLabel,
  providerReady,
  voiceLabel,
  focusText,
  memoryText,
  runtimeText,
  gesture = "none",
  riveEnabled = false,
  riveSrc = "/rive/homie.riv",
  onPrimaryAction,
  onSecondaryAction,
  primaryLabel = "Talk to Homie",
  secondaryLabel = "Check providers",
}: Props) {
  const avatarFallback = <HomieHybridAvatar stageMode={stageMode} cameraBeat={cameraBeat} mood={mood} />;
  const stageCopy = STAGE_COPY[stageMode] || STAGE_COPY.idle;
  const traits = MOOD_TRAITS[mood] || MOOD_TRAITS.idle;

  return (
    <div className="card homiePresenceShellCard homieTolanInspiredShell">
      <div className="homiePresenceShellLayout homiePresenceShellLayout--cinematic">
        <div className="homiePresenceStageCol">
          <div className={`homiePresenceStage homiePresenceStage--cinematic stage-${stageMode} mood-${mood}`.trim()}>
            <div className="homiePresenceBackdrop" />
            <div className="homiePresenceBackdrop homiePresenceBackdropSecondary" />
            <div className="homiePresenceStageHalo haloBack" />
            <div className="homiePresenceStageHalo haloMid" />
            <div className="homiePresenceStageHalo haloFront" />
            <div className="homiePresenceBrandPill homiePresenceBrandPill--soft">
              <img src={fairlyOddLogo} alt="FairlyOdd" draggable={false} />
              <span>Homie presence</span>
            </div>
            <div className="homiePresenceTopGlass">
              <span className="homiePresenceDot" />
              <span>{stageCopy.eyebrow}</span>
            </div>
            <div className="homiePresenceAvatarWrap homiePresenceAvatarWrap--cinematic">
              <RiveHomie
                enabled={riveEnabled}
                src={riveSrc}
                artboard="Homie"
                stateMachine="State Machine 1"
                pointerTracking={false}
                mood={mood}
                isSpeaking={stageMode === "talking"}
                isListening={stageMode === "listening"}
                gesture={gesture}
                reduceMotion={false}
                fallback={avatarFallback}
              />
            </div>
            <div className="homiePresenceFootGlow" />
            <div className="homiePresenceStageFooter">
              <div className="homiePresenceStageFooterHeadline">{stageCopy.headline}</div>
              <div className="small homiePresenceStageFooterCopy">{stageCopy.detail}</div>
            </div>
          </div>
        </div>

        <div className="homiePresenceInfoCol homiePresenceInfoCol--cinematic">
          <div className="small shellEyebrow">COMPANION PRESENCE</div>
          <div className="homiePresenceTitle homiePresenceTitle--cinematic">{title}</div>
          <div className="small homiePresenceSubtitle">{subtitle}</div>

          <div className="assistantChipWrap homiePresenceBadgeRow">
            <span className={`badge ${providerReady ? "good" : "warn"}`}>{providerReady ? `${providerLabel} ready` : `${providerLabel} needs setup`}</span>
            <span className={`badge ${stageMode === "thinking" || stageMode === "listening" ? "warn" : stageMode === "celebrating" ? "good" : "muted"}`}>{stageLabel}</span>
            <span className="badge">{voiceLabel}</span>
          </div>

          <div className="homiePresenceStatusCard homiePresenceStatusCard--hero">
            <div className="small shellEyebrow">Right now</div>
            <div className="homiePresenceStatusHeadline">{focusText}</div>
            {memoryText ? <div className="small homiePresenceMemoryLine">{memoryText}</div> : null}
            {runtimeText ? <div className="small homiePresenceRuntimeLine">{runtimeText}</div> : null}
          </div>

          <div className="homiePresenceMoodStrip">
            {traits.map((trait) => (
              <span key={trait} className="homiePresenceMoodPill">{trait}</span>
            ))}
          </div>

          <div className="homiePresenceEchoCard">
            <div className="small shellEyebrow">Companion feel</div>
            <div className="homiePresenceEchoHeadline">{stageCopy.headline}</div>
            <div className="small homiePresenceEchoCopy">Minimal chrome, softer pacing, stronger presence — built for OddEngine instead of a generic chat box.</div>
          </div>

          <div className="homiePresenceActionRow homiePresenceActionRow--hero">
            <button className="tabBtn active" onClick={onPrimaryAction}>{primaryLabel}</button>
            <button className="tabBtn" onClick={onSecondaryAction}>{secondaryLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
