"""Door sprites: a deep recessed portal cut into the wall wedge (grid frame, origin = tile centre at floor level).

The door is the wall profile itself (walls.cells, mask 10 for a door along x, 5 along y) in a strong door colour: the
jambs and the heavy lintel are the sloped wall faces with seams and trim, the yellow indicator sits on the lintel, and
the opening is a tunnel through the slope with the grey door leaf standing in a vertical plane level with the slope at
the lintel's underside, so it is recessed deepest at the floor (the reveal shows the depth). Hazard strips on the leaf
foot and on the threshold. `low` is the short cutaway variant (a 1.3 high wedge among the 0.38 low walls)."""
from . import core
from .walls import HF, GN, R, T, _grad, cells

DX = 0.28                        # opening half-width (jambs 0.22 wide)
OPEN_FULL, TOP_FULL = 2.0, HF    # opening height / frame top, full variant
OPEN_LOW, TOP_LOW = 0.95, 1.3    # cutaway variant


def door(axis="x", is_open=False, low=False):
    zo, top = (OPEN_LOW, TOP_LOW) if low else (OPEN_FULL, TOP_FULL)
    m = core.Mesh(f"door_{'low_' if low else ''}{axis}", flat=True)
    mask = 10 if axis == "x" else 5
    lit = axis == "x"                                      # the slope faces +y (lit) for x doors, +x (shade) for y doors
    body, hi, lo = ("drM", "drL", "drD") if lit else ("drD", "drM", "drK")
    ys = 0.5 - R * zo / top                                # slope position at the lintel underside = leaf plane

    def G(a, b, z):                                        # a: along the wall, b: across (toward +camera)
        return core.G(a, b, z) if axis == "x" else core.G(b, a, z)

    for kind, i, j, pts in cells(mask, top):
        along = [p[0] if axis == "x" else p[1] for p in pts]
        zs = [p[2] for p in pts]
        um, zm = sum(along) / len(along), sum(zs) / len(zs)
        if kind == "flat":
            if zs[0] > top - 1e-9:
                m.poly([core.G(*p) for p in pts], hi)
            continue
        if abs(um) < DX and max(zs) <= zo + 1e-6:
            continue                                       # the tunnel
        gx, gy = _grad(pts)
        f = zm / top
        edge = abs(abs(um) - DX) < 1.6 / GN and zm <= zo + 0.02
        col = body
        if abs(um) > 0.5 - 1.0 / GN or edge or (abs(um) < DX and zm < zo + 0.05):
            col = lo                                       # tile seam, opening trim, lintel underside
        elif f > 0.95:
            col = hi
        elif any(abs(zm - g) < 0.03 for g in ((0.7, 1.4) if not low else (0.5,))):
            col = lo                                       # panel grooves
        elif abs(um) < DX - 0.07 and zo + (top - zo) * 0.3 < zm < zo + (top - zo) * 0.65:
            col = "flameY"                                 # yellow indicator on the lintel
        m.poly([core.G(*p) for p in pts], col)

    # reveal: the inner side of the near jamb, a triangle from the floor up to the lintel (lit face of the x door)
    a = -DX
    m.poly([G(a, ys, 0.0), G(a, 0.5, 0.0), G(a, ys, zo)], "drD" if lit else "drM")
    # door leaf in the recess
    nu, nz = 16, max(4, int(round(zo * 12)))
    for jj in range(nz):
        for ii in range(nu):
            u0, u1 = -DX + 2 * DX * ii / nu, -DX + 2 * DX * (ii + 1) / nu
            z0, z1 = zo * jj / nz, zo * (jj + 1) / nz
            if is_open:
                col = "drK"
            elif jj < 2:
                col = "hazY" if (ii + jj) % 2 == 0 else "hazK"
            elif ii in (nu // 2 - 1, nu // 2) or jj == nz - 1:
                col = "steelD"
            else:
                col = "steelL" if lit else "steel"
            m.poly([G(u0, ys, z0), G(u1, ys, z0), G(u1, ys, z1), G(u0, ys, z1)], col)
    if is_open:                                            # retracted leaf slivers in the jambs
        for ua, ub in ((-DX, -DX + 0.07), (DX - 0.07, DX)):
            m.poly([G(ua, ys + 0.01, 0.0), G(ub, ys + 0.01, 0.0), G(ub, ys + 0.01, zo), G(ua, ys + 0.01, zo)], "steelL")
    # threshold plate with hazard stripes in front of the opening
    for ii in range(2 * int(DX * GN)):
        u0, u1 = -DX + ii / GN, -DX + (ii + 1) / GN
        m.poly([G(u0, ys, 0.015), G(u1, ys, 0.015), G(u1, 0.5, 0.015), G(u0, 0.5, 0.015)],
               "hazY" if (ii // 2) % 2 == 0 else "hazK")
    return [m.build()]
