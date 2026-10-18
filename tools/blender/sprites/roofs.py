"""Roof tiles for the enemy 'roofed' view (grid frame, origin = tile centre at floor level, plating at ZR).

Hull-language armour: ochre and blue-grey colour-blocked plates that span 2-4 tiles. `plate_at(tx, ty)` is a pure
position hash (bands of 2-3 tiles, each cut into 2-4 tile plates, brick-offset) so seams line up across tiles into big
plates. A tile sprite is picked from (colour, seams N/W, elevation, detail): seam 1 = plate boundary line, 2 = visible
step face (neighbour plate higher); no seam inside a plate, so there is no per-tile grid. Open sides (mask bits N1 E2 S4
W8 = connected) get a raised steel trim lip, and the S/E sides a hull slab edge. Sparse details sit in the tile centre.
`roof.weapon / .shield / .engine` keep their hints on the plain plate."""
import math
from . import core

ZR = 2.4          # plating height: the top of a full-height wall (= walls.HF)
T = 0.14          # slab thickness shown on open sides
GN = 32
STEP = 0.05       # raised plate height
LIP = 0.075       # trim lip height / width
COLS = {          # plate family -> top, +y face, +x face, highlight, seam
    "o": dict(top="ochM", fy="ochD", fx="ochK", hi="ochL"),
    "b": dict(top="hbM", fy="hbD", fx="hbK", hi="hbL"),
}


def _h(*v):
    x = 0x9E3779B1
    for a in v:
        x = ((x ^ (a & 0xFFFFFFFF)) * 0x85EBCA6B) & 0xFFFFFFFF
        x ^= x >> 15
    return x


def plate_at(tx, ty):
    """Deterministic plate layout. Returns (col 'o'|'b', elevation 0|1, seamN, seamW, detail (kind, flip) or None)."""
    b0, b = 0, 0                                   # y bands of height 2-3
    while True:
        hgt = 2 + _h(b, 1) % 2
        if ty < b0 + hgt:
            break
        b0 += hgt
        b += 1
    off = _h(b, 2) % 4
    x0, k = -off, 0                                # x segments of width 2-4, offset per band
    while True:
        w = 2 + _h(b, k, 3) % 3
        if tx < x0 + w:
            break
        x0 += w
        k += 1

    def info(bb, kk):
        r = _h(bb, kk, 4) % 100
        return ("o" if r < 50 else "b"), (1 if _h(bb, kk, 5) % 100 < 30 else 0)
    col, el = info(b, k)
    sn = sw = 0
    if ty == b0:                                   # plate boundary above: the plate in the previous band
        sn = 1
        pb, pb0 = b - 1, 0
        # elevation of the plate directly above (tile ty-1, same tx)
        pel = plate_at(tx, ty - 1)[1] if ty > 0 else el
        sn = 2 if pel > el else 1
    if tx == x0:
        pel = plate_at(tx - 1, ty)[1] if tx > -50 else el
        sw = 2 if pel > el else 1
    d = None
    r = _h(tx, ty, 6) % 100
    if r < 34:
        d = (("vent", "hatch", "nub", "haz", "light")[_h(tx, ty, 7) % 5], _h(tx, ty, 8) & 1)
    return col, el, sn, sw, d


def _cell(i, j, c, sn, sw, mask):
    open_n, open_e, open_s, open_w = not mask & 1, not mask & 2, not mask & 4, not mask & 8
    if (open_n and j < 3) or (open_w and i < 3) or (open_s and j >= GN - 3) or (open_e and i >= GN - 3):
        return "wallD"                              # floor under the trim lip
    if sn == 1 and not open_n:
        if j < 2:
            return "wallK"
        if j == 2:
            return c["hi"]
    if sw == 1 and not open_w:
        if i < 2:
            return "wallK"
        if i == 2:
            return c["hi"]
    if (sn == 2 and j < 2 and not open_n) or (sw == 2 and i < 2 and not open_w):
        return c["hi"]
    return c["top"]


def _lip(m, x0, x1, y0, y1, z):
    """Raised trim strip: flat top, lit +y face, shaded +x face."""
    h = LIP
    m.poly([core.G(x0, y0, z + h), core.G(x1, y0, z + h), core.G(x1, y1, z + h), core.G(x0, y1, z + h)], "wallL", flip=True)
    m.poly([core.G(x0, y1, z), core.G(x1, y1, z), core.G(x1, y1, z + h), core.G(x0, y1, z + h)], "wallM")
    m.poly([core.G(x1, y0, z), core.G(x1, y1, z), core.G(x1, y1, z + h), core.G(x1, y0, z + h)], "wallD")


