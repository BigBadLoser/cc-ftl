"""The civil window's ramp notch (wall3d_iwin_civil; ref 428's lower layer): a long pocket cut RECESS px straight back into
the near ramp's slope, across the window NOTCH_IN in from its ends, from TOP sprite px down the slope from the floor's
front to BELOW sprite px over the ramp's edge (where the slope meets the foot). Its back parallel to the slope, a ledge
along its foot, its end walls; in the look's own wall ramp, darker than the slope (the wall family's levels all come
out the slope's white in civil). Coordinates as the civil module's: +y is the near side, the mesh's -y (core.G)."""
from . import walls as W
from .wall3d_iwin_drone_vents import _carve

NOTCH_IN = 8                # px: the notch's ends in from the window's ends
TOP = 2                     # sprite px: its top edge down the slope from the floor's front (the ref's 2; its slope 24
                            # rows, ours 21)
BELOW = 7                   # sprite px: the slope left under it, over the ramp's edge (the ref's 8)
RECESS = 5                  # px: its depth, straight back into the slope
STEP = {"back": 3, "ledge": 5, "side": 6}  # steps of the look's wall ramp (civil v1: the slope is fC1W2; the ref's
                                            # back, floor and end wall c1cac8, 9ea9ad, 68737f)


def _col(part):
    from .restyle import _LOOK
    return f"{_LOOK[-1][0].ramps['wall']}{STEP[part]}"


def _c():
    from . import wall3d_iwin_civil as C
    return C


def _span(part):
    i = NOTCH_IN / 32
    return {"l": (-0.5 + i, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - i)}[part]


def _rows(f):
    """Sprite rows a unit of height down the slope: ZART, plus GN / 2 a unit out over its fall."""
    return W.ZART + W.GN / 2 / f


def heights():
    C = _c()
    f = C._fall()
    return C._zf() - TOP / _rows(f), W.foot() + BELOW / _rows(f)


def _back_y(z):
    C = _c()
    return C._out(z) - RECESS * C.PX


def notch(k, part):
    C = _c()
    f, zt, yl = C._fall(), C._zt(), C._line()
    z0, z1 = heights()
    u0, u1 = _span(part)
    back = ((0.0, -f, 1.0), zt + f * yl - RECESS * C.PX * f)    # (mesh y: in front of the back plane)
    _carve(k, [(0, u0, 1), (0, u1, -1), (2, z1, 1), (2, z0, -1), back])
    a, b = max(u0, -0.5), min(u1, 0.5)
    if b - a < 1e-9:
        return
    yb0, yb1, ys0, ys1 = _back_y(z0), _back_y(z1), C._out(z0), C._out(z1)
    C._quad(k, [(a, yb0, z0), (b, yb0, z0), (b, yb1, z1), (a, yb1, z1)], (0, f, 1), _col("back"))
    C._quad(k, [(a, yb1, z1), (b, yb1, z1), (b, ys1, z1), (a, ys1, z1)], (0, 0, 1), _col("ledge"))
    for u, sd in ((u0, 1), (u1, -1)):
        if -0.5 < u < 0.5:
            C._quad(k, [(u, yb0, z0), (u, ys0, z0), (u, ys1, z1), (u, yb1, z1)], (sd, 0, 0), _col("side"))
