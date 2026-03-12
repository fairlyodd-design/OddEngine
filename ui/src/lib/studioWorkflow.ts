export type WorkflowStage =
  | "Idea"
  | "Draft"
  | "Build"
  | "Render"
  | "Review"
  | "Package"
  | "Publish";

export type WorkflowProjectSummary = {
  title: string;
  masterPrompt: string;
  projectType: string;
  productionType: string;
  stage: WorkflowStage;
  assets: Array<{ kind: string; title: string; ts?: number }>;
  renderJobs?: Array<{ status?: string; output?: { imported?: boolean; watchedAt?: number | null } | null }>;
};

export const STAGE_ORDER: WorkflowStage[] = [
  "Idea",
  "Draft",
  "Build",
  "Render",
  "Review",
  "Package",
  "Publish",
];

const REQUIRED_BY_STAGE: Record<WorkflowStage, string[]> = {
  Idea: ["oneSheet"],
  Draft: ["story", "song"],
  Build: ["storyboard", "shotList", "productionPack"],
  Render: ["renderHandoff"],
  Review: ["renderJob"],
  Package: ["productionRunbook", "screeningPacket"],
  Publish: ["productionRunbook", "screeningPacket", "renderJob"],
};

export function newestFirst<T extends { ts?: number }>(items: T[]) {
  return [...items].sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
}

export function assetKinds(assets: Array<{ kind: string }>) {
  return new Set(assets.map((asset) => asset.kind));
}

export function stageProgressIndex(stage: WorkflowStage) {
  return Math.max(0, STAGE_ORDER.indexOf(stage));
}

export function canAdvanceStage(stage: WorkflowStage) {
  return stage !== "Publish";
}

export function nextStage(stage: WorkflowStage): WorkflowStage {
  const idx = stageProgressIndex(stage);
  return STAGE_ORDER[Math.min(idx + 1, STAGE_ORDER.length - 1)];
}

export function previousStage(stage: WorkflowStage): WorkflowStage {
  const idx = stageProgressIndex(stage);
  return STAGE_ORDER[Math.max(idx - 1, 0)];
}

export function getMissingPieces(summary: WorkflowProjectSummary): string[] {
  const have = assetKinds(summary.assets || []);
  const stageNeeds = REQUIRED_BY_STAGE[summary.stage] || [];
  const missing = stageNeeds.filter((kind) => !have.has(kind));

  if (!summary.masterPrompt.trim()) missing.unshift("masterPrompt");
  if (!summary.title.trim()) missing.unshift("title");
  return Array.from(new Set(missing));
}

export function getShipBlockers(summary: WorkflowProjectSummary): string[] {
  const blockers: string[] = [];
  if (!summary.masterPrompt.trim()) blockers.push("Add a master prompt.");
  if (!["song", "book", "cartoon", "video", "music video", "other"].includes(String(summary.projectType))) {
    blockers.push("Set a valid project type.");
  }
  const missing = getMissingPieces(summary);
  if (summary.stage === "Render" && missing.includes("renderHandoff")) blockers.push("Generate or regenerate the Render Lab handoff.");
  if (summary.stage === "Review") {
    const hasRenderJob = (summary.renderJobs || []).length > 0 || assetKinds(summary.assets).has("renderJob");
    if (!hasRenderJob) blockers.push("Create at least one render job before review.");
  }
  if (summary.stage === "Package") {
    if (!assetKinds(summary.assets).has("screeningPacket")) blockers.push("Create a screening packet before packaging.");
    if (!assetKinds(summary.assets).has("productionRunbook")) blockers.push("Create a producer runbook before packaging.");
  }
  if (summary.stage === "Publish") {
    const imported = (summary.renderJobs || []).some((job) => job.output?.imported);
    if (!imported) blockers.push("Import at least one completed output before publish.");
  }
  return Array.from(new Set(blockers));
}

export function getReadinessScore(summary: WorkflowProjectSummary): number {
  let score = 10;
  const kinds = assetKinds(summary.assets);
  if (summary.masterPrompt.trim()) score += 10;
  if (summary.title.trim()) score += 5;
  if (kinds.has("oneSheet")) score += 10;
  if (kinds.has("story") || kinds.has("song")) score += 15;
  if (kinds.has("storyboard") || kinds.has("shotList")) score += 15;
  if (kinds.has("productionPack")) score += 10;
  if (kinds.has("renderHandoff")) score += 10;
  if (kinds.has("renderJob") || (summary.renderJobs || []).length > 0) score += 10;
  if (kinds.has("productionRunbook")) score += 7;
  if (kinds.has("screeningPacket")) score += 8;
  if ((summary.renderJobs || []).some((job) => job.output?.imported)) score += 5;
  const blockers = getShipBlockers(summary).length;
  score -= blockers * 7;
  return Math.max(0, Math.min(100, score));
}

export function getNextRecommendedAction(summary: WorkflowProjectSummary): string {
  const missing = getMissingPieces(summary);
  if (missing.includes("masterPrompt")) return "Write the master prompt first.";
  if (summary.stage === "Idea") return "Generate the full pipeline to create the first working packet.";
  if (summary.stage === "Draft") {
    if (missing.includes("story") && missing.includes("song")) return "Generate or regenerate the Writing Room.";
    return "Review the first draft, then advance into Build.";
  }
  if (summary.stage === "Build") {
    if (missing.includes("storyboard") || missing.includes("shotList")) return "Generate the Director Room assets.";
    if (missing.includes("productionPack")) return "Generate the Music Lab assets.";
    return "Confirm scene flow and music direction, then move into Render.";
  }
  if (summary.stage === "Render") {
    if (missing.includes("renderHandoff")) return "Generate the Render Lab handoff.";
    return "Create a render job from the latest handoff.";
  }
  if (summary.stage === "Review") {
    if (!(summary.renderJobs || []).length) return "Create and poll a render job before review.";
    if (!(summary.renderJobs || []).some((job) => job.output?.imported)) return "Import the completed render so it becomes part of the packet.";
    return "Review the imported output and gather final notes.";
  }
  if (summary.stage === "Package") {
    if (missing.includes("productionRunbook")) return "Generate Producer Ops to build the runbook.";
    if (missing.includes("screeningPacket")) return "Generate the screening packet for final review.";
    return "Freeze the current packet and prep the publish checklist.";
  }
  if (summary.stage === "Publish") return "Final review complete. Package and publish the project.";
  return "Keep pushing the project toward the next stage.";
}

export function inferStageFromProject(summary: WorkflowProjectSummary): WorkflowStage {
  const kinds = assetKinds(summary.assets);
  const imported = (summary.renderJobs || []).some((job) => job.output?.imported);
  if (imported && kinds.has("screeningPacket") && kinds.has("productionRunbook")) return "Publish";
  if (kinds.has("productionRunbook") || kinds.has("screeningPacket")) return "Package";
  if ((summary.renderJobs || []).length > 0 || kinds.has("renderJob")) return "Review";
  if (kinds.has("renderHandoff")) return "Render";
  if (kinds.has("storyboard") || kinds.has("shotList") || kinds.has("productionPack")) return "Build";
  if (kinds.has("story") || kinds.has("song")) return "Draft";
  return "Idea";
}
