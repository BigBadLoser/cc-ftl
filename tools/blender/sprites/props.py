"""Environment sprite models (grid frame; origin = centre of the FRONT-most footprint tile at floor level).

Walls follow the Space Haven look: a low SLOPED BASE (berm, wide at the floor, narrow ridge on top, darker metal) along
the wall line, with a THIN upper wall rising from the ridge. Both are CONNECTED piece sets, autotiled by neighbours:
a centre piece (`.c`) plus an arm from the centre to the tile edge in each connected direction (`.arm.n/e/s/w`;
n = -y, e = +x, s = +y, w = -x). Arms share the exact cross-section of their neighbour's arm, so runs, corners, T and +
junctions composite seamlessly. Draw order inside a tile: base pieces, then upper pieces, each as n, w, c, s, e
(back arms, centre, front arms). Doors are slim upright frames (two posts + lintel with an amber light bar and a
sliding panel) standing on the base arms. Builders return Blender objects; SPRITES lists (id, footprint, kind,
builder); kind: floor (diamond-masked), block (no ring), prop (1 px ring)."""
import math
from . import core

HB = 0.26          # base height (tiles)
WB = 0.46          # base half-width at the floor (nearly the full tile across the wall line)
WT = 0.11          # base half-width at the ridge
TU = 3 / 32        # upper wall half-thickness (3/16 tile thick)
HU = 0.85          # upper wall height above the ridge
HU_LOW = 0.10      # collapsed (cutaway) upper stub
DOOR_X = 0.31      # door posts span |u| in [DOOR_X, 0.5]
DOOR_LINTEL = 0.68 # opening height above the ridge
E = 0.004          # decal offset
DIRS = ("n", "e", "s", "w")


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


# ---- sloped base ----------------------------------------------------------------------------------------------

def _P(axis, u, v, z):
    """(along-axis u, across v, z) -> grid point for a piece along `axis` ('x': u = gx; 'y': u = gy)."""
    return (u, v, z) if axis == "x" else (v, u, z)


def _wv(z):
    return WB - (WB - WT) * z / HB


def _q(m, pts, col):
    m.poly([core.G(*p) for p in pts], col)


# (z0, z1, colour) bands of the visible slope. The lit face (+y, seen on walls along x) is clearly lighter than the
# floor, the other face (+x) clearly darker; both have a dark crease at the floor, faint panel line and a crest line.
def _bands(lit, hull):
    m = HB / 2
    if hull:
        haz = (0.0, 0.05, "haz")
        return [haz, (0.05, m - 0.01, "steelL" if lit else "steelD"), (m - 0.01, m + 0.01, "steelD" if lit else "dark"),
                (m + 0.01, HB - 0.03, "steelL" if lit else "steelD"), (HB - 0.03, HB, "plate" if lit else "steel")]
    return [(0.0, 0.03, "dark"), (0.03, m - 0.01, "plate" if lit else "steelD"),
            (m - 0.01, m + 0.01, "steelL" if lit else "dark"), (m + 0.01, HB - 0.03, "plate" if lit else "steelD"),
            (HB - 0.03, HB, "medWhite" if lit else "steelL")]


def _slope(m, axis, u0, u1, hull, taper=False):
    """Visible (+v) sloped face of the base from u0 to u1. With `taper` (the centre frustum) the face is a trapezoid:
    its width at height z is 2*wv(z)."""
    def rng(a, b, z):
        return (max(a, -_wv(z)), min(b, _wv(z))) if taper else (a, b)

    def quad(a, b, z0, z1, col):
        a0, b0 = rng(a, b, z0)
        a1, b1 = rng(a, b, z1)
        _q(m, [_P(axis, a0, _wv(z0), z0), _P(axis, b0, _wv(z0), z0), _P(axis, b1, _wv(z1), z1),
               _P(axis, a1, _wv(z1), z1)], col)
    for z0, z1, col in _bands(axis == "x", hull):
        if col == "haz":                          # hazard stripe, stripes 1/16 tile long, aligned to the tile grid
            i0, i1 = math.floor((u0 + 0.5) * 16 + 1e-6), math.ceil((u1 + 0.5) * 16 - 1e-6)
            for i in range(i0, i1):
                quad(max(u0, i / 16 - 0.5), min(u1, (i + 1) / 16 - 0.5), z0, z1, "hazY" if i % 2 == 0 else "hazK")
        else:
            quad(u0, u1, z0, z1, col)


