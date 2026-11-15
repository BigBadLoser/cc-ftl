"""Floor look study preview (plain python3 + PIL): each design tiled as a 3x3 patch, labelled, side by side, the plain
deck first for comparison. Designs whose name starts with `m:` sit alone in the middle of a plain-deck patch (marks).

  python3 -I tools/blender/review/floor_preview.py <study assets dir> <out.png> <label=id,...> [scale, default 4]"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

src, out, spec = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
SC = int(sys.argv[4]) if len(sys.argv) > 4 else 4
man = json.loads((src / "manifest.json").read_text())
A, SH = man["assets"], man["sheets"]
TW, TH = man["tile"]["w"], man["tile"]["h"]


def sprite(aid):
    a = A[aid]
    sh = SH[a["sheet"]]
    f = a["frame"]
    box = (f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"])
    im = Image.open(src / sh["image"]).convert("RGBA").crop(box)
    if sh.get("glow"):
        g = Image.open(src / sh["glow"]).convert("RGBA").crop(box)
        rgb = ImageChops.add(im.convert("RGB"), g.convert("RGB"))
        rgb.putalpha(im.getchannel("A"))
        im = rgb
    return im, a["anchor"]


items = [s.split("=", 1) for s in spec.split(",")]
PW, PH = 3 * TW + 16, 3 * TH + 24
canvas = Image.new("RGBA", (PW * len(items), PH), (22, 25, 31, 255))
for n, (label, aid) in enumerate(items):
    mark = aid.startswith("m:")
    aid = aid[2:] if mark else aid
    for gy in range(3):
        for gx in range(3):
            use = aid if not mark or (gx, gy) == (1, 1) else "tile.floor.deck"
            im, an = sprite(use)
            cx = n * PW + PW // 2 + (gx - gy) * TW // 2
            cy = 12 + TH // 2 + (gx + gy) * TH // 2
            canvas.alpha_composite(im, (cx - an["x"], cy - an["y"]))
big = canvas.resize((canvas.width * SC, canvas.height * SC), Image.NEAREST)
d = ImageDraw.Draw(big)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
for n, (label, _) in enumerate(items):
    d.text((n * PW * SC + 16, big.height - 44), label, fill=(225, 230, 238), font=font)
big.convert("RGB").save(out)
print(out, big.size)
