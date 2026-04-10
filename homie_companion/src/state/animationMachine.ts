import type { HomieBridgeEvent } from "../types/bridge";
import type { HomieMessage, HomieState } from "../types/homie";

export function defaultMessageForState(state: HomieState): HomieMessage {
  switch (state) {
    case "listening":
      return { title: "Listening", body: "Homie is leaning in and paying attention." };
    case "talking":
      return { title: "Talking", body: "Homie is speaking and guiding the flow." };
    case "alert":
      return { title: "Alert", body: "Heads up. Something needs attention right now." };
    case "celebrate":
      return { title: "Celebrate", body: "Nice. Something good just happened." };
    case "idle":
    default:
      return { title: "Idle", body: "Homie is calm, ready, and waiting." };
  }
}

export function eventToState(event: HomieBridgeEvent): {
  state: HomieState;
  message: HomieMessage;
} {
  switch (event.type) {
    case "alert:new_setup":
      return {
        state: "alert",
        message: {
          title: "New setup",
          body: `${event.payload?.symbol || "A setup"} is getting interesting. ${event.payload?.note || ""}`.trim()
        }
      };
    case "coach:wait":
      return {
        state: "listening",
        message: {
          title: "Wait",
          body: event.payload?.reason || "Hold up. Let the setup prove itself first."
        }
      };
    case "coach:good_reclaim":
      return {
        state: "celebrate",
        message: {
          title: "Good reclaim",
          body: `${event.payload?.symbol || "That move"} looked strong. Nice patience.`
        }
      };
    case "scanner:best_pair":
      return {
        state: "alert",
        message: {
          title: "Best pair",
          body: `${event.payload?.symbol || "A pair"} bubbled to the top of the scanner.`
        }
      };
    case "speech:say":
      return {
        state: "talking",
        message: {
          title: "Homie says",
          body: event.payload?.text || "I am here and ready."
        }
      };
    case "system:notify": {
      const level = event.payload?.level || "info";
      const state = level === "success" ? "celebrate" : level === "warn" || level === "error" ? "alert" : "talking";
      return {
        state,
        message: {
          title: event.payload?.title || "OddEngine update",
          body: [event.payload?.body, event.payload?.source ? `Source: ${event.payload.source}` : ""].filter(Boolean).join(" • ") || "OddEngine sent a live companion update."
        }
      };
    }
    case "presence:set_state":
      return {
        state: event.payload?.state || "idle",
        message: defaultMessageForState(event.payload?.state || "idle")
      };
    default:
      return {
        state: "idle",
        message: defaultMessageForState("idle")
      };
  }
}
