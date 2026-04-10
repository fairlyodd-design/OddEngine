# v10.26.14g Homie Panel Syntax Hotfix Pass

This hotfix repairs a syntax break introduced in the provider switchboard pass.

## Fix
- removed an accidental duplicate `setBusy(false)` tail and extra closing braces in `ui/src/panels/Homie.tsx`

## Result
- Vite build no longer fails on `Unexpected "}"` in the Homie panel
- desktop dev and production build can continue loading the provider switchboard UI

## Validation
- esbuild transpile parse check passed for `ui/src/panels/Homie.tsx`
- esbuild transpile parse check passed for `ui/src/App.tsx`
- `node --check` passed for `electron/main.cjs`
