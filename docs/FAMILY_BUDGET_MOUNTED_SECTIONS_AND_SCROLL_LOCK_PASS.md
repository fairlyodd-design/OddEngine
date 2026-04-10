# v10.26.11u Family Budget Mounted Sections And Scroll Lock Pass

## Goal
Kill the last major panel-glitch class in Family Budget by rebuilding it like the stabilized Trading desk:
- mounted sections instead of one giant live surface
- each section owns its own vertical scroll container
- horizontal overflow stays local to tables/cards
- shell width is guarded so the panel cannot drift sideways

## What changed
- Added mounted Family Budget sections:
  - Overview
  - Income
  - Bills
  - Subscriptions
  - Debt / Goals
  - Notes / Planner
- Added section persistence:
  - `oddengine:familyBudget:section:v1`
- Kept legacy tab storage/action compatibility by mapping section -> legacy tab internally.
- Rebuilt Family Budget rendering so only the active section mounts.
- Wrapped wide tables in local horizontal scroll containers.
- Added mounted-section viewport styles and width guards.

## Files changed
- `ui/src/panels/FamilyBudget.tsx`
- `ui/src/styles.css`
- `ui/src/lib/version.ts`
- `package.json`
- `ui/package.json`
- `homie_companion/package.json`
- `.oddengine_last_ui_version.txt`

## Honest note
This is a source/drop-in stabilization pass. It was syntax-checked, but not run as a full installed-dependency desktop build in the container.
