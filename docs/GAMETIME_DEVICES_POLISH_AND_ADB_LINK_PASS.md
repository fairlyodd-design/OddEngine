# v10.26.11y — Game Time Devices Polish And ADB Link Pass

This pass takes the win from the compositor-safe hotfix and moves Game Time into a tighter device-management layout instead of emergency stabilization mode.

## What changed

- Reworked the **Emulator / Devices** section into cleaner mounted lanes
- Added a compact **lane summary row** for Android, iPhone, iPad, and staged handoff status
- Added a dedicated **Staged game handoff** strip with fast lane switching, session start, payout logging, and active-session ending
- Tightened the **Android dock** into:
  - preferred emulator selector
  - staged app action strip
  - new **ADB helper lane** with copyable commands
  - compact Android profile cards
  - cleaner detected-emulator list
- Tightened the **iPhone / iPad sidecar** area into smaller per-device cards with:
  - compact orientation / launch / session status pills
  - faster stage / open / copy / session / payout controls
  - separate metadata controls for name, orientation, and notes
- Fixed an iOS state-write rough edge so launch/session metadata is saved together with the staged lane update instead of being vulnerable to overwrite timing
- Added responsive CSS for the denser device layout so it can collapse more gracefully

## Goal

Make the device area feel like a command deck instead of one tall stacked wall.

## Main files touched

- `ui/src/panels/CryptoGames.tsx`
- `ui/src/styles.css`
- `ui/src/lib/version.ts`
- `package.json`
- `ui/package.json`
- `.oddengine_last_ui_version.txt`
- `docs/GAMETIME_DEVICES_POLISH_AND_ADB_LINK_PASS.md`
- `v10.26.11y_GameTimeDevicesPolishAndADBLinkPass_CHECKLIST_LIKE_IM_5.md`

## Honest note

This is a layout / workflow polish pass built from the files available in this chat. It keeps the compositor-safe direction from 11x and focuses on making Android + iPhone + iPad handoff work cleaner and faster.
