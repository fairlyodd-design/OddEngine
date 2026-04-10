# Homie Render Queue Board + Output Import Pass

Version: 10.26.11g

## What this pass does

- Gives Story Forge / Render Lab a real local **queue board** instead of only a queued-job note.
- Polls the local render backend for matching project jobs and syncs live job status back into the active Story Forge project.
- Lets Books and Homie trigger:
  - refresh render queue
  - import latest finished output
  - mark output watched / review started
- Imports finished outputs back into Story Forge as both:
  - a structured **imported output record**
  - a local **render output asset** inside the project packet
- Extends the Story Forge bridge snapshot so Homie can see:
  - live queue count
  - completed render count
  - latest imported output
  - whether output review has started
- Upgrades Homie Companion so it can help drive output review from the companion lane.

## Main files changed

- `ui/src/panels/Books.tsx`
- `ui/src/lib/writerVault.ts`
- `ui/src/lib/storyBridge.ts`
- `ui/src/lib/storyActionBridge.ts`
- `homie_companion/src/App.tsx`
- `homie_companion/src/components/CompanionConversation.tsx`
- `homie_companion/src/lib/companionBrain.ts`
- `homie_companion/src/lib/storyBridge.ts`
- `homie_companion/src/lib/storyActionBridge.ts`
- `package.json`
- `ui/package.json`
- `homie_companion/package.json`
- `ui/src/lib/version.ts`

## Honest note

This is a stronger local queue + output review lane. It does **not** pretend there is a full cinematic render engine inside the OS yet. What it does do is make Render Lab feel more real: live jobs can be tracked, finished outputs can be imported back into Story Forge cleanly, and Homie can help you review what came out before the next pass.

## Strongest next move

`v10.26.11h_HomieOutputNotesAndApprovalPass`

That pass should let Homie stamp structured review notes directly onto imported outputs, track approval / revise / re-render decisions, and push clean revision guidance back into the next Story Forge or Render Lab pass.
