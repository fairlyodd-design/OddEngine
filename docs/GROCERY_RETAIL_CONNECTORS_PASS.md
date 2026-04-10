# v10.26.6 Grocery Retail Connectors Pass

This pass adds a Grocery Meals connector lane focused on keeping the master list inside OddEngine while handing off matched items to supported retailers.

## Included
- Connect stores card in Grocery Meals
- Smith's/Kroger connect-first lane
- Walmart, Albertsons, Amazon handoff lanes
- Best basket summary at the top
- Per-item actions: Match, Best deal, Open at store, Add to connected cart when the Kroger lane is toggled on
- Amazon affiliate tag field for optional handoff links

## Important
This pass is a UI + workflow scaffold. It does not ship live OAuth/cart APIs yet. Connected-cart currently means OddEngine keeps a local queue so you can prove the flow before real retail API wiring.
