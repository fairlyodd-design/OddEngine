export type HomieVoiceMode = "idle" | "listening" | "processing" | "speaking" | "muted";

export type HomieVoiceState = {
  supported: boolean;
  micAvailable: boolean;
  speakerAvailable: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  transcript: string;
  interimTranscript: string;
  error: string;
  mode: HomieVoiceMode;
};

export type HomieVoiceBridgeOptions = {
  lang?: string;
  onTranscript?: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  onModeChange?: (mode: HomieVoiceMode) => void;
  onError?: (message: string) => void;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: null | (() => void);
  onend: null | (() => void);
  onerror: null | ((event: any) => void);
  onresult: null | ((event: any) => void);
  start: () => void;
  stop: () => void;
  abort: () => void;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
    speechSynthesis?: SpeechSynthesis;
  }
}

export function createHomieVoiceBridge(options: HomieVoiceBridgeOptions = {}) {
  const RecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = RecognitionCtor ? new RecognitionCtor() : null;

  let isListening = false;
  let isSpeaking = false;
  let isMuted = false;
  let transcript = "";
  let interimTranscript = "";
  let error = "";
  let mode: HomieVoiceMode = "idle";

  function emitMode(next: HomieVoiceMode) {
    mode = next;
    options.onModeChange?.(next);
  }

  function emitError(message: string) {
    error = message;
    options.onError?.(message);
  }

  if (recognition) {
    recognition.lang = options.lang || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      emitMode(isMuted ? "muted" : "listening");
    };

    recognition.onend = () => {
      isListening = false;
      if (!isSpeaking) emitMode(isMuted ? "muted" : "idle");
    };

    recognition.onerror = (event: any) => {
      emitError(String(event?.error || "Voice recognition error"));
      isListening = false;
      emitMode(isMuted ? "muted" : "idle");
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const part = event.results[i]?.[0]?.transcript || "";
        if (event.results[i].isFinal) finalText += part;
        else interimText += part;
      }

      if (interimText) {
        interimTranscript = interimText.trim();
        options.onInterimTranscript?.(interimTranscript);
      }

      if (finalText) {
        transcript = finalText.trim();
        interimTranscript = "";
        options.onTranscript?.(transcript);
      }
    };
  }

  function getState(): HomieVoiceState {
    return {
      supported: Boolean(recognition || window.speechSynthesis),
      micAvailable: Boolean(recognition),
      speakerAvailable: Boolean(window.speechSynthesis),
      isListening,
      isSpeaking,
      isMuted,
      transcript,
      interimTranscript,
      error,
      mode,
    };
  }

  function startListening() {
    if (!recognition || isMuted) return;
    error = "";
    interimTranscript = "";
    transcript = "";
    recognition.start();
  }

  function stopListening() {
    if (!recognition) return;
    recognition.stop();
    isListening = false;
    if (!isSpeaking) emitMode(isMuted ? "muted" : "idle");
  }

  function speak(text: string) {
    if (!window.speechSynthesis || !text || isMuted) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => {
      isSpeaking = true;
      emitMode("speaking");
    };
    utterance.onend = () => {
      isSpeaking = false;
      emitMode(isListening ? "listening" : isMuted ? "muted" : "idle");
    };
    utterance.onerror = () => {
      isSpeaking = false;
      emitError("Speech synthesis error");
      emitMode(isListening ? "listening" : isMuted ? "muted" : "idle");
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    isSpeaking = false;
    emitMode(isListening ? "listening" : isMuted ? "muted" : "idle");
  }

  function toggleMute() {
    isMuted = !isMuted;
    if (isMuted) {
      stopListening();
      stopSpeaking();
      emitMode("muted");
    } else {
      emitMode(isListening ? "listening" : "idle");
    }
    return isMuted;
  }

  function destroy() {
    stopListening();
    stopSpeaking();
    if (recognition) recognition.abort();
  }

  return {
    getState,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    toggleMute,
    destroy,
  };
}

export function homieVoiceModeToAvatarState(mode: HomieVoiceMode) {
  switch (mode) {
    case "listening":
      return "listening";
    case "processing":
      return "thinking";
    case "speaking":
      return "speaking";
    case "muted":
      return "concerned";
    default:
      return "idle";
  }
}
