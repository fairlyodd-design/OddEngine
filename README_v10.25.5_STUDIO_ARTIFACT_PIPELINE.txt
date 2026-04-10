v10.25.5_StudioArtifactPipelinePass

What changed:
- upgraded Writers Lounge / FairlyOdd Studio into a stronger 1-prompt pipeline
- added full-engine generation mode for book/music/art/video/cartoon/social
- added render/asset/distribution handoff packaging
- added artifact bundle ZIP/folder export
- added pipeline preview with handoff JSON + artifact manifest
- saves studio handoff payload to localStorage for downstream OddEngine lanes

Important:
- this pass does not claim true media rendering is magically complete without the local AI/render backends
- it does produce the finished output pack, render briefs, metadata, captions, hooks, hashtags, and handoff files in one place
