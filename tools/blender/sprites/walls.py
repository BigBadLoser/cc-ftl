"""Walls, hull, ghosts, doors and floors (grid frame, origin = tile centre at floor level).

A wall tile is a LOW bevelled block that fills its tile. For a 4-neighbour mask (bit 1 = N = -y, 2 = E = +x,
4 = S = +y, 8 = W = -x) every side that connects to another wall/hull/door is cut FLUSH at the tile edge (full
height, so neighbours merge into one continuous berm) and every other side SLOPES from the tile edge at the floor
up to an inset flat top. The top carries a dark recessed channel along the connected directions (isolated tile: a
small square pit). Only the two camera-facing slopes (+y = S, lit; +x = E, shaded) are modelled; they get panel
insets. Hull = darker plating; hazard stripes on its exterior slopes are separate overlay sprites. Ghost = the same
silhouette in near-black (alpha applied by env_build). Doors: tall upright frame on the wall line.
Builders return Blender objects; SPRITES lists (id, footprint, kind, builder)."""
from . import core

H = 0.38           # block height (tiles)
WT = 7 / 32        # top half-width of an open side (slope inset from the tile edge)
CH = 2 / 32        # channel half-width
NU, NT = 32, 16    # slope cells across / up
DH = 1.3           # door frame height
DX = 0.30          # door opening half-width
DIRS = ("n", "e", "s", "w")
BIT = {"n": 1, "e": 2, "s": 4, "w": 8}

PAL = {  # family -> colours
    "wall": dict(top="steelD", chan="dark", sb="steel", sp="steelL", sl="steelD", eb="steelD", ep="steel",
                 el="dark", crest="steelL"),
    "hull": dict(top="plateA", chan="dark", sb="steelD", sp="steel", sl="dark", eb="plateA", ep="steelD",
                 el="dark", crest="steel"),
    "ghost": dict(top="dark", chan="hazK", sb="grime", sp="hazK", sl="dark", eb="dark", ep="hazK",
                  el="dark", crest="steelL"),
}


def lerp(a, b, t):
    return a + (b - a) * t


def rect(mask):
    """Top rectangle (xw, xe, yn, ys) of the block for a mask."""
    return (-0.5 if mask & 8 else -WT, 0.5 if mask & 2 else WT, -0.5 if mask & 1 else -WT, 0.5 if mask & 4 else WT)


# ---- slope panel patterns ------------------------------------------------------------------------------------

def _panel(c, lit, deco, i, j):
    """Colour of slope cell (i across 0..31, j up 0..15)."""
    body, inner, edge = (c["sb"], c["sp"], c["sl"]) if lit else (c["eb"], c["ep"], c["el"])
    if j == 0:
        return c["el"]
    if j == NT - 1:
        return c["crest"]
    if 14 <= i <= 17 and 1 <= j <= 2:
        return c["el"]                                    # small notch at the foot
    if 5 <= i <= 26 and 3 <= j <= 11:
        border = i in (5, 26) or j in (3, 11)
        if border:
            return edge
        if deco == "screen" and 8 <= i <= 23 and 5 <= j <= 9:
            if j == 9 or i in (8, 23):
                return edge
            if j == 5:
                return "plate" if lit else inner
            ind = {10: "cyan", 13: "orange", 16: "magenta", 19: "cyan"}
            return ind.get(i, "dark") if j == 7 else "dark"
        if deco == "vent":
            return "dark" if (j % 2 == 0 and 8 <= i <= 23) else inner
        return inner
    return body


def _slope(m, side, mask, c, deco):
    xw, xe, yn, ys = rect(mask)
    for i in range(NU):
        for j in range(NT):
            col = _panel(c, side == "s", deco, i, j)
            if col is None:
                continue
            pts = []
            for (a, b) in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)):
                u, t = a / NU, b / NT
                if side == "s":                           # +y face, runs along x
                    x = lerp(-0.5 + u, lerp(xw, xe, u), t)
                    y = lerp(0.5, WT, t)
                else:                                     # +x face, runs along y
                    x = lerp(0.5, WT, t)
                    y = lerp(-0.5 + u, lerp(yn, ys, u), t)
                pts.append(core.G(x, y, H * t))
            m.poly(pts, col)


