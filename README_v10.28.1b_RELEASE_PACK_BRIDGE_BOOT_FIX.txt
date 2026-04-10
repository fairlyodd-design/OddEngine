v10.28.1b Release Pack Bridge Boot Fix

What this fixes
- Download Final Release / Inspect latest render source failing with "Failed to fetch"
- one-click boot now starts BOTH required backends:
  - render-backend.mjs on 8899
  - music-provider-bridge.mjs on 7010

Why it was failing
- the Release Pack buttons talk to the music provider bridge on port 7010
- the previous one-click starter only launched render-backend.mjs and desktop
- result: render could succeed while Release Pack fetches failed

Files in this patch
- START_ODDENGINE_ALL.bat
- backend_scaffold/START_MUSIC_RELEASE_STACK.bat
- ui/src/panels/MusicLab.tsx

How to apply
- unzip into C:\OddEngine
- replace files
- use START_ODDENGINE_ALL.bat from this patch
