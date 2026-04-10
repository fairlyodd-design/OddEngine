v10.26.19a_OnePromptToFinalArtifactStudioPass

What this pass adds
- Writers Lounge gets a new default "Magic Studio" tab.
- One prompt can now classify and map a long-form book, cartoon, movie, song, script, or bundle.
- The panel generates a finish-focused blueprint, production stages, deliverables, monetization hooks, and a Homie handoff.
- Active runs can be pushed through autopilot locally and optionally bridged to the live creative backend.

Main files added
- ui/src/lib/artifactClassifier.ts
- ui/src/lib/creationOrchestrator.ts
- ui/src/lib/pipelineFlows/bookPipeline.ts
- ui/src/lib/pipelineFlows/videoPipeline.ts
- ui/src/lib/pipelineFlows/audioPipeline.ts
- ui/src/components/OnePromptStudioPanel.tsx

Main file updated
- ui/src/panels/Books.tsx

Notes
- This is built from the latest uploaded 18c zip-based source state, not an older starter scaffold.
- The pass is designed to preserve the existing freeform workspace direction while making the Writers / Studio lane feel like a futuristic prompt-to-finished-product engine.
