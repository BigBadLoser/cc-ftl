"""The exterior hull's outline from a ship's tile mask, and each tile's share of it (no bpy: the art jobs and the
mockups use it, and the runtime picks a tile's sprite by the same key).

The outline runs a cell in from the mask's edges on space; a staircase of outer corners (two or more running on) runs
as one 45 degree diagonal through its steps' side corners. Each side of it is a front (sx, sy, c): s . p <= c, c in
32nds of a tile. The hull's solid behind a front is the run's section (wall3d_ext_geom) by its scaled depth
d = (c - s . p) / deep(s); along a convex stretch the solid is all its fronts' at once, at a concave corner either
side's, split where their depths meet. A tile's key is the stretch of fronts whose solid reaches it, relative to the
tile: its piece's name and all of its geometry."""
import math

from .scale import TILE_H, TILE_W

INSET = 1                           # 32nds: the outline in from the mask's edge (wall3d_ext_geom.E = 0.5 - 1 / 32)
E = 0.5 - INSET / 32
LIP = E + 0.5                       # the hull's back this far behind a run's outline (d terms: the tile's back edge)
REACH = 3.0                         # tiles: the fronts this near a tile are tried
NEAR = {(1, 0), (0, 1)}             # the sides facing the camera: their runs and corners are the run set's (wall3d_ext)
EPS = 1e-7


def deep(s):
    """A front's depths' scale (its lean's, top's, seam's: d per the run's depth): 1 along an edge; on a diagonal, so
    its bands are as thick on screen across their edges as a run's (a run's edges slant at the tile's angle, a
    camera-facing diagonal's run level and recede half as fast, a side diagonal's stand upright)."""
    if abs(s[0]) + abs(s[1]) < 2:
        return 1.0
    cos = math.cos(math.atan2(TILE_H, TILE_W))
    return 2 * cos if s[0] == s[1] else cos


def back(s):
    """Where a front's hull ends behind it, in d: never short of a run's in s . p (so a tile is never left open)."""
    g = deep(s)
    return max(g, 1.0) * LIP / g


def _cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def _cycles(mask):
    """The mask's edges on space as closed loops, the ship on their left: [(tile, outward normal)]."""
    out = {}
    for x, y in mask:
        for n in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            if (x + n[0], y + n[1]) not in mask:
                a = (2 * x + n[0] + n[1], 2 * y + n[1] - n[0])          # (doubled: its start, the end 2 on)
                out.setdefault(a, []).append(((x, y), n, (a[0] - 2 * n[1], a[1] + 2 * n[0])))
    seen, loops = set(), []
    for es in out.values():
        for e in es:
            loop = []
            while (e[0], e[1]) not in seen:
                seen.add((e[0], e[1]))
                loop.append(e[:2])
                nxt = out[e[2]]                                         # (two tiles meeting at a corner: keep to
                e = ([m for m in nxt if _cross(e[1], m[1]) > 0] or nxt)[0]  # this one, round its corner)
            if loop:
                loops.append(loop)
    return loops


def _fronts(loop):
    """A loop's fronts in order: its straight runs, and each staircase of two or more outer corners as a diagonal."""
    m = len(loop)
    turn = [_cross(loop[i][1], loop[(i + 1) % m][1]) for i in range(m)]  # (> 0 an outer corner, < 0 an inner one)
    i0 = next((i for i in range(m) if turn[i - 1] == 0), 0)             # (start on a straight: never in a staircase)
    loop, turn = loop[i0:] + loop[:i0], turn[i0:] + turn[:i0]
    out, i = [], 0
    while i < m:
        j = i
        while j < m - 1 and turn[j] * (1 if (j - i) % 2 == 0 else -1) > 0:
            j += 1
        if (j - i) % 2 == 0:                                            # (end on an outer corner)
            j -= 1
        (x, y), a = loop[i]
        if j - i >= 3:                                                  # (two outer corners or more: a diagonal
            b = loop[i + 1][1]                                          # through the steps' side corners)
            s = (a[0] + b[0], a[1] + b[1])
            f, i = (s, 32 * (s[0] * x + s[1] * y) + 32 * E - 16), j + 1
        else:
            f, i = (a, 32 * (a[0] * x + a[1] * y) + 32 * E), i + 1
        f = (f[0], round(f[1]))
        if not out or out[-1] != f:
            out.append(f)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out


def outline(mask):
    """The mask's outline: a list of loops, each [(s, c)] in order (c in 32nds, world)."""
    return [_fronts(loop) for loop in _cycles(set(mask))]


def _meet(f, h):
    """Where two fronts' lines cross (world, tiles)."""
    (s, c), (t, e) = f, h
    det = _cross(s, t)
    if det == 0:
        return None
    c, e = c / 32, e / 32
    return ((c * t[1] - e * s[1]) / det, (s[0] * e - t[0] * c) / det)


def _near(p, a, b):
    """The distance from p to the segment a b (None at either end: a line)."""
    if a is None or b is None:
        return 0.0
    dx, dy = b[0] - a[0], b[1] - a[1]
    u = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / max(EPS, dx * dx + dy * dy)))
    return math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy)


