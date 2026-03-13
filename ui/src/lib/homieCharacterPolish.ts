export type HomieMood =
  | "idle"
  | "listening"
  | "speaking"
  | "thinking"
  | "happy"
  | "concerned"
  | "celebrating";

export type HomiePose = "neutral" | "lean-in" | "point" | "wave" | "hands-on-hips";

export type HomieLookAndFeel = {
  silhouette: {
    headScale: number;
    torsoWidth: number;
    limbThickness: number;
    roundness: number;
  };
  palette: {
    suit: string;
    suitGlow: string;
    face: string;
    visor: string;
    accent: string;
    concern: string;
    celebration: string;
    shadow: string;
  };
  motion: {
    breatheSeconds: number;
    blinkSeconds: number;
    idleTiltDeg: number;
    talkBobPx: number;
    listenLeanPx: number;
  };
  personality: {
    title: string;
    summary: string;
    traits: string[];
    toneRules: string[];
  };
};

export const HOMIE_LOOK_AND_FEEL: HomieLookAndFeel = {
  silhouette: {
    headScale: 1.12,
    torsoWidth: 132,
    limbThickness: 18,
    roundness: 28,
  },
  palette: {
    suit: "linear-gradient(180deg, #1c2640 0%, #101727 100%)",
    suitGlow: "rgba(96, 166, 255, 0.25)",
    face: "linear-gradient(180deg, #f6f7fb 0%, #dfe4f0 100%)",
    visor: "linear-gradient(180deg, #58d8ff 0%, #3e7dff 100%)",
    accent: "#7de4ff",
    concern: "#ffb36b",
    celebration: "#9cff97",
    shadow: "rgba(0, 0, 0, 0.24)",
  },
  motion: {
    breatheSeconds: 4.6,
    blinkSeconds: 5.8,
    idleTiltDeg: 2.5,
    talkBobPx: 4,
    listenLeanPx: 6,
  },
  personality: {
    title: "Homie — warm operator guide",
    summary:
      "A protective, upbeat onboard assistant who feels like family: helpful first, confident without being pushy, and visibly alive inside the OS.",
    traits: [
      "supportive",
      "curious",
      "steady under pressure",
      "celebrates wins",
      "notices blockers quickly",
    ],
    toneRules: [
      "Be warm and direct.",
      "Make next steps feel doable.",
      "Use energy for wins, calm for problems.",
      "Look alive even when idle.",
    ],
  },
};

export function homieMoodColor(mood: HomieMood) {
  switch (mood) {
    case "happy":
    case "celebrating":
      return HOMIE_LOOK_AND_FEEL.palette.celebration;
    case "concerned":
      return HOMIE_LOOK_AND_FEEL.palette.concern;
    default:
      return HOMIE_LOOK_AND_FEEL.palette.accent;
  }
}

export function homiePresenceLine(mood: HomieMood, pose: HomiePose) {
  const moodLine = {
    idle: "Standing by and ready.",
    listening: "Listening closely.",
    speaking: "Talking it through.",
    thinking: "Working the next move.",
    happy: "Feeling good about progress.",
    concerned: "Spotting a blocker early.",
    celebrating: "Big win energy.",
  }[mood];

  const poseLine = {
    neutral: "Balanced stance.",
    "lean-in": "Leaning in to help.",
    point: "Pointing toward the next action.",
    wave: "Warm greeting mode.",
    "hands-on-hips": "Mission-control confidence.",
  }[pose];

  return `${moodLine} ${poseLine}`;
}
