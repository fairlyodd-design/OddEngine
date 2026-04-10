# v10.26.15m3 — Expose Voice Mode Toggle Hotfix

This pass exposes the voice mode controls in the main Homie companion settings and in the detached Hear-You Doctor drawer.

## What changed

- Added Voice engine selector to the main Homie companion settings card:
  - Cloud speech
  - External/local HTTP
  - Hybrid
- Added Voice bridge URL field next to the companion controls so the hearing lane can be pointed at `http://127.0.0.1:8765`.
- Added one-click doctor actions:
  - Use local bridge
  - Use hybrid
  - Use cloud
- Added a visible voice engine mode readout in Hear-You Doctor so users can see when the bridge is healthy but idle because cloud mode is selected.

## Goal

Stop the app from saying the local bridge is healthy while hiding the control required to actually switch Homie into the working hearing lane.
