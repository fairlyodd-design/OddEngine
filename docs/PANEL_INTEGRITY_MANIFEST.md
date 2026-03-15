# Panel Integrity Manifest — v10.25.03

This pass tracks the live recovery-branch panel list and keeps those panels represented in shell routing and assistant metadata.

## Live recovery-branch panel list

- `AgentsPanel` — expected from local recovery branch
- `AutonomousScannerPanel` — expected from local recovery branch
- `Autopilot` — present in pack
- `Books` — present in pack
- `Brain` — present in pack
- `Builder` — present in pack
- `Calendar` — present in pack
- `Cameras` — present in pack
- `Cannabis` — present in pack
- `CapitalFlowPanel` — expected from local recovery branch
- `CryptoGames` — present in pack
- `DailyChores` — present in pack
- `DevEngine` — present in pack
- `Entertainment` — present in pack
- `ExecutionEnginePanel` — expected from local recovery branch
- `FamilyBudget` — present in pack
- `FamilyHealth` — present in pack
- `FiftyTo1K` — expected from local recovery branch
- `GalacticMarketSimulatorPanel` — expected from local recovery branch
- `GalacticSimulator` — expected from local recovery branch
- `GroceryMeals` — present in pack
- `Grow` — present in pack
- `GrowControlPanel` — expected from local recovery branch
- `GrowPanel` — expected from local recovery branch
- `HappyHealthy` — present in pack
- `HolographicMarketMapPanel` — expected from local recovery branch
- `Home` — present in pack
- `Homie` — present in pack
- `InsightsPanel` — expected from local recovery branch
- `InstitutionalTraderPanel` — expected from local recovery branch
- `KernelMonitorPanel` — expected from local recovery branch
- `MarketBrainPanel` — expected from local recovery branch
- `MarketGraph` — expected from local recovery branch
- `MarketGraph3DPanel` — expected from local recovery branch
- `MarketGraphPanel` — expected from local recovery branch
- `MarketIntelligencePanel` — expected from local recovery branch
- `MarketMap` — expected from local recovery branch
- `MarketTimeMachinePanel` — expected from local recovery branch
- `Mining` — present in pack
- `MiningRadarPanel` — expected from local recovery branch
- `MissionControl` — expected from local recovery branch
- `MissionControlPanel` — expected from local recovery branch
- `Money` — present in pack
- `MoneyPanel` — expected from local recovery branch
- `NeuralStrategyPanel` — expected from local recovery branch
- `News` — present in pack
- `OddBrain` — present in pack
- `OperatorPanel` — expected from local recovery branch
- `OpportunityRadarPanel` — expected from local recovery branch
- `OptionsSaaS` — present in pack
- `OptionsSniper` — expected from local recovery branch
- `OptionsSniperTerminal` — expected from local recovery branch
- `OrderFlowRadarPanel` — expected from local recovery branch
- `PluginManagerPanel` — expected from local recovery branch
- `Plugins` — present in pack
- `PortfolioAIPanel` — expected from local recovery branch
- `Preferences` — present in pack
- `RiskGuardianPanel` — expected from local recovery branch
- `RoutineLauncher` — present in pack
- `Security` — present in pack
- `SimulatorPanel` — expected from local recovery branch
- `SmartExitPanel` — expected from local recovery branch
- `StrategyEvolutionLab` — expected from local recovery branch
- `StrategyEvolutionPanel` — expected from local recovery branch
- `StrategyLabPanel` — expected from local recovery branch
- `TerminalMainPanel` — expected from local recovery branch
- `TimeMachine` — expected from local recovery branch
- `TradeIdeasPanel` — expected from local recovery branch
- `TradePlannerPanel` — expected from local recovery branch
- `TradeProbabilityPanel` — expected from local recovery branch
- `Trading` — present in pack
- `TradingDeskPanel` — expected from local recovery branch
- `TradingPanel` — expected from local recovery branch
- `VegasPokerCashPromos` — present in pack
- `VegasPokerFeed` — present in pack
- `WorkspacePanel` — expected from local recovery branch
- `WritingPanel` — expected from local recovery branch
- `aBooks` — expected from local recovery branch

## How this pass stays safer

- `ui/src/App.tsx` uses `import.meta.glob("./panels/*.tsx")` so it only lazy-loads panel files that actually exist in the local tree.
- `ui/src/lib/brain.ts` keeps the full recovery-branch panel registry visible to navigation, search, and assistant context.
- If a panel is registered but its file is not present locally, the shell now shows a clear fallback card instead of silently disappearing from the OS surface.

## Best drop-in workflow

1. Pull `recovery/render-worker-bridge-pass` locally.
2. Copy this pack into `C:\OddEngine`.
3. Run `npm --prefix .\ui run build`.
4. Verify key panels from the shell rail and command bar.


## v10.25.03 setup-flow carry-forward note

- rail now shows one clean public-facing panel entry per canonical lane
- alias/duplicate panels stay reachable through normalization without cluttering the rail
- fallback copy for preserved panels was rewritten to read like human workspace descriptions


## v10.25.04 note

This pass keeps the restored panel set intact while adding Homie presence + mission-control state shared by Home, Preferences, and Homie.
