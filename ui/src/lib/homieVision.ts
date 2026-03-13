export type HomieVisionMode = "off" | "snapshot" | "live";

export type HomieVisionState =
  | "idle"
  | "requesting-permission"
  | "ready"
  | "capturing"
  | "paused"
  | "error";

export type HomieVisionFrame = {
  dataUrl: string;
  capturedAt: number;
  width?: number;
  height?: number;
};

export type HomieVisionController = {
  mode: HomieVisionMode;
  state: HomieVisionState;
  stream: MediaStream | null;
  error: string;
  lastFrame: HomieVisionFrame | null;
  cameraEnabled: boolean;
  requestCamera(): Promise<boolean>;
  stopCamera(): void;
  captureFrame(video: HTMLVideoElement, canvas?: HTMLCanvasElement | null): HomieVisionFrame | null;
  setMode(mode: HomieVisionMode): void;
  clearFrame(): void;
};

export type HomieVisionOptions = {
  defaultMode?: HomieVisionMode;
  video?: MediaTrackConstraints;
  audio?: boolean;
};

const STORAGE_MODE_KEY = "oddengine:homie:visionMode:v1";
const STORAGE_ENABLED_KEY = "oddengine:homie:cameraEnabled:v1";

function loadBool(key: string, fallback = false) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

function saveBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "true" : "false");
  } catch {}
}

function loadMode(fallback: HomieVisionMode): HomieVisionMode {
  try {
    const raw = localStorage.getItem(STORAGE_MODE_KEY) as HomieVisionMode | null;
    if (raw === "off" || raw === "snapshot" || raw === "live") return raw;
  } catch {}
  return fallback;
}

function saveMode(mode: HomieVisionMode) {
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  } catch {}
}

export function buildHomieVisionPermissionCopy(mode: HomieVisionMode) {
  if (mode === "live") {
    return "Homie wants live camera access. Keep this opt-in, clearly visible, and easy to turn off.";
  }
  return "Homie wants snapshot camera access. Keep this opt-in and only capture when the user asks.";
}

export function buildHomieVisionIndicator(state: HomieVisionState, mode: HomieVisionMode) {
  const modeLabel = mode === "live" ? "Live vision" : mode === "snapshot" ? "Snapshot vision" : "Vision off";
  switch (state) {
    case "requesting-permission":
      return `${modeLabel} • requesting permission`;
    case "ready":
      return `${modeLabel} • ready`;
    case "capturing":
      return `${modeLabel} • capturing`;
    case "paused":
      return `${modeLabel} • paused`;
    case "error":
      return `${modeLabel} • error`;
    default:
      return modeLabel;
  }
}

export async function requestHomieCamera(
  options?: HomieVisionOptions,
): Promise<{ ok: boolean; stream: MediaStream | null; error?: string }> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, stream: null, error: "Camera API unavailable in this environment." };
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: options?.video ?? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: options?.audio ?? false,
    });

    return { ok: true, stream };
  } catch (error: any) {
    return {
      ok: false,
      stream: null,
      error: error?.message || "Unable to access camera.",
    };
  }
}

export function stopHomieCamera(stream: MediaStream | null) {
  stream?.getTracks?.().forEach((track) => {
    try {
      track.stop();
    } catch {}
  });
}

export function captureHomieFrame(
  video: HTMLVideoElement,
  canvas?: HTMLCanvasElement | null,
): HomieVisionFrame | null {
  if (!video || !video.videoWidth || !video.videoHeight) return null;

  const targetCanvas = canvas || document.createElement("canvas");
  targetCanvas.width = video.videoWidth;
  targetCanvas.height = video.videoHeight;

  const ctx = targetCanvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, targetCanvas.width, targetCanvas.height);

  return {
    dataUrl: targetCanvas.toDataURL("image/png"),
    capturedAt: Date.now(),
    width: targetCanvas.width,
    height: targetCanvas.height,
  };
}

export function createHomieVisionController(
  options?: HomieVisionOptions,
): HomieVisionController {
  let mode: HomieVisionMode = loadMode(options?.defaultMode ?? "off");
  let state: HomieVisionState = "idle";
  let stream: MediaStream | null = null;
  let error = "";
  let lastFrame: HomieVisionFrame | null = null;
  let cameraEnabled = loadBool(STORAGE_ENABLED_KEY, false);

  return {
    get mode() {
      return mode;
    },
    get state() {
      return state;
    },
    get stream() {
      return stream;
    },
    get error() {
      return error;
    },
    get lastFrame() {
      return lastFrame;
    },
    get cameraEnabled() {
      return cameraEnabled;
    },
    async requestCamera() {
      state = "requesting-permission";
      const res = await requestHomieCamera(options);
      if (!res.ok) {
        state = "error";
        error = res.error || "Unable to access camera.";
        return false;
      }
      stream = res.stream;
      error = "";
      state = "ready";
      cameraEnabled = true;
      saveBool(STORAGE_ENABLED_KEY, true);
      return true;
    },
    stopCamera() {
      stopHomieCamera(stream);
      stream = null;
      cameraEnabled = false;
      state = "idle";
      saveBool(STORAGE_ENABLED_KEY, false);
    },
    captureFrame(video, canvas) {
      state = "capturing";
      const frame = captureHomieFrame(video, canvas);
      if (!frame) {
        state = "error";
        error = "Unable to capture frame.";
        return null;
      }
      lastFrame = frame;
      state = mode === "live" ? "ready" : "paused";
      return frame;
    },
    setMode(nextMode) {
      mode = nextMode;
      saveMode(mode);
      if (mode === "off") {
        this.stopCamera();
      }
    },
    clearFrame() {
      lastFrame = null;
      if (state === "paused") state = "ready";
    },
  };
}