def _ridge(m, axis, u0, u1, hull):
    _q(m, [_P(axis, u0, -WT, HB), _P(axis, u1, -WT, HB), _P(axis, u1, WT, HB), _P(axis, u0, WT, HB)],
       "steel" if hull else "steelL")


def base_piece(part, hull):
    """part: 'c' or n/e/s/w arm."""
    m = core.Mesh(f"base_{part}", flat=True)
    if part == "c":
        for ax in ("x", "y"):                     # visible slopes: +y (axis x) and +x (axis y)
            _slope(m, ax, -WB, WB, hull, taper=True)
        _q(m, [(-WT, -WT, HB), (WT, -WT, HB), (WT, WT, HB), (-WT, WT, HB)], "steel" if hull else "steelL")
    else:
        axis = "x" if part in ("e", "w") else "y"
        u0, u1 = (0.0, 0.5) if part in ("e", "s") else (-0.5, 0.0)
        _ridge(m, axis, u0, u1, hull)
        _slope(m, axis, u0, u1, hull)
        if part in ("e", "s"):                    # end cap (visible only where nothing continues)
            _end_cap(m, axis, u1)
    return [m.build()]


def _end_cap(m, axis, u):
    _q(m, [_P(axis, u, -_wv(0), 0), _P(axis, u, _wv(0), 0), _P(axis, u, _wv(HB), HB), _P(axis, u, -_wv(HB), HB)], "steelD")


def door_sill(axis):
    """Door threshold: a flat sill plate with hazard edges between the posts, plus a base foot under each post that
    continues the neighbouring walls' base cross-section flush to the frame. No base runs through the opening."""
    m = core.Mesh(f"sill_{axis}", flat=True)
    for u0, u1, cap in ((-0.5, -DOOR_X, DOOR_X), (DOOR_X, 0.5, None)):
        _ridge(m, axis, u0, u1, False)
        _slope(m, axis, u0, u1, False)
        if cap is not None:
            _end_cap(m, axis, u1)                 # inner end of the near foot faces the opening and is visible
        else:
            _end_cap(m, axis, u1)                 # outer end (covered by the neighbour's arm)
    d = 0.19                                      # sill depth along the passage (half)
    zt = 0.03
    _q(m, [_P(axis, -DOOR_X, -d, zt), _P(axis, DOOR_X, -d, zt), _P(axis, DOOR_X, d, zt), _P(axis, -DOOR_X, d, zt)], "steelL")
    n = 10
    for i in range(n):                            # hazard edge strips along both long edges, 1 art px wide
        a = -DOOR_X + 2 * DOOR_X * i / n
        b = -DOOR_X + 2 * DOOR_X * (i + 1) / n
        col = "hazY" if i % 2 == 0 else "hazK"
        for v0, v1 in ((d - 0.05, d), (-d, -d + 0.05)):
            _q(m, [_P(axis, a, v0, zt + 0.001), _P(axis, b, v0, zt + 0.001), _P(axis, b, v1, zt + 0.001),
                   _P(axis, a, v1, zt + 0.001)], col)
    _q(m, [_P(axis, -DOOR_X, d, 0), _P(axis, DOOR_X, d, 0), _P(axis, DOOR_X, d, zt), _P(axis, -DOOR_X, d, zt)], "steelD")
    return [m.build()]


# ---- thin upper wall ------------------------------------------------------------------------------------------

