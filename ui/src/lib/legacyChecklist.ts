
import type { GenFile } from "./files";

export const LEGACY_STATUS_OPTIONS = [
  "Not Started",
  "In Progress",
  "Locked",
  "Needs Repair",
  "Complete",
] as const;

export type LegacyStatus = typeof LEGACY_STATUS_OPTIONS[number];

export type LegacyPhase = {
  id: string;
  order: number;
  title: string;
  passName: string;
  goal: string;
};

export type LegacyPanel = {
  id: string;
  title: string;
  section: string;
  phaseId: string;
  familyPurpose: string;
  goodEnough: string;
  complete: string;
  dependencies: string[];
  safeToFail: boolean;
  critical: boolean;
  priority: 1 | 2 | 3 | 4 | 5;
  acceptanceCriteria: string[];
};

export const LEGACY_STORAGE_KEYS = {
  statuses: "oddengine:legacyHQ:statuses:v1",
  notes: "oddengine:legacyHQ:notes:v1",
};

export const LEGACY_PHASES: LegacyPhase[] = [
  {
    id: "phase-0",
    order: 0,
    title: "System survival",
    passName: "vLegacy.0_SystemSurvivalAndRecoveryPass",
    goal: "The family can launch the OS, recover it, and trust it.",
  },
  {
    id: "phase-1",
    order: 1,
    title: "Family front door",
    passName: "vLegacy.1_FrontDoorHomeAndHomieGuidePass",
    goal: "Anyone in the family can open the OS and know what to do next.",
  },
  {
    id: "phase-2",
    order: 2,
    title: "Homie legacy core",
    passName: "vLegacy.2_HomieMemoryVoiceAndLegacyCorePass",
    goal: "Homie preserves your voice, guidance style, and family-specific context.",
  },
  {
    id: "phase-3",
    order: 3,
    title: "Legacy creation",
    passName: "vLegacy.3_WritersLoungeLegacyCreationPass",
    goal: "The OS can turn memories, guidance, and stories into artifacts that last.",
  },
  {
    id: "phase-4",
    order: 4,
    title: "Daily family ops",
    passName: "vLegacy.4_FamilyDailyOpsPass",
    goal: "The OS helps the family live day to day with less stress and less guessing.",
  },
  {
    id: "phase-5",
    order: 5,
    title: "Money and opportunity",
    passName: "vLegacy.5_IncomeKnowledgeAndOpportunityPass",
    goal: "The OS preserves earning judgment and ranks the best next dollar move.",
  },
  {
    id: "phase-6",
    order: 6,
    title: "Maintainability",
    passName: "vLegacy.6_MaintainabilityAndBuilderPass",
    goal: "A future helper can understand, repair, back up, and evolve the OS.",
  },
  {
    id: "phase-7",
    order: 7,
    title: "Presence and polish",
    passName: "vLegacy.7_PresenceAndCreativePolishPass",
    goal: "The OS feels deeply alive without sacrificing honesty or stability.",
  },
];

