v10.34.6_HomieTrueFamilyGuideAndCompanionPass

What this pass adds
- plain-English family guide routing inside Homie
- suggested-panel card based on the user's question
- optional auto-route into the best panel after a reply
- talk-back voice using browser/system speech synthesis
- mic input using local voice bridge when available
- browser speech-recognition fallback when the bridge is unavailable
- quick family questions for Home / Budget / Grocery / Writers

Important truth
- this is a focused Homie panel pass
- speech output uses the system/browser voice
- mic transcription prefers the existing local voice bridge at http://127.0.0.1:8765
- when the local bridge is unavailable, browser speech fallback is used when supported
- this does not claim a Tolan-quality avatar or presence layer yet; it upgrades Homie into a more real routed voice companion inside the current app