def _face_fn(nv, hull):
    """Wall face colour at absolute cell ui (0..31 along the tile) and row j (0 = bottom)."""
    def fn(ui, j):
        top = nv - 1 - j
        if top < (2 if nv > 6 else 1):
            return "steel" if hull else "steelL"
        if nv <= 6:
            return "steelD" if hull else "steel"
        if j < 2:
            return "dark" if hull else "steelD"
        if ui == 0:
            return "dark"
        if j in (nv // 2, nv // 2 + 1):
            return "dark" if hull else "steelD"
        if hull:
            return "rustD" if _h(ui, j, 5) < 3 else "steelD"
        if ui in (3, 28) and j in (7, nv - 8):
            return "plate"
        return "steel" if (ui // 16) % 2 == 0 else "blueGrey"
    return fn


def _cells(axis_part):
    """Absolute cell range [c0, c1) along the tile for the piece part, centre = [13, 19)."""
    lo, hi = 16 - 3, 16 + 3
    return {"c": (lo, hi), "e": (hi, 32), "s": (hi, 32), "w": (0, lo), "n": (0, lo)}[axis_part]


def upper_piece(part, hull, hu):
    m = core.Mesh(f"upper_{part}")
    z0, z1 = HB - 0.01, HB + hu
    side = "steelD" if hull else "steel"
    nv = max(4, int(round(hu * 39)))
    fn = _face_fn(nv, hull)
    parts = ("x", "y") if part == "c" else (("x",) if part in ("e", "w") else ("y",))
    # body box
    if part == "c":
        m.box((0, 0, z0), (2 * TU, 2 * TU, z1 - z0), side, top="steelD" if hull else "steelL", base=True)
        ranges = {"x": (-TU, TU), "y": (-TU, TU)}
    else:
        axis = parts[0]
        u0, u1 = {"e": (TU, 0.5), "s": (TU, 0.5), "w": (-0.5, -TU), "n": (-0.5, -TU)}[part]
        c, w = (u0 + u1) / 2, u1 - u0
        if axis == "x":
            m.box((c, 0, z0), (w, 2 * TU, z1 - z0), side, top="steelD" if hull else "steelL", base=True)
        else:
            m.box((0, c, z0), (2 * TU, w, z1 - z0), side, top="steelD" if hull else "steelL", base=True)
    # decals on the visible faces (+y face for pieces along x, +x face for pieces along y)
    for ax in parts:
        c0, c1 = _cells(part)
        u0, u1 = -0.5 + c0 / 32, -0.5 + c1 / 32
        if ax == "x":
            o, du = (u0, TU + E, z0), (u1 - u0, 0, 0)
        else:
            o, du = (TU + E, u0, z0), (0, u1 - u0, 0)
        m.pattern(o, du, (0, 0, z1 - z0), c1 - c0, nv, lambda i, j, c0=c0: fn(c0 + i, j))
        # top cap: border lines along the wall, light inside
        if part != "c" or ax == "x":
            if ax == "x":
                to, tdu, tdv = (u0, -TU, z1 + E), (u1 - u0, 0, 0), (0, 2 * TU, 0)
                m.pattern(to, tdu, tdv, c1 - c0, 6, lambda i, j: ("steelD" if hull else "steel") if j in (0, 5) else ("steel" if hull else "steelL"))
            else:
                to, tdu, tdv = (-TU, u0, z1 + E), (2 * TU, 0, 0), (0, u1 - u0, 0)
                m.pattern(to, tdu, tdv, 6, c1 - c0, lambda i, j: ("steelD" if hull else "steel") if i in (0, 5) else ("steel" if hull else "steelL"))
    return [m.build()]


# ---- doors ----------------------------------------------------------------------------------------------------

def door(axis="x", is_open=False):
    """Slim upright frame: two posts + lintel (amber light bar) + sliding panel, standing on the base arms."""
    m = core.Mesh(f"door_{axis}")
    z0, z1 = HB - 0.01, HB + HU
    nv = int(round(HU * 39))
    fn = _face_fn(nv, False)

    def box(u0, u1, za, zb, col, top, t=TU):
        c, w = (u0 + u1) / 2, u1 - u0
        if axis == "x":
            m.box((c, 0, za), (w, 2 * t, zb - za), col, top=top, base=True)
        else:
            m.box((0, c, za), (2 * t, w, zb - za), col, top=top, base=True)

    def face(u0, u1, za, zb, f, t=TU):
        n = max(1, round((u1 - u0) * 32))
        h = max(1, round((zb - za) * 39))
        if axis == "x":
            o, du = (u0, t + E, za), (u1 - u0, 0, 0)
        else:
            o, du = (t + E, u0, za), (0, u1 - u0, 0)
        m.pattern(o, du, (0, 0, zb - za), n, h, f)

    def top(u0, u1):
        n = max(1, round((u1 - u0) * 32))
        if axis == "x":
            m.pattern((u0, -TU, z1 + E), (u1 - u0, 0, 0), (0, 2 * TU, 0), n, 6, lambda i, j: "steel" if j in (0, 5) else "steelL")
        else:
            m.pattern((-TU, u0, z1 + E), (2 * TU, 0, 0), (0, u1 - u0, 0), 6, n, lambda i, j: "steel" if i in (0, 5) else "steelL")
    lint = HB + DOOR_LINTEL
    box(-0.5, -DOOR_X, z0, z1, "steel", "steelL")
    box(DOOR_X, 0.5, z0, z1, "steel", "steelL")
    box(-DOOR_X, DOOR_X, lint, z1, "steelD", "steelL")
    c0 = 0
    for ua, ub in ((-0.5, -DOOR_X), (DOOR_X, 0.5)):
        a, b = round((ua + 0.5) * 32), round((ub + 0.5) * 32)
        face(ua, ub, z0, z1, lambda i, j, a=a: fn(a + i, j))
    top(-0.5, 0.5)
    nl = max(1, round((z1 - lint) * 39))
    nw = round(2 * DOOR_X * 32)

    def lintel_fn(i, j):
        if j == nl - 1:
            return "steelL"
        if 3 <= i < nw - 3 and nl // 2 - 1 <= j <= nl // 2 + 1:
            return "hazY"                                 # amber light bar
        return "steelD"
    face(-DOOR_X, DOOR_X, lint, z1, lintel_fn)
    gl = (0.0, 0.0)
    # glowing core of the light bar (emissive, goes to the glow sheet)
    mid = (lint + z1) / 2
    if axis == "x":
        m.box((0, TU + 2 * E, mid), (2 * DOOR_X - 0.2, 0.01, 0.025), "orange")
    else:
        m.box((TU + 2 * E, 0, mid), (0.01, 2 * DOOR_X - 0.2, 0.025), "orange")
    pt = 0.045
    ph = lint - 0.03
    if not is_open:
        box(-DOOR_X, DOOR_X, 0.03, lint, "steelD", "steelL", pt)

        def pf(i, j):
            if j < 3:
                return "hazY" if ((i + j) // 2) % 2 == 0 else "hazK"
            if i in (nw // 2 - 1, nw // 2):
                return "dark"
            if j >= round(ph * 39) - 2:
                return "steelL"
            return "steel"
        face(-DOOR_X, DOOR_X, 0.03, lint, pf, pt)
    else:
        for ua, ub in ((-DOOR_X, -DOOR_X + 0.05), (DOOR_X - 0.05, DOOR_X)):
            box(ua, ub, 0.03, lint, "steelD", "steelL", pt)
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
]
for _fam in ("wall", "hull"):
    _hull = _fam == "hull"
    for _part in ("c",) + DIRS:
        _suffix = "c" if _part == "c" else f"arm.{_part}"
        SPRITES += [
            (f"tile.{_fam}.base.{_suffix}", (1, 1), "block", lambda p=_part, h=_hull: base_piece(p, h)),
            (f"tile.{_fam}.upper.{_suffix}", (1, 1), "block", lambda p=_part, h=_hull: upper_piece(p, h, HU)),
            (f"tile.{_fam}.upper.low.{_suffix}", (1, 1), "block", lambda p=_part, h=_hull: upper_piece(p, h, HU_LOW)),
        ]
for _ax in ("x", "y"):
    SPRITES += [
        (f"tile.door.{_ax}", (1, 1), "block", lambda a=_ax: door(a, False)),
        (f"tile.door.{_ax}.open", (1, 1), "block", lambda a=_ax: door(a, True)),
        (f"tile.door.sill.{_ax}", (1, 1), "block", lambda a=_ax: door_sill(a)),
    ]
SPRITES += [
    ("prop.crate", (1, 1), "prop", crates),
    ("module.reactor", (2, 2), "prop", reactor),
    ("module.life_support", (1, 2), "prop", life_support),
    ("module.light", (1, 1), "prop", lamp),
    ("module.bed", (1, 2), "prop", bed),
    ("module.console", (1, 1), "prop", console),
]
