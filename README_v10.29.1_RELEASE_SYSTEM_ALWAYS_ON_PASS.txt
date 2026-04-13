
OddEngine v10.29.1_ReleaseSystemAlwaysOnPass

What this patch adds
- START_ODDENGINE_ALL.bat now launches:
  - render-backend.mjs on 8899
  - music-provider-bridge.mjs on 7010
  - desktop UI
- backend_scaffold/START_RELEASE_SYSTEM_ALWAYS_ON.bat for backend-only boot
- Music Lab release pack card now shows live service health:
  - Render backend
  - Release bridge
  - Music runtime
- clearer release-pack failure text when the release bridge is offline

How to apply
1. Unzip this patch.
2. Copy its contents into C:\OddEngine
3. Replace files.
4. Launch with START_ODDENGINE_ALL.bat

Expected result
- No more guessing whether 8899/7010 are alive.
- Music Lab Release Pack card shows green/red status.
- Final Release failures point at the correct missing service when 7010 is down.
