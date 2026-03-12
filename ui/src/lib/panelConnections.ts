import { loadJSON, saveJSON } from "./storage";

export type ConnectionFieldType =
  | "text"
  | "password"
  | "apiKey"
  | "token"
  | "email"
  | "url"
  | "number";

export type ConnectionField = {
  key: string;
  label: string;
  type: ConnectionFieldType;
  placeholder?: string;
  required?: boolean;
};

export type ConnectionService = {
  id: string;
  label: string;
  category:
    | "studio"
    | "grocery"
    | "trading"
    | "calendar"
    | "money"
    | "entertainment"
    | "system"
    | "other";
  description?: string;
  fields: ConnectionField[];
};

export type SavedConnectionValue = {
  value: string;
  updatedAt: number;
};

export type SavedConnection = {
  serviceId: string;
  values: Record<string, SavedConnectionValue>;
  enabled?: boolean;
  lastTestedAt?: number;
  lastTestOk?: boolean;
  notes?: string;
};

export type PanelRequirement = {
  panelId: string;
  title: string;
  services: Array<{
    serviceId: string;
    requiredFields: string[];
    optional?: boolean;
  }>;
};

export type PanelConnectionStatus = {
  panelId: string;
  title: string;
  ready: boolean;
  missingFields: string[];
  readyServices: string[];
  missingServices: string[];
  completionPercent: number;
  summary: string;
};

export const CONNECTIONS_CENTER_KEY = "oddengine:connections-center:v1";

export const CONNECTION_SERVICES: ConnectionService[] = [
  {
    id: "studio-render-provider",
    label: "Studio Render Provider",
    category: "studio",
    description: "Local render backend and optional external provider credentials.",
    fields: [
      { key: "baseUrl", label: "Base URL", type: "url", placeholder: "http://127.0.0.1:8899", required: true },
      { key: "apiKey", label: "API Key", type: "apiKey", placeholder: "Optional external provider key" },
      { key: "providerName", label: "Provider Label", type: "text", placeholder: "local-worker" },
    ],
  },
  {
    id: "grocery-provider",
    label: "Grocery Provider",
    category: "grocery",
    description: "Local grocery proxy plus household store/provider credentials.",
    fields: [
      { key: "baseUrl", label: "Base URL", type: "url", placeholder: "http://127.0.0.1:8787", required: true },
      { key: "username", label: "Username / Email", type: "email", placeholder: "store@example.com" },
      { key: "password", label: "Password", type: "password" },
      { key: "zipCode", label: "Zip Code", type: "text", placeholder: "89101" },
    ],
  },
  {
    id: "calendar-provider",
    label: "Calendar Provider",
    category: "calendar",
    description: "Calendar API credentials and calendar IDs.",
    fields: [
      { key: "calendarId", label: "Calendar ID", type: "text", placeholder: "primary", required: true },
      { key: "accessToken", label: "Access Token", type: "token" },
      { key: "refreshToken", label: "Refresh Token", type: "token" },
    ],
  },
  {
    id: "trading-market-data",
    label: "Trading Market Data",
    category: "trading",
    description: "Broker/data API settings for market, options, and quotes.",
    fields: [
      { key: "apiKey", label: "API Key", type: "apiKey", required: true },
      { key: "secret", label: "Secret", type: "password" },
      { key: "baseUrl", label: "Base URL", type: "url", placeholder: "https://api.example.com" },
      { key: "accountId", label: "Account ID", type: "text" },
    ],
  },
  {
    id: "money-finance-provider",
    label: "Money / Finance Provider",
    category: "money",
    description: "Finance account integration settings.",
    fields: [
      { key: "apiKey", label: "API Key", type: "apiKey" },
      { key: "username", label: "Username", type: "text" },
      { key: "password", label: "Password", type: "password" },
    ],
  },
  {
    id: "entertainment-provider",
    label: "Entertainment Provider",
    category: "entertainment",
    description: "Streaming / media account identifiers and tokens.",
    fields: [
      { key: "username", label: "Username", type: "text" },
      { key: "password", label: "Password", type: "password" },
      { key: "token", label: "Token", type: "token" },
    ],
  },
];

export const PANEL_REQUIREMENTS: PanelRequirement[] = [
  {
    panelId: "Books",
    title: "Studio",
    services: [
      { serviceId: "studio-render-provider", requiredFields: ["baseUrl"] },
    ],
  },
  {
    panelId: "GroceryMeals",
    title: "Grocery",
    services: [
      { serviceId: "grocery-provider", requiredFields: ["baseUrl", "zipCode"] },
    ],
  },
  {
    panelId: "Trading",
    title: "Trading",
    services: [
      { serviceId: "trading-market-data", requiredFields: ["apiKey"] },
    ],
  },
  {
    panelId: "Calendar",
    title: "Calendar",
    services: [
      { serviceId: "calendar-provider", requiredFields: ["calendarId"], optional: true },
    ],
  },
  {
    panelId: "Money",
    title: "Money",
    services: [
      { serviceId: "money-finance-provider", requiredFields: [], optional: true },
    ],
  },
  {
    panelId: "Entertainment",
    title: "Entertainment",
    services: [
      { serviceId: "entertainment-provider", requiredFields: [], optional: true },
    ],
  },
];