export const LEGACY_PANELS: LegacyPanel[] = [
  {
    id: "core-shell",
    title: "Core shell",
    section: "Foundation",
    phaseId: "phase-0",
    familyPurpose: "The shell is the part the family has to trust every single time they open OddEngine.",
    goodEnough: "One-click boot, stable shell chrome, and no dead blank screen state.",
    complete: "Boots cleanly, restores last-good session, supports safe mode, and survives bad local state.",
    dependencies: [],
    safeToFail: false,
    critical: true,
    priority: 1,
    acceptanceCriteria: [
      "App launches from a single known entry point.",
      "Shell renders even when one panel crashes.",
      "A last-good state can be restored after a bad run.",
      "No blank screen without a recovery path.",
    ],
  },
  {
    id: "panel-registry",
    title: "Panel registry",
    section: "Foundation",
    phaseId: "phase-0",
    familyPurpose: "Guarantees every important workspace still exists and can be reached.",
    goodEnough: "All intended panels are registered once and mount reliably.",
    complete: "Registry, sidebar, router, and any panel metadata stay in sync automatically.",
    dependencies: ["core-shell"],
    safeToFail: false,
    critical: true,
    priority: 1,
    acceptanceCriteria: [
      "No missing or duplicate panel ids.",
      "Sidebar labels and routed panels match registry entries.",
      "A broken panel never silently disappears from navigation.",
    ],
  },
  {
    id: "router-navigation",
    title: "Router and navigation",
    section: "Foundation",
    phaseId: "phase-0",
    familyPurpose: "Lets the family move through the OS without getting lost.",
    goodEnough: "All nav routes work and panel switching is stable.",
    complete: "Route restore, deep-linking, and recovery all work across desktop and web modes.",
    dependencies: ["core-shell", "panel-registry"],
    safeToFail: false,
    critical: true,
    priority: 1,
    acceptanceCriteria: [
      "Every panel route opens the correct screen.",
      "Back and forward behavior never drops the user into a dead state.",
      "Last active panel can be restored safely.",
    ],
  },
  {
    id: "layout-memory",
    title: "Layout memory",
    section: "Foundation",
    phaseId: "phase-0",
    familyPurpose: "Keeps the workspace familiar instead of making the family start over every time.",
    goodEnough: "Panel positions and key shell state persist.",
    complete: "Last-good layout, layout presets, and per-monitor restore all work.",
    dependencies: ["core-shell"],
    safeToFail: false,
    critical: true,
    priority: 1,
    acceptanceCriteria: [
      "Closing and reopening does not wipe the workspace unexpectedly.",
      "A saved layout can be restored without manual rebuilding.",
      "Corrupt layout state can be bypassed or rolled back.",
    ],
  },
  {
    id: "startup-recovery",
    title: "Startup and recovery scripts",
    section: "Foundation",
    phaseId: "phase-0",
    familyPurpose: "Makes launching, repairing, and relaunching simple enough for the family or a helper.",
    goodEnough: "Known scripts start the right services in the right order.",
    complete: "Health checks, retries, fallback mode, and recovery notes are built in.",
    dependencies: ["core-shell", "router-navigation"],
    safeToFail: false,
    critical: true,
    priority: 1,
    acceptanceCriteria: [
      "The main start script works without extra manual steps.",
      "A failed service reports clearly instead of hanging silently.",
      "There is a documented repair path when startup fails.",
    ],
  },
  {
    id: "settings-state",
    title: "Settings and state storage",
    section: "Foundation",
    phaseId: "phase-0",
    familyPurpose: "Preserves preferences and important operating data.",
    goodEnough: "Core settings save and load reliably.",
    complete: "State is versioned, migration-safe, exportable, and resilient to partial corruption.",
    dependencies: ["core-shell"],
    safeToFail: false,
    critical: true,
    priority: 1,
    acceptanceCriteria: [
      "Critical settings are not lost on restart.",
      "Storage schema changes do not brick old saved data.",
      "Backup and restore can move core settings across machines.",
    ],
  },
  {
    id: "home",
    title: "Home",
    section: "Front Door",
    phaseId: "phase-1",
    familyPurpose: "Home is the family dashboard, anchor, and first decision point.",
    goodEnough: "Shows what matters now and launches major panels quickly.",
    complete: "It becomes the true front door with routines, alerts, family status, and next-step guidance.",
    dependencies: ["core-shell", "router-navigation"],
    safeToFail: false,
    critical: true,
    priority: 1,
    acceptanceCriteria: [
      "A first-time user understands what to click next.",
      "Major panels are reachable from Home in one hop.",
      "Important daily items are visible without hunting.",
    ],
  },
  {
    id: "mission-control",
    title: "Mission Control",
    section: "Front Door",
    phaseId: "phase-1",
    familyPurpose: "Turns scattered information into a calm now, next, blocked view.",
    goodEnough: "Shows top priorities and a simple action queue.",
    complete: "Unifies cross-panel status, family ops, money pressure, and creative queues.",
    dependencies: ["home", "settings-state"],
    safeToFail: true,
    critical: false,
    priority: 2,
    acceptanceCriteria: [
      "Top priorities are visible in plain language.",
      "The queue updates from real panel state instead of placeholders.",
      "The user can jump directly from priority cards into the right panel.",
    ],
  },
  {
    id: "global-command-bar",
    title: "Global command bar",
    section: "Front Door",
    phaseId: "phase-1",
    familyPurpose: "Lets the family or a helper get somewhere fast without knowing the whole UI.",
    goodEnough: "Can search panels and open the right place quickly.",
    complete: "Supports plain-language actions, recent commands, and panel-aware shortcuts.",
    dependencies: ["router-navigation", "panel-registry"],
    safeToFail: true,
    critical: false,
    priority: 3,
    acceptanceCriteria: [
      "Panel search is fast and forgiving.",
      "The command bar can open any important panel.",
      "Results are understandable even for non-technical users.",
    ],
  },
  {
    id: "notifications-reminders",
    title: "Notifications and reminders",
    section: "Front Door",
    phaseId: "phase-1",
    familyPurpose: "Protects the family from missing important tasks or alerts.",
    goodEnough: "Critical alerts and reminders are visible and dismissible.",
    complete: "Supports urgency tiers, snooze, and family-safe reminder flows.",
    dependencies: ["home", "settings-state"],
    safeToFail: true,
    critical: false,
    priority: 3,
    acceptanceCriteria: [
      "Important reminders actually surface in the shell.",
      "Dismissed items do not come back incorrectly.",
      "The user can tell urgent from informational notices.",
    ],
  },
  {
    id: "homie",
    title: "Homie",
    section: "Legacy Core",
    phaseId: "phase-2",
    familyPurpose: "Homie is the family guide, explainer, and the emotional center of the OS.",
    goodEnough: "Typed Homie works reliably and explains the system in plain language.",
    complete: "Carries your style, remembers family context, routes into panels, and supports voice safely.",
    dependencies: ["home", "settings-state"],
    safeToFail: false,
    critical: true,
    priority: 1,
    acceptanceCriteria: [
      "Typed conversation is reliable and grounded.",
      "Homie can explain each panel in plain language.",
      "Homie keeps useful context across sessions without becoming unsafe or misleading.",
      "Voice is optional and never blocks typed usage.",
    ],
  },
  {
    id: "oddbrain",
    title: "OddBrain",
    section: "Legacy Core",
    phaseId: "phase-2",
    familyPurpose: "Acts as the system intelligence layer behind guidance and prioritization.",
    goodEnough: "Can summarize panel readiness and surface cross-panel priorities.",
    complete: "Provides a trustworthy system-wide truth layer for Home, Homie, and Mission Control.",
    dependencies: ["home", "homie", "settings-state"],
    safeToFail: true,
    critical: false,
    priority: 2,
    acceptanceCriteria: [
      "Cross-panel summaries are based on real local state.",
      "Important risks show up in a stable way.",
      "Guidance is useful even when some panels have no data yet.",
    ],
  },
  {
    id: "writers-lounge",
    title: "Writers Lounge",
    section: "Legacy Creation",
    phaseId: "phase-3",
    familyPurpose: "Turns your knowledge, letters, and stories into artifacts the family can keep.",
    goodEnough: "Text drafting, saving, and exporting work every time.",
    complete: "Supports legacy messages, family explainers, story flows, voice notes, and packaged outputs.",
    dependencies: ["core-shell", "settings-state"],
    safeToFail: false,
    critical: true,
    priority: 1,
    acceptanceCriteria: [
      "A user can create, save, reopen, and export written work.",
      "The panel does not lose drafts during normal use.",
      "There is a simple path from idea to finished artifact.",
    ],
  },
  {
    id: "studio-home",
    title: "Studio Home",
    section: "Legacy Creation",
    phaseId: "phase-3",
    familyPurpose: "Gives the family a clear front door into all creative work.",
    goodEnough: "Shows projects, tabs, and where to continue.",
    complete: "Tracks queues, output status, and routes cleanly into writing, music, render, and producer lanes.",
    dependencies: ["writers-lounge"],
    safeToFail: true,
    critical: false,
    priority: 3,
    acceptanceCriteria: [
      "Creative tabs are understandable.",
      "Project status is visible without opening every subpanel.",
      "It acts as a stable entry point instead of a dead wrapper.",
    ],
  },
  {
    id: "writing-room",
    title: "Writing Room",
    section: "Legacy Creation",
    phaseId: "phase-3",
    familyPurpose: "Focused place for letters, guides, chapter work, and story drafting.",
    goodEnough: "Drafting and revision tools feel stable and save correctly.",
    complete: "Supports templates, chapter flows, legacy formats, and clean export history.",
    dependencies: ["writers-lounge"],
    safeToFail: false,
    critical: true,
    priority: 2,
    acceptanceCriteria: [
      "Edits persist.",
      "The user can work through a full piece without UI instability.",
      "Exported output matches what was written.",
    ],
  },
  {
    id: "director-room",
    title: "Director Room",
    section: "Legacy Creation",
    phaseId: "phase-3",
    familyPurpose: "Turns raw ideas into scenes, sequences, and production plans.",
    goodEnough: "Can organize scenes and production steps clearly.",
    complete: "Supports scene cards, sequencing, render handoff, and practical planning notes.",
    dependencies: ["studio-home", "writing-room"],
    safeToFail: true,
    critical: false,
    priority: 4,
    acceptanceCriteria: [
      "Scene planning is understandable.",
      "The handoff into later production steps is clear.",
      "The UI does not collapse under larger projects.",
    ],
  },
  {
    id: "music-lab",
    title: "Music Lab",
    section: "Legacy Creation",
    phaseId: "phase-3",
    familyPurpose: "Lets the family create songs, audio memories, and emotional pieces.",
    goodEnough: "Can generate and return a real preview audio file.",
    complete: "Supports section-aware composition, stems, and reusable release packs.",
    dependencies: ["studio-home"],
    safeToFail: true,
    critical: false,
    priority: 4,
    acceptanceCriteria: [
      "At least one real audio artifact is produced.",
      "The user can find and download the output.",
      "Errors explain what failed in the pipeline.",
    ],
  },
  {
    id: "render-lab",
    title: "Render Lab",
    section: "Legacy Creation",
    phaseId: "phase-3",
    familyPurpose: "Handles image and video generation jobs honestly and visibly.",
    goodEnough: "Can queue a render and return the result or a clear failure.",
    complete: "Supports retries, queue health, previews, and stable artifact import.",
    dependencies: ["studio-home", "settings-state"],
    safeToFail: true,
    critical: false,
    priority: 4,
    acceptanceCriteria: [
      "Queued jobs show status updates.",
      "Completed outputs can be reopened inside the OS.",
      "Failure states are visible and actionable.",
    ],
  },
  {
    id: "producer-ops",
    title: "Producer Ops",
    section: "Legacy Creation",
    phaseId: "phase-3",
    familyPurpose: "Packages and organizes finished work into usable deliverables.",
    goodEnough: "Builds a final pack that can be downloaded and archived.",
    complete: "Catalogs created work, handles release metadata, and supports monetization handoff.",
    dependencies: ["writers-lounge", "music-lab", "render-lab"],
    safeToFail: true,
    critical: false,
    priority: 4,
    acceptanceCriteria: [
      "Final packs contain the expected files.",
      "Release metadata is easy to review.",
      "The user can locate finished outputs later.",
    ],
  },
  {
    id: "money",
    title: "Money",
    section: "Daily Ops",
    phaseId: "phase-4",
    familyPurpose: "Gives the household financial clarity instead of panic and guesswork.",
    goodEnough: "Shows bills, priorities, and what to pay next.",
    complete: "Provides a reliable money operating picture and ties into opportunity decisions.",
    dependencies: ["home", "settings-state"],
    safeToFail: false,
    critical: true,
    priority: 1,
    acceptanceCriteria: [
      "Important money priorities are visible quickly.",
      "The user can understand the next best money action.",
      "State persists across sessions.",
    ],
  },
  {
    id: "family-budget",
    title: "Family Budget",
    section: "Daily Ops",
    phaseId: "phase-4",
    familyPurpose: "Turns household cashflow into a structured operating system.",
    goodEnough: "Tracks categories, balances, imports, and payoff views.",
    complete: "Supports scenario planning, debt payoff, goal funding, and long-term clarity.",
    dependencies: ["money", "settings-state"],
    safeToFail: false,
    critical: true,
    priority: 1,
    acceptanceCriteria: [
      "Budget data can be entered or imported reliably.",
      "Tabs and reports are stable.",
      "The payoff planner reflects the real saved budget state.",
    ],
  },
  {
    id: "grocery-meals",
    title: "Grocery Meals",
    section: "Daily Ops",
    phaseId: "phase-4",
    familyPurpose: "Reduces stress, feeds the family, and saves money at the same time.",
    goodEnough: "Builds meal plans and shopping lists.",
    complete: "Supports pantry-aware lists, substitutions, best-basket logic, and coupon-aware decisions.",
    dependencies: ["home", "settings-state"],
    safeToFail: true,
    critical: false,
    priority: 2,
    acceptanceCriteria: [
      "A weekly grocery list can actually be generated.",
      "Meal planning is simpler than using separate apps and notes.",
      "Savings data is tied to what the family actually needs to buy.",
    ],
  },
  {
    id: "news",
    title: "News",
    section: "Daily Ops",
    phaseId: "phase-4",
    familyPurpose: "Keeps the household oriented around weather, local events, and practical news.",
    goodEnough: "Shows weather and an understandable headline set.",
    complete: "Provides local relevance, family-safe summaries, and useful routing into other panels.",
    dependencies: ["home"],
    safeToFail: true,
    critical: false,
    priority: 3,
    acceptanceCriteria: [
      "Weather data and headlines refresh cleanly.",
      "The user can tell what matters for the family and what does not.",
      "News routes into Brain or other panels when useful.",
    ],
  },
  {
    id: "family-health",
    title: "Family Health",
    section: "Daily Ops",
    phaseId: "phase-4",
    familyPurpose: "Organizes care notes, appointment prep, and health explainers in one place.",
    goodEnough: "Stores structured notes and supports care briefs.",
    complete: "Supports member tabs, research flows, logs, and durable care organization.",
    dependencies: ["home", "settings-state"],
    safeToFail: true,
    critical: false,
    priority: 2,
    acceptanceCriteria: [
      "Family member tabs can be created and revisited.",
      "Care notes and briefs save correctly.",
      "Safety framing is clear and grounded.",
    ],
  },
  {
    id: "cameras",
    title: "Cameras",
    section: "Daily Ops",
    phaseId: "phase-4",
    familyPurpose: "Provides safety, reassurance, and quick household visibility.",
    goodEnough: "Offers a simple live-view path or reliable external handoff.",
    complete: "Supports quick check, recording access, presets, and a family-friendly viewer.",
    dependencies: ["home"],
    safeToFail: true,
    critical: false,
    priority: 3,
    acceptanceCriteria: [
      "A user can quickly see the camera wall or correct viewer.",
      "Camera state is understandable.",
      "The panel fails honestly when a stream is unavailable.",
    ],
  },
  {
    id: "grow",
    title: "Grow",
    section: "Daily Ops",
    phaseId: "phase-4",
    familyPurpose: "Preserves your grow methods, room care logic, and self-reliance workflows.",
    goodEnough: "Tracks room profile, readings, and schedules.",
    complete: "Supports live sensors, alerts, planner handoff, and method preservation.",
    dependencies: ["settings-state"],
    safeToFail: true,
    critical: false,
    priority: 3,
    acceptanceCriteria: [
      "A room profile can be created and revisited.",
      "Readings and plan data persist.",
      "The panel explains what matters now in the room.",
    ],
  },
  {
    id: "family-entertainment",
    title: "Family Entertainment",
    section: "Daily Ops",
    phaseId: "phase-4",
    familyPurpose: "Protects joy and togetherness, not just logistics.",
    goodEnough: "Launches family media simply.",
    complete: "Curates favorites, smooth playback paths, and family-night flows.",
    dependencies: ["home"],
    safeToFail: true,
    critical: false,
    priority: 5,
    acceptanceCriteria: [
      "Streaming links or launch actions work.",
      "The family can start something fun quickly.",
      "The panel is simpler than hunting through separate bookmarks.",
    ],
  },
  {
    id: "trading",
    title: "Trading",
    section: "Opportunity",
    phaseId: "phase-5",
    familyPurpose: "Preserves your market process and risk thinking, even if nobody trades exactly like you.",
    goodEnough: "Stable chart, chain, and watchlist flow with visible risk context.",
    complete: "Supports real signal organization, journaling, paper logic, and honest market guidance.",
    dependencies: ["home", "oddbrain", "settings-state"],
    safeToFail: true,
    critical: false,
    priority: 2,
    acceptanceCriteria: [
      "Loading chain data does not destabilize the panel.",
      "Watchlists and setup notes remain visible and stable.",
      "Risk and invalidation are easy to read.",
    ],
  },
  {
    id: "options-sniper",
    title: "Options Sniper",
    section: "Opportunity",
    phaseId: "phase-5",
    familyPurpose: "Preserves your chain-reading workflow and small-account guardrails.",
    goodEnough: "Shows expirations, contracts, and the logic behind the trade idea.",
    complete: "Supports contract comparison, quote history, and anti-blowup guidance.",
    dependencies: ["trading"],
    safeToFail: true,
    critical: false,
    priority: 3,
    acceptanceCriteria: [
      "ATM-centered contract browsing works.",
      "Expiration logic is understandable.",
      "The panel helps avoid bad small-account decisions instead of encouraging them.",
    ],
  },
  {
    id: "phoenix-intel",
    title: "Phoenix and market intelligence",
    section: "Opportunity",
    phaseId: "phase-5",
    familyPurpose: "Preserves your advanced read on regimes, sessions, and cleaner setups.",
    goodEnough: "Shows signal context and bias in a readable way.",
    complete: "Supports futures/session intelligence, risk compression warnings, and replayable context.",
    dependencies: ["trading", "options-sniper"],
    safeToFail: true,
    critical: false,
    priority: 5,
    acceptanceCriteria: [
      "Signal cards do not flicker or mislead.",
      "Bias and invalidation are visible.",
      "The intelligence layer explains why a setup is good, bad, or no-trade.",
    ],
  },
  {
    id: "crypto-games",
    title: "Crypto Games and ZBD",
    section: "Opportunity",
    phaseId: "phase-5",
    familyPurpose: "Keeps low-stakes side-income lanes organized and honest.",
    goodEnough: "Tracks games, payouts, and what is worth time.",
    complete: "Supports ranking, journals, emulator/device paths, and real ROI history.",
    dependencies: ["money"],
    safeToFail: true,
    critical: false,
    priority: 5,
    acceptanceCriteria: [
      "Tracked games can be reviewed later.",
      "Reward and effort are visible together.",
      "Low-value lanes can be filtered out quickly.",
    ],
  },
  {
    id: "autopilot",
    title: "Autopilot",
    section: "Opportunity",
    phaseId: "phase-5",
    familyPurpose: "Ranks the best next move across savings and earning lanes.",
    goodEnough: "Shows a useful next-action ranking.",
    complete: "Scores next moves by money, risk, time, energy, and urgency across the whole OS.",
    dependencies: ["money", "family-budget", "grocery-meals", "trading", "writers-lounge"],
    safeToFail: true,
    critical: false,
    priority: 3,
    acceptanceCriteria: [
      "The ranking is understandable.",
      "Actions are grounded in real panel state.",
      "It helps the family choose what to do next instead of adding confusion.",
    ],
  },
  {
    id: "builder",
    title: "Builder",
    section: "Maintainability",
    phaseId: "phase-6",
    familyPurpose: "Lets future helpers inspect how the OS is structured and what still needs work.",
    goodEnough: "Shows a maintainable checklist and exportable build board.",
    complete: "Provides state inspection, diagnostics, structure notes, and repair guidance.",
    dependencies: ["core-shell", "panel-registry"],
    safeToFail: false,
    critical: true,
    priority: 2,
    acceptanceCriteria: [
      "A helper can understand the roadmap without guessing.",
      "Checklist state can be exported.",
      "The panel helps audit progress instead of being a dead placeholder.",
    ],
  },
  {
    id: "dev-engine",
    title: "Dev Engine",
    section: "Maintainability",
    phaseId: "phase-6",
    familyPurpose: "Preserves the ability to repair and extend the OS later.",
    goodEnough: "Tracks projects, logs, and build context.",
    complete: "Supports safer repair flows, project docs, and repeatable ship tooling.",
    dependencies: ["builder", "settings-state"],
    safeToFail: true,
    critical: false,
    priority: 3,
    acceptanceCriteria: [
      "A target project can be set clearly.",
      "Logs and build notes have a home.",
      "It reduces repair guesswork.",
    ],
  },
  {
    id: "plugins",
    title: "Plugins",
    section: "Maintainability",
    phaseId: "phase-6",
    familyPurpose: "Keeps optional integrations understandable and safe instead of mysterious.",
    goodEnough: "Shows installed plugins and whether they are healthy.",
    complete: "Supports clean on-off behavior, trust visibility, and integration notes.",
    dependencies: ["builder", "settings-state"],
    safeToFail: true,
    critical: false,
    priority: 4,
    acceptanceCriteria: [
      "Plugins are listed clearly.",
      "Broken manifests do not crash the shell.",
      "Optional integrations can be disabled without side effects.",
    ],
  },
  {
    id: "homie-presence",
    title: "Homie presence and avatar layer",
    section: "Presence",
    phaseId: "phase-7",
    familyPurpose: "Makes Homie feel more alive and emotionally warm for the family.",
    goodEnough: "Presence layer works without breaking the core conversation loop.",
    complete: "Supports expressive presence, reliable voice handoff, and emotionally resonant polish.",
    dependencies: ["homie"],
    safeToFail: true,
    critical: false,
    priority: 5,
    acceptanceCriteria: [
      "Presence never blocks typed help.",
      "The avatar state reflects conversation state reliably.",
      "Polish improves warmth without making false claims or fake behavior.",
    ],
  },
  {
    id: "advanced-creative-polish",
    title: "Advanced creative polish",
    section: "Presence",
    phaseId: "phase-7",
    familyPurpose: "Brings cinematic, expressive quality to stories, videos, and music after the core is reliable.",
    goodEnough: "Polish layers can be toggled on without destabilizing creation flows.",
    complete: "Supports stronger visuals, better music realism, and a richer emotional layer across Studio.",
    dependencies: ["writers-lounge", "music-lab", "render-lab", "producer-ops"],
    safeToFail: true,
    critical: false,
    priority: 5,
    acceptanceCriteria: [
      "Polish is additive instead of replacing core reliability.",
      "Creative outputs remain exportable.",
      "The user can tell what is placeholder versus truly generated.",
    ],
  },
];

