# Trading Panel Audit

This document is the house note for the trading-only audit restore.

## Goal

Keep finished trading rooms live in the shell until a later intentional redesign happens. Do not hide, consolidate, or alias-map them away just to make the rail look smaller.

## Keep live

### Core trading
- Trading
- TradingPanel
- TradingDeskPanel
- TradePlannerPanel
- TradeIdeasPanel
- TradeProbabilityPanel
- TerminalMainPanel
- ExecutionEnginePanel
- OperatorPanel
- SimulatorPanel
- SmartExitPanel

### Charts and map
- MarketGraph
- MarketGraphPanel
- MarketGraph3DPanel
- MarketMap
- HolographicMarketMapPanel
- MarketTimeMachinePanel
- TimeMachine

### Options and sniper
- OptionsSniper
- OptionsSniperTerminal
- OptionsSaaS

### Strategy and intelligence
- StrategyEvolutionLab
- StrategyEvolutionPanel
- StrategyLabPanel
- NeuralStrategyPanel
- MarketBrainPanel
- MarketIntelligencePanel
- OpportunityRadarPanel
- OrderFlowRadarPanel
- AutonomousScannerPanel
- InstitutionalTraderPanel
- PortfolioAIPanel
- RiskGuardianPanel

## Rule for future passes

If a trading tool is already a finished room in the local tree, prefer keeping it visible and grouped clearly over redirecting it into another panel.
