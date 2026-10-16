"""Environment sprite models (grid frame; origin = centre of the FRONT-most footprint tile at floor level).

Walls and doors are SLABS through the tile centre (axis 'x' runs along grid +x, 'y' along grid +y), exactly one tile
long so neighbours abut. Each slab piece carries an identical centre post (a little wider/taller than the slab), so
stacking an x and a y piece on one tile (corner / T / plus) draws the same junction pixels twice instead of showing
mismatched end faces. Builders return Blender objects; SPRITES lists (id, footprint, kind, builder).
kind: floor (diamond-masked), slab:<axis> (outline ring only outside the row of neighbours), prop (full ring)."""
import math
from . import core

H = 1.0          # full wall height (tiles)
LOW = 0.3        # cutaway height
T = 0.2          # wall thickness
TH = 0.3         # hull thickness
POST = 0.075     # post grows this much beyond the slab on each side


def _h(i, j, s=0):
    return ((i * 73856093) ^ (j * 19349663) ^ (s * 83492791)) % 100


# ---- floors ---------------------------------------------------------------------------------------------------

def floor(variant):
    m = core.Mesh(f"floor_{variant}")
    n = 32

    def fn(i, j):
        pi, pj = i % 16, j % 16               # 2x2 big panels
        edge = pi == 0 or pj == 0
        hi = pi == 1 or pj == 1
        if variant == "a":                     # bevelled steel panels
            if edge:
                return "dark"
            if hi:
                return "steelL"
            if pi == 15 or pj == 15:
                return "steelD"
            if (pi, pj) in ((3, 3), (12, 3), (3, 12), (12, 12)):
                return "plate"
            return "steelD" if _h(i, j) < 7 else "steel"
        if variant == "b":                     # grating: dark slots between bright ribs
            if i % 16 == 0 or j % 16 == 0:
                return "dark"
            if i % 16 == 1 or j % 16 == 1:
                return "steelL"
            return "dark" if (i % 4 in (1, 2)) else ("steel" if _h(i, j, 2) > 10 else "steelD")
        # c: diamond-plate with hazard edge strips
        if (i < 2 or j < 2) and False:
            return "hazY"
        if edge:
            return "dark"
        if hi:
            return "steelL"
        if (pi + pj) % 4 < 2 and 3 <= pi <= 13 and 3 <= pj <= 13:
            return "steelD"
        return "rustD" if _h(i, j, 4) < 5 else "steel"
    m.pattern((-0.5, -0.5, 0), (1, 0, 0), (0, 1, 0), n, n, fn)
    return [m.build()]


# ---- slabs ----------------------------------------------------------------------------------------------------

