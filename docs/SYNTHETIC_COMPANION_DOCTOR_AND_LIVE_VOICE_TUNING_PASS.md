# Synthetic Companion Doctor and Live Voice Tuning Pass

Version: 10.26.15a

What this pass adds:
- Local Ollama doctor lane in the Homie panel
- Start Ollama button from inside Homie
- clearer install/reachability/model diagnostics
- tighter live voice loop behavior in the detached buddy
- barge-in style speech cancel when starting a new voice turn
- provider error handling that stops the voice loop and points the user back to setup

Notes:
- This pass improves the real AI companion runtime path, but Homie still needs a reachable provider to generate live replies.
- For Local Ollama, the fastest path is: start Ollama, pull llama3.1:8b, re-check the lane, then use the voice-first companion preset.
