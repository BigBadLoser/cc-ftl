"""Door sprites: a framed portal set INTO the vertical wall face (grid frame, origin = tile centre at floor level).

The interior wall piece (walls.Strip, mask 10 for a door along x, 5 along y) with its skirt cut out across the opening
and its face starting above the frame (a thin lintel). The dusty-rose frame sits within the wall thickness, flush with its face: wide jambs and
a header with rounded upper corners (Space Haven's door is an arch that rises nearly to the wall top), a lit rim on the
screen-left and top edges and grooves; a lamp strip sits on the header. Under the jambs the skirt is the frame's flared
rose foot. The leaf is recessed (the reveal shows the depth) in a round-topped opening, with a window, a red status
light, a dashed band and a lower panel; a hazard-striped threshold lies on the floor in front. The open door has no
leaf: the doorway is a real hole that shows the floor and room behind. Doors are never cut: the same full door is drawn
in every view level."""
import math

from . import core
from . import wallart as A
from . import walls
from .walls import GN, TW, Strip, emit, foot, skirt_run, skirt_top, wall_back

DXF = 0.50                  # frame half-width
DXO = 0.27                  # opening half-width (Space Haven: about 0.55 of the frame)
RF = 0.26                   # frame top corner radius
RO = 0.12                   # opening top corner radius
PF = 0.0                    # the frame sits within the wall's thickness, flush with its face (as in Space Haven)
C = 1 / GN


def planes():
    """(frame back, wall face, frame front, leaf plane) along the wall's depth axis; the partition is set back."""
    vb = -0.5 + wall_back()
    vw = vb + TW
    return vb, vw, vw + PF, vb + TW / 2


def door_heights():
    """(opening height, frame top). Space Haven: the frame rises to about the wall top (a thin header and lamp strip
    above), the opening is about 0.2 lower. Here the frame stops 0.07 under the wall top; the opening is at least 1.55
    (crew are 1.5)."""
    zf = walls.HF - 0.07
    return max(1.55, zf - 0.18), zf


def frame_top(u, zf):
    """Height of the full frame's top edge at u (rounded upper corners)."""
    a = abs(u) - (DXF - RF)
    if a <= 0:
        return zf
    return zf - RF + math.sqrt(max(0.0, RF * RF - a * a))


def open_top(u, zo):
    a = abs(u) - (DXO - RO)
    if a <= 0:
        return zo
    return zo - RO + math.sqrt(max(0.0, RO * RO - a * a))


class DoorWall(Strip):
    def __init__(self, axis):
        super().__init__(10 if axis == "x" else 5, "wall", "up")
        self.axis = axis
        self.zf = door_heights()[1]
        self.open_x, self.open_y = axis == "x", axis == "y"   # the lintel's +u end (seen when the next wall is cut)

    def _u(self, x, y):
        return x if self.axis == "x" else y

    def skip_skirt(self, i, j):
        return abs(self._u((i + 0.5) / GN - 0.5, (j + 0.5) / GN - 0.5)) < DXO

    def col_skirt(self, i, j, kind, x, y):
        """Under the jambs the skirt is the frame's flared rose foot."""
        if abs(self._u(x, y)) >= DXF:
            return super().col_skirt(i, j, kind, x, y)
        d, r = self._dist(x, y)
        run = self.run
        R = A.ramp("rose", "x" if kind == "x" else "y")
        if d < C or abs(abs(self._u(x, y)) - DXO) < C:
            return R["H"]
        if run - d < C:
            return R["K"]
        if run * 0.55 <= d < run * 0.55 + C:
            return R["D"]                                   # groove across the foot
        return R["L"] if d < 2 * C else R["M"]

    def col_face(self, face, x, y, z):
        if z < self.foot - 1e-6 and abs(self._u(x, y)) < DXF:     # under the jambs the foot is the frame's, rose
            return A.ramp("rose", "x" if face == "x" else "y")["M"]
        return super().col_face(face, x, y, z)

    def face_lo(self, x, y):
        u = abs(self._u(x, y))
        if u > DXF + 1e-9:
            return None
        return frame_top(u, self.zf)


