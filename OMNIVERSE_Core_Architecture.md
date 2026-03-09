
# OddEngine v11 — OMNIVERSE Core Architecture

## Goal
Transform OddEngine from a dashboard app into a scalable **plugin platform** capable of supporting thousands of plugins without breaking the UI.

## Core Idea
Move from panel‑to‑panel communication to an **event‑driven architecture**.

Plugins
↓
Capability API
↓
Event Bus
↓
State Graph
↓
UI Renderer

## Omniverse Core

/core/omniverse
- eventBus.ts
- capabilityRegistry.ts
- pluginHost.ts
- stateGraph.ts

All panels, plugins, and AI systems communicate through this layer.

---

## Event Bus

Purpose: global messaging layer.

Example events:

trade.closed
grow.alert
finance.bill_due
market.tick

Panels subscribe to events rather than directly calling each other.

Example:

emit({ type: "trade.closed", payload: trade })

---

## Capability Registry

Security layer for plugins.

Example permissions:

trading.read
trading.execute
grow.read
finance.read
filesystem.write
ai.run

Plugin manifest example:

{
 "name": "options-scanner",
 "capabilities": ["trading.read","ai.run"]
}

---

## Plugin Host

Dynamic plugin loader.

/plugins
- trading
- grow
- mining
- ai-tools
- writing

Plugins export:

activate(context)

Example:

export function activate(ctx){
 ctx.events.on("market.tick", data => {
   // respond to market data
 })
}

---

## State Graph

Centralized system data.

Example state nodes:

state.trading.positions
state.grow.rooms
state.finance.accounts
state.tasks

Panels subscribe to state updates.

---

## UI Renderer Layer

Panels become pure UI renderers.

They subscribe to:

state
events

Example hooks:

useEvent("trade.closed")
useState("finance.balance")

---

## Homie AI

Homie becomes a system orchestrator emitting events.

Example:

emit("scan.market")
emit("grow.capture_reading")
emit("finance.check_bills")

Plugins respond automatically.

---

## Result

OddEngine becomes a scalable plugin OS similar to:

VS Code
Figma
Notion
Raycast
