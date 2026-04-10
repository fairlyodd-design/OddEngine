import type { HomieEventType, HomieState } from "./events";

export type HomieBridgeEvent =
  | { type: "alert:new_setup"; payload: { symbol?: string; note?: string } }
  | { type: "coach:wait"; payload?: { reason?: string } }
  | { type: "coach:good_reclaim"; payload?: { symbol?: string } }
  | { type: "scanner:best_pair"; payload: { symbol: string } }
  | { type: "speech:say"; payload: { text: string } }
  | { type: "system:notify"; payload: { title: string; body?: string; level?: "info" | "warn" | "error" | "success"; source?: string } }
  | { type: "presence:set_state"; payload: { state: HomieState } };

export type HomieBridgeEnvelope = {
  ok: boolean;
  event?: HomieBridgeEvent;
  error?: string;
};

export type HomieBridgeHealth = {
  ok: true;
  app: "homie_companion";
  port: number;
  recentEventCount: number;
};

export type HomieEventTypeName = HomieEventType;
