# v10.26.14r — Detached Homie Render Repair Pass

This pass hardens detached Homie startup after repeated overlay upgrades left some installs still rendering the inline buddy inside the main shell.

## What changed

- added a stronger one-time desktop migration that forces detached Homie back on
- stores a dedicated `oddengine:homie:force-detached:v10.26.14r` repair key
- main shell now retries detached Homie launch up to 3 times on startup
- inline Homie only stays mounted if the detached launch actually fails
- browser fallback launch now requests the buddy route with `undock=1`

## Why

Some carried-forward installs kept an older `homieCompanionWindow=false` preference in localStorage, which meant the detached launcher could succeed later from buttons while the main shell still kept the inline buddy mounted.

This pass repairs that stale preference path and makes the startup flow more defensive.
