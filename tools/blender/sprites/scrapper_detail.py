"""The scrapper's finer body detail (scrapper.py builds the shapes): panel seams, pressed into the body's faces (shallow
V grooves lying on them, so the light shades one side)."""
from . import scrapper as S

PX = 0.028           # one pixel across L or D at 1x
PXZ = 0.0255         # one pixel up z
OFF = 0.004          # how far a seam stands off the face (just enough not to z-fight)


def groove(b, p0, p1, n, a, col, w):
    """A seam from p0 to p1 (L, D, z) on a face with outward normal n, a across it: a shallow V lying on the face, so
    the light picks out one side and shades the other, like a groove pressed into the plates. w: its width."""
    h = w / 2 * 0.8
    def at(p, s, t):                                                    # s across, t out of the face
        return tuple(p[k] + a[k] * s + n[k] * (OFF + t) for k in range(3))
    for sgn in (-1, 1):
        q = [at(p0, sgn * w / 2, h), at(p1, sgn * w / 2, h), at(p1, 0, 0), at(p0, 0, 0)]
        out = tuple(-sgn * a[k] * h + n[k] * w / 2 for k in range(3))
        b.face([b.P(*p) for p in q], col, tuple(b.P(*out)[k] - b.P(0, 0, 0)[k] for k in range(3)))


def wall_v(b, D, side, L, z0, z1, col, w=3 * PX):
    """An upright seam on the long wall at D (side: +1 front, -1 back) at L, from z0 to z1."""
    groove(b, (L, D, z0), (L, D, z1), (0, side, 0), (1, 0, 0), col, w)


def wall_h(b, D, side, L0, L1, z, col, w=3 * PXZ):
    """A level seam on the long wall at D from L0 to L1 at height z. Seen from above, a groove's shadowed upper side
    faces away from the camera, so it is laid flat on the wall in shadow (col), with a lit bevel under it in the
    body's colour, facing up: a groove that reads solid, not dotted."""
    d, h = D + side * OFF, w / 2
    q = [(L0, d, z), (L1, d, z), (L1, d, z + h), (L0, d, z + h)]       # the shadow, flat on the wall
    b.face([b.P(*p) for p in q], col, tuple(b.P(0, side, 0)[k] - b.P(0, 0, 0)[k] for k in range(3)))
    dd = D + side * (OFF + h)                                           # the bevel, sloping out from under it
    q = [(L0, dd, z), (L1, dd, z), (L1, d, z - h), (L0, d, z - h)]
    b.face([b.P(*p) for p in q], S.BODY, tuple(b.P(0, side, 1)[k] - b.P(0, 0, 0)[k] for k in range(3)))


def top_L(b, D, Ls, col, w=0.05):
    """A seam along L painted on the top at D, through the breakpoints Ls (the top's height between them is linear).
    w: about 1.5 px across on screen, so it reads as an unbroken line."""
    for L0, L1 in zip(Ls, Ls[1:]):
        z0, z1 = S._top(L0 + 1e-4, D) + OFF, S._top(L1 - 1e-4, D) + OFF
        q = [(L0, D - w / 2, z0), (L1, D - w / 2, z1), (L1, D + w / 2, z1), (L0, D + w / 2, z0)]
        b.face([b.P(*p) for p in q], col, tuple(b.P(0, 0, 1)[k] - b.P(0, 0, 0)[k] for k in range(3)))


def seams(b, col):
    D0, D1 = 0.03, 1.97
    # down the middle of the tops, where the two rows' plates meet
    top_L(b, 1.0, (0.5, 1.0, 1.0 + S.STEP, 2.0 - S.STEP), col)
    top_L(b, 1.0, (3.0, 3.5), col)
    # a belt round the long walls, below the end walls' tops
    zb = 0.45
    wall_h(b, D0, -1, 0.03, 3.97, zb, col)
    (a0, a1), (c0, c1) = S.DOOR_L
    fr = 0.063 + 0.01                                                   # clear of the doorway frames
    for L0, L1 in ((0.03, a0 - fr), (a1 + fr, 2.0), (3.0, c0 - fr), (c1 + fr, 3.97)):
        wall_h(b, D1, 1, L0, L1, zb, col)
    # upright seams at the tile joins, from the plinth to the top
    for L in (1.0, 2.0, 3.0):
        wall_v(b, D0, -1, L, S.BASE, S._top(L, D0) - 0.005, col)
    wall_v(b, D1, 1, 1.0, S.BASE, S._top(1.0, D1) - 0.005, col)
