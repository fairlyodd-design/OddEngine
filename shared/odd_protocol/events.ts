export const HOMIE_STATES = ["idle", "listening", "talking", "alert", "celebrate"] as const;

export const HOMIE_EVENTS = {
  ALERT_NEW_SETUP: "alert:new_setup",
  COACH_WAIT: "coach:wait",
  COACH_GOOD_RECLAIM: "coach:good_reclaim",
  SCANNER_BEST_PAIR: "scanner:best_pair",
  SPEECH_SAY: "speech:say",
  SYSTEM_NOTIFY: "system:notify",
  PRESENCE_SET_STATE: "presence:set_state",
} as const;

export type HomieState = (typeof HOMIE_STATES)[number];
export type HomieEventType = (typeof HOMIE_EVENTS)[keyof typeof HOMIE_EVENTS];
