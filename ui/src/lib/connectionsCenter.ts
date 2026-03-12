export type ConnectionFieldType = "text" | "password" | "apiKey" | "url" | "email" | "token";

export type ConnectionField = {
  key: string;
  label: string;
  type: ConnectionFieldType;
  placeholder?: string;
  required?: boolean;
  secret?: boolean;
};

export type ConnectionServiceId =
  | "studio.render"
  | "studio.externalVideo"
  | "grocery.providers"
  | "trading.broker"
  | "calendar.primary"
  | "money.providers"
  | "entertainment.accounts";

export type ConnectionService = {
  id: ConnectionServiceId;
  title: string;
  section: "Studio" | "Household" | "Finance" | "Calendar" | "Entertainment";
  description: string;
  fields: ConnectionField[];
};

export type SavedConnectionValues = Record<string, string>;
export type SavedConnections = Record<string, SavedConnectionValues>;

export const CONNECTIONS_STORAGE_KEY = "oddengine:connectionsCenter:v1";

export const CONNECTION_SERVICES: ConnectionService[] = [
  {
    id: "studio.render",
    title: "Studio Render Providers",
    section: "Studio",
    description: "Render bridge base URL, provider account names, and external render credentials for Studio.",
    fields: [
      { key: "renderBaseUrl", label: "Render Base URL", type: "url", placeholder: "http://127.0.0.1:8899", required: true },
      { key: "providerName", label: "Default Provider Name", type: "text", placeholder: "local-worker" },
      { key: "providerApiKey", label: "Provider API Key", type: "apiKey", secret: true },
      { key: "providerAccount", label: "Provider Account / Email", type: "email", secret: true },
    ],
  },
  {
    id: "studio.externalVideo",
    title: "Studio External Video Tools",
    section: "Studio",
    description: "Optional external video or AI media tools for finishing work beyond the local render seam.",
    fields: [
      { key: "toolName", label: "Primary Tool", type: "text", placeholder: "Runway / Pika / local bridge" },
      { key: "toolBaseUrl", label: "Tool Base URL", type: "url" },
      { key: "toolToken", label: "Access Token", type: "token", secret: true },
      { key: "workspaceId", label: "Workspace / Project ID", type: "text", secret: true },
    ],
  },
  {
    id: "grocery.providers",
    title: "Grocery Providers",
    section: "Household",
    description: "Store login and provider settings used for grocery, coupons, and shopping trips.",
    fields: [
      { key: "preferredStores", label: "Preferred Stores", type: "text", placeholder: "Smith's, Walmart, Costco" },
      { key: "pickupZip", label: "Pickup / Delivery ZIP", type: "text" },
      { key: "providerEmail", label: "Provider Email", type: "email", secret: true },
      { key: "providerPassword", label: "Provider Password", type: "password", secret: true },
      { key: "providerApiKey", label: "Provider API Key", type: "apiKey", secret: true },
    ],
  },
  {
    id: "trading.broker",
    title: "Trading / Broker Integrations",
    section: "Finance",
    description: "Broker account usernames, API tokens, and market data hooks for trading-related panels.",
    fields: [
      { key: "brokerName", label: "Broker Name", type: "text", placeholder: "Tradier / Public / IBKR" },
      { key: "accountId", label: "Account ID", type: "text", secret: true },
      { key: "username", label: "Username / Email", type: "email", secret: true },
      { key: "password", label: "Password", type: "password", secret: true },
      { key: "apiKey", label: "API Key", type: "apiKey", secret: true },
      { key: "apiSecret", label: "API Secret", type: "token", secret: true },
    ],
  },
  {
    id: "calendar.primary",
    title: "Calendar and Scheduling",
    section: "Calendar",
    description: "Primary calendar auth values, sync URLs, and scheduling hooks.",
    fields: [
      { key: "calendarName", label: "Primary Calendar", type: "text", placeholder: "Family Calendar" },
      { key: "calendarEmail", label: "Calendar Email", type: "email", secret: true },
      { key: "calendarToken", label: "Access Token", type: "token", secret: true },
      { key: "webhookUrl", label: "Webhook URL", type: "url", secret: true },
    ],
  },
  {
    id: "money.providers",
    title: "Money / Budget Providers",
    section: "Finance",
    description: "Finance app provider values for accounts, budgets, loans, and net worth data.",
    fields: [
      { key: "providerName", label: "Provider Name", type: "text", placeholder: "Plaid / Coinbase / Zillow-style feed" },
      { key: "username", label: "Username / Email", type: "email", secret: true },
      { key: "password", label: "Password", type: "password", secret: true },
      { key: "apiKey", label: "API Key", type: "apiKey", secret: true },
      { key: "accountScope", label: "Account Scope", type: "text", placeholder: "Checking, cards, investments" },
    ],
  },
  {
    id: "entertainment.accounts",
    title: "Entertainment Accounts",
    section: "Entertainment",
    description: "Streaming, music, and media service account values for the Entertainment panel.",
    fields: [
      { key: "serviceName", label: "Service Name", type: "text", placeholder: "Spotify / YouTube / Plex" },
      { key: "username", label: "Username / Email", type: "email", secret: true },
      { key: "password", label: "Password", type: "password", secret: true },
      { key: "accessToken", label: "Access Token", type: "token", secret: true },
    ],
  },
];

export function loadConnections(): SavedConnections {
  try {
    const raw = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveConnections(next: SavedConnections) {
  localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(next));
}

export function updateConnectionValues(
  connections: SavedConnections,
  serviceId: string,
  patch: SavedConnectionValues,
): SavedConnections {
  return {
    ...connections,
    [serviceId]: {
      ...(connections[serviceId] || {}),
      ...patch,
    },
  };
}

export function maskSecret(value: string) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, text.length - 4))}${text.slice(-4)}`;
}

export function getServiceById(serviceId: string) {
  return CONNECTION_SERVICES.find((service) => service.id === serviceId) || null;
}

export function getServiceCompletion(service: ConnectionService, values: SavedConnectionValues) {
  const required = service.fields.filter((field) => field.required);
  const complete = required.filter((field) => String(values?.[field.key] || "").trim()).length;
  return {
    required: required.length,
    complete,
    percent: required.length ? Math.round((complete / required.length) * 100) : 100,
  };
}

export function buildConnectionsSummary(connections: SavedConnections) {
  return CONNECTION_SERVICES.map((service) => ({
    service,
    values: connections[service.id] || {},
    completion: getServiceCompletion(service, connections[service.id] || {}),
  }));
}

export function buildConnectionsMarkdown(connections: SavedConnections) {
  const lines: string[] = [
    "# FairlyOdd OS Connections Center",
    "",
    "This summary shows configured services and setup completeness without exposing secret values.",
    "",
  ];

  for (const item of buildConnectionsSummary(connections)) {
    lines.push(`## ${item.service.title}`);
    lines.push(`- Section: ${item.service.section}`);
    lines.push(`- Completion: ${item.completion.complete}/${item.completion.required} required fields`);
    lines.push(`- Description: ${item.service.description}`);
    lines.push("");
    for (const field of item.service.fields) {
      const raw = String(item.values[field.key] || "");
      const display = field.secret ? maskSecret(raw) : raw || "—";
      lines.push(`- ${field.label}: ${display || "—"}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
