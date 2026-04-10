# v10.26.2_HomieOddEngineBridgeWiringPass

## What this pass does

This is the first real bridge wiring pass between **OddEngine** and the separate **Homie Companion** app.

### Big idea

- OddEngine stays the operator shell
- Homie Companion stays its own desktop app
- OddEngine can now send live bridge events into Homie over localhost

## What changed

- Added `ui/src/lib/homieCompanionBridge.ts`
- Added new Preferences card: **Homie Companion Bridge**
- Added localhost settings for the separate companion app
- Added live notification mirroring from OddEngine into Homie Companion
- Added one-click pair launch scripts
- Added a new bridge event type: `system:notify`

## Kid version

1. Start Homie Companion first
2. Start OddEngine
3. Go to Preferences → Homie Companion Bridge
4. Click **Probe companion bridge**
5. Click **Send warm hello**
6. When OddEngine pushes a normal notification, Homie can react to it too

## Default bridge URL

- `http://127.0.0.1:45777`

## New run helpers

- `RUN_HOMIE_PAIR_DEV_WINDOWS.bat`
- `RUN_HOMIE_PAIR_WEB_WINDOWS.bat`

## Real event lane in this pass

OddEngine notifications now dispatch a browser event and can be mirrored into Homie Companion as `system:notify`.

That means this pass is not just test buttons — it gives you a real live event lane you can grow later into Phoenix alerts, scanner winners, coaching moments, and speech.
