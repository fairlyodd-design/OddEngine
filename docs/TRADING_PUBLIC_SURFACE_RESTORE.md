# Trading public surface restore

This pass restores the trading/chart rooms that were still present in the local codebase and app registry but were getting collapsed out of the public Brain/rail surface.

## Restored public destinations

- MarketGraphPanel
- TradingPanel

## Kept intact

- MarketGraph
- MarketGraph3DPanel
- MarketMap
- MarketTimeMachinePanel
- TimeMachine
- OptionsSniper
- OptionsSniperTerminal
- StrategyEvolutionLab
- StrategyLabPanel
- TradePlannerPanel
- TradingDeskPanel
- Trading

## Scope

This pass does not rewrite App routing. The routing audit already showed the trading stack was file-backed, registry-backed, and loadable. This pass only restores public Brain exposure and clearer panel copy for the finished trading rooms that should stay live in the shell.
