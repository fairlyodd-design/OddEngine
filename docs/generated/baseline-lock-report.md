# App routing audit + trading baseline lock report

Generated: 2026-03-15T02:50:28.199Z
Repo root: `C:\OddEngine`

## Counts

- Panel files: 78
- App registry entries: 78
- App loadable ids: 78
- App switch-case routes: 0
- Brain raw ids: 89
- Brain public ids: 82
- Brain-mentioned panels: 78
- Trading-related panels: 35

## What this audit understands now

- file-backed panels in `ui/src/panels`
- registry-backed panels in `const PANEL_COMPONENTS`
- dynamic `lazyPanel("Name")` wiring
- legacy `case "PanelId":` switch routes when present
- brain raw ids + canonical/public panel ids

## Missing in App registry

- none

## Missing in App loadable ids

- none

## Missing in Brain raw ids

- none

## Missing in Brain public ids

- aBooks
- GrowPanel
- MarketGraphPanel
- MissionControl
- MissionControlPanel
- MoneyPanel
- TradingPanel

## Orphan App registry keys

- none

## Orphan App registry targets

- none

## Orphan Brain raw ids

- brain
- calendar
- home
- homie
- money
- payoff
- prefs
- reports
- routine
- security
- vegas-feed

## Trading panel status

- AutonomousScannerPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- CapitalFlowPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- ExecutionEnginePanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- FiftyTo1K: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=4
- GalacticMarketSimulatorPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- GalacticSimulator: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- HolographicMarketMapPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- InstitutionalTraderPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- MarketBrainPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- MarketGraph: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- MarketGraph3DPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- MarketGraphPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=no, mentions=2
- MarketIntelligencePanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- MarketMap: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=4
- MarketTimeMachinePanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- MiningRadarPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- NeuralStrategyPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- OpportunityRadarPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- OptionsSaaS: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=24
- OptionsSniper: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=4
- OptionsSniperTerminal: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=4
- OrderFlowRadarPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- PortfolioAIPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- RiskGuardianPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- SimulatorPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- StrategyEvolutionLab: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- StrategyEvolutionPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- StrategyLabPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- TimeMachine: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=4
- TradeIdeasPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- TradePlannerPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- TradeProbabilityPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- Trading: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=74
- TradingDeskPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=yes, mentions=2
- TradingPanel: registry=yes, loadable=yes, brainRaw=yes, brainPublic=no, mentions=2

## Canonical override map

- MissionControl → Brain
- MissionControlPanel → Brain
- aBooks → Books

## Alias samples found in brain helpers

- budget
- calendar
- cash games
- cash promos
- chores
- crypto
- daily chores
- family health
- familybudget
- games
- grocery
- health
- healthy
- heat map
- house ops
- household
- local news
- market map
- meal planning
- meals
- medical
- mission control
- options
- options sniper
- planner
- poker
- poker promos
- replay
- saas
- schedule
- sniper
- sniper terminal
- terminal
- time machine
- tournaments
- vegas poker
- weather
- wellness
- zbd

## Next move

Treat this report as the baseline truth source. Restore or re-wire only the panels marked as missing from the App registry or missing from App loadable ids, then re-run the audit before doing another feature pass.
