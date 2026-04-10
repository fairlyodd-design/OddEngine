import type { StoryBridgeSnapshot } from "./storyBridge";
import { STORY_ROOM_LABELS } from "./storyBridge";
import type { HomieState } from "../types/homie";

export type CompanionReply = {
  state: HomieState;
  title: string;
  body: string;
  bullets: string[];
  quickReplies: string[];
};

const DEFAULT_QUICK_REPLIES = [
  "Help me with trading",
  "What should I do today?",
  "Check grocery savings",
  "Give me a calm reset"
];

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function storyQuickReplies(context: StoryBridgeSnapshot | null) {
  if (!context) return DEFAULT_QUICK_REPLIES;
  if (context.latestProviderRouteTitle || context.latestExportReady) {
    return [
      "Review provider route",
      context.latestExportReady ? "Review final deliverables" : "Final export deliverables",
      "What should we launch first?",
      "Guide the active room"
    ];
  }
  if (context.latestReleaseBoardTitle) {
    return [
      "Review release board",
      "Prep provider route",
      "Prep release board",
      "Guide the active room"
    ];
  }
  if (context.latestPublishReady) {
    return [
      "Review release packet",
      "Prep publish packet",
      "Prep release board",
      "What should we launch first?"
    ];
  }
  if (context.latestNextPassDecision) {
    return [
      "Review latest output",
      "Prep revision loop",
      context.latestNextPassReady ? "Prep re-render packet" : "What should we build next?",
      "Guide the active room"
    ];
  }
  if (context.latestRenderJobId) {
    return [
      "Guide the active room",
      "Refresh render queue",
      context.latestOutputImported ? "Review latest output" : "Import latest output",
      context.latestOutputWatched ? "What should we build next?" : "Mark watched"
    ];
  }
  return [
    "Guide the active room",
    "What should we build next?",
    "Save this note to project",
    context.projectType === "song" ? "Prep render packet" : context.projectType === "book" ? "Queue render job" : "Prep render packet"
  ];
}

function storyRoomMove(context: StoryBridgeSnapshot) {
  const activeRoomLabel = STORY_ROOM_LABELS[context.activeRoom];
  const nextRoomLabel = STORY_ROOM_LABELS[context.nextRoom];
  const projectType = context.projectType === "video" ? "movie" : context.projectType;
  return {
    activeRoomLabel,
    nextRoomLabel,
    projectType,
    preview: context.roomPreviewTitle || context.resumeFrom || "current room deliverable"
  };
}

