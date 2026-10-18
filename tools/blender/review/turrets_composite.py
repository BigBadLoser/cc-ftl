"""Composite the turret concept sprites (from proto_turrets.py) into review sheets at 1x and 3x. Plain python (numpy + PIL).
  python3 tools/blender/review/turrets_composite.py <work dir> <out dir> [H S R]"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
AS = ROOT / "public/assets"
D, OUTD = Path(sys.argv[1]), Path(sys.argv[2])
DIRS = [a for a in sys.argv[3:] if a in ("H", "S", "R")] or ["H", "S", "R"]
MAN = json.loads((AS / "manifest.json").read_text())["assets"]
ENV = np.array(Image.open(AS / "sprites/env.png").convert("RGBA")).astype(np.float32)
BG = np.array([10, 14, 22], np.float32)
GHOST = 0.30
TITLE = {"H": ("H  HALO", "barrel through a train of coil hoops, breech drum"),
         "S": ("S  SPONSON", "armoured drum, twin barrel carriages on side trunnions"),
         "R": ("R  REVOLVER", "revolving chamber cluster / six-barrel rotary on a pintle")}


class Scene:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 3), np.float32) + BG

    def blit(self, rgba, glow, x0, y0, alpha=1.0):
        x0, y0 = int(x0), int(y0)
        h, w = rgba.shape[:2]
        ya, yb, xa, xb = max(0, -y0), min(h, self.h - y0), max(0, -x0), min(w, self.w - x0)
        if ya >= yb or xa >= xb:
            return
        dst = self.px[y0 + ya:y0 + yb, x0 + xa:x0 + xb]
        src = rgba[ya:yb, xa:xb].astype(np.float32)
        a = src[..., 3:4] / 255 * alpha
        dst[:] = dst * (1 - a) + src[..., :3] * a
        if glow is not None:
            g = glow[ya:yb, xa:xb].astype(np.float32)
            dst[:] = np.minimum(255, dst + g[..., :3] * (g[..., 3:4] / 255) * alpha)

    def ghost(self, rgba, glow, x0, y0, alpha=GHOST):
        """Own-ship cutaway turret: 30% alpha with a thin light outline (what the renderer will do)."""
        a = rgba[..., 3] > 0
        p = np.pad(a, 1)
        inner = a & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
        r = rgba.astype(np.float32).copy()
        r[..., 3] *= alpha
        r[inner, :3] = (180, 215, 245)
        r[inner, 3] = 150
        self.blit(r, None if glow is None else glow, x0, y0, 1.0)

    def asset(self, aid, cx, cy, dim=1.0):
        a = MAN[aid]
        f, an = a["frame"], a["anchor"]
        t = ENV[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]].copy()
        t[..., :3] *= dim
        self.blit(t, None, int(cx - an["x"]), int(cy - an["y"]))

    def sprite(self, tag, cx, cy, ghost=False):
        z = np.load(D / f"{tag}.npz")
        if ghost:
            self.ghost(z["rgba"], z["glow"] // 3, cx - int(z["ox"]), cy - int(z["oy"]))
        else:
            self.blit(z["rgba"], z["glow"], cx - int(z["ox"]), cy - int(z["oy"]))

    def image(self):
        return Image.fromarray(np.clip(self.px, 0, 255).astype(np.uint8))


def crew(sc, cx, cy, d=0, frame=0):
    tone = {"skin": (212, 156, 116), "cloth": (114, 132, 95), "hair": (58, 42, 30)}
    for sid in ("crew.human.body", "crew.human.legs.cargo_pants", "crew.human.torso.work_shirt", "crew.human.hair.short"):
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


def ring_mask(x, y, lo, hi):
    on = lambda a, b: (a in (lo, hi) or b in (lo, hi)) and lo <= a <= hi and lo <= b <= hi  # noqa: E731
    return (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)


def trim(img, pad=8):
    a = np.abs(np.asarray(img).astype(np.float32) - BG).sum(2) > 4
    ys, xs = np.where(a)
    return img.crop((max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad + 1, img.width), min(ys.max() + pad + 1, img.height)))


def roof_scene(d_, kind, dd=0, hot=1):
    n = 5 if kind == "driver" else 4
    sc = Scene(420, 380)
    cx, cy = 210, 300
    sc.sprite(f"roof_{n}", cx, cy)
    sc.sprite(f"t_{d_}_{kind}_{hot}_d{dd}", cx, cy)
    return trim(sc.image())


def bay_scene(d_, ghost=True):
    """Mass driver bay (3x3, tiles 0..2) in a room -1..3: full back walls (at roof height), low front walls, crew."""
    sc = Scene(520, 470)
    T = lambda x, y: (260 + (x - y) * 32, 300 + (x + y) * 16)  # noqa: E731
    lo, hi = -1, 3
    for x in range(lo + 1, hi):
        for y in range(lo + 1, hi):
            sc.asset("tile.floor.a", *T(x, y), dim=0.6)
    items = []
    for x in range(lo, hi + 1):
        for y in range(lo, hi + 1):
            if x not in (lo, hi) and y not in (lo, hi):
                continue
            m = ring_mask(x, y, lo, hi)
            back = y == lo or x == lo
            if back:
                draw = lambda m=m, x=x, y=y: sc.sprite(f"wallf_{m}", *T(x, y))
            else:
                draw = lambda m=m, x=x, y=y: sc.asset(f"tile.wall.m{m}", *T(x, y))
            items.append((x - .5, x + .5, y - .5, y + .5, draw))
    items.append((-0.5, 2.5, -0.5, 2.5, lambda: sc.sprite(f"bay_{d_}", *T(1, 1))))
    for x, y, dd in ((2.75, -0.35, 2), (-0.25, 2.8, 0)):
        items.append((x - .2, x + .2, y - .2, y + .2, lambda x=x, y=y, dd=dd: crew(sc, *T(x, y), d=dd)))
    for it in depth_sort(items):
        it[4]()
    if ghost:
        sc.sprite(f"t_{d_}_driver_1_d0", *T(1, 1), ghost=True)
    return trim(sc.image())


def strip(tags, n=3, labels=None):
    """Sprites side by side, each on its own n x n roof patch."""
    ims = []
    for i, tag in enumerate(tags):
        sc = Scene(360, 340)
        sc.sprite(f"roof_{n}", 180, 260)
        sc.sprite(tag, 180, 260)
        im = trim(sc.image(), pad=4)
        ims.append(label(im, labels[i]) if labels else im)
    h = max(i.height for i in ims)
    out = Image.new("RGB", (sum(i.width for i in ims) + 6 * len(ims), h), tuple(int(c) for c in BG))
    x = 0
    for im in ims:
        out.paste(im, (x, h - im.height))
        x += im.width + 6
    return out


def zoom(img, k=3):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def label(img, text, sub=None):
    out = Image.new("RGB", (img.width, img.height + 22), tuple(int(c) for c in BG))
    out.paste(img, (0, 22))
    dr = ImageDraw.Draw(out)
    dr.text((6, 4), text, fill=(140, 160, 180))
    return out


def main():
    OUTD.mkdir(parents=True, exist_ok=True)
    cols = []
    for d_ in DIRS:
        cells = [label(roof_scene(d_, "laser"), "burst laser turret, charged, aim d0"),
                 label(roof_scene(d_, "driver"), "mass driver turret, charged, aim d0")]
        if (D / f"bay_{d_}.npz").exists():
            cells.append(label(bay_scene(d_), "mass driver bay + crew, turret ghost 30%"))
        for i, c in enumerate(cells):
            zoom(c).save(OUTD / f"{d_}_{i}_3x.png")
        cols.append((d_, cells))
    cw = max(c.width for _, cs in cols for c in cs) + 16
    rows = max(len(cs) for _, cs in cols)
    rh = [max(cs[r].height for _, cs in cols if r < len(cs)) for r in range(rows)]
    sheet = Image.new("RGB", (cw * len(cols), 46 + sum(rh) + 8 * rows), tuple(int(c) for c in BG))
    dr = ImageDraw.Draw(sheet)
    for ci, (d_, cs) in enumerate(cols):
        dr.text((ci * cw + 8, 6), TITLE[d_][0], fill=(235, 235, 235))
        dr.text((ci * cw + 8, 22), TITLE[d_][1], fill=(150, 170, 190))
        y = 46
        for r, c in enumerate(cs):
            sheet.paste(c, (ci * cw + (cw - c.width) // 2, y))
            y += rh[r] + 8
    sheet.save(OUTD / "concepts_1x.png")
    zoom(sheet).save(OUTD / "concepts_3x.png")
    for d_ in DIRS:
        tags = [f"t_{d_}_driver_0_d{k}" for k in range(8)]
        if all((D / f"{t}.npz").exists() for t in tags):
            im = label(strip(tags, labels=[f"d{k}" for k in range(8)]), f"{TITLE[d_][0]}  mass driver, idle, 8 aims")
            im.save(OUTD / f"{d_}_dirs_1x.png")
            zoom(im).save(OUTD / f"{d_}_dirs_3x.png")
        tags = [f"dep_{d_}_stowed"] + [f"dep_{d_}_f{k}" for k in range(5)]
        if all((D / f"{t}.npz").exists() for t in tags):
            im = label(strip(tags, 3, ["stowed"] + [f"deploy f{k}" for k in range(5)]), f"{TITLE[d_][0]}  mass driver: stowed hatch and deploy frames (d0)")
            im.save(OUTD / f"{d_}_deploy_1x.png")
            zoom(im).save(OUTD / f"{d_}_deploy_3x.png")


main()
