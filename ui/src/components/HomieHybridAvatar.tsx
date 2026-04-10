import React from "react";

type StageMode = "idle" | "listening" | "thinking" | "talking" | "celebrating";
type CameraBeat = "hero" | "close" | "focus-left" | "focus-right";

type Props = {
  stageMode: StageMode;
  cameraBeat: CameraBeat;
  mood: "idle" | "good" | "warn";
};

export default function HomieHybridAvatar({ stageMode, cameraBeat, mood }: Props) {
  const rootClass = `homieHybridAvatarRoot stage-${stageMode} beat-${cameraBeat} mood-${mood}`.trim();
  return (
    <div className={rootClass} aria-label="Homie hybrid hero avatar">
      <div className="homieHybridAvatarAura auraBack" />
      <div className="homieHybridAvatarAura auraFront" />
      <svg className="homieHybridAvatarSvg" viewBox="0 0 240 300" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="hoodieGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#686a70" />
            <stop offset="55%" stopColor="#51545b" />
            <stop offset="100%" stopColor="#3a3d45" />
          </linearGradient>
          <linearGradient id="hoodieShadow" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#8a8c92" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#0d1017" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="capGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#d9dde2" />
            <stop offset="100%" stopColor="#aeb4ba" />
          </linearGradient>
          <linearGradient id="skinGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#efc39d" />
            <stop offset="100%" stopColor="#dba678" />
          </linearGradient>
          <linearGradient id="beardGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6d4128" />
            <stop offset="100%" stopColor="#4a2a19" />
          </linearGradient>
          <radialGradient id="visorGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#9ff7ff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#9ff7ff" stopOpacity="0" />
          </radialGradient>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="hyb-shadow">
          <ellipse cx="120" cy="278" rx="58" ry="13" fill="rgba(0,0,0,0.34)" />
        </g>

        <g className="hyb-bodyGroup">
          <path className="hyb-hoodBack" d="M76 114c9-24 28-41 44-41 15 0 35 17 44 41l-16 8c-8-18-16-28-28-28-13 0-21 10-28 28z" fill="#5a5d63" opacity="0.9" />
          <path className="hyb-hoodie" d="M56 138c0-16 13-29 29-29h70c16 0 29 13 29 29v58c0 25-21 46-46 46H102c-25 0-46-21-46-46z" fill="url(#hoodieGrad)" />
          <path className="hyb-hoodieShade" d="M74 120c14 12 30 18 46 18s32-6 46-18c3 5 4 11 4 18v56c0 18-15 33-33 33h-34c-18 0-33-15-33-33v-56c0-7 1-13 4-18z" fill="url(#hoodieShadow)" opacity="0.5" />
          <path className="hyb-pocket" d="M86 176h68c4 0 8 3 9 7l7 31c1 5-2 9-7 9h-94c-5 0-8-4-7-9l7-31c1-4 5-7 9-7z" fill="rgba(255,255,255,0.06)" />
          <path className="hyb-pocketCut" d="M96 178c8 14 15 22 24 22 8 0 16-8 24-22" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeLinecap="round" />
          <path className="hyb-neck" d="M104 120h32v22c0 7-6 13-13 13h-6c-7 0-13-6-13-13z" fill="url(#skinGrad)" />
          <path className="hyb-string" d="M102 132c-2 18-1 29 0 40" fill="none" stroke="#202228" strokeWidth="2.6" strokeLinecap="round" />
          <path className="hyb-string" d="M138 132c2 18 1 29 0 40" fill="none" stroke="#202228" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="102" cy="174" r="2.4" fill="#202228" />
          <circle cx="138" cy="174" r="2.4" fill="#202228" />
        </g>

        <g className="hyb-headGroup">
          <ellipse cx="79" cy="110" rx="10" ry="15" fill="#d8a175" />
          <ellipse cx="161" cy="110" rx="10" ry="15" fill="#d8a175" />
          <path className="hyb-head" d="M120 62c27 0 49 22 49 49v6c0 30-22 56-49 56s-49-26-49-56v-6c0-27 22-49 49-49z" fill="url(#skinGrad)" />
          <path className="hyb-capTop" d="M74 89c5-27 23-44 46-44 24 0 42 17 46 44-15-10-31-15-46-15-16 0-31 5-46 15z" fill="url(#capGrad)" />
          <path className="hyb-capBrim" d="M72 88c13-8 30-12 48-12 17 0 34 4 48 12-2 10-11 17-22 17H94c-11 0-20-7-22-17z" fill="#aeb4ba" />
          <path className="hyb-capShadow" d="M80 94h80" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="6" strokeLinecap="round" />
          <path className="hyb-brow" d="M95 104c6-4 14-5 21-4" fill="none" stroke="#5d3928" strokeWidth="4" strokeLinecap="round" />
          <path className="hyb-brow brow-right" d="M124 100c8-1 15 0 21 4" fill="none" stroke="#5d3928" strokeWidth="4" strokeLinecap="round" />

          <g className="hyb-glassesWrap" filter="url(#softGlow)">
            <rect x="84" y="110" width="30" height="18" rx="7" fill="rgba(232,244,255,0.12)" stroke="rgba(226,234,246,0.7)" strokeWidth="2.4" />
            <rect x="126" y="110" width="30" height="18" rx="7" fill="rgba(232,244,255,0.12)" stroke="rgba(226,234,246,0.7)" strokeWidth="2.4" />
            <rect x="113" y="116" width="14" height="4" rx="2" fill="rgba(226,234,246,0.72)" />
            <ellipse cx="99" cy="120" rx="14" ry="8" fill="url(#visorGlow)" />
            <ellipse cx="141" cy="120" rx="14" ry="8" fill="url(#visorGlow)" />
          </g>

          <g className="hyb-eye left-eye">
            <ellipse cx="100" cy="121" rx="10" ry="7" fill="#ffffff" />
            <circle className="hyb-pupil" cx="100" cy="121" r="3.2" fill="#3f3228" />
            <circle className="hyb-spark" cx="101.4" cy="119.7" r="1" fill="#ffffff" />
            <rect className="hyb-lid" x="89" y="112" width="22" height="18" rx="9" fill="#deab7e" />
          </g>
          <g className="hyb-eye right-eye">
            <ellipse cx="140" cy="121" rx="10" ry="7" fill="#ffffff" />
            <circle className="hyb-pupil" cx="140" cy="121" r="3.2" fill="#3f3228" />
            <circle className="hyb-spark" cx="141.4" cy="119.7" r="1" fill="#ffffff" />
            <rect className="hyb-lid" x="129" y="112" width="22" height="18" rx="9" fill="#deab7e" />
          </g>

          <path className="hyb-nose" d="M120 124c-3 6-3 12 0 18" fill="none" stroke="#c58b61" strokeWidth="3" strokeLinecap="round" />

          <g className="hyb-mouthGroup">
            <path className="hyb-mouthSmile" d="M103 146c5 8 12 11 17 11 6 0 13-3 18-11" fill="none" stroke="#7d4130" strokeWidth="4.2" strokeLinecap="round" />
            <ellipse className="hyb-mouthOpen" cx="120" cy="150" rx="12" ry="6" fill="#4c1f1a" />
            <ellipse className="hyb-mouthGlow" cx="120" cy="151" rx="18" ry="9" fill="rgba(251,191,36,0.1)" />
          </g>

          <path className="hyb-goatee" d="M93 144c5 19 16 40 27 40 12 0 23-21 27-40-8 7-17 10-27 10-9 0-18-3-27-10z" fill="url(#beardGrad)" />
          <path className="hyb-beardSide" d="M82 123c2 15 7 28 16 37" fill="none" stroke="#5a331f" strokeWidth="10" strokeLinecap="round" />
          <path className="hyb-beardSide right" d="M158 123c-2 15-7 28-16 37" fill="none" stroke="#5a331f" strokeWidth="10" strokeLinecap="round" />
        </g>

        <g className="hyb-pulseBars" opacity="0.85">
          <rect x="54" y="198" width="6" height="16" rx="3" fill="rgba(94,234,242,0.65)" />
          <rect x="63" y="192" width="6" height="28" rx="3" fill="rgba(94,234,242,0.55)" />
          <rect x="72" y="200" width="6" height="12" rx="3" fill="rgba(94,234,242,0.45)" />
          <rect x="162" y="200" width="6" height="12" rx="3" fill="rgba(94,234,242,0.45)" />
          <rect x="171" y="192" width="6" height="28" rx="3" fill="rgba(94,234,242,0.55)" />
          <rect x="180" y="198" width="6" height="16" rx="3" fill="rgba(94,234,242,0.65)" />
        </g>
      </svg>
    </div>
  );
}
