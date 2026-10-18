"""Door sprites: a framed portal set INTO the vertical wall face (grid frame, origin = tile centre at floor level).

The wall piece itself (walls.emit, mask 10 for a door along x, 5 along y) with the skirt and face left out across the door
span. In that gap stands a dusty-rose frame block with chamfered upper corners, a dark recessed doorway (reveals show the
depth) with a red light, a yellow light strip above it, and a hazard threshold. The full door is clearly shorter than the
wall; the cutaway door is a short frame that rises above the low stub (`tile.door.low.*`)."""
from . import core
from .walls import GN, emit, profile

DXF = 0.38                       # frame half-width (jambs 0.12 wide)
DXO = 0.26                       # opening half-width
CHF = 0.14                       # chamfer of the frame's upper corners
FULL = dict(zo=1.9, zf=2.15)     # opening height, frame top
LOW = dict(zo=0.78, zf=1.05)
DEP = 0.16                       # recess depth


def door(axis="x", is_open=False, low=False):
    zo, zf = (LOW if low else FULL)["zo"], (LOW if low else FULL)["zf"]
    m = core.Mesh(f"door_{'low_' if low else ''}{axis}", flat=True)
    mask = 10 if axis == "x" else 5
    lit = axis == "x"
    L, M, D, K = "drL", "drM", "drD", "drK"
    body, hi, lo = (M, L, D) if lit else (D, M, K)
    tw, top, zs = profile("wall", not low)
    yf = -0.5 + tw                                         # wall face plane

    def G(a, b, z):                                        # a along the wall, b across (toward the camera)
        return core.G(a, b, z) if axis == "x" else core.G(b, a, z)

    emit(m, mask, "wall", 0, not low, skip=(axis, DXF, zf))

    # the skirt's cut edge against the near jamb (+u face), a triangle on the floor
    m.poly([G(-DXF, 0.5, 0.0), G(-DXF, yf, 0.0), G(-DXF, yf, zs)], lo)
    # frame block: front face with chamfered upper corners, top and the chamfer
    nu, nz = 24, max(6, int(round(zf * 14)))
    yp = yf + 0.02
    for jj in range(nz):
        for ii in range(nu):
            u0, u1 = -DXF + 2 * DXF * ii / nu, -DXF + 2 * DXF * (ii + 1) / nu
            z0, z1 = zf * jj / nz, zf * (jj + 1) / nz
            um, zm = (u0 + u1) / 2, (z0 + z1) / 2
            if zm > zf - CHF and (abs(um) - (DXF - CHF)) + (zm - (zf - CHF)) > CHF:
                continue                                    # chamfered corner
            if abs(um) < DXO and zm < zo:
                continue                                    # the doorway
            if abs(um) > DXF - 0.04 or zm > zf - 0.04:
                col = hi                                    # bevel: lit outer edge
            elif abs(um) > DXF - 0.085 or zm > zf - 0.085:
                col = lo                                    # bevel: groove inside it
            elif abs(um) < DXO - 0.04 and zo + 0.35 * (zf - zo) < zm < zo + 0.7 * (zf - zo):
                col = "flameY"                              # yellow light strip above the doorway
            elif abs(abs(um) - DXO) < 0.04 and zm < zo + 0.04:
                col = lo                                    # doorway trim
            else:
                col = body
            m.poly([G(u0, yp, z0), G(u1, yp, z0), G(u1, yp, z1), G(u0, yp, z1)], col)
    m.poly([G(-DXF + CHF, yp, zf), G(DXF - CHF, yp, zf), G(DXF - CHF, yp - tw, zf), G(-DXF + CHF, yp - tw, zf)], hi)
    m.poly([G(DXF - CHF, yp, zf), G(DXF, yp, zf - CHF), G(DXF, yp - tw, zf - CHF), G(DXF - CHF, yp - tw, zf)], hi)
    if low:                                                # the frame's end above the short stub
        m.poly([G(DXF, yp, top), G(DXF, yp - tw, top), G(DXF, yp - tw, zf - CHF), G(DXF, yp, zf - CHF)], lo)
    # doorway: reveal (near jamb side), dark recess with red light, hazard threshold
    yr = yp - DEP
    m.poly([G(-DXO, yp, 0.0), G(-DXO, yr, 0.0), G(-DXO, yr, zo), G(-DXO, yp, zo)], lo)
    nuo, nzo = 12, max(4, int(round(zo * 10)))
    for jj in range(nzo):
        for ii in range(nuo):
            u0, u1 = -DXO + 2 * DXO * ii / nuo, -DXO + 2 * DXO * (ii + 1) / nuo
            z0, z1 = zo * jj / nzo, zo * (jj + 1) / nzo
            mid = ii in (nuo // 2 - 1, nuo // 2)
            low_p = 2 <= jj <= int(nzo * 0.45)
            up_p = int(nzo * 0.6) <= jj <= nzo - 2
            if is_open:
                col = K
            elif jj < 2:
                col = "hazY" if (ii + jj) % 2 == 0 else "hazK"
            elif mid and jj in (int(nzo * 0.5), int(nzo * 0.5) + 1):
                col = "red"                                 # door light
            elif mid or jj == nzo - 1:
                col = "dark"                                # centre seam / head
            elif (low_p and (jj in (2, int(nzo * 0.45)) or ii in (1, nuo - 2) or ii in (nuo // 2 - 2, nuo // 2 + 1))) or \
                 (up_p and (jj in (int(nzo * 0.6), nzo - 2) or ii in (1, nuo - 2) or ii in (nuo // 2 - 2, nuo // 2 + 1))):
                col = "steelL" if (jj >= int(nzo * 0.5) or ii < nuo // 2) else "steelD"   # inset panel edges
            else:
                col = "steel"
            m.poly([G(u0, yr, z0), G(u1, yr, z0), G(u1, yr, z1), G(u0, yr, z1)], col)
    for ii in range(2 * int(DXO * GN)):                     # threshold plate in front of the doorway
        u0, u1 = -DXO + ii / GN, -DXO + (ii + 1) / GN
        m.poly([G(u0, yr, 0.015), G(u1, yr, 0.015), G(u1, 0.5, 0.015), G(u0, 0.5, 0.015)],
               "hazY" if (ii // 2) % 2 == 0 else "hazK")
    return [m.build()]
