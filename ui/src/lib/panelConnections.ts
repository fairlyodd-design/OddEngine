import { CONNECTION_SERVICES, loadConnections } from "./connectionsCenter";

export type PanelConnectionStatus = {
  serviceId: string;
  label: string;
  ready: boolean;
  completionPercent: number;
  requiredCount: number;
  savedCount: number;
  missing: string[];
  values: Record<string, string>;
};

function norm(value: unknown) {
  return String(value ?? "").trim();
}

function findService(serviceId: string) {
  const list: any[] = Array.isArray(CONNECTION_SERVICES) ? CONNECTION_SERVICES : [];
  return (
    list.find((service) => String(service?.id || "").toLowerCase() === serviceId.toLowerCase()) ||
    null
  );
}

function getServiceFieldKeys(service: any): string[] {
  const fields = Array.isArray(service?.fields) ? service.fields : [];
  return fields
    .map((field: any) => String(field?.key || field?.id || "").trim())
    .filter(Boolean);
}

function getServiceLabel(serviceId: string, service: any) {
  return String(service?.label || service?.title || serviceId).trim();
}

function readServiceValues(serviceId: string): Record<string, string> {
  const saved: any = typeof loadConnections === "function" ? loadConnections() : {};
  const bucket = saved?.[serviceId];
  const rawValues = bucket?.values ?? bucket ?? {};
  const output: Record<string, string> = {};

  Object.keys(rawValues || {}).forEach((key) => {
    output[key] = norm(rawValues[key]);
  });

  return output;
}

export function buildPanelConnectionStatus(
  serviceId: string,
  requiredKeys?: string[],
): PanelConnectionStatus {
  const service = findService(serviceId);
  const values = readServiceValues(serviceId);

  const required = Array.isArray(requiredKeys) && requiredKeys.length
    ? requiredKeys.map((key) => String(key).trim()).filter(Boolean)
    : getServiceFieldKeys(service);

  const uniqueRequired = Array.from(new Set(required));
  const missing = uniqueRequired.filter((key) => !norm(values[key]));
  const savedCount = uniqueRequired.filter((key) => norm(values[key])).length;
  const requiredCount = uniqueRequired.length;

  const completionPercent =
    requiredCount > 0 ? Math.round((savedCount / requiredCount) * 100) : 100;

  return {
    serviceId,
    label: getServiceLabel(serviceId, service),
    ready: missing.length === 0,
    completionPercent,
    requiredCount,
    savedCount,
    missing,
    values,
  };
}

export function buildMissingInputsLabel(
  status: Pick<PanelConnectionStatus, "ready" | "missing">,
) {
  if (status.ready || !status.missing.length) return "None";
  return status.missing.join(", ");
}

export function buildPanelConnectionSummary(status: PanelConnectionStatus) {
  return {
    title: status.label,
    state: status.ready ? "Ready" : "Needs setup",
    detail: status.ready
      ? `${status.savedCount}/${status.requiredCount} required inputs saved.`
      : `${status.savedCount}/${status.requiredCount} required inputs saved. Missing: ${buildMissingInputsLabel(status)}.`,
  };
}
