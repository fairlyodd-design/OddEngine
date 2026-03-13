# brain.ts merge guide for VegasPokerCashPromos

Add a PANEL_META entry similar to:

```ts
{
  id: "VegasPokerCashPromos",
  icon: "♠️",
  title: "Vegas Poker Cash",
  sub: "Cash games, promos, and best room tonight",
  section: "LIFESTYLE",
  assistantName: "Homie (Vegas Poker)",
  assistantRole: "Room watch + promos scout",
  description: "Track Vegas poker cash games, promos, and a room-by-room watch list for tonight.",
  quickPrompts: [
    "What is the best room tonight?",
    "Show Wynn and Venetian promo notes.",
    "Which room is best for 1/3 tonight?"
  ],
  storageKeys: ["oddengine:vegasPokerCashPromos:v1"],
  nextSteps: [
    "Check the best-room summary.",
    "Filter to your favorite room.",
    "Copy the markdown room watch if needed."
  ],
  quickActionIds: [],
  actions: [
    { id: "homie", label: "Open Homie", kind: "navigate", panelId: "Homie" },
    { id: "calendar", label: "Open Calendar", kind: "navigate", panelId: "Calendar" }
  ]
}
```
