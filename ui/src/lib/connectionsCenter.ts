export type ConnectionFieldType = "text" | "password" | "url" | "email" | "textarea" | "number";

export type ConnectionField = {
  key: string;
  label: string;
  type: ConnectionFieldType;
  placeholder?: string;
  help?: string;
};

export type ConnectionService = {
  id: string;
  title: string;
  sub: string;
  fields: ConnectionField[];
};

export type SavedConnections = Record<string, Record<string, string>>;

const KEY = "oddengine:connections:center:v1";

export const CONNECTION_SERVICES: ConnectionService[] = [
  {
    id: "studio",
    title: "Studio",
    sub: "Render providers, external creative tools, output webhooks.",
    fields: [
      { key: "renderBaseUrl", label: "Render base URL", type: "url", placeholder: "http://127.0.0.1:8899" },
      { key: "renderProviderUser", label: "Render provider username", type: "text", placeholder: "username" },
      { key: "renderProviderPassword", label: "Render provider password", type: "password", placeholder: "password" },
      { key: "renderApiKey", label: "Render API key", type: "password", placeholder: "api key" },
      { key: "renderWebhook", label: "Render webhook URL", type: "url", placeholder: "https://..." },
      { key: "outputFolder", label: "Output folder path", type: "text", placeholder: "C:\OddEngine\outputs" },
    ],
  },
  {
    id: "grocery",
    title: "Grocery",
    sub: "Store accounts, coupon providers, and pickup/delivery settings.",
    fields: [
      { key: "groceryBaseUrl", label: "Grocery provider base URL", type: "url", placeholder: "http://127.0.0.1:8787" },
      { key: "defaultZip", label: "Default ZIP", type: "text", placeholder: "89101" },
      { key: "walmartUser", label: "Walmart username/email", type: "email", placeholder: "name@example.com" },
      { key: "walmartPassword", label: "Walmart password", type: "password", placeholder: "password" },
      { key: "krogerUser", label: "Kroger username/email", type: "email", placeholder: "name@example.com" },
      { key: "krogerPassword", label: "Kroger password", type: "password", placeholder: "password" },
      { key: "couponApiKey", label: "Coupon/deals API key", type: "password", placeholder: "api key" },
    ],
  },
  {
    id: "trading",
    title: "Trading",
    sub: "Broker credentials, market data, and scanner provider inputs.",
    fields: [
      { key: "brokerUser", label: "Broker username", type: "text", placeholder: "username" },
      { key: "brokerPassword", label: "Broker password", type: "password", placeholder: "password" },
      { key: "brokerApiKey", label: "Broker API key", type: "password", placeholder: "api key" },
      { key: "brokerSecret", label: "Broker secret", type: "password", placeholder: "secret" },
      { key: "marketDataKey", label: "Market data API key", type: "password", placeholder: "api key" },
    ],
  },
  {
    id: "calendar",
    title: "Calendar",
    sub: "Calendar sync and scheduling tokens.",
    fields: [
      { key: "calendarEmail", label: "Calendar account email", type: "email", placeholder: "name@example.com" },
      { key: "calendarId", label: "Calendar ID", type: "text", placeholder: "primary" },
      { key: "calendarToken", label: "Calendar access token", type: "password", placeholder: "token" },
      { key: "calendarRefreshToken", label: "Calendar refresh token", type: "password", placeholder: "refresh token" },
    ],
  },
  {
    id: "money",
    title: "Money & Budget",
    sub: "Finance providers, net-worth sources, and budgeting inputs.",
    fields: [
      { key: "financeApiKey", label: "Finance API key", type: "password", placeholder: "api key" },
      { key: "plaidClientId", label: "Plaid client ID", type: "text", placeholder: "client id" },
      { key: "plaidSecret", label: "Plaid secret", type: "password", placeholder: "secret" },
      { key: "zillowEmail", label: "Zillow/account email", type: "email", placeholder: "name@example.com" },
    ],
  },
  {
    id: "entertainment",
    title: "Entertainment",
    sub: "Streaming/service credentials and media providers.",
    fields: [
      { key: "spotifyUser", label: "Spotify email/username", type: "email", placeholder: "name@example.com" },
      { key: "spotifyToken", label: "Spotify token", type: "password", placeholder: "token" },
      { key: "youtubeApiKey", label: "YouTube API key", type: "password", placeholder: "api key" },
    ],
  },
  {
    id: "cameras",
    title: "Cameras & Security",
    sub: "Camera endpoints and local bridge details.",
    fields: [
      { key: "cameraBaseUrl", label: "Camera base URL", type: "url", placeholder: "http://127.0.0.1:8080" },
      { key: "cameraUser", label: "Camera username", type: "text", placeholder: "username" },
      { key: "cameraPassword", label: "Camera password", type: "password", placeholder: "password" },
    ],
  },
];

export function loadConnections(): SavedConnections {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveConnections(next: SavedConnections) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function updateConnectionValues(
  current: SavedConnections,
  serviceId: string,
  patch: Record<string, string>,
): SavedConnections {
  return {
    ...current,
    [serviceId]: {
      ...(current[serviceId] || {}),
      ...patch,
    },
  };
}

export function maskSecret(value: string, visible = false) {
  if (visible) return value || "";
  if (!value) return "";
  if (value.length <= 4) return "•".repeat(value.length);
  return `${"•".repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

export function buildConnectionsSummary(saved: SavedConnections) {
  const services = CONNECTION_SERVICES.map((service) => {
    const values = saved[service.id] || {};
    const filled = service.fields.filter((field) => String(values[field.key] || "").trim()).length;
    return {
      id: service.id,
      title: service.title,
      sub: service.sub,
      filled,
      total: service.fields.length,
      ready: filled > 0,
    };
  });

  const filledServices = services.filter((service) => service.ready).length;
  const totalServices = services.length;
  const readiness = totalServices ? Math.round((filledServices / totalServices) * 100) : 0;

  return {
    services,
    filledServices,
    totalServices,
    readiness,
  };
}

export function buildConnectionsMarkdown(saved: SavedConnections) {
  const lines: string[] = [
    "# OddEngine Connections & Secrets Summary",
    "",
    "_Local-only setup summary. Do not commit real secrets to GitHub._",
    "",
  ];

  for (const service of CONNECTION_SERVICES) {
    const values = saved[service.id] || {};
    lines.push(`## ${service.title}`);
    lines.push(service.sub);
    lines.push("");
    for (const field of service.fields) {
      const raw = String(values[field.key] || "").trim();
      const value = field.type === "password" ? maskSecret(raw) : raw || "(empty)";
      lines.push(`- **${field.label}:** ${value}`);
    }
    lines.push("");
  }

  return lines.join("
");
}
