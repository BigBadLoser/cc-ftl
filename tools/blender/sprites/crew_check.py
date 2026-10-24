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
from sprites import compose, crew_trim  # noqa: E402
from sprites.scale import ART_SCALE as S, TILE_H, TILE_W, assets_dir  # noqa: E402

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
FRAMES = [("idle", "idle", 0), ("walk", "walk", 2), ("work", "work", 3), ("sit_idle", "sit_idle", 0), ("sit_work", "sit_work", 2)]
HIDDEN_A = 12
SHIFT = lambda a, dy, dx: np.roll(a, (dy, dx), (0, 1))  # noqa: E731


def stack(man, assets, char, d, clip, frame):
    cv = np.zeros((150, 140, 4), np.uint8)
    gl = np.zeros_like(cv)
    for lid in sorted(LAYERS[char], key=lambda i: man["assets"]["crew.human." + i]["order"]):
        a = man["assets"]["crew.human." + lid]
        cd = a["clips"].get(clip) or (None if clip.startswith("sit") else a["clips"]["idle"])
        if cd is None:                                       # no sheet for a seated clip: the layer is hidden (like the runtime)
            continue
        sh = man["sheets"][cd.get("sheet", a.get("sheet"))]
        img = np.array(Image.open(assets / sh["image"]).convert("RGBA"))
        col = cd["start"] + frame
        fw, fh = a["frameW"], a["frameH"]
        x, y = 70 * S - a["anchor"]["x"], 120 * S - a["anchor"]["y"]
        lay = compose.remap_keys(crew_trim.full_cell(img, a, cd, d, col), COLOURS[char])
        hid = (lay[..., 3] > 0) & (lay[..., 3] < 128)       # sit clips: pixels hidden behind the chair (faint alpha)
        if hid.any():
            sub = cv[y:y + fh, x:x + fw]
            sub[hid & (sub[..., 3] == 0), 3] = HIDDEN_A
            lay[hid] = 0
        compose.over(cv, lay, x, y)
        if "glow" in sh:
            compose.over(gl, crew_trim.full_cell(np.array(Image.open(assets / sh["glow"]).convert("RGBA")), a, cd, d, col), x, y)
    return cv, gl


def outline_rim(cv):
    """The runtime composite filter: outline = darkened mean of the 4-neighbours' colours, thin rim on the left edge.
    Pixels with a faint alpha (hidden behind the sit chair) stay empty and stop neither the outline nor the rim test."""
    rgb, op = cv[..., :3].astype(float), cv[..., 3] >= 128
    hid = (cv[..., 3] > 0) & ~op
    cnt, ns = np.zeros(op.shape), np.zeros(rgb.shape)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        o = SHIFT(op, dy, dx)
        ns += SHIFT(rgb, dy, dx) * o[..., None]
        cnt += o
    ring = ~op & ~hid & (cnt > 0)
    out = rgb.copy()
    rim = op & ~SHIFT(op | hid, 0, 1) & SHIFT(op, 0, -1)
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
    base = np.zeros((150 * S, 140 * S, 4), np.uint8)
    base[..., :3], base[..., 3] = BG, 255
    t, an = floor
    for gx in (-1, 0, 1):
        for gy in (-1, 0, 1):
            compose.over(base, t, 70 * S + (gx - gy) * (TILE_W // 2) - an["x"], 120 * S + (gx + gy) * (TILE_H // 2) - an["y"])
    rgb, op = outline_rim(cv)
    cv[..., :3], cv[..., 3] = rgb, op * 255
    compose.over(base, cv, 0, 0)
    compose.add(base, gl, 0, 0, 1.5)
    return base[28 * S:128 * S, 32 * S:108 * S, :3]


def main():
    assets = Path(sys.argv[1]) if len(sys.argv) > 1 else assets_dir()
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
