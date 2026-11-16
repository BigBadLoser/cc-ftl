"""Look study sheets (plain python3 + numpy + PIL): the shared part of the per-family previews. Each option is a small
scene (a sprite on a floor patch, crew for scale, more sprites around it), cropped to what is drawn, laid out side by
side in rows, scaled up with nearest neighbour and labelled in DejaVu Sans after scaling, so labels stay sharp.

As a script, it previews any study straight from its manifest:

  python3 -I tools/blender/review/study_sheet.py <study assets dir> <out.png> <label=id,...> [options]
    id      an asset id; `module.booth.e1` also finds `module.booth.e1.on` and adds `.holo` over it when there is one
    --scale N        whole-number zoom (default 3)
    --columns N      options per row (default: all in one row up to 6)
    --floor N        floor tiles around the footprint (default 1; 0 for none)
    --crew           a crew member beside each option, for scale
    --title TEXT     a line above the sheet

From another preview script:

  from study_sheet import Scene, Study, sheet
  st = Study(assets_dir)                       # the study's sprites, plus public/assets/1x for floor and crew
  sc = st.scene().floor(-2, -2, 3, 2).sprite("module.booth.e1").crew(1, -1)
  sheet([("E1  curved", sc), ...], out_png, scale=3)

Placement follows the game: a sprite's anchor sits on its tile's centre, a module on its front-most tile, the footprint
reaching back to smaller gx and gy."""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, human  # noqa: E402
from sprites import compose  # noqa: E402  (robots_preview put tools/blender on the path)

BG = (22, 25, 31)
LABEL = (225, 230, 238)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
TW, TH = 64, 32
MARGIN, GAP = 8, 8          # around each scene and between cells, in sprite pixels before scaling


def iso(gx, gy):
    """A tile's centre on screen, relative to tile (0, 0)."""
    return (gx - gy) * TW // 2, (gx + gy) * TH // 2


class Study:
    def __init__(self, assets, pub=ROOT / "public/assets/1x"):
        self.a = Assets(assets)
        self.pub = Assets(pub)

    def find(self, aid):
        """(Assets, id) for an id in the study, else in public/assets."""
        for src in (self.a, self.pub):
            if aid in src.m["assets"]:
                return src, aid
        raise KeyError(f"no asset {aid} in {self.a.d} or {self.pub.d}")

    def layers(self, aid):
        """The ids that draw `aid`: itself, or its `.on` and, when there is one, its `.holo` over it."""
        ids = self.a.m["assets"]
        if aid in ids or aid in self.pub.m["assets"]:
            return [aid]
        if f"{aid}.on" in ids:
            return [f"{aid}.on"] + ([f"{aid}.holo"] if f"{aid}.holo" in ids else [])
        raise KeyError(f"no asset {aid} (nor {aid}.on) in {self.a.d}")

    def footprint(self, aid):
        src, aid = self.find(self.layers(aid)[0])
        return tuple(src.m["assets"][aid].get("footprint", (1, 1)))

    def scene(self):
        return Scene(self)


