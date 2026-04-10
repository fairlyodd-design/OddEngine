# v10.26.14b — Detachable Panel Workstation Pass

This pass turns the existing one-off undock plumbing into a shell-wide workstation feature.

## Added
- generic `undockPanel()` path in `ui/src/App.tsx`
- per-panel default popout sizes for trader-style layouts
- `↗` window button on every left-rail panel item
- `↗` window button on favorites items too
- quick workstation action bar under the command bar
  - Pop out this panel
  - Open Trading desk
  - Open Money desk

## Behavior
- Works in Desktop/Electron through `oddApi().openWindow()`
- Falls back to browser `window.open()` in web mode
- Uses persistent `windowType` keys so panel windows remember their bounds in Desktop mode

## Goal
Let the operator build a custom multi-window desk instead of being forced to stay inside one main shell surface.
