# v10.26.15m_VoiceLaneIsolationAndPromptSanityPass

## Target
Stabilize detached Homie so voice troubleshooting and normal conversation stop contaminating each other.

## What changed
- Added prompt-mode separation:
  - clean chat only
  - rolling memory only
  - panel + host + memory
- Added chat clean mode so old provider warnings and Hear-You Doctor chatter do not steer normal replies.
- Added direct-request priority instructions so simple asks get fulfilled directly instead of being turned into coaching.
- Added transcript-to-reply trace in Hear-You Doctor:
  - heard text
  - prompt mode
  - provider used
- Added isolated voice lane trace:
  - browser STT
  - recording
  - handoff
  - reply
- Updated full Homie settings lane with prompt mode + chat clean controls.
- Defaulted migrated companion settings toward safer clean-chat behavior unless the user explicitly chooses broader panel context.

## Touched files
- ui/src/lib/homieCompanion.ts
- ui/src/components/HomieBuddy.tsx
- ui/src/panels/Homie.tsx
- ui/src/lib/version.ts
- .oddengine_last_ui_version.txt
