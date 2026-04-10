import type { HomieBridgeEvent } from "../types/bridge";

export const demoEvents: Record<string, HomieBridgeEvent> = {
  idle: { type: "presence:set_state", payload: { state: "idle" } },
  listening: { type: "presence:set_state", payload: { state: "listening" } },
  talking: { type: "speech:say", payload: { text: "Hey buddy, I am talking now." } },
  alert: { type: "alert:new_setup", payload: { symbol: "NVDA", note: "Watch the reclaim zone." } },
  celebrate: { type: "coach:good_reclaim", payload: { symbol: "SPY" } }
};