function buildStoryReply(input: string, context: StoryBridgeSnapshot): CompanionReply {
  const lower = input.toLowerCase();
  const { activeRoomLabel, nextRoomLabel, projectType, preview } = storyRoomMove(context);
  const cue = context.homieCue?.trim();

  if (/recap|summary|where are we|current project|what are we making/.test(lower)) {
    return {
      state: "talking",
      title: "Story Forge recap",
      body: `We’re locked on ${context.projectTitle}, a ${projectType} project. Right now the live room is ${activeRoomLabel}, the current handoff is ${preview}, and the next clean room is ${nextRoomLabel}.`,
      bullets: [
        `Project promise: ${context.masterPrompt || context.summary || context.projectTitle}`,
        `Current room: ${activeRoomLabel}`,
        `Next room: ${nextRoomLabel}`
      ],
      quickReplies: storyQuickReplies(context)
    };
  }

  if (/provider route|provider lane|book formatting|video provider|audio master|final export|deliverables|export bundle|real provider routing/.test(lower)) {
    return {
      state: context.latestProviderRouteTitle || context.latestExportReady ? "talking" : "alert",
      title: context.latestProviderRouteTitle ? "Provider route ready" : "Provider routing lane",
      body: context.latestProviderRouteTitle
        ? `${context.projectTitle} already has a provider lane staged. ${context.latestFinalExportSummary || `${context.latestProviderLabel || "The active provider"} is lined up for cleaner final exports.`} I’d keep that route as the single export truth so Render Lab, release ops, and final files stay aligned.`
        : `We do not have the provider lane staged yet. Prep the release board first, then route it into the right provider lane so Story Forge can generate cleaner final deliverables instead of stopping at placeholder files.` ,
      bullets: [
        context.latestProviderRouteTitle ? `Provider route: ${context.latestProviderRouteTitle}` : `Provider route: not staged yet.`,
        context.latestProviderLabel ? `Provider: ${context.latestProviderLabel}` : `Provider will match the active project lane.`,
        context.latestFinalDeliverableCount ? `${context.latestFinalDeliverableCount} final deliverable${context.latestFinalDeliverableCount === 1 ? "" : "s"} staged.` : `Final deliverables will appear after the export pass.`,
        context.latestExportReady ? `Final export lane is ready.` : `Run the export pass after the provider route is locked.`
      ],
      quickReplies: storyQuickReplies(context)
    };
  }

  if (/release board|distribution|launch board|teaser assets|metadata blocks|final output files|fully rendered output files|platform checklist|launch tracker/.test(lower)) {
    return {
      state: context.latestReleaseBoardTitle ? "talking" : "alert",
      title: context.latestReleaseBoardTitle ? "Release board ready" : "Release board lane",
      body: context.latestReleaseBoardTitle
        ? `${context.projectTitle} already has a live release board staged. ${context.latestReleaseBoardSummary || "It fans the publish packet into platform checklists, teaser assets, metadata, and final output files."} I’d use that board as the single launch truth so the release story stays clean instead of scattered across random notes.`
        : `The release board is not staged yet. Prep the release board after the publish packet so Story Forge can fan the approved answer into platform checklists, teaser assets, metadata blocks, and tracked final output files.`,
      bullets: [
        context.latestReleaseBoardTitle ? `Release board: ${context.latestReleaseBoardTitle}` : `Release board: not staged yet.`,
        context.latestReleasePlatformCount ? `${context.latestReleasePlatformCount} platform lane${context.latestReleasePlatformCount === 1 ? "" : "s"} staged.` : `Platform-specific checklists will appear with the release board.`,
        context.latestTeaserAssetCount ? `${context.latestTeaserAssetCount} teaser asset${context.latestTeaserAssetCount === 1 ? "" : "s"} ready.` : `Teaser assets are waiting on the release board.`,
        context.latestFinalOutputCount ? `${context.latestFinalOutputCount} final output file${context.latestFinalOutputCount === 1 ? "" : "s"} tracked.` : `Final output files will be staged with the release board.`
      ],
      quickReplies: storyQuickReplies(context)
    };
  }

  if (/publish|release packet|publish packet|screening notes|export targets|launch checklist|final answer/.test(lower)) {
    return {
      state: context.latestPublishReady ? "talking" : "alert",
      title: context.latestPublishReady ? "Release packet ready" : "Release prep lane",
      body: context.latestPublishReady
        ? `${context.projectTitle} already has a release packet staged. ${context.latestPublishSummary || "The approved output is packaged with screening notes, export targets, and a launch checklist."} I’d keep the final answer simple, export the top deliverable first, and only reopen revision if the approved pass truly breaks the promise.`
        : `We do not have the release packet staged yet. Approve the output or prep the publish packet so Story Forge can turn the approved pass into one clean final answer lane before launch.`,
      bullets: [
        context.latestPublishPacketTitle ? `Publish packet: ${context.latestPublishPacketTitle}` : `Publish packet: not staged yet.`,
        context.latestFinalAnswerSummary ? `Final answer: ${context.latestFinalAnswerSummary}` : `Final answer will appear when the publish packet is built.`,
        context.latestExportTargetCount ? `${context.latestExportTargetCount} export target${context.latestExportTargetCount === 1 ? "" : "s"} ready.` : `Export targets will populate with the publish packet.`,
        context.latestLaunchChecklistCount ? `${context.latestLaunchChecklistCount} launch step${context.latestLaunchChecklistCount === 1 ? "" : "s"} staged.` : `Launch checklist is waiting on the publish packet.`
      ],
      quickReplies: storyQuickReplies(context)
    };
  }

  if (/revision loop|rerender packet|re-render packet|next pass|render queue|queue status|import output|review output|latest output|watch output|render review/.test(lower)) {
    return {
      state: context.latestOutputImported ? "talking" : "alert",
      title: context.latestOutputImported ? "Output review lane" : "Render Lab queue",
      body: context.latestOutputImported
        ? context.latestNextPassSummary
          ? `The latest output for ${context.projectTitle} already shaped the next pass: ${context.latestNextPassSummary} I’d walk the checklist, tighten the weak spots, then only queue the next render once that packet reads honest.`
          : `The latest output for ${context.projectTitle} is ${context.latestOutputTitle || "in the project packet"}. I’d review continuity, pacing, emotional landing, and whether it still feels true to the original promise before we kick off another render.`
        : context.latestRenderJobId
          ? `Render Lab is active for ${context.projectTitle}. I’d refresh the queue, import the finished output the second it lands, then start review notes from inside Story Forge so the next pass is grounded.`
          : `We have the render lane staged, but the clean next move is still to queue the job before we pretend there is an output to review.`,
      bullets: [
        context.latestRenderJobId ? `Latest render job: ${context.latestRenderJobId} (${context.latestRenderStatus || "queued"})` : `Render packet is staged but no job is live yet.`,
        context.latestOutputTitle ? `Latest output: ${context.latestOutputTitle}` : `Latest output: not imported yet.`,
        context.latestOutputImported ? (context.latestOutputWatched ? `Review has already started.` : `Import is done. Review pass is still waiting.`) : `Import the finished output back into Story Forge before judging the render.`,
        context.latestNextPassSummary ? `Next pass: ${context.latestNextPassSummary}` : `Next pass packet will appear after approve / revise / re-render.`
      ],
      quickReplies: storyQuickReplies(context)
    };
  }

  if (/next|what should we build|what now|continue|keep going|guide|active room|room/.test(lower)) {
    return {
      state: "alert",
      title: `${activeRoomLabel} game plan`,
      body: `Let’s finish one real deliverable in ${activeRoomLabel} before we chase the whole project at once. I’d tighten ${preview}, make sure it honors the core prompt, then hand one clean packet into ${nextRoomLabel}.`,
      bullets: [
        `Keep the output pointed at the release target: ${context.releaseTarget}.`,
        `Match the room work to the style promise: ${context.visualStyle}.`,
        `When this room feels clear, push the strongest artifact into ${nextRoomLabel}.`
      ],
      quickReplies: storyQuickReplies(context)
    };
  }

  if (/chapter|outline|scene|script|dialogue|character|storyboard|shot|lyric|hook|chorus|verse|render|finale/.test(lower)) {
    return {
      state: "talking",
      title: "Creative lane locked",
      body: `I’d use ${context.projectTitle} as the anchor and solve this inside the current room first. Keep the deliverable simple, emotionally clear, and ready to hand off instead of trying to finish the entire ${projectType} in one breath.`,
      bullets: [
        `Active room truth: ${activeRoomLabel}.`,
        `Primary handoff target: ${nextRoomLabel}.`,
        cue ? `Your latest steering cue: ${cue}` : `Current resume point: ${context.resumeFrom}.`
      ],
      quickReplies: storyQuickReplies(context)
    };
  }

  return {
    state: "talking",
    title: "Story Forge co-pilot",
    body: `I’m synced to ${context.projectTitle}. We can use ${activeRoomLabel} as the live room, keep the promise of the project honest, and walk the work forward into ${nextRoomLabel} one clean packet at a time.`,
    bullets: [
      `Project type: ${projectType}`,
      `Production target: ${context.productionType}`,
      cue ? `Steering cue: ${cue}` : `Resume point: ${context.resumeFrom}`
    ],
    quickReplies: storyQuickReplies(context)
  };
}

