"""Bar style kit sheet (plain python3 + numpy + PIL): each part of tools/blender/sprites/barkit.py on its own floor
patch, numbered, a crew member beside the stool for scale, and a row of the palette's swatches.

  python3 -I tools/blender/review/barkit_preview.py <barkit assets dir> <out dir>  -> barkit-1x.png / -3x.png / -6x.png"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, human, iso  # noqa: E402

PARTS = (("k01", (1, 1), "01 stool"), ("k02", (1, 1), "02 mugs"), ("k03", (1, 1), "03 tap heads"),
         ("k04", (2, 1), "04 counter, pleated"), ("k05", (2, 1), "05 counter, panelled"), ("k06", (2, 2), "06 booth"),
         ("k07", (1, 1), "07 table"), ("k08", (1, 1), "08 dispenser"), ("k09", (1, 1), "09 canisters"),
         ("k10", (1, 1), "10 fittings"), ("k11", (2, 1), "11 back console"))
COLS, CW, CH, SW = 4, 170, 128, 46


def save(cv, path, s):
    """As Canvas.save, with the label font scaled to the sheet."""
    im = Image.fromarray(cv.px[..., :3])
    im = im.resize((im.width * s, im.height * s), Image.NEAREST)
    dr, font = ImageDraw.Draw(im), ImageFont.load_default(size=7 * s)
    for x, y, t in cv.labels:
        dr.text((x * s, y * s), t, fill=(220, 225, 235), font=font)
    im.save(path)


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    rows = (len(PARTS) + COLS - 1) // COLS
    cv = Canvas(CW * COLS, CH * rows + SW)
    for i, (v, (w, d), name) in enumerate(PARTS):
        cx, cy = (i % COLS) * CW + CW // 2 + 10, (i // COLS) * CH + 92
        for gx in range(-w, 1):
            for gy in range(-d, 1):
                floor(cv, pub, *iso(cx, cy, gx, gy), 1, 1)
        cv.static(G, f"module.barkit.{v}", cx, cy)
        if v == "k01":
            cv.char(human(pub, 6), *iso(cx, cy, 1, -1))
        cv.labels.append((cx - 80, cy + 22, name))
    pal = json.loads((ROOT / "tools/blender/palette_extra.json").read_text())
    sw = [(k, v["hex"]) for k, v in pal.items() if v.get("set") == "bar9"]
    y0, n = CH * rows + 8, len(sw)
    step = cv.px.shape[1] // n
    for i, (k, h) in enumerate(sw):
        x = i * step + 4
        cv.px[y0:y0 + 16, x:x + step - 4, :3] = [int(h[j:j + 2], 16) for j in (1, 3, 5)]
        cv.labels.append((x, y0 + 18, k[2:]))
    for s in (1, 3, 6):
        save(cv, out / f"barkit-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
