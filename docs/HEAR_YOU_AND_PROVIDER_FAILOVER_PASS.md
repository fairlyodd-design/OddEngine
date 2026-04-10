# v10.26.15j — Hear You and Provider Failover Pass

This pass tightens the gap between “Homie heard me” and “Homie could actually answer.”

## What changed

- added a **provider health** lane inside detached Homie
- added **Check provider** and **Typed smoke test** buttons
- surfaced a **hard provider offline / failover ready** badge in the detached companion lane
- added **last transcript preview** and **last reply preview** so voice intake and provider reply can be separated quickly
- improved **provider failover surfacing** when the selected provider is down but an alternate lane can answer
- cleaned up **stale provider warnings** so old failures do not keep the stage stuck in needs-provider forever
- normalized **conversation arc / shared routine** memory strings so they do not duplicate labels like `Conversation arc: Conversation arc:`

## Best test flow

1. open detached Homie
2. open **Voice diagnostics**
3. hit **Check provider**
4. hit **Typed smoke test**
5. do a short voice turn
6. compare:
   - last transcript preview
   - last reply preview
   - provider status badge

## Expected outcomes

- if Homie heard you but the provider is down, transcript preview should update while reply preview shows no reply
- if Ollama is down but another configured provider is ready, Homie should show **Failover → ...** instead of looking dead
- if the provider comes back, the stage should recover without an old warning message pinning it in needs-provider
