# v10.26.13l — Master Setup Wizard Pass

## Goal
Enter real operator info once, then push it into the right vault/default/panel stores automatically.

## What shipped
- New `MasterSetupWizard` component inside Preferences.
- New `masterSetup.ts` store/helpers.
- One-click apply flow that:
  - saves a reusable master setup draft
  - merges it into the secure/local operator vault
  - merges it into Preferences defaults
  - hydrates panel stores for Trading, Mining, Grow, Cameras, and Routine Launcher
- Load-current action to reverse-hydrate the wizard from existing vault + prefs.

## Main files
- `ui/src/components/MasterSetupWizard.tsx`
- `ui/src/lib/masterSetup.ts`
- `ui/src/panels/Preferences.tsx`
- `ui/src/lib/version.ts`

## Notes
This pass intentionally keeps the wizard inside Preferences so setup feels like part of the core OS, not a throwaway modal.
