"""Edge-line look study preview (plain python3 + PIL): each style's test shapes (tools/blender/sprites/floor_marks_maps.py)
laid out from its per-tile sprites (tile.mark.<style>.<map>.<x>_<y>), one row per style, one column per map.

  python3 -I tools/blender/review/mark_preview.py <study assets dir> <out.png> <label=style[@map+map],...> [scale, default 2]
(without @, the maps "run" and "stairs")"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "sprites"))
from floor_marks_maps import MAPS  # noqa: E402

src, out, spec = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
SC = int(sys.argv[4]) if len(sys.argv) > 4 else 2
man = json.loads((src / "manifest.json").read_text())
A, SH = man["assets"], man["sheets"]
TW, TH = man["tile"]["w"], man["tile"]["h"]
sheets = {}


def sprite(aid):
    a = A[aid]
    sh = SH[a["sheet"]]
    if sh["image"] not in sheets:
        sheets[sh["image"]] = Image.open(src / sh["image"]).convert("RGBA")
    f = a["frame"]
    return sheets[sh["image"]].crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"])), a["anchor"]


def extent(rows):
    w, h = len(rows[0]), len(rows)
    return (w + h) * TW // 2 + 16, (w + h) * TH // 2 + 16


styles = []
for s in spec.split(","):
    label, st = s.split("=", 1)
    st, _, ms = st.partition("@")
    styles.append((label, st, ms.split("+") if ms else ["run", "stairs"]))
cols = list(dict.fromkeys(m for _, _, ms in styles for m in ms))
CW = [extent(MAPS[m])[0] for m in cols]
RH = max(extent(MAPS[m])[1] for m in cols) + 20
canvas = Image.new("RGBA", (sum(CW), RH * len(styles)), (22, 25, 31, 255))
for r, (label, style, maps) in enumerate(styles):
    x0 = 0
    for c, m in enumerate(cols):
        if m not in maps:
            x0 += CW[c]
            continue
        rows = MAPS[m]
        h = len(rows)
        for y in range(h):
            for x in range(len(rows[0])):
                im, an = sprite(f"tile.mark.{style}.{m}.{x}_{y}")
                cx = x0 + 8 + (x - y + h) * TW // 2
                cy = r * RH + 20 + 8 + TH // 2 + (x + y) * TH // 2
                canvas.alpha_composite(im, (cx - an["x"], cy - an["y"]))
        x0 += CW[c]
big = canvas.resize((canvas.width * SC, canvas.height * SC), Image.NEAREST)
d = ImageDraw.Draw(big)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26)
for r, (label, _, _) in enumerate(styles):
    d.text((12, r * RH * SC + 8), label, fill=(225, 230, 238), font=font)
big.convert("RGB").save(out)
print(out, big.size)
