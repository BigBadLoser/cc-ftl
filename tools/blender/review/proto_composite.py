"""Composite the prototype engine sprite (from proto_engine.py's .npz) on floor tiles beside a hull wall with a crew
member for scale, at 1x and with a 3x nearest-neighbour zoom. Plain python (numpy + PIL), no Blender.
  python3 tools/blender/review/proto_composite.py <proto dir> [rot]"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
AS = ROOT / "public/assets"
D = Path(sys.argv[1])
ROT = int(sys.argv[2]) if len(sys.argv) > 2 else 1
MAN = json.loads((AS / "manifest.json").read_text())["assets"]
ENV = np.array(Image.open(AS / "sprites/env.png").convert("RGBA")).astype(np.float32)
W, H = 600, 440
BG = np.array([10, 14, 22], np.float32)


class Scene:
    def __init__(self):
        self.px = np.zeros((H, W, 3), np.float32) + BG
        self.px[:] = BG
        rng = np.random.default_rng(3)
        for _ in range(70):
            self.px[rng.integers(0, H), rng.integers(0, W)] = rng.integers(70, 150)

    def blit(self, rgba, glow, x0, y0, dim=1.0):
        h, w = rgba.shape[:2]
        for dy in range(h):
            y = y0 + dy
            if not 0 <= y < H:
                continue
            xs = np.arange(w) + x0
            ok = (xs >= 0) & (xs < W)
            xo = xs[ok]
            a = rgba[dy, ok, 3:4] / 255
            self.px[y, xo] = self.px[y, xo] * (1 - a) + rgba[dy, ok, :3] * dim * a
            if glow is not None:
                self.px[y, xo] = np.minimum(255, self.px[y, xo] + glow[dy, ok, :3] * (glow[dy, ok, 3:4] / 255))

    def asset(self, aid, cx, cy, dim=1.0):
        a = MAN[aid]
        f, an = a["frame"], a["anchor"]
        self.blit(ENV[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]], None, int(cx - an["x"]), int(cy - an["y"]), dim)


def crew(sc, cx, cy, d=0, frame=0):
    """body + legs + torso layers with the palette-swap keys remapped to plain tones (just for scale)."""
    tone = {"skin": (212, 156, 116), "cloth": (114, 132, 95), "hair": (58, 42, 30), "acc": (25, 230, 255)}
    for sid in ("crew.human.body", "crew.human.legs.cargo_pants", "crew.human.torso.work_shirt"):
        m = MAN[sid]
        fw, fh, an = m["frameW"], m["frameH"], m["anchor"]
        sheet = np.array(Image.open(AS / f"sprites/{sid}.png").convert("RGBA")).astype(np.float32)
        fr = sheet[d * fh:(d + 1) * fh, frame * fw:(frame + 1) * fw].copy()
        r, g, b = fr[..., 0], fr[..., 1], fr[..., 2]
        mx = np.maximum(np.maximum(r, g), b) + 1e-3
        for name, mask in (("skin", (r > 0.6 * mx) & (b > 0.6 * mx) & (g < 0.3 * mx)), ("cloth", (r > 0.6 * mx) & (g > 0.6 * mx) & (b < 0.3 * mx)),
                           ("hair", (g > 0.6 * mx) & (r < 0.3 * mx) & (b < 0.3 * mx))):
            fr[mask, :3] = np.array(tone[name]) * (mx[mask] / 255)[:, None]
        sc.blit(fr, None, int(cx - an["x"]), int(cy - an["y"]))


def depth_sort(items):
    """items: (x0, x1, y0, y1, draw). A is behind B when A ends before B starts on x or y (grid +x/+y point at the camera)."""
    out, rest = [], list(items)
    while rest:
        for a in rest:
            if not any(b is not a and (b[1] <= a[0] + 1e-6 or b[3] <= a[2] + 1e-6) and not (a[1] <= b[0] + 1e-6 or a[3] <= b[2] + 1e-6)
                       for b in rest):
                out.append(a)
                rest.remove(a)
                break
        else:
            rest.sort(key=lambda t: t[1] + t[3])
            out.append(rest.pop(0))
    return out


def build(hot):
    tag = f"r{ROT}{'_active' if hot else ''}_v2"
    z = np.load(D / f"px_{tag}.npz")
    rgba, glow, ox, oy = z["rgba"], z["glow"], int(z["ox"]), int(z["oy"])
    sc = Scene()
    # grid coordinates: tile (x, y) centre; r1 footprint x -4..0 (hull row x = 0), y -3..0 shifted so the front tile is (4, 3)
    T = lambda x, y: (250 + (x - y) * 32, 150 + (x + y) * 16)  # noqa: E731
    if ROT == 1:
        fx0, fx1, fy0, fy1, front = -0.5, 4.5, -0.5, 3.5, (4, 3)
        floor = [(x, y) for x in range(-3, 4) for y in range(-3, 7)]
        walls = [(4, y, "tile.hull.m5") for y in (-3, -2, -1, 4, 5, 6)]
        people = [(0.5, 5.2, 0), (-1.5, -1.6, 7), (3.0, 6.3, 1)]
    else:
        fx0, fx1, fy0, fy1, front = -0.5, 3.5, -0.5, 4.5, (3, 4)
        floor = [(x, y) for x in range(-3, 7) for y in range(0, 7)]
        walls = [(x, 0, "tile.hull.m10") for x in (-3, -2, -1, 4, 5, 6)]
        people = [(1.5, 5.8, 0), (-1.0, 2.5, 4), (5.0, 3.5, 2)]
    for x, y in floor:
        if not (fx0 < x < fx1 and fy0 < y < fy1) or True:
            sc.asset("tile.floor.a", *T(x, y), dim=0.6)
    ex, ey = T(*front)
    items = [(fx0, fx1, fy0, fy1, lambda: sc.blit(rgba, glow, ex - ox, ey - oy))]
    for x, y, aid in walls:
        items.append((x - 0.5, x + 0.5, y - 0.5, y + 0.5, lambda aid=aid, x=x, y=y: sc.asset(aid, *T(x, y))))
    for x, y, d in people:
        items.append((x - 0.2, x + 0.2, y - 0.2, y + 0.2, lambda x=x, y=y, d=d: crew(sc, *T(x, y), d=d)))
    for it in depth_sort(items):
        it[4]()
    img = Image.fromarray(np.clip(sc.px, 0, 255).astype(np.uint8))
    img.save(D / f"scene_{tag}_1x.png")
    box = (ex - ox - 70, ey - oy - 30, ex - ox + rgba.shape[1] + 70, ey - oy + rgba.shape[0] + 80)
    img.crop(box).resize(((box[2] - box[0]) * 3, (box[3] - box[1]) * 3), Image.NEAREST).save(D / f"scene_{tag}_3x.png")


for hot in (False, True):
    try:
        build(hot)
    except FileNotFoundError:
        pass
