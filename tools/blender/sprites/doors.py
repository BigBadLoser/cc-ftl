"""Door sprites: a tall upright frame on the wall line (grid frame, origin = tile centre at floor level).

Built only from closed solids (every box emits all six faces, the berm stubs are closed prisms) so no visible face can
be missing. Coplanar overlaps are avoided (posts start on the stub top, the panel stops just under the header).
axis 'x': the wall runs along x (u = gx, v = gy); axis 'y': u = gy, v = gx. The camera sees +u, +v and the tops."""
from . import core
from .walls import H, WT, NT, DH as DH_FULL, lerp, PAL

PW = 0.21          # post / lintel half-thickness (chunky bulkhead door)
PANEL_W = 0.08     # sliding panel half-thickness
DX = 0.34          # opening half-width (jambs are 0.16 wide)
Z_HEAD_FULL = 2.1  # lintel bottom, full-wall door (frame top is walls.DH)
DH_LOW, Z_HEAD_LOW = 1.35, 0.85    # cutaway door: short chunky frame a bit above the 0.38 low walls
Z_SILL = 0.02


def door(axis="x", is_open=False, low=False):
    """low: the short cutaway variant (tile.door.low.*); otherwise the full-height frame (tile.door.*)."""
    DH, Z_HEAD = (DH_LOW, Z_HEAD_LOW) if low else (DH_FULL, Z_HEAD_FULL)
    m = core.Mesh(f"door_{'low_' if low else ''}{axis}", flat=True)
    lit_v = axis == "x"                                    # +v face is the lit +y face only for axis x
    lit, shade = PAL["wall"]["sb"], PAL["wall"]["eb"]
    cv, cu = (lit, shade) if lit_v else (shade, lit)

    def T(u, v, z):
        return core.G(u, v, z) if axis == "x" else core.G(v, u, z)

    def quad(a, b, c, d, col):
        m.poly([T(*p) for p in (a, b, c, d)], col)

    def cells(o, du, dv, nu, nv, fn):
        for j in range(nv):
            for i in range(nu):
                col = fn(i, j)
                if col:
                    p = lambda a, b: tuple(o[k] + du[k] * a / nu + dv[k] * b / nv for k in range(3))  # noqa: E731
                    quad(p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), col)

    def face(o, du, dv, spec):
        if isinstance(spec, str):
            quad(o, tuple(o[k] + du[k] for k in range(3)), tuple(o[k] + du[k] + dv[k] for k in range(3)),
                 tuple(o[k] + dv[k] for k in range(3)), spec)
        elif spec:
            cells(o, du, dv, *spec)

    def solid(u0, u1, v0, v1, z0, z1, top, pv, pu, nv="dark", nu="dark", bot="dark"):
        """Closed box; each face is a colour or (n_across, n_up, fn)."""
        du, dv, dz = u1 - u0, v1 - v0, z1 - z0
        face((u0, v0, z1), (du, 0, 0), (0, dv, 0), top)
        face((u0, v1, z0), (du, 0, 0), (0, 0, dz), pv)
        face((u0, v0, z0), (du, 0, 0), (0, 0, dz), nv)
        face((u1, v0, z0), (0, dv, 0), (0, 0, dz), pu)
        face((u0, v0, z0), (0, dv, 0), (0, 0, dz), nu)
        if bot:
            face((u0, v0, z0), (du, 0, 0), (0, dv, 0), bot)

    # berm stubs under the posts: the wall cross-section (bottom +-0.5, top +-WT) from the tile edge to the opening
    for ua, ub in ((-0.5, -DX), (DX, 0.5)):
        n = round((ub - ua) * 32)

        def slope(i, j, lit_face=lit_v):
            if j == 0:
                return "dark"
            if j == NT - 1:
                return "steelL"
            return PAL["wall"]["sl"] if j == NT // 2 else (cv if lit_face else cv)
        quad((ua, -WT, H), (ub, -WT, H), (ub, WT, H), (ua, WT, H), PAL["wall"]["top"])
        for j in range(NT):                               # +v slope (cells along u)
            t0, t1 = j / NT, (j + 1) / NT
            for i in range(n):
                a, b = lerp(ua, ub, i / n), lerp(ua, ub, (i + 1) / n)
                quad((a, lerp(0.5, WT, t0), H * t0), (b, lerp(0.5, WT, t0), H * t0),
                     (b, lerp(0.5, WT, t1), H * t1), (a, lerp(0.5, WT, t1), H * t1), slope(i, j))
            quad((ua, -lerp(0.5, WT, t0), H * t0), (ub, -lerp(0.5, WT, t0), H * t0),
                 (ub, -lerp(0.5, WT, t1), H * t1), (ua, -lerp(0.5, WT, t1), H * t1), "dark")
        for u, col in ((ua, "dark"), (ub, cu)):           # end caps (trapezoids)
            quad((u, -0.5, 0), (u, 0.5, 0), (u, WT, H), (u, -WT, H), col)

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
            return "dark"
        return cv if j != nz // 2 else "steelD"
    plain_u = (4, nz, lambda i, j: "dark" if j == 0 else ("steelL" if j == nz - 1 else cu))
    for ua, ub in ((-0.5, -DX), (DX, 0.5)):
        w = round((ub - ua) * 32)
        solid(ua, ub, -PW, PW, H, DH, "steelL", (w, nz, lambda i, j, w=w: post_fn(i, j, w)), plain_u, bot=None)
    # heavy lintel block across the whole tile with a lit strip
    nh = int(round((DH - Z_HEAD) * 24))
    nw = round(2 * DX * 32)
    nl = 32

    def head_fn(i, j):
        if j == nh - 1:
            return "steelL"
        if j == 0:
            return "dark"
        if 3 <= i <= nl - 4 and nh // 2 - 1 <= j <= nh // 2 + 1:
            return "flameY"
        if (j in (2, nh - 3)) and i % 4 < 2:
            return "hazY" if (i // 4) % 2 == 0 else "hazK"
        return "steelD"
    solid(-0.5, 0.5, -PW - 0.02, PW + 0.02, Z_HEAD, DH, "steelL", (nl, nh, head_fn), cu)
    # sliding panel half-thickness
DX = 0.34          # opening half-width (jambs are 0.16 wide)
Z_HEAD_FULL = 2.1  # lintel bottom, full-wall door (frame top is walls.DH)
DH_LOW, Z_HEAD_LOW = 1.35, 0.85    # cutaway door: short chunky frame a bit above the 0.38 low walls
Z_SILL = 0.02


def door(axis="x", is_open=False, low=False):
    """low: the short cutaway variant (tile.door.low.*); otherwise the full-height frame (tile.door.*)."""
    DH, Z_HEAD = (DH_LOW, Z_HEAD_LOW) if low else (DH_FULL, Z_HEAD_FULL)
    m = core.Mesh(f"door_{'low_' if low else ''}{axis}", flat=True)
    lit_v = axis == "x"                                    # +v face is the lit +y face only for axis x
    lit, shade = PAL["wall"]["sb"], PAL["wall"]["eb"]
    cv, cu = (lit, shade) if lit_v else (shade, lit)

    def T(u, v, z):
        return core.G(u, v, z) if axis == "x" else core.G(v, u, z)

    def quad(a, b, c, d, col):
        m.poly([T(*p) for p in (a, b, c, d)], col)

    def cells(o, du, dv, nu, nv, fn):
        for j in range(nv):
            for i in range(nu):
                col = fn(i, j)
                if col:
                    p = lambda a, b: tuple(o[k] + du[k] * a / nu + dv[k] * b / nv for k in range(3))  # noqa: E731
                    quad(p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), col)

    def face(o, du, dv, spec):
        if isinstance(spec, str):
            quad(o, tuple(o[k] + du[k] for k in range(3)), tuple(o[k] + du[k] + dv[k] for k in range(3)),
                 tuple(o[k] + dv[k] for k in range(3)), spec)
        elif spec:
            cells(o, du, dv, *spec)

    def solid(u0, u1, v0, v1, z0, z1, top, pv, pu, nv="dark", nu="dark", bot="dark"):
        """Closed box; each face is a colour or (n_across, n_up, fn)."""
        du, dv, dz = u1 - u0, v1 - v0, z1 - z0
        face((u0, v0, z1), (du, 0, 0), (0, dv, 0), top)
        face((u0, v1, z0), (du, 0, 0), (0, 0, dz), pv)
        face((u0, v0, z0), (du, 0, 0), (0, 0, dz), nv)
        face((u1, v0, z0), (0, dv, 0), (0, 0, dz), pu)
        face((u0, v0, z0), (0, dv, 0), (0, 0, dz), nu)
        if bot:
            face((u0, v0, z0), (du, 0, 0), (0, dv, 0), bot)

    # berm stubs under the posts: the wall cross-section (bottom +-0.5, top +-WT) from the tile edge to the opening
    for ua, ub in ((-0.5, -DX), (DX, 0.5)):
        n = round((ub - ua) * 32)

        def slope(i, j, lit_face=lit_v):
            if j == 0:
                return "dark"
            if j == NT - 1:
                return "steelL"
            return PAL["wall"]["sl"] if j == NT // 2 else (cv if lit_face else cv)
        quad((ua, -WT, H), (ub, -WT, H), (ub, WT, H), (ua, WT, H), PAL["wall"]["top"])
        for j in range(NT):                               # +v slope (cells along u)
            t0, t1 = j / NT, (j + 1) / NT
            for i in range(n):
                a, b = lerp(ua, ub, i / n), lerp(ua, ub, (i + 1) / n)
                quad((a, lerp(0.5, WT, t0), H * t0), (b, lerp(0.5, WT, t0), H * t0),
                     (b, lerp(0.5, WT, t1), H * t1), (a, lerp(0.5, WT, t1), H * t1), slope(i, j))
            quad((ua, -lerp(0.5, WT, t0), H * t0), (ub, -lerp(0.5, WT, t0), H * t0),
                 (ub, -lerp(0.5, WT, t1), H * t1), (ua, -lerp(0.5, WT, t1), H * t1), "dark")
        for u, col in ((ua, "dark"), (ub, cu)):           # end caps (trapezoids)
            quad((u, -0.5, 0), (u, 0.5, 0), (u, WT, H), (u, -WT, H), col)

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
            return "dark"
        return cv if j != nz // 2 else "steelD"
    plain_u = (4, nz, lambda i, j: "dark" if j == 0 else ("steelL" if j == nz - 1 else cu))
    for ua, ub in ((-0.5, -DX), (DX, 0.5)):
        w = round((ub - ua) * 32)
        solid(ua, ub, -PW, PW, H, DH, "steelL", (w, nz, lambda i, j, w=w: post_fn(i, j, w)), plain_u, bot=None)
    # header with lit strip
    nh = int(round((DH - Z_HEAD) * 24))
    nw = round(2 * DX * 32)

    def head_fn(i, j):
        if j == nh - 1:
            return "steelL"
        if j == 0:
            return "dark"
        if 2 <= i <= nw - 3 and nh // 2 - 1 <= j <= nh // 2 + 1:
            return "flameY"
        return "steelD"
    solid(-DX, DX, -PW, PW, Z_HEAD, DH, "steelL", (nw, nh, head_fn), cu)
    # sliding panel (closed) or retracted slivers (open), stopping just under the header
    zp0, zp1 = 0.04, Z_HEAD - 0.005
    npz = int(round((zp1 - zp0) * 24))

    def pan_fn(i, j):
        if j < 3:
            return "hazY" if ((i + j) // 2) % 2 == 0 else "hazK"
        if i in (nw // 2 - 1, nw // 2):
            return "dark"
        if j == npz - 1:
            return "steelL"
        return "steelD" if j in (npz // 2, npz // 2 + 1) else cv
    if not is_open:
        solid(-DX, DX, -PANEL_W, PANEL_W, zp0, zp1, "steelL", (nw, npz, pan_fn), cu)
    else:
        for ua, ub in ((-DX, -DX + 0.07), (DX - 0.07, DX)):
            solid(ua, ub, -PANEL_W, PANEL_W, zp0, zp1, "steelL",
                  (2, npz, lambda i, j: "steelL" if j == npz - 1 else "steelD"), "steelD")
    # threshold plate with hazard stripes
    solid(-DX, DX, -PW, PW, 0.0, Z_SILL, (nw, 11, lambda i, j: "hazY" if (i // 2) % 2 == 0 else "hazK"), "steelD", "steelD")
    return [m.build()]
