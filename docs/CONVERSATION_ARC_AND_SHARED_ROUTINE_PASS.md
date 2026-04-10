# v10.26.15i — Conversation Arc And Shared Routine Pass

This pass starts from the attached `v10.26.15c` source base and adds two real layers on top of it:

1. **Hear-You Doctor lane** so Homie can explain why voice is not reacting instead of making the user guess.
2. **Conversation arc + shared routine memory** so Homie keeps a gentler thread of what you have been working through lately.

## What changed

### Hear-You Doctor lane
- added a one-click **Voice path check**
- added clearer status about **why Homie can or cannot hear you right now**
- added **forced cloud** and **forced external** path test buttons
- added a lightweight **live mic level meter**
- added **selected input device echo-back** when the runtime reveals the track label
- cleaned up turn labels so detached Homie now surfaces:
  - Waiting for turn
  - Listening
  - Transcribing
  - Thinking
  - Replying
  - Needs provider

### Conversation arc + shared routine memory
- added lightweight persistent routine check-ins inside Homie lane memory
- derived a **conversation arc** line from recent check-ins and interaction history
- derived a **shared routine** line from recent time-of-day and panel rhythm
- exposed those lines in detached Homie and in the system prompt shaping
- added a **gentle check-in cue** so Homie can stay continuous without sounding clingy or fake

### Voice loop polish folded into this pass
- removed an early external-bridge auto-relisten jump that could restart listening too soon after transcription

## Touched files
- `ui/src/components/HomieBuddy.tsx`
- `ui/src/components/Homie3DActorShell.tsx`
- `ui/src/lib/homieCompanion.ts`
- `ui/src/lib/homieMemory.ts`
- `ui/src/lib/version.ts`
- `.oddengine_last_ui_version.txt`
- `docs/CONVERSATION_ARC_AND_SHARED_ROUTINE_PASS.md`

## Validation
- source-level TypeScript transpile checks passed for the touched TS/TSX files
- this was **not** a full dependency-installed production build verification

## Best test
1. Open detached Homie.
2. Open **Voice diagnostics**.
3. Hit **Voice path check**.
4. Watch the mic meter move when you speak.
5. Confirm the selected input label appears after a mic capture succeeds.
6. Try **Force cloud test** and **Force external test**.
7. Have a short companion exchange, then reopen later and see whether the conversation arc / shared routine lines feel more continuous.
