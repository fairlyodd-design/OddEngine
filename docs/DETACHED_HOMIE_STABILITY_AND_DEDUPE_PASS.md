# v10.26.15k — Detached Homie Stability And De-Dupe Pass

This pass stabilizes detached Homie so the shell stops feeling haunted while voice, provider, and memory systems update.

## Included
- stale async guards for provider checks and companion turns
- quieter provider health refreshes so status does not flicker through checking as aggressively
- stabilized detached snapshot for arc, routine, provider, transcript, and reply preview text
- de-dupe cleanup for conversation arc and shared routine memory labels
- detached shell debug stamp for turn, provider, transcript, and memory refresh ids
- layout containment and line clamping for detached shell text regions

## Touched files
- ui/src/components/HomieBuddy.tsx
- ui/src/lib/homieMemory.ts
- ui/src/styles.css
- ui/src/lib/version.ts
- .oddengine_last_ui_version.txt
