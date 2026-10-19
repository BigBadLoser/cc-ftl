"""Beam (truss) look preview (plain python3 + numpy + PIL): a test layout per look (straight run, L, T, + junction,
free end, capped end, hull-wall flange) beside a small hull-walled room with a storage module and a crew member.

  python3 -I tools/blender/review/beams_preview.py <struct assets dir> <out dir>
    -> beams-1x.png / beams-3x.png"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/blender"))
from sprites import compose  # noqa: E402

BG = (10, 12, 18)
HUMAN = {"team.skin": (232, 190, 150), "team.hair": (70, 48, 34), "team.cloth": (60, 96, 150), "team.accent": (200, 150, 40)}
LAYERS = ["body", "legs.cargo_pants", "eyes.organic", "hair.short", "arm.L.flesh", "arm.R.flesh", "torso.tee"]
ROOM = (0, 0, 3, 2)                     # interior x0, y0, x1, y1 (the hull ring is one tile round it)
BEAMS = [(x, 1) for x in range(5, 13)] + [(8, y) for y in range(-2, 5) if y != 1] + [(11, y) for y in (2, 3, 4)] + \
        [(9, 4), (10, 4)]
CAPS = [((8, -2), "n")]
FLANGES = [((5, 1), "w")]


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
        return self.img(sh["image"])[sl], a["anchor"]


def human(pub, d=1):
    cv = np.zeros((160, 160, 4), np.uint8)
    for k in sorted(LAYERS, key=lambda k: pub.m["assets"]["crew.human." + k]["order"]):
        img, an = pub.frame("crew.human." + k, d, "idle", 0)
        compose.over(cv, compose.remap_keys(img, HUMAN), 80 - an["x"], 130 - an["y"])
    return cv


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


def mask(cells, x, y):
    return sum(b for b, (dx, dy) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))) if (x + dx, y + dy) in cells)


def scene(cv, st, pub, look, ox, oy):
    x0, y0, x1, y1 = ROOM
    ring = {(x, y) for x in range(x0 - 1, x1 + 2) for y in range(y0 - 1, y1 + 2)
            if not (x0 <= x <= x1 and y0 <= y <= y1)}
    beams = set(BEAMS)
    draw = []
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, x, y))
    for x, y in ring:
        mk = mask(ring, x, y)
        near = x == x1 + 1 or y == y1 + 1
        aid = f"tile.hull.ghost.m{mk}" if near else f"tile.hull.full.m{mk}"
        draw.append((x + y, pub, aid, x, y))
    for x, y in beams:
        mk = mask(beams, x, y)
        aid = f"struct.beam.{look}.m{mk}"
        if mk in (5, 10) and (x * 7 + y * 3) % 3:
            aid += f".v{(x * 7 + y * 3) % 3}"
        draw.append((x + y, st, aid, x, y))
    for (x, y), d in CAPS:
        draw.append((x + y + 0.001, st, f"struct.beam.{look}.cap.{d}", x, y))
    for (x, y), d in FLANGES:
        draw.append((x + y + 0.001, st, f"struct.beam.{look}.flange.{d}", x, y))
    draw.append((1 + 1, pub, "module.storage.partial", 1, 1))
    draw.append((2 + 1 + 0.02, None, "crew", 2, 1))
    for _, A, aid, x, y in sorted(draw, key=lambda t: t[0]):
        sx, sy = iso(ox, oy, x, y)
        if A is None:
            compose.over(cv.px, human(pub), sx - 80, sy - 130)
        elif A.has(aid):
            cv.static(A, aid, sx, sy)
        else:
            print("missing", aid)
    cv.labels.append((ox - 60, oy - 120, f"look: {look}"))


def main():
    st, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(1060, 470)
    scene(cv, st, pub, "drone", 200, 150)
    scene(cv, st, pub, "civil", 700, 150)
    for s in (1, 3):
        cv.save(out / f"beams-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
