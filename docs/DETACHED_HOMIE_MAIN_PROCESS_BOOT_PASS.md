# v10.26.14s — Detached Homie Main-Process Boot Pass

## Goal
Make the detached Homie companion open as a real separate Electron window at desktop startup, even when renderer-side preference detection or IPC timing is flaky.

## What changed
- The Electron main process now schedules a Homie Buddy boot after the main shell finishes loading.
- If the main shell is shown again and the buddy window is missing, the main process re-schedules the detached companion boot.
- The renderer keeps the inline buddy out of the main shell whenever detached companion mode is requested on desktop, instead of falling back to inline rendering after a failed launch attempt.

## Result
Detached Homie is now driven by the Electron main process first, with the renderer acting as the control surface instead of the single source of truth for booting the separate window.
