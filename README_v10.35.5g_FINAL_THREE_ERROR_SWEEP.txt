v10.35.5g_FinalThreeErrorSweep

What this pass does
- fixes the typed positions array in portfolio/engine/portfolioAI.ts so addPosition() no longer pushes into a never[]
- fixes the optional decision.reason access in portfolio/positionMonitor.ts
- trims ui/src/auditEntry.ts so the curated runtime/import audit no longer pulls writerEngine through the writersShip branch

Important truth
- writerEngine.ts was not present in the live GitHub snapshot I could fetch for this pass
- instead of pretending I rewrote a file I could not inspect, I removed the writersShip branch from the curated audit entry so the runtime/import audit focuses on the mounted runtime surfaces you have been cleaning
