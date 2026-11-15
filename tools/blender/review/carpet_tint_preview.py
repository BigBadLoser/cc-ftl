"""Tintable carpet preview (plain python3 + PIL): each carpet design (rows) as a patch per faction scheme (columns), recoloured
the way src/render/containerPaint.ts recolours container paint: a grey pixel -> P * lum(px) / lum(#6f7b87); a key pixel
(red mkP / green mkS, any shade) -> P / S flat. The first column is the untinted grey art.

  python3 -I tools/blender/review/carpet_tint_preview.py <study assets dir> <out.png> <label=id,...> [patch, default 4] [scale, default 3]"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

src, out, spec = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
G = int(sys.argv[4]) if len(sys.argv) > 4 else 4
SC = int(sys.argv[5]) if len(sys.argv) > 5 else 3
man = json.loads((src / "manifest.json").read_text())
A, SH = man["assets"], man["sheets"]
TW, TH = man["tile"]["w"], man["tile"]["h"]
# src/render/roofArt.ts SCHEMES (P, S)
SCHEMES = [("grey art", None, None), ("crimson", 0xB0443A, 0xE2DDD0), ("tide", 0x2F8F8A, 0xE2DDD0),
           ("sovereign", 0x26282E, 0xE0B23E), ("velvet", 0x4A1F2E, 0xC9A64A), ("combine", 0x2456A0, 0xE8B830),
           ("hornet", 0xD9822B, 0x25272D)]


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


REF = lum((0x6F, 0x7B, 0x87))


def rgb(h):
    return ((h >> 16) & 255, (h >> 8) & 255, h & 255)


def tint(im, P, S):
    if P is None:
        return im
    P, S = rgb(P), rgb(S)
    px = im.load()
    out = im.copy()
    po = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r > 2 * (g + b) + 20 or g > 2 * (r + b) + 20:
                c = P if r > g else S
            else:
                k = lum((r, g, b)) / REF
                c = tuple(min(255, round(v * k)) for v in P)
            po[x, y] = (*c, a)
    return out


def sprite(aid):
    a = A[aid]
    f = a["frame"]
    im = Image.open(src / SH[a["sheet"]]["image"]).convert("RGBA").crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
    return im, a["anchor"]


rows = [s.split("=", 1) for s in spec.split(",")]
PW, PH = G * TW + 12, G * TH + 12
LW = 90
canvas = Image.new("RGBA", (LW + PW * len(SCHEMES), 14 + PH * len(rows)), (22, 25, 31, 255))
for r, (label, aid) in enumerate(rows):
    base, an = sprite(aid)
    for c, (_, P, S) in enumerate(SCHEMES):
        im = tint(base, P, S)
        for gy in range(G):
            for gx in range(G):
                cx = LW + c * PW + PW // 2 + (gx - gy) * TW // 2
                cy = 14 + r * PH + 6 + TH // 2 + (gx + gy) * TH // 2
                canvas.alpha_composite(im, (cx - an["x"], cy - an["y"]))
big = canvas.resize((canvas.width * SC, canvas.height * SC), Image.NEAREST)
d = ImageDraw.Draw(big)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
for c, (name, _, _) in enumerate(SCHEMES):
    d.text(((LW + c * PW) * SC + 12, 6), name, fill=(225, 230, 238), font=font)
for r, (label, _) in enumerate(rows):
    d.text((12, (14 + r * PH + PH // 2) * SC - 12), label, fill=(225, 230, 238), font=font)
big.convert("RGB").save(out)
print(out, big.size)
