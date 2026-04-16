# Homie Companion Life Coach v10.36.15

## Goal

Make Homie feel more like a real companion: warm, animated, memory-aware, voice-first, and helpful for daily grounding.

## Voice behavior

Existing mic paths remain:

- browser/cloud Web Speech recognition
- external/local HTTP voice bridge
- push-to-talk
- voice diagnostics
- speech synthesis speaker output

New behavior:

- If spoken text looks like a command, Homie still runs the command router.
- If spoken text sounds conversational, emotional, or coaching-related, Homie answers in companion mode and speaks back.

## Companion prompts

Try:

- “Homie, check in with me.”
- “I feel overwhelmed.”
- “Help me focus.”
- “Help me protect the family legacy today.”
- “Talk to me.”

## Files

- `ui/src/lib/homieCompanionCoach.ts`
- `ui/src/components/HomieBuddy.tsx`
- `ui/src/lib/prefs.ts`
- `ui/src/styles.css`
