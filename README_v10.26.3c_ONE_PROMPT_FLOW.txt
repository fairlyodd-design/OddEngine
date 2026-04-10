v10.26.3c_OnePromptFlowWiredPass

What changed
- added ui/src/lib/onePromptFlow.ts
- wired Books / FairlyOdd Studio into a single 1-prompt orchestration flow
- "1 Prompt → Ship It" now:
  - generates the studio pack
  - saves oddengine:studio:handoff:v1
  - creates a Render Lab job in oddengine:renderlab:jobs:v1
  - creates a Publisher Hub job in oddengine:publisher:jobs:v1
  - optionally auto-publishes it
  - optionally drafts commerce listings from winners
- added a recent One Prompt Flow status card in Studio
- updated version.ts to 10.26.3c

Notes
- source drop-in only
- no Trading files touched
- existing panel architecture preserved
