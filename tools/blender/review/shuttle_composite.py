"""Composite the shuttle review sprites (shuttle_preview.py's .npz files) on the shipped floor and wall tiles with crew
for scale: the parked craft in the placeholder pit inside a room (1x and 3x nearest-neighbour), and the flight
sprites on space (1x and 3x). Plain python (numpy + PIL), no Blender.
  python3 tools/blender/review/shuttle_composite.py <preview dir>"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
AS = ROOT / "public/assets/2x"
D = Path(sys.argv[1])
MAN = json.loads((AS / "manifest.json").read_text())["assets"]
ENV = np.array(Image.open(AS / "sprites/env.png").convert("RGBA")).astype(np.float32)
GLW = np.array(Image.open(AS / "sprites/env.glow.png").convert("RGBA")).astype(np.float32)
BG = np.array([10, 14, 22], np.float32)


class Scene:
    def __init__(self, W, H, stars=0):
        self.W, self.H = W, H
        self.px = np.zeros((H, W, 3), np.float32) + BG
        rng = np.random.default_rng(3)
        for _ in range(stars):
            self.px[rng.integers(0, H), rng.integers(0, W)] = rng.integers(70, 150)

    def blit(self, rgba, glow, x0, y0, dim=1.0):
        h, w = rgba.shape[:2]
        for dy in range(h):
            y = y0 + dy
            if not 0 <= y < self.H:
                continue
            xs = np.arange(w) + x0
            ok = (xs >= 0) & (xs < self.W)
            xo = xs[ok]
            a = rgba[dy, ok, 3:4] / 255
            self.px[y, xo] = self.px[y, xo] * (1 - a) + rgba[dy, ok, :3] * dim * a
            if glow is not None:
                self.px[y, xo] = np.minimum(255, self.px[y, xo] + glow[dy, ok, :3] * (glow[dy, ok, 3:4] / 255))

    def asset(self, aid, cx, cy, dim=1.0):
        a = MAN[aid]
        f, an = a["frame"], a["anchor"]
        sl = (slice(f["y"], f["y"] + f["h"]), slice(f["x"], f["x"] + f["w"]))
        self.blit(ENV[sl], GLW[sl] if a.get("glow") else None, int(cx - an["x"]), int(cy - an["y"]), dim)

    def sprite(self, tag, cx, cy):
        z = np.load(D / f"px_{tag}.npz")
        self.blit(z["rgba"], z["glow"], int(cx - int(z["ox"])), int(cy - int(z["oy"])))
        return z["rgba"].shape

    def crew(self, cx, cy, d=0, frame=0):
        """body + legs + torso layers, palette-swap keys remapped to plain tones (scale reference only)."""
        tone = {"skin": (212, 156, 116), "cloth": (114, 132, 95), "hair": (58, 42, 30)}
        for sid in ("crew.human.body", "crew.human.legs.cargo_pants", "crew.human.torso.work_shirt"):
            m = MAN[sid]
            fw, fh, an = m["frameW"], m["frameH"], m["anchor"]
            sheet = np.array(Image.open(AS / f"sprites/{sid}.png").convert("RGBA")).astype(np.float32)
            fr = sheet[d * fh:(d + 1) * fh, frame * fw:(frame + 1) * fw].copy()
            r, g, b = fr[..., 0], fr[..., 1], fr[..., 2]
            mx = np.maximum(np.maximum(r, g), b) + 1e-3
            for name, mask in (("skin", (r > 0.6 * mx) & (b > 0.6 * mx) & (g < 0.3 * mx)),
                               ("cloth", (r > 0.6 * mx) & (g > 0.6 * mx) & (b < 0.3 * mx)),
                               ("hair", (g > 0.6 * mx) & (r < 0.3 * mx) & (b < 0.3 * mx))):
                fr[mask, :3] = np.array(tone[name]) * (mx[mask] / 255)[:, None]
            self.blit(fr, None, int(cx - an["x"]), int(cy - an["y"]))

    def save(self, name, crop=None, scale=1):
        img = Image.fromarray(np.clip(self.px, 0, 255).astype(np.uint8))
        if crop:
            img = img.crop(crop)
        if scale > 1:
            img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
        img.save(D / name)


def room(tag="pit.r0"):
    """9x9 room, full walls on the far sides with a door, the 4x5 pit at x 2..5, y 2..6, crew on the walkways."""
    W, H = 720, 520
    sc = Scene(W, H)
    T = lambda x, y: (360 + (x - y) * 32, 100 + (x + y) * 16)  # noqa: E731
    GW, GD = 9, 9
    hole = {(x, y) for x in range(2, 6) for y in range(2, 7)}
    near = lambda x, y: x >= 6 or y >= 7                          # noqa: E731  tiles in front of the pit's near rim
    for x in range(GW):
        for y in range(GD):
            if (x, y) not in hole and not near(x, y):
                sc.asset("tile.floor.a", *T(x, y))
    walls = [(-1, -1, "tile.wall.full.m6")] + [(x, -1, "tile.door.x" if x == 6 else "tile.wall.full.m10") for x in range(GW)]
    walls += [(-1, y, "tile.wall.full.m5") for y in range(GD)]
    for x, y, aid in sorted(walls, key=lambda t: t[0] + t[1]):
        sc.asset(aid, *T(x, y))
    sc.crew(*T(1.0, 4.5), d=1)                                    # behind the pit
    sc.sprite(tag, *T(3.5, 4.0))                                   # pit + craft, origin = pit centre at deck level
    for x in range(GW):                                            # the deck in front sorts after the pit
        for y in range(GD):
            if near(x, y):
                sc.asset("tile.floor.a", *T(x, y))
    sc.crew(*T(6.6, 3.0), d=3)                                     # on the near walkway
    sc.crew(*T(4.0, 7.5), d=7)
    sc.save("scene_room_1x.png")
    cx, cy = T(3.5, 4.0)
    sc.save("scene_room_3x.png", (cx - 190, cy - 150, cx + 190, cy + 95), 3)


def flight(tags):
    W, H = 160 * len(tags) + 40, 300
    sc = Scene(W, H, stars=int(W * H / 900))
    for i, tag in enumerate(tags):
        sc.sprite(tag, 100 + i * 160, 150)
    sc.save("scene_fly_1x.png")
    sc.save("scene_fly_3x.png", None, 3)


def strip(tags, name, step=180, dim_floor=True):
    """Sprites side by side on a plain deck (parked / docked rotations)."""
    W, H = step * len(tags) + 40, 320
    sc = Scene(W, H)
    for i, tag in enumerate(tags):
        cx, cy = 20 + i * step + step // 2, 170
        if dim_floor:
            for x in range(-2, 3):
                for y in range(-2, 3):
                    sc.asset("tile.floor.a", cx + (x - y) * 32, cy + (x + y) * 16, dim=0.7)
        sc.sprite(tag, cx, cy)
    sc.save(f"scene_{name}_1x.png")
    sc.save(f"scene_{name}_3x.png", None, 3)


def main():
    have = {p.stem[3:] for p in D.glob("px_*.npz")}
    if "pit.r0" in have:
        room()
    fly = [f"fly.d{d}" for d in range(8) if f"fly.d{d}" in have]
    if fly:
        flight(fly)
    for kind in ("parked", "docked"):
        tags = [f"{kind}.r{r}" for r in range(4) if f"{kind}.r{r}" in have]
        if tags:
            strip(tags, kind)
    dm = sorted(t for t in have if t.endswith(".damaged"))
    if dm:
        strip(dm, "damaged", step=240)


main()
