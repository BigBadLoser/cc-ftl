"""Roof tiles for the enemy 'roofed' view (grid frame, origin = tile centre at floor level, plating at ZR).

`roof.generic.m<0-15>`: plain top plating, same neighbour mask as walls (bit 1 N = -y, 2 E = +x, 4 S = +y, 8 W = -x). A
connected side continues the plating seamlessly (the cross-seam grid is one tile wide, so it matches across tiles); an
open side gets a raised rim and a slab edge. `roof.weapon / .shield / .engine` (+ `.m<n>`) add one hint of the module
below: a turret ring, an emitter dome, an exhaust vent. `roof.<kind>` alone = the fully connected tile (m15)."""
from . import core
from . import walls

ZR = walls.HF + walls.ROOF_T   # plating height: the slab's top (= walls.hull_top(), flush with the hull)
T = walls.ROOF_T               # slab thickness shown on open sides (it sits on the interior walls at walls.HF)
GN = 32
BAND = 3          # rim width in cells on open sides


def _cell(mask, i, j):
    """Colour of top cell (i along +x, j along +y)."""
    open_n, open_e, open_s, open_w = not mask & 1, not mask & 2, not mask & 4, not mask & 8
    d = min(j if open_n else 99, GN - 1 - i if open_e else 99, GN - 1 - j if open_s else 99, i if open_w else 99)
    if d == 0:
        return "dark"
    if d < BAND:
        return "steelL" if d == 1 else "plate"
    if i == 15 or j == 15:
        return "dark"
    if i == 16 or j == 16:
        return "steelD"
    for bx in (8, 23):
        for by in (8, 23):
            if bx <= i <= bx + 1 and by <= j <= by + 1:
                return "plate"
    return "steel"


def _tile(m, mask):
    m.pattern((-0.5, -0.5, ZR), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: _cell(mask, i, j))
    z0 = ZR - T
    if not mask & 4:                         # +y edge (lit)
        m.poly([core.G(-0.5, 0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, ZR), core.G(-0.5, 0.5, ZR)], "steel")
        m.poly([core.G(-0.5, 0.5, ZR - 0.03), core.G(0.5, 0.5, ZR - 0.03), core.G(0.5, 0.5, ZR), core.G(-0.5, 0.5, ZR)], "steelL")
        m.poly([core.G(-0.5, 0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z0 + 0.03), core.G(-0.5, 0.5, z0 + 0.03)], "dark")
    if not mask & 2:                         # +x edge (shaded)
        m.poly([core.G(0.5, -0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, ZR), core.G(0.5, -0.5, ZR)], "steelD")
        m.poly([core.G(0.5, -0.5, ZR - 0.03), core.G(0.5, 0.5, ZR - 0.03), core.G(0.5, 0.5, ZR), core.G(0.5, -0.5, ZR)], "steel")
        m.poly([core.G(0.5, -0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z0 + 0.03), core.G(0.5, -0.5, z0 + 0.03)], "dark")


def generic(mask):
    m = core.Mesh(f"roof_generic_{mask}", flat=True)
    _tile(m, mask)
    return [m.build()]


def weapon(mask):
    m = core.Mesh(f"roof_weapon_{mask}", flat=True)
    _tile(m, mask)
    z = ZR
    m.cyl((0, 0, z), 0.34, 0.025, "steelD", sides=8, top="steelL")                  # turret ring
    m.cyl((0, 0, z + 0.025), 0.29, 0.02, "dark", sides=8)
    m.cyl((0, 0, z + 0.045), 0.25, 0.05, "gmD", sides=8, top="gm", rtop=0.22)        # armoured hatch
    m.box((0, 0, z + 0.095), (0.4, 0.07, 0.025), "dark", base=True)                  # shutter slit
    m.box((0, 0, z + 0.095), (0.07, 0.4, 0.025), "steelD", base=True)
    for sx in (-1, 1):
        m.box((sx * 0.17, 0, z + 0.12), (0.06, 0.06, 0.02), "hazY", base=True)       # warning tabs
        m.box((0, sx * 0.17, z + 0.12), (0.06, 0.06, 0.02), "hazY", base=True)
    return [m.build()]


def shield(mask):
    m = core.Mesh(f"roof_shield_{mask}", flat=True)
    _tile(m, mask)
    z = ZR
    m.cyl((0, 0, z), 0.33, 0.04, "steelD", sides=8, top="steelL")                    # collar
    m.cyl((0, 0, z + 0.04), 0.27, 0.07, "gm", sides=8, rtop=0.23)                    # dome, three stacked bands
    m.cyl((0, 0, z + 0.11), 0.23, 0.07, "plate", sides=8, rtop=0.16)
    m.cyl((0, 0, z + 0.18), 0.16, 0.06, "steelL", sides=8, rtop=0.07)
    m.cyl((0, 0, z + 0.24), 0.045, 0.06, "cyan", sides=8, rtop=0.02)                 # emitter tip (glows)
    for k in range(4):                                                               # emitter nodes
        sx, sy = (-1, 1)[k & 1], (-1, 1)[k >> 1]
        m.cyl((sx * 0.26, sy * 0.26, z), 0.035, 0.1, "gm", sides=4, top="cyan")
    return [m.build()]


def engine(mask):
    m = core.Mesh(f"roof_engine_{mask}", flat=True)
    _tile(m, mask)
    z = ZR
    m.box((0, 0, z), (0.7, 0.7, 0.05), "gmD", top="steel", base=True)                # vent frame
    m.box((0, 0, z + 0.05), (0.58, 0.58, 0.02), "dark", base=True)
    for k in range(5):                                                               # louvres
        m.box((0, -0.2 + k * 0.1, z + 0.065), (0.54, 0.05, 0.03), "steelD", top="gm", base=True)
    m.box((0, 0.27, z + 0.06), (0.5, 0.03, 0.02), "orange", base=True)               # heat leaking out (glows)
    for k in range(4):
        m.box((-0.3 + k * 0.2, -0.355, z + 0.05), (0.1, 0.02, 0.03), "hazY" if k % 2 == 0 else "hazK", base=True)
    return [m.build()]


SPRITES = []
for _name, _fn in (("generic", generic), ("weapon", weapon), ("shield", shield), ("engine", engine)):
    for _m in range(16):
        SPRITES.append((f"roof.{_name}.m{_m}", (1, 1), "block", lambda m=_m, f=_fn: f(m)))
    SPRITES.append((f"roof.{_name}", (1, 1), "block", lambda f=_fn: f(15)))
