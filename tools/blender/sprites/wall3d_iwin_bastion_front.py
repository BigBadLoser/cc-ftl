"""The bastion window's front (wall3d_iwin_bastion; ref 3295's lower layer): the user's reading of the ref: the floor in
front of the pane drops well down (the window module's FLOOR_DOWN), a channel, and along its front edge one strut (as
the struts in our wall's recess, faction.bastion_designs.bastion_hood's pipes) on the slope's edge: DEPTH px deep at its
top, a plain box (a flat top and an upright front, the user: b3's wedge on the slope read far taller than the wall's
pipes), its foot's front on the ramp's slope line, standing GAP art px over the channel's floor (the floor shows under it). It runs between the end blocks' tops and into them. Toned by the wall family's levels (bastion's
own greys). Coordinates as the window module's: +y is the near side."""
from mathutils import Vector

from . import walls as W
from .wall3d_iwin import _clip

DEPTH = 3                   # px: the strut's depth toward the window (the user: 3 or 4; the wall's pipes are ~2.4)
HEIGHT = 4                  # art px: its height (with its top about the wall's pipes' 5 rows on screen)
GAP = 2                     # art px: its foot over the channel's floor (the user: it sits above the floor)
LVL = {"top": 4, "face": 3}  # the wall family's levels (toned by facing): its top lit


def _c():
    from . import wall3d_iwin_bastion as B
    return B


def _poly(k, pts, n):
    q = _clip([tuple(p) for p in pts], [(0, -0.5, 1), (0, 0.5, -1)])
    if len(q) >= 3:
        _c()._quad(k, q, tuple(n), LVL["top" if Vector(n).normalized().z > 0.9 else "face"])


def front(k, part, cells):
    B = _c()
    P, Z = B.PX, 1 / W.ZART
    b0, _, _, b1 = B._marks(part)                       # (the end blocks' tops' inner edges)
    a, b = max(b0, -0.5), min(b1, 0.5)
    if b - a < 1e-9:
        return
    z0 = B._zf() + GAP * Z
    z1 = z0 + HEIGHT * Z
    yf = B._out(z0)                                     # (its front upright from its foot on the slope's line)
    yb = yf - DEPTH * P
    prof = [(yb, z0), (yf, z0), (yf, z1), (yb, z1)]
    for (ya, za), (yc, zc) in zip(prof, prof[1:] + prof[:1]):
        n = Vector((0.0, zc - za, -(yc - ya)))
        if n.dot(Vector((0.0, (ya + yc) / 2 - yb - DEPTH * P / 2, (za + zc) / 2 - (z0 + z1) / 2))) < 0:
            n = -n
        if n.z < -1e-9 or n.y < -1e-9:                  # (its underside and back: out of sight)
            continue
        _poly(k, [(a, ya, za), (b, ya, za), (b, yc, zc), (a, yc, zc)], n)   # (its ends inside the end blocks)
