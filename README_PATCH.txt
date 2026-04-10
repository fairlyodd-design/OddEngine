OddEngine v10.24.0 surgical patch set

Included changes:
- Restores Poker panel visibility by adding Poker panel metadata, lazy import, render case, and a safe placeholder panel shell.
- Adds Electron IPC runtime stats endpoint for live CPU, RAM, network, and storage data.
- Exposes runtime stats through preload and odd.ts.
- Rewires Home panel system cards to real desktop runtime data with browser-safe fallback.

Files changed:
- ui/src/lib/brain.ts
- ui/src/App.tsx
- ui/src/lib/odd.ts
- ui/src/panels/Home.tsx
- electron/preload.cjs
- electron/main.cjs
- ui/src/panels/Poker.tsx (new)

Validation notes:
- node --check passed for electron/main.cjs and electron/preload.cjs.
- TypeScript compile check surfaces pre-existing errors in ui/src/panels/Plugins.tsx unrelated to this patch.
