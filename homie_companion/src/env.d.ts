export {};

declare global {
  type HomieState = "idle" | "listening" | "talking" | "alert" | "celebrate";

  type HomieBridgeEvent =
    | { type: "alert:new_setup"; payload?: { symbol?: string; note?: string } }
    | { type: "coach:wait"; payload?: { reason?: string } }
    | { type: "coach:good_reclaim"; payload?: { symbol?: string } }
    | { type: "scanner:best_pair"; payload?: { symbol?: string } }
    | { type: "speech:say"; payload?: { text?: string } }
    | { type: "presence:set_state"; payload?: { state?: HomieState } };

  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
    homie: {
      desktop: {
        getStatus: () => Promise<any>;
        moveToNextDisplay: () => Promise<any>;
        toggleAlwaysOnTop: () => Promise<any>;
        resetBounds: () => Promise<any>;
        minimize: () => Promise<any>;
        close: () => Promise<any>;
      };
      bridge: {
        getStatus: () => Promise<any>;
        getRecentEvents: () => Promise<any>;
        sendTestEvent: (event: HomieBridgeEvent) => Promise<any>;
        onEvent: (callback: (event: HomieBridgeEvent) => void) => () => void;
      };
    };
  }
}
