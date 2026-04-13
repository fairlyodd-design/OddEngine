import React, { useEffect, useMemo, useRef, useState } from "react";
import LilHomie3D from "./LilHomie3D";
import HomieHybridAvatar from "./HomieHybridAvatar";

type PresenceState = "ready" | "warming" | "listening" | "thinking" | "talking" | "celebrating" | "needs-provider";

type Props = {
  mood: "idle" | "good" | "warn";
  isListening: boolean;
  isSpeaking: boolean;
  isThinking?: boolean;
  presenceState?: PresenceState;
  activeTitle: string;
  panelLabel: string;
  companionBrief: string;
  currentNeed: string;
  latestMilestone?: string;
  conversationArc?: string;
  sharedRoutine?: string;
  modelUrl?: string;
  renderMode?: "3d" | "hybrid";
};

type SceneTone = "trading" | "studio" | "recovery" | "money" | "mission";
type StageMode = "idle" | "warming" | "listening" | "thinking" | "talking" | "celebrating" | "needs-provider";
type CameraBeat = "hero" | "close" | "focus-left" | "focus-right";

function sceneToneFor(label: string): SceneTone {
  const key = label.toLowerCase();
  if (key.includes("trad")) return "trading";
  if (key.includes("studio") || key.includes("writer") || key.includes("music")) return "studio";
  if (key.includes("health") || key.includes("recover") || key.includes("fit")) return "recovery";
  if (key.includes("budget") || key.includes("money") || key.includes("income")) return "money";
  return "mission";
}

function stageModeFor({ isListening, isSpeaking, isThinking, mood, latestMilestone, presenceState }: Pick<Props, "isListening" | "isSpeaking" | "isThinking" | "mood" | "latestMilestone" | "presenceState">): StageMode {
  if (presenceState === "needs-provider") return "needs-provider";
  if (presenceState === "warming") return "warming";
  if (presenceState === "listening") return "listening";
  if (presenceState === "thinking") return "thinking";
  if (presenceState === "talking") return "talking";
  if (presenceState === "celebrating") return "celebrating";
  if (isListening) return "listening";
  if (isSpeaking) return "talking";
  if (isThinking) return "thinking";
  if ((mood === "good" && latestMilestone) || /win|done|shipped|ready|completed|banked/i.test(String(latestMilestone || ""))) return "celebrating";
  return "idle";
}

function beatSequenceFor(stageMode: StageMode): CameraBeat[] {
  if (stageMode === "talking") return ["close", "hero", "focus-right"];
  if (stageMode === "listening") return ["focus-left", "hero", "close"];
  if (stageMode === "warming") return ["hero", "close"];
  if (stageMode === "thinking") return ["hero", "focus-left", "focus-right"];
  if (stageMode === "needs-provider") return ["close", "hero"];
  if (stageMode === "celebrating") return ["hero", "close", "focus-left", "focus-right"];
  return ["hero", "close", "focus-left"];
}

function beatMsFor(stageMode: StageMode) {
  if (stageMode === "celebrating") return 1600;
  if (stageMode === "talking") return 1900;
  if (stageMode === "warming") return 1500;
  if (stageMode === "needs-provider") return 2400;
  if (stageMode === "listening") return 2200;
  return 2600;
}

function stageLabel(stageMode: StageMode) {
  if (stageMode === "talking") return "Talking";
  if (stageMode === "listening") return "Listening";
  if (stageMode === "warming") return "Warming up";
  if (stageMode === "thinking") return "Thinking";
  if (stageMode === "needs-provider") return "Needs provider";
  if (stageMode === "celebrating") return "Celebrating";
  return "Idle";
}

function toneAccent(sceneTone: SceneTone) {
  if (sceneTone === "trading") return "Trading mode";
  if (sceneTone === "studio") return "Studio mode";
  if (sceneTone === "recovery") return "Recovery mode";
  if (sceneTone === "money") return "Money mode";
  return "Mission mode";
}

