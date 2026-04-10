import { loadJSON, saveJSON } from "./storage";

export type ConnectorVerification = {
  key: string;
  label: string;
  status: "connected" | "failed" | "pending";
  verified: boolean;
  checkedAt: number;
  detail?: string;
};

const KEY = "oddengine:systemTruth:connectors:v1";
const EVENT = "oddengine:system-truth:connectors";

function save(items: ConnectorVerification[]) {
  saveJSON(KEY, items.slice(0, 80));
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch {}
}

export function listConnectorVerifications(): ConnectorVerification[] {
  return loadJSON<ConnectorVerification[]>(KEY, []).sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0));
}

export function setConnectorVerification(input: ConnectorVerification) {
  save([input, ...listConnectorVerifications().filter((item) => item.key !== input.key)]);
  return input;
}

export function verifyConnector(key: string, label: string, ok: boolean, detail?: string) {
  return setConnectorVerification({
    key,
    label,
    status: ok ? "connected" : "failed",
    verified: ok,
    checkedAt: Date.now(),
    detail,
  });
}

export const CONNECTOR_VERIFICATION_EVENT = EVENT;
