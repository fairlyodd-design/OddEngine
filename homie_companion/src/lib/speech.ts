type VoiceCallbacks = {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

type RecognitionHandle = {
  stop: () => void;
};

type SpeakHandle = {
  stop: () => void;
};

type MicActivityCallbacks = {
  onLevel?: (level: number) => void;
  onReady?: () => void;
  onBargeIn?: () => void;
  onError?: (message: string) => void;
};

type MicActivityHandle = {
  stop: () => void;
};

export function speechStubNote() {
  return "Voice uses the browser speech lane when Chromium supports it. If not, Homie stays on typed chat until we wire a deeper voice backend.";
}

function getRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

export function getSpeechSupport() {
  return {
    recognition: Boolean(getRecognitionCtor()),
    synthesis: typeof window !== "undefined" && "speechSynthesis" in window,
    micActivity: typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)
  };
}

export function startVoiceRecognition(callbacks: VoiceCallbacks): RecognitionHandle | null {
  const RecognitionCtor = getRecognitionCtor();
  if (!RecognitionCtor) {
    callbacks.onError?.("This Chromium build does not expose speech recognition yet.");
    return null;
  }

  const recognition = new RecognitionCtor();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => callbacks.onStart?.();
  recognition.onerror = (event: any) => callbacks.onError?.(event?.error || "Voice recognition had a hiccup.");
  recognition.onend = () => callbacks.onEnd?.();
  recognition.onresult = (event: any) => {
    let interim = "";
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i]?.[0]?.transcript || "";
      if (event.results[i].isFinal) {
        finalText += transcript;
      } else {
        interim += transcript;
      }
    }
    if (interim.trim()) callbacks.onInterim?.(interim.trim());
    if (finalText.trim()) callbacks.onFinal?.(finalText.trim());
  };

  recognition.start();
  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {}
    }
  };
}

export async function startMicActivityWatch(callbacks: MicActivityCallbacks): Promise<MicActivityHandle | null> {
  if (!(typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia)) {
    callbacks.onError?.("Live interrupt needs microphone access through getUserMedia.");
    return null;
  }

  let rafId = 0;
  let stopped = false;
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let activeSince = 0;
  const armedAt = performance.now();
  const threshold = 0.12;
  const cooldownMs = 520;
  const holdMs = 180;

  const stop = () => {
    stopped = true;
    if (rafId) window.cancelAnimationFrame(rafId);
    analyser?.disconnect();
    source?.disconnect();
    if (context && context.state !== "closed") {
      void context.close().catch(() => {});
    }
    stream?.getTracks().forEach((track) => track.stop());
    analyser = null;
    source = null;
    context = null;
    stream = null;
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    if (stopped) {
      stream.getTracks().forEach((track) => track.stop());
      return { stop };
    }

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      callbacks.onError?.("This renderer does not expose an audio context for barge-in monitoring.");
      stop();
      return null;
    }

    context = new AudioContextCtor();
    source = context.createMediaStreamSource(stream);
    analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.76;
    source.connect(analyser);
    const buffer = new Uint8Array(analyser.fftSize);
    callbacks.onReady?.();

    const tick = () => {
      if (stopped || !analyser) return;
      analyser.getByteTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const normalized = (buffer[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      callbacks.onLevel?.(Math.max(0, Math.min(1, rms * 4.2)));

      const now = performance.now();
      const active = now - armedAt > cooldownMs && rms >= threshold;
      if (active) {
        if (!activeSince) activeSince = now;
        if (now - activeSince >= holdMs) {
          callbacks.onBargeIn?.();
          stop();
          return;
        }
      } else {
        activeSince = 0;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return { stop };
  } catch (error: any) {
    stop();
    const detail = error?.name || error?.message || "Live interrupt mic access failed.";
    callbacks.onError?.(detail);
    return null;
  }
}

export function speakWithBrowser(text: string, callbacks?: { onStart?: () => void; onEnd?: () => void; onError?: (message: string) => void; onBoundary?: () => void; }): SpeakHandle | null {
  if (!(typeof window !== "undefined" && "speechSynthesis" in window)) {
    callbacks?.onError?.("Speech synthesis is not available in this renderer.");
    return null;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices?.() || [];
  const preferred = voices.find((voice) => /en/i.test(voice.lang) && /Google|Samantha|Microsoft/i.test(voice.name)) || voices.find((voice) => /en/i.test(voice.lang));
  if (preferred) utterance.voice = preferred;
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.onstart = () => callbacks?.onStart?.();
  utterance.onend = () => callbacks?.onEnd?.();
  utterance.onerror = () => callbacks?.onError?.("Homie tried to speak but the voice lane failed.");
  utterance.onboundary = () => callbacks?.onBoundary?.();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return {
    stop: () => {
      window.speechSynthesis.cancel();
      callbacks?.onEnd?.();
    }
  };
}
