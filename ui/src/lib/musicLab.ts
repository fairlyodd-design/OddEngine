import { loadJSON, saveJSON } from "./storage";

export type VocalProfile = "male" | "female" | "character" | "duet" | "choir" | "none";
export type MusicMode = "song" | "instrumental";
export type MusicAction = "create-song" | "extend-track" | "make-instrumental" | "remaster" | "alt-versions";

export type SectionDynamicsProfile = { energy: number; density: number; drums: number; motion: "low" | "rise" | "drive" | "explode" | "fall" | "lift" | "glide" | "resolve" | "pulse"; };

export type StylePreset = "default" | "lofi" | "cinematic" | "trap" | "edm";
export type VocalMode = "spoken" | "hybrid" | "sing";

export type MusicProject = {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  prompt: string;
  genre: string;
  bpm: string;
  key: string;
  vibe: string;
  explicit: boolean;
  mode: MusicMode;
  vocalProfile: VocalProfile;
  vocalMode: VocalMode;
  enableVocals: boolean;
  stylePreset: StylePreset;
  chorusStrength: number;
  songLengthSec: number;
  structure: string[];
  sectionBars: { intro: number; verse: number; chorus: number; outro: number };
  sectionDynamics: { intro: SectionDynamicsProfile; verse: SectionDynamicsProfile; chorus: SectionDynamicsProfile; outro: SectionDynamicsProfile };
  lyrics: string;
  arrangement: string;
  renderBrief: string;
  releaseMetadata: {
    artistName: string;
    releaseTitle: string;
    subtitle: string;
    tags: string[];
  };
};

export type MusicBundle = {
  generatedAt: number;
  projectId: string;
  title: string;
  type: "music";
  finalOutput: string;
  artifactCount: number;
  bundleName: string;
  renderLab: {
    primaryBrief: string;
    visualBrief: string;
    audioBrief: string;
    videoBrief: string;
    script: string;
    requestedAssets: string[];
  };
  distribution: {
    hooks: string[];
    captions: string[];
    hashtags: string[];
    targets: string[];
    checklist: string[];
    monetization: string;
  };
  music: {
    lyrics: string;
    arrangement: string;
    bpm: string;
    key: string;
    vibe: string;
    genre: string;
    vocalProfile: VocalProfile;
  vocalMode: VocalMode;
  enableVocals: boolean;
  stylePreset: StylePreset;
    chorusStrength: number;
    structure: string[];
    sectionBars: { intro: number; verse: number; chorus: number; outro: number };
    sectionDynamics: { intro: SectionDynamicsProfile; verse: SectionDynamicsProfile; chorus: SectionDynamicsProfile; outro: SectionDynamicsProfile };
    songLengthSec: number;
  };
};

const KEY_PROJECTS = "oddengine:musiclab:projects:v1";
const KEY_ACTIVE = "oddengine:musiclab:active:v1";
const KEY_LAST_BUNDLE = "oddengine:musiclab:lastBundle:v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function slug(v: string) {
  return String(v || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "untitled";
}

export function defaultMusicProject(): MusicProject {
  const id = uid();
  return {
    id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    title: "Untitled song",
    prompt: "",
    genre: "cinematic pop",
    bpm: "112",
    key: "A minor",
    vibe: "emotional, triumphant, modern",
    explicit: false,
    mode: "song",
    vocalProfile: "female",
    vocalMode: "hybrid",
    enableVocals: true,
    stylePreset: "cinematic",
    chorusStrength: 80,
    songLengthSec: 150,
    structure: ["intro", "verse", "chorus", "verse", "chorus", "outro"],
    sectionBars: { intro: 2, verse: 4, chorus: 4, outro: 2 },
    sectionDynamics: {
      intro: { energy: 54, density: 34, drums: 26, motion: "rise" },
      verse: { energy: 68, density: 58, drums: 56, motion: "drive" },
      chorus: { energy: 95, density: 88, drums: 90, motion: "explode" },
      outro: { energy: 48, density: 28, drums: 22, motion: "fall" },
    },
    lyrics: "",
    arrangement: "",
    renderBrief: "",
    releaseMetadata: {
      artistName: "FairlyOdd Music",
      releaseTitle: "Untitled song",
      subtitle: "Single",
      tags: ["music", "single", "oddengine"],
    },
  };
}