export const LEGACY_SEED_STATUSES: Record<string, LegacyStatus> = {
  "core-shell": "In Progress",
  "panel-registry": "In Progress",
  "router-navigation": "In Progress",
  "layout-memory": "In Progress",
  "startup-recovery": "In Progress",
  "settings-state": "In Progress",
  "home": "In Progress",
  "mission-control": "In Progress",
  "global-command-bar": "In Progress",
  "notifications-reminders": "Not Started",
  "homie": "In Progress",
  "oddbrain": "In Progress",
  "writers-lounge": "Needs Repair",
  "studio-home": "Not Started",
  "writing-room": "Needs Repair",
  "director-room": "Not Started",
  "music-lab": "Needs Repair",
  "render-lab": "Needs Repair",
  "producer-ops": "Not Started",
  "money": "In Progress",
  "family-budget": "In Progress",
  "grocery-meals": "In Progress",
  "news": "In Progress",
  "family-health": "In Progress",
  "cameras": "In Progress",
  "grow": "In Progress",
  "family-entertainment": "In Progress",
  "trading": "Needs Repair",
  "options-sniper": "In Progress",
  "phoenix-intel": "Not Started",
  "crypto-games": "In Progress",
  "autopilot": "In Progress",
  "builder": "In Progress",
  "dev-engine": "In Progress",
  "plugins": "In Progress",
  "homie-presence": "Needs Repair",
  "advanced-creative-polish": "Not Started",
};

