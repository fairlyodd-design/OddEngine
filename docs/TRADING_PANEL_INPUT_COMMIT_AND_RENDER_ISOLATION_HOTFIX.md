# Trading Panel Input Commit + Render Isolation Hotfix

This hotfix reduces Trading panel glitchiness by keeping symbol edits in local draft state until commit, memoizing the heavy chart/drawer lanes, and debouncing storage writes for the trading status snapshot.