class Scene:
    """Draw calls in order (back to front is the caller's job, as in the game); rendered on its own canvas."""

    def __init__(self, study):
        self.st = study
        self.ops = []           # (rgba, glow or None, x, y) in screen pixels, tile (0, 0) at the origin

    def _put(self, src, aid, gx, gy):
        img, glow, an = src.static(aid)
        sx, sy = iso(gx, gy)
        self.ops.append((img, glow, sx - an["x"], sy - an["y"]))
        return self

    def sprite(self, aid, gx=0, gy=0):
        for layer in self.st.layers(aid):
            self._put(*self.st.find(layer), gx, gy)
        return self

    def floor(self, gx0, gy0, gx1, gy1, tile="tile.floor.a"):
        """Floor tiles over gx0..gx1, gy0..gy1 (inclusive)."""
        for gx in range(gx0, gx1 + 1):
            for gy in range(gy0, gy1 + 1):
                self._put(*self.st.find(tile), gx, gy)
        return self

    def crew(self, gx, gy, d=6, clip="idle", i=0):
        """A human crew member standing on the tile (d: 0 SE, 2 SW, 4 NW, 6 NE)."""
        rgba, glow = human(self.st.pub, d, clip, i)
        sx, sy = iso(gx, gy)
        self.ops.append((rgba, glow, sx - 80, sy - 130))
        return self

    def render(self):
        """The scene cropped to its drawn pixels plus MARGIN, as an RGB array on BG."""
        boxes = []
        for img, _, x, y in self.ops:
            ys, xs = np.nonzero(img[..., 3])
            if len(xs):
                boxes.append((x + xs.min(), y + ys.min(), x + xs.max() + 1, y + ys.max() + 1))
        if not boxes:
            return np.zeros((2 * MARGIN, 2 * MARGIN, 3), np.uint8) + np.array(BG, np.uint8)
        x0, y0 = min(b[0] for b in boxes) - MARGIN, min(b[1] for b in boxes) - MARGIN
        x1, y1 = max(b[2] for b in boxes) + MARGIN, max(b[3] for b in boxes) + MARGIN
        px = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        px[..., :3], px[..., 3] = BG, 255
        for img, glow, x, y in self.ops:      # the runtime blends glow sprites 'add' at full strength
            compose.over(px, img, x - x0, y - y0)
            if glow is not None:
                compose.add(px, glow, x - x0, y - y0, 1.0)
        return px[..., :3]


def sheet(cells, out, scale=3, columns=None, title=None):
    """[(label, Scene or RGB array)] -> one PNG: rows of `columns`, each cell as wide as its row's widest, scenes
    bottom-aligned and centred, labels under them. Returns the image size."""
    ims = [c.render() if isinstance(c, Scene) else c for _, c in cells]
    cols = columns or (len(ims) if len(ims) <= 6 else int(np.ceil(np.sqrt(len(ims)))))
    rows = [list(range(r, min(r + cols, len(ims)))) for r in range(0, len(ims), cols)]
    font = ImageFont.truetype(FONT, 7 * scale + 7)
    big = ImageFont.truetype(FONT, 9 * scale + 10)
    lh = font.getbbox("Ag")[3] + scale * 2
    th = big.getbbox("Ag")[3] + GAP * scale if title else 0
    cw = max(max(ims[i].shape[1] for i in row) for row in rows) * scale
    cw = max(cw, max(int(font.getlength(label)) + 8 for label, _ in cells))
    rh = [max(ims[i].shape[0] for i in row) * scale + lh for row in rows]
    g = GAP * scale
    canvas = Image.new("RGB", (cols * cw + (cols + 1) * g, th + sum(rh) + (len(rows) + 1) * g), BG)
    d = ImageDraw.Draw(canvas)
    if title:
        d.text((g, g), title, fill=LABEL, font=big)
    y = th + g
    for row, h in zip(rows, rh):
        for k, i in enumerate(row):
            im = Image.fromarray(ims[i]).resize((ims[i].shape[1] * scale, ims[i].shape[0] * scale), Image.NEAREST)
            x = g + k * (cw + g)
            canvas.paste(im, (x + (cw - im.width) // 2, y + h - lh - im.height))
            label = cells[i][0]
            d.text((x + (cw - font.getlength(label)) / 2, y + h - lh + scale * 2), label, fill=LABEL, font=font)
        y += h + g
    canvas.save(out)
    return canvas.size


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("assets")
    p.add_argument("out")
    p.add_argument("spec", help="label=id,...")
    p.add_argument("--scale", type=int, default=3)
    p.add_argument("--columns", type=int)
    p.add_argument("--floor", type=int, default=1)
    p.add_argument("--crew", action="store_true")
    p.add_argument("--title")
    a = p.parse_args()
    st = Study(a.assets)
    cells = []
    for item in a.spec.split(","):
        label, _, aid = item.rpartition("=")
        w, h = st.footprint(aid)
        sc = st.scene()
        if a.floor:
            sc.floor(1 - w - a.floor, 1 - h - a.floor, a.floor, a.floor)
        if a.crew and h > 1:       # beside the back-right corner, behind the module's front
            sc.crew(1, -h)
        sc.sprite(aid)
        if a.crew and h == 1:
            sc.crew(1, -h)
        cells.append((label or aid, sc))
    print(a.out, sheet(cells, a.out, a.scale, a.columns, a.title))


if __name__ == "__main__":
    main()
