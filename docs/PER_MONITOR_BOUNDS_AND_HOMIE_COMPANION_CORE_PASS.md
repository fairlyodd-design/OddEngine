# v10.26.14e — Per-Monitor Bounds and Homie Companion Core Pass

## What changed

- Upgraded desktop pop-out window memory from one generic bounds file per panel to layout-aware profiles.
- A panel can now remember different exact bounds for different monitor layouts.
- Added per-layout, per-display saved window bounds persistence in `electron/main.cjs`.
- Single-panel pop-outs and workspace relaunches now pull the best matching bounds profile for the current monitor layout before falling back to generic placement.
- Added `ui/src/lib/homieCompanion.ts` as a reusable real-companion chat layer on top of the existing local Homie AI runtime.
- Upgraded `HomieBuddy` so the companion lane now chats inline through the local AI runtime in desktop mode instead of only queueing a draft for the full Homie panel.
- Voice transcripts that look conversational now route into the real companion chat instead of being treated like shell commands.

## Result

- Trading, News, Homie, and other detached panels can remember exact size + position for each monitor layout you use.
- Homie Buddy behaves more like a real companion: type to it directly, get contextual replies in-place, and keep a short persistent conversation history.
