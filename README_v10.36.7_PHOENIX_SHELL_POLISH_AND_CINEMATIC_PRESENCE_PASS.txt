v10.36.7c_PhoenixShellPolishAndCinematicPresencePass_PathResolutionHotfix

What this fixes:
- PATCH_v10.36.7_PhoenixShellPolishAndCinematicPresencePass.ps1 no longer depends on $MyInvocation.MyCommand.Path always being populated
- script now resolves the repo root using:
  - $PSScriptRoot
  - $PSCommandPath
  - current working directory
  - parent folders as fallback

Use:
1. unzip over C:\OddEngine
2. run RUN_v10.36.7_PhoenixShellPolishAndCinematicPresencePass.bat
3. restart OddEngine
