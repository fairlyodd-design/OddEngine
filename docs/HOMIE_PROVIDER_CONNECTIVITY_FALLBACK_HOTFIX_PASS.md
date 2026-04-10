# v10.26.14y — Homie Provider Connectivity + Fallback Hotfix

This pass tightens Homie provider behavior so the companion stops spraying confusing `fetch failed` errors across dead default providers.

## What changed

- Added friendlier provider-specific error messages
- Local Ollama now explains that it expects `127.0.0.1:11434` and suggests `ollama pull <model>`
- OpenAI-compatible now explains that the default points to a local endpoint and needs a real base URL + API key if used remotely
- Custom bridge now explains that the local bridge must be running
- Auto-fallback no longer tries every default local stub unless that provider was explicitly configured or was the last working provider
- Companion remembers the last working provider and can prefer it during fallback

## Files touched

- `ui/src/lib/homieCompanion.ts`
- `electron/main.cjs`
- `ui/src/lib/version.ts`

## Why

The previous behavior made it look like Homie had a general AI failure when the real issue was usually simpler: none of the local endpoints were running, or the OpenAI-compatible provider still pointed at the default localhost stub.
