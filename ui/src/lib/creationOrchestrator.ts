import { classifyArtifactPrompt, type ArtifactClassification } from "./artifactClassifier";
import { buildBookDeliverables, buildBookOutline } from "./pipelineFlows/bookPipeline";
import { buildVideoDeliverables, buildVideoScenePlan } from "./pipelineFlows/videoPipeline";
import { buildAudioDeliverables, buildAudioTrackPlan } from "./pipelineFlows/audioPipeline";

export type OnePromptStageStatus = "queued" | "active" | "complete";

export type OnePromptStage = {
  id: string;
  label: string;
  detail: string;
  status: OnePromptStageStatus;
};

export type OnePromptBlueprintItem = {
  number: number;
  title: string;
  beat: string;
};

export type OnePromptProject = {
  id: string;
  prompt: string;
  createdAt: number;
  classification: ArtifactClassification;
  productTitle: string;
  headline: string;
  operatorLine: string;
  stages: OnePromptStage[];
  blueprint: OnePromptBlueprintItem[];
  deliverables: string[];
  monetization: string[];
  finalArtifactSummary: string;
  progress: number;
  backendBridgeState?: "idle" | "submitted" | "failed";
  backendJobId?: string;
};

function uid() {
  return `oneprompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stageTemplate(classification: ArtifactClassification): OnePromptStage[] {
  const common: OnePromptStage[] = [
    { id: "classify", label: "Artifact detection", detail: "Interpret the prompt and lock the end product.", status: "complete" },
    { id: "plan", label: "Blueprint", detail: "Build the outline, scene map, or release structure.", status: "active" },
    { id: "draft", label: classification.mode === "book" ? "Write manuscript" : classification.mode === "video" ? "Write script" : "Generate content", detail: "Create the core content in smart chunks.", status: "queued" },
    { id: "polish", label: "Polish", detail: "Revise, tighten, and prep for audience consumption.", status: "queued" },
    { id: "package", label: "Package final artifact", detail: "Prepare the audience-ready output, metadata, and handoff.", status: "queued" },
  ];
  if (classification.mode === "video") {
    common.splice(3, 0, { id: "storyboard", label: "Storyboard + render prep", detail: "Break visuals into shots and render-ready passes.", status: "queued" });
  }
  if (classification.mode === "audio" || classification.mode === "multi") {
    common.splice(common.length - 1, 0, { id: "assets", label: "Assets + release kit", detail: "Prep cover, metadata, and distribution assets.", status: "queued" });
  }
  return common;
}

function buildBlueprint(prompt: string, classification: ArtifactClassification): OnePromptBlueprintItem[] {
  if (classification.mode === "book" || classification.mode === "script") return buildBookOutline(prompt, classification);
  if (classification.mode === "video") return buildVideoScenePlan(prompt, classification);
  return buildAudioTrackPlan(prompt, classification);
}

function buildDeliverables(prompt: string, classification: ArtifactClassification): string[] {
  if (classification.mode === "book" || classification.mode === "script") return buildBookDeliverables(prompt, classification);
  if (classification.mode === "video") return buildVideoDeliverables(prompt, classification);
  return buildAudioDeliverables(prompt, classification);
}

function buildMonetization(classification: ArtifactClassification) {
  const base = ["Publish-ready metadata", "Audience hook + listing copy", "Repurpose into clips / extras"];
  if (classification.mode === "book") return [...base, "Amazon KDP handoff", "Gumroad bonus edition"];
  if (classification.mode === "video") return [...base, "YouTube upload pack", "Short-form teaser cuts"];
  if (classification.mode === "audio") return [...base, "Single / EP release pack", "Lyric or visualizer add-on"];
  return [...base, "Bundle / premium offer handoff"];
}

function buildHeadline(classification: ArtifactClassification) {
  if (classification.mode === "book") return "One prompt becomes a finished longform writing machine.";
  if (classification.mode === "video") return "One prompt becomes a storyboard-to-release production run.";
  if (classification.mode === "audio") return "One prompt becomes a release-ready audio pipeline.";
  return "One prompt becomes a full artifact factory lane.";
}

export function createOnePromptProject(prompt: string): OnePromptProject {
  const classification = classifyArtifactPrompt(prompt);
  const blueprint = buildBlueprint(prompt, classification);
  const deliverables = buildDeliverables(prompt, classification);
  const productTitle = classification.titleHint || "Untitled creation";
  const stages = stageTemplate(classification);
  const finalArtifactSummary = [
    `Title: ${productTitle}`,
    `Mode: ${classification.mode}`,
    `Kind: ${classification.kind}`,
    `Audience: ${classification.audienceHint}`,
    `Runtime / size: ${classification.runtimeHint}`,
    "",
    "Audience-ready package includes:",
    ...deliverables.map((item) => `- ${item}`),
  ].join("\n");

  return {
    id: uid(),
    prompt,
    createdAt: Date.now(),
    classification,
    productTitle,
    headline: buildHeadline(classification),
    operatorLine: `Homie can break this into ${blueprint.length} smart ${classification.mode === "book" ? "chapters" : classification.mode === "video" ? "scenes" : "parts"} and push it through the queue without you babysitting every step.`,
    stages,
    blueprint,
    deliverables,
    monetization: buildMonetization(classification),
    finalArtifactSummary,
    progress: 18,
    backendBridgeState: "idle",
  };
}

export function advanceOnePromptProject(project: OnePromptProject): OnePromptProject {
  const stages = project.stages.map((stage) => ({ ...stage }));
  const activeIndex = stages.findIndex((stage) => stage.status === "active");
  if (activeIndex >= 0) {
    stages[activeIndex].status = "complete";
    if (stages[activeIndex + 1]) stages[activeIndex + 1].status = "active";
  } else {
    const queuedIndex = stages.findIndex((stage) => stage.status === "queued");
    if (queuedIndex >= 0) stages[queuedIndex].status = "active";
  }
  const completeCount = stages.filter((stage) => stage.status === "complete").length;
  const progress = Math.round((completeCount / stages.length) * 100);
  return { ...project, stages, progress: Math.max(project.progress, progress) };
}

export function autopilotOnePromptProject(project: OnePromptProject): OnePromptProject {
  let current = { ...project, stages: project.stages.map((stage) => ({ ...stage })) };
  while (current.stages.some((stage) => stage.status !== "complete")) {
    current = advanceOnePromptProject(current);
  }
  return {
    ...current,
    progress: 100,
    finalArtifactSummary: `${current.finalArtifactSummary}\n- status: audience-ready\n- autopilot: completed all planned stages`,
  };
}

export function markOnePromptProjectBridged(project: OnePromptProject, backendJobId: string) {
  return {
    ...project,
    backendBridgeState: "submitted" as const,
    backendJobId,
    finalArtifactSummary: `${project.finalArtifactSummary}\n- backend job id: ${backendJobId}`,
    progress: Math.max(project.progress, 72),
  };
}

export function markOnePromptProjectBridgeFailed(project: OnePromptProject, reason: string) {
  return {
    ...project,
    backendBridgeState: "failed" as const,
    finalArtifactSummary: `${project.finalArtifactSummary}\n- backend bridge failed: ${reason}`,
  };
}
