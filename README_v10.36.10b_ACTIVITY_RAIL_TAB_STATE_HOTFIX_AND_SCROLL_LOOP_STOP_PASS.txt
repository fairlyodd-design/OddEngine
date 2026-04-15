v10.36.10b_ActivityRailTabStateHotfixAndScrollLoopStopPass

What this is:
- direct file overlay for ui/src/components/ActivityRail.tsx
- fixes the undefined tab crash path
- adds safe rail-tab fallback
- pauses fast rail ticking while scroll is hot
- fails closed if brain summary builders throw

Use:
1. Close OddEngine
2. Unzip over C:\OddEngine
3. Overwrite the existing file
4. Restart OddEngine

If you want the repo version back:
git checkout origin/main -- ui/src/components/ActivityRail.tsx
