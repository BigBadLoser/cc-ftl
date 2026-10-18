"""Airlock look preview (plain python3 + numpy + PIL): a room ringed by hull with an airlock in each hull side (all 4
rotations), in a wall view level, with crew for scale; and a door-states strip. Composites the way the runtime layers
it: floors and the keep-out deck marks, then tiles and airlock parts by tile depth (each part anchored at its own
tile), crew at +0.02, the collar at the tile beyond the hull row + 0.5 (like the engine bell).

  python3 -I tools/blender/review/airlock_preview.py <airlock assets dir> <out dir>
    -> airlock-<up|cut|low>-1x.png / -3x.png, airlock-states-1x.png / -3x.png"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/blender"))
from sprites import compose  # noqa: E402

BG = (14, 17, 22)
HUMAN = {"team.skin": (232, 190, 150), "team.hair": (70, 48, 34), "team.cloth": (60, 96, 150), "team.accent": (200, 150, 40)}
LAYERS = ["body", "legs.cargo_pants", "gear.belt.tool_belt", "eyes.organic", "hair.short", "arm.L.flesh", "arm.R.flesh",
          "torso.tee"]
SHIFT = lambda a, dy, dx: np.roll(a, (dy, dx), (0, 1))  # noqa: E731
PRE = {"up": "full.", "cut": "", "low": "low."}
W_, H_ = 12, 10                   # room interior
AIRLOCKS = {0: (3, -1), 3: (-1, 6), 1: (W_, 3), 2: (8, H_)}       # rotation -> the hull-row tile of the housing
OUT = {0: (0, -1), 1: (1, 0), 2: (0, 1), 3: (-1, 0)}                # module u (outward) and v (along) in the grid
ALONG = {0: (1, 0), 1: (0, 1), 2: (-1, 0), 3: (0, -1)}


class Assets:
    def __init__(self, d):
        self.d = Path(d)
        self.m = json.loads((self.d / "manifest.json").read_text())
        self._img = {}

    def img(self, rel):
        if rel not in self._img:
            self._img[rel] = np.array(Image.open(self.d / rel).convert("RGBA"))
        return self._img[rel]

    def has(self, aid):
        return aid in self.m["assets"]

    def static(self, aid):
        a = self.m["assets"][aid]
        f, sh = a["frame"], self.m["sheets"][a["sheet"]]
        cut = lambda im: im[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]]  # noqa: E731
        return cut(self.img(sh["image"])), (cut(self.img(sh["glow"])) if "glow" in sh else None), a["anchor"]

    def frame(self, aid, d, clip, i):
        a = self.m["assets"][aid]
        sh = self.m["sheets"][a["sheet"]]
        col, fw, fh = a["clips"][clip]["start"] + i, a["frameW"], a["frameH"]
        sl = (slice(d * fh, (d + 1) * fh), slice(col * fw, (col + 1) * fw))
        return self.img(sh["image"])[sl], (self.img(sh["glow"])[sl] if "glow" in sh else None), a["anchor"]


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
    out[rim] = out[rim] * 0.62 + np.array([120, 205, 255.0]) * 0.38
    out[ring] = (ns / np.maximum(cnt, 1)[..., None])[ring] * 0.42 + np.array([4, 5, 10.0])
    res = np.zeros_like(cv)
    res[..., :3], res[..., 3] = np.clip(out, 0, 255).astype(np.uint8), (op | ring) * 255
    return res


def human(pub, d, clip="idle", i=0):
    cv = np.zeros((160, 160, 4), np.uint8)
    for k in sorted(LAYERS, key=lambda k: pub.m["assets"]["crew.human." + k]["order"]):
        img, _, an = pub.frame("crew.human." + k, d, clip, i)
        compose.over(cv, compose.remap_keys(img, HUMAN), 80 - an["x"], 130 - an["y"])
    return outline_rim(cv)


def iso(ox, oy, gx, gy):
    return ox + (gx - gy) * 32, oy + (gx + gy) * 16


class Canvas:
    def __init__(self, w, h):
        self.px = np.zeros((h, w, 4), np.uint8)
        self.px[..., :3], self.px[..., 3] = BG, 255
        self.labels = []

    def static(self, A, aid, sx, sy):
        img, g, an = A.static(aid)
        compose.over(self.px, img, sx - an["x"], sy - an["y"])
        if g is not None:
            compose.add(self.px, g, sx - an["x"], sy - an["y"])

    def save(self, path, scale):
        im = Image.fromarray(self.px[..., :3])
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        dr = ImageDraw.Draw(im)
        for x, y, t in self.labels:
            dr.text((x * scale, y * scale), t, fill=(220, 225, 235))
        im.save(path)


def tile(rot, hull, u, v):
    """Grid tile of module tile (u, v) (u = 1 is the hull row, v = 0 the housing's column)."""
    (ox, oy), (ax, ay) = OUT[rot], ALONG[rot]
    return hull[0] + (u - 1) * ox + v * ax, hull[1] + (u - 1) * oy + v * ay


def hull_id(gx, gy, level, near):
    ring = lambda x, y: -1 <= x <= W_ and -1 <= y <= H_ and (x in (-1, W_) or y in (-1, H_))  # noqa: E731
    mask = sum(b for b, (ax, ay) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))) if ring(gx + ax, gy + ay))
    return _hull(mask, level, near, (1 if gy == H_ else 0) | (2 if gx == W_ else 0))


def _hull(mask, level, near, o):
    if near:
        return f"tile.hull.o{o}.m{mask}"
    return f"tile.hull.ghost.m{mask}" if level == "low" else f"tile.hull.{PRE[level]}m{mask}"


