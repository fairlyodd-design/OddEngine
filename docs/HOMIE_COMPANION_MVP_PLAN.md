# v10.26.0_HomieCompanion3DMVP plan

## Goal

Create a real separate Homie desktop app that is simple, clean, and expandable.

## MVP must do these things

### Window
- open in its own Electron window
- drag
- resize
- remember last size and position
- not always-on-top by default
- move to next display

### Avatar
- show one full-body avatar
- visibly change state
- allow a fallback procedural buddy
- allow a real GLB/VRM loading lane

### States
- idle
- listening
- talking
- alert
- celebrate

### Bridge
- answer `GET /health`
- answer `GET /events/recent`
- accept `POST /event`
- push bridge events into the renderer

## Success test

The pass is successful when you can:

1. open Homie Companion
2. click state buttons and watch Homie change
3. move Homie to another screen
4. send a local event to the bridge
5. watch the UI update from that event
6. load a real `.glb` or `.vrm` avatar path

## Next passes after this one

- **v10.26.2_HomieOddEngineBridgeWiringPass**
- **v10.26.3_HomieVoiceModePass**
- **v10.26.4_HomieLipSyncEmotionHooksPass**
