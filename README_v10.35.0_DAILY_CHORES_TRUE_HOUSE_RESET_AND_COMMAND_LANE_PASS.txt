v10.35.0_DailyChoresTrueHouseResetAndCommandLanePass

What this pass adds
- Daily Chores becomes a true house reset / outdoor / animals command lane
- one shared source of truth for open chores and next must-do items
- Home now surfaces the chores board in the family front door
- Homie now sees the chores board in chat context and can route the family better

Files included
- ui/src/lib/dailyChoresCommand.ts
- ui/src/panels/DailyChores.tsx
- ui/src/panels/Home.tsx
- ui/src/panels/Homie.tsx

Install
- unzip over your current OddEngine root
- overwrite when prompted
- restart the app

Notes
- this pass preserves the existing localStorage key oddengine:dailyChores:v1
- Daily Chores now emits oddengine:daily-chores-changed so Home and Homie can react immediately
- transpile checks were run on the changed files individually
