"""Door sprites: a framed portal set INTO the vertical wall face (grid frame, origin = tile centre at floor level).

The interior wall piece (walls.Strip, mask 10 for a door along x, 5 along y) with its skirt left out across the door
span and its face starting above the frame (the lintel). In the span stands a dusty-rose frame that stands proud of the
wall face: thick jambs and header with 45 degree upper corners, a lit rim on the screen-left and top edges, grooves; the
leaf is recessed (the reveal shows the depth) with a window, a red status light, a dashed band and a lower panel; a
hazard-striped threshold lies on the floor in front. The full door is clearly shorter than the wall. The open door has
no leaf: the doorway is a real hole that shows the floor and room behind. The cutaway door is the same frame cut at ZL
with near-black cut tops, like the walls."""
from . import core
from . import wallart as A
from .walls import GN, TW, ZS, Strip, emit

DXF = 0.50                  # frame half-width
DXO = 0.31                  # opening half-width
ZO, ZF = 1.84, 2.16         # opening height, frame top (the wall is HF = 2.4)
CHF = 0.18                  # upper corner chamfer
PF = 3 / 32                 # frame stands this far proud of the wall face
ZL = 1.0                    # cutaway cut height
C = 1 / GN
VB = -0.5                   # frame back
VW = -0.5 + TW              # wall face plane
VF = VW + PF                # frame front
VL = -0.5 + TW / 2          # leaf plane


class DoorWall(Strip):
    def __init__(self, axis, low):
        super().__init__(10 if axis == "x" else 5, "wall", not low)
        self.axis, self.low = axis, low

    def _u(self, x, y):
        return x if self.axis == "x" else y

    def cover(self, i, j):
        cv = super().cover(i, j)
        if cv and self.low and abs(self._u((i + 0.5) / GN - 0.5, (j + 0.5) / GN - 0.5)) < DXF:
            return None
        return cv

    def skip_skirt(self, i, j):
        return abs(self._u((i + 0.5) / GN - 0.5, (j + 0.5) / GN - 0.5)) < DXF

    def face_lo(self, x, y):
        u = abs(self._u(x, y))
        if self.low or u > DXF + 1e-9:
            return None
        return ZF - max(0.0, u - (DXF - CHF))


