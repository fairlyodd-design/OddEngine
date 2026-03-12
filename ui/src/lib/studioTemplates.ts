export type StudioProjectType =
  | "song"
  | "book"
  | "cartoon"
  | "video"
  | "music video"
  | "other";

export type TemplateId =
  | "song"
  | "book"
  | "cartoon-short"
  | "music-video"
  | "promo-video"
  | "pitch-packet";

export type TemplateStarterAsset = {
  kind:
    | "oneSheet"
    | "story"
    | "song"
    | "storyboard"
    | "shotList"
    | "productionPack"
    | "productionRunbook"
    | "renderHandoff"
    | "screeningPacket";
  title: string;
  content: string;
};

export type StudioTemplate = {
  id: TemplateId;
  label: string;
  shortLabel: string;
  description: string;
  projectType: StudioProjectType;
  visualStyle: string;
  productionType: string;
  releaseTarget: string;
  budgetBand: string;
  scopeLevel: string;
  masterPromptStarter: string;
  recommendedFirstRoom: "home" | "writing" | "director" | "music" | "render" | "ops";
  starterAssets: TemplateStarterAsset[];
};

function templateAsset(kind: TemplateStarterAsset["kind"], title: string, content: string): TemplateStarterAsset {
  return { kind, title, content };
}

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  {
    id: "song",
    label: "Song",
    shortLabel: "Song",
    description: "Start with a hook-first structure, lyric scaffold, sonic direction, and release-minded song packet.",
    projectType: "song",
    visualStyle: "cinematic realism",
    productionType: "Song",
    releaseTarget: "YouTube / Social",
    budgetBand: "$",
    scopeLevel: "Lean",
    masterPromptStarter:
      "Write a song from this core idea. Give it a strong emotional hook, a memorable chorus, and a final line that feels finished.",
    recommendedFirstRoom: "writing",
    starterAssets: [
      templateAsset("oneSheet", "Song Template Brief", "# Song Template\n\n## Goal\nTurn one emotional idea into a polished song packet with hook, chorus, and release-ready direction."),
      templateAsset("song", "Song Structure Starter", "# Song Structure\n\n- Verse 1\n- Pre-Chorus\n- Chorus\n- Verse 2\n- Chorus\n- Bridge\n- Final Chorus / Outro"),
      templateAsset("productionPack", "Song Direction Starter", "# Music Direction\n\n- Tempo/mood\n- Chorus energy target\n- Instrument palette\n- Vocal tone\n- Final payoff cue"),
    ],
  },
  {
    id: "book",
    label: "Book",
    shortLabel: "Book",
    description: "Set up a book project with premise, chapter spine, narrative arc, and product-minded writing workflow.",
    projectType: "book",
    visualStyle: "dreamy watercolor",
    productionType: "Book",
    releaseTarget: "Pitch / Publishing",
    budgetBand: "$$",
    scopeLevel: "Epic",
    masterPromptStarter:
      "Turn this story idea into a book-ready concept with premise, chapter path, emotional arc, and a clear reader promise.",
    recommendedFirstRoom: "writing",
    starterAssets: [
      templateAsset("oneSheet", "Book Template Brief", "# Book Template\n\n## Goal\nTurn one idea into a structured book packet with premise, chapter arc, and polished working copy path."),
      templateAsset("story", "Chapter Spine Starter", "# Chapter Spine\n\n1. Opening hook\n2. Inciting shift\n3. Escalation\n4. Midpoint change\n5. Descent / turn\n6. Resolve"),
      templateAsset("productionRunbook", "Publishing Prep Starter", "# Publishing Prep\n\n- premise lock\n- chapter map\n- audience summary\n- sample pages\n- pitch packet"),
    ],
  },
  {
    id: "cartoon-short",
    label: "Cartoon Short",
    shortLabel: "Cartoon",
    description: "Spin up a stylized short with gag/story beats, character motion plan, and short-form render-friendly structure.",
    projectType: "cartoon",
    visualStyle: "cartoon surreal",
    productionType: "Cartoon",
    releaseTarget: "YouTube / Social",
    budgetBand: "$$",
    scopeLevel: "Balanced",
    masterPromptStarter:
      "Create a cartoon short from this idea. Keep the concept simple, visual, funny or emotionally clear, and easy to stage in beats.",
    recommendedFirstRoom: "director",
    starterAssets: [
      templateAsset("oneSheet", "Cartoon Short Brief", "# Cartoon Short Template\n\n## Goal\nBuild a short, visual, character-forward piece that reads fast and stages cleanly."),
      templateAsset("storyboard", "Cartoon Beat Starter", "# Cartoon Beats\n\n1. Hook image\n2. Character intro\n3. Escalation gag\n4. Twist\n5. Payoff"),
      templateAsset("shotList", "Cartoon Shot Starter", "# Shot Starter\n\n- Establishing frame\n- Character close beat\n- Action reaction beat\n- Payoff frame"),
    ],
  },
  {
    id: "music-video",
    label: "Music Video",
    shortLabel: "Music Video",
    description: "Start with song-led visual structure, performance/story split, cue timing, and render handoff direction.",
    projectType: "music video",
    visualStyle: "neo-noir anime",
    productionType: "Music Video",
    releaseTarget: "YouTube / Social",
    budgetBand: "$$$",
    scopeLevel: "Balanced",
    masterPromptStarter:
      "Turn this song concept into a music video packet with performance beats, visual motifs, cue map, and render-ready sequence flow.",
    recommendedFirstRoom: "music",
    starterAssets: [
      templateAsset("oneSheet", "Music Video Brief", "# Music Video Template\n\n## Goal\nMarry the song hook to a visual concept that can stage clearly and render cleanly."),
      templateAsset("productionPack", "Cue Map Starter", "# Cue Map\n\n- intro visual cue\n- first verse motif\n- chorus payoff image\n- bridge twist\n- ending resolve"),
      templateAsset("renderHandoff", "Music Video Render Starter", "{\n  \"renderIntent\": \"Music video starter handoff\",\n  \"notes\": [\"prioritize chorus payoffs\", \"sync visual turns to cue map\"]\n}"),
    ],
  },
  {
    id: "promo-video",
    label: "Promo Video",
    shortLabel: "Promo",
    description: "Create a fast promo package with offer/message clarity, scene ladder, CTA, and product-facing delivery lane.",
    projectType: "video",
    visualStyle: "glitch cyberpop",
    productionType: "Movie",
    releaseTarget: "YouTube / Social",
    budgetBand: "$$",
    scopeLevel: "Lean",
    masterPromptStarter:
      "Build a promo video from this idea. Keep the message clear, visual, and product-oriented with a strong call to action.",
    recommendedFirstRoom: "home",
    starterAssets: [
      templateAsset("oneSheet", "Promo Video Brief", "# Promo Video Template\n\n## Goal\nCommunicate the offer clearly, quickly, and visually with a final CTA."),
      templateAsset("storyboard", "Promo Scene Ladder Starter", "# Promo Scene Ladder\n\n1. Hook\n2. Problem\n3. Product reveal\n4. Benefit montage\n5. CTA"),
      templateAsset("screeningPacket", "Promo Review Starter", "# Promo Review\n\n- message clarity\n- CTA strength\n- strongest visual frame\n- runtime trim notes"),
    ],
  },
  {
    id: "pitch-packet",
    label: "Pitch Packet",
    shortLabel: "Pitch",
    description: "Start a project already shaped like something you can show, pitch, package, and hand off quickly.",
    projectType: "other",
    visualStyle: "cinematic realism",
    productionType: "Story",
    releaseTarget: "Pitch / Publishing",
    budgetBand: "$",
    scopeLevel: "Lean",
    masterPromptStarter:
      "Turn this concept into a pitch-ready packet with title, hook, summary, visual language, product path, and deliverables.",
    recommendedFirstRoom: "ops",
    starterAssets: [
      templateAsset("oneSheet", "Pitch Packet Brief", "# Pitch Packet Template\n\n## Goal\nBuild a showable, concise product packet fast."),
      templateAsset("productionRunbook", "Pitch Deliverables Starter", "# Deliverables\n\n- title\n- one-line hook\n- concept summary\n- room outputs\n- final packet"),
      templateAsset("screeningPacket", "Pitch Review Starter", "# Review / Readiness\n\n- clear hook\n- visual distinction\n- audience/use case\n- shippable next step"),
    ],
  },
];

export function getStudioTemplates(): StudioTemplate[] {
  return STUDIO_TEMPLATES;
}

export function getStudioTemplateById(id: TemplateId): StudioTemplate | null {
  return STUDIO_TEMPLATES.find((t) => t.id === id) || null;
}

export function applyStudioTemplateToProjectSeed(template: StudioTemplate, existingPrompt = "") {
  const prompt = String(existingPrompt || "").trim();
  return {
    title: template.label,
    masterPrompt: prompt || template.masterPromptStarter,
    projectType: template.projectType,
    visualStyle: template.visualStyle,
    productionType: template.productionType,
    releaseTarget: template.releaseTarget,
    budgetBand: template.budgetBand,
    scopeLevel: template.scopeLevel,
    recommendedFirstRoom: template.recommendedFirstRoom,
    starterAssets: template.starterAssets,
  };
}
