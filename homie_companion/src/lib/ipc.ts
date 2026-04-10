import type { BridgeStatus, HomieBridgeEvent } from "../types/bridge";
import type { DesktopStatus } from "../types/homie";

export async function getDesktopStatus(): Promise<DesktopStatus> {
  return window.homie.desktop.getStatus();
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  return window.homie.bridge.getStatus();
}

export async function getRecentBridgeEvents(): Promise<HomieBridgeEvent[]> {
  const response = await window.homie.bridge.getRecentEvents();
  return response?.events || [];
}

export async function sendTestEvent(event: HomieBridgeEvent) {
  return window.homie.bridge.sendTestEvent(event);
}

export function subscribeToBridgeEvents(callback: (event: HomieBridgeEvent) => void) {
  return window.homie.bridge.onEvent(callback);
}
