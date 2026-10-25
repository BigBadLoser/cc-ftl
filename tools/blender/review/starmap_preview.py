"""Starmap art contact sheet (plain python3 + numpy + PIL): every `starmap.*` sprite of one art set on the map's background,
colour over, glow added, team keys recoloured to a few faction colours.

  python3 -I tools/blender/review/starmap_preview.py <assets dir> [<assets dir> ...] <out png> [--zoom N]

One panel per assets dir (normally just public/assets/1x), side by side. Sprites are drawn at world size (a 1x set's pixels
doubled, as the game draws them), times zoom (default 1)."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

BG = (4, 8, 14)                                     # theme.css --bg
KEY_LEVELS = (0.30, 0.47, 0.64, 0.82, 1.0)
SHADE_MULT = (0.42, 0.62, 0.82, 1.0, 1.22)
# faction colours to try the tint with: (cloth, accent)
TINTS = {"navy": ((74, 118, 178), (210, 220, 235)), "pirate": ((168, 60, 48), (220, 170, 60)),
         "trader": ((70, 150, 96), (225, 210, 150)), "drone": ((120, 124, 132), (255, 60, 60)),
         "player": ((54, 212, 255), (240, 240, 240))}
KINDS = ("star", "red_dwarf", "blue_giant", "gas_giant", "black_hole", "nebula", "binary_star", "white_dwarf", "pulsar",
         "protostar", "ice_giant", "lava_world", "ocean_world")
STRUCTS = ("station_trade", "station_military", "station_research", "den", "asteroids", "derelict")
ROLES = (("patrol", "navy"), ("pirate", "pirate"), ("raider", "drone"), ("trader", "trader"), ("miner", "trader"),
         ("player", "player"))


class Set:
    def __init__(self, d):
        self.d = Path(d)
        self.m = json.loads((self.d / "manifest.json").read_text())
        self.k = 2 if self.m["tile"]["w"] == 64 else 1          # to world px
        self._img = {}

    def img(self, rel):
        if rel not in self._img:
            self._img[rel] = np.array(Image.open(self.d / rel).convert("RGBA"))
        return self._img[rel]

    def get(self, aid):
        a = self.m["assets"].get(aid)
        if a is None:
            return None
        f, sh = a["frame"], self.m["sheets"][a["sheet"]]
        cut = lambda im: im[f["y"]:f["y"] + f["h"], f["x"]:f["x"] + f["w"]]  # noqa: E731
        c = cut(self.img(sh["image"]))
        g = cut(self.img(sh["glow"])) if "glow" in sh else np.zeros_like(c)
        up = lambda im: im.repeat(self.k, 0).repeat(self.k, 1)  # noqa: E731
        return up(c), up(g)


def tint(c, faction):
    out = c.copy()
    if faction is None:
        return out
    cloth, accent = (np.array(v, float) for v in TINTS[faction])
    for lv, kl in enumerate(KEY_LEVELS):
        v = round(kl * 255)
        for key, base in (((v, v, 0), cloth), ((0, v, v), accent)):
            m = (c[..., :3] == key).all(-1) & (c[..., 3] > 0)
            out[m, :3] = np.clip(base * SHADE_MULT[lv], 0, 255).astype(np.uint8)
    return out


class Canvas:
    def __init__(self, w, h):
        self.a = np.zeros((h, w, 3), float)
        self.a[:] = BG
        self.labels = []

    def put(self, spr, x, y, faction=None, zoom=1):
        c, g = spr
        if zoom > 1:
            c, g = (im.repeat(zoom, 0).repeat(zoom, 1) for im in (c, g))
        c = tint(c, faction)
        h, w = c.shape[:2]
        reg = self.a[y:y + h, x:x + w]
        al = (c[..., 3:4] > 0)
        reg[:] = np.where(al, c[..., :3], reg)
        reg[:] = np.minimum(reg + g[..., :3] * (g[..., 3:4] > 0), 255)

    def label(self, x, y, text):
        self.labels.append((x, y, text))

    def image(self, title=None):
        im = Image.fromarray(self.a.astype(np.uint8))
        d = ImageDraw.Draw(im)
        for x, y, t in self.labels:
            d.text((x, y), t, fill=(127, 169, 192))
        if title:
            d.text((self.a.shape[1] - 12 - 8 * len(title), 4), title, fill=(216, 240, 255))
        return im


def panel(S, zoom, title):
    pad, lab = 12 * zoom, 14
    rows = []                                                    # (label, [(sprite, faction)])
    for kind in KINDS:
        rows.append((kind, [(S.get(f"starmap.body.{kind}.v{v}"), None) for v in range(8) if S.get(f"starmap.body.{kind}.v{v}")]))
    minis = [k for k in sorted(S.m["assets"]) if k.startswith("starmap.mini.") and ".v" in k]
    for kind in KINDS:
        rows.append((f"mini {kind}", [(S.get(k), None) for k in minis if k.startswith(f"starmap.mini.{kind}.v")]))
    rows.append(("exits: gate, rift", [(S.get(f"starmap.exit.{e}"), None) for e in ("gate", "rift")]))
    rows.append(("nebula field: haze, body, core", [(S.get(f"starmap.nebula.{n}"), None) for n in ("haze", "body", "core")]))
    rows.append(("structures", [(S.get(f"starmap.struct.{s}"), None) for s in STRUCTS]))
    for fac in ("navy", "pirate", "trader"):
        rows.append((f"structures ({fac})", [(S.get(f"starmap.struct.{s}"), fac) for s in STRUCTS]))
    for role, fac in ROLES:
        rows.append((f"{role} ({fac})", [(S.get(f"starmap.fleet.{role}.d{d}"), fac) for d in range(8)]))
    rows = [(name, [c for c in cells if c[0] is not None]) for name, cells in rows]
    rows = [(name, cells) for name, cells in rows if cells]
    W = max([pad + sum(c[0][0].shape[1] * zoom + pad for c in cells) for _, cells in rows] + [192 * zoom * 3])
    H = pad + sum(lab + max(c[0][0].shape[0] * zoom for c in cells) + pad for _, cells in rows)
    bd = S.get("starmap.backdrop")
    if bd is not None:
        W = max(W, pad * 2 + 1024 * zoom)
        H += lab + 1024 * zoom + pad
    cv = Canvas(W, H)
    y = pad
    for name, cells in rows:
        cv.label(pad, y, name)
        y += lab
        x = pad
        hmax = max(c[0][0].shape[0] * zoom for c in cells)
        for spr, fac in cells:
            cv.put(spr, x, y + (hmax - spr[0].shape[0] * zoom) // 2, fac, zoom)
            x += spr[0].shape[1] * zoom + pad
        y += hmax + pad
    if bd is not None:
        cv.label(pad, y, "backdrop (2x2 tiles)")
        y += lab
        cv.put((np.tile(bd[0], (2, 2, 1)), np.tile(bd[1], (2, 2, 1))), pad, y, None, zoom)
    return cv.image(title)


def main():
    args = sys.argv[1:]
    zoom = 1
    if "--zoom" in args:
        k = args.index("--zoom")
        zoom = int(args[k + 1])
        del args[k:k + 2]
    *dirs, out = args
    sets = [Set(d) for d in dirs]
    panels = [panel(S, zoom, f"{S.m['tile']['w'] // 64}x set" + (" (drawn at 2x)" if S.k == 2 else "")) for S in sets]
    sheet = Image.new("RGB", (sum(p.width for p in panels), max(p.height for p in panels)), BG)
    x = 0
    for p in panels:
        sheet.paste(p, (x, 0))
        x += p.width
    sheet.save(out)
    print("wrote", out)


main()
