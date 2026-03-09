
# Platform Systems for OddEngine v11

These systems transform OddEngine into a real SaaS‑grade platform.

## 1. Plugin SDK

/omniverse-sdk

- plugin.ts
- events.ts
- panels.ts
- storage.ts

Example plugin:

import { definePlugin } from "@oddengine/sdk"

export default definePlugin({
 name: "options-scanner",

 activate(ctx){
   ctx.events.on("market.tick", (tick)=>{
     if(tick.symbol==="NVDA"){
       ctx.ui.notify("NVDA move detected")
     }
   })
 }
})

SDK provides access to:

events
state
ui
storage
ai
notifications

---

## Plugin Capabilities

Plugins request permissions.

Examples:

trading.read
trading.execute
grow.read
finance.read
filesystem.write
ai.run

---

## 2. Automation Engine

Event‑driven rule system.

Example rule:

createRule({
 trigger: "trade.closed",
 actions: [
  "update.finance",
  "log.trade",
  "notify.user"
 ]
})

Grow automation example:

createRule({
 trigger: "grow.alert",
 actions: [
  "notify.phone",
  "log.grow_event",
  "ai.analyze_room"
 ]
})

---

## 3. Sync Engine

Multi‑device state synchronization.

/core/sync

- syncClient.ts
- syncServer.ts

State nodes synced:

state.trading
state.grow
state.tasks
state.finance

User workflow:

Desktop
↓
OddEngine Sync
↓
Cloud State
↓
Laptop / Phone / Tablet

---

## Optional Cloud Features

shared dashboards
team trading workspaces
grow collaboration
family finance dashboards

---

## Final Architecture

OddEngine UI
↓
Omniverse Core
↓
Event Bus
State Graph
Capability System
↓
Plugin Host
Automation Engine
Sync Engine
↓
Plugins

Scales to thousands of plugins.