export function loadConnectionsCenter(): SavedConnection[] {
  const raw = loadJSON<any[]>(CONNECTIONS_CENTER_KEY, []);
  return Array.isArray(raw) ? raw : [];
}

export function saveConnectionsCenter(next: SavedConnection[]) {
  saveJSON(CONNECTIONS_CENTER_KEY, next);
}

export function getConnection(serviceId: string, connections = loadConnectionsCenter()): SavedConnection | null {
  return connections.find((c) => c.serviceId === serviceId) || null;
}

export function getService(serviceId: string): ConnectionService | null {
  return CONNECTION_SERVICES.find((service) => service.id === serviceId) || null;
}

export function upsertConnection(
  serviceId: string,
  fieldValues: Record<string, string>,
  connections = loadConnectionsCenter(),
): SavedConnection[] {
  const now = Date.now();
  const nextValues = Object.fromEntries(
    Object.entries(fieldValues).map(([key, value]) => [key, { value, updatedAt: now }])
  );

  const existing = getConnection(serviceId, connections);
  if (!existing) {
    return [
      ...connections,
      {
        serviceId,
        values: nextValues,
        enabled: true,
        lastTestedAt: undefined,
        lastTestOk: undefined,
      },
    ];
  }

  return connections.map((item) =>
    item.serviceId === serviceId
      ? {
          ...item,
          values: { ...item.values, ...nextValues },
          enabled: true,
        }
      : item
  );
}

export function markConnectionTestResult(
  serviceId: string,
  ok: boolean,
  connections = loadConnectionsCenter(),
): SavedConnection[] {
  const now = Date.now();
  return connections.map((item) =>
    item.serviceId === serviceId
      ? {
          ...item,
          lastTestedAt: now,
          lastTestOk: ok,
        }
      : item
  );
}

export function getValue(
  serviceId: string,
  fieldKey: string,
  connections = loadConnectionsCenter(),
): string {
  return getConnection(serviceId, connections)?.values?.[fieldKey]?.value || "";
}

export function getPanelRequirement(panelId: string): PanelRequirement | null {
  return PANEL_REQUIREMENTS.find((item) => item.panelId === panelId) || null;
}

export function getMissingFieldsForService(
  serviceId: string,
  requiredFields: string[],
  connections = loadConnectionsCenter(),
): string[] {
  return requiredFields.filter((fieldKey) => !String(getValue(serviceId, fieldKey, connections)).trim());
}

export function buildPanelConnectionStatus(
  panelId: string,
  connections = loadConnectionsCenter(),
): PanelConnectionStatus {
  const requirement = getPanelRequirement(panelId);
  if (!requirement) {
    return {
      panelId,
      title: panelId,
      ready: true,
      missingFields: [],
      readyServices: [],
      missingServices: [],
      completionPercent: 100,
      summary: "No setup requirements registered.",
    };
  }

  const missingFields: string[] = [];
  const readyServices: string[] = [];
  const missingServices: string[] = [];

  for (const serviceReq of requirement.services) {
    const missing = getMissingFieldsForService(serviceReq.serviceId, serviceReq.requiredFields, connections);
    const hasConnection = !!getConnection(serviceReq.serviceId, connections);

    if (!missing.length && (hasConnection || !serviceReq.requiredFields.length || serviceReq.optional)) {
      readyServices.push(serviceReq.serviceId);
    } else {
      missingServices.push(serviceReq.serviceId);
      for (const field of missing) {
        missingFields.push(`${serviceReq.serviceId}:${field}`);
      }
    }
  }

  const totalServices = Math.max(requirement.services.length, 1);
  const completionPercent = Math.round((readyServices.length / totalServices) * 100);

  return {
    panelId,
    title: requirement.title,
    ready: missingServices.length === 0,
    missingFields,
    readyServices,
    missingServices,
    completionPercent,
    summary:
      missingServices.length === 0
        ? "Setup looks ready."
        : `Missing setup for ${missingServices.join(", ")}.`,
  };
}

export function summarizeAllPanelStatuses(connections = loadConnectionsCenter()): PanelConnectionStatus[] {
  return PANEL_REQUIREMENTS.map((item) => buildPanelConnectionStatus(item.panelId, connections));
}

export function buildMissingInputsLabel(status: PanelConnectionStatus): string {
  if (!status.missingFields.length) return "All required inputs saved.";
  return status.missingFields.map((item) => item.split(":")[1]).join(", ");
}
