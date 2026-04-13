export type ShotPlanShot = {
  shotId: string;
  type: string;
  durationSec: number;
  camera: string;
  visualPrompt: string;
  negativePrompt: string;
  continuity: Record<string, string>;
};

export type ShotPlanScene = {
  sceneId: string;
  title: string;
  summary: string;
  shots: ShotPlanShot[];
};

export type ShotPlan = {
  episodeId: string;
  stylePreset: string;
  aspectRatio: string;
  scenes: ShotPlanScene[];
};

export function summarizeShotPlan(plan: ShotPlan) {
  const shotsTotal = plan.scenes.reduce((sum, scene) => sum + scene.shots.length, 0);
  return {
    scenesTotal: plan.scenes.length,
    shotsTotal,
    latestSceneId: plan.scenes.at(-1)?.sceneId ?? null,
  };
}
