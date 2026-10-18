"""Roof tiles for the enemy 'roofed' view (grid frame, origin = tile centre at floor level, plating at ZR).

Heavy armour seen from above, in the hull's ochre / blue-grey language. The layout lives in `roof_layout.py` (pure
Python): 4x4-tile armour modules with a riveted frame rail on each module's N / W side, 2-3 raised plates per module
(lit S lip, shaded E lip, grooves), a recessed pocket with corner bolts or a riveted strap on every plate, and colour
courses (module columns alternate). No objects sit on the roof.

Sprites:
  roof.p<L><c>.<u><v>      base tile at position (u, v) of a module with layout L and colour c (o / b); no edges
  roof.edge.<side>.<c>     overlay for an open side (n / w: dark rim, s: lit lip + slab face, e: shade lip + slab face)
  roof.<kind>[.m<mask>]    legacy ids (generic plate and the weapon / shield / engine markers), kept until the
                           renderer switches to the module rule; mask bits N1 E2 S4 W8 = connected.
"""
from . import core
from . import roof_layout as rl

ZR = 2.4          # plating height: the top of a full-height wall (= walls.HF)
T = 0.22          # slab thickness shown on open S / E sides
GN = rl.GN


def _grid(m, grid):
    m.pattern((-0.5, -0.5, ZR), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: grid[j][i])


def _slab(m, side, f):
    z, z0 = ZR, ZR - T
    if side == "s":
        a, b = (-0.5, 0.5), (0.5, 0.5)
    else:
        a, b = (0.5, -0.5), (0.5, 0.5)
    face = f["fs"] if side == "s" else f["fe"]
    m.poly([core.G(*a, z0), core.G(*b, z0), core.G(*b, z), core.G(*a, z)], face)
    m.poly([core.G(*a, z0), core.G(*b, z0), core.G(*b, z0 + 0.035), core.G(*a, z0 + 0.035)], f["k"])


def base(layout, col, u, v):
    m = core.Mesh(f"roof_p{layout}{col}_{u}{v}", flat=True)
    _grid(m, rl.tile_cells(layout, col, u, v))
    return [m.build()]


def edge(side, col):
    m = core.Mesh(f"roof_edge_{side}{col}", flat=True)
    cells = rl.edge_cells(side, col)
    m.pattern((-0.5, -0.5, ZR), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: cells.get((i, j)))
    if side in ("s", "e"):
        _slab(m, side, rl.FAM[col])
    return [m.build()]


def _legacy_tile(m, mask, col="b"):
    f = rl.FAM[col]
    g = [[f["top"]] * GN for _ in range(GN)]
    for side, bit in (("n", 1), ("e", 2), ("s", 4), ("w", 8)):
        if not mask & bit:
            for (i, j), c in rl.edge_cells(side, col).items():
                g[j][i] = c
    _grid(m, g)
    for side, bit in (("s", 4), ("e", 2)):
        if not mask & bit:
            _slab(m, side, f)


def generic(mask):
    m = core.Mesh(f"roof_generic_{mask}", flat=True)
    _legacy_tile(m, mask)
    return [m.build()]


def weapon(mask):
    m = core.Mesh(f"roof_weapon_{mask}", flat=True)
    _legacy_tile(m, mask)
    z = ZR
    m.cyl((0, 0, z), 0.34, 0.025, "steelD", sides=8, top="steelL")                  # turret ring
    m.cyl((0, 0, z + 0.025), 0.29, 0.02, "dark", sides=8)
    m.cyl((0, 0, z + 0.045), 0.25, 0.05, "gmD", sides=8, top="gm", rtop=0.22)        # armoured hatch
    m.box((0, 0, z + 0.095), (0.4, 0.07, 0.025), "dark", base=True)                  # shutter slit
    m.box((0, 0, z + 0.095), (0.07, 0.4, 0.025), "steelD", base=True)
    return [m.build()]


def shield(mask):
    m = core.Mesh(f"roof_shield_{mask}", flat=True)
    _legacy_tile(m, mask)
    z = ZR
    m.cyl((0, 0, z), 0.33, 0.04, "steelD", sides=8, top="steelL")                    # collar
    m.cyl((0, 0, z + 0.04), 0.27, 0.07, "gm", sides=8, rtop=0.23)                    # dome, three stacked bands
    m.cyl((0, 0, z + 0.11), 0.23, 0.07, "plate", sides=8, rtop=0.16)
    m.cyl((0, 0, z + 0.18), 0.16, 0.06, "steelL", sides=8, rtop=0.07)
    m.cyl((0, 0, z + 0.24), 0.045, 0.06, "cyan", sides=8, rtop=0.02)                 # emitter tip (glows)
    return [m.build()]


def engine(mask):
    m = core.Mesh(f"roof_engine_{mask}", flat=True)
    _legacy_tile(m, mask)
    z = ZR
    m.box((0, 0, z), (0.7, 0.7, 0.05), "gmD", top="steel", base=True)                # vent frame
    m.box((0, 0, z + 0.05), (0.58, 0.58, 0.02), "dark", base=True)
    for k in range(5):                                                               # louvres
        m.box((0, -0.2 + k * 0.1, z + 0.065), (0.54, 0.05, 0.03), "steelD", top="gm", base=True)
    m.box((0, 0.27, z + 0.06), (0.5, 0.03, 0.02), "orange", base=True)               # heat leaking out (glows)
    return [m.build()]


SPRITES = []
for _l in range(len(rl.LAYOUTS)):
    for _c in rl.FAM:
        for _v in range(rl.M):
            for _u in range(rl.M):
                SPRITES.append((f"roof.p{_l}{_c}.{_u}{_v}", (1, 1), "block",
                                lambda l=_l, c=_c, u=_u, v=_v: base(l, c, u, v)))
for _s in "nesw":
    for _c in rl.FAM:
        SPRITES.append((f"roof.edge.{_s}.{_c}", (1, 1), "block", lambda s=_s, c=_c: edge(s, c)))
for _name, _fn in (("generic", generic), ("weapon", weapon), ("shield", shield), ("engine", engine)):
    for _m in range(16):
        SPRITES.append((f"roof.{_name}.m{_m}", (1, 1), "block", lambda m=_m, f=_fn: f(m)))
    SPRITES.append((f"roof.{_name}", (1, 1), "block", lambda f=_fn: f(15)))
