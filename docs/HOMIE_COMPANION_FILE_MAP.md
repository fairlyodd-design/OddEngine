# Homie Companion file map

This document matches the scaffold in this zip.

## Top-level add-ons

- `RUN_HOMIE_COMPANION_DEV_WINDOWS.bat` — easy run button from repo root
- `RUN_HOMIE_COMPANION_DESKTOP_WINDOWS.bat` — build-and-run style button from repo root
- `shared/odd_protocol/events.ts` — shared event names and states
- `shared/odd_protocol/types.ts` — shared payload contracts
- `docs/HOMIE_COMPANION_ARCHITECTURE.md` — why this is a separate app
- `docs/HOMIE_COMPANION_MVP_PLAN.md` — MVP scope
- `docs/HOMIE_COMPANION_BRANCH_READY_CHECKLIST_LIKE_IM_5.md` — simple start guide

## New app folder

- `homie_companion/package.json` — app scripts and dependencies
- `homie_companion/vite.config.ts` — Vite dev server config
- `homie_companion/tsconfig.json` — TypeScript config
- `homie_companion/index.html` — renderer entry
- `homie_companion/README.md` — local run guide
- `homie_companion/RUN_HOMIE_DEV_WINDOWS.bat` — local app dev launcher
- `homie_companion/RUN_HOMIE_DESKTOP_WINDOWS.bat` — local app desktop launcher
- `homie_companion/scripts/dev.mjs` — starts Vite, waits, then launches Electron

## Electron files

- `homie_companion/electron/main.cjs` — creates the window and starts the bridge
- `homie_companion/electron/preload.cjs` — safe renderer API
- `homie_companion/electron/window-state.cjs` — saves size and position
- `homie_companion/electron/display-tools.cjs` — second-screen helpers
- `homie_companion/electron/bridge-server.cjs` — local bridge endpoints
- `homie_companion/electron/paths.cjs` — dev vs build path helper

## Renderer files

- `homie_companion/src/main.tsx` — React entry
- `homie_companion/src/App.tsx` — top shell
- `homie_companion/src/styles.css` — companion styles
- `homie_companion/src/env.d.ts` — browser type shim

## Types and state

- `homie_companion/src/types/homie.ts`
- `homie_companion/src/types/bridge.ts`
- `homie_companion/src/state/companionStore.ts`
- `homie_companion/src/state/animationMachine.ts`

## UI components

- `homie_companion/src/components/HomieShell.tsx`
- `homie_companion/src/components/CompanionHeader.tsx`
- `homie_companion/src/components/CompanionControls.tsx`
- `homie_companion/src/components/CompanionStatusBar.tsx`
- `homie_companion/src/components/EventConsole.tsx`

## Scene files

- `homie_companion/src/scene/HomieScene.tsx`
- `homie_companion/src/scene/HomieAvatar.tsx`
- `homie_companion/src/scene/HomieStage.tsx`
- `homie_companion/src/scene/HomieLights.tsx`
- `homie_companion/src/scene/HomieCamera.tsx`
- `homie_companion/src/scene/avatarMotions.ts`

## Helper files

- `homie_companion/src/lib/ipc.ts`
- `homie_companion/src/lib/events.ts`
- `homie_companion/src/lib/speech.ts`
- `homie_companion/src/lib/screen.ts`

## Assets

- `homie_companion/public/homie-splash.png`
- `homie_companion/public/homie-icon.ico`
- `homie_companion/src/assets/placeholder/README.md`

## Tiny practical note

The Electron side in this scaffold uses `.cjs` files so it can run immediately on Windows without adding another TypeScript build step.
