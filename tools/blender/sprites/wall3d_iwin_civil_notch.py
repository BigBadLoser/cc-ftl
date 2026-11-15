"""The civil window's ramp notch (wall3d_iwin_civil; ref 428's lower layer): a long pocket cut into the near ramp's slope,
across the window from where the end blocks' slopes start (their top edge, BLOCK in from its ends), from BELOW sprite px
over the ramp's edge (where the slope meets the foot) up to where the ramp ends (the floor's front): its back upright,
straight down from the floor's front edge to a ledge along its foot, its end walls triangles (the user); in the look's
own wall ramp, darker than the slope (the wall family's levels all come out the slope's white in civil). Coordinates as
the civil module's: +y is the near side, the mesh's -y (core.G)."""
from . import walls as W
from .wall3d_iwin_drone_vents import _carve

BELOW = 7                   # sprite px: the slope left under it, over the ramp's edge (the ref's 8)
STEP = {"back": 3, "ledge": 5, "side": 6}  # steps of the look's wall ramp (civil v1: the slope is fC1W2; the ref's
                                            # back, floor and end wall c1cac8, 9ea9ad, 68737f)


def _col(part):
    from .restyle import _LOOK
    return f"{_LOOK[-1][0].ramps['wall']}{STEP[part]}"


def _c():
    from . import wall3d_iwin_civil as C
    return C


def _span(part):
    i = _c().BLOCK / 32
    return {"l": (-0.5 + i, 1.5), "m": (-1.5, 1.5), "r": (-1.5, 0.5 - i)}[part]


def _rows(f):
    """Sprite rows a unit of height down the slope: ZART, plus GN / 2 a unit out over its fall."""
    return W.ZART + W.GN / 2 / f


def _foot_z():
    return W.foot() + BELOW / _rows(_c()._fall())


def notch(k, part):
    C = _c()
    zf, zt, yf = C._zf(), C._zt(), C._front()
    z1 = _foot_z()
    u0, u1 = _span(part)
    _carve(k, [(0, u0, 1), (0, u1, -1), (2, z1, 1), (2, zt + 1e-4, -1), (1, -yf, -1)])   # (mesh y: in front of the back)
    a, b = max(u0, -0.5), min(u1, 0.5)
    if b - a < 1e-9:
        return
    ys1 = C._out(z1)
    C._quad(k, [(a, yf, zf), (b, yf, zf), (b, yf, z1), (a, yf, z1)], (0, 1, 0), _col("back"))
    C._quad(k, [(a, yf, z1), (b, yf, z1), (b, ys1, z1), (a, ys1, z1)], (0, 0, 1), _col("ledge"))
    for u, sd in ((u0, 1), (u1, -1)):
        if -0.5 < u < 0.5:
            C._quad(k, [(u, yf, zf), (u, ys1, z1), (u, yf, z1)], (sd, 0, 0), _col("side"))