def airlock_parts(rot, hull, st, level):
    """(depth, asset id, gx, gy) for one airlock in state st = (outer, inner, light, docked); keep-out marks first
    (deck level, depth -1000)."""
    o, i, light, docked = st
    T = lambda u, v: tile(rot, hull, u, v)  # noqa: E731
    d = lambda t, k: t[0] + t[1] + k  # noqa: E731
    out = [(-1000, f"module.airlock.keepout.r{rot}.{n}", *T(-1, v)) for n, v in (("l", -1), ("m", 0), ("r", 1))]
    out += [(d(T(0, v), 0.01), f"module.airlock.unloader.r{rot}", *T(0, v)) for v in (-1, 1)]
    out += [(d(T(0, 0), 0.01), f"module.airlock.housing.r{rot}.{i}", *T(0, 0)),
            (d(T(0, 0), 0.012), f"module.airlock.light.r{rot}.{light}", *T(0, 0)),
            (d(T(1, 0), 0.01), f"module.airlock.hull.r{rot}.{level}", *T(1, 0)),
            (d(T(2, 0), 0.5), f"module.airlock.collar.r{rot}.{o}" + (".docked" if docked else ""), *T(2, 0))]
    return out


def paint(cv, al, pub, ox, oy, draw):
    for d, kind, pay, gx, gy in sorted(draw, key=lambda t: t[0]):
        sx, sy = iso(ox, oy, gx, gy)
        if kind == "pub":
            cv.static(pub, pay, sx, sy)
        elif kind == "al":
            if al.has(pay):
                cv.static(al, pay, sx, sy)
            else:
                print("missing", pay)
        else:
            compose.over(cv.px, human(pub, pay), sx - 80, sy - 130)


def scene(al, pub, out, level):
    cv = Canvas(860, 600)
    ox, oy = 400, 120
    states = {0: ("closed", "open", "green", False), 3: ("closed", "closed", "red", False),
              1: ("open", "closed", "green", True), 2: ("f2", "closed", "red", False)}
    gaps = set(AIRLOCKS.values())
    for gx in range(W_):
        for gy in range(H_):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
    draw = []
    for gx in range(-1, W_ + 1):
        for gy in range(-1, H_ + 1):
            if (0 <= gx < W_ and 0 <= gy < H_) or (gx, gy) in gaps:
                continue
            hid = hull_id(gx, gy, level, gx == W_ or gy == H_)
            if pub.has(hid):
                draw.append((gx + gy, "pub", hid, gx, gy))
    for r, hull in AIRLOCKS.items():
        draw += [(d, "al", aid, gx, gy) for d, aid, gx, gy in airlock_parts(r, hull, states[r], level)]
    for d, gx, gy in ((1, 4, 2), (4, 10, 4), (6, 4, 5), (2, 8, 7)):
        draw.append((gx + gy + 0.02, "crew", d, gx, gy))
    paint(cv, al, pub, ox, oy, draw)
    for r, (hx, hy) in AIRLOCKS.items():
        sx, sy = iso(ox, oy, hx, hy)
        cv.labels.append((sx - 30, sy + 16, f"r{r} out {states[r][0]} / in {states[r][1]} / {states[r][2]}"
                          + (" / docked" if states[r][3] else "")))
    cv.labels.append((8, 6, f"wall view: {level}"))
    for s in (1, 3):
        cv.save(out / f"airlock-{level}-{s}x.png", s)


SEQ = [("closed", "closed", "green", False, "idle"), ("closed", "f1", "green", False, "inner f1"),
       ("closed", "f2", "green", False, "inner f2"), ("closed", "open", "green", False, "inner open"),
       ("closed", "closed", "red", False, "cycling"), ("f1", "closed", "red", True, "outer f1, docked"),
       ("f2", "closed", "red", True, "outer f2, docked"), ("open", "closed", "green", True, "outer open, docked")]


def states(al, pub, out, level="cut"):
    """A cycle (in from the ship, cycle, out to a docked shuttle), seen from inboard (r0, north hull) and from
    outside (r2, south hull), in cutaway (the default view)."""
    cw, ch = 270, 270
    cv = Canvas(cw * len(SEQ), 2 * ch)
    for row, (rot, hull, near) in enumerate(((0, (1, -1), False), (2, (1, 3), True))):
        for k, st in enumerate(SEQ):
            sub = Canvas(cw, ch)
            ox, oy = (cw // 2, 135) if rot == 0 else (cw // 2 + 50, 95)
            for gx in range(-1, 4):
                for gy in range(0, 3):
                    sub.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
            draw = [(gx + hull[1], "pub", _hull(10, level, near, 1), gx, hull[1]) for gx in range(-1, 4) if gx != 1]
            draw += [(d, "al", aid, gx, gy) for d, aid, gx, gy in airlock_parts(rot, hull, st[:4], level)]
            if st[4] in ("inner open", "outer open, docked"):
                gy = 1 if rot == 0 else 1
                draw.append((1 + gy + 0.02 if st[4] == "inner open" else 1 + (0 if rot == 0 else 2) + 0.02, "crew",
                             6 if rot == 0 else 2, 1, gy if st[4] == "inner open" else (0 if rot == 0 else 2)))
            paint(sub, al, pub, ox, oy, draw)
            cv.px[row * ch:(row + 1) * ch, k * cw:(k + 1) * cw] = sub.px
            cv.labels.append((k * cw + 4, row * ch + ch - 12, f"r{rot} {st[4]}"))
    for s in (1, 3):
        cv.save(out / f"airlock-states-{s}x.png", s)


def main():
    al, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets")
    out.mkdir(parents=True, exist_ok=True)
    for level in ("up", "cut", "low"):
        scene(al, pub, out, level)
    states(al, pub, out)
    print("wrote", out)


if __name__ == "__main__":
    main()
