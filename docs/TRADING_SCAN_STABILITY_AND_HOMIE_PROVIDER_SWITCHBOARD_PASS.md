# v10.26.14f – Trading Scan Stability + Homie Provider Switchboard

This pass does two things:

1. Stabilizes Trading symbol scans so the mounted desk stays calmer while refreshing chains.
2. Gives Homie a provider switchboard so the companion can route through local Ollama, OpenAI-compatible endpoints, or a custom bridge.

## Trading
- adds in-flight scan request tracking so stale responses do not overwrite newer scans
- keeps the last good chain mounted during refresh/error states to reduce visual desk twitching
- adds scan status copy in the Trading scanner lane
- fixes the combined best-contract summary used by the hero metrics

## Homie
- adds shared companion provider settings in the Homie panel
- supports provider types:
  - local Ollama
  - OpenAI-compatible endpoint
  - custom bridge
- adds provider probe + provider chat plumbing through the Electron main process
- updates Homie Buddy to show the active provider/model and use the shared companion runtime

## Validation
- source-level parse validation on touched JS/TS/TSX files
- not a full dependency-installed production build
