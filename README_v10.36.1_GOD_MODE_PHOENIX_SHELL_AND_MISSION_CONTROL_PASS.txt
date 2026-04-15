v10.36.1_GodModePhoenixShellAndMissionControlPass

What this pass does
- lifts the shell itself into a stronger God Mode Phoenix lane
- adds a top-level Phoenix strip under the shell summary
- shows:
  - What matters now
  - Family lane
  - Operator lane
  - Do this next
- adds one-tap quick routes for:
  - Home
  - Homie
  - OddBrain
  - Money
  - FamilyBudget
  - Calendar
  - News
- keeps the existing shell and panel loading behavior intact

Install
- unzip over your OddEngine root
- run RUN_v10.36.1_GodModePhoenixShellAndMissionControlPass.bat
- restart the app

Changed surface
- ui/src/App.tsx (patched in place)

Notes
- this pass reads from the already-existing operator brain snapshot
- it is intentionally a shell lift, not a broad panel rewrite