import type { HomieState } from "./homie";

export type HomieBridgeEvent =
  | { type: "alert:new_setup"; payload?: { symbol?: string; note?: string } }
  | { type: "coach:wait"; payload?: { reason?: string } }
  | { type: "coach:good_reclaim"; payload?: { symbol?: string } }
  | { type: "scanner:best_pair"; payload?: { symbol?: string } }
  | { type: "speech:say"; payload?: { text?: string } }
  | { type: "system:notify"; payload?: { title?: string; body?: string; level?: "info" | "warn" | "error" | "success"; source?: string } }
  | { type: "presence:set_state"; payload?: { state?: HomieState } };

export type BridgeStatus = {
  ok: boolean;
  port?: number;
  url?: string;
  recentEventCount?: number;
};
