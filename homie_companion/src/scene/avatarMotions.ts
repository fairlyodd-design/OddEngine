import type { HomieState } from "../types/homie";

export type MotionPose = {
  y: number;
  bodyTilt: number;
  armSwing: number;
  glow: number;
  turn: number;
};

export function motionForState(state: HomieState, elapsed: number): MotionPose {
  const t = elapsed;
  switch (state) {
    case "listening":
      return {
        y: Math.sin(t * 2.1) * 0.026,
        bodyTilt: -0.14 + Math.sin(t * 1.1) * 0.02,
        armSwing: 0.08 + Math.sin(t * 1.2) * 0.04,
        glow: 0.58,
        turn: -0.06
      };
    case "talking":
      return {
        y: Math.sin(t * 3.6) * 0.04,
        bodyTilt: Math.sin(t * 2.4) * 0.06,
        armSwing: Math.sin(t * 3.1) * 0.18,
        glow: 0.74,
        turn: Math.sin(t * 1.5) * 0.05
      };
    case "alert":
      return {
        y: Math.sin(t * 2.3) * 0.018,
        bodyTilt: 0.02,
        armSwing: 0.05,
        glow: 0.98,
        turn: 0
      };
    case "celebrate":
      return {
        y: Math.abs(Math.sin(t * 4.1)) * 0.16,
        bodyTilt: Math.sin(t * 2.2) * 0.14,
        armSwing: Math.sin(t * 5.1) * 0.38,
        glow: 1,
        turn: Math.sin(t * 1.8) * 0.08
      };
    case "idle":
    default:
      return {
        y: Math.sin(t * 1.25) * 0.016,
        bodyTilt: Math.sin(t * 0.95) * 0.03,
        armSwing: Math.sin(t * 0.8) * 0.05,
        glow: 0.36,
        turn: Math.sin(t * 0.55) * 0.02
      };
  }
}