def _detail(m, z, kind, flip, col):
    rz = math.pi / 2 if flip else 0.0

    def P(x, y):
        return (y, x) if flip else (x, y)

    def bx(x, y, dz, sx, sy, sz, color, top=None):
        px, py = P(x, y)
        m.box((px, py, z + dz), (sx, sy, sz), color, top=top, rz=rz, base=True)
    if kind == "vent":
        bx(0, 0, 0, 0.44, 0.34, 0.03, "wallK")
        for k in (-1, 0, 1):
            bx(0, k * 0.1, 0.03, 0.36, 0.06, 0.04, "wallD", top="wallL")
    elif kind == "hatch":
        bx(0, 0, 0, 0.46, 0.46, 0.03, "wallK")
        bx(0, 0, 0.03, 0.38, 0.38, 0.03, "wallM", top="wallL")
        bx(0, 0, 0.06, 0.16, 0.07, 0.04, COLS[col]["hi"], top=COLS[col]["hi"])
    elif kind == "nub":
        m.cyl((0, 0, z), 0.11, 0.05, "wallK", sides=8, top="wallD")
        m.cyl((0, 0, z + 0.05), 0.075, 0.1, "wallM", sides=8, top="wallL")
        m.cyl((0, 0, z + 0.15), 0.05, 0.03, "cyan", sides=8)
    elif kind == "haz":
        o = P(-0.3, -0.12)
        du, dv = ((0.6, 0, 0), (0, 0.24, 0)) if not flip else ((0.24, 0, 0), (0, 0.6, 0))
        if flip:
            o = (-0.12, -0.3)
        m.pattern((o[0], o[1], z + 0.012), du, dv, 19 if not flip else 8, 8 if not flip else 19,
                  (lambda i, j: "hazY" if ((i + j) // 2) % 2 else "hazK") if not flip else
                  (lambda i, j: "hazY" if ((i + j) // 2) % 2 else "hazK"), flip=False)
    elif kind == "light":
        for s, c in ((-1, "green"), (1, "blueN")):
            bx(s * 0.22, 0, 0, 0.13, 0.13, 0.02, "wallK")
            px, py = P(s * 0.22, 0)
            m.cyl((px, py, z + 0.02), 0.05, 0.04, c, sides=6)


def _tile(m, mask, col="o", sn=0, sw=0, el=0, detail=None):
    c = COLS[col]
    z = ZR + STEP * el
    m.pattern((-0.5, -0.5, z), (1, 0, 0), (0, 1, 0), GN, GN, lambda i, j: _cell(i, j, c, sn, sw, mask))
    z0 = z - T
    if sn == 2 and mask & 1:                        # visible step face: the higher plate's +y side
        m.poly([core.G(-0.5, -0.5, z - STEP), core.G(0.5, -0.5, z - STEP), core.G(0.5, -0.5, z), core.G(-0.5, -0.5, z)], "wallD")
    if sw == 2 and mask & 8:
        m.poly([core.G(-0.5, -0.5, z - STEP), core.G(-0.5, 0.5, z - STEP), core.G(-0.5, 0.5, z), core.G(-0.5, -0.5, z)], "wallK")
    if not mask & 4:                                # +y edge (lit): hull slab side
        m.poly([core.G(-0.5, 0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z), core.G(-0.5, 0.5, z)], c["fy"])
        m.poly([core.G(-0.5, 0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z0 + 0.035), core.G(-0.5, 0.5, z0 + 0.035)], "wallK")
    if not mask & 2:                                # +x edge (shaded)
        m.poly([core.G(0.5, -0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z), core.G(0.5, -0.5, z)], c["fx"])
        m.poly([core.G(0.5, -0.5, z0), core.G(0.5, 0.5, z0), core.G(0.5, 0.5, z0 + 0.035), core.G(0.5, -0.5, z0 + 0.035)], "wallK")
    if not mask & 1:
        _lip(m, -0.5, 0.5, -0.5, -0.5 + LIP, z)
    if not mask & 8:
        _lip(m, -0.5, -0.5 + LIP, -0.5, 0.5, z)
    if not mask & 4:
        _lip(m, -0.5, 0.5, 0.5 - LIP, 0.5, z)
    if not mask & 2:
        _lip(m, 0.5 - LIP, 0.5, -0.5, 0.5, z)
    if detail and mask == 15:
        _detail(m, z, detail[0], detail[1], col)


def plate(mask, col="o", sn=0, sw=0, el=0, detail=None):
    m = core.Mesh("roof_plate", flat=True)
    _tile(m, mask, col, sn, sw, el, detail)
    return [m.build()]


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
