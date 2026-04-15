v10.36.6_HomiePhoenixRecoveryGuideAndStatusVoicePass

What this pass does
- patches ui/src/panels/Homie.tsx in place
- adds a Phoenix recovery + voice status card near Homie AI Status
- adds live voice badges from ui/src/lib/voice.ts
- adds calmer recovery guidance based on Desktop mode, DevEngine issues, Ollama status, and voice-lane health
- adds one-tap actions for recovery chat, voice status chat, start/stop voice, Preferences, and current panel routing

Why this is safer
- does not overwrite the whole repo copy of Homie.tsx
- applies only to the Homie panel
- keeps earlier Home/Homie daily-truth work intact

Install
1. Unzip over C:\OddEngine
2. Run RUN_v10.36.6_HomiePhoenixRecoveryGuideAndStatusVoicePass.bat
3. Restart OddEngine