def door(axis="x", is_open=False, low=False):
    m = core.Mesh(f"door_{'low_' if low else ''}{axis}{'_open' if is_open else ''}", flat=True)
    sp = DoorWall(axis, low)
    emit(m, sp)
    zs = ZS[not low]
    face = "y" if axis == "x" else "x"           # the wall face the door sits in
    side = "x" if axis == "x" else "y"           # orientation of the +u side faces
    R, Rs = A.ramp("rose", face), A.ramp("rose", side)
    left = -1 if axis == "x" else 1              # sign of u at the screen-left jamb
    top = ZL if low else ZF
    cut = "wK"

    def G(u, v, z):
        return core.G(u, v, z) if axis == "x" else core.G(v, u, z)

    def quad(pts, col):
        m.poly([G(*p) for p in pts], col)

    def outline(u, z):
        """Frame silhouette in the (u, z) plane."""
        if abs(u) > DXF or z > top:
            return False
        return low or z <= ZF - CHF or abs(u) - (DXF - CHF) <= ZF - z

    nu, nz = int(round(2 * DXF * GN)), int(round(top * 20))
    du, dz = 2 * DXF / nu, top / nz
    for jj in range(nz):
        for ii in range(nu):
            u0, z0 = -DXF + ii * du, jj * dz
            um, zm = u0 + du / 2, z0 + dz / 2
            if not outline(um, zm):
                continue
            if abs(um) < DXO and zm < ZO:
                continue                                        # the doorway
            lu = um * left                                      # > 0 toward the screen-left
            rim_side = abs(um) > DXF - C * 1.2
            rim_top = not low and (zm > ZF - 0.04 or (abs(um) - (DXF - CHF)) > ZF - zm - 0.06)
            if rim_side:
                col = R["H"] if lu > 0 else R["D"]
            elif rim_top:
                col = R["H"] if (lu > 0 or abs(um) < DXF - CHF) else R["M"]
            elif abs(um) > DXF - C * 2.2 or (not low and zm > ZF - 0.08):
                col = R["M"]                                    # groove inside the rim
            elif abs(abs(um) - DXO) < C * 1.1 or (abs(um) < DXO + C and ZO <= zm < ZO + 0.03):
                col = R["K"]                                    # trim round the doorway
            elif abs(abs(um) - (DXO + DXF) / 2) < C * 0.6 and 0.12 < zm < ZO - 0.12:
                col = R["D"]                                    # jamb groove
            elif low and zm > top - 0.04:
                col = R["H"]                                    # lit lip under the cut
            else:
                col = R["L"]
            quad([(u0, VF, z0), (u0 + du, VF, z0), (u0 + du, VF, z0 + dz), (u0, VF, z0 + dz)], col)

    # top / cut surfaces, chamfers and the +u end of the frame
    vt = VB if low else VW
    if low:
        for a, b in ((-DXF, -DXO), (DXO, DXF)):
            quad([(a, vt, top), (b, vt, top), (b, VF, top), (a, VF, top)], cut)
    else:
        quad([(-DXF + CHF, vt, ZF), (DXF - CHF, vt, ZF), (DXF - CHF, VF, ZF), (-DXF + CHF, VF, ZF)], R["H"])
        for sg in (-1, 1):
            p0, p1 = (sg * (DXF - CHF), ZF), (sg * DXF, ZF - CHF)
            col = R["H"] if sg == left else R["M"]
            quad([(p0[0], vt, p0[1]), (p1[0], vt, p1[1]), (p1[0], VF, p1[1]), (p0[0], VF, p0[1])], col)
    zt = top if low else ZF - CHF
    quad([(DXF, VB, 0), (DXF, VF, 0), (DXF, VF, zt), (DXF, VB, zt)], Rs["D"])
    W = A.ramp("wall", side)
    m.poly([G(-DXF, VW, 0), G(-DXF, 0.5, 0), G(-DXF, VW, zs)], W["D"])     # the skirt's cut edge
    # reveal (the jamb's inner side at u = -DXO faces +u)
    vr = VB if is_open else VL
    zr = min(ZO, top)
    quad([(-DXO, vr, 0), (-DXO, VF, 0), (-DXO, VF, zr), (-DXO, vr, zr)], Rs["D"])
    quad([(-DXO, vr, zr - 0.04), (-DXO, VF, zr - 0.04), (-DXO, VF, zr), (-DXO, vr, zr)], Rs["K"])

    if not is_open:
        _leaf(m, G, R, top, low, cut)
    # sill through the doorway and the hazard threshold on the floor in front
    v0 = VB if is_open else VL
    quad([(-DXO, v0, 0.012), (DXO, v0, 0.012), (DXO, VF, 0.012), (-DXO, VF, 0.012)], "steelD")
    n = int(round(2 * DXF * GN))
    for k in range(n):
        u0, u1 = -DXF + k * C, -DXF + (k + 1) * C
        for r in range(7):
            v1, v2 = VF + r * C, VF + (r + 1) * C
            if abs(u0 + C / 2) > DXO:
                col = "steel" if r < 6 else "steelD"
            else:
                col = "hazY" if ((k + r) // 3) % 2 == 0 else "hazK"
            quad([(u0, v1, 0.012), (u1, v1, 0.012), (u1, v2, 0.012), (u0, v2, 0.012)], col)
    return [m.build()]


def _leaf(m, G, R, top, low, cut):
    """Closed leaf in the recess: window, red light, dashed band, lower panel."""
    zt = min(ZO, top)
    nu, nz = int(round(2 * DXO * GN)), int(round(zt * 20))
    du, dz = 2 * DXO / nu, zt / nz
    for jj in range(nz):
        for ii in range(nu):
            u0, z0 = -DXO + ii * du, jj * dz
            um, zm = u0 + du / 2, z0 + dz / 2
            p = abs(um)
            col = R["M"]
            if zm < 0.05 or p > DXO - C:
                col = R["K"]
            elif low and zm > zt - 0.04:
                col = R["H"]
            elif ZO * 0.6 <= zm < ZO * 0.9 and p < DXO - 0.07:
                if p > DXO - 0.07 - C or zm < ZO * 0.6 + 0.03 or zm > ZO * 0.9 - 0.03:
                    col = R["D"]
                else:
                    glint = abs((um + DXO) * 2 - (zm - ZO * 0.6) * 1.2 - 0.18) < 0.035
                    col = "glassL" if glint else "glassD"
            elif ZO * 0.49 <= zm < ZO * 0.555 and p < 0.095:
                col = "red"
            elif ZO * 0.42 <= zm < ZO * 0.45:
                col = "steelL" if int((um + DXO) * GN) % 4 < 2 else "blueGrey"
            elif 0.14 <= zm < ZO * 0.36 and p < DXO - 0.06:
                if p > DXO - 0.06 - C or zm >= ZO * 0.36 - 0.03:
                    col = R["D"]
                elif zm < 0.17:
                    col = R["H"]
                elif 0.3 <= zm < 0.34 and p < 0.12:
                    col = R["K"]
                else:
                    col = R["M"]
            elif p < C and zm > 0.05:
                col = R["D"]
            m.poly([G(u0, VL, z0), G(u0 + du, VL, z0), G(u0 + du, VL, z0 + dz), G(u0, VL, z0 + dz)], col)
    if low:
        m.poly([G(-DXO, VL - 2 * C, zt), G(DXO, VL - 2 * C, zt), G(DXO, VL, zt), G(-DXO, VL, zt)], cut)
