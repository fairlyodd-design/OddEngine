export type WriterStage = "idea" | "draft" | "revise" | "finished";

export type WriterProject = {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  format: string;
  stage: WriterStage;
  updatedAt: string;
  chapters: number;
  notesCount: number;
  tweakQueue: string[];
  resumeFrom: string;
  lane: string;
  summary: string;
  notes: string[];
  favorite?: boolean;
  archived?: boolean;
  tags?: string[];
};

export const PROJECT_STAGE_LABELS: Record<WriterStage, string> = {
  idea: "Idea",
  draft: "Draft",
  revise: "Revise",
  finished: "Finished",
};

export const WRITER_VAULT_STORAGE_KEY = "oddengine:writer-vault:v2";

export const DEFAULT_WRITER_PROJECTS: WriterProject[] = [
  {
    id: "orb-book",
    title: "Orb Hallway Draft",
    fileName: "Orb_Hallway_Draft.docx",
    fileSize: 248000,
    format: "DOCX",
    stage: "revise",
    updatedAt: "3/12/2026",
    chapters: 12,
    notesCount: 8,
    tweakQueue: [
      "Tighten chapter opening",
      "Clarify hallway reveal",
      "Check scene pacing in middle act",
    ],
    resumeFrom: "Chapter 9 rewrite",
    lane: "Graphic novel / memoir lane",
    summary: "Personal narrative draft with strong imagery and a half-finished middle stretch.",
    notes: [
      "Keep the emotional truth higher than the spooky flavor.",
      "Chapter 9 needs a cleaner handoff into the next room scene.",
      "Look for lines that can be more visual and less explanatory.",
    ],
    favorite: true,
    archived: false,
    tags: ["memoir", "graphic", "priority"],
  },
  {
    id: "band-book",
    title: "Band Years Book",
    fileName: "Band_Years_Notes.pdf",
    fileSize: 513000,
    format: "PDF",
    stage: "draft",
    updatedAt: "3/9/2026",
    chapters: 7,
    notesCount: 5,
    tweakQueue: [
      "Break timeline into eras",
      "Add chapter hook for Friday night section",
    ],
    resumeFrom: "Scene order / era mapping",
    lane: "Music memoir lane",
    summary: "Working structure for the band-life stories with strong raw material and loose chapter ordering.",
    notes: [
      "The songs are emotional anchors — use them as chapter pivots.",
      "Keep specific details from rooms, smells, and gear setups.",
    ],
    favorite: false,
    archived: false,
    tags: ["music", "memoir"],
  },
  {
    id: "finished-short",
    title: "Finished Short Collection",
    fileName: "Finished_Shorts.md",
    fileSize: 97000,
    format: "MD",
    stage: "finished",
    updatedAt: "2/25/2026",
    chapters: 5,
    notesCount: 2,
    tweakQueue: [
      "Prepare final polish pass",
      "Tag strongest pieces for release packet",
    ],
    resumeFrom: "Release prep",
    lane: "Finished shelf",
    summary: "Completed short pieces ready for polish, re-sequencing, or publishing prep.",
    notes: [
      "Choose the strongest opener first.",
      "Keep one release-ready PDF in the finished shelf.",
    ],
    favorite: true,
    archived: false,
    tags: ["finished", "release"],
  },
];

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getStageTone(stage: WriterStage) {
  switch (stage) {
    case "idea":
      return "idea";
    case "draft":
      return "draft";
    case "revise":
      return "revise";
    case "finished":
      return "finished";
    default:
      return "draft";
  }
}

export function sortProjects(projects: WriterProject[], mode: "recent" | "title" | "priority" = "recent") {
  const weight: Record<WriterStage, number> = {
    revise: 0,
    draft: 1,
    idea: 2,
    finished: 3,
  };

  const copy = [...projects];
  if (mode === "title") {
    return copy.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (mode === "priority") {
    return copy.sort((a, b) => {
      const fav = Number(!!b.favorite) - Number(!!a.favorite);
      if (fav !== 0) return fav;
      const stageCompare = weight[a.stage] - weight[b.stage];
      if (stageCompare !== 0) return stageCompare;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function buildProjectStats(projects: WriterProject[]) {
  return {
    totalProjects: projects.length,
    revisionCount: projects.filter((project) => project.stage === "revise" && !project.archived).length,
    finishedCount: projects.filter((project) => project.stage === "finished" && !project.archived).length,
    totalQueuedTweaks: projects.reduce((sum, project) => sum + project.tweakQueue.length, 0),
    favorites: projects.filter((project) => project.favorite && !project.archived).length,
    archived: projects.filter((project) => project.archived).length,
  };
}

export function safeLoadWriterVault(): WriterProject[] {
  if (typeof window === "undefined") return DEFAULT_WRITER_PROJECTS;
  try {
    const raw = window.localStorage.getItem(WRITER_VAULT_STORAGE_KEY);
    if (!raw) return DEFAULT_WRITER_PROJECTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_WRITER_PROJECTS;
  } catch {
    return DEFAULT_WRITER_PROJECTS;
  }
}

export function safeSaveWriterVault(projects: WriterProject[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WRITER_VAULT_STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // ignore local-only storage errors
  }
}

export function makeProjectFromFile(file: File, index: number): WriterProject {
  return {
    id: `upload-${Date.now()}-${index}`,
    title: file.name.replace(/\.[^.]+$/, ""),
    fileName: file.name,
    fileSize: file.size,
    stage: "draft",
    updatedAt: new Date().toLocaleDateString(),
    chapters: 0,
    notesCount: 0,
    tweakQueue: [
      "Review imported structure",
      "Set an honest stage",
      "Add a resume point",
    ],
    resumeFrom: "Upload review",
    format: file.name.split(".").pop()?.toUpperCase() || "FILE",
    lane: "Imported manuscript",
    summary: "Imported into Writer Vault for later review, finishing, or polish.",
    notes: ["Imported file — add context and next steps."],
    favorite: false,
    archived: false,
    tags: ["imported"],
  };
}

export function normalizeTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
