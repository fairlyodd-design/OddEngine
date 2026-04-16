# Trading Chain Containment v10.36.14

## Why this pass exists

The Trading panel was stable until an options chain loaded. Large chain data can trigger a heavy table render, which can cause layout recalculation, scroll fights, and flicker if it is allowed to resize the panel.

## Containment strategy

- Keep chain data in memory, but cap rendered rows.
- Put the contracts table inside a fixed-height internal scroll island.
- Keep loading/error/empty states from collapsing the layout.
- Let filters, search, side, OI, max ask, and strike grouping reveal smaller subsets.
- Preserve existing last-good-chain rendering while new chain loads.

## Expected behavior

When you scan SPY/QQQ/etc:

- The panel should not jump.
- The contracts section should keep the same height.
- The table should scroll internally.
- If more than 120 rows match, a notice appears at the bottom.
- Narrowing filters shows different rows without destabilizing the panel.
