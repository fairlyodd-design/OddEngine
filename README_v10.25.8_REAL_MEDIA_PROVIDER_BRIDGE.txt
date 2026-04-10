v10.25.8_RealMediaProviderBridgePass

- Render backend now supports real provider bridge config for image/audio/video workers
- New backend endpoints: GET /providers, POST /providers, POST /providers/probe
- Render Lab UI now has provider bridge settings for image/audio/video
- Workers can POST to provider /generate endpoints and persist returned base64 files, URLs, or text outputs
- If providers are disabled, packaging still works as before
