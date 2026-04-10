# v10.26.11b Homie Continuous Voice Loop Pass

This pass upgrades Homie from a one-shot voice lane into a cleaner continuous back-and-forth lane.

## What it adds
- Start voice chat button that opens a continuous mic loop.
- Automatic mic re-arm after Homie finishes talking back.
- Clear End voice chat exit so the open mic is always easy to shut off.
- Voice bubble badge showing when the open mic loop is active.
- Retry handling for common browser-recognition hiccups like no-speech or aborted events.
- One-shot Talk once lane still available for simpler voice use.

## Important truth
This is still the local browser voice lane. It is more natural now, but it is not pretending to be a full realtime cloud voice stack. Recognition still depends on what the Chromium/Electron build exposes at runtime.
