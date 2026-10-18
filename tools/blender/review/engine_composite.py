"""Composite the engine review sprites (engine_review.py .npz) on floor tiles beside hull walls (full height or cut
down) with crew for scale, at 1x and a 3x nearest-neighbour zoom. Plain python (numpy + PIL), no Blender.
  python3 tools/blender/review/engine_composite.py <npz dir> <out dir> [rots..]"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
AS = ROOT / "public/assets"
D, OUT = Path(sys.argv[1]), Path(sys.argv[2])
ROTS = [int(a) for a in sys.argv[3:]] or [1]
MAN = json.loads((AS / "manifest.json").read_text())["assets"]
ENV = np.array(Image.open(AS / "sprites/env.png").convert("RGBA")).astype(np.float32)
W, H = 660, 520
BG = np.array([10, 14, 22], np.float32)


class Scene:
    def __init__(self):
        self.px = np.zeros((H, W, 3), np.float32) + BG
        rng = np.random.default_rng(3)
        for _ in range(80):
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
    tone = {"skin": (212, 156, 116), "cloth": (114, 132, 95), "hair": (58, 42, 30)}
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
    """items: (x0, x1, y0, y1, draw). A is behind B when A ends before B starts on x or y."""
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


def load(tag):
    z = np.load(D / f"px_{tag}.npz")
    return z["rgba"], z["glow"], int(z["ox"]), int(z["oy"])


def build(rot, nb, hot):
    tag = f"r{rot}_{'active' if hot else 'idle'}_{nb}walls"
    hull, mach = load(f"r{rot}_hull"), load(f"r{rot}_machine{'_active' if hot else ''}")
    sc = Scene()
    T = lambda x, y: (300 + (x - y) * 32, 200 + (x + y) * 16)  # noqa: E731
    if rot % 2:   # hull on the east (r1) / west (r3) side: wall row along y
        hx = 4 if rot == 1 else 0
        fx0, fx1, fy0, fy1 = -0.5, 4.5, -0.5, 3.5
        row = lambda x, y: x == hx  # noqa: E731
        floor = [(x, y) for x in (range(-3, 4) if rot == 1 else range(1, 8)) for y in range(-3, 7)]
        nwalls = [(hx, y, f"wall_m5_{nb}") for y in (-3, -2, -1, 4, 5, 6)]
        people = [(0.5, 5.2, 0), (-1.5, -1.6, 7), (2.6, 4.6, 1)] if rot == 1 else [(5.5, 5.2, 0), (6.0, -1.0, 6)]
        front = (4, 3)
    else:         # hull on the north (r0) / south (r2) side: wall row along x
        hy = 0 if rot == 0 else 4
        fx0, fx1, fy0, fy1 = -0.5, 3.5, -0.5, 4.5
        row = lambda x, y: y == hy  # noqa: E731
        floor = [(x, y) for x in range(-3, 7) for y in (range(1, 8) if rot == 0 else range(-3, 4))]
        nwalls = [(x, hy, f"wall_m10_{nb}") for x in (-3, -2, -1, 4, 5, 6)]
        people = [(1.2, 5.6, 0), (-1.6, 2.5, 3), (4.6, 2.2, 1)] if rot == 0 else [(1.5, -1.5, 0)]
        front = (3, 4)
    wallspr = {k: load(k) for k in {w[2] for w in nwalls}}
    for x, y in floor:
        if not (fx0 <= x <= fx1 and fy0 <= y <= fy1) and (x, y) not in {(w[0], w[1]) for w in nwalls}:
            sc.asset("tile.floor.a", *T(x, y), dim=0.6)
    for x in range(int(fx0 + 0.5), int(fx1 + 0.5)):
        for y in range(int(fy0 + 0.5), int(fy1 + 0.5)):
            if not row(x, y):
                sc.asset("tile.floor.a", *T(x, y), dim=0.6)
    ex, ey = T(*front)

    def engine():
        for rgba, glow, ox, oy in (hull, mach):
            sc.blit(rgba, glow, ex - ox, ey - oy)

    def wall(k, x, y):
        rgba, glow, ox, oy = wallspr[k]
        cx, cy = T(x, y)
        sc.blit(rgba, None, cx - ox, cy - oy)
    items = [(fx0, fx1, fy0, fy1, engine)]
    for x, y, k in nwalls:
        items.append((x - 0.5, x + 0.5, y - 0.5, y + 0.5, lambda k=k, x=x, y=y: wall(k, x, y)))
    for x, y, d in people:
        items.append((x - 0.2, x + 0.2, y - 0.2, y + 0.2, lambda x=x, y=y, d=d: crew(sc, *T(x, y), d=d)))
    for it in depth_sort(items):
        it[4]()
    img = Image.fromarray(np.clip(sc.px, 0, 255).astype(np.uint8))
    img.save(OUT / f"scene_{tag}_1x.png")
    xs, ys = [], []
    for rgba, glow, ox, oy in (hull, mach):                     # crop to the engine's opaque pixels (+ margin)
        yy, xx = np.where((rgba[..., 3] > 0) | (glow[..., 3] > 0))
        xs += [xx.min() + ex - ox, xx.max() + ex - ox]
        ys += [yy.min() + ey - oy, yy.max() + ey - oy]
    box = (max(0, min(xs) - 90), max(0, min(ys) - 30), min(W, max(xs) + 40), min(H, max(ys) + 40))
    img.crop(box).resize(((box[2] - box[0]) * 3, (box[3] - box[1]) * 3), Image.NEAREST).save(OUT / f"scene_{tag}_3x.png")
    print("wrote", tag)


OUT.mkdir(parents=True, exist_ok=True)
for rot in ROTS:
    for nb, hot in (("full", False), ("full", True), ("low", False)):
        try:
            build(rot, nb, hot)
        except FileNotFoundError as e:
            print("skip", rot, nb, hot, e)