def _face(m, axis, t, h, style):
    """Decal on the visible long (+y / +x) face. 32 columns along the tile (1 px each) x ~40 rows (1 px each)."""
    nv = max(6, int(round(h * 40)))
    hull = style == "hull"

    def fn(i, j):
        top = nv - 1 - j
        if j < 3:
            return ("hazY" if (i + j) // 3 % 2 == 0 else "hazK") if hull else "dark"
        if top < 2:
            return "steel" if hull else "steelL"
        if i == 0:
            return "dark"
        if nv > 12 and j in (nv // 2, nv // 2 + 1):
            return "dark" if hull else "steelD"
        if hull:
            if _h(i, j, 5) < 9:
                return "rustD"
            return "steelD" if (j // 5 + i // 8) % 2 else "steel"
        if nv > 12 and i in (2, 29) and j in (6, nv - 7):
            return "plate"
        if nv > 12 and top >= 2 and top < 5:
            return "steel"
        return "steelL" if (i // 16 + (j > nv // 2)) % 2 else "steel"
    e = 0.004
    if axis == "x":
        m.pattern((-0.5, t / 2 + e, 0), (1, 0, 0), (0, 0, h), 32, nv, fn)
    else:
        m.pattern((t / 2 + e, -0.5, 0), (0, 1, 0), (0, 0, h), 32, nv, fn)


def _post(m, axis, t, h):
    s = t + 2 * POST
    m.box((0, 0, 0), (s, s, h + 0.035), "steelD", top="plate", base=True)
    e = 0.004
    if axis == "x":
        m.pattern((-s / 2, s / 2 + e, 0), (s, 0, 0), (0, 0, h + 0.035), 4, 12, lambda i, j: "dark" if j < 2 else ("plate" if j > 9 else "steelD"))
    else:
        m.pattern((s / 2 + e, -s / 2, 0), (0, s, 0), (0, 0, h + 0.035), 4, 12, lambda i, j: "dark" if j < 2 else ("plate" if j > 9 else "steelD"))


def wall(axis="x", style="std", h=H, extra=None):
    t = TH if style == "hull" else T
    m = core.Mesh(f"wall_{style}_{axis}")
    size = (1, t, h) if axis == "x" else (t, 1, h)
    m.box((0, 0, 0), size, "steelD" if style == "hull" else "steel", top="steel" if style == "hull" else "steelL", base=True)
    _face(m, axis, t, h, style)
    _post(m, axis, t, h)
    if extra:
        extra(m, axis, t)
    return [m.build()]


def _on_wall(m, axis, t, c_along, z, size_along, size_h, depth, color):
    if axis == "x":
        m.box((c_along, t / 2 + depth / 2, z), (size_along, depth, size_h), color, base=True)
    else:
        m.box((t / 2 + depth / 2, c_along, z), (depth, size_along, size_h), color, base=True)


def door(axis="x", h=H, is_open=False):
    m = core.Mesh(f"door_{axis}")
    tj = T + 0.06

    def box(along, sz_along, z, hh, thick, off, col, top=None):
        if axis == "x":
            m.box((along, off, z), (sz_along, thick, hh), col, top=top, base=True)
        else:
            m.box((off, along, z), (thick, sz_along, hh), col, top=top, base=True)
    box(-0.4, 0.2, 0, h, tj, 0, "steelL", "plate")
    box(0.4, 0.2, 0, h, tj, 0, "steelL", "plate")
    box(0, 0.6, h - 0.2 if h > 0.5 else h - 0.08, 0.2 if h > 0.5 else 0.08, tj, 0, "gmD", "gm")
    box(0, 0.6, 0, 0.04, tj, 0, "hazY")                       # threshold
    lh = h - 0.22 if h > 0.5 else h - 0.1
    if is_open:                                               # leaf slid into the jambs
        box(-0.32, 0.06, 0.04, lh, 0.12, 0, "steel")
        box(0.32, 0.06, 0.04, lh, 0.12, 0, "steel")
        status = "cyan"
    else:
        box(0, 0.6, 0.04, lh, 0.1, 0, "steel", "steelL")
        box(0, 0.5, 0.04, 0.12 if h > 0.5 else 0.05, 0.11, 0, "hazY")
        if h > 0.5:
            box(0, 0.3, 0.56, 0.14, 0.115, 0, "steelD")
            box(0, 0.016, 0.04, lh, 0.112, 0, "dark")
        status = "orange"
    if h > 0.5:
        box(-0.27, 0.06, 0.62, 0.1, 0.12, 0, status if not is_open else "cyan")
        box(0.27, 0.06, 0.62, 0.1, 0.12, 0, status)
        box(0.0, 0.18, h - 0.1, 0.05, tj + 0.02, 0, "magenta")
    return [m.build()]


def light_extra(color_panel, bracket="gmD"):
    def f(m, axis, t):
        _on_wall(m, axis, t, 0.3, 0.62, 0.3, 0.12, 0.07, bracket)
        _on_wall(m, axis, t, 0.3, 0.645, 0.22, 0.06, 0.085, color_panel)
    return f


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


def _slab(axis, style, h, extra=None):
    return lambda: wall(axis, style, h, extra)


def _all(fn_by_axis):
    out = []
    for ax in ("x", "y"):
        out.append(fn_by_axis(ax))
    return out


SPRITES = [
    ("tile.floor.a", (1, 1), "floor", lambda: floor("a")),
    ("tile.floor.b", (1, 1), "floor", lambda: floor("b")),
    ("tile.floor.c", (1, 1), "floor", lambda: floor("c")),
]
for _ax in ("x", "y"):
    SPRITES += [
        (f"tile.wall.{_ax}", (1, 1), f"slab:{_ax}", _slab(_ax, "std", H)),
        (f"tile.wall.low.{_ax}", (1, 1), f"slab:{_ax}", _slab(_ax, "std", LOW)),
        (f"tile.hull.{_ax}", (1, 1), f"slab:{_ax}", _slab(_ax, "hull", H)),
        (f"tile.hull.low.{_ax}", (1, 1), f"slab:{_ax}", _slab(_ax, "hull", LOW)),
        (f"tile.door.{_ax}", (1, 1), f"slab:{_ax}", lambda a=_ax: door(a, H, False)),
        (f"tile.door.open.{_ax}", (1, 1), f"slab:{_ax}", lambda a=_ax: door(a, H, True)),
        (f"tile.door.low.{_ax}", (1, 1), f"slab:{_ax}", lambda a=_ax: door(a, LOW, False)),
        (f"tile.door.low.open.{_ax}", (1, 1), f"slab:{_ax}", lambda a=_ax: door(a, LOW, True)),
    ]
SPRITES += [
    ("prop.crate", (1, 1), "prop", crates),
    ("module.reactor", (2, 2), "prop", reactor),
    ("module.life_support", (1, 2), "prop", life_support),
    ("module.light", (1, 1), "prop", lamp),
    ("module.bed", (1, 2), "prop", bed),
    ("module.console", (1, 1), "prop", console),
]
