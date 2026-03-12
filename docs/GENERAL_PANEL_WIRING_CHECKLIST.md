# Global panel input wiring checklist

For each panel:
1. Import from `../lib/panelConnections`
2. Build panel setup status with `buildPanelConnectionStatus("<PanelId>")`
3. Render a small setup card near the top of the panel
4. Show:
   - ready / not ready
   - completion percent
   - missing input labels
   - shortcut button to Preferences / setup hub
5. Keep actual secrets editing in Preferences / Connections Center
6. Do not duplicate secret storage logic across panels
