v10.36.10c_TradingOpaqueSurfaceAndNoWashVisualStabilityPass

Goal:
Reduce the visual wash/fade effect in Trading by making Trading-only surfaces more opaque and less glass-heavy.

What this pass changes:
- Appends a Trading-only CSS override block to ui\src\styles.css
- Makes Trading cards and lane surfaces more opaque
- Disables backdrop blur/glass for Trading surfaces
- Forces chart/table/drawer surfaces into their own paint layers
- Removes little hover transforms that make the panel feel like it is washing while scrolling

Use:
1. Unzip over C:\OddEngine
2. Run RUN_v10.36.10c_TradingOpaqueSurfaceAndNoWashVisualStabilityPass.bat
3. Restart OddEngine
