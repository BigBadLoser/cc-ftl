"""Variant spec shared by readability.py (Blender render stage) and readability_sheet.py (PIL sheet stage). Pure python.

A variant = render config (`cfg`, overrides of BASE; drives what Blender renders) + `post` (numpy post options applied
while compositing). One knob differs from the baseline per variant, except COMBO."""
import hashlib
import json

BASE = {"hpx": None,       # target plain-crew sprite height in px (None = current pipeline)
        "hs": 1.0,         # head scale multiplier (pipeline HEAD_SCALE 1.45)
        "hf": 1.0,         # hands/feet scale
        "sh": 1.0,         # shoulder/torso width multiplier (pipeline TORSO_W 1.14)
        "bands": 5,        # shade bands (pipeline: 5 steps)
        "outline": "layer",  # layer = per-layer ring (pipeline) | none | colored (per-layer, hue-preserving ring)
        "face": "base",    # base | simple (2px eyes, strong brow, no mouth)
        "arm": 1.0}        # cyber arm scale

POST = {"sil": None,       # None | dark | colored : ONE outline on the stacked composite (cfg outline must be none)
        "smooth": False,   # majority filter on the composite silhouette before the outline
        "rim": None, "sat": 1.0, "vcon": False, "skinhl": False, "cyan": False, "halo": False}

R = lambda row, label, cfg=None, post=None: {"row": row, "label": label, "cfg": {**BASE, **(cfg or {})}, "post": {**POST, **(post or {})}}  # noqa: E731
NO = {"outline": "none"}

VARIANTS = [
    R(1, "baseline"), R(1, "56 px", {"hpx": 56}), R(1, "72 px", {"hpx": 72}),
    R(2, "baseline"), R(2, "head x1.15", {"hs": 1.15}), R(2, "head1.15 + hands/feet x1.3", {"hs": 1.15, "hf": 1.3}),
    R(2, "+ shoulders x1.15", {"hs": 1.15, "hf": 1.3, "sh": 1.15}),
    R(3, "none", NO), R(3, "per-layer dark (baseline)"), R(3, "per-layer coloured", {"outline": "colored"}),
    R(3, "composite dark", NO, {"sil": "dark"}), R(3, "composite coloured", NO, {"sil": "colored"}),
    R(3, "composite dark + smoothed", NO, {"sil": "dark", "smooth": True}),
    R(3, "composite coloured + smoothed", NO, {"sil": "colored", "smooth": True}),
    R(4, "2 bands", {"bands": 2}), R(4, "3 bands", {"bands": 3}), R(4, "4 bands", {"bands": 4}), R(4, "5 bands (baseline)"),
    R(5, "off (baseline)"), R(5, "cool rim, camera-left", None, {"rim": "cool"}), R(5, "warm rim", None, {"rim": "warm"}),
    R(6, "baseline"), R(6, "+30% saturation", None, {"sat": 1.3}), R(6, "+value contrast shirt/pants/skin", None, {"vcon": True}),
    R(7, "baseline"), R(7, "simplified (2px eyes, brow, no mouth)", {"face": "simple"}),
    R(7, "simplified + skin highlight", {"face": "simple"}, {"skinhl": True}),
    R(8, "baseline"), R(8, "bigger cyber arm + bright cyan", {"arm": 1.3}, {"cyan": True}),
    R(8, "glow halo", None, {"halo": True}),
]
COMBO = [
    R(9, "COMBO", {"hs": 1.15, "hf": 1.3, "sh": 1.1, "bands": 4, "outline": "none", "face": "simple", "arm": 1.2},
      {"sil": "colored", "smooth": True, "rim": "cool", "sat": 1.3, "skinhl": True, "cyan": True, "halo": True}),
]
ALL = VARIANTS + COMBO

ROW_TITLES = {1: "1  CREW HEIGHT", 2: "2  PROPORTIONS (cumulative)", 3: "3  OUTLINE", 4: "4  SHADING BANDS",
              5: "5  RIM LIGHT", 6: "6  CLOTHING CONTRAST", 7: "7  FACES", 8: "8  CYBER EMPHASIS", 9: "COMBO (best guess)"}
FRAMES = [("se_idle", 0, "idle", 0), ("nw_idle", 4, "idle", 0), ("se_walk", 0, "walk", 2)]
COLOURS = {
    "eng": {"team.skin": (212, 156, 116), "team.hair": (200, 40, 70), "team.cloth": (114, 132, 95), "team.accent": (200, 150, 40)},
    "crew": {"team.skin": (232, 190, 150), "team.hair": (70, 48, 34), "team.cloth": (60, 96, 150), "team.accent": (200, 150, 40)},
}
COMMON = ["body", "legs.cargo_pants", "gear.belt.tool_belt"]
LAYERS = {
    "eng": COMMON + ["eyes.cyber", "hair.mohawk", "arm.L.cyber", "arm.R.flesh", "torso.work_shirt", "gear.back.engineer_rig",
                     "gear.head.welding_goggles", "implant.temple.neural_jack"],
    "crew": COMMON + ["eyes.organic", "hair.short", "arm.L.flesh", "arm.R.flesh", "torso.tee"],
}


def layer_ids(char, face):
    out = []
    for l in LAYERS[char]:
        out.append(l.replace("eyes.cyber", "eyes.cyber_simple").replace("eyes.organic", "eyes.organic_simple") if face == "simple" and l.startswith("eyes.") else l)
    return out


def render_key(cfg, char):
    """Cache key of what Blender renders: arm scale only matters for the engineer, colours for coloured rings."""
    c = dict(cfg)
    if char != "eng":
        c["arm"] = 1.0
    c["char"] = char if (c["outline"] == "colored" or True) else ""
    return hashlib.md5(json.dumps(c, sort_keys=True).encode()).hexdigest()[:12]
