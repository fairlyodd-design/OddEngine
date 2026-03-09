# Grocery local proxy scaffold

This is a lightweight local-first backend scaffold for the OddEngine Grocery panel.
It matches the UI contract used by `ui/src/lib/groceryDealsProxy.ts`.

## What it does
- Serves a local grocery deals endpoint
- Supports `q` and `stores` filters
- Returns score-ranked deals in the shape the UI expects
- Uses seed JSON now, so you can swap in real scraping/provider code later

## Run it
From this folder:

```bash
npm run grocery-proxy
```

Or on Windows, double-click:

- `RUN_GROCERY_PROXY_WINDOWS.bat`

Default URL:

- `http://127.0.0.1:8787`

## Endpoints

### Health

`GET /health`

### Grocery deals

`GET /grocery/deals?q=chicken&stores=Walmart,Smith's/Kroger`

Response shape:

```json
{
  "updatedAt": "2026-03-09T12:00:00Z",
  "stores": ["Walmart", "Smith's/Kroger"],
  "query": "chicken",
  "deals": [
    {
      "id": "smiths-chicken-001",
      "title": "Digital coupon on family-pack chicken thighs",
      "link": "https://example.local/smiths/chicken-thighs",
      "source": "Smith's/Kroger",
      "store": "Smith's/Kroger",
      "publishedAt": "2026-03-09",
      "summary": "Save $2.00 and stack with meal-prep family pack week.",
      "score": 82
    }
  ]
}
```

## Hook it into the UI
In the Grocery panel, switch source mode to **local proxy** and use:

- Base URL: `http://127.0.0.1:8787`
- Query: your grocery search, like `chicken`, `meal prep`, or `cheap week`

## Upgrade path
Right now this server reads `data/groceryDeals.seed.json`.

Next easy upgrade steps:
1. Add provider modules for stores you care about
2. Swap `loadSeedDeals()` for live provider functions
3. Add deal dedupe and stronger score logic
4. Cache results locally so the panel feels instant

## Environment variables
- `GROCERY_PROXY_PORT` default `8787`
- `GROCERY_PROXY_HOST` default `127.0.0.1`
- `GROCERY_PROXY_CORS_ORIGIN` default `*`
