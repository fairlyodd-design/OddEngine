# v10.26.11a Homie Voice Bubble And Lip Sync Hooks Pass

This pass gives Homie a real first conversational voice lane inside the companion app.

## What it adds
- Talk to Homie button using the browser speech-recognition lane when Chromium exposes it.
- Homie talks back using browser speech synthesis.
- A live voice bubble over the 3D scene.
- Procedural fallback mouth movement driven by speaking amplitude.
- Store-backed speech runtime so listening/speaking/error states stay visible.

## Important truth
This is a local renderer voice lane, not a full cloud voice stack. When recognition is unavailable in the renderer, typed chat still works and Homie can still speak back when synthesis exists.
