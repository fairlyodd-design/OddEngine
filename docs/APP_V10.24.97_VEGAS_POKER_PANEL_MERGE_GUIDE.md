# App.tsx merge guide for Vegas Poker panel

## 1) Add lazy import
Near your other panel lazy imports:

```ts
const VegasPokerFeed = lazy(() => import("./panels/VegasPokerFeed"));
```

## 2) Add renderer case
In the panel switch / render map, add:

```tsx
case "VegasPokerFeed":
  return <VegasPokerFeed />;
```

## 3) Add to panel list if your shell uses a static rail
Use ID:

```ts
"VegasPokerFeed"
```

Label suggestion:
- title: `Vegas Poker`
- icon: `♠️`
