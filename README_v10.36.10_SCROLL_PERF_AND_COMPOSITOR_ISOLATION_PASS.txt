v10.36.10_ScrollPerfAndCompositorIsolationPass

What this pass targets:
- slow/glitchy center-lane scroll
- expensive glass/shadow repainting during scroll
- sticky right rail repaint pressure
- Trading chart/table/drawer compositor churn

What it changes:
- appends a safe performance CSS block to ui/src/styles.css
- reduces repaint-heavy blur/shadow cost during scroll
- adds content-visibility and containment to heavy sections
- isolates Trading iframe/SVG/table/drawer into their own paint layers
- disables tiny hover transforms that add extra motion while scrolling
- opportunistically softens ActivityRail tick updates while scrolling if the file shape matches

Install:
1. Unzip over C:\OddEngine
2. Run RUN_v10.36.10_ScrollPerfAndCompositorIsolationPass.bat
3. Restart OddEngine

Notes:
- This is a styles-first scroll/compositor pass.
- It does not overwrite App.tsx or your local panel files.
- ActivityRail throttling is optional and will skip safely if your local file drifted.
