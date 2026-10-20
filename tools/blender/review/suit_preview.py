"""Spacesuit look preview (plain python3 + numpy + PIL): a suited crew member (front, side, back; idle and walk; eva_float)
beside an unsuited one, on floor tiles in front of a wall, composited the way the runtime does (palette swap, one outline
round the stack with a cool rim, additive glow).

  python3 -I tools/blender/review/suit_preview.py <crew assets dir> <out dir>  -> suit-1x.png / suit-3x.png"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/blender"))
from sprites import compose  # noqa: E402

BG = (14, 17, 22)
COL = {"team.skin": (232, 190, 150), "team.hair": (70, 48, 34), "team.cloth": (60, 96, 150), "team.accent": (200, 150, 40)}
SUIT = ["body", "legs.eva", "torso.eva", "arm.L.eva", "arm.R.eva", "gear.head.eva_helmet", "gear.back.eva_pack"]
PLAIN = ["body", "eyes.organic", "legs.cargo_pants", "torso.tee", "arm.L.flesh", "arm.R.flesh", "hair.short"]
SHIFT = lambda a, dy, dx: np.roll(a, (dy, dx), (0, 1))  # noqa: E731


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
        f, sh = a["frame"], self.m["sheets"][a["sheet"]]
        cut = lambda im: im[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]]  # noqa: E731
        return cut(self.img(sh["image"])), a["anchor"]

    def frame(self, aid, d, clip, i):
        a = self.m["assets"][aid]
        sh = self.m["sheets"][a["clips"][clip].get("sheet", a.get("sheet"))]
        col, fw, fh = a["clips"][clip]["start"] + i, a["frameW"], a["frameH"]
        sl = (slice(d * fh, (d + 1) * fh), slice(col * fw, (col + 1) * fw))
        g = self.img(sh["glow"])[sl] if "glow" in sh else None
        return self.img(sh["image"])[sl], g, a["anchor"]


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


def crew(A, layers, d, clip, i):
    cv = np.zeros((170, 170, 4), np.uint8)
    glow = np.zeros_like(cv)
    for k in sorted(layers, key=lambda k: A.m["assets"]["crew.human." + k]["order"]):
        img, g, an = A.frame("crew.human." + k, d, clip, i)
        compose.over(cv, compose.remap_keys(img, COL), 85 - an["x"], 140 - an["y"])
        if g is not None:
            compose.over(glow, g, 85 - an["x"], 140 - an["y"])
    return outline_rim(cv), glow


def iso(ox, oy, gx, gy):
    return ox + (gx - gy) * 32, oy + (gx + gy) * 16


def main():
    A, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Assets(ROOT / "public/assets")
    out.mkdir(parents=True, exist_ok=True)
    W, H = 900, 300
    px = np.zeros((H, W, 4), np.uint8)
    px[..., :3], px[..., 3] = BG, 255
    ox, oy = 150, 70
    for gx in range(14):
        for gy in range(3):
            img, an = pub.static("tile.floor.a")
            compose.over(px, img, iso(ox, oy, gx, gy)[0] - an["x"], iso(ox, oy, gx, gy)[1] - an["y"])
    for gx in range(14):
        img, an = pub.static("tile.wall.full.m10")
        x, y = iso(ox, oy, gx, -1)
        compose.over(px, img, x - an["x"], y - an["y"])
    cells = [("suit S idle", SUIT, 1, "idle", 0), ("suit E idle", SUIT, 7, "idle", 0), ("suit N idle", SUIT, 5, "idle", 0),
             ("suit S walk", SUIT, 1, "walk", 2), ("suit E walk", SUIT, 7, "walk", 6),
             ("eva_float SE f0", SUIT, 0, "eva_float", 0), ("eva_float SE f1", SUIT, 0, "eva_float", 1),
             ("plain S idle", PLAIN, 1, "idle", 0), ("plain E idle", PLAIN, 7, "idle", 0)]
    labels = []
    for k, (lab, layers, d, clip, i) in enumerate(cells):
        gx = 1 + k * 1.5
        x, y = iso(ox, oy, gx, 1.5)
        x, y = int(x), int(y)
        c, g = crew(A, layers, d, clip, i)
        compose.over(px, c, x - 85, y - 140)
        compose.add(px, g, x - 85, y - 140)
        labels.append((x - 34, y + 14 + (k % 2) * 10, lab))
    im = Image.fromarray(px[..., :3])
    for s in (1, 3):
        big = im.resize((W * s, H * s), Image.NEAREST)
        dr = ImageDraw.Draw(big)
        for x, y, t in labels:
            dr.text((x * s, y * s), t, fill=(220, 225, 235))
        big.save(out / f"suit-{s}x.png")
    print("wrote", out)


if __name__ == "__main__":
    main()
