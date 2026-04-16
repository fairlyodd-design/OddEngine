# v10.36.15 Homie Companion Life Coach and Voice Presence Pass

This pass turns Homie Buddy into a warmer, voice-first AI companion/life-coach lane while preserving the command router.

## Apply

Extract into `C:\OddEngine`, then run:

```powershell
.\APPLY_v10.36.15_HomieCompanionLifeCoachAndVoicePresencePass.bat
.\RUN_v10.36.15_HOMIE_COMPANION_CHECK.bat
```

## What it changes

- Adds `ui/src/lib/homieCompanionCoach.ts`
- Patches `ui/src/components/HomieBuddy.tsx`
- Patches `ui/src/lib/prefs.ts`
- Appends companion-presence CSS to `ui/src/styles.css`

## What it adds

- Companion life-coach chat lane inside Homie Buddy
- Mic-first conversational routing for non-command speech
- Speaker replies through existing speech synthesis
- Quick buttons: Check in, Focus me, Ground me, Legacy lane, Talk by mic
- Local lightweight memory/history in `localStorage`
- Soft embodied companion styling inspired by friendly non-human AI companion patterns, not a Tolan clone

## Safety / boundaries

Homie stays grounded: supportive companion and life coach, not a licensed therapist, doctor, or financial advisor. Urgent medical, mental-health, legal, or financial decisions still need real-world support.
