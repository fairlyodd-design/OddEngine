# v10.36.87_HomieCloneProfileStudioAndMemoryIngestionPass

## Why

You asked for `v10.36.87_HomieCloneProfileStudioAndMemoryIngestionPass`.

This pass extends the clone-design lane from v10.36.86 into two practical directions:
- **memory ingestion**
- **Studio/Writers export**

## What this pass does

Touches only:
- `backend_scaffold/homie-neural-voice-bridge.mjs`
- `backend_scaffold/homie_clone_profile.v1.json`
- `backend_scaffold/homie_clone_memory_bank.v1.json`
- `backend_scaffold/homie_clone_ingest_drop/*`
- root runner/test/ingest/export helper files
- pass scripts

Does not touch:
- Trading
- CardGODMode
- Writers Lounge UI
- layout system
- existing mic/STT bridge
- existing launcher

## New bridge endpoints

On `127.0.0.1:8776`:

- `GET /memory-bank`
- `POST /ingest-memory`
- `POST /build-studio-pack`

Existing:
- `GET /health`
- `GET /doctor`
- `GET /clone-profile`
- `POST /clone-profile`
- `POST /preview`
- `POST /speak`
- `GET /last-request`

## What you get

- a **memory bank JSON**
- local memory ingestion helpers
- clone-aware preview shaping with memory blend summary
- Studio export pack with:
  - clone profile snapshot
  - memory bank snapshot
  - memory digest
  - Studio clone prompt
  - system guardrails
  - Writers seed file

## Honest status

This still does **not** pretend to be a perfect AI clone.

It is a grounded design pass:
- profile + tone + priorities
- ingested memories
- exportable Studio seed materials
- optional neural voice proxy later if you set `HOMIE_NEURAL_TTS_ENDPOINT`

## Run from `C:\OddEngine`

```powershell
Expand-Archive -Force "$env:USERPROFILE\Downloads\v10.36.87_HomieCloneProfileStudioAndMemoryIngestionPass.zip" C:\OddEngine

cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\APPLY_v10.36.87_HomieCloneProfileStudioAndMemoryIngestionPass.ps1
powershell -ExecutionPolicy Bypass -File .\CHECK_v10.36.87_HomieCloneProfileStudioAndMemoryIngestionPass.ps1
```

## Start the bridge

```powershell
cd C:\OddEngine
.\RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.87.bat
```

## Test it

```powershell
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\TEST_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.87.ps1
```

## Drop-folder memory ingestion

Put your notes/files in:

`C:\OddEngine\backend_scaffold\homie_clone_ingest_drop`

Then run:

```powershell
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\INGEST_HOMIE_CLONE_DROP_FOLDER_v10.36.87.ps1
```

## Export a Studio pack

```powershell
cd C:\OddEngine
powershell -ExecutionPolicy Bypass -File .\EXPORT_HOMIE_CLONE_STUDIO_PACK_v10.36.87.ps1
```

That creates a fresh folder under:

`C:\OddEngine\backend_scaffold\homie_clone_studio_exports`