export function resolvePreviewCandidate(paths: string[] = []) {
  const finalVideo = paths.find((p) => p.includes("final_episode.mp4"));
  if (finalVideo) return { kind: "final", path: finalVideo };

  const sceneClip = paths.find((p) => p.includes("scene_clips/"));
  if (sceneClip) return { kind: "scene", path: sceneClip };

  const shotImage = paths.find((p) => p.includes("shots/"));
  if (shotImage) return { kind: "shot", path: shotImage };

  return null;
}