def _top(m, mask, c):
    xw, xe, yn, ys = rect(mask)
    for j in range(32):
        for i in range(32):
            cx, cy = (i + 0.5) / 32 - 0.5, (j + 0.5) / 32 - 0.5
            if not (xw < cx < xe and yn < cy < ys):
                continue
            if mask == 0:
                chan = abs(cx) < 3 / 32 and abs(cy) < 3 / 32
            else:
                chan = (abs(cx) < CH and abs(cy) < CH) or \
                       (abs(cx) < CH and ((mask & 1 and cy < 0) or (mask & 4 and cy > 0))) or \
                       (abs(cy) < CH and ((mask & 8 and cx < 0) or (mask & 2 and cx > 0)))
            col = c["chan"] if chan else c["top"]
            x0, y0 = i / 32 - 0.5, j / 32 - 0.5
            m.poly([core.G(x0, y0, H), core.G(x0 + 1 / 32, y0, H), core.G(x0 + 1 / 32, y0 + 1 / 32, H),
                    core.G(x0, y0 + 1 / 32, H)], col)


def block(mask, fam, deco=None, name=None):
    m = core.Mesh(name or f"wall_{fam}_{mask}", flat=True)
    c = PAL[fam]
    _top(m, mask, c)
    if not mask & 4:
        _slope(m, "s", mask, c, deco if mask == 10 else None)
    if not mask & 2:
        _slope(m, "e", mask, c, deco if mask == 5 else None)
    return [m.build()]


def hazard(side, bits):
    """Hazard stripe at the foot of a hull slope. side 's'/'e'; bits: 1 = back end connected (W for s, N for e),
    2 = front end connected (E for s, S for e). Same geometry as the slope of a straight/corner piece."""
    m = core.Mesh(f"haz_{side}_{bits}", flat=True)
    if side == "s":
        mask = (8 if bits & 1 else 0) | (2 if bits & 2 else 0)
    else:
        mask = (1 if bits & 1 else 0) | (4 if bits & 2 else 0)
    xw, xe, yn, ys = rect(mask)
    for i in range(NU):
        for j in range(3):
            col = "hazY" if (i // 2) % 2 == 0 else "hazK"
            pts = []
            for (a, b) in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)):
                u, t = a / NU, b / NT
                if side == "s":
                    x, y = lerp(-0.5 + u, lerp(xw, xe, u), t), lerp(0.5, WT, t)
                else:
                    x, y = lerp(0.5, WT, t), lerp(-0.5 + u, lerp(yn, ys, u), t)
                pts.append(core.G(x, y, H * t + 0.002))
            m.poly(pts, col)
    return [m.build()]


# ---- doors --------------------------------------------------------------------------------------------------

