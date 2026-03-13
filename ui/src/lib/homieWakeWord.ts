import { loadJSON, saveJSON } from "./storage";

export type HomieVoiceMode =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "muted"
  | "error";

export type HomieWakeWordSettings = {
  enabled: boolean;
  wakeWord: string;
  conversationMode: boolean;
  autoRestart: boolean;
  micEnabled: boolean;
  speakerEnabled: boolean;
};

export type HomieVoiceEvent =
  | { type: "heard"; transcript: string; heardWakeWord: boolean }
  | { type: "wake"; transcript: string }
  | { type: "response-start"; text: string }
  | { type: "response-end"; text: string }
  | { type: "state"; mode: HomieVoiceMode }
  | { type: "error"; message: string };

export type HomieWakeWordController = {
  getSettings: () => HomieWakeWordSettings;
  updateSettings: (patch: Partial<HomieWakeWordSettings>) => HomieWakeWordSettings;
  getMode: () => HomieVoiceMode;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => Promise<void>;
  destroy: () => void;
};

const KEY = "oddengine:homie:wakeword:v1";

const DEFAULTS: HomieWakeWordSettings = {
  enabled: false,
  wakeWord: "hey homie",
  conversationMode: false,
  autoRestart: true,
  micEnabled: true,
  speakerEnabled: true,
};

function normalize(text: string) {
  return String(text || "").trim().toLowerCase();
}

function readSettings(): HomieWakeWordSettings {
  const saved = loadJSON<Partial<HomieWakeWordSettings>>(KEY, {});
  return { ...DEFAULTS, ...(saved || {}) };
}

function writeSettings(settings: HomieWakeWordSettings) {
  saveJSON(KEY, settings);
}

function getRecognitionCtor(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function browserSupportsWakeWord() {
  return typeof window !== "undefined" && !!getRecognitionCtor();
}

export function createHomieWakeWordController(
  onEvent?: (event: HomieVoiceEvent) => void,
): HomieWakeWordController {
  let settings = readSettings();
  let mode: HomieVoiceMode = settings.micEnabled ? "idle" : "muted";
  let destroyed = false;
  let recognition: any = null;
  let isManualStop = false;

  const emit = (event: HomieVoiceEvent) => {
    if (destroyed) return;
    onEvent?.(event);
  };

  const setMode = (next: HomieVoiceMode) => {
    mode = next;
    emit({ type: "state", mode: next });
  };

  const stopListening = () => {
    isManualStop = true;
    try {
      recognition?.stop?.();
    } catch {}
    if (settings.micEnabled) setMode("idle");
    else setMode("muted");
  };

  const startListening = () => {
    if (destroyed) return;
    if (!settings.enabled || !settings.micEnabled) {
      setMode(settings.micEnabled ? "idle" : "muted");
      return;
    }

    const Recognition = getRecognitionCtor();
    if (!Recognition) {
      setMode("error");
      emit({ type: "error", message: "Speech recognition is not available in this browser/runtime." });
      return;
    }

    if (recognition) {
      try {
        recognition.stop();
      } catch {}
      recognition = null;
    }

    isManualStop = false;
    recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setMode("listening");
    };

    recognition.onerror = (event: any) => {
      setMode("error");
      emit({ type: "error", message: String(event?.error || "Voice recognition error.") });
    };

    recognition.onend = () => {
      if (destroyed) return;
      if (!isManualStop && settings.enabled && settings.micEnabled && settings.autoRestart) {
        try {
          recognition.start();
          return;
        } catch {}
      }
      setMode(settings.micEnabled ? "idle" : "muted");
    };

    recognition.onresult = (event: any) => {
      const results = Array.from(event.results || []);
      const transcript = results
        .map((result: any) => result?.[0]?.transcript || "")
        .join(" ")
        .trim();

      if (!transcript) return;

      const heardWakeWord = normalize(transcript).includes(normalize(settings.wakeWord));
      emit({ type: "heard", transcript, heardWakeWord });

      if (heardWakeWord) {
        emit({ type: "wake", transcript });
        if (settings.conversationMode) {
          setMode("processing");
        }
      }
    };

    try {
      recognition.start();
    } catch (error: any) {
      setMode("error");
      emit({ type: "error", message: error?.message || String(error) });
    }
  };

  const speak = async (text: string) => {
    const phrase = String(text || "").trim();
    if (!phrase) return;
    if (!settings.speakerEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
      emit({ type: "response-start", text: phrase });
      emit({ type: "response-end", text: phrase });
      return;
    }

    setMode("speaking");
    emit({ type: "response-start", text: phrase });

    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });

    emit({ type: "response-end", text: phrase });
    setMode(settings.micEnabled ? "idle" : "muted");
  };

  const updateSettings = (patch: Partial<HomieWakeWordSettings>) => {
    settings = { ...settings, ...patch };
    writeSettings(settings);

    if (!settings.micEnabled) {
      stopListening();
      setMode("muted");
    } else if (settings.enabled) {
      startListening();
    } else {
      setMode("idle");
    }

    return settings;
  };

  setMode(mode);

  return {
    getSettings: () => settings,
    updateSettings,
    getMode: () => mode,
    startListening,
    stopListening,
    speak,
    destroy: () => {
      destroyed = true;
      try {
        recognition?.stop?.();
      } catch {}
      recognition = null;
    },
  };
}
