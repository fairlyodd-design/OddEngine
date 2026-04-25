FairlyOdd OS + Homie + Clone all-in-one startup

This helper starts, in this order:
1. Homie local voice bridge on 8765 (if present)
2. Homie clone editor/training bridge on 8776
3. OddEngine UI dev server on 5173
4. Opens http://127.0.0.1:5173 in your browser

Use:
- put both files in C:\OddEngine
- double-click RUN_FAIRLYODD_OS_HOMIE_AND_CLONE_ALL_IN_ONE.bat

Zero-guess manual order if you want to do it yourself:
1. C:\OddEngine\RUN_HOMIE_VOICE_BRIDGE_v10.36.45.bat
2. C:\OddEngine\RUN_HOMIE_NEURAL_VOICE_BRIDGE_v10.36.88.bat
3. cd C:\OddEngine\ui
4. npm run dev
5. open http://127.0.0.1:5173
6. press Ctrl+F5 once
7. open Homie
8. open Clone Studio
