"""Crew verification sheet (plain python3 + numpy + PIL): composites the shipped crew layer sheets the way the runtime does
(palette swap with the shade ramp, additive glow, ONE composite outline + thin cool rim) and writes 4x crops of the
engineer and a plain crew member in SE / S / SW / NW for idle, walk and work frames.

  python3 -I tools/blender/sprites/crew_check.py [assets dir] [out.png]

The outline/rim here mirror the fragment shader in src/render/assets/palette.ts (createCrewFilter)."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import compose  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
BG = (14, 17, 22)
OUTLINE_MUL, OUTLINE_ADD = 0.42, np.array([4, 5, 10.0])
RIM, RIM_MIX = np.array([120, 205, 255.0]), 0.38
COLOURS = {
    "eng": {"team.skin": (212, 156, 116), "team.hair": (200, 40, 70), "team.cloth": (114, 132, 95), "team.accent": (200, 150, 40)},
    "crew": {"team.skin": (232, 190, 150), "team.hair": (70, 48, 34), "team.cloth": (60, 96, 150), "team.accent": (200, 150, 40)},
}
COMMON = ["body", "legs.cargo_pants", "gear.belt.tool_belt"]
LAYERS = {
    "eng": COMMON + ["eyes.cyber", "hair.mohawk", "arm.L.cyber", "arm.R.flesh", "torso.work_shirt", "gear.back.engineer_rig", "gear.head.welding_goggles"],
    "crew": COMMON + ["eyes.organic", "hair.short", "arm.L.flesh", "arm.R.flesh", "torso.tee"],
}
DIRS = [("SE", 0), ("S", 1), ("SW", 2), ("NW", 4)]
FRAMES = [("idle", "idle", 0), ("walk", "walk", 2), ("work", "work", 3), ("sit", "sit", 0)]
SHIFT = lambda a, dy, dx: np.roll(a, (dy, dx), (0, 1))  # noqa: E731


def stack(man, assets, char, d, clip, frame):
    cv = np.zeros((140, 120, 4), np.uint8)
    gl = np.zeros_like(cv)
    for lid in sorted(LAYERS[char], key=lambda i: man["assets"]["crew.human." + i]["order"]):
        a = man["assets"]["crew.human." + lid]
        sh = man["sheets"][a["sheet"]]
        img = np.array(Image.open(assets / sh["image"]).convert("RGBA"))
        col = a["clips"][clip]["start"] + frame
        fw, fh = a["frameW"], a["frameH"]
        sl = (slice(d * fh, (d + 1) * fh), slice(col * fw, (col + 1) * fw))
        x, y = 60 - a["anchor"]["x"], 120 - a["anchor"]["y"]
        compose.over(cv, compose.remap_keys(img[sl], COLOURS[char]), x, y)
        if "glow" in sh:
            compose.over(gl, np.array(Image.open(assets / sh["glow"]).convert("RGBA"))[sl], x, y)
    return cv, gl


def outline_rim(cv):
    """The runtime composite filter: outline = darkened mean of the 4-neighbours' colours, thin rim on the left edge."""
    rgb, op = cv[..., :3].astype(float), cv[..., 3] > 0
    cnt, ns = np.zeros(op.shape), np.zeros(rgb.shape)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        o = SHIFT(op, dy, dx)
        ns += SHIFT(rgb, dy, dx) * o[..., None]
        cnt += o
    ring = ~op & (cnt > 0)
    out = rgb.copy()
    rim = op & ~SHIFT(op, 0, 1) & SHIFT(op, 0, -1)
    out[rim] = out[rim] * (1 - RIM_MIX) + RIM * RIM_MIX
    out[ring] = (ns / np.maximum(cnt, 1)[..., None])[ring] * OUTLINE_MUL + OUTLINE_ADD
    return np.clip(out, 0, 255).astype(np.uint8), op | ring


def tile(man, assets):
    a = man["assets"]["tile.floor.a"]
    f = a["frame"]
    img = np.array(Image.open(assets / man["sheets"][a["sheet"]]["image"]).convert("RGBA"))
    return img[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]], a["anchor"]


def cell(man, assets, char, d, clip, frame, floor):
    cv, gl = stack(man, assets, char, d, clip, frame)
    base = np.zeros((140, 120, 4), np.uint8)
    base[..., :3], base[..., 3] = BG, 255
    t, an = floor
    for gx in (-1, 0, 1):
        for gy in (-1, 0, 1):
            compose.over(base, t, 60 + (gx - gy) * 32 - an["x"], 120 + (gx + gy) * 16 - an["y"])
    rgb, op = outline_rim(cv)
    cv[..., :3], cv[..., 3] = rgb, op * 255
    compose.over(base, cv, 0, 0)
    compose.add(base, gl, 0, 0, 1.5)
    return base[28:128, 22:98, :3]


def main():
    assets = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "public/assets"
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("crew-4x.png")
    man = json.loads((assets / "manifest.json").read_text())
    floor = tile(man, assets)
    blocks = []
    for char in ("eng", "crew"):
        rows = [np.hstack([cell(man, assets, char, d, clip, fr, floor) for _, clip, fr in FRAMES]) for _, d in DIRS]
        blocks.append(np.vstack(rows))
    sheet = np.hstack([blocks[0], np.zeros((blocks[0].shape[0], 8, 3), np.uint8), blocks[1]])
    im = Image.fromarray(sheet).resize((sheet.shape[1] * 4, sheet.shape[0] * 4), Image.NEAREST)
    d = ImageDraw.Draw(im)
    for r, (name, _) in enumerate(DIRS):
        d.text((4, r * 400 + 4), name, fill=(255, 255, 255))
    im.save(out)
    print("wrote", out, im.size)


main()
