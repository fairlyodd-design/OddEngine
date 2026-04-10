v10.26.20f_CameraLiveBackendBridgeAndMotionEventsPass

What this pass adds
- camera live bridge preferences in the Cameras panel
- RTSP auto-relay preview routing seam for browser-playable HLS/MJPEG
- bridge health probe wired into the system truth spine
- motion event lane wired into notifications, system events, and receipts
- backend_scaffold/camera-live-bridge-starter.mjs starter for local bridge work

Important
- This pass creates the real integration seam and UI behavior.
- The starter backend reports health and accepts motion events, but it does not transcode RTSP by itself.
- For real live playback, replace the starter relay endpoints with go2rtc / ffmpeg / Frigate / Shinobi backed endpoints.
