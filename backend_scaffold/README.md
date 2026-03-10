# Grocery Deals Proxy Scaffold

This folder contains a lightweight local proxy for the OddEngine Grocery panel.

## Endpoints

- `GET /health`
- `GET /providers`
- `GET /grocery/deals?q=chicken&stores=Walmart,Smith's/Kroger&provider=seed`

## Available providers

- `seed` → local seed JSON for immediate testing
- `mock-coupons` → mock coupon engine with stronger grocery-deal style examples

## Run

```bash
npm run grocery-proxy
```

Or on Windows:

```text
RUN_GROCERY_PROXY_WINDOWS.bat
```

## Default URL

```text
http://127.0.0.1:8787
```

## Switch provider

Use a query parameter from the UI or API:

```text
/grocery/deals?q=cheap%20week&stores=Walmart&provider=mock-coupons
```

Or set an environment variable before launch:

```text
GROCERY_PROXY_PROVIDER=mock-coupons
```

## Expected response shape

```json
{
  "updatedAt": "2026-03-09T12:00:00Z",
  "provider": "seed",
  "providerLabel": "Seed data",
  "stores": ["Walmart", "Smith's/Kroger"],
  "query": "cheap week",
  "deals": [
    {
      "title": "Chicken thighs digital coupon",
      "link": "https://example.com/deal/1",
      "source": "Smith's",
      "publishedAt": "2026-03-09",
      "summary": "Save $2 on family pack chicken thighs",
      "score": 82
    }
  ]
}
```

## Next upgrade path

- add real provider connectors under `providers/`
- keep the same payload contract so the UI keeps working
- add rate limits, caching, and store-specific parsers later


## Store starter lanes

The proxy now ships with starter connectors for Walmart, Smith's/Kroger, Albertsons/Vons, Costco, Target, Amazon Fresh, and Sam's Club. These are starter connectors, not authenticated live scrapers. Use them to test the UI flow, ranking, and route logic before wiring real provider credentials or scraper logic.
