# v10.24.88 Homie Vision integration guide

This pass is intentionally safe:
- no giant Homie panel overwrite
- no blind JSX injection
- one helper file + clear wiring steps

## 1) Add import in `ui/src/panels/Homie.tsx`

```ts
import {
  buildHomieVisionIndicator,
  buildHomieVisionPermissionCopy,
  createHomieVisionController,
  type HomieVisionMode,
} from "../lib/homieVision";
```

## 2) Add local state inside your Homie component

```ts
const [visionMode, setVisionMode] = useState<HomieVisionMode>("off");
const [cameraVisible, setCameraVisible] = useState(false);
const [visionTick, setVisionTick] = useState(0);

const visionRef = useRef(createHomieVisionController({ defaultMode: "off" }));
const videoRef = useRef<HTMLVideoElement | null>(null);
const canvasRef = useRef<HTMLCanvasElement | null>(null);
```

## 3) Add helpers

```ts
const vision = visionRef.current;

const requestCamera = async () => {
  const ok = await vision.requestCamera();
  setVisionTick((v) => v + 1);
  if (ok) setCameraVisible(true);
};

const stopCamera = () => {
  vision.stopCamera();
  setCameraVisible(false);
  setVisionTick((v) => v + 1);
};

const captureSnapshot = () => {
  if (!videoRef.current) return;
  vision.captureFrame(videoRef.current, canvasRef.current);
  setVisionTick((v) => v + 1);
};

const toggleVisionMode = (mode: HomieVisionMode) => {
  vision.setMode(mode);
  setVisionMode(mode);
  setVisionTick((v) => v + 1);
};
```

## 4) When a stream exists, attach it to the video element

```ts
useEffect(() => {
  const video = videoRef.current;
  if (!video || !vision.stream) return;
  video.srcObject = vision.stream;
  video.play().catch(() => {});
}, [visionTick]);
```

## 5) Add a Vision card to Homie UI

Suggested controls:
- Vision off
- Snapshot mode
- Live mode
- Request camera
- Stop camera
- Capture snapshot

Suggested indicator:
```ts
buildHomieVisionIndicator(vision.state, vision.mode)
```

Suggested permission copy:
```ts
buildHomieVisionPermissionCopy(vision.mode)
```

## 6) Visible camera safety
Always show:
- Camera On / Off state
- current mode
- last snapshot timestamp if one exists
- one-click stop

## 7) Snapshot-first rollout
Recommended rollout:
1. snapshot mode only
2. explicit capture button
3. later enable live mode if stable

## 8) Future link with voice
This helper is designed to pair with:
- `homiePresence.ts`
- `homieVoiceBridge.ts`

Once wired, Homie can:
- listen
- speak
- see (opt-in)
- react with avatar state changes