def groups(fronts):
    """A stretch [(s, c)] split at its concave corners: [(convex run, front before it, front after it)]."""
    out, cur = [], [fronts[0]]
    for f, h in zip(fronts, fronts[1:]):
        if _cross(f[0], h[0]) < 0:
            out.append(cur)
            cur = []
        cur.append(h)
    out.append(cur)
    return [(g, out[i - 1][-1] if i else None, out[i + 1][0] if i + 1 < len(out) else None) for i, g in enumerate(out)]


def _clip(poly, hs):
    """A convex polygon cut to each half-plane (a, b, c: a x + b y <= c)."""
    for a, b, c in hs:
        out = []
        for p, q in zip(poly, poly[1:] + poly[:1]):
            u, v = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
            if u <= EPS:
                out.append(p)
            if (u < -EPS < v) or (v < -EPS < u):
                k = u / (u - v)
                out.append((p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k))
        poly = out
        if len(poly) < 3:
            return []
    return poly


def _across(poly, h):
    """Whether a half-plane's edge runs across a polygon."""
    v = [h[0] * x + h[1] * y - h[2] for x, y in poly]
    return bool(v) and min(v) < -1e-6 and max(v) > 1e-6


def _area(poly):
    return abs(sum(_cross(p, q) for p, q in zip(poly, poly[1:] + poly[:1]))) / 2


def at_least(f, k=0.0):
    """Half-plane d(f) >= k (s . p <= c - g k), as (a, b, c)."""
    s, c = f
    return (s[0], s[1], c / 32 - deep(s) * k)


def nearer(f, h, kf=0.0, kh=0.0):
    """Half-plane d(f) - kf <= d(h) - kh."""
    (s, c), (t, e), g, w = f, h, deep(f[0]), deep(h[0])
    return (t[0] / w - s[0] / g, t[1] / w - s[1] / g, e / 32 / w - c / 32 / g + kf - kh)


def _uses(fronts):
    """Which fronts of a stretch (tile-local) shape the tile: one is the nearest of its convex run somewhere on the
    tile's hull, or its back runs across the tile there."""
    sq = [(-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)]
    used = set()
    for g, before, after in groups(fronts):
        side = [nearer(o, f) for o, f in ((before, g[0]), (after, g[-1])) if o]    # (the concave corners' splits)
        base = _clip(sq, [at_least(f) for f in g])
        hull = _clip(base, side)
        had = len(used)
        for f in g:                                                     # (past its own back, a front shapes
            a, b, c = at_least(f, back(f[0]))                           # nothing: the top is flat there)
            near = _clip(hull, [nearer(f, h) for h in g if h is not f] + [(-a, -b, -c)])
            if _area(near) > EPS:
                used.add(fronts.index(f))
            span = _clip(hull, [nearer(f, h, back(f[0]), back(h[0])) for h in g if h is not f])
            if _across(span, at_least(f, back(f[0]))):                 # (where the roof starts)
                used.add(fronts.index(f))
        for o, f in ((before, g[0]), (after, g[-1])):                   # (a concave corner's other side cutting
            if o and len(used) > had and _across(base, nearer(o, f)):  # this one off: it stands full there, past
                used.add(fronts.index(o))                               # its back too)
    return used


def key(loops, tile):
    """The tile's key: the stretches of fronts that shape it, relative to it ("sx,sy,c;..." per stretch, "|" between),
    or "" (none: plain roof)."""
    x, y = tile
    parts = []
    for fr in loops:
        n = len(fr)
        pts = [_meet(fr[i - 1], fr[i]) for i in range(n)] if n > 1 else [None]
        near = [i for i in range(n) if _near(tile, pts[i], pts[(i + 1) % n] if n > 1 else None) <= REACH]
        if not near:
            continue
        runs, cur = [], [near[0]]                                       # (contiguous, round the loop)
        for i in near[1:]:
            if i == cur[-1] + 1:
                cur.append(i)
            else:
                runs.append(cur)
                cur = [i]
        runs.append(cur)
        if len(runs) > 1 and runs[0][0] == 0 and runs[-1][-1] == n - 1:
            runs[0] = runs.pop() + runs[0]
        for run in runs:
            loc = [(fr[i][0], fr[i][1] - 32 * (fr[i][0][0] * x + fr[i][0][1] * y)) for i in run]
            used = _uses(loc)
            if used:
                parts.append(loc[min(used):max(used) + 1])
    return "|".join(";".join(f"{s[0]},{s[1]},{c}" for s, c in p) for p in parts)


def parse(k):
    """A key's stretches: [[((sx, sy), c)]] (c in 32nds, tile-local)."""
    return [[((int(a), int(b)), int(c)) for a, b, c in (f.split(",") for f in p.split(";"))]
            for p in k.split("|") if p]


def generic(k):
    """Whether a key is this set's (a diagonal, a far side) rather than the run set's (near runs and corners only)."""
    return any(s not in NEAR for p in parse(k) for s, _ in p)


def name(k):
    """A key's sprite id part (file-safe)."""
    return k.replace(",", "_").replace(";", "~").replace("|", "+").replace("-", "m")
