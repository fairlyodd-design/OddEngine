# v10.25.11 — Trading Workspace Polish Pass

This is a **safe overlay** for the tighter 3-panel Trading surface.

## Goal

Keep Trading exposed as 3 strong public workspaces while making them feel more intentional:

- **Trading Home**
- **Charts + Graphs**
- **Options Chains**

## What this pass changes

- upgrades the public-facing trading panel names in `brain.ts`
- replaces generic preserved-panel copy with real trading workspace descriptions
- sharpens the assistant roles and quick prompts for the 3 trading surfaces
- keeps deeper trading/chart/options rooms intact underneath the shell

## Why this is safe

This overlay does **not** rewrite your local trading panel files.
It only tightens the shell/brain presentation layer so your current local build keeps its deeper finished rooms.

## Expected feel after copy

- the rail and panel picker read cleaner
- trading surfaces feel more premium and less placeholder-heavy
- `Trading Home` reads like the command center
- `Charts + Graphs` reads like the visual confirmation workspace
- `Options Chains` reads like the execution/contract desk

## Local check

After copying this overlay into `C:\OddEngine`, run:

```powershell
cd C:\OddEngine
npm --prefix .\ui run build
```

Then click:

- Trading Home
- Charts + Graphs
- Options Chains

## Notes

This pass intentionally avoids another structural trading rewrite.
It is the polish layer on top of the tighter 3-panel shape.
