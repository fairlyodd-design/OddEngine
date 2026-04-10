Homie v1.26 — True Voice Bridge + Companion Loop Fix

What this package does:
- starts a local HTTP bridge at http://127.0.0.1:8765
- exposes /health, /status, /ready so OddEngine can detect it cleanly
- exposes /transcribe for local speech-to-text using faster-whisper
- exposes /reply for local companion replies through Ollama
- exposes /speak for local text-to-speech through pyttsx3

Recommended install location:
C:\AI_Homie\Homie_v1.0_MasterCompanionPass\bridge_v1_26

How to install:
1. Create this folder:
   C:\AI_Homie\Homie_v1.0_MasterCompanionPass\bridge_v1_26
2. Copy all files from this package into that folder.
3. Open PowerShell in that folder.
4. Install dependencies:
   pip install -r requirements.txt
5. Make sure Ollama is running locally.
6. Start the bridge:
   RUN_HOMIE_BRIDGE.bat
7. In OddEngine or Homie, set custom bridge URL to:
   http://127.0.0.1:8765
8. Test:
   curl http://127.0.0.1:8765/health

Expected health response:
- status ready or degraded
- engine faster-whisper
- version v1.26

If you already have Ollama installed but not the model, run:
   ollama pull llama3.1:8b

Notes:
- If /health works but /reply fails, Ollama is likely not running.
- If the bridge fails at startup, install requirements first.
- faster-whisper may need ffmpeg available on the system for some audio inputs.
