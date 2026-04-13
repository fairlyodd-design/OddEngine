Legacy Mode — real local video pipeline

What this drop-in adds:
- Writers Lounge button: Legacy Mode ▶ Real Video
- Render Lab route restored in the shell
- Publisher Hub route restored in the shell
- Render backend local fallback that creates a real MP4 from a prompt using FFmpeg
- Output folder + artifact inspection flow

What to do:
1. Drop these files into your OddEngine root and overwrite.
2. Start your normal UI.
3. Start the backend with RUN_RENDER_BACKEND_LEGACY_MODE.bat or your existing backend command.
4. In Writers Lounge, pick or create a project.
5. Click Legacy Mode ▶ Real Video.
6. Open Render Lab if needed and inspect the output folder.

Expected final file:
backend_scaffold_data/render_outputs/<job-folder>/release/final-video.mp4

Important truth:
This local fallback generates a real video file from your prompt even without an external video model.
It is scene-card style, honest, and stable.
You can later swap the video lane to ComfyUI or another provider without losing the pipeline.
