# Trading Three Panel Tighten

This pass reduces public trading rail clutter without deleting the finished trading stack underneath.

## Public top-level panels

1. `TradingPanel` → **Trading Home**
2. `MarketGraphPanel` → **Charts + Graphs**
3. `OptionsSniperTerminal` → **Options Chains**

## Deeper rooms remain installed

Panels such as `Trading`, `TradingDeskPanel`, `MarketGraph`, `MarketGraph3DPanel`, `MarketMap`, `TimeMachine`, `StrategyEvolutionLab`, `StrategyLabPanel`, and related surfaces stay file-backed and app-loadable in the local tree. They are simply hidden from the top-level rail in this pass.
