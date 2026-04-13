export type MotionStageLabel =
  | "motionGeneration"
  | "motionFallbackUsed";

export function inferMotionLabel(paths: string[] = []) {
  const lower = paths.map((p) => p.toLowerCase());
  if (lower.some((p) => p.includes(".motion."))) return "motionGeneration";
  if (lower.some((p) => p.includes(".fallback."))) return "motionFallbackUsed";
  return null;
}
