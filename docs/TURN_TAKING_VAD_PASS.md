# v10.26.15f Turn-Taking / VAD Pass

This pass tightens Homie’s live conversation rhythm so end-of-turn detection feels cleaner, less buttony, and more emotionally present.

## What changed

- cloud speech recognition now uses a shared end-of-turn layer instead of depending only on coarse browser end events
- interim speech gets held long enough for a natural pause, then Homie hands over into thinking / replying more cleanly
- stale cloud recognition callbacks are guarded by per-session tracking so an old turn cannot double-fire a transcript or yank the loop around
- external/local bridge recording now has a lightweight silence detector so Homie can turn your pause into a reply without always needing a second tap
- external bridge resume timing is no longer allowed to reopen listening before Homie actually finishes the reply turn
- detached Homie should now feel more like a steady digital friend: listening, pausing, thinking, and answering in a more human cadence instead of a transactional start/stop pattern
- embodied companion prompt shaping was tuned to reinforce adaptive tone, open-ended dialogue, and grounded emotional continuity without fake romance or drama

## Touched files

- `ui/src/components/HomieBuddy.tsx`
- `ui/src/lib/homieCompanion.ts`
- `ui/src/lib/version.ts`
- `.oddengine_last_ui_version.txt`

## Best test

1. open detached Homie
2. start a voice turn in cloud mode and pause naturally instead of clicking stop right away
3. confirm Homie hands over from listening -> thinking -> replying without a weird dead beat
4. repeat in external/local bridge mode and confirm the recorder stops on your pause instead of always needing a manual finish tap
5. interrupt one reply and immediately talk again to confirm old callbacks do not re-fire the last turn

## Straight truth

This is a lightweight browser-side silence / turn-taking pass, not a studio-grade VAD engine. It should feel more natural than before, but it is still limited by browser audio APIs, device noise, and the external bridge contract.