export const LEGACY_SEED_NOTES: Record<string, string> = {
  "core-shell": "Seed status only. Lock this after a real boot, restore, and recovery audit.",
  "writers-lounge": "Seeded as Needs Repair because legacy creation cannot be trusted until text save/export and artifact return stay stable.",
  "trading": "Seeded as Needs Repair because the chain-heavy lane has been a repeated stability hotspot in the project flow.",
  "homie": "Typed-first reliability stays non-negotiable. Voice can lag behind the typed lane.",
  "builder": "This panel should stay the maintenance nerve center, not a forgotten placeholder.",
};

export function getPhaseById(id: string) {
  return LEGACY_PHASES.find((phase) => phase.id === id) || LEGACY_PHASES[0];
}

export function getPanelById(id: string) {
  return LEGACY_PANELS.find((panel) => panel.id === id) || LEGACY_PANELS[0];
}

export function getLegacyRows(statuses: Record<string, LegacyStatus>, notes: Record<string, string>) {
  return LEGACY_PANELS.map((panel) => ({
    ...panel,
    phase: getPhaseById(panel.phaseId),
    status: statuses[panel.id] || LEGACY_SEED_STATUSES[panel.id] || "Not Started",
    note: notes[panel.id] || LEGACY_SEED_NOTES[panel.id] || "",
  }));
}

