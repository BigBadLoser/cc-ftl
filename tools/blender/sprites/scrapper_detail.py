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


KINKS = (0.5, 1.0, 1.0 + S.STEP, 2.0 - S.STEP, 2.0, 3.0 - S.STEP, 3.0, 3.5)


def _outline(D, L0, L1, z0, mz):
    """The (L, z) outline of a panel on the long wall at D between L0 and L1, from z0 up to mz below the wall's top:
    ccw, its first edge the bottom; where the end slope cuts below it, it comes to a point."""
    u = lambda L: S._top(L, D) - mz                                     # noqa: E731
    Ls = sorted({L0, L1, *(k for k in KINKS if L0 < k < L1)})
    pts = []
    for a, c in zip(Ls, Ls[1:]):
        ua, uc = u(a), u(c)
        if ua >= z0:
            pts.append((a, ua))
        if (ua - z0) * (uc - z0) < 0:                                   # the top crosses the bottom line
            pts.append((a + (c - a) * (z0 - ua) / (uc - ua), z0))
    if u(Ls[-1]) >= z0:
        pts.append((Ls[-1], u(Ls[-1])))
    if len(pts) < 2:
        return []
    top = pts[::-1]                                                     # right to left along the top
    lo, hi = min(p[0] for p in pts), max(p[0] for p in pts)
    out = [(lo, z0), (hi, z0)]
    out += [p for p in top if not (p[1] == z0 and p[0] in (lo, hi))]
    return out


def panel(b, D, side, poly, col, lit, t=0.035, hb=0.026):
    """A recessed panel on the long wall at D with the (L, z) outline poly (ccw, bottom edge first), painted the way
    the belt is: its top and sides in shadow (col), t wide inside the outline; its bottom a lit bevel facing up."""
    d, dd = D + side * OFF, D + side * (OFF + hb)
    (a, z0), (c, _) = poly[0], poly[1]
    _paint(b, [(a, d, z0 + hb), (c, d, z0 + hb), (c, dd, z0), (a, dd, z0)], lit, (0, side, 1))
    n = len(poly)
    for k in range(1, n):
        (pL, pz), (qL, qz) = poly[k], poly[(k + 1) % n]
        dL, dz = qL - pL, qz - pz
        ln = (dL * dL + dz * dz) ** 0.5 or 1.0
        iL, iz = -dz / ln * t, dL / ln * t                              # inward (left of the ccw edge)
        _paint(b, [(pL, d, pz), (qL, d, qz), (qL + iL, d, qz + iz), (pL + iL, d, pz + iz)], col, (0, side, 0))


def panels(b, col, lit, rivet, m=0.11, mz=0.09, rm=0.05):
    """Recessed panels on the long walls, one in each plate the seams mark out, under the belt and over it (pointed
    where the end slopes cut in), m in from the seams and mz in from the belt, the plinth and the top; a rivet off
    each corner, rm out from it."""
    D0, D1 = 0.03, 1.97
    back = ((0.03, 1.0), (1.0, 2.0), (2.0, 3.0), (3.0, 3.97))
    plates = [(D0, -1, sp, lo) for sp in back for lo in (True, False)]
    plates += [(D1, 1, (0.03, 1.0), True), (D1, 1, (0.03, 1.0), False), (D1, 1, (3.0, 3.97), False)]
    for D, side, (L0, L1), lower in plates:
        if lower:
            z0, z1 = S.BASE + mz, S.WALL - mz
            poly = [(L0 + m, z0), (L1 - m, z0), (L1 - m, z1), (L0 + m, z1)]
        else:
            poly = _outline(D, L0 + m, L1 - m, S.WALL + mz, mz)
        if len(poly) < 3:
            continue
        panel(b, D, side, poly, col, lit)
        cL, cz = sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly)
        for pL, pz in poly:
            vL, vz = pL - cL, pz - cz
            ln = (vL * vL + vz * vz) ** 0.5 or 1.0
            rivet_wall(b, D, side, pL + vL / ln * rm, pz + vz / ln * rm, rivet)


def drum_bolts(b, D, z, r, bands, n, turn, col, s=0.05, h=0.025):
    """n bolt heads round each band (L0, L1) of the drum (axis at D, z; band radius r), turned with it: small blocks
    standing h out of the band, s square, so the drum's turning shows."""
    import math
    for L0, L1 in bands:
        Lc = (L0 + L1) / 2
        for k in range(n):
            a = turn + (k + 0.5) * math.tau / n
            ca, sa = math.cos(a), math.sin(a)
            def at(dl, dt, dr):                                         # along L, round, out from the axis
                return b.P(Lc + dl, D + (r + dr) * ca - dt * sa, z + (r + dr) * sa + dt * ca)
            box = [[at(dl, dt, dr) for dl, dt in ((-s / 2, -s / 2), (s / 2, -s / 2), (s / 2, s / 2), (-s / 2, s / 2))]
                   for dr in (-0.005, h)]
            lo, hi = box
            ctr = at(0, 0, h / 2)
            for q in (hi, *([lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i]] for i in range(4))):
                c = [sum(p[k2] for p in q) / 4 for k2 in range(3)]
                b.face(q, col, tuple(c[k2] - ctr[k2] for k2 in range(3)))


def gear(b, L, D, z, col, r=0.17, ring=0.06, hole=0.065, teeth=8, tooth=0.055, tw=0.065):
    """A gear painted on a top at height z, centred on (L, D): a ring round a bare hole, square teeth on it; strokes
    about 2 px so it reads unbroken."""
    import math
    up = (0, 0, 1)
    ri, ro, n = hole, hole + ring, 24
    for k in range(n):
        a0, a1 = k * math.tau / n, (k + 1) * math.tau / n
        q = [(L + rr * math.cos(a), D + rr * math.sin(a), z + OFF) for rr, a in ((ri, a0), (ri, a1), (ro, a1), (ro, a0))]
        _paint(b, q, col, up)
    for k in range(teeth):
        a = (k + 0.5) * math.tau / teeth
        c, s = math.cos(a), math.sin(a)
        q = [(L + c * rr - s * t, D + s * rr + c * t, z + OFF) for rr, t in ((ro - 0.01, -tw / 2), (ro + tooth, -tw / 2),
                                                                           (ro + tooth, tw / 2), (ro - 0.01, tw / 2))]
        _paint(b, q, col, up)
