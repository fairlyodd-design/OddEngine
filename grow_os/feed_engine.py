"""
Fairly Odd Grow OS — SMART AUTO FEED ENGINE (GOD MODE)
- Parses Dakine "Expert Feed Schedule" (Coco, 1 gal reservoir) + scales to any reservoir size
- Supports multiple rooms
- Paper-trade feed changes before "applying"
- Auto flip detection (Veg -> Bloom) based on room start date / planned veg duration
- Basic deficiency / lockout warnings (feed ≠ VPD ≠ uptake logic)
- Pump / doser mapping (convert grams-per-gallon plan into per-pump outputs)

Educational / personal use only.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple, Any
import json
import math
import datetime as _dt
from pathlib import Path

# ----------------------------
# Feed schedule (Coco, 1 gal)
# ----------------------------

@dataclass
class FeedWeek:
    label: str
    grams_per_gal: Dict[str, float]  # "per 1 gallon reservoir"
    ph: str
    ppm: str
    ec: float

# From the image you provided (Expert schedule, Coco, 1 gallon reservoir).
# Notes:
# - Columns in screenshot: Grow, Base, Bloom, CalMag, Shock and Awe Bloom Boost
# - You said: 8 bottle lineup + 3 extra: Sticky Icky, Foliar Science, Bio Minerals
#   Those 3 are kept as optional "add-ons" (0 by default) so you can extend later.

SCHEDULE: Dict[str, FeedWeek] = {
    "SEEDLING": FeedWeek("SEEDLING", {"Base": 1, "CalMag": 1}, "5.8/6.4", "300/450", 0.8),
    "VEG 1": FeedWeek("VEG 1", {"Grow": 2, "Base": 2, "CalMag": 1}, "5.8/6.4", "600/700", 1.2),
    "VEG 2": FeedWeek("VEG 2", {"Grow": 2, "Base": 2, "CalMag": 1}, "5.8/6.4", "600/700", 1.2),
    "VEG 3": FeedWeek("VEG 3", {"Grow": 3, "Base": 3, "CalMag": 1}, "5.8/6.4", "900/1000", 1.8),
    "VEG 4": FeedWeek("VEG 4", {"Grow": 3, "Base": 3, "CalMag": 1}, "5.8/6.4", "900/1000", 1.8),
    "BLOOM 1": FeedWeek("BLOOM 1", {"Grow": 2, "Base": 3, "Bloom": 3, "CalMag": 1}, "5.8/6.4", "1200/1300", 2.4),
    "BLOOM 2": FeedWeek("BLOOM 2", {"Grow": 2, "Base": 3, "Bloom": 3, "CalMag": 1}, "5.8/6.4", "1200/1300", 2.4),
    "BLOOM 3": FeedWeek("BLOOM 3", {"Base": 4, "Bloom": 5, "CalMag": 1, "Shock&Awe": 2}, "5.8/6.4", "1600/1700", 3.2),
    "BLOOM 4": FeedWeek("BLOOM 4", {"Base": 4, "Bloom": 5, "CalMag": 1, "Shock&Awe": 2}, "5.8/6.4", "1600/1700", 3.2),
    "BLOOM 5": FeedWeek("BLOOM 5", {"Base": 4, "Bloom": 5, "CalMag": 1, "Shock&Awe": 3}, "5.8/6.4", "1700/1800", 3.4),
    "BLOOM 6": FeedWeek("BLOOM 6", {"Base": 4, "Bloom": 5, "CalMag": 1, "Shock&Awe": 3}, "5.8/6.4", "1700/1800", 3.4),
    "BLOOM 7": FeedWeek("BLOOM 7", {"Base": 4, "Bloom": 5, "CalMag": 1, "Shock&Awe": 3}, "5.8/6.4", "1700/1800", 3.4),
    "BLOOM 8": FeedWeek("BLOOM 8", {"Base": 4, "Bloom": 5, "CalMag": 1, "Shock&Awe": 3}, "5.8/6.4", "1700/1800", 3.4),
    "FLUSH": FeedWeek("FLUSH", {}, "5.8/6.4", "0", 0.0),
}

# Optional add-ons (user said: Sticky Icky, Foliar Science, Bio Minerals)
OPTIONAL_ADDONS = ["Sticky Icky", "Foliar Science", "Bio Minerals"]

# ----------------------------
# Rooms + persistence
# ----------------------------

@dataclass
class PumpMap:
    """Maps bottle name -> pump channel (or None) and a dosing basis."""
    bottle: str
    channel: Optional[int] = None
    # If you're dosing from a liquid concentrate, set stock_concentration_g_per_ml.
    # Example: if you mix 100g powder into 500ml water => 0.2 g/ml.
    stock_concentration_g_per_ml: Optional[float] = None

@dataclass
class Room:
    room_id: str
    name: str
    dev_id: Optional[str] = None  # AC Infinity devId (optional)
    medium: str = "coco"
    reservoir_gal: float = 1.0
    start_date: str = ""  # YYYY-MM-DD
    veg_weeks_plan: int = 4
    stage: str = "VEG"
    week_index: int = 1
    flip_date: Optional[str] = None  # YYYY-MM-DD
    # paper-traded changes waiting for approval
    pending_trade: Optional[Dict[str, Any]] = None
    pump_map: Dict[str, PumpMap] = None

    def __post_init__(self):
        if self.pump_map is None:
            self.pump_map = {b: PumpMap(bottle=b) for b in all_bottles()}

def all_bottles() -> List[str]:
    core = ["Grow", "Base", "Bloom", "CalMag", "Shock&Awe"]
    # "8 bottle lineup": we don't have names of all 8 from screenshot.
    # We'll keep placeholders for the additional 3 core bottles so your system can grow.
    # You can rename these later in UI without breaking storage.
    placeholders = ["Bottle 6", "Bottle 7", "Bottle 8"]
    return core + placeholders + OPTIONAL_ADDONS

def load_rooms(path: Path) -> List[Room]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    rooms: List[Room] = []
    for r in data.get("rooms", []):
        # pump_map stored as dict -> PumpMap
        pm = {}
        for k,v in (r.get("pump_map") or {}).items():
            pm[k] = PumpMap(**v)
        r["pump_map"] = pm
        rooms.append(Room(**r))
    return rooms

def save_rooms(path: Path, rooms: List[Room]) -> None:
    payload = {"rooms": []}
    for r in rooms:
        d = asdict(r)
        d["pump_map"] = {k: asdict(v) for k,v in r.pump_map.items()}
        payload["rooms"].append(d)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

# ----------------------------
# Stage / week helpers
# ----------------------------

def _parse_date(s: str) -> Optional[_dt.date]:
    try:
        return _dt.datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None

def auto_flip(room: Room, today: Optional[_dt.date]=None) -> Tuple[Room, bool]:
    """If today passes veg plan, flip to bloom automatically."""
    today = today or _dt.date.today()
    start = _parse_date(room.start_date) or today
    flip_day = start + _dt.timedelta(days=int(room.veg_weeks_plan * 7))
    flipped = False

    if room.flip_date:
        # already flipped
        return room, False

    if today >= flip_day:
        room.flip_date = flip_day.strftime("%Y-%m-%d")
        room.stage = "BLOOM"
        room.week_index = 1
        flipped = True

    return room, flipped

def current_label(room: Room) -> str:
    st = room.stage.upper()
    if st == "SEEDLING":
        return "SEEDLING"
    if st == "VEG":
        return f"VEG {max(1, int(room.week_index))}"
    if st == "BLOOM":
        return f"BLOOM {max(1, int(room.week_index))}"
    if st == "FLUSH":
        return "FLUSH"
    # fallback
    return f"{st} {max(1, int(room.week_index))}"

def get_week(label: str) -> FeedWeek:
    if label in SCHEDULE:
        return SCHEDULE[label]
    # clamp
    if label.startswith("VEG"):
        return SCHEDULE["VEG 4"]
    if label.startswith("BLOOM"):
        return SCHEDULE["BLOOM 8"]
    return SCHEDULE["VEG 1"]

def scale_grams(week: FeedWeek, reservoir_gal: float, strength: float=1.0) -> Dict[str, float]:
    """Scale grams-per-gal to reservoir size and strength."""
    out = {}
    for k, g in week.grams_per_gal.items():
        out[k] = round(g * reservoir_gal * strength, 3)
    # ensure addon keys exist (0 default)
    for addon in OPTIONAL_ADDONS:
        out.setdefault(addon, 0.0)
    return out

# ----------------------------
# Paper trading
# ----------------------------

def paper_trade(room: Room, strength: float, reason: str, created_at: Optional[str]=None) -> Dict[str, Any]:
    label = current_label(room)
    w = get_week(label)
    plan = scale_grams(w, room.reservoir_gal, strength=strength)
    created_at = created_at or _dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    trade = {
        "room_id": room.room_id,
        "label": label,
        "strength": strength,
        "reservoir_gal": room.reservoir_gal,
        "plan": plan,
        "reason": reason,
        "created_at": created_at,
        "status": "PENDING",
    }
    room.pending_trade = trade
    return trade

def apply_trade(room: Room) -> Optional[Dict[str, Any]]:
    if not room.pending_trade:
        return None
    room.pending_trade["status"] = "APPLIED"
    applied = room.pending_trade
    room.pending_trade = None
    return applied

# ----------------------------
# Deficiency / lockout warnings
# ----------------------------

@dataclass
class Reading:
    temp_f: float
    rh: float
    vpd: float
    timestamp: str = ""

def vpd_target_for_stage(stage: str) -> Tuple[float, float]:
    s = stage.lower()
    if "seed" in s:
        return (0.4, 0.8)
    if "veg" in s:
        return (0.8, 1.2)
    if "early" in s:
        return (1.1, 1.4)
    if "late" in s or "bloom" in s:
        return (1.3, 1.6)
    return (1.0, 1.4)

def analyze_uptake(room: Room, reading: Reading, strength: float=1.0) -> List[str]:
    """Simple heuristics: VPD too high + high EC => lockout risk; VPD low => mildew risk, etc."""
    warnings = []
    low, high = vpd_target_for_stage(room.stage)
    if reading.vpd > high + 0.3:
        warnings.append(f"VPD very high ({reading.vpd:.2f}): plants can drink faster than they feed (dry-back / burn risk).")
    elif reading.vpd > high:
        warnings.append(f"VPD high ({reading.vpd:.2f}): consider more RH or lower temp to protect uptake.")
    if reading.vpd < low - 0.2:
        warnings.append(f"VPD very low ({reading.vpd:.2f}): transpiration weak (mildew / slow growth risk).")
    elif reading.vpd < low:
        warnings.append(f"VPD low ({reading.vpd:.2f}): consider lowering RH or raising temp slightly.")

    label = current_label(room)
    ec = get_week(label).ec * strength
    # lockout / burn heuristics
    if reading.vpd > high and ec >= 2.8:
        warnings.append("High VPD + high EC: classic burn / lockout setup. Either lower EC or pull VPD back into range.")
    if reading.rh < 35 and reading.temp_f > 82:
        warnings.append("RH < 35% at high temp: stomata may close -> nutrient uptake issues. Add humidity or reduce temp.")
    if reading.rh > 70 and reading.temp_f < 78:
        warnings.append("High RH at cooler temps: watch leaf wetness / mildew. Increase exhaust or dehu if needed.")
    return warnings

# ----------------------------
# Pump / doser mapping
# ----------------------------

def compute_pump_outputs(plan_grams: Dict[str, float], pump_map: Dict[str, PumpMap]) -> Dict[int, Dict[str, float]]:
    """
    Convert a grams-plan into per-pump ML outputs if stock concentration is provided.
    Returns: {channel: {"bottle": ..., "ml": ...}}.
    """
    outputs: Dict[int, Dict[str, float]] = {}
    for bottle, grams in plan_grams.items():
        pm = pump_map.get(bottle)
        if not pm or pm.channel is None:
            continue
        if pm.stock_concentration_g_per_ml and pm.stock_concentration_g_per_ml > 0:
            ml = grams / pm.stock_concentration_g_per_ml
            outputs[int(pm.channel)] = {"bottle": bottle, "ml": round(ml, 2), "grams_equiv": grams}
        else:
            # no conversion possible, keep grams
            outputs[int(pm.channel)] = {"bottle": bottle, "ml": None, "grams_equiv": grams}
    return outputs
