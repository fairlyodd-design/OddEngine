v10.26.4_TrueExecutorLocalMediaStackPass

What changed
- Render backend supports provider modes:
  - a1111
  - bark
  - comfyui
  - webhook
  - stub
- Render Lab now has local stack preset buttons
- Render Lab auto-polls backend jobs and auto-runs pending workers when autoExecuteWorkers is enabled
- Income Autopilot now has Overnight mode with quiet-hour controls
- Added backend_scaffold/LOCAL_MEDIA_STACK_README.md

Important note
- source drop-in only
- image generation is directly wired for AUTOMATIC1111 txt2img
- Bark and ComfyUI expect local wrapper endpoints that answer /generate
- no Trading files touched