export function starterCompanionReply(context?: StoryBridgeSnapshot | null): CompanionReply {
  if (context) {
    const { activeRoomLabel, nextRoomLabel, projectType } = storyRoomMove(context);
    return {
      state: "talking",
      title: "Story Forge synced",
      body: `I’m up and running and I remember your active creative lane: ${context.projectTitle}. We’re in ${activeRoomLabel} right now, ${nextRoomLabel} is next, and I can help talk this ${projectType === "video" ? "movie" : projectType} forward room by room.`,
      bullets: [
        `Current room: ${activeRoomLabel}`,
        `Next room: ${nextRoomLabel}`,
        `Resume point: ${context.resumeFrom}`,
        context.latestRenderJobId ? `Render lane: ${context.latestRenderJobId} (${context.latestRenderStatus || "queued"})` : `Render lane: not queued yet`,
        context.latestNextPassSummary ? `Next pass: ${context.latestNextPassSummary}` : `Next pass: not staged yet`,
        context.latestPublishSummary ? `Release lane: ${context.latestPublishSummary}` : `Release lane: waiting on approved publish packet`,
        context.latestReleaseBoardSummary ? `Release board: ${context.latestReleaseBoardSummary}` : `Release board: not staged yet`
      ],
      quickReplies: storyQuickReplies(context)
    };
  }

  return {
    state: "talking",
    title: "Homie is here",
    body: "I’m up and running. Give me a lane and I’ll help like a real co-pilot — trading, grocery, budget, grow, family stuff, Story Forge, or just a calm reset.",
    bullets: [
      "I can help you pick the next best move.",
      "I can keep things warm, honest, and practical.",
      "I can turn big messy goals into one clean next step."
    ],
    quickReplies: [...DEFAULT_QUICK_REPLIES.slice(0, 3), "Help me with Story Forge"]
  };
}

