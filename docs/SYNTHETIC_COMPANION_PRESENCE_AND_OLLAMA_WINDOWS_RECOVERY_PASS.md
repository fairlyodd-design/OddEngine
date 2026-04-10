# v10.26.15b Synthetic Companion Presence And Ollama Windows Recovery Pass

What changed
- Hardened Ollama discovery in Electron so Homie can find the binary from common Windows install locations instead of relying only on PATH.
- Added a background model-pull action for the selected Ollama model from the Homie panel.
- Added a synthetic companion preset that flips Homie into a more voice-first detached companion setup.
- Added smoother presence states in the detached companion shell: warming up, listening, thinking, talking, celebrating, and needs provider.
- Passed richer presence state into the hero shell so the avatar feels less stiff during live back-and-forth.

Truthful scope
- This pass improves presence and provider recovery, but it still needs a reachable AI provider. If Ollama is not installed or not running, Homie still cannot produce real model replies yet.
