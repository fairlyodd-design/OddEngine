v10.34.7_HomieLivingPresenceAndTrueConversationPass

What this pass changes
- gives Homie a stronger front-stage companion layout
- adds living presence states: ready, listening, thinking, speaking, needs attention
- adds hold-to-talk and tap-to-talk mic modes
- adds Space-to-talk support in hold mode and Escape to stop
- keeps browser/system speech for talk-back
- keeps local voice bridge transcription support
- keeps family routing and auto-open best panel
- surfaces last heard text and stronger panel guidance

Files changed
- ui/src/panels/Homie.tsx

Notes
- This is a UI + interaction pass that stays inside the current OddEngine shell shape.
- It does not claim a new avatar engine or true Tolan-grade rendering yet.
- It improves the conversation feel honestly with the tools already present in the app.
