# v10.26.3c Homie Companion Import Fix Hotfix

This hotfix rebuilds the Homie Companion overlay with the full required source tree so Vite can resolve imports like `./components/AvatarLoaderCard`.

## What was wrong
The previous thin overlay updated `src/App.tsx` but did not include every dependent component file.

## What this fixes
- Restores the full `homie_companion/src/components` tree
- Restores the full `homie_companion/src/scene` tree
- Keeps the blank-window crash catcher from v10.26.3b
- Bumps `homie_companion` version to `10.26.3c`

## Best path
1. Apply this overlay on top of your current OddEngine folder.
2. Run `RUN_HOMIE_PAIR_DEV_WINDOWS.bat` or `RUN_HOMIE_COMPANION_DEV_WINDOWS.bat`.
3. If Vite is already running, stop it first so it picks up the restored files.