export function listMusicProjects(): MusicProject[] {
  return loadJSON<MusicProject[]>(KEY_PROJECTS, []).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}
export function getActiveMusicProjectId(): string {
  return String(loadJSON<string>(KEY_ACTIVE, "") || "");
}
export function setActiveMusicProjectId(id: string) {
  saveJSON(KEY_ACTIVE, id);
}
export function saveMusicProject(project: MusicProject) {
  const current = listMusicProjects();
  const next = [project, ...current.filter((x) => x.id != project.id)].slice(0, 200);
  saveJSON(KEY_PROJECTS, next);
  saveJSON(KEY_ACTIVE, project.id);
  return project;
}
export function createMusicProject(seed?: Partial<MusicProject>) {
  const base = defaultMusicProject();
  const project = saveMusicProject({
    ...base,
    ...seed,
    releaseMetadata: { ...base.releaseMetadata, ...(seed?.releaseMetadata || {}) },
    updatedAt: Date.now(),
  });
  return project;
}
export function updateMusicProject(id: string, patch: Partial<MusicProject>) {
  const existing = listMusicProjects().find((x) => x.id === id) || defaultMusicProject();
  return saveMusicProject({
    ...existing,
    ...patch,
    releaseMetadata: { ...existing.releaseMetadata, ...(patch.releaseMetadata || {}) },
    updatedAt: Date.now(),
  });
}

function buildLyrics(project: MusicProject) {
  const vibe = project.vibe || "emotional";
  const title = project.title || "Untitled song";
  const prompt = project.prompt || "A powerful original track";
  const verse = `Verse\nWe chase the signal through the dark tonight\n${title} in the distance, glowing neon bright\n${prompt.slice(0, 72)}\nWe keep the fire alive, we keep the engine humming`;
  const pre = `Pre-Chorus\nHold the line, let the pressure rise\nEvery dream is a spark in disguise`;
  const chorus = `Chorus\n${title}, we light it up\nTurn the low tide into enough\nFrom the silence into the flame\nWe build the future, we call your name`;
  const bridge = `Bridge\n${vibe} hearts, steel nerves, midnight sky\nWe fall, we learn, we multiply`;
  return [verse, pre, chorus, verse, chorus, bridge, chorus].join("\n\n");
}

function buildArrangement(project: MusicProject) {
  const parts = [
    `Genre: ${project.genre}`,
    `BPM: ${project.bpm}`,
    `Key: ${project.key}`,
    `Vibe: ${project.vibe}`,
    `Mode: ${project.mode}`,
    `Vocal profile: ${project.vocalProfile}`,
    `Vocal mode: ${project.vocalMode}`,
    `Vocals enabled: ${project.enableVocals ? "yes" : "no"}`,
    `Style preset: ${project.stylePreset}`,
    `Chorus strength: ${project.chorusStrength}%`,
    `Length target: ${project.songLengthSec}s`,
    `Structure: ${project.structure.join(" → ")}`,
    `Section dynamics: ${Object.entries(project.sectionDynamics).map(([name, cfg]) => `${name} energy ${cfg.energy}% / density ${cfg.density}% / drums ${cfg.drums}% / motion ${cfg.motion}`).join(" | ")}`,
  ];
  return parts.join("\n");
}

