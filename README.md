# OddEngine v10.25.29 — Mainline Truth and Ship Pass

OddEngine is the broader **FairlyOdd OS** for everyday life.

This repo now centers around five big lanes:

- **Home** — mission control / heartbeat
- **Homie** — embodied AI companion
- **Trading** — workstation
- **Family** — grocery, budget, chores, calendar, routines
- **Studio** — creative engine

## Current product direction

### Home
Home is the heartbeat of the OS. It should surface what matters most right now across family life, trading, studio work, and Homie context.

### Homie
Homie is the onboard AI companion. Homie should feel:
- warm
- positive
- helpful
- truthful
- grounded
- family-safe

Homie should be present across the OS without becoming noisy or gimmicky.

### Trading
Trading should feel like a focused workstation, not a wall of duplicated panels. The public-facing trading shape is:

- **Trading Home**
- **Charts + Graphs**
- **Options Chains**

Deeper trading tools can still exist underneath those top-level surfaces.

### Family
The family-life side of the OS should feel connected:

- Grocery Meals
- Family Budget
- Daily Chores
- Calendar
- Routine Launcher

### Studio
Studio is the all-in-one idea → product area inside the larger OS:

- Writing Room
- Director Room
- Music Lab
- Render Lab
- Producer Ops

## Branch roles

Use these branches consistently:

- **main** = public/default branch and ship target
- **recovery/render-worker-bridge-pass** = active forward branch
- **checkpoint/recovery-ui-stable** = rollback / safety line

## Known-good line before this ship pass

The accepted polish line leading into this ship pass includes:

- restored baseline look and feel
- Homie mascot/presence improvements
- Trading consolidation + polish
- Family OS cohesion
- Studio cohesion
- Cross-OS quick actions
- Homie memory/context + pulse
- command/action/status dock
- no-and-then stability/delight polish

## Recommended ship flow

1. Start from your real local `C:\OddEngine`
2. Build locally
3. Click through Home / Homie / Trading / Family / Studio
4. Commit to `recovery/render-worker-bridge-pass`
5. Push recovery
6. Merge recovery into `main`
7. Refresh `checkpoint/recovery-ui-stable` after ship

## House docs

- `OddEngine_WORKFLOW.md`
- `docs/current-state.md`
- `docs/V10.25.29_MAINLINE_TRUTH_AND_SHIP_PASS.md`
- `docs/SHIP_CHECKLIST.md`

## Build

```powershell
cd C:\OddEngine
npm --prefix .\ui run build
```

## Run

```powershell
.\RUN_WINDOWS_DESKTOP.bat
```

```powershell
.\RUN_WINDOWS_WEB.bat
```

FairlyOdd OS for home.
