# Fairly Odd Grow OS — GOD MODE 😈 (Auto Feed + Alerts + Tape + VPD Candles)

This zip adds:
- **Multi-room watchlist** (add rooms anytime)
- **AC Infinity live readings** (token + userId)
- **Terminal tape** (scrolling room ticker)
- **VPD candles (session OHLC)** per room (hourly sessions)
- **Alerts**: desktop toast + Discord webhook
- **SMART AUTO FEED ENGINE** (Dakine Expert schedule, Coco, 1 gal base, scaled to any reservoir)
- **Paper trade feed changes** before applying
- **Auto flip detection** (Veg → Bloom) based on Start date + planned veg weeks
- **Deficiency / lockout warnings** (simple feed ≠ VPD ≠ uptake logic)
- **Pump / doser mapping** (channel + g/ml concentrate to compute mL outputs)
- **GrowGPT-style AI coach** (offline mode + optional OpenAI API)

## Run (Windows)
1) Unzip
2) Double-click `RUN_WINDOWS.bat`

If Streamlit isn't found, use:
```bash
python -m streamlit run app.py
```

## Config (optional)
You can set environment variables instead of typing each time:
- `AC_TOKEN`
- `AC_USER_ID`
- `AC_BASE_URL` (default https://www.acinfinityserver.com)
- `DISCORD_WEBHOOK`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## Notes
- Desktop toast uses `plyer`. If it doesn't show on your machine, the app still runs — Discord webhook is the reliable path.
- Pump outputs require you to set **stock g/ml** for each bottle channel (your concentrate strength).
