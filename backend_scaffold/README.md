# OddEngine v10.24.62 — Local Render Backend Scaffold

This is the local backend seam for **FairlyOdd Studio / Render Lab**.

It does **not** natively render full movies, cartoons, or music videos yet.
What it does right now is give OddEngine a real local queue target so the UI can:

- create render jobs
- poll job status
- inspect the queue
- import finished outputs
- hand off later to real workers/providers

## Default URL

`http://127.0.0.1:8899`

## Endpoints

- `GET /health`
- `GET /render/providers`
- `GET /render/jobs`
- `POST /render/jobs`
- `GET /render/jobs/:id`

## What happens on job creation

When you `POST /render/jobs`, the scaffold:

1. writes a queued job JSON file under `backend_scaffold/jobs/`
2. simulates status movement from `queued` → `processing` → `completed`
3. writes a placeholder output file under `backend_scaffold/outputs/`
4. returns that output path on the completed job

## Run on Windows

Double-click:

`RUN_RENDER_BACKEND_WINDOWS.bat`

Or from terminal:

```powershell
cd backend_scaffold
npm run start