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
W, H = 460, 330
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


def build(hot):
    tag = f"r{ROT}{'_active' if hot else ''}"
    z = np.load(D / f"px_{tag}.npz")
    rgba, glow, ox, oy = z["rgba"], z["glow"], int(z["ox"]), int(z["oy"])
    sc = Scene()
    T = lambda x, y: (230 + (x - y) * 32 - 40, 70 + (x + y) * 16)  # noqa: E731
    # footprint x 0..4 (u, toward the hull), y 0..3 ; hull wall column at x = 5
    for x in range(-1, 5):
        for y in range(-1, 5):
            sc.asset("tile.floor.a", *T(x, y), dim=0.6)
    for y in range(-2, 4):
        sc.asset("tile.wall.m5", *T(5, y))
    ex, ey = T(4, 3)
    sc.blit(rgba, glow, ex - ox, ey - oy)
    sc.asset("tile.wall.m5", *T(5, 4))
    crew(sc, *T(1, 4.2))
    crew(sc, *T(-0.2, 2.2), d=7)
    img = Image.fromarray(np.clip(sc.px, 0, 255).astype(np.uint8))
    img.save(D / f"scene_{tag}_1x.png")
    box = (ex - ox - 6, ey - oy - 6, ex - ox + rgba.shape[1] + 6, ey - oy + rgba.shape[0] + 6)
    img.crop(box).resize(((box[2] - box[0]) * 3, (box[3] - box[1]) * 3), Image.NEAREST).save(D / f"scene_{tag}_3x.png")
    # sprite alone, composited on dark with glow, 3x
    alone = Scene()
    alone.px[:] = BG
    alone.blit(rgba, glow, 4, 4)
    im = Image.fromarray(np.clip(alone.px[:rgba.shape[0] + 8, :rgba.shape[1] + 8], 0, 255).astype(np.uint8))
    im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(D / f"sprite_{tag}_3x.png")


for hot in (False, True):
    build(hot)
