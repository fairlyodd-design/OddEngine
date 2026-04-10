# v10.26.1_HomieAvatarLoaderPass

## Goal

Swap the companion app from a procedural-only lane to a real avatar loading lane.

## What this pass adds

- avatar loader UI card
- avatar status and error reporting
- GLB runtime loading path
- VRM runtime loading hook path
- fallback buddy path if the model is missing or bad
- model drop folder at `homie_companion/public/models`

## Success test

This pass is successful when you can:

1. open Homie Companion
2. leave it on fallback and see the original buddy
3. drop a `.glb` or `.vrm` file into `public/models`
4. type the web path in the loader card
5. click **Load path**
6. see the real model replace the fallback buddy
7. switch back to fallback if needed

## Good starter test paths

- `/models/homie.glb`
- `/models/homie.vrm`

## Important scope line

This is the **loader lane**, not the final animation system.

Still later:
- per-bone authored animation clips
- lip sync
- facial emotions
- gesture library
- OddEngine event wiring polish
