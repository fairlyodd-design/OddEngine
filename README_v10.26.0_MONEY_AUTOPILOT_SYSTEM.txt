v10.26.0_MoneyAutopilotSystemPass

What this pass adds:
- Money Autopilot recommendation engine
- Best Next Move can now prioritize what to create based on real tracked platform + outcome data
- Publisher Hub includes a Money Autopilot control card
- Supports:
  - finish pending publish jobs first
  - queue latest studio handoff to strongest platform
  - focus Studio on the best-performing content type
- New storage key:
  oddengine:moneyAutopilot:v1

Main files:
- ui/src/lib/moneyAutopilot.ts
- ui/src/panels/Home.tsx
- ui/src/panels/PublisherHub.tsx
- ui/src/lib/version.ts
