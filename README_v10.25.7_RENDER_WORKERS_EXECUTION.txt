v10.25.7_RenderWorkersExecutionPass

Scope:
- turn Render Lab backend into a true worker executor
- execute media-specific jobs from oddengine:studio:handoff:v1
- keep Studio -> Render Lab handoff model intact

What changed:
- backend worker execution endpoints added
- media worker plans for book/image/audio/video/cartoon/social
- backend writes artifact outputs to backend_scaffold_data/render_outputs
- Render Lab can auto-run or manually run backend workers
- active job now shows worker states and backend artifact outputs

Notes:
- this is a production-safe scaffold executor, not final binary media rendering
- it generates real pipeline artifacts, manifests, briefs, scripts, captions, package files, and publish handoffs