export function buildCompanionReply(input: string, context?: StoryBridgeSnapshot | null): CompanionReply {
  const text = input.trim();
  const lower = text.toLowerCase();
  const creativeIntent = /story|book|movie|film|script|scene|chapter|cartoon|music video|song|outline|story forge|room|render|director|writing room|studio|project|character|dialogue|lyrics|hook|chorus|verse|shot|storyboard|finale/.test(lower);
  const vagueButContextual = !!context && /what next|next|continue|keep going|guide|recap|current project|what now|help me with this|talk me through/.test(lower);

  if (!text) {
    return context
      ? {
          state: "talking",
          title: "Story Forge ready",
          body: `I’m synced to ${context.projectTitle}. Ask me to guide the active room, recap the project, or set up the next room handoff.`,
          bullets: [
            `Current room: ${STORY_ROOM_LABELS[context.activeRoom]}`,
            `Next room: ${STORY_ROOM_LABELS[context.nextRoom]}`,
            `Resume point: ${context.resumeFrom}`
          ],
          quickReplies: storyQuickReplies(context)
        }
      : {
          state: "idle",
          title: "Say the word",
          body: "Tell me what lane you want help with and I’ll keep it simple.",
          bullets: ["Trading", "Groceries", "Budget", "Grow", "Family planning", "Story Forge"],
          quickReplies: [...DEFAULT_QUICK_REPLIES.slice(0, 3), "Help me with Story Forge"]
        };
  }

  if (context && (creativeIntent || vagueButContextual)) {
    return buildStoryReply(text, context);
  }

  if (/trade|option|scanner|contract|public|spy|qqq|call|put|chain|sniper/.test(lower)) {
    const lane = /put/.test(lower) ? "puts" : /call/.test(lower) ? "calls" : "the best setup";
    return {
      state: "alert",
      title: "Trading lane armed",
      body: `I’d keep the panel focused on ${lane}, tight spreads, real fill quality, and a clean risk-to-reward. Cheap is only good when the contract can actually move and actually fill.`,
      bullets: [
        "Check trend + catalyst before touching the contract chain.",
        "Favor contracts with life: tighter spread, real OI, real volume.",
        "Treat sub-$0.10 names like scouts, not auto-buys."
      ],
      quickReplies: ["Find the cleanest contract", "What should I avoid?", "Show me the next risk check", "Give me a sniper checklist"]
    };
  }

  if (/grocery|coupon|smith|kroger|walmart|amazon|albertson|food|meal|cart/.test(lower)) {
    return {
      state: "talking",
      title: "Coupon champion mode",
      body: "I’d run this in three steps: cheapest lane, coupon lane, and one-store lane. Then we only act on the stuff that saves real money, not fake deal noise.",
      bullets: [
        `Clip-first stores can beat shelf price by ${money(2.50)} or more on a medium basket.`,
        "Let the best basket board decide whether split-trip savings are worth the extra stop.",
        "Push only the winners into the cart queue."
      ],
      quickReplies: ["Price my custom trip", "Best store right now", "What should I clip first?", "Build a family stock-up run"]
    };
  }

  if (/budget|bill|debt|money|rent|cash|family budget|saving/.test(lower)) {
    return {
      state: "listening",
      title: "Household coach mode",
      body: "Let’s protect free cash first, then tighten groceries, then hit the debt or bill that gives the biggest pressure relief.",
      bullets: [
        "Keep the month steady before chasing fancy optimization.",
        "One leak fixed cleanly beats ten little guilt notes.",
        "Use the pressure board to pick the one move that buys the most breathing room."
      ],
      quickReplies: ["Show me the pressure move", "Tighten groceries", "Debt vs bill first?", "Give me a calm money plan"]
    };
  }

  if (/grow|cannabis|weed|dispensary|flower|cart|edible|terp/.test(lower)) {
    return {
      state: "talking",
      title: "Grow + deals lane",
      body: "I’d split this into two questions: what saves money today, and what improves the grow or stash quality the most. Those are not always the same move.",
      bullets: [
        "Track price per gram or per mg, not just sticker price.",
        "Use the deal runner board to avoid wasting a trip on weak promos.",
        "For grow, today’s move should stay obvious and stage-based."
      ],
      quickReplies: ["Best dispensary run", "What should I buy?", "Today’s grow move", "Compare promo stacks"]
    };
  }

  if (/health|mom|mother|family|wife|burnout|stress|tired|reset/.test(lower)) {
    return {
      state: "talking",
      title: "Homie reset",
      body: "Let’s not try to solve life all at once. We pick one kind move, one useful move, and one money-smart move. That’s enough to get momentum back.",
      bullets: [
        "Kind move: something that lowers stress for you or the house.",
        "Useful move: one task that clears friction today.",
        "Money-smart move: one action that protects cash or creates upside."
      ],
      quickReplies: ["Give me one calm next step", "Help me help Mom", "Set a simple routine", "What matters most today?"]
    };
  }

  return {
    state: "talking",
    title: context ? "Homie co-pilot mode" : "Homie co-pilot mode",
    body: "I hear you. Here’s the clean move: keep it simple, pick the highest-value next step, and let me help you carry the thinking load instead of trying to brute-force the whole day at once.",
    bullets: [
      "Tell me the lane you want to improve.",
      "Tell me whether you want quick help or a deeper plan.",
      context ? `I still remember the active Story Forge lane: ${context.projectTitle}.` : "Tell me whether you want honest reality, encouragement, or both."
    ],
    quickReplies: context ? storyQuickReplies(context) : [...DEFAULT_QUICK_REPLIES.slice(0, 3), "Help me with Story Forge"]
  };
}

export function getStoryQuickReplies(context?: StoryBridgeSnapshot | null) {
  return storyQuickReplies(context ?? null);
}
