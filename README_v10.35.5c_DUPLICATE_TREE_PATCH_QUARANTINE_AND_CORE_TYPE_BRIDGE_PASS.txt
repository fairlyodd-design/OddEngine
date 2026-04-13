v10.35.5c_DuplicateTreePatchQuarantineAndCoreTypeBridgePass

What this pass does
- quarantines the nested duplicate UI source tree from the audit path
- quarantines PATCH debris from the audit path
- adds a core audit tsconfig so the runtime/import sweep hits the stable shell lane first
- adds compatibility bridges for:
  - png/webp/jpg/svg imports
  - notifications (legacy kind/detail/good calls)
  - oddApi capability drift
  - moneyAutopilot queue export drift
  - HowToModal panel/howto prop drift
  - command palette registry/bus import drift

Important truth
- this is a quarantine + bridge pass
- it is meant to collapse repeated audit noise fast
- it does not claim the unstable experimental lanes are fully repaired yet

Files included
- ui/package.json
- ui/tsconfig.audit.json
- ui/src/auditEntry.ts
- ui/src/types/assets.d.ts
- ui/src/lib/notifs.ts
- ui/src/lib/odd.ts
- ui/src/lib/moneyAutopilot.ts
- ui/src/components/HowToModal.tsx
- ui/src/howtoContent.ts
- ui/core/command/commandRegistry.ts
- ui/core/command/commandBus.ts
- scripts/system-runtime-import-audit.mjs

Install
- unzip over your OddEngine root
- overwrite when prompted
- run RUN_OS_IMPORT_AUDIT.bat again

What you should expect
- the audit should stop double-counting the mirrored src/components/ui/src tree
- the audit should stop choking on PATCH debris
- the audit should have a smaller, more honest core error surface after this
