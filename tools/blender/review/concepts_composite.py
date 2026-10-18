"""Composite the weapon concept sprites (from proto_concepts.py) into the A/B/C concept sheets at 1x and 3x.
  python3 tools/blender/review/concepts_composite.py <dir>"""
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
    z = np.load(D / f"cx_{tag}.npz")
    return z["rgba"], z["glow"], int(z["ox"]), int(z["oy"])


def ring_mask(x, y, lo, hi):
    on = lambda a, b: (a in (lo, hi) or b in (lo, hi)) and lo <= a <= hi and lo <= b <= hi  # noqa: E731
    return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)


def region_mask(x, y, lo, hi):
    ins = lambda a, b: lo <= a <= hi and lo <= b <= hi  # noqa: E731
    return (1 if ins(x, y - 1) else 0) | (2 if ins(x + 1, y) else 0) | (4 if ins(x, y + 1) else 0) | (8 if ins(x - 1, y) else 0)



DIRS = {"A": "A  NAVAL GUN-HOUSE", "B": "B  OPEN GIMBAL", "C": "C  SLEEK POD"}
SUB = {"A": "armoured dome, sleeved barrels, slotted brakes", "B": "exposed yoke, cannon body + recoil sleeve", "C": "teardrop pod, recessed round barrels"}


def roof_patch(d, n, part, bay=None):
    """n x n roof tiles with the charged turret (enemy view)."""
    W_, H_ = (n + 2) * 64, (n + 2) * 32 + 250
    sc = Scene(W_, H_, stars=False)
    cx, cy0 = W_ // 2, 200
    T = lambda x, y: (cx + (x - y) * 32, cy0 + (x + y) * 16 + 16)  # noqa: E731
    for x in range(n):
        for y in range(n):
            sc.asset(f"roof.generic.m{region_mask(x, y, 0, n - 1)}", *T(x, y))
    r, g, ox, oy = load(f"{d}_{part}")
    c = (n - 1) / 2
    sc.blit(r, g, T(c, c)[0] - ox, T(c, c)[1] - oy)
    return sc


def bay_scene(d, n=5):
    c = (n - 1) / 2
    W_, H_ = (n + 2) * 64, (n + 2) * 32 + 250
    sc = Scene(W_, H_, stars=False)
    cx, cy0 = W_ // 2, 200
    T = lambda x, y: (cx + (x - y) * 32, cy0 + (x + y) * 16 + 16)  # noqa: E731
    lo, hi = -1, n
    for x in range(lo + 1, hi):
        for y in range(lo + 1, hi):
            sc.asset("tile.floor.a", *T(x, y), dim=0.6)
    bay = load(f"{d}_bay_driver")
    items = []
    for x in range(lo, hi + 1):
        for y in range(lo, hi + 1):
            if x in (lo, hi) or y in (lo, hi):
                m = ring_mask(x, y, lo, hi)
                items.append((x - .5, x + .5, y - .5, y + .5, lambda m=m, x=x, y=y: sc.asset(f"tile.hull.m{m}", *T(x, y))))
    items.append((c - 1.5, c + 1.5, c - 1.5, c + 1.5, lambda: sc.blit(bay[0], bay[1], T(c, c)[0] - bay[2], T(c, c)[1] - bay[3])))
    for x, y, dd in ((4.15, 0.4, 1), (-0.1, 4.2, 3)):
        items.append((x - .2, x + .2, y - .2, y + .2, lambda x=x, y=y, dd=dd: crew(sc, *T(x, y), d=dd)))
    for it in depth_sort(items):
        it[4]()
    # ghost of the turret at roof height (own-ship view)
    r, g, ox, oy = load(f"{d}_turret_driver")
    sc.ghost(r, g, T(c, c)[0] - ox, T(c, c)[1] - oy)
    return sc


def main():
    from PIL import ImageDraw
    cells = {}
    for d in DIRS:
        cells[d] = [roof_patch(d, 4, "turret_laser"), roof_patch(d, 5, "turret_driver"), bay_scene(d)]
    # crops: trim blank rows/cols of each scene to the used area
    def trim(s, pad=10):
        m = np.abs(s.px - BG).sum(2) > 4
        ys, xs = np.where(m)
        im = Image.fromarray(np.clip(s.px, 0, 255).astype(np.uint8))
        return im.crop((max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, s.w), min(ys.max() + pad, s.h)))
    imgs = {d: [trim(s) for s in cells[d]] for d in DIRS}
    ROWS = ["burst laser turret 2x2", "mass driver turret 3x3", "mass driver bay + crew (turret ghost 30%)"]
    cw = max(i.width for d in DIRS for i in imgs[d])
    rh = [max(imgs[d][r].height for d in DIRS) for r in range(3)]
    head, lab = 70, 28
    sheet1 = Image.new("RGB", (3 * cw, head + sum(rh) + 3 * lab), (10, 14, 22))
    dr = ImageDraw.Draw(sheet1)
    for ci, d in enumerate(DIRS):
        dr.text((ci * cw + 12, 10), DIRS[d], fill=(240, 240, 240))
        dr.text((ci * cw + 12, 30), SUB[d], fill=(150, 170, 190))
        y = head
        for r in range(3):
            dr.text((ci * cw + 12, y + 4), ROWS[r], fill=(120, 140, 160))
            im = imgs[d][r]
            sheet1.paste(im, (ci * cw + (cw - im.width) // 2, y + lab))
            y += rh[r] + lab
    sheet1.save(D / "concepts_1x.png")
    sheet1.resize((sheet1.width * 3, sheet1.height * 3), Image.NEAREST).save(D / "concepts_3x.png")
    for d in DIRS:   # individual 3x cells too, cropped to the weapon
        w2 = imgs[d][1]
        w2.resize((w2.width * 3, w2.height * 3), Image.NEAREST).save(D / f"driver_roof_{d}_3x.png")


main()
