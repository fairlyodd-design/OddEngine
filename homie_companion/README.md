# Homie Companion — v10.26.1_HomieAvatarLoaderPass

This pass gives Homie a real avatar loading lane.

## What changed

- Homie can still use the procedural fallback buddy
- Homie can now try to load a **GLB** avatar from `public/models`
- Homie can now try to load a **VRM** avatar from `public/models`
- there is now a small avatar loader panel in the app
- there is now avatar status so you can see if a model is loading, ready, or failed

## Easy kid version

1. Put your `.glb` or `.vrm` file in:
   - `homie_companion/public/models/`
2. Start Homie Companion.
3. In the avatar loader card, type a path like:
   - `/models/my-homie.glb`
   - or `/models/my-homie.vrm`
4. Click **Load path**.
5. If the file loads, Homie uses the real model.
6. If it fails, click **Use fallback buddy**.

## Easy run

From the repo root you can double-click:

- `RUN_HOMIE_COMPANION_DEV_WINDOWS.bat`

Or from inside this folder:

- `RUN_HOMIE_DEV_WINDOWS.bat`

## Notes

- this pass is mainly the **loader lane**
- final lip sync, facial emotion, and production animation come later
- if your model is missing, the app will stay usable with the fallback buddy


## v10.26.2 bridge wiring

OddEngine can now send live companion events into this app over `http://127.0.0.1:45777`.

### Quick test

1. Start Homie Companion.
2. Start OddEngine.
3. Open **Preferences → Homie Companion Bridge**.
4. Click **Probe companion bridge**.
5. Click **Send warm hello** or **Send alert test**.
6. When OddEngine pushes normal notifications, Homie can now mirror them into this app too.
