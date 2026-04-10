import os, time, json, csv, datetime
from pathlib import Path
import requests
import pandas as pd
import streamlit as st

from feed_engine import (
    Room, Reading, load_rooms, save_rooms,
    auto_flip, current_label, get_week, scale_grams,
    paper_trade, apply_trade, analyze_uptake,
    all_bottles, compute_pump_outputs, PumpMap
)

APP_TITLE = "🌱 Fairly Odd Grow OS — GOD MODE (Wall Street Tape + Auto Feed)"

ROOMS_PATH = Path("rooms.json")
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
TRADES_CSV = DATA_DIR / "paper_trades.csv"
ALERTS_CSV = DATA_DIR / "alerts_log.csv"
HANDOFF_PATH = Path("oddengine_planner_handoff.json")

DEFAULT_BASE_URL = "https://www.acinfinityserver.com"
DEVINFO_ENDPOINT = "/api/user/devInfoListAll"

st.set_page_config(page_title="Fairly Odd Grow OS GOD MODE", layout="wide")

# -----------------------------
# Helpers: alerts
# -----------------------------
def discord_post(webhook_url: str, content: str) -> bool:
    if not webhook_url:
        return False
    try:
        r = requests.post(webhook_url, json={"content": content}, timeout=10)
        return 200 <= r.status_code < 300
    except Exception:
        return False

def desktop_toast(title: str, message: str) -> bool:
    # Optional desktop notifications. If unavailable, silently skip.
    try:
        from plyer import notification
        notification.notify(title=title, message=message, app_name="FairlyOdd Grow OS", timeout=6)
        return True
    except Exception:
        return False

