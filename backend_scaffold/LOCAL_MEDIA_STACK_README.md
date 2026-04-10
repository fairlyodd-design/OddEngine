Local media stack quick-start

Image: AUTOMATIC1111
- default preset endpoint: http://127.0.0.1:7860
- health path: /sdapi/v1/sd-models
- backend route used: POST /sdapi/v1/txt2img

Audio: Bark / TTS wrapper
- default preset endpoint: http://127.0.0.1:7000
- health path: /health
- backend route used: POST /generate
- expected response: base64/url/text/artifacts style payload

Video: ComfyUI workflow bridge
- default preset endpoint: http://127.0.0.1:8188
- health path: /system_stats
- backend route used: POST /generate
- expected wrapper can translate incoming { provider:"comfyui", workflow, job } into a ComfyUI job

Notes
- this pass makes OddEngine a true executor path instead of package-only
- image generation is directly wired for AUTOMATIC1111
- Bark and ComfyUI are wired as real local provider modes through the provider bridge
- use Render Lab -> Apply local stack presets, then Probe providers
- use Income Autopilot -> Overnight mode to let the scheduler run while you sleep
