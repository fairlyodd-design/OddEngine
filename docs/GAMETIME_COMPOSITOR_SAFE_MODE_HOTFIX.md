# v10.26.11x — Game Time compositor safe-mode hotfix

This pass adds a compositor-safe mode for the Game Time panel.

## Why
A severe full-surface corruption / demon glitch was showing up while Game Time was active. The corruption pattern points to a GPU/compositor issue rather than a simple layout drift.

## What changed
- App shell now enables a `compositorSafe` class when the active panel is `CryptoGames`.
- Game Time panel root is tagged with `gameTimePanelRoot`.
- Safe mode disables expensive blur/filter/hover-transform behavior across the shell while Game Time is active.
- Homie buddy/orb animations are paused while this panel is active.
- Sticky assistant/activity rails are relaxed to reduce compositor churn.
- Cards/buttons/inputs are flattened to simpler surfaces while Game Time is mounted.

## Goal
Kill the severe GPU-style corruption while keeping the panel usable.
