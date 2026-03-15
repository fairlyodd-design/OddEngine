# Current State

## High-level shape

OddEngine is now organized around five major lanes:

- **Home** — heartbeat / mission control
- **Homie** — embodied AI companion
- **Trading** — workstation
- **Family** — daily-life management
- **Studio** — creative engine

## Current accepted UX direction

### Home
Home should feel like the center of the OS:
- status
- next actions
- family heartbeat
- trading pulse
- studio pulse
- Homie check-ins

### Homie
Homie should feel:
- present
- warm
- grounded
- truthful
- helpful
- family-safe

Homie should act like a companion, not a noisy mascot.

### Trading
Public-facing trading should stay tight:
- Trading Home
- Charts + Graphs
- Options Chains

Deeper rooms can remain behind those surfaces.

### Family
The family lane should feel connected:
- Grocery Meals
- Family Budget
- Daily Chores
- Calendar
- Routine Launcher

### Studio
The creative lane should feel pipeline-driven:
- Idea
- Write
- Direct
- Score
- Render
- Ship

## Ship posture

This repo should now be treated as:

- **recovery/render-worker-bridge-pass** = active forward line
- **main** = public ship line
- **checkpoint/recovery-ui-stable** = rollback line

## Mainline recommendation

Before the next big feature pass:
1. build locally
2. click through the big five lanes
3. commit recovery
4. push recovery
5. merge to main
6. checkpoint after validation