def door(axis="x", is_open=False):
    """Tall upright frame: two posts on berm stubs, lit header, sliding panel, hazard sill."""
    m = core.Mesh(f"door_{axis}", flat=True)

    def T(u, v, z):
        return core.G(u, v, z) if axis == "x" else core.G(v, u, z)

    def quad(a, b, c_, d, col):
        m.poly([T(*a), T(*b), T(*c_), T(*d)], col)

    def face_v(u0, u1, v, z0, z1, nu, nz, fn):            # +v face (visible), cells (i along u, j up)
        for j in range(nz):
            for i in range(nu):
                col = fn(i, j)
                if col:
                    ua, ub = lerp(u0, u1, i / nu), lerp(u0, u1, (i + 1) / nu)
                    za, zb = lerp(z0, z1, j / nz), lerp(z0, z1, (j + 1) / nz)
                    quad((ua, v, za), (ub, v, za), (ub, v, zb), (ua, v, zb), col)

    def face_u(u, v0, v1, z0, z1, nv, nz, fn):            # +u face (visible)
        for j in range(nz):
            for i in range(nv):
                col = fn(i, j)
                if col:
                    va, vb = lerp(v0, v1, i / nv), lerp(v0, v1, (i + 1) / nv)
                    za, zb = lerp(z0, z1, j / nz), lerp(z0, z1, (j + 1) / nz)
                    quad((u, va, za), (u, vb, za), (u, vb, zb), (u, va, zb), col)

    lit_v = axis == "x"                                   # +v face is the lit +y face only for axis x
    cv, cu = ("steel", "steelD") if lit_v else ("steelD", "steel")

    def top(u0, u1, v0, v1, z, col="steelL"):
        quad((u0, v0, z), (u1, v0, z), (u1, v1, z), (u0, v1, z), col)

    # berm stubs under the posts: the wall cross-section (bottom +-0.5, top +-WT) from the tile edge to the opening
    for ua, ub in ((-0.5, -DX), (DX, 0.5)):
        top(ua, ub, -WT, WT, H, "steelD")
        face_v(ua, ub, 0.5, 0, 0, 1, 1, lambda i, j: None)
        for j in range(NT):
            t0, t1 = j / NT, (j + 1) / NT
            col = "dark" if j == 0 else ("steelL" if j == NT - 1 else cv)
            quad((ua, lerp(0.5, WT, t0), H * t0), (ub, lerp(0.5, WT, t0), H * t0), (ub, lerp(0.5, WT, t1), H * t1),
                 (ua, lerp(0.5, WT, t1), H * t1), col)
    for j in range(NT):                                   # inner end of the left stub faces the opening
        t0, t1 = j / NT, (j + 1) / NT
        quad((-DX, -lerp(0.5, WT, t0), H * t0), (-DX, lerp(0.5, WT, t0), H * t0), (-DX, lerp(0.5, WT, t1), H * t1),
             (-DX, -lerp(0.5, WT, t1), H * t1), "steelD" if j else "dark")
    # posts
    pw = 0.17
    nz = int(round((DH - H) * 24))

    def post_fn(i, j, w):
        if j == 0:
            return "dark"
        if j == nz - 1:
            return "steelL"
        if i == 0:
            return "steelL"
        if i == w - 1:
            return "steelD"
        if w // 2 - 1 <= i <= w // 2 and 4 <= j <= nz - 5:
            return "dark"                                 # vertical slot
        if j in (5, nz - 6):
            return "steelD"
        return "steel" if lit_v else "steelD"
    for ua, ub in ((-0.5, -DX), (DX, 0.5)):
        top(ua, ub, -pw, pw, DH)
        w = int(round((ub - ua) * NU))
        face_v(ua, ub, pw, H, DH, w, nz, lambda i, j, w=w: post_fn(i, j, w))
    face_u(-DX, -pw, pw, H, DH, 10, nz, lambda i, j: "dark" if j == 0 else ("steelL" if j == nz - 1 else cu))
    # header with lit strip
    z0, z1 = 1.0, DH
    nh = int(round((z1 - z0) * 24))
    nw = int(round(2 * DX * NU))

    def head_fn(i, j):
        if j == nh - 1:
            return "steelL"
        if j == 0:
            return "dark"
        if 2 <= i <= nw - 3 and nh // 2 - 1 <= j <= nh // 2 + 1:
            return "flameY"
        return "steelD"
    top(-DX, DX, -pw, pw, DH)
    face_v(-DX, DX, pw, z0, z1, nw, nh, head_fn)
    # sliding panel
    zp0, zp1 = 0.04, z0
    npz = int(round((zp1 - zp0) * 24))
    ppw = 0.06

    def pan_fn(i, j):
        if j < 3:
            return "hazY" if ((i + j) // 2) % 2 == 0 else "hazK"
        if i in (nw // 2 - 1, nw // 2):
            return "dark"
        if j == npz - 1:
            return "steelL"
        if j in (npz // 2, npz // 2 + 1):
            return "steelD"
        return "steel" if lit_v else "steelD"
    if not is_open:
        top(-DX, DX, -ppw, ppw, zp1)
        face_v(-DX, DX, ppw, zp0, zp1, nw, npz, pan_fn)
    else:
        for ua, ub in ((-DX, -DX + 0.07), (DX - 0.07, DX)):
            top(ua, ub, -ppw, ppw, zp1)
            face_v(ua, ub, ppw, zp0, zp1, 2, npz, lambda i, j: "steelL" if j == npz - 1 else "steelD")
    # threshold: flat plate with hazard stripes between the stubs
    zs = 0.02
    for i in range(int(round(2 * DX * NU))):
        ua, ub = -DX + i / NU, -DX + (i + 1) / NU
        col = "hazY" if (i // 2) % 2 == 0 else "hazK"
        quad((ua, -0.17, zs), (ub, -0.17, zs), (ub, 0.17, zs), (ua, 0.17, zs), col if not is_open or True else "steelL")
    return [m.build()]


# ---- floors -------------------------------------------------------------------------------------------------

def floor(variant):
    m = core.Mesh(f"floor_{variant}")

    def seam(i, j):
        if i == 0 or j == 0:
            return "dark"
        if i == 1 or j == 1:
            return "steelL"
        return None

    def fn(i, j):
        s = seam(i, j)
        if s:
            return s
        if variant == "a":                        # 2x2 plates with corner bolts
            pi, pj = i % 16, j % 16
            if pi == 0 or pj == 0:
                return "dark"
            if pi == 1 or pj == 1:
                return "steelL"
            return "plate" if (pi, pj) in ((4, 4), (12, 4), (4, 12), (12, 12)) else "steel"
        if variant == "b":                        # checkered plates
            pi, pj = i % 16, j % 16
            if pi == 0 or pj == 0:
                return "dark"
            return "steelD" if (i // 16 + j // 16) % 2 else "steel"
        if variant == "c":                        # one plate, inset frame, corner bolts
            if i in (5, 26) and 5 <= j <= 26 or j in (5, 26) and 5 <= i <= 26:
                return "steelD"
            return "plate" if (i, j) in ((3, 3), (28, 3), (3, 28), (28, 28)) else "steel"
        if variant == "d":                        # grate: slits
            if 4 <= i <= 27 and 4 <= j <= 27:
                if j % 3 == 0:
                    return "dark"
                return "steelD" if j % 3 == 1 else "grime"
            return "steel"
        if variant == "e":                        # hatch with handle
            if 8 <= i <= 23 and 8 <= j <= 23:
                if i in (8, 23) or j in (8, 23):
                    return "dark"
                if 14 <= i <= 17 and 14 <= j <= 17:
                    return "steelL"
                return "steelD"
            return "plate" if (i, j) in ((4, 4), (27, 4), (4, 27), (27, 27)) else "steel"
        if variant == "f":                        # 4x4 small plates
            pi, pj = i % 8, j % 8
            if pi == 0 or pj == 0:
                return "steelD"
            return "steel"
        if variant == "g":                        # planks along y
            pi = i % 8
            if pi == 0:
                return "steelD"
            if pi == 1:
                return "steelL"
            return "plate" if pi == 4 and j % 16 == 8 else "steel"
        # h: plate with bolt rows along two edges and a light centre rail
        if j in (15, 16):
            return "steelL"
        if (j in (4, 27)) and i % 4 == 2 and 4 <= i <= 27:
            return "plate"
        return "steel"
    m.pattern((-0.5, -0.5, 0), (1, 0, 0), (0, 1, 0), 32, 32, fn)
    return [m.build()]


# ---- registry -----------------------------------------------------------------------------------------------

FLOORS = "abcdefgh"
SPRITES = []
for _v in FLOORS:
    SPRITES.append((f"tile.floor.{_v}", (1, 1), "floor", lambda v=_v: floor(v)))
for _fam in ("wall", "hull", "ghost"):
    _id = {"wall": "wall", "hull": "hull", "ghost": "hull.ghost"}[_fam]
    _kind = "ghost" if _fam == "ghost" else "block"
    for _m in range(16):
        SPRITES.append((f"tile.{_id}.m{_m}", (1, 1), _kind, lambda m=_m, f=_fam: block(m, f)))
    if _fam != "ghost":
        for _m, _decos in ((5, ("screen", "vent")), (10, ("screen", "vent"))):
            for _k, _d in enumerate(_decos, 1):
                SPRITES.append((f"tile.{_id}.m{_m}.v{_k}", (1, 1), "block",
                                lambda m=_m, f=_fam, d=_d: block(m, f, d)))
for _s in ("s", "e"):
    for _b in range(4):
        SPRITES.append((f"tile.hull.haz.{_s}.{_b}", (1, 1), "block", lambda s=_s, b=_b: hazard(s, b)))
for _ax in ("x", "y"):
    SPRITES += [
        (f"tile.door.{_ax}", (1, 1), "block", lambda a=_ax: door(a, False)),
        (f"tile.door.{_ax}.open", (1, 1), "block", lambda a=_ax: door(a, True)),
    ]
