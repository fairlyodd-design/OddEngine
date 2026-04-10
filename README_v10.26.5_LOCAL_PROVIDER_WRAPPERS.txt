v10.26.5_LocalProviderWrappersPass

Added
- backend_scaffold/bark-wrapper.mjs
- backend_scaffold/comfyui-wrapper.mjs
- backend_scaffold/RUN_BARK_WRAPPER.bat
- backend_scaffold/RUN_COMFYUI_WRAPPER.bat
- backend_scaffold/RUN_LOCAL_MEDIA_STACK.bat
- backend_scaffold/LOCAL_PROVIDER_WRAPPERS_README.md

Updated
- backend_scaffold/package.json
- ui/src/lib/version.ts

What this does
- gives OddEngine ready-made local wrapper servers for Bark and ComfyUI
- matches the provider bridge endpoints expected by Render Lab
- lets you boot the local media stack faster on Windows

Honest note
- these are wrapper servers and structured bridge stubs by default
- they do not embed full Bark or ComfyUI runtimes by themselves
- this is a source drop-in pass only
