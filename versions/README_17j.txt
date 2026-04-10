
This pass adds the bridge and registry layers needed for:
- Electron-native monitor enumeration
- true component lift registration for floating sections

Important:
This is still a safe integration starter built on the working 17i base.
To fully activate native monitor enumeration, merge:
- electron/preload.monitorBridge.ts
- electron/main.monitorBridge.ts
into your real Electron preload/main setup.
