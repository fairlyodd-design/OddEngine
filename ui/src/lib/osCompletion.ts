export type PanelCompletionStatus = "ready" | "partial" | "missing";

export type PanelConnectionSpec = {
  panelId: string;
  label: string;
  requiredKeys: string[];
  optionalKeys?: string[];
};

export type ConnectionsCenterShape = Record<string, any>;

export type PanelCompletionSummary = {
  panelId: string;
  label: string;
  status: PanelCompletionStatus;
  readinessPercent: number;
  configuredKeys: string[];
  missingRequiredKeys: string[];
  optionalKeysPresent: string[];
};

export type OSCompletionSummary = {
  readinessPercent: number;
  readyPanels: PanelCompletionSummary[];
  partialPanels: PanelCompletionSummary[];
  missingPanels: PanelCompletionSummary[];
  allPanels: PanelCompletionSummary[];
  totalConfiguredConnections: number;
  totalMissingRequiredKeys: number;
  nextBestStep: string;
  missingByPanel: Record<string, string[]>;
};

export type OnboardingBoard = {
  headline: string;
  nextActions: string[];
  blockers: string[];
  readyLabels: string[];
  partialLabels: string[];
  missingLabels: string[];
};

export const PANEL_CONNECTION_SPECS: PanelConnectionSpec[] = [
  {
    panelId: "Books",
    label: "Studio",
    requiredKeys: ["studio.renderBaseUrl"],
    optionalKeys: ["studio.openaiApiKey", "studio.providerToken", "studio.webhookUrl"],
  },
  {
    panelId: "GroceryMeals",
    label: "Grocery",
    requiredKeys: ["grocery.primaryProvider"],
    optionalKeys: ["grocery.accountEmail", "grocery.accountToken", "grocery.defaultStore"],
  },
  {
    panelId: "Trading",
    label: "Trading",
    requiredKeys: ["trading.broker", "trading.marketDataProvider"],
    optionalKeys: ["trading.apiKey", "trading.accountId", "trading.paperMode"],
  },
  {
    panelId: "Calendar",
    label: "Calendar",
    requiredKeys: ["calendar.provider"],
    optionalKeys: ["calendar.accountEmail", "calendar.oauthToken"],
  },
  {
    panelId: "Money",
    label: "Money",
    requiredKeys: ["money.primarySource"],
    optionalKeys: ["money.apiKey", "money.accountId", "money.syncMode"],
  },
  {
    panelId: "FamilyBudget",
    label: "Family Budget",
    requiredKeys: ["budget.householdProfile"],
    optionalKeys: ["budget.sheetId", "budget.rollupMode"],
  },
  {
    panelId: "Entertainment",
    label: "Entertainment",
    requiredKeys: [],
    optionalKeys: ["entertainment.spotifyConnected", "entertainment.youtubeConnected"],
  },
  {
    panelId: "Security",
    label: "Security",
    requiredKeys: [],
    optionalKeys: ["security.endpoint", "security.localBridge"],
  },
  {
    panelId: "Cameras",
    label: "Cameras",
    requiredKeys: [],
    optionalKeys: ["cameras.endpoint", "cameras.authToken"],
  },
  {
    panelId: "Preferences",
    label: "Preferences",
    requiredKeys: [],
    optionalKeys: ["preferences.ownerName"],
  },
];

function getValueByPath(obj: any, path: string): any {
  return String(path)
    .split(".")
    .reduce((acc: any, key: string) => (acc == null ? undefined : acc[key]), obj);
}

function hasConfiguredValue(value: any): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return true;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

