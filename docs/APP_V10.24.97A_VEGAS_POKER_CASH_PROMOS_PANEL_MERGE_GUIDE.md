# App.tsx merge guide for VegasPokerCashPromos

Add a lazy import (or normal import, matching your file style):

```ts
const VegasPokerCashPromos = lazy(() => import("./panels/VegasPokerCashPromos"));
```

Then add the routed panel case wherever your shell switches by panel id:

```tsx
case "VegasPokerCashPromos":
  return <VegasPokerCashPromos />;
```

If your shell maintains a panel registry/list, add the same panel id there too.
