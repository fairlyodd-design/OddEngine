# Homie Interrupt And Barge-In Pass

Version: 10.26.11c

This pass upgrades the 10.26.11b continuous voice loop so Homie can hand the turn back faster and feel more conversational during talk-back.

## What changed

- added a live cut-in lane while continuous voice chat is active
- starts a lightweight microphone activity watcher while Homie is speaking
- stops browser speech synthesis when the user cuts in and reopens recognition quickly
- adds a manual **Interrupt now** button during active talk-back
- improves turn timing with clearer “your turn” handoff states between speech and listening
- adds cut-in state badges in the chat toolbar, presence strip, and scene voice bubble

## Honest notes

- this is still a browser/Electron speech lane, not a full duplex cloud voice backend
- natural cut-in depends on microphone permission and `getUserMedia` being available in the current Chromium build
- if live cut-in monitoring is blocked, continuous voice chat still works and the manual interrupt button remains available
