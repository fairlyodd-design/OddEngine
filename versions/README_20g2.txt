v10.26.20g2_UniversalWidgetInteractionSmoothingPass

What changed:
- unified pointer-based drag + resize interactions for mouse, touch, and pen
- smoother widget movement using animation-frame updates
- stronger clamp behavior so floating widgets stay within panel workspace bounds
- z-fronting and float promotion preserved from 20g1
- added drag/resize interaction state classes for cleaner feel and less accidental text selection

Files updated:
- ui/src/components/CardGODMode.tsx
- ui/src/styles.css
- ui/src/lib/version.ts
- .oddengine_last_ui_version.txt
