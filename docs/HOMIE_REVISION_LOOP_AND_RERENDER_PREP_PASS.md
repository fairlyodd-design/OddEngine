# v10.26.11i — Homie Revision Loop And Rerender Prep Pass

This pass turns output review decisions into real follow-through instead of leaving the next move in the user’s head.

## What changed

- Review decisions now auto-shape a **next-pass packet**.
- The local render backend stamps a `nextPass` block onto reviewed outputs.
- Story Forge stores the active revision loop on the project.
- Approve / revise / re-render now generate:
  - revision checklist
  - re-render notes
  - fresh render prep packet asset
- Homie Companion can trigger:
  - Prep revision loop
  - Prep re-render packet
- Story Forge bridge now exposes next-pass status back to Homie.

## Truth note

This is still a local-first prep lane. It stages better packets and revision guidance, but it does not pretend to fully auto-render a perfect final without the user reviewing the next pass.
