# v10.26.12i Trading Full Width Charts and Chain Layout Hotfix Pass

## Goals
- Make the trading charts feel like the calendar board: wide, central, and easier to read.
- Reduce the blank/gappy layout that shows up after loading an options chain.
- Keep the fix scoped to Trading without rewriting the whole panel tree.

## What changed
- The main TradingView chart now claims full width.
- The Public source / expiration flow card also stacks at full width under the chart.
- The strike/premium curve and open-interest bars now render as full-width cards.
- The outer shell auto-grid no longer tries to re-grid the entire Trading root.
- Trading containment was relaxed from `layout paint` to `layout` to avoid some Electron repaint weirdness when the chain view expands.

## Files touched
- `ui/src/panels/Trading.tsx`
- `ui/src/styles.css`
- `ui/src/lib/version.ts`

## Caveat
This workspace still carries earlier synthetic-source quirks, so this pass was kept narrow and layout-focused.
