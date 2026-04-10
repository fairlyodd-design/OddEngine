# v10.26.11w — Game Time Android Dock And iOS Real Device Sidecar Pass

This pass upgrades the Game Time panel so it can act like a real command center for crypto-reward game sessions across Android emulator windows and real Apple devices.

## What this pass adds

- New **Emulator / Devices** mounted section in `CryptoGames.tsx`
- Android dock controls for:
  - detecting emulators
  - launching the preferred emulator
  - setting preferred Android profiles
  - opening Play Store pages on device
  - launching staged Android apps
  - installing staged APKs
- Real-device iOS sidecars for:
  - iPhone
  - iPad
- Per-device staging, launch, session start, payout logging, and notes
- Stored device metadata:
  - nickname
  - preferred orientation
  - last launch time
  - last session game
- Expanded sessions and payout logs to capture the active device lane
- New storage compatibility path from earlier crypto-games keys into `oddengine:cryptoGames:v4`

## Why this is the right shape

Windows can manage Android emulators directly through the existing desktop bridge, while real iPhone and iPad devices are better treated as first-class sidecars rather than pretending there is a native iOS emulator lane inside the current shell.

## Main files touched

- `ui/src/panels/CryptoGames.tsx`
- `ui/src/lib/version.ts`
- `package.json`
- `ui/package.json`
- `homie_companion/package.json`
- `.oddengine_last_ui_version.txt`
- `docs/GAME_TIME_ANDROID_DOCK_AND_IOS_REAL_DEVICE_SIDECAR_PASS.md`
- `v10.26.11w_GameTimeAndroidDockAndIOSRealDeviceSidecarPass_CHECKLIST_LIKE_IM_5.md`

## Honest note

This pass wires the local control and tracking surfaces. It does not claim to provide a native iOS emulator inside Windows, and it does not automate gameplay.
