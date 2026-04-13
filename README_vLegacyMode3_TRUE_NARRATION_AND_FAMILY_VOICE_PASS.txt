vLegacyMode.3 — True Narration And Family Voice Pass

What this pass adds:
- optional spoken narration track for Legacy Mode videos
- family voice label handoff from Writers Lounge into the backend runtime
- local TTS narration generation when a local speech engine is available
- narration muxed directly into the final MP4
- separate narration download in Render Lab
- transcript / narration text artifact saved with the render output
- release pack now includes video, poster, summary, captions, narration audio, and transcript

What is honest about this pass:
- the final artifact is a real MP4 file
- the final artifact can now contain a real spoken narration track
- on Windows, the runtime tries local System.Speech first
- on Linux, the runtime tries espeak if available
- if narration is unavailable, the pipeline still completes safely and tells the truth in the summary

What to do:
1. Drop these files into your OddEngine root and overwrite.
2. Start the backend with RUN_RENDER_BACKEND_LEGACY_MODE.bat.
3. Open Writers Lounge.
4. In Pipeline Launch, leave Family narration on or turn it off.
5. Optionally set a Family voice label.
6. Optionally paste a narration override.
7. Click Legacy Mode ▶ Real Video.
8. Open Render Lab to preview the returned video, narration, poster, summary, and transcript.

Expected final files:
- backend_scaffold_data/render_outputs/<job-folder>/release/final-video.mp4
- backend_scaffold_data/render_outputs/<job-folder>/release/family-narration.wav
- backend_scaffold_data/render_outputs/<job-folder>/release/family-narration.mp3
- backend_scaffold_data/render_outputs/<job-folder>/video/legacy-narration.txt
- backend_scaffold_data/render_outputs/<job-folder>/video/legacy-captions.srt

Best use:
This is the pass that turns a prompt into a family artifact that does not only look preserved — it also speaks.