def door(axis="x", is_open=False):
    m = core.Mesh(f"door_{axis}{'_open' if is_open else ''}", flat=True)
    sp = DoorWall(axis)
    zo, zf = door_heights()
    VB, VW, VF, VL = planes()
    emit(m, sp)
    zs = skirt_top()
    face = "y" if axis == "x" else "x"           # the wall face the door sits in
    side = "x" if axis == "x" else "y"           # orientation of the +u side faces
    R, Rs = A.ramp("rose", face), A.ramp("rose", side)
    left = -1 if axis == "x" else 1              # sign of u at the screen-left jamb
    top = zf

    def G(u, v, z):
        return core.G(u, v, z) if axis == "x" else core.G(v, u, z)

    def quad(pts, col):
        m.poly([G(*p) for p in pts], col)

    def outline(u, z):
        """Frame silhouette in the (u, z) plane."""
        if abs(u) > DXF or z > top:
            return False
        return z <= frame_top(u, zf)

    def opening(u, z):
        return abs(u) < DXO and z < min(open_top(u, zo), top)

    nu, nz = int(round(2 * DXF * GN)), int(round(top * 20))
    du, dz = 2 * DXF / nu, top / nz
    for jj in range(nz):
        for ii in range(nu):
            u0, z0 = -DXF + ii * du, jj * dz
            um, zm = u0 + du / 2, z0 + dz / 2
            if not outline(um, zm):
                continue
            if opening(um, zm):
                continue                                        # the doorway
            lu = um * left                                      # > 0 toward the screen-left
            rim_side = abs(um) > DXF - C * 1.2
            rim_top = zm > frame_top(um, zf) - 0.045
            if rim_side and not (rim_top and abs(um) > DXF - RF):
                col = R["H"] if lu > 0 else R["D"]
            elif rim_top:
                col = R["H"] if (lu > 0 or abs(um) < DXF - RF) else R["M"]
            elif abs(um) > DXF - C * 2.2 or zm > frame_top(um, zf) - 0.09:
                col = R["M"]                                    # groove inside the rim
            elif opening(um - C * 1.1, zm) or opening(um + C * 1.1, zm) or opening(um, zm - 0.035):
                col = R["K"]                                    # trim round the doorway
            elif abs(abs(um) - (DXO + DXF) / 2) < C * 0.6 and 0.12 < zm < zo - 0.12:
                col = R["D"]                                    # jamb groove
            else:
                col = R["L"]
            quad([(u0, VF, z0), (u0 + du, VF, z0), (u0 + du, VF, z0 + dz), (u0, VF, z0 + dz)], col)

    # the rounded head (stepped per column) and the +u end of the frame
    vt = VW
    for ii in range(nu):
        u0 = -DXF + ii * du
        zt0 = frame_top(u0 + du / 2, zf)
        col = R["H"] if (u0 + du / 2) * left > -(DXF - RF) else R["M"]
        quad([(u0, vt, zt0), (u0 + du, vt, zt0), (u0 + du, VF, zt0), (u0, VF, zt0)], col)
        if ii + 1 < nu:
            zt1 = frame_top(u0 + 1.5 * du, zf)
            if zt1 < zt0:                                       # step down toward +u: a face looking at +u
                quad([(u0 + du, vt, zt1), (u0 + du, VF, zt1), (u0 + du, VF, zt0), (u0 + du, vt, zt0)], Rs["L"])
    lw = 0.2                                                # lamp strip on the header
    zl = zf + 0.04
    quad([(-lw, VW, zl), (lw, VW, zl), (lw, VW + 2 * C, zl), (-lw, VW + 2 * C, zl)], "lampY")
    quad([(-lw, VW + 2 * C, zf), (lw, VW + 2 * C, zf), (lw, VW + 2 * C, zl), (-lw, VW + 2 * C, zl)], "lampY")
    zt = frame_top(DXF - 1e-6, zf)
    quad([(DXF, VB, 0), (DXF, VF - C, 0), (DXF, VF - C, zt), (DXF, VB, zt)], Rs["D"])   # +u side, wall-deep
    quad([(DXF, VF - C, 0), (DXF, VF, 0), (DXF, VF, zt), (DXF, VF - C, zt)], Rs["L"])
    m.poly([G(-DXO, VW, 0), G(-DXO, VW + skirt_run(), 0), G(-DXO, VW + skirt_run(), foot()), G(-DXO, VW, zs)],
           Rs["D"])                                                  # the foot's cut edge at the opening (its
                                                                     # upright foot at the toe)
    # reveal (the jamb's inner side at u = -DXO faces +u)
    vr = VB if is_open else VL
    zr = min(zo - RO, top)
    quad([(-DXO, vr, 0), (-DXO, VF, 0), (-DXO, VF, zr), (-DXO, vr, zr)], Rs["D"])
    quad([(-DXO, vr, zr - 0.04), (-DXO, VF, zr - 0.04), (-DXO, VF, zr), (-DXO, vr, zr)], Rs["K"])

    if not is_open:
        _leaf(m, G, R, top, zo, VL)
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


def _leaf(m, G, R, top, zo, VL):
    """Closed leaf in the recess: window, red light, dashed band, lower panel."""
    zt = min(zo, top)
    nu, nz = int(round(2 * DXO * GN)), int(round(zt * 20))
    du, dz = 2 * DXO / nu, zt / nz
    for jj in range(nz):
        for ii in range(nu):
            u0, z0 = -DXO + ii * du, jj * dz
            um, zm = u0 + du / 2, z0 + dz / 2
            if zm > open_top(um, zo):
                continue
            p = abs(um)
            col = R["M"]
            if zm < 0.05 or p > DXO - C or zm > open_top(um, zo) - 0.03:
                col = R["K"]
            elif zo * 0.6 <= zm < zo * 0.9 and p < DXO - 0.07:
                if p > DXO - 0.07 - C or zm < zo * 0.6 + 0.03 or zm > zo * 0.9 - 0.03:
                    col = R["D"]
                else:
                    glint = abs((um + DXO) * 2 - (zm - zo * 0.6) * 1.2 - 0.18) < 0.035
                    col = "glassL" if glint else "glassD"
            elif zo * 0.49 <= zm < zo * 0.555 and p < 0.095:
                col = "red"
            elif zo * 0.42 <= zm < zo * 0.45:
                col = "steelL" if int((um + DXO) * GN) % 4 < 2 else "blueGrey"
            elif 0.14 <= zm < zo * 0.36 and p < DXO - 0.06:
                if p > DXO - 0.06 - C or zm >= zo * 0.36 - 0.03:
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
