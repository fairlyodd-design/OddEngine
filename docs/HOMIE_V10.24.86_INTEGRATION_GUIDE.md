# Homie v10.24.86 Integration Guide

## 1) Add imports to `ui/src/panels/Homie.tsx`

```ts
import HomieAvatar from "../components/HomieAvatar";
import { inferHomieState, getHomieStatusLine } from "../lib/homiePresence";
```

## 2) Add local UI state inside the Homie panel

```ts
const [micActive, setMicActive] = useState(false);
const [cameraActive, setCameraActive] = useState(false);
const [homieSpeaking, setHomieSpeaking] = useState(false);
const [homieCelebrating, setHomieCelebrating] = useState(false);
```

## 3) Derive presence state

```ts
const homieState = inferHomieState({
  panelId: "Homie",
  micActive,
  speaking: homieSpeaking,
  celebrating: homieCelebrating,
  renderBusy: false,
  hasErrors: false,
});
```

## 4) Render the avatar near the top of the panel

```tsx
<div className="card softCard">
  <HomieAvatar
    state={homieState}
    micActive={micActive}
    cameraActive={cameraActive}
    onClickMic={() => setMicActive((v) => !v)}
    onClickCamera={() => setCameraActive((v) => !v)}
  />
  <div className="small mt-3">{getHomieStatusLine(homieState)}</div>
</div>
```

## 5) Wire panel-aware moods later
- Grocery savings found -> `happy`
- Render busy -> `thinking`
- Voice bridge active -> `listening` / `speaking`
- Errors -> `concerned`

## 6) Build

```powershell
cd C:\OddEngine
npm --prefix .\ui run build
```
