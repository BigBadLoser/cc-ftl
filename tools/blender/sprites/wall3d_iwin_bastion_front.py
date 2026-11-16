"""The bastion window's front (wall3d_iwin_bastion; ref 3295's lower layer): the user's reading of the ref: the two struts
stacked in our wall's recess (faction.bastion_designs.bastion_hood's pipes) laid along the front of the window, which
makes its armour-plated channel. A pocket cut into the near ramp between the end blocks' feet, back to the ramp's top
line, down to BASE art px over the floor (a base band left under it); in it two struts stacked against its back, their
fronts rounded off as the recess's (chamfered top and bottom), the lower one out to the slope at its top, the upper one
to the slope at the window's floor, so they step down the slope. Toned by the wall family's levels (bastion's own
greys). Coordinates as the window module's: +y is the near side."""
from mathutils import Vector

from . import walls as W
from .wall3d_iwin import _clip
from .wall3d_iwin_drone_vents import _carve

BASE = 6                    # art px: the base band left under the pocket, over the floor
ROUND = (0.4, 0.3)          # a strut's front rounded off: the chamfers' share of its depth, of its height (the recess's
                            # pipes': 0.4, 0.3)
LVL = {"strut": 3, "ledge": 2, "side": 1}


def _c():
    from . import wall3d_iwin_bastion as B
    return B


def _poly(k, pts, n, lvl):
    q = _clip([tuple(p) for p in pts], [(0, -0.5, 1), (0, 0.5, -1)])
    if len(q) >= 3:
        _c()._quad(k, q, tuple(n), lvl)


def _strut(k, a, b, yb, yf, z0, z1):
    """A strut along x over [a, b], its back at yb, its front out to yf, from z0 to z1: its front rounded off (ROUND)."""
    d, h = yf - yb, z1 - z0
    prof = [(yb, z0), (yb + (1 - ROUND[0]) * d, z0), (yf, z0 + ROUND[1] * h), (yf, z1 - ROUND[1] * h),
            (yb + (1 - ROUND[0]) * d, z1), (yb, z1)]
    for (ya, za), (yc, zc) in zip(prof, prof[1:]):
        n = Vector((0.0, zc - za, -(yc - ya)))
        if n.y < 0 or (abs(n.y) < 1e-12 and n.z < 0):
            n = -n
        if n.z < -1e-9:                                 # (a face looking down, out of sight)
            continue
        _poly(k, [(a, ya, za), (b, ya, za), (b, yc, zc), (a, yc, zc)], n, LVL["strut"])


def front(k, part, cells):
    B = _c()
    zt, yl = B._zt(), B._line()
    zb, zf = BASE / W.ZART, B._zf()
    _, c0, c1, _ = B._marks(part)                       # (the end blocks' feet)
    _carve(k, [(0, c0, 1), (0, c1, -1), (2, zb, 1), (2, zt + 1e-4, -1), (1, -yl, -1)])   # (mesh y: in front of the back)
    zm = (zb + zf) / 2
    a, b = max(c0, -0.5), min(c1, 0.5)
    if b - a < 1e-9:
        return
    _poly(k, [(a, yl, zb), (b, yl, zb), (b, B._out(zb), zb), (a, B._out(zb), zb)], (0, 0, 1), LVL["ledge"])
    _strut(k, a, b, yl, B._out(zm), zb, zm)
    _strut(k, a, b, yl, B._out(zf), zm, zf)
    for u, sd in ((c0, 1), (c1, -1)):
        if -0.5 < u < 0.5:
            _poly(k, [(u, yl, zb), (u, B._out(zb), zb), (u, B._out(zf), zf), (u, yl, zf)], (sd, 0, 0), LVL["side"])
