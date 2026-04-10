# Provider Setup Wizard + Embodied Companion Tuning Pass

Version: 10.26.14z

## What changed

- added a provider setup wizard to the Homie panel
- wizard can walk one lane at a time:
  - Local Ollama
  - OpenAI-compatible endpoint
  - Custom bridge
- wizard now shows exact next-step commands and probe guidance per lane
- added common field normalization:
  - empty Ollama model -> llama3.1:8b
  - host:port style URLs -> auto-prefixed with http://
  - empty bridge model -> homie-bridge
- added a one-click voice-first companion preset
  - voice routed to companion
  - auto-speak replies on
  - auto-fallback off
  - context on
  - rolling companion memory on
  - embodied companion system prompt applied

## Why

The old flow could leave Homie throwing fetch-failed messages without enough help. The new wizard keeps setup focused on one provider lane at a time and gives the user the exact local or remote fix path.

## Validation

- TypeScript transpile parse checks on Homie panel and homieCompanion helper
- version bumped to 10.26.14z
