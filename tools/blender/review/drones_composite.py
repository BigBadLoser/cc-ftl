"""Drone prototype preview (plain python3 + numpy + PIL): proto_drones.py's .npz sprites on floor tiles with walls, a crew
member and a module for scale, at 1x and a 3x nearest zoom.
  python3 -I tools/blender/review/drones_composite.py <npz dir> <out dir>
    -> drones-1x.png / drones-3x.png: each type at d0 and d2, flying and working, at ALT over its shadow
       bay-1x.png / bay-3x.png: the bay at r0, empty and with 2 docked
Flight height shows as the sprite lifted ALT * ZPX px over a translucent floor shadow (shadow alpha SHADOW_A)."""
import math
import sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import robots_preview as rp  # noqa: E402
from sprites import compose  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
ZPX = 64 / math.sqrt(2) * math.cos(math.radians(30))     # px per unit of height (core.ZPX)
ALT = 1.1                                                 # cruise altitude indoors (tiles over the deck)
SHADOW_A = 0.4
LIV = rp.LIVERY["player"]


class Pub(rp.Assets):
    """public/assets/1x with the per-clip crew sheets (cells cropped to cw x ch at ox, oy in the full frame)."""

    def frame(self, aid, d, clip, i):
        a = self.m["assets"][aid]
        c = a["clips"][clip]
        if "cw" not in c:
            return super().frame(aid, d, clip, i)
        sh = self.m["sheets"][c["sheet"]]
        sl = (slice(d * c["ch"], (d + 1) * c["ch"]), slice(i * c["cw"], (i + 1) * c["cw"]))
        full = np.zeros((a["frameH"], a["frameW"], 4), np.uint8)
        full[c["oy"]:c["oy"] + c["ch"], c["ox"]:c["ox"] + c["cw"]] = self.img(sh["image"])[sl]
        g = None
        if "glow" in sh:
            g = np.zeros_like(full)
            g[c["oy"]:c["oy"] + c["ch"], c["ox"]:c["ox"] + c["cw"]] = self.img(sh["glow"])[sl]
        return full, g, a["anchor"]


def load(d, tag):
    z = np.load(Path(d) / f"{tag}.npz")
    img = compose.remap_keys(z["rgba"], LIV)
    g = z["glow"] if z["glow"].ndim == 3 and z["glow"].shape[-1] == 4 else None
    return img, g, int(z["ox"]), int(z["oy"])


def put(cv, spr, sx, sy, lift=0.0):
    img, g, ox, oy = spr
    cv.put(img, g, sx - ox, int(round(sy - oy - lift)))


def shade(cv, spr, sx, sy):
    """The shadow sprite blended at SHADOW_A (the runtime draws it translucent)."""
    img, _, ox, oy = spr
    x0, y0 = sx - ox, sy - oy
    h, w = img.shape[:2]
    reg = cv.px[y0:y0 + h, x0:x0 + w, :3].astype(float)
    a = (img[..., 3:4] > 0) * SHADOW_A
    cv.px[y0:y0 + h, x0:x0 + w, :3] = (reg * (1 - a)).astype(np.uint8)


def room(pub, nx, ny, w, h, ox, oy):
    cv = rp.Canvas(w, h)
    rp.floor(cv, pub, ox, oy, nx, ny)
    cv.static(pub, "tile.wall.full.m6", *rp.iso(ox, oy, -1, -1))
    for gx in range(nx):
        cv.static(pub, "tile.wall.full.m10", *rp.iso(ox, oy, gx, -1))
    for gy in range(ny):
        cv.static(pub, "tile.wall.full.m5", *rp.iso(ox, oy, -1, gy))
    return cv


def crew(cv, pub, sx, sy, d=0):
    img, g = rp.human(pub, d)
    cv.put(img, g, sx - 80, sy - 130)


def drones_scene(pub, d, out):
    nx, ny = 13, 6
    ox, oy = ny * 32 + 30, 150
    cv = room(pub, nx, ny, (nx + ny) * 32 + 60, (nx + ny) * 16 + 200, ox, oy)
    draws = [(3.0, lambda: cv.static(pub, "module.life_support.r1", *rp.iso(ox, oy, 3, 0))),   # depth = gx + gy
             (3.9, lambda: crew(cv, pub, *rp.iso(ox, oy, 1, 3)))]
    sh = load(d, "shadow")
    for k, kind in enumerate(("defence", "repair", "medic")):
        for j, (state, dr) in enumerate((("fly", 0), ("fly", 2), ("work", 0), ("work", 2))):
            gx, gy = 5 + j * 2, 1 + k * 1.6
            x, y = (int(round(c)) for c in rp.iso(ox, oy, gx, gy))
            shade(cv, sh, x, y)
            spr = load(d, f"d_{kind}_{state}_{dr}")
            draws.append((gx + gy + 0.5, lambda x=x, y=y, s=spr: put(cv, s, x, y, ALT * ZPX)))
            if k == 2:
                cv.labels.append((x - 22, y + 22, f"{state} d{dr}"))
        lx, ly = rp.iso(ox, oy, 12.6, 1 + k * 1.6)
        cv.labels.append((int(lx), int(ly), kind))
    for _, fn in sorted(draws, key=lambda t: t[0]):
        fn()
    cv.save(out / "drones-1x.png", 1)
    cv.save(out / "drones-3x.png", 3)


def bay_scene(pub, d, out):
    nx, ny = 7, 3
    ox, oy = ny * 32 + 30, 150
    cv = room(pub, nx, ny, (nx + ny) * 32 + 60, (nx + ny) * 16 + 190, ox, oy)
    put(cv, load(d, "bay_0"), *rp.iso(ox, oy, 2, 0))
    cv.labels.append((rp.iso(ox, oy, 1, 1)[0] - 10, rp.iso(ox, oy, 1, 1)[1] + 30, "empty"))
    put(cv, load(d, "bay_2"), *rp.iso(ox, oy, 5, 0))
    cv.labels.append((rp.iso(ox, oy, 4, 1)[0] - 10, rp.iso(ox, oy, 4, 1)[1] + 30, "2 docked"))
    crew(cv, pub, *rp.iso(ox, oy, 3, 2))
    cv.save(out / "bay-1x.png", 1)
    cv.save(out / "bay-3x.png", 3)


if __name__ == "__main__":
    src, dst = sys.argv[1], Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)
    pub = Pub(ROOT / "public/assets/1x")
    drones_scene(pub, src, dst)
    bay_scene(pub, src, dst)
    print("wrote", dst)
