v10.26.20h3_PanelScrollStabilityAndLayerIsolationPass

What changed:
- Docked cards no longer become nested scroll containers
- Floating cards keep their own overflow and touch-action isolation
- Drag grip and resize handle forward wheel scrolling to the panel when docked
- panelMain now acts as the single clear scroll surface
