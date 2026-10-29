"""python3 belly_mock.py <out.png> <scale> <ship> <level> <npzdir>...: a ship (belly_shapes) composed from rendered
pieces (render.py's .npz), each sprite taken from the first npz dir that has it. Cut away (the default): each hull
tile's belly under layer, the floors, then its over layer (`level`: low), back to front.

Options (env):
  EXTVAR=1 EXT=2  roofed, walls on: the bellies under the deck, then the exterior as the game picks it (near runs and
                  corners the run set's, tile.hull.ext.o<o>.m<mask>, a straight run in one of its designs by a hash
                  of the tile; diagonals and far sides the generic pieces; the rooms' roof plating from
                  public/assets).
  MIX=d1,d2,..    each tile's belly pieces from one of these dirs (one per look), by a hash of the tile.
  TINT=r,g,b      the hull colour multiplied over each piece's tint mask (`<id>.deco` beside it or in DECODIRS, less
                  its `.seam` if there is one).
  DECODIRS=d1,..  more dirs to find masks in.
  PICK=x,y;..     print which tile drew these px (of the saved image) and its key.
  SRC=1           print which dir each kind of sprite came from (stale renders shadow fresh ones: check this).
  EXTMASK=f.npz   save the uncropped image and the exterior's cover (foot_scan.py reads it).
  NOCROP=1        the whole canvas."""
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import belly_shapes as BS  # noqa: E402
from sprites import hull_outline as HO  # noqa: E402

out, S, name, level, dirs = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4], [Path(p) for p in sys.argv[5:]]
tiles, NX, NY = BS.shape(name)
key = BS.keys(name)
TW, TH = 64, 32
W, H = (NX + NY) * TW // 2 + 2 * TW, (NX + NY) * TH // 2 + 12 * TH
img = np.zeros((H, W, 3), np.float32)
img[:] = (14, 16, 20)
OWN = np.full((H, W), -1, int)                      # (which tile wrote each px last: x * 100 + y)
ox_, oy_ = NY * TW // 2 + TW // 2, 5 * TH


def inside(k):
    """A plan test (tile-local x, y) for the ship's side of a key's outline: each convex group's fronts all, any group
    (a concave corner's either side), every stretch."""
    parts = [[g for g, _, _ in HO.groups(st)] for st in HO.parse(k)]
    return lambda px, py: all(any(all(s[0] * px + s[1] * py <= c / 32 for s, c in g) for g in gs) for gs in parts)


TINT = np.array([float(v) for v in os.environ["TINT"].split(",")]) / 255.0 if os.environ.get("TINT") else None
SRC = {}                                            # (which folder each kind of sprite came from: SRC=1 prints it)
XM = np.zeros((H, W), bool)                         # (px the exterior pieces cover: EXTMASK)


MIX = os.environ.get("MIX")                         # (MIX=dirA,dirB,...: each tile's pieces from one of these, by
MIXD = [Path(p) for p in MIX.split(",")] if MIX else []  # a hash of the tile: the bay looks mixed)


DECO = [Path(p) for p in os.environ.get("DECODIRS", "").split(",") if p]


