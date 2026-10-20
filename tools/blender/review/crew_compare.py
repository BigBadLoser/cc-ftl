"""Crew old vs new at game size (plain python3 + numpy + PIL): the same outfits from two asset dirs, composited like the
runtime crew filter (palette swap, one outline round the stack, thin left rim), standing in a small room of the real
floor and wall tiles, at 1x and a 4x nearest-neighbour zoom of the same picture.

  python3 -I tools/blender/review/crew_compare.py <old assets> <new assets> <out.png> [solid]
    solid: the crew-read outline (fixed near-black) instead of the shipped one (darkened neighbour colour)"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import compose  # noqa: E402

BG = (10, 12, 18)
RIM, RIM_MIX = np.array([120, 205, 255.0]), 0.38
SOLID = np.array([10, 15, 22.0])
SHIFT = lambda a, dy, dx: np.roll(a, (dy, dx), (0, 1))  # noqa: E731
CREWS = [{"team.skin": (0xe0, 0xac, 0x84), "team.hair": (0x3b, 0x2a, 0x1c), "team.cloth": (0x3f, 0x7f, 0xbf), "team.accent": (0xff, 0xd2, 0x3a)},
         {"team.skin": (0x9c, 0x6a, 0x48), "team.hair": (0x1c, 0x16, 0x12), "team.cloth": (0xc2, 0x55, 0x2d), "team.accent": (0x37, 0xd2, 0xe8)},
         {"team.skin": (0xf1, 0xc9, 0xa5), "team.hair": (0xa8, 0x76, 0x3a), "team.cloth": (0x4f, 0x9a, 0x5e), "team.accent": (0xff, 0x6a, 0x4a)}]
OUTFITS = [["body", "eyes.organic", "legs.cargo_pants", "torso.work_shirt", "arm.L.flesh", "arm.R.flesh", "hair.short", "gear.belt.tool_belt"],
           ["body", "eyes.organic", "legs.cargo_pants", "torso.tee", "arm.L.flesh", "arm.R.flesh", "hair.ponytail"],
           ["body", "legs.eva", "torso.eva", "arm.L.eva", "arm.R.eva", "gear.head.eva_helmet", "gear.back.eva_pack"]]
# (outfit, palette, direction, clip, frame, tile x, tile y)
CAST = [(0, 0, 0, "idle", 0, 1, 1), (1, 1, 1, "walk", 2, 4, 1), (2, 2, 2, "idle", 0, 1, 4), (1, 0, 7, "walk", 5, 4, 4)]


class Assets:
    def __init__(self, d):
        self.d = Path(d)
        self.m = json.loads((self.d / "manifest.json").read_text())
        self._img = {}

    def img(self, rel):
        if rel not in self._img:
            self._img[rel] = np.array(Image.open(self.d / rel).convert("RGBA"))
        return self._img[rel]

    def static(self, aid):
        a = self.m["assets"][aid]
        f = a["frame"]
        im = self.img(self.m["sheets"][a["sheet"]]["image"])
        return im[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]], a["anchor"]

    def layer(self, lid, d, clip, i):
        a = self.m["assets"].get("crew.human." + lid)
        if a is None:
            return None
        cl = a["clips"].get(clip) or a["clips"]["idle"]
        sh = self.m["sheets"][cl["sheet"]]
        if not (self.d / sh["image"]).exists():          # a stale entry (the new base does not have this item yet)
            return None
        fw, fh = a["frameW"], a["frameH"]
        col = cl["start"] + i % cl["frames"]
        return self.img(sh["image"])[d * fh:(d + 1) * fh, col * fw:(col + 1) * fw], a["anchor"], a["order"]


def crew(A, outfit, pal, d, clip, i, solid):
    cv = np.zeros((120, 128, 4), np.uint8)
    lays = [lay for lay in (A.layer(lid, d, clip, i) for lid in outfit) if lay is not None]
    for img, an, _ in sorted(lays, key=lambda t: t[2]):
        compose.over(cv, compose.remap_keys(img, pal), 64 - an["x"], 94 - an["y"])
    rgb, op = cv[..., :3].astype(float), cv[..., 3] >= 128
    cnt, ns = np.zeros(op.shape), np.zeros(rgb.shape)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        o = SHIFT(op, dy, dx)
        ns += SHIFT(rgb, dy, dx) * o[..., None]
        cnt += o
    ring = ~op & (cnt > 0)
    out = rgb.copy()
    rim = op & ~SHIFT(op, 0, 1) & SHIFT(op, 0, -1)
    out[rim] = out[rim] * (1 - RIM_MIX) + RIM * RIM_MIX
    out[ring] = SOLID if solid else ((ns / np.maximum(cnt, 1)[..., None])[ring] * 0.42 + np.array([4, 5, 10.0]))
    cv[..., :3] = np.clip(out, 0, 255).astype(np.uint8)
    cv[..., 3] = (op | ring) * 255
    return cv


def iso(ox, oy, x, y):
    return ox + (x - y) * 32, oy + (x + y) * 16


def room(A_env, solid, A, label):
    W, H = 330, 250
    cv = np.zeros((H, W, 4), np.uint8)
    cv[..., :3], cv[..., 3] = BG, 255
    ox, oy = 150, 60
    floor, fan = A_env.static("tile.floor.a")
    for y in range(5):
        for x in range(6):
            sx, sy = iso(ox, oy, x, y)
            compose.over(cv, floor, sx - fan["x"], sy - fan["y"])
    walls = [(x, 0, "tile.wall.full.m10") for x in range(6)] + [(0, y, "tile.wall.full.m5") for y in range(1, 5)]
    for x, y, wid in sorted(walls, key=lambda w: w[0] + w[1]):
        if wid in A_env.m["assets"]:
            img, an = A_env.static(wid)
            sx, sy = iso(ox, oy, x, y)
            compose.over(cv, img, sx - an["x"], sy - an["y"])
    for o, p, d, clip, i, x, y in sorted(CAST, key=lambda c: c[5] + c[6]):
        sx, sy = iso(ox, oy, x, y)
        compose.over(cv, crew(A, OUTFITS[o], CREWS[p], d, clip, i, solid), sx - 64, sy - 94)
    return cv[..., :3], label


def main():
    old, new, out = Assets(sys.argv[1]), Assets(sys.argv[2]), Path(sys.argv[3])
    solid = len(sys.argv) > 4 and sys.argv[4] == "solid"
    panels = [room(old, solid, old, "old (as shipped)"), room(old, solid, new, "new base")]
    one = np.hstack([panels[0][0], np.zeros((panels[0][0].shape[0], 6, 3), np.uint8), panels[1][0]])
    im1 = Image.fromarray(one)
    zoom = Image.fromarray(one).resize((one.shape[1] * 4, one.shape[0] * 4), Image.NEAREST)
    sheet = Image.new("RGB", (zoom.width, im1.height + 8 + zoom.height), BG)
    sheet.paste(im1, (0, 0))
    sheet.paste(zoom, (0, im1.height + 8))
    dr = ImageDraw.Draw(sheet)
    for k, (_, lab) in enumerate(panels):
        dr.text((k * 336 + 4, 2), lab + " 1x", fill=(230, 230, 240))
        dr.text((k * 336 * 4 + 8, im1.height + 12), lab + " 4x", fill=(230, 230, 240))
    sheet.save(out)
    print("wrote", out)


if __name__ == "__main__":
    main()
