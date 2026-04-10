# v10.26.11h — Homie Output Notes And Approval Pass

This pass upgrades the Story Forge / Render Lab bridge so imported outputs can carry real review notes and real decisions.

## What this pass adds

- Save review notes directly onto imported outputs
- Track output decisions as:
  - approved
  - revise
  - rerender
- Push those decisions through the Story Forge action bridge
- Mirror approval metadata into the local render backend
- Show output decision state in:
  - Books / Story Forge
  - Render Lab queue board
  - Homie Companion bridge card
- Keep Homie quick replies aware of the latest output decision

## Main user-facing upgrades

### Books / Story Forge

- Output review textarea in Finale
- Buttons for:
  - Save output note
  - Approve output
  - Revise output
  - Request re-render
- Imported outputs now show:
  - decision
  - reviewed timestamp
  - note text
- Render jobs now show approval state too

### Homie Companion

- New actions for:
  - Save output note
  - Approve output
  - Revise output
  - Request re-render
- Story Forge bridge card now shows latest output decision / note state
- Render review quick replies are more context-aware

### Local render backend

New endpoint:

- `POST /render/jobs/:id/review`

This stores:

- decision
- note
- reviewedAt
- reviewedBy
- summary

## Honest note

This is still a local-first approval bridge. It does not pretend to be a full remote render farm or remote dailies-review system yet.

## Strongest next move

v10.26.11i_HomieRevisionLoopAndRerenderPrepPass so approval outcomes can automatically shape the next revision checklist, new render packet, and rerender prep flow.
