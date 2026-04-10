# v10.26.11k — Homie Distribution And Release Board Pass

This pass turns the publish packet into a true release board.

## What it adds

- Story Forge **Release Board** lane inside Finale
- release board data model with:
  - platform checklists
  - teaser assets
  - metadata blocks
  - tracked final output files
  - launch tracker
- Homie bridge sync for release-board context
- Homie Companion **Prep release board** action
- local render backend endpoint:
  - `POST /render/jobs/:id/release-board`
- placeholder final-output file generation so release assets have grounded local paths instead of UI-only labels

## Core behavior

1. Approve a render output.
2. Prep the publish packet.
3. Prep the release board.
4. Story Forge fans the approved answer into:
   - platform lanes
   - teaser asset plan
   - metadata blocks
   - final output files
5. Homie can now talk through release prep from the companion lane.

## Honest scope

This pass creates a strong **local-first release board** and **placeholder final output files** for the current render backend seam.
It does **not** pretend to be a full real-world storefront uploader or cloud distributor yet.
