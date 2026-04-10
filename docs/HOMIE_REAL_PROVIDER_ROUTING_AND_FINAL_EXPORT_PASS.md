# v10.26.11l Homie Real Provider Routing And Final Export Pass

This pass upgrades Story Forge / Render Lab from a release-board-only lane into a provider-routed export lane.

## What this adds

- Release board can now route into a real local provider lane.
- Provider route knows whether the project is primarily a:
  - book formatting lane
  - video render / screening lane
  - audio master lane
- Final export can now generate cleaner local deliverables tied to the chosen provider route.
- Homie Companion can trigger:
  - Prep provider route
  - Final export deliverables
- Story Forge bridge now exposes provider/export state back to Homie.

## Backend routes

- `GET /render/providers`
- `POST /render/jobs/:id/provider-route`
- `POST /render/jobs/:id/final-export`

## Honest truth

These exports are still local-first deliverable files and provider packets, not a fully commercial-grade publishing / film rendering / audio mastering stack yet.

What is now real:

- provider-specific routing
- release-board-aware export plans
- local final deliverable generation with tracked paths
- one shared bridge between Story Forge, Render Lab, and Homie
