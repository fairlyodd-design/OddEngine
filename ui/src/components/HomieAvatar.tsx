import React from "react";
import type { HomieEmotion } from "../lib/homieRealLifeCore";

type Props = {
  emotion?: HomieEmotion;
  speaking?: boolean;
  listening?: boolean;
  cameraEnabled?: boolean;
  micEnabled?: boolean;
};

function accent(emotion: HomieEmotion) {
  switch (emotion) {
    case "happy":
      return "#93ff9b";
    case "concerned":
      return "#ffca7a";
    case "focused":
      return "#8ec5ff";
    case "speaking":
      return "#9cf6ff";
    case "listening":
      return "#8bffd7";
    default:
      return "#7de4ff";
  }
}

export default function HomieAvatar({ emotion = "idle", speaking, listening, cameraEnabled, micEnabled }: Props) {
  const color = accent(emotion);
  return (
    <div style={{ position: "relative", width: 280, height: 380, margin: "0 auto" }}>
      <style>{`
        @keyframes homieFloat { 0%,100% { transform: translateY(0px);} 50% { transform: translateY(3px);} }
        @keyframes homieBlink { 0%,46%,52%,100% { transform: scaleY(1);} 48%,50% { transform: scaleY(0.16);} }
      `}</style>
      <div style={{ position: "absolute", bottom: 18, left: 56, width: 168, height: 22, borderRadius: 999, background: "rgba(0,0,0,0.22)", filter: "blur(8px)" }} />
      <div style={{ position: "absolute", inset: 0, animation: "homieFloat 4.4s ease-in-out infinite" }}>
        <div style={{ position: "absolute", top: 18, left: 84, width: 112, height: 112, borderRadius: 999, background: "linear-gradient(180deg,#f7f8fb,#dfe5f2)", border: `4px solid ${color}`, boxShadow: `0 0 26px ${color}33` }}>
          <div style={{ position: "absolute", top: 28, left: 18, right: 18, height: 30, borderRadius: 999, background: "linear-gradient(180deg,#7de4ff,#4a72ff)" }} />
          <div style={{ position: "absolute", top: 37, left: 34, width: 18, height: 9, borderRadius: 999, background: "#ecfaff", animation: "homieBlink 5.4s infinite" }} />
          <div style={{ position: "absolute", top: 37, right: 34, width: 18, height: 9, borderRadius: 999, background: "#ecfaff", animation: "homieBlink 5.4s infinite" }} />
          <div style={{ position: "absolute", bottom: 20, left: 44, width: speaking ? 28 : 18, height: speaking ? 14 : 6, borderRadius: 999, background: "rgba(15,24,44,0.55)", transition: "all 90ms linear" }} />
        </div>
        <div style={{ position: "absolute", top: 128, left: 74, width: 132, height: 136, borderRadius: 28, background: "linear-gradient(180deg,#1b2744,#101726)", border: `4px solid ${color}` }} />
        <div style={{ position: "absolute", top: 142, left: 44, width: 24, height: 112, borderRadius: 999, background: "#1b2744", border: `3px solid ${color}` }} />
        <div style={{ position: "absolute", top: 142, right: 44, width: 24, height: 112, borderRadius: 999, background: "#1b2744", border: `3px solid ${color}` }} />
        <div style={{ position: "absolute", top: 248, left: 102, width: 22, height: 100, borderRadius: 999, background: "#1b2744", border: `3px solid ${color}` }} />
        <div style={{ position: "absolute", top: 248, right: 102, width: 22, height: 100, borderRadius: 999, background: "#1b2744", border: `3px solid ${color}` }} />
        {micEnabled ? <div style={{ position: "absolute", top: 8, left: 14, padding: "6px 10px", borderRadius: 12, background: "rgba(20,28,46,0.78)", color: color, fontSize: 11, fontWeight: 800 }}>MIC</div> : null}
        {cameraEnabled ? <div style={{ position: "absolute", top: 8, right: 14, padding: "6px 10px", borderRadius: 12, background: "rgba(20,28,46,0.78)", color: color, fontSize: 11, fontWeight: 800 }}>CAM</div> : null}
        {listening ? <div style={{ position: "absolute", top: 150, right: -2, width: 12, height: 12, borderRadius: 999, background: color, boxShadow: `0 0 18px ${color}` }} /> : null}
      </div>
    </div>
  );
}