def _mask(rgba, a, dirs_, n, kind):
    """A piece's mask (`<n>.<kind>.npz`, white) on its own px, or None."""
    d = next((q / f"{n}.{kind}.npz" for q in dirs_ if (q / f"{n}.{kind}.npz").exists()), None)
    if d is None:
        return None
    zd = np.load(d)
    m, ad = (zd["rgba"][..., :3].mean(-1) > 127) & (zd["rgba"][..., 3] > 127), zd["a"]
    dx, dy = int(a[0] - ad[0]), int(a[1] - ad[1])
    out = np.zeros(rgba.shape[:2], bool)
    h, w = m.shape
    y0, x0, y1, x1 = max(0, dy), max(0, dx), min(rgba.shape[0], dy + h), min(rgba.shape[1], dx + w)
    out[y0:y1, x0:x1] = m[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
    return out


def _blend(rgb, al, x0, y0, owner, ext):
    """A sprite's px over the canvas at (x0, y0), clipped to it."""
    h, w = rgb.shape[:2]
    a0, b0 = max(0, -y0), max(0, -x0)
    a1, b1 = min(h, H - y0), min(w, W - x0)
    if a1 <= a0 or b1 <= b0:
        return
    rgb, al = rgb[a0:a1, b0:b1], al[a0:a1, b0:b1]
    sl = (slice(y0 + a0, y0 + a1), slice(x0 + b0, x0 + b1))
    img[sl] = img[sl] * (1 - al) + rgb * al
    OWN[sl][al[..., 0] > 0.5] = owner
    XM[sl] |= (al[..., 0] > 0.5) & ext


def paste(n, x, y, clip=None):
    pick = [MIXD[(x * 7 + y * 13 + (x * y) % 5) % len(MIXD)]] if MIXD and n.startswith("tile.hull.belly") else []
    f = next((d / f"{n}.npz" for d in pick + dirs if (d / f"{n}.npz").exists()), None)
    if f is not None:
        SRC[(f.parent.name, n.rsplit(".", 1)[0] if n.startswith("tile.hull.ext.o") else n.split(".")[2])] = 1
    if f is None:
        print("missing", n)
        return
    z = np.load(f)
    rgba, a = z["rgba"].astype(np.float32), z["a"]
    if TINT is not None and n.startswith(("tile.hull.belly", "tile.hull.ext")):   # (TINT=r,g,b: its tint mask,
        dd = [f.parent] + DECO                                                      # `.deco`, less its seam pass,
        mm = _mask(rgba, a, dd, n, "deco")                                          # `.seam`, multiplies the colour in)
        if mm is not None:
            sm = _mask(rgba, a, dd, n, "seam")
            if sm is not None:
                mm &= ~sm
            rgba[..., :3] = np.where(mm[..., None], rgba[..., :3] * TINT, rgba[..., :3])
    cx, cy = ox_ + (x - y) * TW // 2, oy_ + (x + y) * TH // 2 + TH // 2
    x0, y0 = int(cx - a[0]), int(cy - a[1])
    h, w = rgba.shape[:2]
    al = rgba[..., 3:4] / 255.0
    if clip:                                            # (only the px over the ship's side of the outline)
        jj, ii = np.mgrid[0:h, 0:w]
        u, v = (x0 + ii + 0.5 - cx) / (TW / 2), (y0 + jj + 0.5 - cy) / (TH / 2)
        keep = np.vectorize(clip)((u + v) / 2, (v - u) / 2)
        al = al * keep[..., None]
    _blend(rgba[..., :3], al, x0, y0, x * 100 + y, n.startswith(("tile.hull.ext", "tile.roof")))


def _ring(x, y):
    return (x, y) in tiles and any((x + i, y + j) not in tiles for i in (-1, 0, 1) for j in (-1, 0, 1))


def _ext_names(x, y, k):
    if not k:
        return [RR.roof_tile(x, y)]
    if HO.generic(k):
        return [f"tile.hull.ext.g.{HO.name(k)}", f"tile.roof.g.{HO.name(k)}"]
    m = sum(b for b, (i, j) in ((1, (0, -1)), (2, (1, 0)), (4, (0, 1)), (8, (-1, 0))) if _ring(x + i, y + j))
    ox, oy = (x + 1, y) not in tiles, (x, y + 1) not in tiles
    sid = f"tile.hull.ext.{'o3' if ox and oy else 'o1' if oy else 'o2'}.m{m}"
    if sid in ("tile.hull.ext.o1.m10", "tile.hull.ext.o2.m5"):
        sid += ("", ".a1", ".a2", ".a3")[(x * 11 + y * 5 + (x + y) % 3) % 4]
    if not any((d / f"{sid}.npz").exists() for d in dirs):  # (a mask the run set lacks: the generic piece)
        print("no run set piece", sid, "at", (x, y), k)
        return [f"tile.hull.ext.g.{HO.name(k)}", f"tile.roof.g.{HO.name(k)}"]
    return [sid]


if os.environ.get("EXTVAR"):                        # (the roof plating, from the game's asset sheet)
    import json
    import roof_rule as RR
    ASSETS = Path(__file__).resolve().parents[3] / "public/assets"
    SHEET = {k: v for k, v in json.loads((ASSETS / "manifest.json").read_text())["assets"].items()
             if v.get("sheet") == "roof"}
    ROOF = np.asarray(Image.open(ASSETS / "sprites/roof.png").convert("RGBA")).astype(np.float32)
    RK = json.loads((ASSETS / "manifest.json").read_text()).get("tile", {}).get("w", TW) // TW   # (the sheet's
                                                    # scale over the mock's: its px taken every RK-th, as the mock's)
    _paste = paste

    def paste(n, x, y, clip=None):
        if n in SHEET and not any((d / f"{n}.npz").exists() for d in dirs):
            fr, an = SHEET[n]["frame"], SHEET[n]["anchor"]
            rgba = ROOF[fr["y"]:fr["y"] + fr["h"], fr["x"]:fr["x"] + fr["w"]][::RK, ::RK]
            cx, cy = ox_ + (x - y) * TW // 2, oy_ + (x + y) * TH // 2 + TH // 2
            x0, y0 = int(cx - an["x"] // RK), int(cy - an["y"] // RK)
            h, w = rgba.shape[:2]
            _blend(rgba[..., :3], rgba[..., 3:4] / 255.0, x0, y0, x * 100 + y, True)
            return
        _paste(n, x, y, clip)


order = [(x, s - x) for s in range(NX + NY) for x in range(NX) if 0 <= s - x < NY and (x, s - x) in tiles]
EXT = os.environ.get("EXT")
if not EXT or EXT == "2":                         # (EXT=2: the bellies under the exterior, roofed)
    for x, y in order:                                  # (the bellies under the deck, under the floors)
        if key[(x, y)]:
            paste(f"tile.hull.belly.under.{HO.name(key[(x, y)])}", x, y)
    for x, y in order:                                  # (the floor layer)
        k = key[(x, y)]                                 # (under a hull piece, clipped to the outline: the
        paste(f"tile.floor.{'ab'[(x * 3 + y) % 2]}", x, y, inside(k) if k else None)   # rest of its tile's floor)
for x, y in order:
    k = key[(x, y)]
    if EXT and os.environ.get("EXTVAR"):              # (EXTVAR=1: as the game, gen_mock: near runs and corners the
        for n in _ext_names(x, y, k):                   # run set's, a straight run in one of its designs by a hash
            paste(n, x, y)                              # of the tile; the rest generic; the rooms' roof plating)
        continue
    if EXT:
        paste(f"tile.hull.ext.g.{HO.name(k)}" if k else "tile.roof.g.full", x, y)
        if k:
            paste(f"tile.roof.g.{HO.name(k)}", x, y)
    elif k:
        paste(f"tile.hull.belly.{level}.{HO.name(k)}", x, y)
im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
if os.environ.get("SRC"):
    from collections import Counter
    print("sources", sorted(Counter(d for d, _ in SRC).items()))
if os.environ.get("OWNER"):                         # (OWNER=px,py: the tile that drew that px)
    px, py = map(int, os.environ["OWNER"].split(","))
    print("owner", divmod(OWN[py, px], 100), key.get(divmod(OWN[py, px], 100)))
if os.environ.get("EXTMASK"):                       # (the uncropped image and the exterior's cover, for scans)
    np.savez(os.environ["EXTMASK"], img=np.asarray(im), ext=XM, own=OWN)
if os.environ.get("NOCROP"):                        # (the whole canvas: tile (x, y) centred at ox_ + (x - y) 32,
    im.resize((im.width * S, im.height * S), Image.NEAREST).save(out)  # oy_ + (x + y) 16 + 16)
    sys.exit()
a = np.asarray(im).astype(int)
ys, xs = np.where(np.abs(a - a[0, 0]).sum(2) > 6)
im = im.crop((xs.min() - 8, ys.min() - 8, xs.max() + 9, ys.max() + 9))
if os.environ.get("PICK"):                          # (PICK=px,py;...: in the saved image's px, the tiles that drew them)
    for q in os.environ["PICK"].split(";"):
        px, py = (int(v) // S for v in q.split(","))
        t_ = divmod(OWN[py + ys.min() - 8, px + xs.min() - 8], 100)
        print("pick", q, t_, key.get(t_))
im.resize((im.width * S, im.height * S), Image.NEAREST).save(out)
