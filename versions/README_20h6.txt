v10.26.20h6_HomiePresenceAndVoiceShellPass

What changed:
- Added a dedicated Homie Presence Shell at the top of the Homie panel
- Added stable avatar stage using the existing hybrid avatar fallback
- Added provider/voice/stage status lane so Homie feels mounted even before full live voice loop work
- Preserved the safe Rive fallback path from h5c by rendering through the safe wrapper
- Bumped version to 10.26.20h6

Files touched:
- ui/src/components/HomiePresenceShell.tsx (new)
- ui/src/panels/Homie.tsx
- ui/src/styles.css
- ui/src/lib/version.ts
- .oddengine_last_ui_version.txt
