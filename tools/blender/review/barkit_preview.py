"""Bar style kit sheet (plain python3 + numpy + PIL): each treatment of tools/blender/sprites/barkit.py on its sample
block on a 2x1 floor, coded by row (P padding, S panels, E edges and trims, D details), and the palette's swatches.

  python3 -I tools/blender/review/barkit_preview.py <barkit assets dir> <out dir>  -> barkit-1x.png / -3x.png / -6x.png"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, iso  # noqa: E402

PARTS = tuple((v, (2, 1), name) for v, name in (
    ("p1", "P1 tuck and roll"), ("p2", "P2 channels"), ("p3", "P3 biscuit"), ("p4", "P4 roll and pleat"),
    ("p5", "P5 cushion, piped"), ("p6", "P6 bolster"),
    ("s1", "S1 seams, bolts"), ("s2", "S2 inset"), ("s3", "S3 ribs"), ("s4", "S4 corrugated"), ("s5", "S5 grille"),
    ("s6", "S6 louvre"),
    ("e1", "E1 lip and top"), ("e2", "E2 bullnose"), ("e3", "E3 stepped edge"), ("e4", "E4 lit kick"),
    ("e5", "E5 edge band"), ("e6", "E6 round end"),
    ("d1", "D1 porthole"), ("d2", "D2 hatch"), ("d3", "D3 indicators"), ("d4", "D4 pipe, clamps"),
    ("d5", "D5 rivets"), ("d6", "D6 stencil plate")))
COLS, CW, CH, SW = 6, 140, 108, 46


def save(cv, path, s):
    """As Canvas.save, with the label font scaled to the sheet."""
    im = Image.fromarray(cv.px[..., :3])
    im = im.resize((im.width * s, im.height * s), Image.NEAREST)
    dr, font = ImageDraw.Draw(im), ImageFont.load_default(size=6 * s)
    for x, y, t in cv.labels:
        dr.text((x * s, y * s), t, fill=(220, 225, 235), font=font)
    im.save(path)


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    rows = (len(PARTS) + COLS - 1) // COLS
    cv = Canvas(CW * COLS, CH * rows + SW)
    for i, (v, (w, d), name) in enumerate(PARTS):
        cx, cy = (i % COLS) * CW + CW // 2 + 16, (i // COLS) * CH + 72
        for gx in range(-w + 1, 1):
            for gy in range(-d + 1, 1):
                floor(cv, pub, *iso(cx, cy, gx, gy), 1, 1)
        cv.static(G, f"module.barkit.{v}", cx, cy)
        cv.labels.append((cx - 66, cy + 14, name))
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
