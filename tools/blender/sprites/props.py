"""Environment sprite models (grid frame; origin = centre of the FRONT-most footprint tile at floor level).

Walls, hull and doors are FULL-TILE blocks: they fill the whole 64x32 footprint, so neighbours tile into one continuous
mass (no posts, no gaps, no outline rings that could seam). Top faces carry a panel border so rows read as plates;
side faces carry skirting, a top lip and panel seams. Doors are blocks with a passage cut through them (axis 'x' = the
wall runs along grid x, you walk through along y; vice versa for 'y'). Builders return Blender objects; SPRITES lists
(id, footprint, kind, builder); kind: floor (diamond-masked), block (no ring), prop (1 px ring)."""
import math
from . import core

H = 1.3          # full wall height (tiles)
LOW = 0.25       # cutaway height
OPEN_W = 0.22    # door opening half-width along the wall axis
OPEN_H = 0.9     # door opening height
E = 0.004        # decal offset


def _h(i, j, s=0):
    return ((i * 73856093) ^ (j * 19349663) ^ (s * 83492791)) % 100


# ---- floors: large calm plates, no per-pixel noise ------------------------------------------------------------

def floor(variant):
    m = core.Mesh(f"floor_{variant}")

    def fn(i, j):
        if variant == "a":                      # 2x2 plates, bevelled
            pi, pj = i % 16, j % 16
            if pi == 0 or pj == 0:
                return "dark"
            if pi == 1 or pj == 1:
                return "steelL"
            if (pi, pj) in ((4, 4), (12, 4), (4, 12), (12, 12)):
                return "plate"
            return "steel"
        if variant == "b":                      # 2x2 plates, checkered tone
            pi, pj = i % 16, j % 16
            if pi == 0 or pj == 0:
                return "dark"
            if pi == 1 or pj == 1:
                return "steelL" if (i // 16 + j // 16) % 2 == 0 else "steel"
            return "steelD" if (i // 16 + j // 16) % 2 else "steel"
        if i == 0 or j == 0:                    # c: one big plate with an inset frame and corner bolts
            return "dark"
        if i == 1 or j == 1:
            return "steelL"
        if i in (5, 26) and 5 <= j <= 26 or j in (5, 26) and 5 <= i <= 26:
            return "steelD"
        if (i, j) in ((3, 3), (28, 3), (3, 28), (28, 28)):
            return "plate"
        return "steel"
    m.pattern((-0.5, -0.5, 0), (1, 0, 0), (0, 1, 0), 32, 32, fn)
    return [m.build()]


# ---- full-tile blocks -----------------------------------------------------------------------------------------

def _top_fn(style):
    hull = style == "hull"

    def fn(i, j):
        d = min(i, j, 31 - i, 31 - j)
        if d < 2:
            return "steelD" if hull else "steel"
        if d == 4 and 4 <= min(i, j) and max(i, j) <= 27:
            return "steel" if hull else "steelL"
        if hull:
            return "steel"
        return "steelL" if d < 5 else "plate" if (i in (7, 24) and j in (7, 24)) else "steelL"
    return fn


def _side_fn(h, style):
    nv = max(6, int(round(h * 39)))
    hull = style == "hull"

    def fn(i, j):
        top = nv - 1 - j
        if hull and j < 6 and nv > 10:
            return "hazY" if ((i + j) // 3) % 2 == 0 else "hazK"
        if j < (3 if nv > 10 else 2):
            return "dark"
        if top < (3 if nv > 10 else 2):
            return "steel" if hull else "steelL"
        if i == 0:
            return "dark"
        if nv > 12 and j in (nv // 2, nv // 2 + 1):
            return "dark" if hull else "steelD"
        if hull:
            return "rustD" if _h(i, j, 5) < 3 else "steelD"
        if nv > 12 and i in (3, 28) and j in (8, nv - 9):
            return "plate"
        return "steel" if (i // 16) % 2 == 0 else "blueGrey"
    return fn, nv


def _decals(m, h, style, hole=None, axis_hole=None):
    """Top + the two visible side faces. `hole(u, v)->True` skips cells (door opening) on the face given by axis_hole."""
    m.pattern((-0.5, -0.5, h + E), (1, 0, 0), (0, 1, 0), 32, 32, _top_fn(style))
    fn, nv = _side_fn(h, style)
    for face, o, du in (("y", (-0.5, 0.5 + E, 0), (1, 0, 0)), ("x", (0.5 + E, -0.5, 0), (0, 1, 0))):
        def f(i, j, face=face):
            if hole and face == axis_hole and hole(i, j):
                return None
            return fn(i, j)
        m.pattern(o, du, (0, 0, h), 32, nv, f)


def block(style="std", h=H):
    m = core.Mesh(f"block_{style}")
    m.box((0, 0, 0), (1, 1, h), "steelD" if style == "hull" else "steel", top="steel", base=True)
    _decals(m, h, style)
    return [m.build()]


def door(axis="x", h=H, is_open=False):
    """Block with a passage cut through it. axis x: wall along x, opening on the +y face (walk along y)."""
    m = core.Mesh(f"door_{axis}")
    a, oh = OPEN_W, OPEN_H
    tall = h > 0.5
    side = "steel"

    def bx(u0, u1, z0, z1):           # box spanning u in [u0,u1] along the wall axis, full depth
        c, w = (u0 + u1) / 2, u1 - u0
        if axis == "x":
            m.box((c, 0, z0), (w, 1, z1 - z0), side, top="steel", base=True)
        else:
            m.box((0, c, z0), (1, w, z1 - z0), side, top="steel", base=True)
    bx(-0.5, -a, 0, h)
    bx(a, 0.5, 0, h)
    if tall:
        bx(-a, a, oh, h)
    lo, hi = int((0.5 - a) * 32), int((0.5 + a) * 32)
    nvh = int(oh * 39)
    face = "y" if axis == "x" else "x"
    _decals(m, h, "std", hole=lambda i, j: lo <= i < hi and j < (nvh if tall else 99), axis_hole=face)
    pt = 0.12                                       # panel thickness along the passage
    pz = oh - 0.04 if tall else h - 0.04
    if not is_open:
        if axis == "x":
            m.box((0, 0, 0), (2 * a - 0.02, pt, pz), "steelD", top="steelL", base=True)
            o, du = (-a + 0.01, pt / 2 + E, 0), (2 * a - 0.02, 0, 0)
        else:
            m.box((0, 0, 0), (pt, 2 * a - 0.02, pz), "steelD", top="steelL", base=True)
            o, du = (pt / 2 + E, -a + 0.01, 0), (0, 2 * a - 0.02, 0)
        nv = max(5, int(pz * 39))
        w = int((2 * a - 0.02) * 32)

        def pf(i, j):
            if j < 3:
                return "hazY" if ((i + j) // 2) % 2 == 0 else "hazK"
            if i == w // 2 or i == w // 2 - 1:
                return "dark"
            if tall and nv - 8 <= j < nv - 4 and 2 <= i < w - 2 and i != w // 2 and i != w // 2 - 1:
                return "orange" if i < w // 2 else "cyan"
            return "steelL" if j >= nv - 2 else "steel"
        m.pattern(o, du, (0, 0, pz), w, nv, pf)
    elif tall:                                      # open: status light on the lintel
        c = (0.0, 0.5 + 2 * E)
        if axis == "x":
            m.box((0, 0.5 + 0.02, oh + 0.06), (0.2, 0.04, 0.05), "cyan")
        else:
            m.box((0.5 + 0.02, 0, oh + 0.06), (0.04, 0.2, 0.05), "cyan")
    return [m.build()]


# ---- props / modules ------------------------------------------------------------------------------------------

def lamp():
    """module.light: a standing lamp (works against any wall)."""
    m = core.Mesh("lamp")
    m.cyl((0, 0, 0), 0.14, 0.06, "steelD", sides=8, top="plate")
    m.cyl((0, 0, 0.06), 0.035, 0.7, "gm", sides=6)
    m.box((0, 0, 0.74), (0.2, 0.2, 0.05), "gmD", base=True, bevel=0.01)
    m.box((0, 0, 0.79), (0.15, 0.15, 0.11), "arc", base=True)
    m.box((0, 0, 0.9), (0.2, 0.2, 0.03), "gmD", base=True, bevel=0.01)
    return [m.build()]


def console():
    m = core.Mesh("console")
    m.box((0, -0.2, 0), (0.84, 0.46, 0.5), "steelD", top="plate", base=True, bevel=0.015)
    m.box((0, -0.18, 0), (0.7, 0.5, 0.12), "dark", base=True)
    th = 0.5
    n = (0, math.cos(th), math.sin(th))
    up = (0, -math.sin(th), math.cos(th))
    c0 = (0, -0.3, 0.74)
    m.box(c0, (0.78, 0.07, 0.4), "gmD", rx=th, bevel=0.012)
    for k in range(6):
        u = -0.14 + k * 0.058
        p = tuple(c0[i] + n[i] * 0.045 + up[i] * u for i in range(3))
        m.box(p, (0.62, 0.02, 0.036), "magenta", rx=th)
    m.box((0, -0.04, 0.53), (0.66, 0.2, 0.04), "steelL", bevel=0.008)
    for k in range(5):
        m.box((-0.24 + k * 0.12, 0.0, 0.56), (0.07, 0.07, 0.03), "cyan" if k % 2 else "orange")
    m.box((0.34, 0.05, 0.62), (0.05, 0.05, 0.12), "gm", bevel=0.01)
    return [m.build()]


def reactor():
    m = core.Mesh("reactor")
    cx = cy = -0.5
    m.box((cx, cy, 0), (1.92, 1.92, 0.12), "steelD", top="plateA", base=True, bevel=0.02)
    for k in range(10):
        m.box((cx - 0.9 + k * 0.2, cy + 0.95, 0.12), (0.12, 0.05, 0.03), "hazY" if k % 2 == 0 else "hazK", base=True)
        m.box((cx + 0.95, cy - 0.9 + k * 0.2, 0.12), (0.05, 0.12, 0.03), "hazY" if k % 2 == 0 else "hazK", base=True)
    m.cyl((cx, cy, 0.12), 0.72, 0.78, "steel", sides=8, top="steelL")
    m.cyl((cx, cy, 0.5), 0.745, 0.08, "gmD", sides=8)
    m.cyl((cx, cy, 0.9), 0.55, 0.3, "gm", sides=8, top="plate")
    for a in (0, 45, 90):
        r = 0.72 * math.cos(math.pi / 8) + 0.005
        ar = math.radians(a)
        m.box((cx + r * math.cos(ar), cy + r * math.sin(ar), 0.2), (0.025, 0.11, 0.55), "cyan", rz=ar, base=True)
    m.cyl((cx, cy, 1.02), 0.3, 0.7, "cyan", sides=8)
    m.cyl((cx, cy, 1.72), 0.36, 0.06, "steelL", sides=8)
    m.cyl((cx, cy, 1.04), 0.37, 0.05, "steelL", sides=8)
    for a in (0, 45, 90):
        ar = math.radians(a)
        m.box((cx + 0.5 * math.cos(ar), cy + 0.5 * math.sin(ar), 1.0), (0.02, 0.1, 0.16), "orange", rz=ar, base=True)
    m.box((cx + 0.15, cy + 0.84, 0.12), (0.7, 0.2, 0.5), "steelD", top="plate", base=True, bevel=0.015)
    for k in range(4):
        m.box((cx + 0.15 - 0.24 + k * 0.16, cy + 0.9, 0.5), (0.08, 0.06, 0.04), ("magenta", "cyan", "orange", "cyan")[k])
    m.box((cx + 0.15, cy + 0.94, 0.3), (0.5, 0.03, 0.12), "dark")
    m.box((cx - 0.55, cy - 0.55, 0.12), (0.22, 0.22, 0.9), "rust", top="rustD", base=True, bevel=0.02)
    return [m.build()]


def life_support():
    """1 wide (x) by 2 long (y): footprint [1, 2]; origin on the front tile, body spans y -1.5..0.5."""
    m = core.Mesh("life_support")
    cy = -0.5
    m.box((0, cy, 0), (0.92, 1.9, 0.14), "steelD", top="plateA", base=True, bevel=0.02)
    for k, y in enumerate((cy - 0.45, cy + 0.45)):
        m.cyl((0, y, 0.14), 0.36, 1.05, "steel", sides=8, top="steelL")
        m.cyl((0, y, 0.5), 0.375, 0.07, "gmD", sides=8)
        m.cyl((0, y, 1.0), 0.375, 0.06, "gmD", sides=8)
        m.cyl((0, y, 1.19), 0.22, 0.12, "gm", sides=8, top="plate")
        for a in (45, 135):
            ar = math.radians(a)
            r = 0.36 * math.cos(math.pi / 8) + 0.005
            m.box((r * math.cos(ar), y + r * math.sin(ar), 0.62), (0.025, 0.1, 0.3), "cyan", rz=ar, base=True)
    m.box((0, cy, 0.14), (0.16, 0.5, 0.95), "gm", top="plate", base=True, bevel=0.01)       # manifold between the tanks
    m.box((0.0, cy, 0.8), (0.2, 0.3, 0.06), "cyan")
    m.box((0.3, cy + 0.85, 0.14), (0.26, 0.2, 0.6), "steelD", top="plate", base=True, bevel=0.01)
    for k in range(3):
        m.box((0.3, cy + 0.96, 0.52 + k * 0.0), (0.16 - k * 0.04, 0.02, 0.04), ("cyan", "orange", "magenta")[k]) if False else None
    m.box((0.3, cy + 0.96, 0.4), (0.14, 0.03, 0.05), "cyan")
    m.box((0.3, cy + 0.96, 0.3), (0.14, 0.03, 0.05), "cyan")
    return [m.build()]


def bed():
    """1 wide (x) by 2 long (y): footprint [1, 2]; mattress top is at 0.22 (sleeping crew are lifted by that)."""
    m = core.Mesh("bed")
    cy = -0.5
    m.box((0, cy, 0), (0.88, 1.9, 0.12), "steelD", top="steel", base=True, bevel=0.015)
    for sx in (-1, 1):
        for y in (cy - 0.85, cy + 0.85):
            m.box((sx * 0.38, y, 0), (0.1, 0.1, 0.1), "dark", base=True)
    m.box((0, cy, 0.1), (0.84, 1.86, 0.12), "navy", top="blueGrey", base=True, bevel=0.02)
    m.box((0, cy - 0.68, 0.22), (0.62, 0.42, 0.08), "medWhite", top="medWhite", base=True, bevel=0.03)   # pillow
    m.box((0, cy + 0.2, 0.22), (0.82, 1.1, 0.035), "steelL", base=True)                                    # blanket
    m.box((0, cy + 0.2, 0.255), (0.8, 1.06, 0.01), "blueGrey", base=True)
    m.box((0, cy - 0.34, 0.22), (0.82, 0.05, 0.04), "orange", base=True)
    m.box((0, cy + 0.93, 0.0), (0.88, 0.05, 0.38), "steelD", top="steel", base=True, bevel=0.01)          # footboard
    m.box((0, cy - 0.93, 0.0), (0.88, 0.05, 0.5), "steelD", top="steel", base=True, bevel=0.01)           # headboard
    m.box((0, cy - 0.9, 0.34), (0.5, 0.02, 0.05), "cyan")
    return [m.build()]


def _crate(m, c, s, body, top, post, rz=0.0, z0=0.0):
    m.box((c[0], c[1], z0), (s, s, s * 0.8), body, top=top, base=True, rz=rz, bevel=0.015)
    h = s * 0.8
    k = s / 2 - 0.025
    ca, sa = math.cos(rz), math.sin(rz)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * k, sy * k
            m.box((c[0] + x * ca - y * sa, c[1] + x * sa + y * ca, z0), (0.06, 0.06, h + 0.01), post, top=post, base=True, rz=rz)
    m.box((c[0], c[1], z0 + h * 0.5), (s + 0.012, s + 0.012, 0.035), post, base=True, rz=rz)


def crates():
    m = core.Mesh("crates")
    _crate(m, (-0.1, -0.1), 0.72, "rust", "rustD", "steel")
    _crate(m, (-0.1, -0.1), 0.5, "steel", "steelL", "gm", rz=0.18, z0=0.58)
    m.box((0.15, 0.26, 0.14), (0.22, 0.012, 0.16), "hazY", base=True)
    m.box((0.3, 0.28, 0), (0.34, 0.34, 0.3), "steelD", top="steel", base=True, bevel=0.015, rz=-0.15)
    m.box((0.3, 0.28, 0.12), (0.355, 0.355, 0.04), "orange", base=True, rz=-0.15)
    return [m.build()]


SPRITES = [
    ("tile.floor.a", (1, 1), "floor", lambda: floor("a")),
    ("tile.floor.b", (1, 1), "floor", lambda: floor("b")),
    ("tile.floor.c", (1, 1), "floor", lambda: floor("c")),
    ("tile.wall", (1, 1), "block", lambda: block("std", H)),
    ("tile.wall.low", (1, 1), "block", lambda: block("std", LOW)),
    ("tile.hull", (1, 1), "block", lambda: block("hull", H)),
    ("tile.hull.low", (1, 1), "block", lambda: block("hull", LOW)),
]
for _ax in ("x", "y"):
    SPRITES += [
        (f"tile.door.{_ax}", (1, 1), "block", lambda a=_ax: door(a, H, False)),
        (f"tile.door.open.{_ax}", (1, 1), "block", lambda a=_ax: door(a, H, True)),
        (f"tile.door.low.{_ax}", (1, 1), "block", lambda a=_ax: door(a, LOW, False)),
        (f"tile.door.low.open.{_ax}", (1, 1), "block", lambda a=_ax: door(a, LOW, True)),
    ]
SPRITES += [
    ("prop.crate", (1, 1), "prop", crates),
    ("module.reactor", (2, 2), "prop", reactor),
    ("module.life_support", (1, 2), "prop", life_support),
    ("module.light", (1, 1), "prop", lamp),
    ("module.bed", (1, 2), "prop", bed),
    ("module.console", (1, 1), "prop", console),
]
