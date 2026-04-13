# OddEngine Budget Sync Scaffold

This folder gives you two tiny backend examples for the Family Budget sync bridge in OddEngine v10.14.0.

## Routes expected by the app

- `GET /api/health`
- `GET /api/households/:id/snapshot`
- `POST /api/households/:id/snapshot`

## Express

```bash
npm i express
node backend_scaffold/express-snapshot-server.mjs
```

## Fastify

```bash
npm i fastify
node backend_scaffold/fastify-snapshot-server.mjs
```

## Optional env vars

- `PORT=8787`
- `API_PREFIX=/api`
- `BEARER_TOKEN=your-secret`

The scaffold stores one JSON snapshot per household under `backend_scaffold_data/`.
