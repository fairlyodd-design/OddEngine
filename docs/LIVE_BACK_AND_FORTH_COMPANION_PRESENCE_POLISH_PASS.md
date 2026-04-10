# v10.26.15c Live Back-And-Forth Companion Presence Polish Pass

What changed
- Smoothed the detached Homie voice loop so it waits for real speech completion before auto-resuming the next listening turn.
- Stopped reading out noisy status lines like "Heard:" and "Listening" during normal voice turns, which makes back-and-forth feel more natural.
- Added safer interruption handling so starting a new turn clears pending auto-resume timers and cancels stale speech first.
- Smoothed the hero stage shell with a light display-stage settle so listen / think / talk transitions feel less jittery.
- Tuned Lil Homie 3D with warmer listen/warmup posture, more expressive viseme pulsing, and stage-aware blink timing.
- Tightened the embodied companion prompt so replies feel more like a present back-and-forth instead of a mini speech.

Truthful scope
- This pass improves timing, presence, and avatar sync, but it still depends on a reachable provider and whatever latency that provider introduces.
- It is a source-level polish pass, not a claim of a full dependency-installed production build.