function buildRenderBrief(project: MusicProject) {
  return [
    `Produce a ${project.mode === "instrumental" ? "cinematic instrumental" : "full song"} in the style lane of ${project.genre}.`,
    `Target BPM ${project.bpm}, key ${project.key}, vibe ${project.vibe}.`,
    `Vocal profile: ${project.vocalProfile}. Vocal mode: ${project.vocalMode}. Vocals ${project.enableVocals ? "enabled" : "disabled"}. Chorus strength ${project.chorusStrength}%.`,
    `Style preset: ${project.stylePreset}.`,
    `Build a release-ready master, 15s teaser, 30s hook cut, and cover art brief.`,
  ].join("\n");
}

export function generateMusicProject(project: MusicProject, action: MusicAction = "create-song") {
  const title = project.title?.trim() || "Untitled song";
  const lyrics = project.mode === "instrumental" || action === "make-instrumental" ? "Instrumental mode selected. No lyrics required." : buildLyrics({ ...project, title });
  const arrangement = buildArrangement(project);
  const renderBrief = buildRenderBrief(project);
  const updated = updateMusicProject(project.id, {
    title,
    lyrics,
    arrangement,
    renderBrief,
    releaseMetadata: {
      ...project.releaseMetadata,
      releaseTitle: title,
    },
  });
  return { project: updated, action };
}

export function buildMusicBundle(project: MusicProject): MusicBundle {
  const lyrics = project.lyrics || buildLyrics(project);
  const arrangement = project.arrangement || buildArrangement(project);
  const renderBrief = project.renderBrief || buildRenderBrief(project);
  const title = project.title || "Untitled song";
  const hooks = [
    `${title} — chorus hook for TikTok/Shorts`,
    `${title} — emotional 15 second teaser`,
    `${title} — punchy release-day callout`,
  ];
  const captions = [
    `New drop: ${title}. Built inside FairlyOdd Music Lab.`,
    `${title} is live. Save it, share it, and run it back.`,
  ];
  const hashtags = ["#newmusic", "#oddengine", "#indieartist", "#musiclab", "#release"];
  const bundle: MusicBundle = {
    generatedAt: Date.now(),
    projectId: project.id,
    title,
    type: "music",
    finalOutput: [
      `Release: ${title}`,
      "",
      "Lyrics",
      lyrics,
      "",
      "Arrangement",
      arrangement,
      "",
      "Render Brief",
      renderBrief,
    ].join("\n"),
    artifactCount: 10,
    bundleName: `${slug(title)}-music-pack`,
    renderLab: {
      primaryBrief: renderBrief,
      visualBrief: `Create cover art and short-form visual loop for ${title}.`,
      audioBrief: `Create full mix, master, instrumental, acapella, and 15s/30s promo cuts for ${title}.`,
      videoBrief: `Create looping visualizer and vertical promo snippets for ${title}.`,
      script: lyrics,
      requestedAssets: ["song-master.wav", "instrumental.wav", "acapella.wav", "cover-art.png", "vertical-teaser.mp4", "lyric-video.mp4"],
    },
    distribution: {
      hooks,
      captions,
      hashtags,
      targets: ["youtube", "tiktok", "instagram", "gumroad", "local"],
      checklist: ["Master approved", "Metadata completed", "Cover art approved", "Promo cuts exported", "Publisher queue ready"],
      monetization: "Release single, short-form promo clips, lyric visualizer, Gumroad stem pack, and future subscription drops.",
    },
    music: {
      lyrics,
      arrangement,
      bpm: project.bpm,
      key: project.key,
      vibe: project.vibe,
      genre: project.genre,
      vocalProfile: project.vocalProfile,
      vocalMode: project.vocalMode,
      enableVocals: project.enableVocals,
    stylePreset: project.stylePreset,
      chorusStrength: project.chorusStrength,
      structure: project.structure,
      sectionBars: project.sectionBars,
      sectionDynamics: project.sectionDynamics,
      songLengthSec: project.songLengthSec,
    },
  };
  saveJSON(KEY_LAST_BUNDLE, bundle);
  return bundle;
}

export function getLastMusicBundle(): MusicBundle | null {
  return loadJSON<MusicBundle | null>(KEY_LAST_BUNDLE, null);
}
