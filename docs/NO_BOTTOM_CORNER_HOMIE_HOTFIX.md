# NoBottomCornerHomie Hotfix

This hotfix keeps the **floating Homie** and removes the **bottom-corner Lil Homie mascot**.

## What it patches
- `ui/src/App.tsx`
  - removes the `LilHomieAgent` import
  - removes any `<LilHomieAgent ... />` render line or block
- `ui/src/styles.css`
  - adds a CSS backup kill-switch to hide the mascot if it still mounts somewhere else

## How to use
1. Copy the contents of this zip into your repo root, for example:
   - `C:\OddEngine`
2. Run:
   - `RUN_NO_BOTTOM_CORNER_HOMIE_HOTFIX_WINDOWS.bat`
3. Then build:
   - `npm --prefix .\ui run build`

## Result
- floating Homie stays
- bottom-corner mascot disappears
- standalone Homie view is untouched
