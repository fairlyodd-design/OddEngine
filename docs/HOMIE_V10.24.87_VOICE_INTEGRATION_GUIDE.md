# HOMIE v10.24.87 Voice Integration Guide

Open:
`C:\OddEngine\ui\src\panels\Homie.tsx`

## 1) Add imports near the top

```ts
import { useEffect, useMemo, useRef, useState } from "react";
import { createHomieVoiceBridge, homieVoiceModeToAvatarState, type HomieVoiceMode } from "../lib/homieVoiceBridge";
import HomieAvatar from "../components/HomieAvatar";
```

If `Homie.tsx` already imports some of these from elsewhere, merge carefully instead of duplicating.

## 2) Add local voice state inside the Homie component

```ts
const voiceBridgeRef = useRef<ReturnType<typeof createHomieVoiceBridge> | null>(null);
const [voiceMode, setVoiceMode] = useState<HomieVoiceMode>("idle");
const [voiceTranscript, setVoiceTranscript] = useState("");
const [voiceInterim, setVoiceInterim] = useState("");
const [voiceError, setVoiceError] = useState("");
const [voiceMuted, setVoiceMuted] = useState(false);
```

## 3) Initialize the voice bridge in a `useEffect`

```ts
useEffect(() => {
  const bridge = createHomieVoiceBridge({
    onTranscript: (text) => setVoiceTranscript(text),
    onInterimTranscript: (text) => setVoiceInterim(text),
    onModeChange: (mode) => setVoiceMode(mode),
    onError: (message) => setVoiceError(message),
  });

  voiceBridgeRef.current = bridge;
  return () => {
    bridge.destroy();
    voiceBridgeRef.current = null;
  };
}, []);
```

## 4) Wire avatar state

Wherever HomieAvatar is rendered, map voice mode into it:

```tsx
<HomieAvatar state={homieVoiceModeToAvatarState(voiceMode) as any} />
```

If you already have panel-aware emotion/state, combine it instead of replacing it completely.

## 5) Add voice controls

```tsx
<div className="row wrap" style={{ gap: 10 }}>
  <button className={`tabBtn ${voiceMode === "listening" ? "active" : ""}`} onClick={() => voiceBridgeRef.current?.startListening()}>
    Start mic
  </button>
  <button className="tabBtn" onClick={() => voiceBridgeRef.current?.stopListening()}>
    Stop mic
  </button>
  <button className="tabBtn" onClick={() => voiceBridgeRef.current?.speak("Hey Homie here. Voice bridge is online.")}>
    Test voice
  </button>
  <button
    className={`tabBtn ${voiceMuted ? "active" : ""}`}
    onClick={() => {
      const muted = voiceBridgeRef.current?.toggleMute() ?? false;
      setVoiceMuted(Boolean(muted));
    }}
  >
    {voiceMuted ? "Unmute" : "Mute"}
  </button>
</div>
```

## 6) Add voice status UI

```tsx
<div className="card softCard mt-4">
  <div className="small shellEyebrow">VOICE BRIDGE</div>
  <div className="small mt-2"><b>Mode:</b> {voiceMode}</div>
  <div className="small mt-2"><b>Transcript:</b> {voiceTranscript || "—"}</div>
  <div className="small mt-2"><b>Interim:</b> {voiceInterim || "—"}</div>
  {voiceError ? <div className="note mt-3">{voiceError}</div> : null}
</div>
```

## 7) Optional follow-up
After this pass, the best next move is:
- v10.24.88_HomieVisionPass
