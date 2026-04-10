# v10.26.12a — Global Panel Grid Normalization Pass

This pass takes the earlier cell sizing + theme work and pushes it one level higher:

1. **Whole-panel layout rhythm** is now more consistent across the shell.
2. **Auto-grid sizing** can be controlled globally and per panel.
3. Existing panels get a broader responsive normalization layer without needing a full hand rewrite first.

## What changed

- Added **global auto-grid prefs** for the whole OS:
  - auto-grid on/off
  - target panel cell width
- Added **quick shell controls** in the left rail for:
  - auto-grid toggle
  - cell width narrower / wider
  - reset to default
- Upgraded **FairlyGOD Layout bar** with per-panel controls for:
  - Auto-grid on/off
  - target card width down/up
  - width reset
- Added a **normalization layer** in `styles.css` that makes common dashboard strips breathe better by converting many repeated mini-grid patterns to a more responsive auto-fit layout.
- Added **responsive min-height sizing** to common card/cell patterns so the shell feels less cramped.
- Added **auto span hints** inside `CardGODMode` so larger sections like tables, calendars, device boards, journals, watchlists, and other wide widgets can claim more space when the panel is wide enough.
- Updated the app version to **10.26.12a**.

## Goal

Make the OS feel less like isolated panels with their own spacing rules and more like one unified desktop surface where cells can expand naturally.

## Main files touched

- `ui/src/App.tsx`
- `ui/src/components/CardGODMode.tsx`
- `ui/src/panels/Preferences.tsx`
- `ui/src/lib/prefs.ts`
- `ui/src/lib/version.ts`
- `ui/src/styles.css`
- `.oddengine_last_ui_version.txt`
- `docs/GLOBAL_PANEL_GRID_NORMALIZATION_PASS.md`
- `v10.26.12a_GlobalPanelGridNormalizationPass_CHECKLIST_LIKE_IM_5.md`

## Honest note

A full UI typecheck still stops on the same unrelated syntax problems already present in `ui/src/panels/Plugins.tsx`.

The touched files for this pass were syntax-checked separately and parsed clean.