export function buildLegacyMarkdown(statuses: Record<string, LegacyStatus>, notes: Record<string, string>) {
  const rows = getLegacyRows(statuses, notes);
  const lines: string[] = [
    "# OddEngine Legacy HQ",
    "",
    "_This tracker is seeded from the family-legacy roadmap. Seed statuses are starting assumptions and should be confirmed with a real panel audit._",
    "",
    "## Phase roadmap",
    "",
  ];

  LEGACY_PHASES.forEach((phase) => {
    const phaseRows = rows.filter((row) => row.phaseId === phase.id);
    lines.push(`### ${phase.order}. ${phase.title}`);
    lines.push(`- Pass: ${phase.passName}`);
    lines.push(`- Goal: ${phase.goal}`);
    lines.push(`- Panels: ${phaseRows.length}`);
    lines.push("");
  });

  lines.push("## Panel board", "");

  rows.forEach((row) => {
    lines.push(`### ${row.title}`);
    lines.push(`- Status: ${row.status}`);
    lines.push(`- Phase: ${row.phase.order}. ${row.phase.title}`);
    lines.push(`- Section: ${row.section}`);
    lines.push(`- Priority: ${row.priority}`);
    lines.push(`- Critical: ${row.critical ? "Yes" : "No"}`);
    lines.push(`- Safe to fail: ${row.safeToFail ? "Yes" : "No"}`);
    lines.push(`- Purpose: ${row.familyPurpose}`);
    lines.push(`- Good enough: ${row.goodEnough}`);
    lines.push(`- Complete: ${row.complete}`);
    lines.push(`- Dependencies: ${row.dependencies.length ? row.dependencies.join(", ") : "None"}`);
    lines.push(`- Note: ${row.note || "—"}`);
    lines.push("- Acceptance criteria:");
    row.acceptanceCriteria.forEach((item) => lines.push(`  - ${item}`));
    lines.push("");
  });

  return lines.join("\n").trim() + "\n";
}

