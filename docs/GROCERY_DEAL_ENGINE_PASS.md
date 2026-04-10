# v10.26.7 Grocery Deal Engine Pass

This pass turns the custom grocery board into a local deal engine.

What it does:
- scores each custom item by shelf price, coupon value, unit price, store-brand swap, and basket fit
- shows smart substitutions
- supports optimizer modes: Cheapest total, Fewest stops, Best coupon stack
- builds a cart-ready action plan by retailer
- shows a savings breakdown compared with a casual trip

What it does not do yet:
- live retailer scraping
- real OAuth cart execution
- live coupon clipping

This is a local planning/decision engine that prepares the best basket for later cart execution passes.
