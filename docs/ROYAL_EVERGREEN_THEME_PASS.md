# v10.26.12b — Royal Evergreen OS Theme Pass

This pass adds a new whole-OS theme built around the requested palette:

- **gold** accents
- **green** glow and panel energy
- **grey / charcoal** shell background
- **purple** secondary highlights

## What changed

- Added a new shell theme: `royal-evergreen`
- Added the theme to:
  - the left rail **Look + fit** quick switcher
  - **Preferences → Desktop Mode**
- Updated shell-level backgrounds so the palette reaches beyond simple token swaps:
  - overall shell backdrop
  - left rail
  - main workspace
  - brand card
  - standard cards
  - buttons
  - inputs / selects / textareas
- Changed the default shell theme to **Royal Evergreen** for new installs
- Added a one-time migration for existing installs that were still using the untouched old default theme

## Goal

Make the whole OS feel more regal, grounded, and custom — less blue/cyan neon, more FairlyOdd gold + green with a purple finish.

## Main files touched

- `ui/src/App.tsx`
- `ui/src/lib/prefs.ts`
- `ui/src/panels/Preferences.tsx`
- `ui/src/lib/version.ts`
- `ui/src/styles.css`
- `BUILD_NOTES.txt`
- `docs/ROYAL_EVERGREEN_THEME_PASS.md`

## Honest note

This pass updates the OS theme system and shell styling only. The broader project still contains unrelated existing syntax issues in `ui/src/panels/Plugins.tsx`, which were not part of this theme pass.
