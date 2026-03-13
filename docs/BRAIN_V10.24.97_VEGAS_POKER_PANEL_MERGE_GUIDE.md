# brain.ts merge guide for Vegas Poker panel

Add a new panel meta entry in your `PANEL_META` map/list.

Suggested entry:

```ts
{ id:"VegasPokerFeed", icon:"♠️", title:"Vegas Poker", sub:"Las Vegas tournaments + series feed", section:"LIFE / LEISURE", assistantName:"Homie (Poker)", assistantRole:"Vegas tournament scout", description:"Track Las Vegas poker tournaments, major series windows, and room-level daily/event lanes.", quickPrompts:["Show me today's Vegas tournaments.","What big series are coming up?","Which low-buy-in NLH events are today?"], storageKeys:["oddengine:pokerVegasFeed:v1"], nextSteps:["Filter by room or buy-in.","Watch the series rail for major events.","Use Copy markdown to save or share the feed."], quickActionIds:[], actions:[{ id:"home", label:"Open Home", kind:"navigate", panelId:"Home" }] },
```
