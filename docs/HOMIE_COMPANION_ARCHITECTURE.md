# Homie Companion architecture

## The tiny version

Think of it like this:

- **OddEngine** is the big house.
- **Homie Companion** is Homie's own room.
- The **bridge** is the hallway between them.
- The **avatar loader lane** is Homie's closet for real bodies.

That means Homie stops fighting with panel detach logic, BTC window logic, and popup patch loops.

## What lives where

### App A — OddEngine
OddEngine keeps doing:
- dashboards
- Phoenix
- scanners
- alerts
- workflow state

### App B — Homie Companion
Homie Companion keeps doing:
- its own desktop window
- its own avatar scene
- its own animation states
- avatar loading from GLB/VRM
- future voice/listen mode
- future lip sync and emotion hooks

## Why this is better

Because now:

- Homie can be moved around without breaking panel layout
- Homie can live on a second screen
- Homie can load a real body later without touching OddEngine panels
- OddEngine can stay focused on being the operator shell

## MVP + loader flow

1. Run Homie Companion.
2. Homie opens in its own Electron window.
3. The local bridge starts inside Homie Companion.
4. The renderer starts with the fallback buddy.
5. You can point Homie at a `.glb` or `.vrm` file in `public/models`.
6. If loading works, Homie uses the real model.
7. If loading fails, Homie falls back safely.
