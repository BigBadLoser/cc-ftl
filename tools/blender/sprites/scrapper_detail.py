"""The scrapper's finer body detail (scrapper.py builds the shapes): panel seams, drawn as thin strips lying just
proud of the body's faces."""
from . import scrapper as S

PX = 0.028           # one pixel across L or D at 1x
PXZ = 0.0255         # one pixel up z
OFF = 0.004          # how far a seam stands off the face (just enough not to z-fight)


def _quad(b, pts, col, out):
    b.face([b.P(*p) for p in pts], col, tuple(b.P(*out)[k] - b.P(0, 0, 0)[k] for k in range(3)))


def wall_v(b, D, side, L, z0, z1, col, w=PX):
    """An upright seam on the long wall at D (side: +1 front, -1 back) at L, from z0 to z1."""
    d = D + side * OFF
    _quad(b, [(L - w / 2, d, z0), (L + w / 2, d, z0), (L + w / 2, d, z1), (L - w / 2, d, z1)], col, (0, side, 0))


def wall_h(b, D, side, L0, L1, z, col, h=PXZ):
    """A level seam on the long wall at D from L0 to L1 at height z."""
    d = D + side * OFF
    _quad(b, [(L0, d, z - h / 2), (L1, d, z - h / 2), (L1, d, z + h / 2), (L0, d, z + h / 2)], col, (0, side, 0))


def top_L(b, D, Ls, col, w=PX):
    """A seam along L lying on the top at D, through the breakpoints Ls (the top's height between them is linear)."""
    for L0, L1 in zip(Ls, Ls[1:]):
        z0, z1 = S._top(L0 + 1e-4, D) + OFF, S._top(L1 - 1e-4, D) + OFF
        _quad(b, [(L0, D - w / 2, z0), (L1, D - w / 2, z1), (L1, D + w / 2, z1), (L0, D + w / 2, z0)], col, (0, 0, 1))


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
