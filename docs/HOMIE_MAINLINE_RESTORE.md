# Homie Mainline Restore

This pass uses the uploaded `OddEngine-main.zip` as the visual and layout source of truth.

What changed:
- keeps the earlier shell look and feel intact
- adds local-first Homie presence, wake-flow, and companion tuning state
- adds small visible companion cards instead of broad UI rewrites

Files added:
- `ui/src/lib/homiePresence.ts`
- `ui/src/lib/homieWakeFlow.ts`
- `ui/src/lib/homieCompanion.ts`

Files touched lightly:
- `ui/src/panels/Home.tsx`
- `ui/src/panels/Preferences.tsx`
- `ui/src/panels/Homie.tsx`
- `ui/src/lib/brain.ts`
