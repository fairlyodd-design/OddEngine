# Phoenix Income Forge Panel Pass

Version: v10.26.14a

## What changed

- Added a dedicated **Phoenix Income Forge** panel with ranked lanes, weekly targets, shipped outcomes, fallback filler-cash guidance, and a kill-list.
- Added a **Ship** tab to **Writers Lounge** so one prompt can generate a practical ship pack with listing copy and file checklist.
- Warmed up **Homie** so it behaves more like an all-around companion: help, guide, talk, listen, and stay with the user while they work.
- Added panel routing so "open forge" and similar prompts land in the dedicated Phoenix panel.
- Surfaced Forge tie-ins inside Home, Money, and Homie.

## Main files touched

- `ui/src/lib/writersShip.ts`
- `ui/src/panels/PhoenixIncomeForge.tsx`
- `ui/src/panels/Books.tsx`
- `ui/src/panels/Homie.tsx`
- `ui/src/panels/Home.tsx`
- `ui/src/panels/Money.tsx`
- `ui/src/lib/homieActionRouter.ts`
- `ui/src/lib/homieCore.ts`
- `ui/src/lib/brain.ts`
- `ui/src/App.tsx`
- `ui/src/lib/version.ts`
- `BUILD_NOTES.txt`

## Notes

This pass was reconstructed from the conversation handoff and applied on top of the last uploaded full source bundle (`v10.26.13l`).
