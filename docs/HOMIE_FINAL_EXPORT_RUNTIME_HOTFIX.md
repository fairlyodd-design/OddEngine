# v10.26.11l1 Homie Final Export Runtime Hotfix

## What broke

Books / Story Forge referenced two functions during render that were never actually defined in `ui/src/panels/Books.tsx`:

- `prepProjectProviderRoute`
- `finalExportProjectDeliverables`

That made the Writers area crash immediately with a runtime error when the panel loaded.

## What this hotfix adds

- defines the missing provider-route action runner
- defines the missing final-export action runner
- preserves local-first fallback behavior if the render backend is unavailable
- keeps release board, render jobs, imported outputs, and room assets in sync after provider route / final export actions

## Changed files

- `ui/src/panels/Books.tsx`
- `ui/src/lib/version.ts`
- `package.json`
- `ui/package.json`
- `homie_companion/package.json`
- `.oddengine_last_ui_version.txt`
