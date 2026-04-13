v10.34.3_WritersLoungeTrueOnePromptFinishedProductPass

What this pass does
- finishes Writers Lounge as a real 1 prompt -> finished product launcher
- sends the generated studio handoff straight into Render Lab from inside Writers Lounge
- creates the real local Render Lab job in storage so Render Lab opens already focused on the latest run
- executes the backend job when Render Lab auto-execute is enabled
- creates Publisher Hub handoff records from the same run
- records the latest finished-product receipt back into Writers Lounge

Changed files
- ui/src/panels/Books.tsx
- ui/src/lib/studioShip.ts

Notes
- This pass is cumulative on top of the existing Legacy Mode / Render Lab pipeline.
- It does not replace Render Lab. It turns Writers Lounge into the real front door for that pipeline.
