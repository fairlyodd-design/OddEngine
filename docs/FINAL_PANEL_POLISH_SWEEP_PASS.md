# v10.26.13f — Final Panel Polish Sweep Pass

## Scope
- Cross-OS spacing and hero rhythm polish
- Earlier container-driven collapse for cramped grids
- Homie companion demeanor tuning

## Major UI changes
- Larger gap rhythm between main panel sections and assistant rail cards
- Consistent rounded hero cards across the shell
- Earlier single-column fallback for cramped grid-heavy panels
- Better wrapping for shell bar subtitle text

## Homie changes
- Companion mode with three postures: grounding, steady, phoenix
- New companion prompts for check-ins, thought-sorting, grounding, and "stay with me" coaching
- Embedded Homie Core now surfaces the companion read directly in the activity rail
- Homie Buddy now behaves more like an always-ready companion lane than just a launcher
- Full Homie panel now defaults to a warmer, grounded operator prompt

## Touched files
- ui/src/lib/homieCore.ts
- ui/src/components/EmbeddedHomieCore.tsx
- ui/src/components/HomieBuddy.tsx
- ui/src/lib/homieActionRouter.ts
- ui/src/lib/homieMemory.ts
- ui/src/panels/Homie.tsx
- ui/src/styles.css
- ui/src/lib/version.ts
