v10.27.1_MusicPipelineStabilityPass

What changed
- music-provider-bridge now always writes latest_run.json before and after generation
- generation now always leaves behind real visible artifacts in outputs/* even if adapter execution fails
- python-adapter path now normalizes outputs and writes response.json for UI/debug inspection
- /debug/files now recovers the latest run and returns output + final release visibility data
- /final-release/latest now always returns a valid latest run payload with folder + files + manifest
- /final-release/merge now always assembles a real release folder with track, stems, art, metadata, and packaging files
- release packaging now includes source manifest + source response for easier backend debugging
- Music Lab Inspect button now hits /debug/files
- Music Lab Final Release button now shows clear success/failure text and displays backend response in UI
- no fake success states: backend response drives the UI message

Verified flow target
prompt -> render -> outputs folder -> inspect -> merge -> final release folder

Prepared for next pass
- real audio engine swap (MusicGen / Bark / external APIs)
- waveform rendering polish in UI
- drag-drop final assets into Publisher Hub
