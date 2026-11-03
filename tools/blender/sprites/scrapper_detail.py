"""The scrapper's finer body detail (scrapper.py builds the shapes): panel seams, painted on (thin strips lying just
proud of the body's faces, about 1.5 px across so they read unbroken)."""
from . import scrapper as S

PX = 0.028           # one pixel across L or D at 1x
PXZ = 0.0255         # one pixel up z
OFF = 0.004          # how far a seam stands off the face (just enough not to z-fight)


def _paint(b, q, col, out):
    b.face([b.P(*p) for p in q], col, tuple(b.P(*out)[k] - b.P(0, 0, 0)[k] for k in range(3)))


def wall_v(b, D, side, L, z0, z1, col, w=0.047):
    """An upright seam painted on the long wall at D (side: +1 front, -1 back) at L, from z0 to z1; w: about 1.5 px."""
    d = D + side * OFF
    _paint(b, [(L - w / 2, d, z0), (L + w / 2, d, z0), (L + w / 2, d, z1), (L - w / 2, d, z1)], col, (0, side, 0))


def wall_h(b, D, side, L0, L1, z, col, h=0.038):
    """A level seam painted on the long wall at D from L0 to L1 at height z; h: about 1.5 px."""
    d = D + side * OFF
    _paint(b, [(L0, d, z - h / 2), (L1, d, z - h / 2), (L1, d, z + h / 2), (L0, d, z + h / 2)], col, (0, side, 0))


def top_L(b, D, Ls, col, w=0.05):
    """A seam along L painted on the top at D, through the breakpoints Ls (the top's height between them is linear).
    w: about 1.5 px across on screen, so it reads as an unbroken line."""
    for L0, L1 in zip(Ls, Ls[1:]):
        z0, z1 = S._top(L0 + 1e-4, D) + OFF, S._top(L1 - 1e-4, D) + OFF
        q = [(L0, D - w / 2, z0), (L1, D - w / 2, z1), (L1, D + w / 2, z1), (L0, D + w / 2, z0)]
        _paint(b, q, col, (0, 0, 1))


def seams(b, col):
    D0, D1 = 0.03, 1.97
    # down the middle of the tops, where the two rows' plates meet
    top_L(b, 1.0, (0.5, 1.0, 1.0 + S.STEP, 2.0 - S.STEP), col)
    top_L(b, 1.0, (3.0, 3.5), col)
    # a belt round the long walls, level with where the end slopes begin (the end walls' tops); the doorways' frames
    # stop below it, so on the front it breaks only for the bay
    zb = S.WALL
    wall_h(b, D0, -1, 0.03, 3.97, zb, col)
    for L0, L1 in ((0.03, 2.0), (3.0, 3.97)):
        wall_h(b, D1, 1, L0, L1, zb, col)
    # upright seams at the tile joins, from the plinth to the top
    for L in (1.0, 2.0, 3.0):
        wall_v(b, D0, -1, L, S.BASE, S._top(L, D0) - 0.005, col)
    wall_v(b, D1, 1, 1.0, S.BASE, S._top(1.0, D1) - 0.005, col)
