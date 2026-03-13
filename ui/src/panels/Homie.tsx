import React, { useMemo, useState } from "react";
import HomieAvatar from "../components/HomieAvatar";
import {
  HOMIE_LOOK_AND_FEEL_NOTES,
  getHomieTheme,
  getTruthfulEncouragement,
  type HomieMood,
} from "../lib/homieWeirdScienceAesthetic";

const moods: HomieMood[] = [
  "warm",
  "listening",
  "speaking",
  "thinking",
  "truthful-warning",
  "celebrating",
];

const quickPrompts = [
  "What needs attention in the OS today?",
  "Give me the next best step.",
  "Tell me the truth without the doom spiral.",
  "Help me keep the family organized.",
];

export default function Homie() {
  const [mood, setMood] = useState<HomieMood>("warm");
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [nextAction, setNextAction] = useState("Check Studio, Grocery, and Budget before adding new chaos.");
  const theme = useMemo(() => getHomieTheme(mood), [mood]);
  const encouragement = useMemo(
    () => getTruthfulEncouragement(mood, nextAction),
    [mood, nextAction],
  );

  return (
    <div
      style={{
        display: "grid",
        gap: 16,
        color: theme.text,
      }}
    >
      <div
        className="card softCard"
        style={{
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${theme.cardBorder}`,
          background: theme.panelGlow,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            opacity: 0.9,
            ...theme.overlayStyle,
          }}
        />
        <div style={{ position: "relative", display: "grid", gap: 16, gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)", alignItems: "center" }}>
          <HomieAvatar mood={mood} speakingLevel={mood === "speaking" ? 1 : 0.15} />
          <div style={{ display: "grid", gap: 12 }}>
            <div className="small shellEyebrow">HOMIE / WEIRD SCIENCE MODE</div>
            <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.05 }}>{theme.title}</div>
            <div className="sub">{theme.subtitle}</div>
            <div className="note" style={{ borderColor: theme.cardBorder, background: "rgba(0,0,0,0.18)" }}>{encouragement}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {moods.map((entry) => (
                <button
                  key={entry}
                  className={`tabBtn ${entry === mood ? "active" : ""}`}
                  onClick={() => setMood(entry)}
                  style={entry === mood ? { borderColor: theme.cardBorder } : undefined}
                >
                  {entry}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "start" }}>
        <div className="card softCard" style={{ border: `1px solid ${theme.cardBorder}` }}>
          <div className="small shellEyebrow">CONTROL DECK</div>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <button className={`tabBtn ${micEnabled ? "active" : ""}`} onClick={() => setMicEnabled((v) => !v)}>
              {micEnabled ? "Mic enabled" : "Enable mic"}
            </button>
            <button className={`tabBtn ${speakerEnabled ? "active" : ""}`} onClick={() => setSpeakerEnabled((v) => !v)}>
              {speakerEnabled ? "Speaker enabled" : "Enable speaker"}
            </button>
            <button className={`tabBtn ${cameraEnabled ? "active" : ""}`} onClick={() => setCameraEnabled((v) => !v)}>
              {cameraEnabled ? "Camera enabled" : "Enable camera"}
            </button>
          </div>
        </div>

        <div className="card softCard" style={{ border: `1px solid ${theme.cardBorder}` }}>
          <div className="small shellEyebrow">NEXT BEST ACTION</div>
          <textarea
            className="input mt-2"
            rows={4}
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="Keep Homie grounded with the next honest move."
          />
          <div className="small mt-3">
            Homie should be warm, helpful, and truthful — not fake hype, not doom.
          </div>
        </div>

        <div className="card softCard" style={{ border: `1px solid ${theme.cardBorder}` }}>
          <div className="small shellEyebrow">LOOK + FEEL NOTES</div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {HOMIE_LOOK_AND_FEEL_NOTES.map((note) => (
              <div
                key={note}
                style={{
                  padding: 10,
                  borderRadius: 14,
                  background: theme.chipBg,
                  color: theme.chipText,
                }}
              >
                {note}
              </div>
            ))}
          </div>
        </div>

        <div className="card softCard" style={{ border: `1px solid ${theme.cardBorder}` }}>
          <div className="small shellEyebrow">QUICK PROMPTS</div>
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {quickPrompts.map((prompt) => (
              <button key={prompt} className="tabBtn" onClick={() => setNextAction(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
