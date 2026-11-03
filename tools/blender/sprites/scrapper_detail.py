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


def end_v(b, L, side, D, z0, z1, col, w=0.047):
    """An upright seam painted on the end wall at L (side: -1 hatch end, +1 far end) at D, from z0 to z1."""
    ll = L + side * OFF
    _paint(b, [(ll, D - w / 2, z0), (ll, D + w / 2, z0), (ll, D + w / 2, z1), (ll, D - w / 2, z1)], col, (side, 0, 0))


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
    # and on down each end, between the hatches (between the hatch and the exhaust at the far end), the end slope and
    # the end wall below it
    top_L(b, 1.0, (0.03, 0.5, 1.0, 1.0 + S.STEP, 2.0 - S.STEP), col)
    top_L(b, 1.0, (3.0, 3.5, 3.97), col)
    for L, side in ((0.03, -1), (3.97, 1)):
        end_v(b, L, side, 1.0, S.BASE, S.WALL, col)
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


def rivet_wall(b, D, side, L, z, col, r=0.022, rz=0.02, h=0.022):
    """A rivet head on the long wall at D: a small block standing out of it."""
    d0, d1 = sorted((D, D + side * h))
    b.box(L - r, L + r, d0, d1, z - rz, z + rz, col)


def rivet_end(b, L, side, D, z, col, r=0.022, rz=0.02, h=0.022):
    """A rivet head on the end wall at L."""
    l0, l1 = sorted((L, L + side * h))
    b.box(l0, l1, D - r, D + r, z - rz, z + rz, col)


def rivets(b, col, step=0.2, gap=0.05):
    """Rows of rivets beside the wall seams, gap off each line, about every step."""
    D0, D1 = 0.03, 1.97
    def run(a, c):                                                      # evenly spaced points strictly inside a..c
        n = max(1, round((c - a) / step))
        return [a + (c - a) * (k + 0.5) / n for k in range(n)]
    for D, side, spans in ((D0, -1, ((0.03, 1.0), (1.0, 2.0), (2.0, 3.0), (3.0, 3.97))),
                           (D1, 1, ((0.03, 1.0), (1.0, 2.0), (3.0, 3.97)))):
        for L0, L1 in spans:                                            # under the belt
            for L in run(L0 + 0.05, L1 - 0.05):
                rivet_wall(b, D, side, L, S.WALL - gap, col)
    for L in (1.0, 2.0, 3.0):                                           # beside the tile-join seams
        for z in run(S.BASE + 0.05, S.WALL - 0.1):
            rivet_wall(b, D0, -1, L + gap, z, col)
    for z in run(S.BASE + 0.05, S.WALL - 0.1):
        rivet_wall(b, D1, 1, 1.0 + gap, z, col)
        for L, side in ((0.03, -1), (3.97, 1)):
            rivet_end(b, L, side, 1.0 + gap, z, col)


def panel_wall(b, D, side, L0, L1, z0, z1, col, lit, w=0.04, h=0.03, hb=0.026):
    """A recessed panel on the long wall at D, painted the way the belt is: its top edge and sides in shadow (col), its
    bottom edge a lit bevel facing up (lit), as a plate pressed in reads from above."""
    d = D + side * OFF
    def paint(q, c, out):
        _paint(b, q, c, out)
    paint([(L0, d, z1 - h), (L1, d, z1 - h), (L1, d, z1), (L0, d, z1)], col, (0, side, 0))           # top
    for a, c in ((L0, L0 + w), (L1 - w, L1)):                                                     # sides
        paint([(a, d, z0), (c, d, z0), (c, d, z1 - h), (a, d, z1 - h)], col, (0, side, 0))
    dd = D + side * (OFF + hb)                                                                    # bottom bevel
    paint([(L0, d, z0 + hb), (L1, d, z0 + hb), (L1, dd, z0), (L0, dd, z0)], lit, (0, side, 1))


def panels(b, col, lit, m=0.11, mz=0.09):
    """Recessed panels on the long walls, one in each plate the seams mark out under the belt, m in from the seams
    (clear of the rivet rows beside them) and mz in from the belt and the plinth."""
    D0, D1 = 0.03, 1.97
    for D, side, spans in ((D0, -1, ((0.03, 1.0), (1.0, 2.0), (2.0, 3.0), (3.0, 3.97))),
                           (D1, 1, ((0.03, 1.0),))):
        for L0, L1 in spans:
            panel_wall(b, D, side, L0 + m, L1 - m, S.BASE + mz, S.WALL - mz, col, lit)