export function buildLegacyStatusBoard(statuses: Record<string, LegacyStatus>, notes: Record<string, string>) {
  return {
    generatedAt: new Date().toISOString(),
    phases: LEGACY_PHASES,
    panels: getLegacyRows(statuses, notes),
  };
}

export function buildLegacyCsv(statuses: Record<string, LegacyStatus>, notes: Record<string, string>) {
  const rows = getLegacyRows(statuses, notes);
  const header = [
    "id",
    "title",
    "phase",
    "status",
    "section",
    "priority",
    "critical",
    "safeToFail",
    "dependencies",
    "familyPurpose",
    "goodEnough",
    "complete",
    "note",
  ];
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [header.join(",")];
  rows.forEach((row) => {
    lines.push([
      row.id,
      row.title,
      `${row.phase.order}. ${row.phase.title}`,
      row.status,
      row.section,
      row.priority,
      row.critical ? "yes" : "no",
      row.safeToFail ? "yes" : "no",
      row.dependencies.join(" | "),
      row.familyPurpose,
      row.goodEnough,
      row.complete,
      row.note,
    ].map(escape).join(","));
  });
  return lines.join("\n");
}

export function buildLegacyExportFiles(statuses: Record<string, LegacyStatus>, notes: Record<string, string>): GenFile[] {
  const markdown = buildLegacyMarkdown(statuses, notes);
  const board = buildLegacyStatusBoard(statuses, notes);
  const csv = buildLegacyCsv(statuses, notes);
  return [
    {
      path: "docs/legacy/ODDENGINE_LEGACY_MASTER_CHECKLIST.md",
      content: markdown,
    },
    {
      path: "docs/legacy/ODDENGINE_LEGACY_STATUS_BOARD.json",
      content: JSON.stringify(board, null, 2),
    },
    {
      path: "docs/legacy/ODDENGINE_LEGACY_ACCEPTANCE_MATRIX.csv",
      content: csv,
    },
    {
      path: "docs/legacy/README.md",
      content: [
        "# Legacy HQ export",
        "",
        "This pack was exported from the Builder panel inside OddEngine.",
        "",
        "- The markdown file is the human-readable master checklist.",
        "- The JSON file is the structured status board.",
        "- The CSV file is for spreadsheet-style sorting and reporting.",
        "",
        "Seed statuses are starting assumptions and should be confirmed with a real panel audit.",
        "",
      ].join("\n"),
    },
  ];
}