def log_csv(path: Path, row: list, header: list):
    write_header = not path.exists()
    with open(path, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if write_header:
            w.writerow(header)
        w.writerow(row)

# -----------------------------
# AC Infinity API
# -----------------------------
def fetch_devices(base_url: str, token: str, user_id: str, timeout: int=10):
    url = base_url.rstrip("/") + DEVINFO_ENDPOINT
    headers = {
        "token": token,
        "appVersion": "2.0.1",
        "languageType": "en-US",
        "languageVersion": "i14-ipc-pro",
        "phoneType": "1",
        "User-Agent": "ACController/2.0.1",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    payload = {"userId": user_id}
    r = requests.post(url, headers=headers, data=payload, timeout=timeout)
    j = r.json()
    if j.get("code") != 200 or not j.get("data"):
        return None, j
    return j["data"], j

def parse_reading(device) -> Reading:
    info = device.get("deviceInfo") or {}
    temp_f = (info.get("temperatureF") or 0) / 100.0
    rh = (info.get("humidity") or 0) / 100.0
    vpd = (info.get("vpdnums") or 0) / 100.0
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return Reading(temp_f=temp_f, rh=rh, vpd=vpd, timestamp=ts)

def device_ports(device):
    ports = (device.get("deviceInfo") or {}).get("ports") or []
    rows = []
    for p in ports:
        rows.append({
            "Port": p.get("port"),
            "Name": p.get("portName"),
            "State": "ON" if p.get("loadState") == 1 else "OFF",
            "Speed": p.get("speak"),
            "Online": p.get("online"),
            "Mode": p.get("curMode"),
        })
    return pd.DataFrame(rows)

# -----------------------------
# Terminal tape + candles
# -----------------------------
def vpd_color(v: float, low: float, high: float) -> str:
    if v < low:
        return "#3b82f6"  # blue-ish
    if v > high:
        return "#ef4444"  # red-ish
    return "#22c55e"      # green-ish

def render_tape(items):
    # simple marquee tape
    tape = "   •   ".join(items)
    html = f"""
    <style>
      .tape-wrap {{
        width: 100%;
        overflow: hidden;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.03);
        padding: 10px 0;
      }}
      .tape {{
        display: inline-block;
        white-space: nowrap;
        will-change: transform;
        animation: scroll 25s linear infinite;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 14px;
        padding-left: 100%;
      }}
      @keyframes scroll {{
        0% {{ transform: translateX(0); }}
        100% {{ transform: translateX(-100%); }}
      }}
    </style>
    <div class="tape-wrap">
      <div class="tape">{tape}</div>
    </div>
    """
    st.markdown(html, unsafe_allow_html=True)

def make_candles(df: pd.DataFrame, value_col: str, session_col: str="session"):
    # Build OHLC per session for the chosen column
    if df.empty:
        return pd.DataFrame()
    g = df.groupby(session_col)[value_col]
    out = pd.DataFrame({
        "Open": g.first(),
        "High": g.max(),
        "Low": g.min(),
        "Close": g.last(),
    }).reset_index().rename(columns={session_col: "Session"})
    return out


def load_handoff(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None

# -----------------------------
# UI
# -----------------------------
st.title("🌱 Fairly Odd Grow OS — **GOD MODE** 😈")
st.caption("GrowGPT overlay + alerts + automation + terminal tape + VPD candles. (Local app)")

rooms = load_rooms(ROOMS_PATH)
handoff = load_handoff(HANDOFF_PATH)

if handoff:
    planner = handoff.get("planner") or {}
    derived = handoff.get("derived") or {}
    env = handoff.get("environment") or {}
    room_rows = handoff.get("rooms") or []
    with st.expander("🛰️ OddEngine Planner Handoff", expanded=True):
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Run", planner.get("runName") or (handoff.get("profile") or {}).get("name") or "Planned run")
        c2.metric("Medium", planner.get("medium") or "—")
        c3.metric("Rooms", len(room_rows))
        c4.metric("Panel env", f"{env.get('tempF', '—')}°F / {env.get('rh', '—')}%")
        st.caption(f"Start: {planner.get('startDate') or '—'} • Flip: {derived.get('flipDate') or '—'} • Harvest: {derived.get('harvestDate') or '—'} • Dry done: {derived.get('dryDoneDate') or '—'}")
        if planner.get("cultivar") or planner.get("notes"):
            st.write(f"**Cultivar:** {planner.get('cultivar') or '—'}")
            if planner.get("notes"):
                st.write(planner.get("notes"))
        if room_rows:
            st.write("**Pre-filled rooms**")
            st.dataframe(pd.DataFrame(room_rows), use_container_width=True, hide_index=True)

with st.sidebar:
    st.header("⚙️ Connection")
    token = st.text_input("Token", value=os.getenv("AC_TOKEN", ""), type="password")
    user_id = st.text_input("User ID", value=os.getenv("AC_USER_ID", ""))
    base_url = st.text_input("Base URL", value=os.getenv("AC_BASE_URL", DEFAULT_BASE_URL))
    poll_seconds = st.number_input("Poll seconds", min_value=5, max_value=120, value=int(os.getenv("POLL_SECONDS", "10")))
    st.divider()

    st.header("🏠 Rooms")
    if st.button("➕ Add room"):
        new = Room(
            room_id=f"room-{int(time.time())}",
            name=f"Room {len(rooms)+1}",
            medium="coco",
            reservoir_gal=1.0,
            start_date=datetime.date.today().strftime("%Y-%m-%d"),
            veg_weeks_plan=4,
            stage="VEG",
            week_index=1,
        )
        rooms.append(new)
        save_rooms(ROOMS_PATH, rooms)
        st.rerun()

    room_names = [r.name for r in rooms] or ["(no rooms yet)"]
    default_room_idx = 0
    if handoff and rooms:
        preferred_ids = [str(r.get("room_id")) for r in (handoff.get("rooms") or []) if r.get("room_id")]
        if preferred_ids:
            for i, rr in enumerate(rooms):
                if str(rr.room_id) in preferred_ids:
                    default_room_idx = i
                    break
    room_idx = st.selectbox("Select room", list(range(len(room_names))), index=default_room_idx, format_func=lambda i: room_names[i])
    if not rooms:
        st.stop()
    room = rooms[room_idx]

    room.name = st.text_input("Room name", value=room.name)
    room.reservoir_gal = st.number_input("Reservoir (gal)", min_value=0.25, max_value=100.0, value=float(room.reservoir_gal), step=0.25)
    room.start_date = st.text_input("Start date (YYYY-MM-DD)", value=room.start_date or datetime.date.today().strftime("%Y-%m-%d"))
    room.veg_weeks_plan = st.number_input("Planned veg weeks", min_value=1, max_value=12, value=int(room.veg_weeks_plan))
    room.stage = st.selectbox("Stage", ["SEEDLING", "VEG", "BLOOM", "FLUSH"], index=["SEEDLING","VEG","BLOOM","FLUSH"].index(room.stage if room.stage in ["SEEDLING","VEG","BLOOM","FLUSH"] else "VEG"))
    room.week_index = st.number_input("Week #", min_value=1, max_value=12, value=int(room.week_index))
    st.caption("Auto flip uses your Start date + Veg weeks plan.")
    st.divider()

    st.header("🔔 Alerts")
    enable_toast = st.checkbox("Desktop toast", value=True)
    discord_webhook = st.text_input("Discord webhook URL (optional)", value=os.getenv("DISCORD_WEBHOOK", ""))
    alert_vpd = st.checkbox("Alert on VPD DANGER", value=True)
    alert_def = st.checkbox("Alert on deficiency warnings", value=True)
    st.divider()

    st.header("🤖 GrowGPT AI Coach")
    st.caption("Optional. Uses OpenAI API if you add a key. Otherwise runs in offline 'rule-based' mode.")
    openai_key = st.text_input("OPENAI_API_KEY (optional)", value=os.getenv("OPENAI_API_KEY", ""), type="password")
    openai_model = st.text_input("Model", value=os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
    st.divider()

# Save room edits immediately
rooms[room_idx] = room
save_rooms(ROOMS_PATH, rooms)

# Auto flip check
room, flipped = auto_flip(room)
if flipped:
    rooms[room_idx] = room
    save_rooms(ROOMS_PATH, rooms)

# Fetch device list
devices = None
api_error = None
if token and user_id:
    try:
        devices, raw = fetch_devices(base_url, token, user_id)
        if devices is None:
            api_error = raw
    except Exception as e:
        api_error = {"msg": str(e), "code": "exception"}

# Device selector (map a room to a devId)
if devices:
    options = [(d.get("devId"), f"{d.get('devName')} • {d.get('devCode')} • {d.get('devId')}") for d in devices]
    current = room.dev_id
    sel = st.selectbox("Device", options, index=([o[0] for o in options].index(current) if current in [o[0] for o in options] else 0),
                       format_func=lambda x: x[1])
    room.dev_id = sel[0]
    rooms[room_idx] = room
    save_rooms(ROOMS_PATH, rooms)

# Choose current device object
device_obj = None
if devices and room.dev_id:
    for d in devices:
        if str(d.get("devId")) == str(room.dev_id):
            device_obj = d
            break

# Pull reading
reading = None
ports_df = pd.DataFrame()
if device_obj:
    reading = parse_reading(device_obj)
    ports_df = device_ports(device_obj)

# Dashboard metrics
colA, colB, colC, colD = st.columns([1.1,1.1,1.1,1.2])

low, high = (0.8,1.2) if room.stage=="VEG" else (1.3,1.6) if room.stage=="BLOOM" else (0.4,0.8) if room.stage=="SEEDLING" else (1.0,1.4)
if reading:
    colA.metric("Temperature (°F)", f"{reading.temp_f:.2f}")
    colB.metric("Humidity (%)", f"{reading.rh:.2f}")
    colC.metric("VPD (kPa)", f"{reading.vpd:.2f}")
    status = "OK" if (low <= reading.vpd <= high) else ("DANGER" if (reading.vpd > high+0.3 or reading.vpd < low-0.2) else "WARN")
    colD.metric("VPD Status", status)
else:
    colA.metric("Temperature (°F)", "—")
    colB.metric("Humidity (%)", "—")
    colC.metric("VPD (kPa)", "—")
    colD.metric("VPD Status", "—")

# Tape
tape_items = []
for r in rooms:
    lbl = current_label(r)
    tape_items.append(f"{r.name} [{lbl}]")
if reading:
    tape_items.append(f"{room.name} VPD {reading.vpd:.2f} / Target {low:.2f}-{high:.2f}")
render_tape(tape_items)

# Warnings + alerts
warnings = []
if reading:
    warnings = analyze_uptake(room, reading, strength=1.0)

if warnings:
    st.warning("\n\n".join([f"⚠️ {w}" for w in warnings]))

# Alerts dispatch (debounced per run by writing latest timestamp)
def fire_alert(kind: str, msg: str):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_csv(ALERTS_CSV, [ts, room.room_id, room.name, kind, msg], ["timestamp","room_id","room_name","kind","message"])
    if enable_toast:
        desktop_toast(f"FairlyOdd Grow — {room.name}", msg)
    if discord_webhook:
        discord_post(discord_webhook, f"**{room.name}** • {kind}\n{msg}")

if reading and alert_vpd:
    if reading.vpd > high + 0.3 or reading.vpd < low - 0.2:
        fire_alert("VPD_DANGER", f"VPD {reading.vpd:.2f} outside target {low:.2f}-{high:.2f}. Temp {reading.temp_f:.1f}°F RH {reading.rh:.1f}%")

if reading and warnings and alert_def:
    fire_alert("UPTAKE_WARN", " | ".join(warnings[:2]))

# Main layout
tab_dash, tab_feed, tab_auto, tab_coach = st.tabs(["📈 Terminal", "🧪 Auto Feed", "⚙️ Automation", "🤖 GrowGPT Coach"])

with tab_dash:
    st.subheader("⚡ Device Ports")
    if not ports_df.empty:
        st.dataframe(ports_df, use_container_width=True, hide_index=True)
    elif api_error:
        st.error(f"API error: {api_error}")
    else:
        st.info("Enter Token + User ID in sidebar to pull device data.")

    st.subheader("🕯️ VPD Candles (session OHLC)")
    # session = per-room per hour (simple)
    log_path = DATA_DIR / f"{room.room_id}_telemetry.csv"
    if reading:
        log_csv(log_path, [reading.timestamp, reading.temp_f, reading.rh, reading.vpd], ["timestamp","temp_f","rh","vpd"])
    if log_path.exists():
        df = pd.read_csv(log_path)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df["session"] = df["timestamp"].dt.strftime("%Y-%m-%d %H:00")
        candles = make_candles(df, "vpd", "session")
        if not candles.empty:
            # Color hint column
            candles["Color"] = candles.apply(lambda row: "GREEN" if (low <= row["Close"] <= high) else "RED", axis=1)
            st.dataframe(candles.tail(24), use_container_width=True, hide_index=True)
        st.line_chart(df.set_index("timestamp")[["vpd"]], height=220)
    else:
        st.caption("No telemetry yet. Let it run for a minute.")

with tab_feed:
    st.subheader("🧪 Smart Auto Feed Engine")
    label = current_label(room)
    w = get_week(label)
    st.caption(f"Current schedule: **{label}** • pH {w.ph} • target EC {w.ec}")

    strength = st.slider("Strength (paper-trade)", 0.25, 1.25, 1.00, 0.05)
    reason = st.text_input("Reason (optional)", value="")

    plan = scale_grams(w, room.reservoir_gal, strength=strength)
    plan_df = pd.DataFrame([{"Bottle": k, "Dose (g)": v} for k,v in plan.items() if v != 0]).sort_values("Bottle")
    st.dataframe(plan_df, use_container_width=True, hide_index=True)

    c1, c2, c3 = st.columns([1,1,2])
    with c1:
        if st.button("📄 Paper trade this feed"):
            t = paper_trade(room, strength=strength, reason=reason or "paper trade")
            rooms[room_idx] = room
            save_rooms(ROOMS_PATH, rooms)
            log_csv(TRADES_CSV, [t["created_at"], t["room_id"], t["label"], t["strength"], json.dumps(t["plan"]), t["reason"], t["status"]],
                    ["timestamp","room_id","label","strength","plan_json","reason","status"])
            st.success("Paper trade created (PENDING).")
            st.rerun()
    with c2:
        if st.button("✅ Apply pending trade") and room.pending_trade:
            applied = apply_trade(room)
            rooms[room_idx] = room
            save_rooms(ROOMS_PATH, rooms)
            log_csv(TRADES_CSV, [datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), room.room_id, applied["label"], applied["strength"], json.dumps(applied["plan"]), applied["reason"], "APPLIED"],
                    ["timestamp","room_id","label","strength","plan_json","reason","status"])
            st.success("Applied. (This is still 'paper' unless you wire real pumps.)")
            st.rerun()

    if room.pending_trade:
        st.info(f"Pending trade: label={room.pending_trade['label']} strength={room.pending_trade['strength']}")

    st.subheader("🧴 Pump / Doser Output Mapping (real automation-ready)")
    st.caption("Map each bottle to a pump channel. If dosing from concentrate, set g/ml so we can compute ml output.")

    pm_rows = []
    for b, pm in room.pump_map.items():
        pm_rows.append({"Bottle": b, "Channel": pm.channel if pm.channel is not None else "", "Stock g/ml": pm.stock_concentration_g_per_ml if pm.stock_concentration_g_per_ml is not None else ""})
    pm_df = pd.DataFrame(pm_rows)
    edited = st.data_editor(pm_df, use_container_width=True, hide_index=True, num_rows="fixed")

    # Save edits back
    for _, row in edited.iterrows():
        b = row["Bottle"]
        ch = row["Channel"]
        cg = row["Stock g/ml"]
        room.pump_map[b].channel = int(ch) if str(ch).strip() != "" and str(ch).strip().isdigit() else None
        try:
            room.pump_map[b].stock_concentration_g_per_ml = float(cg) if str(cg).strip() != "" else None
        except Exception:
            room.pump_map[b].stock_concentration_g_per_ml = None

    rooms[room_idx] = room
    save_rooms(ROOMS_PATH, rooms)

    outputs = compute_pump_outputs(plan, room.pump_map)
    if outputs:
        out_df = pd.DataFrame([{"Channel": k, "Bottle": v["bottle"], "mL": v["ml"], "grams_equiv": v["grams_equiv"]} for k,v in outputs.items()]).sort_values("Channel")
        st.dataframe(out_df, use_container_width=True, hide_index=True)
    else:
        st.caption("No pump channels mapped yet.")

with tab_auto:
    st.subheader("⚙️ Automation")
    st.markdown(f"""
- **Auto flip detection**: enabled.  
  Start: `{room.start_date}` • Veg plan: `{room.veg_weeks_plan} weeks` • Flip date: `{room.flip_date or "not yet"}`
- **Deficiency warnings**: uses VPD + EC heuristics to warn about lockout / burn / mildew setups.
- **Alerts**: desktop toast + Discord webhook from sidebar.
""")
    st.caption("Next step: wire outputs into your pump controller API (ESPHome, Home Assistant, GPIO relay board, etc.)")

with tab_coach:
    st.subheader("🤖 AI Room Coach (GrowGPT vibes)")
    st.caption("You can run this offline (rule-based) or plug in OpenAI API key.")

    prompt = st.text_area(
        "What’s going on right now?",
        value=f"Room: {room.name}\nStage: {current_label(room)}\nTemp: {reading.temp_f if reading else 'n/a'}\nRH: {reading.rh if reading else 'n/a'}\nVPD: {reading.vpd if reading else 'n/a'}\nWarnings: {warnings}",
        height=140
    )

    if st.button("🧠 Coach me"):
        if not openai_key:
            # Offline mode — trading style
            tips = []
            if reading:
                if reading.vpd > high:
                    tips.append("If this were SPY, you’re **over-levered** on transpiration. Bring VPD back into range (raise RH or drop temp).")
                elif reading.vpd < low:
                    tips.append("If this were SPY, you’re **under-exposed**. Low VPD = weak transpiration; tighten the environment.")
                else:
                    tips.append("This is an **A+ setup**: VPD in range. Protect it, don’t overtrade the environment.")
            if room.pending_trade:
                tips.append("You have a **paper trade** pending. Don’t hit ‘Apply’ unless the reason still holds after 30–60 min.")
            if not tips:
                tips.append("Add token/userId to pull live data, then I can coach with real readings.")
            st.success("\n\n".join(tips))
        else:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=openai_key)
                sys = (
                    "You are GrowGPT, a calm but ruthless trading-style grow coach. "
                    "You give short, actionable steps. Use risk management language. "
                    "No illegal advice. Personal-use cultivation only."
                )
                resp = client.chat.completions.create(
                    model=openai_model,
                    messages=[{"role":"system","content":sys},{"role":"user","content":prompt}],
                    temperature=0.4,
                )
                st.success(resp.choices[0].message.content)
            except Exception as e:
                st.error(f"AI call failed: {e}")


# Auto refresh (safe across Streamlit versions)
def _rerun():
    if hasattr(st, "rerun"):
        st.rerun()
    elif hasattr(st, "experimental_rerun"):
        st.experimental_rerun()

st.caption(f"Auto-refresh every {poll_seconds}s • Run:  python -m streamlit run app.py")
# Trigger refresh with a lightweight timer
if poll_seconds and poll_seconds >= 5:
    time.sleep(poll_seconds)
    _rerun()
