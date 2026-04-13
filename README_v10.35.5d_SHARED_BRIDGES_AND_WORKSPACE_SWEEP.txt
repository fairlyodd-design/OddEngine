v10.35.5d_SharedBridgesAndWorkspaceSweepPass

What this pass targets
- shared API/type bridge drift that fans out into many files
- workspace section registry corruption
- sortable widget zone strict typing
- money autopilot queue compatibility
- prefs bridge fields for newer Homie / companion flows
- safer zip file helper
- tighter audit quarantine for clearly experimental patch files

Files included
- ui/src/lib/odd.ts
- ui/src/lib/prefs.ts
- ui/src/lib/moneyAutopilot.ts
- ui/src/lib/sectionWorkspace.ts
- ui/src/lib/files.ts
- ui/src/components/SortableWidgetZone.tsx
- ui/tsconfig.audit.json

Important truth
- this is a shared bridge/type sweep, not the Trading surgical recovery pass
- Trading is still expected to remain one of the biggest survivors after this
- this pass should reduce repeated cross-file drift before the next focused cleanup
