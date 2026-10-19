"""Species experiment preview (plain python3 + numpy + PIL): a shipped human crew member beside the rock and slime bodies
(species.py's raw frames), composited like the runtime (palette swap for the human, the crew filter's outline and rim,
additive glow) on floor tiles, SE / S / SW / NW x idle, walk, work.

  python3 -I tools/blender/experiments/species/preview.py <raw dir> <out dir>
    -> species-1x.png, species-3x.png, species-walk.mp4 (human / rock / slime rows, SE S SW NW)"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "tools/blender"))
from sprites import compose  # noqa: E402

BG = (14, 17, 22)
OUTLINE_MUL, OUTLINE_ADD = 0.42, np.array([4, 5, 10.0])
RIM, RIM_MIX = np.array([120, 205, 255.0]), 0.38
HUMAN = {"team.skin": (232, 190, 150), "team.hair": (70, 48, 34), "team.cloth": (60, 96, 150), "team.accent": (200, 150, 40)}
LAYERS = ["body", "legs.cargo_pants", "gear.belt.tool_belt", "eyes.organic", "hair.short", "arm.L.flesh", "arm.R.flesh", "torso.tee"]
DIRS = [("SE", 0), ("S", 1), ("SW", 2), ("NW", 4)]
FRAMES = [("idle", 0), ("walk", 2), ("work", 3)]
FEET = (124 // 2 + 1, 84 + 1)                       # human_render ORIGIN in the padded raw frame
SHIFT = lambda a, dy, dx: np.roll(a, (dy, dx), (0, 1))  # noqa: E731


def human(man, assets, d, clip, frame):
    cv, gl = np.zeros((140, 120, 4), np.uint8), np.zeros((140, 120, 4), np.uint8)
    for lid in sorted(LAYERS, key=lambda i: man["assets"]["crew.human." + i]["order"]):
        a = man["assets"]["crew.human." + lid]
        sh = man["sheets"][a["sheet"]]
        img = np.array(Image.open(assets / sh["image"]).convert("RGBA"))
        col = a["clips"][clip]["start"] + frame
        fw, fh = a["frameW"], a["frameH"]
        sl = (slice(d * fh, (d + 1) * fh), slice(col * fw, (col + 1) * fw))
        compose.over(cv, compose.remap_keys(img[sl], HUMAN), 60 - a["anchor"]["x"], 120 - a["anchor"]["y"])
    return cv, gl


def raw(npz, d, clip, frame):
    cv, gl = np.zeros((140, 120, 4), np.uint8), np.zeros((140, 120, 4), np.uint8)
    key = f"{d}_{clip}_{frame}"
    compose.over(cv, npz[key], 60 - FEET[0], 120 - FEET[1])
    if key + "_glow" in npz:
        compose.over(gl, npz[key + "_glow"], 60 - FEET[0], 120 - FEET[1])
    return cv, gl


def outline_rim(cv):
    rgb, op = cv[..., :3].astype(float), cv[..., 3] >= 128
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


def cell(layers, floor):
    cv, gl = layers
    base = np.zeros((140, 120, 4), np.uint8)
    base[..., :3], base[..., 3] = BG, 255
    t, an = floor
    for gx in (-1, 0, 1):
        for gy in (-1, 0, 1):
            compose.over(base, t, 60 + (gx - gy) * 32 - an["x"], 120 + (gx + gy) * 16 - an["y"])
    rgb, op = outline_rim(cv)
    cv = cv.copy()
    cv[..., :3], cv[..., 3] = rgb, op * 255
    compose.over(base, cv, 0, 0)
    compose.add(base, gl, 0, 0, 1.5)
    return base[28:128, 22:98, :3]


def main():
    rawdir, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    assets = ROOT / "public/assets"
    man = json.loads((assets / "manifest.json").read_text())
    a = man["assets"]["tile.floor.a"]
    f = a["frame"]
    img = np.array(Image.open(assets / man["sheets"][a["sheet"]]["image"]).convert("RGBA"))
    floor = (img[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]], a["anchor"])
    kinds = [("human", None), ("rock", np.load(rawdir / "rock.npz")), ("slime", np.load(rawdir / "slime.npz"))]
    blocks = []
    for name, npz in kinds:
        rows = []
        for _, d in DIRS:
            rows.append(np.hstack([cell(human(man, assets, d, c, i) if npz is None else raw(npz, d, c, i), floor) for c, i in FRAMES]))
        blocks.append(np.vstack(rows))
    gap = np.zeros((blocks[0].shape[0], 6, 3), np.uint8)
    sheet = np.hstack([blocks[0], gap, blocks[1], gap, blocks[2]])
    for s in (1, 3):
        im = Image.fromarray(sheet).resize((sheet.shape[1] * s, sheet.shape[0] * s), Image.NEAREST)
        dr = ImageDraw.Draw(im)
        for k, (name, _) in enumerate(kinds):
            dr.text((k * (blocks[0].shape[1] + 6) * s + 4, 2), name, fill=(230, 230, 240))
        im.save(out / f"species-{s}x.png")
    walk = []                                           # the walk cycle, every direction, as a clip
    for i in range(8):
        row = []
        for name, npz in kinds:
            row.append(np.hstack([cell(human(man, assets, d, "walk", i) if npz is None else raw(npz, d, "walk", i), floor)
                                  for _, d in DIRS]))
        fr = np.vstack(row)
        walk.append(Image.fromarray(fr).resize((fr.shape[1] * 3, fr.shape[0] * 3), Image.NEAREST))
    import subprocess
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        for k, im in enumerate(walk * 4):
            im.save(f"{d}/f{k:04d}.png")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "10", "-i", f"{d}/f%04d.png", "-c:v", "libx264",
                        "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-crf", "18", str(out / "species-walk.mp4")],
                       check=True)
    print("wrote", out)


main()
