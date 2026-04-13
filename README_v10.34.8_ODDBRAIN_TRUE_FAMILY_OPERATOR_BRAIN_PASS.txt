v10.34.8_OddBrainTrueFamilyOperatorBrainPass

What this pass does
- turns OddBrain into the shared trustworthy source for:
  - what matters now
  - where to go
  - what to do next
- adds ui/src/lib/operatorBrain.ts as the shared decision source
- Home now surfaces the same OddBrain source in a Trusted Source block
- Homie now includes the same OddBrain source in its context and UI
- OddBrain now shows:
  - What matters now
  - Where do I go
  - What should I do next
  - Family lane
  - Operator lane
  - Shared action queue
  - Shared panel health

Files in this overlay
- ui/src/lib/operatorBrain.ts
- ui/src/panels/OddBrain.tsx
- ui/src/panels/Home.tsx
- ui/src/panels/Homie.tsx

Install
- unzip over your current OddEngine root
- overwrite when prompted
- restart the app
- open OddBrain, Home, and Homie

Truth
- this is a real UI/shared-logic pass on top of the provided OddEngine 10.28.1c base
- changed files were transpile-checked individually
- this overlay does not claim a full repo-wide clean build beyond these files
