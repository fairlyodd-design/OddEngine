# v10.26.9h Trading Chain Results Virtualization Hotfix

This hotfix tightens the Trading panel when chains load by virtualizing the two heavy result lanes:

- Public options sniper rows now render in a small moving window
- Contract table rows now render in a fixed 40-row window
- Prev/Next row controls replace large always-on maps
- The chart uses the same smaller result window instead of the full chain slice

Goal:
keep chain refreshes from thrashing the Trading panel when contracts load or filters change.
