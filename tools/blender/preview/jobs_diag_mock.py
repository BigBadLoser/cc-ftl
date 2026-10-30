"""Diagonal walls blockout: a straight run along x turning into a 3-step 45 degree diagonal and back, both ways (A: to
-y, facing the camera; B: to +y, edge-on), over a tile grid with the wall tiles marked. Flat greys by facing; the slab
TW thick on its centre line, the skirt both sides at the walls' slope, the cap the walls' cut black."""
import math

from sprites import core
from sprites import walls as W
from sprites.door_block import _tone

TW, HF = W.TW, W.HF
ZS, RUN = W.skirt_top(), W.skirt_run()
YC = -0.5 + W.wall_back() + TW / 2          # a straight run's centre line in its tile (y, along x)


def _off(line, d):
    """A polyline offset d to its left (mitred)."""
    seg = []
    for a, b in zip(line, line[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dy)
        seg.append((-dy / n, dx / n))
    out = []
    for i, p in enumerate(line):
        ns = seg[max(0, i - 1):i + 1]
        if len(ns) == 2:
            (a, b), (c, e) = ns
            m = 1 + a * c + b * e
            out.append((p[0] + d * (a + c) / m, p[1] + d * (b + e) / m))
        else:
            out.append((p[0] + d * ns[0][0], p[1] + d * ns[0][1]))
    return out


def _poly(m, pts, tone=None):
    q = [core.G(*p) for p in pts]
    n = [0.0, 0.0, 0.0]
    for a, b in zip(pts, pts[1:] + pts[:1]):
        n[0] += (a[1] - b[1]) * (a[2] + b[2])
        n[1] += (a[2] - b[2]) * (a[0] + b[0])
        n[2] += (a[0] - b[0]) * (a[1] + b[1])
    ln = math.sqrt(sum(c * c for c in n)) or 1.0

    class V:
        x, y, z = n[0] / ln, n[1] / ln, n[2] / ln
    t = "bkY" if abs(abs(V.x) - abs(V.y)) < 1e-6 and V.z < 0.5 else _tone(V)   # (a diagonal face: the lit tone)
    m.poly(q, tone or t)


def wall(m, line):
    """The wall along a centre line: slab, cap, skirts both sides."""
    l, r = _off(line, TW / 2), _off(line, -TW / 2)
    ls, rs = _off(line, TW / 2 + RUN), _off(line, -TW / 2 - RUN)
    for i in range(len(line) - 1):
        a, b = i, i + 1
        _poly(m, [(*l[a], HF), (*l[b], HF), (*r[b], HF), (*r[a], HF)], "wK")                 # cap
        for e, s in ((l, ls), (r, rs)):
            _poly(m, [(*e[a], ZS), (*e[b], ZS), (*e[b], HF), (*e[a], HF)])                    # face
            _poly(m, [(*s[a], 0.0), (*s[b], 0.0), (*e[b], ZS), (*e[a], ZS)])                  # skirt
    for i in (0, len(line) - 1):                                                             # the ends
        _poly(m, [(*l[i], 0.0), (*r[i], 0.0), (*r[i], HF), (*l[i], HF)])


def floor(m, x0, x1, y0, y1, walls):
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            t = "bkYd" if (x, y) in walls else ("bkXdd" if (x + y) % 2 else "bkXd")
            _poly(m, [(x - 0.5, y - 0.5, -0.002), (x + 0.5, y - 0.5, -0.002), (x + 0.5, y + 0.5, -0.002),
                      (x - 0.5, y + 0.5, -0.002)], t)


def scene(s):
    """s = -1: the diagonal to -y (A), +1: to +y (B)."""
    m = core.Mesh(f"diag_mock_{s}", flat=True)
    line = [(-3.5, YC), (0.5, YC), (3.5, YC + 3 * s), (6.5, YC + 3 * s)]
    tiles = {(x, 0) for x in range(-3, 1)} | {(x, 3 * s) for x in range(4, 7)}
    for k in range(3):                       # the staircase under the diagonal
        tiles |= {(1 + k, s * k), (1 + k, s * (k + 1))}
    floor(m, -3, 6, min(0, 3 * s) - 1, max(0, 3 * s) + 1, tiles)
    wall(m, line)
    return [m.build()]


JOBS = {"diag.A": ("block", lambda: scene(-1)), "diag.B": ("block", lambda: scene(1))}
