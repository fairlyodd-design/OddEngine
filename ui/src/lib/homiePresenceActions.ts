export type HomiePresenceState =
  | "idle"
  | "listening"
  | "speaking"
  | "thinking"
  | "happy"
  | "concerned"
  | "busy";

export type HomieRecommendedAction = {
  id: string;
  label: string;
  panelId?: string;
  reason: string;
  kind: "navigate" | "message" | "check" | "open";
  payload?: Record<string, unknown>;
  priority: number;
};

export type HomiePanelContext = {
  panelId: string;
  title: string;
  summary?: string;
  completionPercent?: number;
  blockers?: string[];
  ready?: boolean;
  attentionNeeded?: boolean;
};

export type HomiePresenceSnapshot = {
  state: HomiePresenceState;
  moodLabel: string;
  headline: string;
  subline: string;
  recommended: HomieRecommendedAction[];
};

function first<T>(items: T[] | undefined | null): T | null {
  return Array.isArray(items) && items.length ? items[0] : null;
}

export function inferPresenceStateFromPanel(context: HomiePanelContext): HomiePresenceState {
  if (context.attentionNeeded || (context.blockers?.length || 0) > 0) return "concerned";
  if (context.ready && (context.completionPercent ?? 0) >= 90) return "happy";
  if ((context.completionPercent ?? 0) >= 60) return "thinking";
  return "idle";
}

export function buildRecommendedActions(contexts: HomiePanelContext[]): HomieRecommendedAction[] {
  const actions: HomieRecommendedAction[] = [];

  contexts.forEach((context) => {
    const blockers = context.blockers || [];
    if (blockers.length) {
      actions.push({
        id: `fix-${context.panelId.toLowerCase()}`,
        label: `Fix ${context.title}`,
        panelId: context.panelId,
        reason: blockers[0],
        kind: "navigate",
        priority: 100 - (context.completionPercent ?? 0),
      });
    } else if (!context.ready) {
      actions.push({
        id: `finish-${context.panelId.toLowerCase()}`,
        label: `Finish ${context.title}`,
        panelId: context.panelId,
        reason: context.summary || "Panel still needs setup.",
        kind: "navigate",
        priority: 80 - (context.completionPercent ?? 0),
      });
    } else {
      actions.push({
        id: `open-${context.panelId.toLowerCase()}`,
        label: `Open ${context.title}`,
        panelId: context.panelId,
        reason: context.summary || "Looks ready for use.",
        kind: "open",
        priority: 10,
      });
    }
  });

  return actions.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

export function buildHomiePresenceSnapshot(
  activePanel: HomiePanelContext,
  allPanels: HomiePanelContext[],
): HomiePresenceSnapshot {
  const state = inferPresenceStateFromPanel(activePanel);
  const recommended = buildRecommendedActions(allPanels);
  const top = first(recommended);

  const moodLabel =
    state === "happy"
      ? "Feeling good"
      : state === "concerned"
      ? "Heads up"
      : state === "thinking"
      ? "Thinking it through"
      : state === "busy"
      ? "In motion"
      : "Standing by";

  const headline =
    state === "happy"
      ? `${activePanel.title} looks strong`
      : state === "concerned"
      ? `${activePanel.title} needs attention`
      : `${activePanel.title} is in focus`;

  const subline = top
    ? `${top.label}: ${top.reason}`
    : activePanel.summary || "Homie is ready for the next move.";

  return {
    state,
    moodLabel,
    headline,
    subline,
    recommended,
  };
}

export function buildHomiePanelContext(
  panelId: string,
  title: string,
  options?: Partial<Omit<HomiePanelContext, "panelId" | "title">>,
): HomiePanelContext {
  return {
    panelId,
    title,
    summary: options?.summary || "",
    completionPercent: options?.completionPercent ?? 0,
    blockers: options?.blockers || [],
    ready: options?.ready ?? false,
    attentionNeeded: options?.attentionNeeded ?? false,
  };
}

export function presenceStateToAvatarMode(state: HomiePresenceState) {
  switch (state) {
    case "listening":
      return "listening";
    case "speaking":
      return "speaking";
    case "thinking":
      return "thinking";
    case "happy":
      return "happy";
    case "concerned":
      return "concerned";
    case "busy":
      return "thinking";
    default:
      return "idle";
  }
}