export function summarizePanelCompletion(
  spec: PanelConnectionSpec,
  connections: ConnectionsCenterShape,
): PanelCompletionSummary {
  const required = spec.requiredKeys || [];
  const optional = spec.optionalKeys || [];

  const configuredRequired = required.filter((key) => hasConfiguredValue(getValueByPath(connections, key)));
  const missingRequiredKeys = required.filter((key) => !configuredRequired.includes(key));
  const optionalKeysPresent = optional.filter((key) => hasConfiguredValue(getValueByPath(connections, key)));
  const configuredKeys = [...configuredRequired, ...optionalKeysPresent];

  const totalPossible = required.length + optional.length;
  const readinessPercent =
    totalPossible === 0
      ? 100
      : Math.round((configuredKeys.length / totalPossible) * 100);

  let status: PanelCompletionStatus = "ready";
  if (required.length && missingRequiredKeys.length === required.length) {
    status = "missing";
  } else if (missingRequiredKeys.length > 0 || (required.length === 0 && configuredKeys.length === 0)) {
    status = required.length === 0 && configuredKeys.length === 0 ? "missing" : "partial";
  }

  return {
    panelId: spec.panelId,
    label: spec.label,
    status,
    readinessPercent,
    configuredKeys,
    missingRequiredKeys,
    optionalKeysPresent,
  };
}

export function summarizeConnectionsByPanel(connections: ConnectionsCenterShape): PanelCompletionSummary[] {
  return PANEL_CONNECTION_SPECS.map((spec) => summarizePanelCompletion(spec, connections));
}

export function buildOSCompletionSummary(connections: ConnectionsCenterShape): OSCompletionSummary {
  const allPanels = summarizeConnectionsByPanel(connections);

  const readyPanels = allPanels.filter((panel) => panel.status === "ready");
  const partialPanels = allPanels.filter((panel) => panel.status === "partial");
  const missingPanels = allPanels.filter((panel) => panel.status === "missing");

  const totalConfiguredConnections = allPanels.reduce(
    (sum, panel) => sum + panel.configuredKeys.length,
    0,
  );
  const totalMissingRequiredKeys = allPanels.reduce(
    (sum, panel) => sum + panel.missingRequiredKeys.length,
    0,
  );

  const readinessPercent =
    allPanels.length === 0
      ? 100
      : Math.round(
          allPanels.reduce((sum, panel) => sum + panel.readinessPercent, 0) / allPanels.length,
        );

  const missingByPanel = Object.fromEntries(
    allPanels
      .filter((panel) => panel.missingRequiredKeys.length > 0)
      .map((panel) => [panel.label, panel.missingRequiredKeys]),
  );

  const nextBestStep =
    missingPanels[0]?.missingRequiredKeys[0]
      ? `Connect ${missingPanels[0].label}: ${missingPanels[0].missingRequiredKeys[0]}`
      : partialPanels[0]
        ? `Finish setup for ${partialPanels[0].label}`
        : "OS setup looks healthy. Do a final sweep and verify live providers.";

  return {
    readinessPercent,
    readyPanels,
    partialPanels,
    missingPanels,
    allPanels,
    totalConfiguredConnections,
    totalMissingRequiredKeys,
    nextBestStep,
    missingByPanel,
  };
}

export function buildOnboardingBoard(summary: OSCompletionSummary): OnboardingBoard {
  const blockers = Object.entries(summary.missingByPanel).flatMap(([label, keys]) =>
    keys.map((key) => `${label}: missing ${key}`),
  );

  const nextActions = [
    summary.nextBestStep,
    ...(summary.partialPanels.slice(0, 2).map((panel) => `Finish setup for ${panel.label}`)),
  ].filter(Boolean);

  return {
    headline:
      summary.readinessPercent >= 90
        ? "FairlyOdd OS is nearly fully connected."
        : summary.readinessPercent >= 60
          ? "FairlyOdd OS is functional, but a few key setup steps remain."
          : "FairlyOdd OS still needs connection setup before it feels complete.",
    nextActions,
    blockers,
    readyLabels: summary.readyPanels.map((panel) => panel.label),
    partialLabels: summary.partialPanels.map((panel) => panel.label),
    missingLabels: summary.missingPanels.map((panel) => panel.label),
  };
}
