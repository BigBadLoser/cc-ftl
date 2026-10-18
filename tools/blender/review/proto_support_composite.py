"""Composite the support-module prototypes (from proto_support.py) into (a) a room with floor tiles, walls, a crew member for scale and
the roof parts as ~30% alpha ghosts with a thin light outline at roof height (player's cutaway view), and (b) an enemy ROOFED view
(roof tiles with the roof parts on top), each idle and active, at 1x and 3x nearest-neighbour. Plain python (numpy + PIL).
  python3 tools/blender/review/proto_support_composite.py <proto dir>"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

D = Path(sys.argv[1])
src = Path(__file__).with_name("proto_composite.py").read_text().split("def load(")[0]
src = src.replace("D = Path(sys.argv[1])\nROT = int(sys.argv[2]) if len(sys.argv) > 2 else 1\n", "")
src = src.replace("W, H = 600, 440", "W, H = 980, 700")
exec(src)
META = json.loads((D / "meta.json").read_text())
TX, TY = 70, 215
T = lambda x, y: (TX + 14 * 32 + (x - y) * 32, TY + 20 + (x + y) * 16)
PLACE = [("shield_gen", 0, (1, 0)), ("shield_small", 0, (5, 0)), ("ai_core", 0, (8, 0)),
         ]                                              # quick preview: r0 only
CREW = [((4.2, 2.0), 5)]
FACE = {0: 5, 1: 7}
X0, X1, Y0, Y1 = 0, 12, 0, 13
GHOST_ALPHA = 0.30
OUTLINE = np.array([200, 226, 240], np.float32)


def load(prefix, name, rot, hot):
    z = np.load(D / f"{prefix}_{name}_r{rot}{'_active' if hot else ''}.npz")
    return z["rgba"], z["glow"].astype(np.float32) * 0.8, int(z["ox"]), int(z["oy"])


def ghost(rgba):
    """30% alpha body with a 1px light outline (the sprite's own dark outline ring is replaced by it)."""
    a = rgba[..., 3] > 127
    p = np.pad(a, 1)
    inner = p[1:-1, 1:-1] & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    out = rgba.astype(np.float32).copy()
    edge = a & ~inner
    out[..., 3] = np.where(a, 255 * GHOST_ALPHA, 0)
    out[edge, :3] = OUTLINE
    out[edge, 3] = 255 * 0.85
    return out


def anchor(name, rot, p):
    mt = META[f"{name}.r{rot}"]
    ox, oy = p[0] + mt["origin_tile_from_min"][0], p[1] + mt["origin_tile_from_min"][1]
    return mt, ox, oy, T(ox, oy)


def walls_set():
    return {(x, -1) for x in range(-1, X1 + 2)} | {(-1, y) for y in range(-1, Y1 + 2)} | {(X1 + 1, y) for y in range(-1, Y1 + 2)} \
        | {(x, Y1 + 1) for x in range(-1, X1 + 2)}


def wmask(x, y, ws):
    return (1 if (x, y - 1) in ws else 0) | (2 if (x + 1, y) in ws else 0) | (4 if (x, y + 1) in ws else 0) | (8 if (x - 1, y) in ws else 0)


def wall_item(sc, x, y, ws, full_all):
    m = wmask(x, y, ws)
    if (y == -1 or x == -1 or full_all) and (D / f"wall_full_m{m}.npz").exists():
        z = np.load(D / f"wall_full_m{m}.npz")
        return lambda: sc.blit(z["rgba"], z["glow"], int(T(x, y)[0] - int(z["ox"])), int(T(x, y)[1] - int(z["oy"])))
    aid = f"tile.wall.{'full.' if (y == -1 or x == -1) else ''}m{m}"
    return lambda: sc.asset(aid, *T(x, y))


def room(hot):
    sc = Scene()
    items = []
    ws = walls_set()
    for x in range(X0, X1 + 1):
        for y in range(Y0, Y1 + 1):
            sc.asset("tile.floor.a", *T(x, y), dim=0.6)
    for (x, y) in ws:
        items.append((x - .5, x + .5, y - .5, y + .5, wall_item(sc, x, y, ws, False)))
    for name, rot, p in PLACE:
        mt, ox, oy, (ex, ey) = anchor(name, rot, p)
        wx, wy = mt["foot_xy"]
        mod, glow, sx, sy = load("px", name, rot, hot)
        rp, _, rx, ry = load("roofpart", name, rot, True)
        g = ghost(rp)

        def draw(a=(mod, glow, ex - sx, ey - sy), g=g, gx=ex - rx, gy=ey - ry):
            sc.blit(a[0], a[1], a[2], a[3])
            sc.blit(g, None, gx, gy)
        items.append((p[0] - .5, p[0] + wx - .5, p[1] - .5, p[1] + wy - .5, draw))
    for (cx, cy), d in CREW:
        items.append((cx - .2, cx + .2, cy - .2, cy + .2, lambda cx=cx, cy=cy, d=d: crew(sc, *T(cx, cy), d=d)))
    for it in depth_sort(items):
        it[4]()
    return Image.fromarray(np.clip(sc.px, 0, 255).astype(np.uint8))


def roofed(hot):
    sc = Scene()
    items = []
    ws = walls_set()
    cells = {(x, y) for x in range(X0, X1 + 1) for y in range(Y0, Y1 + 1)} | ws
    for (x, y) in cells:
        m = (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)
        z = np.load(D / f"roof_m{m}.npz")

        def draw(x=x, y=y, z=z):
            if (x, y) in ws:
                wall_item(sc, x, y, ws, True)()
            sc.blit(z["rgba"], z["glow"], int(T(x, y)[0] - int(z["ox"])), int(T(x, y)[1] - int(z["oy"])))
        items.append((x - .5, x + .5, y - .5, y + .5, draw))
    for it in depth_sort(items):
        it[4]()
    items = []
    for name, rot, p in PLACE:
        mt, ox, oy, (ex, ey) = anchor(name, rot, p)
        wx, wy = mt["foot_xy"]
        rp, rg, rx, ry = load("roofpart", name, rot, hot)
        items.append((p[0] - .5 + .01, p[0] + wx - .5 - .01, p[1] - .5 + .01, p[1] + wy - .5 - .01,
                      lambda a=(rp, rg, ex - rx, ey - ry): sc.blit(*a)))
    # roof parts are drawn after all roof tiles (they stand on the roof plane)
    for it in depth_sort(items):
        it[4]()
    return Image.fromarray(np.clip(sc.px, 0, 255).astype(np.uint8))


def strip(name):
    """Deploy strip for one roof part: stowed, f0..f3, deployed (f4), each over roof tiles, 3x nearest-neighbour."""
    seq = [("roofstow", "stowed", False), ("roofdep", "f0", False), ("roofdep", "f1", False), ("roofdep", "f2", False), ("roofdep", "f3", False),
           ("roofpart", "deployed", True)]
    cells = []
    mt = META[f"{name}.r0"]
    cx, cy = mt["centre"]
    for pre, tag, act in seq:
        fn = {"roofstow": f"roofstow_{name}_r0", "roofdep": f"roofdep_{name}_r0_{tag}", "roofpart": f"roofpart_{name}_r0_active"}[pre]
        z = np.load(D / f"{fn}.npz")
        cells.append((z["rgba"], z["glow"].astype(np.float32) * 0.8, int(z["ox"]), int(z["oy"])))
    x0 = min(-c[2] for c in cells) - 12
    x1 = max(c[0].shape[1] - c[2] for c in cells) + 12
    y0 = min(-c[3] for c in cells) - 12
    y1 = max(c[0].shape[0] - c[3] for c in cells) + 12
    cw, ch = x1 - x0, y1 - y0
    rt = np.load(D / "roof_m15.npz")
    out = Image.new("RGB", (cw * len(cells) + 4 * (len(cells) - 1), ch), (30, 30, 40))
    for k, (rgba, glow, ox, oy) in enumerate(cells):
        sc = Scene()
        sc.px = np.zeros((ch, cw, 3), np.float32) + BG
        sc.px[:] = BG
        globals()["W"], globals()["H"] = cw, ch
        ex, ey = -x0 + (cx - cy) * 32, -y0 + (cx + cy) * 16          # footprint centre (roof tiles)
        for tx in range(-2, 3):
            for ty in range(-2, 3):
                px_, py_ = ex + (tx - ty) * 32, ey + (tx + ty) * 16
                sc.blit(rt["rgba"], rt["glow"], int(px_ - int(rt["ox"])), int(py_ - int(rt["oy"])))
        sc.blit(rgba, glow, int(-x0 - ox), int(-y0 - oy))
        out.paste(Image.fromarray(np.clip(sc.px, 0, 255).astype(np.uint8)), (k * (cw + 4), 0))
    globals()["W"], globals()["H"] = 980, 700
    out.resize((out.width * 3, out.height * 3), Image.NEAREST).save(D / f"deploy_strip_{name}_3x_v2.png")


hot = True
CROPS = {"r0row": (330, 40, 940, 420)}
img = room(hot)
img.save(D / "scene_room_active_1x_v2.png")
img.resize((img.width * 3, img.height * 3), Image.NEAREST).save(D / "scene_room_active_3x_v2.png")
for nm, box in CROPS.items():
    c = img.crop(box)
    c.resize((c.width * 3, c.height * 3), Image.NEAREST).save(D / f"scene_room_active_3x_{nm}_v2.png")
roofed(hot).save(D / "scene_roofed_active_1x_v2.png")
for n in ("shield_gen", "shield_small", "ai_core"):
    strip(n)
