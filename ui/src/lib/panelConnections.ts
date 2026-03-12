import { CONNECTION_SERVICES, loadConnections, type SavedConnections } from "./connectionsCenter";

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

type PanelRequirement = {
  panelId: string;
  title: string;
  services: Array<{
    serviceId: string;
    requiredFields: string[];
    optional?: boolean;
  }>;
};

export const PANEL_REQUIREMENTS: PanelRequirement[] = [
  {
    panelId: "Books",
    title: "Studio",
    services: [
      { serviceId: "studio", requiredFields: ["renderBaseUrl"] },
    ],
  },
  {
    panelId: "GroceryMeals",
    title: "Grocery",
    services: [
      { serviceId: "grocery", requiredFields: ["groceryBaseUrl", "defaultZip"] },
    ],
  },
  {
    panelId: "Trading",
    title: "Trading",
    services: [
      { serviceId: "trading", requiredFields: ["marketDataKey"], optional: true },
    ],
  },
  {
    panelId: "Calendar",
    title: "Calendar",
    services: [
      { serviceId: "calendar", requiredFields: ["calendarId"], optional: true },
    ],
  },
  {
    panelId: "Money",
    title: "Money",
    services: [
      { serviceId: "money", requiredFields: [], optional: true },
    ],
  },
  {
    panelId: "Entertainment",
    title: "Entertainment",
    services: [
      { serviceId: "entertainment", requiredFields: [], optional: true },
    ],
  },
  {
    panelId: "Cameras",
    title: "Cameras & Security",
    services: [
      { serviceId: "cameras", requiredFields: ["cameraBaseUrl"], optional: true },
    ],
  },
];

function getConnection(serviceId: string, saved = loadConnections()) {
  return saved[serviceId] || null;
}

export function getValue(serviceId: string, fieldKey: string, saved = loadConnections()) {
  return getConnection(serviceId, saved)?.[fieldKey] || "";
}

export function getMissingFieldsForService(serviceId: string, requiredFields: string[], saved = loadConnections()) {
  return requiredFields.filter((fieldKey) => !String(getValue(serviceId, fieldKey, saved)).trim());
}

export function buildPanelConnectionStatus(panelId: string, saved = loadConnections()): PanelConnectionStatus {
  const requirement = PANEL_REQUIREMENTS.find((item) => item.panelId === panelId);
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
    const missing = getMissingFieldsForService(serviceReq.serviceId, serviceReq.requiredFields, saved);
    const hasConnection = !!getConnection(serviceReq.serviceId, saved);
    if (!missing.length && (hasConnection || !serviceReq.requiredFields.length || serviceReq.optional)) {
      readyServices.push(serviceReq.serviceId);
    } else {
      missingServices.push(serviceReq.serviceId);
      for (const field of missing) missingFields.push(`${serviceReq.serviceId}:${field}`);
    }
  }

  const total = Math.max(requirement.services.length, 1);
  const completionPercent = Math.round((readyServices.length / total) * 100);

  return {
    panelId,
    title: requirement.title,
    ready: missingServices.length === 0,
    missingFields,
    readyServices,
    missingServices,
    completionPercent,
    summary: missingServices.length === 0 ? "Setup looks ready." : `Missing setup for ${missingServices.join(", ")}.`,
  };
}

export function summarizeAllPanelStatuses(saved = loadConnections()) {
  return PANEL_REQUIREMENTS.map((item) => buildPanelConnectionStatus(item.panelId, saved));
}

export function buildMissingInputsLabel(status: PanelConnectionStatus) {
  if (!status.missingFields.length) return "All required inputs saved.";
  const labels = status.missingFields.map((item) => item.split(":")[1]);
  return Array.from(new Set(labels)).join(", ");
}
