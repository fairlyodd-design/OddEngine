import { loadJSON, saveJSON } from "./storage";
import type { OnePromptProject } from "./creationOrchestrator";
import { registerArtifact } from "./artifactRegistry";
import { attachArtifactToRun, listSystemRuns } from "./systemRunRegistry";
import { logSystemEvent } from "./systemEventLog";

export type MaterializedArtifactKind = "book" | "video" | "audio" | "script" | "bundle";
export type MaterializedArtifactFile = {
  name: string;
  mime: string;
  content: string;
  role?: string;
};

export type MaterializedArtifact = {
  id: string;
  projectId: string;
  title: string;
  kind: MaterializedArtifactKind;
  createdAt: number;
  prompt: string;
  summary: string;
  previewText: string;
  posterText?: string;
  files: MaterializedArtifactFile[];
  monetization: string[];
  deliverables: string[];
  status: "ready" | "render-needed";
};

const KEY = "oddengine:studio:materializedArtifacts:v1";
const PREVIEW_KEY = "oddengine:studio:selectedArtifact:v1";

function uid() {
  return `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeLines(lines: string[]) {
  return lines.filter(Boolean).join("\n");
}

function buildDraftBody(project: OnePromptProject) {
  const heading =
    project.classification.mode === "book"
      ? `# ${project.productTitle}\n\n## Outline-generated manuscript starter\n`
      : project.classification.mode === "video"
        ? `# ${project.productTitle}\n\n## Audience-ready script + storyboard pack\n`
        : `# ${project.productTitle}\n\n## Final artifact pack\n`;

  const body = project.blueprint
    .map((item) => {
      const unitLabel =
        project.classification.mode === "book"
          ? `Chapter ${item.number}`
          : project.classification.mode === "video"
            ? `Scene ${item.number}`
            : `Part ${item.number}`;

      return `${unitLabel}: ${item.title}\n${item.beat}\n\nHomie production note: keep the tone aligned with the original prompt and finish this section like it is heading to release, not just brainstorming.`;
    })
    .join("\n\n");

  return `${heading}\nPrompt: ${project.prompt}\n\n${body}`;
}

function buildStoryboard(project: OnePromptProject) {
  return safeLines([
    `TITLE: ${project.productTitle}`,
    `MODE: ${project.classification.mode}`,
    `AUDIENCE: ${project.classification.audienceHint}`,
    `RUNTIME: ${project.classification.runtimeHint}`,
    "",
    ...project.blueprint.map(
      (item) =>
        `${project.classification.mode === "video" ? "SCENE" : "BEAT"} ${item.number}: ${item.title} — ${item.beat}`,
    ),
  ]);
}

function buildListingCopy(project: OnePromptProject) {
  return safeLines([
    `${project.productTitle}`,
    "",
    project.headline,
    "",
    "Why it lands:",
    `- Audience: ${project.classification.audienceHint}`,
    `- Polish: ${project.classification.polishLevel}`,
    `- Runtime / size: ${project.classification.runtimeHint}`,
    ...project.deliverables.map((item) => `- ${item}`),
    "",
    "Monetization angles:",
    ...project.monetization.map((item) => `- ${item}`),
  ]);
}

function dataUrl(mime: string, content: string) {
  return `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
}

export function listMaterializedArtifacts(): MaterializedArtifact[] {
  return loadJSON<MaterializedArtifact[]>(KEY, []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function saveMaterializedArtifacts(items: MaterializedArtifact[]) {
  saveJSON(KEY, items);
}

export function getSelectedArtifactId(): string {
  return loadJSON<string>(PREVIEW_KEY, "");
}

export function setSelectedArtifactId(id: string) {
  saveJSON(PREVIEW_KEY, id || "");
}

export function materializeProjectArtifact(project: OnePromptProject): MaterializedArtifact {
  const draftBody = buildDraftBody(project);
  const storyboard = buildStoryboard(project);
  const listingCopy = buildListingCopy(project);
  const summary = [
    `${project.productTitle}`,
    `Mode: ${project.classification.mode}`,
    `Audience: ${project.classification.audienceHint}`,
    `Runtime / size: ${project.classification.runtimeHint}`,
    "",
    ...project.deliverables.map((item) => `- ${item}`),
  ].join("\n");

  const fileBase =
    project.productTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "artifact";

  const files: MaterializedArtifactFile[] = [
    {
      name: `${fileBase}-final-pack.md`,
      mime: "text/markdown",
      content: draftBody,
      role: "main",
    },
    {
      name: `${fileBase}-storyboard.txt`,
      mime: "text/plain",
      content: storyboard,
      role: project.classification.mode === "video" ? "storyboard" : "outline",
    },
    {
      name: `${fileBase}-listing-copy.txt`,
      mime: "text/plain",
      content: listingCopy,
      role: "listing",
    },
  ];

  const kind: MaterializedArtifactKind =
    project.classification.mode === "book"
      ? "book"
      : project.classification.mode === "video"
        ? "video"
        : project.classification.mode === "audio"
          ? "audio"
          : "script";

  return {
    id: uid(),
    projectId: project.id,
    title: project.productTitle,
    kind,
    createdAt: Date.now(),
    prompt: project.prompt,
    summary,
    previewText: draftBody,
    posterText: storyboard,
    files,
    monetization: project.monetization,
    deliverables: project.deliverables,
    status:
      project.classification.mode === "video" || project.classification.mode === "audio"
        ? "render-needed"
        : "ready",
  };
}

export function upsertMaterializedArtifact(artifact: MaterializedArtifact) {
  const current = listMaterializedArtifacts();
  const next = [artifact, ...current.filter((item) => item.projectId !== artifact.projectId)];
  saveMaterializedArtifacts(next);
  const relatedRun = listSystemRuns().find((item) => item.source === "one-prompt-project" && item.sourceId === artifact.projectId);
  const registered = registerArtifact({ id: artifact.id, title: artifact.title, kind: artifact.kind, source: "one-prompt-project", sourceId: artifact.projectId, runId: relatedRun?.id, status: artifact.status });
  if (relatedRun) attachArtifactToRun(relatedRun.id, registered.id);
  logSystemEvent({ level: artifact.status === "ready" ? "good" : "info", scope: "studio", title: `Materialized ${artifact.title}`, body: `Artifact pack saved as ${artifact.kind}.`, runId: relatedRun?.id });
  setSelectedArtifactId(artifact.id);
  return artifact;
}

export function maybeMaterializeProject(project: OnePromptProject) {
  const packageStage = project.stages.find((stage) => stage.id === "package");
  const done = !!packageStage && packageStage.status === "complete";
  if (!done) return null;

  const existing = listMaterializedArtifacts().find((item) => item.projectId === project.id);
  if (existing) {
    setSelectedArtifactId(existing.id);
    return existing;
  }

  return upsertMaterializedArtifact(materializeProjectArtifact(project));
}

export function buildDownloadHref(file: MaterializedArtifactFile) {
  return dataUrl(file.mime, file.content);
}
