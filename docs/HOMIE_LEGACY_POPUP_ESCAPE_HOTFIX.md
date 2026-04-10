# v10.26.2a — Homie legacy popup escape hotfix

This hotfix fixes the old in-shell Homie buddy popup getting stuck on top with no easy way to move it.

## What changed

- Disabled automatic startup of the old buddy popup.
- The old buddy popup now opens as a **normal movable framed window**.
- The old buddy popup no longer defaults to **always on top**.
- Updated launcher text to make it clear that the popup is the **legacy** lane.

## What to use now

For the real separate companion app, use:

- `RUN_HOMIE_PAIR_DEV_WINDOWS.bat`
- `RUN_HOMIE_COMPANION_DEV_WINDOWS.bat`

The old in-shell popup is still there as a fallback, but it should no longer trap itself above everything.
