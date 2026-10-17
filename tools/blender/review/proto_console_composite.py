"""Composite the console prototype sprites (from proto_console.py) into a bridge room: floor tiles, walls, crew at the chair
(no sit pose in the crew pipeline, so they STAND just behind the chair). 1x and 3x nearest-neighbour.
  python3 tools/blender/review/proto_console_composite.py <proto dir>"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image

D = Path(sys.argv[1])
src = Path(__file__).with_name("proto_composite.py").read_text().split("def load(")[0]
src = src.replace("D = Path(sys.argv[1])\nROT = int(sys.argv[2]) if len(sys.argv) > 2 else 1\n", "")
src = src.replace("W, H = 600, 440", "W, H = 900, 560")
exec(src)
META = json.loads((D / "meta.json").read_text())
TX, TY = 40, 150
T = lambda x, y: (TX + 14 * 32 + (x - y) * 32, TY + 20 + (x + y) * 16)  # noqa: E731
# (console, rot, footprint min tile)
PLACE = [("shield", 0, (1, 0)), ("helm", 0, (5, 0)), ("weapons", 0, (9, 0)),
         ("helm", 1, (11, 3)), ("shield", 1, (11, 7)), ("weapons", 1, (11, 11))]
FACE = {0: 5, 1: 7}                     # crew direction row that looks along +u (r0: -y, r1: +x)
X0, X1, Y0, Y1 = 0, 12, 0, 13


def load(name, rot, hot):
    z = np.load(D / f"px_{name}_r{rot}{'_active' if hot else ''}.npz")
    return z["rgba"], z["glow"], int(z["ox"]), int(z["oy"])


def scene(hot):
    sc = Scene()
    items = []
    for x in range(X0, X1 + 1):
        for y in range(Y0, Y1 + 1):
            sc.asset("tile.floor.a", *T(x, y), dim=0.6)
    walls = {(x, -1) for x in range(-1, X1 + 2)} | {(-1, y) for y in range(-1, Y1 + 2)} | {(X1 + 1, y) for y in range(-1, Y1 + 2)} \
        | {(x, Y1 + 1) for x in range(-1, X1 + 2)}
    for (x, y) in walls:
        m = (1 if (x, y - 1) in walls else 0) | (2 if (x + 1, y) in walls else 0) | (4 if (x, y + 1) in walls else 0) | (8 if (x - 1, y) in walls else 0)
        aid = f"tile.wall.{'full.' if (y == -1 or x == -1) else ''}m{m}"
        items.append((x - .5, x + .5, y - .5, y + .5, lambda aid=aid, x=x, y=y: sc.asset(aid, *T(x, y))))
    for name, rot, (px, py) in PLACE:
        mt = META[f"{name}.r{rot}"]
        wx, wy = mt["foot_xy"]
        ox, oy = px + mt["origin_tile_from_min"][0], py + mt["origin_tile_from_min"][1]
        rgba, glow, sx, sy = load(name, rot, hot)
        ex, ey = T(ox, oy)
        items.append((px - .5, px + wx - .5, py - .5, py + wy - .5, lambda a=(rgba, glow, ex - sx, ey - sy): sc.blit(a[0], a[1], a[2], a[3])))
        cx, cy = mt["chair_rel_origin"]
        nx, ny = mt["entry_rel_origin"]
        for k, (fx, fy) in enumerate(((cx + 0.45 * (nx - cx), cy + 0.45 * (ny - cy)),)):
            gx, gy = ox + fx, oy + fy
            items.append((gx - .2, gx + .2, gy - .2, gy + .2, lambda gx=gx, gy=gy, d=FACE[rot]: crew(sc, *T(gx, gy), d=d)))
    for it in depth_sort(items):
        it[4]()
    return Image.fromarray(np.clip(sc.px, 0, 255).astype(np.uint8))


for hot in (False, True):
    img = scene(hot)
    tag = "active" if hot else "idle"
    img.save(D / f"scene_{tag}_1x.png")
    img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(D / f"scene_{tag}_3x.png")
    # tight 3x crops: r0 row along the north wall, r1 column along the east wall
    for nm, box in (("r0row", (440, 100, 860, 370)), ("r1col", (400, 340, 830, 560))):
        c = img.crop(box)
        c.resize((c.width * 3, c.height * 3), Image.NEAREST).save(D / f"scene_{tag}_3x_{nm}.png")