export default function Homie3DActorShell({
  mood,
  isListening,
  isSpeaking,
  isThinking = false,
  presenceState = "ready",
  activeTitle,
  panelLabel,
  companionBrief,
  currentNeed,
  latestMilestone,
  conversationArc,
  sharedRoutine,
  modelUrl,
  renderMode = "hybrid",
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneTone = useMemo(() => sceneToneFor(panelLabel || activeTitle), [panelLabel, activeTitle]);
  const stageMode = useMemo(
    () => stageModeFor({ isListening, isSpeaking, isThinking, mood, latestMilestone, presenceState }),
    [isListening, isSpeaking, isThinking, mood, latestMilestone, presenceState],
  );
  const [cameraBeat, setCameraBeat] = useState<CameraBeat>("hero");
  const [displayStage, setDisplayStage] = useState<StageMode>(stageMode);

  useEffect(() => {
    if (stageMode === displayStage) return;
    const holdMs = stageMode === "idle" ? 180 : stageMode === "celebrating" ? 120 : 0;
    if (!holdMs) {
      setDisplayStage(stageMode);
      return;
    }
    const id = window.setTimeout(() => setDisplayStage(stageMode), holdMs);
    return () => window.clearTimeout(id);
  }, [displayStage, stageMode]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    el.classList.toggle("speaking", displayStage === "talking");
    el.classList.toggle("listening", displayStage === "listening");
    el.classList.toggle("warming", displayStage === "warming");
    el.classList.toggle("thinking", displayStage === "thinking");
    el.classList.toggle("needs-provider", displayStage === "needs-provider");
    el.classList.toggle("celebrating", displayStage === "celebrating");
    el.classList.toggle("walking", false);
    el.classList.toggle("face-left", cameraBeat === "focus-left");
    el.classList.toggle("beat-hero", cameraBeat === "hero");
    el.classList.toggle("beat-close", cameraBeat === "close");
    el.classList.toggle("beat-focus-left", cameraBeat === "focus-left");
    el.classList.toggle("beat-focus-right", cameraBeat === "focus-right");
  }, [cameraBeat, displayStage]);

  useEffect(() => {
    const sequence = beatSequenceFor(displayStage);
    let index = 0;
    setCameraBeat(sequence[0] || "hero");
    const id = window.setInterval(() => {
      index = (index + 1) % sequence.length;
      setCameraBeat(sequence[index] || "hero");
    }, beatMsFor(displayStage));
    return () => window.clearInterval(id);
  }, [displayStage, activeTitle]);

  const lookSummary = renderMode === "3d"
    ? "3D hero rig • grey hoodie • light cap • glasses • goatee"
    : "Grey hoodie • light cap • glasses • goatee • friendly hybrid vibe";
  const stageTitle = renderMode === "3d" ? "3D hero companion stage" : "Hybrid hero companion stage";
  const stageBlurb = renderMode === "3d"
    ? "Detached game-buddy shell with your rig pipeline, stage states, and camera beats."
    : "Friendly hybrid avatar tuned to your grey-hoodie / grey-cap look, with softer stage motion and cleaner talk-listen beats.";

  return (
    <div className={`homie3DShellCard companionHybrid ${mood} tone-${sceneTone}`.trim()}>
      <div className="homie3DShellHead">
        <div>
          <div className="assistantSectionTitle">{stageTitle}</div>
          <div className="small" style={{ marginTop: 6 }}>
            {stageBlurb}
          </div>
        </div>
        <div className="assistantChipWrap">
          <span className={`badge ${mood === "warn" ? "warn" : "good"}`}>{panelLabel}</span>
          <span className="badge">{stageLabel(displayStage)}</span>
          <span className="badge">{cameraBeat.replace("-", " ")}</span>
          <span className="badge">{renderMode === "3d" ? "3D actor" : "Hybrid hero"}</span>
        </div>
      </div>

      <div className="homie3DShellBody">
        <div className={`homie3DShellViewport friendlyHybrid tone-${sceneTone} stage-${displayStage} beat-${cameraBeat}`.trim()}>
          <div className="homie3DGlowLayer" />
          <div className="homie3DSoftBlob blobOne" />
          <div className="homie3DSoftBlob blobTwo" />
          <div className="homie3DConstellation" />
          <div className="homie3DGrid" />
          <div className="homie3DRing ringOne" />
          <div className="homie3DRing ringTwo" />
          <div className="homie3DRing ringThree" />
          <div className="homie3DScanline" />
          <div className="homie3DPlatform" />
          <div className="homie3DStageBadgeRow">
            <span className="badge good">{toneAccent(sceneTone)}</span>
            <span className="badge">{lookSummary}</span>
          </div>
          <div ref={hostRef} className={`homie3DActorHost ${cameraBeat} ${displayStage} ${renderMode === "hybrid" ? "hybrid" : "rig3d"}`.trim()}>
            {renderMode === "3d" ? (
              <LilHomie3D hostRef={hostRef as any} energy={stageMode === "celebrating" ? 1.04 : stageMode === "talking" ? 0.99 : 0.94} />
            ) : (
              <HomieHybridAvatar stageMode={stageMode as any} cameraBeat={cameraBeat} mood={mood} />
            )}
          </div>
          <div className="homie3DNameplate">Homie</div>
          <div className="homie3DStageHint">{stageLabel(displayStage)} • subtle camera beats • {renderMode === "3d" ? "rig-driven stage states" : "blink / breath / talk loops"}</div>
        </div>

        <div className="homie3DShellMeta">
          <div className="small shellEyebrow">Live companion context</div>
          <div className="homie3DShellTitle">{activeTitle}</div>
          <div className="small" style={{ marginTop: 8 }}>{companionBrief}</div>
          <div className="small" style={{ marginTop: 8 }}>Need: <b>{currentNeed}</b></div>
          {!!conversationArc && <div className="small" style={{ marginTop: 8 }}>Arc: {conversationArc}</div>}
          {!!sharedRoutine && <div className="small" style={{ marginTop: 8 }}>Routine: {sharedRoutine}</div>}
          {!!latestMilestone && <div className="small" style={{ marginTop: 8 }}>Latest milestone: {latestMilestone}</div>}
          <div className="assistantChipWrap" style={{ marginTop: 12 }}>
            <span className="badge">{renderMode === "3d" ? "Hero actor" : "Hybrid actor"}</span>
            <span className="badge">Mood-driven stage</span>
            <span className="badge">{renderMode === "3d" ? "Rig path hot-swappable" : "Fine-tuned look lock"}</span>
            <span className="badge">Rounded companion hybrid</span>
          </div>
        </div>
      </div>
    </div>
  );
}
