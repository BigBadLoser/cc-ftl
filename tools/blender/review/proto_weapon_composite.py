"""Composite the weapon prototype sprites (from proto_weapon.py's .npz) into test scenes, each at 1x and 3x nearest-neighbour:
  a_<w>: own-ship cutaway (low walls, bay on the floor, crew for scale, turret ~45% alpha at roof height)
  b_<w>: enemy roofed view (roof tiles over the room, turret on top, idle + charged side by side)
  c_strip: aim direction strip, idle and charged, both weapons
Plain python (numpy + PIL).   python3 tools/blender/review/proto_weapon_composite.py <proto dir>"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
AS = ROOT / "public/assets"
D = Path(sys.argv[1])
MAN = json.loads((AS / "manifest.json").read_text())["assets"]
ENV = np.array(Image.open(AS / "sprites/env.png").convert("RGBA")).astype(np.float32)
BG = np.array([10, 14, 22], np.float32)
GHOST = 0.30


class Scene:
    def __init__(self, w, h, stars=True):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 3), np.float32) + BG
        rng = np.random.default_rng(3)
        for _ in range(w * h // 2500 if stars else 0):
            self.px[rng.integers(0, h), rng.integers(0, w)] = rng.integers(70, 150)

    def blit(self, rgba, glow, x0, y0, alpha=1.0):
        x0, y0 = int(x0), int(y0)
        h, w = rgba.shape[:2]
        for dy in range(h):
            y = y0 + dy
            if not 0 <= y < self.h:
                continue
            xs = np.arange(w) + x0
            ok = (xs >= 0) & (xs < self.w)
            xo = xs[ok]
            a = rgba[dy, ok, 3:4] / 255 * alpha
            self.px[y, xo] = self.px[y, xo] * (1 - a) + rgba[dy, ok, :3] * a
            if glow is not None:
                self.px[y, xo] = np.minimum(255, self.px[y, xo] + glow[dy, ok, :3] * (glow[dy, ok, 3:4] / 255) * alpha)

    def ghost(self, rgba, glow, x0, y0, alpha=GHOST):
        """Semi-transparent sprite with a thin light inner outline (own-ship cutaway turret)."""
        a = rgba[..., 3] > 0
        p = np.pad(a, 1)
        inner = a & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
        r = rgba.copy()
        r[inner, :3] = (190, 225, 255)
        r[inner, 3] = 255
        a_map = np.where(inner, 0.7, alpha)
        r2 = r.copy()
        r2[..., 3] = r[..., 3] * a_map
        self.blit(r2, glow, x0, y0, 1.0)

    def asset(self, aid, cx, cy, dim=1.0):
        a = MAN[aid]
        f, an = a["frame"], a["anchor"]
        t = ENV[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]].copy()
        t[..., :3] *= dim
        self.blit(t, None, int(cx - an["x"]), int(cy - an["y"]))

    def save(self, name, crop=None, zoom=None):
        """1x = crop (whole room); 3x = nearest-neighbour zoom of `zoom` (the weapon) or of the crop."""
        img = Image.fromarray(np.clip(self.px, 0, 255).astype(np.uint8))
        full = img.crop(crop) if crop else img
        full.save(D / f"{name}_v2_1x.png")
        z = img.crop(zoom) if zoom else full
        z.resize((z.width * 3, z.height * 3), Image.NEAREST).save(D / f"{name}_v2_3x.png")


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
    z = np.load(D / f"px2_{tag}.npz")
    return z["rgba"], z["glow"], int(z["ox"]), int(z["oy"])


def ring_mask(x, y, lo, hi):
    on = lambda a, b: (a in (lo, hi) or b in (lo, hi)) and lo <= a <= hi and lo <= b <= hi  # noqa: E731
    return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)


def region_mask(x, y, lo, hi):
    ins = lambda a, b: lo <= a <= hi and lo <= b <= hi  # noqa: E731
    return (1 if ins(x, y - 1) else 0) | (2 if ins(x + 1, y) else 0) | (4 if ins(x, y + 1) else 0) | (8 if ins(x - 1, y) else 0)


WEAPONS = {"laser": dict(n=4, c=1.5, size=2, crew=[(3.3, 1.2, 1), (0.2, 3.2, 3)]), "driver": dict(n=5, c=2.0, size=3, crew=[(4.1, 1.0, 1), (0.0, 4.2, 3)])}


def room_scene(w, charged_pair=None, mode="cut", ghost_tag=None):
    """mode 'cut': own ship. mode 'roof': enemy view with the turrets in ghost_tag list [(tag, bx_offset)]."""
    S = WEAPONS[w]
    n, c = S["n"], S["c"]
    W_, H_ = (n + 2) * 64 + 120, (n + 2) * 32 + 330
    sc = Scene(W_, H_)
    cx, cy0 = W_ // 2, 190
    T = lambda x, y: (cx + (x - y) * 32 - (n - 1) * 0, cy0 + (x + y) * 16 + 16)  # noqa: E731
    lo, hi = -1, n
    wid = "tile.hull" if mode == "cut" else "tile.hull.full"
    bay = load(f"bay_{w}")
    items = []
    for x in range(lo + 1, hi):
        for y in range(lo + 1, hi):
            sc.asset("tile.floor.a", *T(x, y), dim=0.6)
    for x in range(lo, hi + 1):
        for y in range(lo, hi + 1):
            if x in (lo, hi) or y in (lo, hi):
                m = ring_mask(x, y, lo, hi)
                items.append((x - .5, x + .5, y - .5, y + .5, lambda m=m, x=x, y=y: sc.asset(f"{wid}.m{m}", *T(x, y))))
    bx, by = c, c
    if mode == "cut":
        h = S["size"] / 2
        items.append((bx - h, bx + h, by - h, by + h, lambda: sc.blit(bay[0], bay[1], T(bx, by)[0] - bay[2], T(bx, by)[1] - bay[3])))
        for x, y, d in S["crew"]:
            items.append((x - .2, x + .2, y - .2, y + .2, lambda x=x, y=y, d=d: crew(sc, *T(x, y), d=d)))
    for it in depth_sort(items):
        it[4]()
    if mode == "roof":
        for x in range(lo, hi + 1):
            for y in range(lo, hi + 1):
                sc.asset(f"roof.generic.m{region_mask(x, y, lo, hi)}", *T(x, y))
    ax, ay = T(bx, by)
    sc.crop = (cx - (n + 1) * 32 - 30, cy0 - 130, cx + (n + 1) * 32 + 30, cy0 + 16 + 2 * n * 16 + 70)
    sc.zoom = (ax - 130, ay - 180, ax + 130, ay + 90)
    return sc, T, (bx, by)


def main():
    for w in WEAPONS:
        # (a) own-ship cutaway, turret ghost idle (k1) and charged ghost on a second copy of the room to the side
        sc, T, (bx, by) = room_scene(w, mode="cut")
        for tag in (f"turret_{w}_k1",):
            r, g, ox, oy = load(tag)
            sc.ghost(r, g, T(bx, by)[0] - int(ox), T(bx, by)[1] - int(oy))
        sc.save(f"scene_a_{w}", sc.crop, sc.zoom)
        # (b) enemy roofed view: idle k1, then charged k1
        for hot in (False, True):
            sc, T, (bx, by) = room_scene(w, mode="roof")
            r, g, ox, oy = load(f"turret_{w}_k1{'_charged' if hot else ''}")
            sc.blit(r, g, T(bx, by)[0] - ox, T(bx, by)[1] - oy)
            sc.save(f"scene_b_{w}{'_charged' if hot else ''}", sc.crop, sc.zoom)
    # (c) direction strip
    cell = 190
    sc = Scene(cell * 6, 2 * 150, stars=False)
    for row, w in enumerate(("laser", "driver")):
        i = 0
        for hot in (False, True):
            for k in range(3):
                r, g, ox, oy = load(f"turret_{w}_k{k}{'_charged' if hot else ''}")
                sc.blit(r, g, i * cell + cell // 2 - ox, row * 150 + 95 - oy)
                i += 1
    sc.save("strip_c")


main()
