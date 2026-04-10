# Trading Mounted Sections Rebuild Pass

This pass splits the Trading panel into separate mounted sections so only the active desk lane is alive at once.

Sections:
- Overview
- Source & Chart
- Chain Lab
- Contracts
- Ticket
- Plan

Key changes:
- active section state stored in Trading UI state
- wizard buttons jump between mounted sections instead of scrolling one giant surface
- chart/source, chain lab, contracts/watchlist, ticket, and plan mount independently
- undock query opens the matching mounted section
