# Homie Memory + Story Room Bridge Pass

Version: 10.26.11e

## What this pass adds

- Homie Companion now reads a local Story Forge bridge snapshot.
- Books / Writers publishes the active creative project, active room, next room, resume point, and latest preview asset into that bridge.
- Homie chat now stays aware of the current creative lane and can answer room-aware prompts like:
  - Guide the active room
  - What should we build next?
  - Recap the project
- Books adds a visible Homie bridge card so you can sync the current room, ask Homie about this room, or jump straight into the next room with a live creative cue.
- Homie Companion shows a Story Forge bridge card above chat when a project is synced.

## Main changed files

- homie_companion/src/App.tsx
- homie_companion/src/components/CompanionConversation.tsx
- homie_companion/src/lib/companionBrain.ts
- homie_companion/src/lib/storyBridge.ts
- homie_companion/src/styles.css
- ui/src/panels/Books.tsx
- ui/src/lib/storyBridge.ts
- ui/src/lib/version.ts
- package.json
- ui/package.json
- homie_companion/package.json

## Honest truth

This pass uses a local-first storage bridge. It is meant to be lightweight and practical, not a pretend cloud memory system. It should work well when the UI and Homie Companion share the same local profile/runtime lane, but it is still a local bridge seam rather than a fully remote synced service.

## Best next move after this

v10.26.11f_HomieStoryActionsAndRenderBridgePass

That pass should let Homie trigger Story Forge actions directly, stamp room notes back into projects, and hand creative packets toward Render Lab more actively.
