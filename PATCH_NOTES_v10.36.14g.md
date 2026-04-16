# Patch Notes — v10.36.14g

## Fix

Restores Trading TypeScript compilation after failed v10.36.14 containment patches.

## Key correction

AbortController support was removed from this patch path because the live file drift made it the repeated patch-validation failure point. The existing request-id guard remains in place to ignore stale chain responses.

## Runtime intent

- prevent full options chains from rendering unlimited rows
- keep contracts table capped at 120 rendered rows
- preserve drawer caps
- keep the Trading panel stable while options chain data loads
