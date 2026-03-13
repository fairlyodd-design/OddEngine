import React, { useMemo } from "react";
import { getHomieTheme, type HomieMood } from "../lib/homieWeirdScienceAesthetic";

export type HomieAvatarProps = {
  mood?: HomieMood;
  speakingLevel?: number;
  size?: number;
};

function clamp(num: number, min: number, max: number) {
  return Math.max(min, Math.min(max, num));
}

export default function HomieAvatar({
  mood = "warm",
  speakingLevel = 0,
  size = 320,
}: HomieAvatarProps) {
  const theme = getHomieTheme(mood);
  const talkOpen = clamp(speakingLevel, 0, 1) * 10;
  const breath = useMemo(() => (mood === "thinking" ? 1.02 : 1), [mood]);

  return (
    <div
      style={{
        width: size,
        maxWidth: "100%",
        aspectRatio: "1 / 1.15",
        position: "relative",
        margin: "0 auto",
        filter: `drop-shadow(${theme.avatarGlow})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "8% 10% 0 10%",
          borderRadius: 40,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          border: `1px solid ${theme.cardBorder}`,
          ...theme.overlayStyle,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          width: "56%",
          height: "8%",
          borderRadius: 999,
          background: "rgba(0,0,0,0.32)",
          filter: "blur(14px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "17%",
          transform: `translateX(-50%) scale(${breath})`,
          width: "36%",
          height: "26%",
          borderRadius: "45% 45% 42% 42%",
          background: "linear-gradient(180deg, #ffd6bc, #f0b99e)",
          border: "2px solid rgba(255,255,255,0.15)",
        }}
      >
        <div style={{ position: "absolute", top: "33%", left: "23%", width: "18%", height: "8%", borderRadius: 999, background: "#262626" }} />
        <div style={{ position: "absolute", top: "33%", right: "23%", width: "18%", height: "8%", borderRadius: 999, background: "#262626" }} />
        <div style={{ position: "absolute", top: "58%", left: "50%", transform: "translateX(-50%)", width: "22%", height: 6 + talkOpen, borderRadius: 999, background: "#7a3a3a" }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "41%",
          transform: "translateX(-50%)",
          width: "28%",
          height: "26%",
          borderRadius: 28,
          background: "linear-gradient(180deg, #324255, #202b38)",
          border: `2px solid ${theme.cardBorder}`,
        }}
      />
      <div style={{ position: "absolute", left: "24%", top: "46%", width: "12%", height: "7%", borderRadius: 999, background: "#324255", transform: "rotate(28deg)" }} />
      <div style={{ position: "absolute", right: "24%", top: "46%", width: "12%", height: "7%", borderRadius: 999, background: "#324255", transform: "rotate(-28deg)" }} />
      <div style={{ position: "absolute", left: "38%", top: "66%", width: "7%", height: "16%", borderRadius: 999, background: "#202b38" }} />
      <div style={{ position: "absolute", right: "38%", top: "66%", width: "7%", height: "16%", borderRadius: 999, background: "#202b38" }} />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "11%",
          transform: "translateX(-50%)",
          width: "42%",
          height: "10%",
          borderRadius: "80% 80% 30% 30%",
          background: "linear-gradient(180deg, rgba(60,48,44,0.95), rgba(35,28,26,0.98))",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 40,
          boxShadow: `inset 0 0 0 1px ${theme.cardBorder}, inset 0 0 80px rgba(255,255,255,0.03)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
