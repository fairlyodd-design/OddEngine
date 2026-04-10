# v10.26.7a Grocery Cart Execution Pass

This pass turns the grocery deal engine into a store-by-store execution lane.

## What changed
- Queue the chosen basket by retailer.
- Separate cart-capable queue items from handoff-only items.
- Build grouped store runs for Walmart, Albertsons, Amazon, and Smith's/Kroger.
- Keep the master grocery list in OddEngine while preparing store actions.

## Notes
- Kroger/Smith's remains the connect-first target for future live cart work.
- Walmart, Albertsons, and Amazon stay as handoff/search lanes in this pass.
