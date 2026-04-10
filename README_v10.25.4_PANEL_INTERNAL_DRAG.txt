v10.25.4_PanelInternalDragRestorePass

What this pass does
- keeps CardGODMode locked to top-level workspace cards
- restores drag/reorder for panel-internal widgets in Writers Lounge and Home
- drag only starts from a visible widget handle ("↕ Move widget")
- no workspace snap/magnet is used for inner widgets
- local per-panel layout memory is saved separately

Files changed
- ui/src/components/PanelInternalDrag.tsx (new)
- ui/src/App.tsx
- ui/src/styles.css
- ui/src/lib/version.ts

Notes
- This pass is intentionally scoped to Writers Lounge and Home first.
- Inner widgets move within panel zones and between supported zones, without affecting outer workspace layout.
