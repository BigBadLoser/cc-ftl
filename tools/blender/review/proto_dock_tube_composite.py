"""Composite the docking-tube preview over in-game crops: the shuttle side-docked (held off the hull by GAP tiles beyond the
flush position) at the starter's west airlock and a staged north one, the tube extending from retracted to mated, then the
collar's clamps. The far-side shuttle and tube are drawn only where the in-game crop is empty space (they lie behind the hull);
the collar sprite goes over the crop. Plain python (numpy + PIL).
  python3 tools/blender/review/proto_dock_tube_composite.py <work dir> <crops dir (game_<dir>.png, crops.json)> <out dir>"""
import json
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import compose  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
W, C, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
A = Path(sys.argv[4]) if len(sys.argv) > 4 else ROOT / "public/assets/1x"      # asset dir with the airlock sheet (a scratch build)
MAN = json.loads((A / "manifest.json").read_text())
SHEET = np.array(Image.open(A / "sprites/airlock.png").convert("RGBA"))
GLOW = np.array(Image.open(A / "sprites/airlock.glow.png").convert("RGBA"))
Z_PX = 16 * math.sqrt(6)
HATCH_U, HATCH_V, COLLAR_FACE, DOCK_Z = 1.40, 0.817, 0.2, 0.95 - 1.3
GAP = 1.1                                   # how much further out than flush the shuttle holds off (= the tube's one length)
CASES = {"west": (4, 3, (-1, 0)), "north": (6, 0, (0, -1))}      # name -> (d, airlock rotation, outward)
STEPS = ("tube retracted (nothing on the hull)", "tube extending", "tube extending", "tube mated, collar clamps")


def sprite(aid):
    a = MAN["assets"][aid]
    f = a["frame"]
    sl = (slice(f["y"], f["y"] + f["h"]), slice(f["x"], f["x"] + f["w"]))
    return SHEET[sl], GLOW[sl], a["anchor"]


def npz(tag):
    z = np.load(W / f"{tag}.npz")
    return z["rgba"], z["g"], {"x": int(z["ax"]), "y": int(z["ay"])}


def put(px, rgba, glow, an, cx, cy):
    compose.over(px, rgba, int(cx - an["x"]), int(cy - an["y"]))
    if glow is not None:
        compose.add(px, glow, int(cx - an["x"]), int(cy - an["y"]))


def frame_image(name, i):
    d, rot, out = CASES[name]
    game = np.array(Image.open(C / f"game_{name}.png").convert("RGBA"))
    col = json.loads((C / "crops.json").read_text())[name]["collar"]
    cx, cy = col["x"], col["y"]
    nose = (out[1], -out[0])
    dx = out[0] * (COLLAR_FACE + HATCH_V + GAP) - nose[0] * HATCH_U
    dy = out[1] * (COLLAR_FACE + HATCH_V + GAP) - nose[1] * HATCH_U
    sx, sy = cx + (dx - dy) * 32, cy + (dx + dy) * 16 - DOCK_Z * Z_PX
    layer = np.zeros_like(game)
    layer[..., 3] = 255
    for tag in (f"dock_d{d}",) + ((f"tube_d{d}_{i}",) if i else ()):
        r, g, an = npz(tag)
        put(layer, r, g, an, sx, sy)
    bg = game[..., :3].astype(int).sum(-1) < 34
    bg[:110] = False                          # the HUD stays
    bg[:, 880:] = False
    px = game.copy()
    px[bg] = layer[bg]
    docked = i == len(STEPS) - 1
    r, g, an = sprite(f"module.airlock.collar.r{rot}.{'open.docked' if docked else 'closed'}")
    put(px, r, g, an, cx, cy)
    im = Image.fromarray(px[..., :3].copy()).crop((cx - 250, cy - 180, cx + 250, cy + 150))
    ImageDraw.Draw(im).text((6, 5), f"{name} hull: {STEPS[i]}", fill=(190, 205, 220))
    return im


OUT.mkdir(parents=True, exist_ok=True)
for name in CASES:
    ims = [frame_image(name, i) for i in range(len(STEPS))]
    w, h = ims[0].size
    strip = Image.new("RGB", (w * 2, h * 2))
    for k, im in enumerate(ims):
        strip.paste(im, ((k % 2) * w, (k // 2) * h))
    strip.save(OUT / f"dock_tube_{name}_1x.png")
    strip.resize((strip.width * 3, strip.height * 3), Image.NEAREST).save(OUT / f"dock_tube_{name}_3x.png")
    ims[-1].resize((w * 3, h * 3), Image.NEAREST).save(OUT / f"dock_tube_{name}_mated_3x.png")
print("ok")
