"""Lay out the cells written by blender_cells.py into labelled sheet(s): python3 blender_sheet.py <cells dir> <out.png>"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

D = Path(sys.argv[1])
cells = json.loads((D / "cells.json").read_text())
F = lambda n, s: ImageFont.truetype(f"/usr/share/fonts/truetype/dejavu/DejaVuSans{n}.ttf", s)  # noqa: E731
BG = (14, 18, 24)
groups = [("HULL WEAPONS, idle and charged (r1: muzzle to the hull on the right)", lambda c: c["kind"] == "prop" and any(k in c["id"] for k in ("laser", "driver", "missile", "ion", "incend")), 4),
          ("ENGINE, SHIELD GENERATORS, CONSOLES, AI CORE", lambda c: c["kind"] == "prop" and not any(k in c["id"] for k in ("laser", "driver", "missile", "ion", "incend")), 4),
          ("ROOF TILES (enemy roofed view)", lambda c: c["id"].startswith("roof."), 4),
          ("FX FRAMES (projectiles, muzzle flash, shield ripple, explosion)", lambda c: c["id"].startswith("fx."), 6)]
blocks, H = [], 20
for title, f, cols in groups:
    cs = [c for c in cells if f(c)]
    if not cs:
        continue
    cw, ch = max(c["w"] for c in cs), max(c["h"] for c in cs) + 22
    rows = (len(cs) + cols - 1) // cols
    blocks.append((title, cs, cols, cw, ch, H))
    H += 40 + rows * ch
Wd = max(b[2] * b[3] for b in blocks) + 16
sheet = Image.new("RGB", (Wd, H), BG)
d = ImageDraw.Draw(sheet)
for title, cs, cols, cw, ch, y0 in blocks:
    d.text((8, y0 + 6), title, fill=(255, 255, 255), font=F("-Bold", 18))
    for i, c in enumerate(cs):
        x, y = 8 + (i % cols) * cw, y0 + 40 + (i // cols) * ch
        sheet.paste(Image.open(D / f"{c['id']}.png").convert("RGB"), (x, y + 20))
        d.text((x + 6, y + 2), c["id"], fill=(190, 205, 220), font=F("", 13))
sheet.save(sys.argv[2])
print(sheet.size)
