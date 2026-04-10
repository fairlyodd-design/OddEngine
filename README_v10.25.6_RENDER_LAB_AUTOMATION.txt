v10.25.6_RenderLabAutomationPass

What this pass adds:
- dedicated Render Lab panel
- consumes oddengine:studio:handoff:v1
- queues render jobs from Studio handoffs
- runs local package/export flow automatically
- optional lightweight backend scaffold at http://127.0.0.1:8899
- Studio handoff buttons now route to Render Lab instead of Dev Engine

Important:
- this keeps Trading and CardGODMode untouched
- this is a source drop-in pass
- backend scaffold stores render jobs under backend_scaffold_data/render_jobs/
