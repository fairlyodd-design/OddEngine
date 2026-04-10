# v10.26.15m1 Prompt Builder Clean Mode Hotfix

## Goal
Make Homie obey short direct requests first instead of turning them into reflective coaching.

## What changed
- Added direct-request detection for short deliverables like greetings, rewrites, drafts, summaries, and simple commands.
- Added strict command passthrough rules for prompts like "say hello to…" and "write a text to…".
- Added response style gate settings: Direct, Supportive, Companion.
- Clean chat mode now truly strips rolling memory and panel context out of the final prompt recipe.
- Clean mode now sends only a tiny recent chat window, and simple direct requests can go through as the latest user message only.
- Added final prompt recipe trace surfacing in Hear-You Doctor: direct request, support mode, context included.
- Wired the full Homie panel chat to the same guarded companion prompt builder used by detached Homie.

## Touched files
- `ui/src/lib/homieCompanion.ts`
- `ui/src/components/HomieBuddy.tsx`
- `ui/src/panels/Homie.tsx`
- `ui/src/lib/version.ts`
- `.oddengine_last_ui_version.txt`

## Expected result
A prompt like "Say hello to my wife Stacey in a warm, simple way" should return the greeting itself instead of reflective coaching.
