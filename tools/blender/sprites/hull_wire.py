"""The rear hull ghost (walls fully down) as a wireframe: its lines drawn as strips exactly 1 px wide on screen, so
every line has the same strength once antialiased (env_build.render_ghost: alpha by coverage). The shape is the
partition's low stub (hull.Out._inner: L-inf distance to the room side): a foot, the ramp, its crest at the step. Lines:
the foot's top along the room side, the crest, the creases where two ramps meet (a concave corner, a T), and the fall
line on the tile's -x / -y edges (each tile draws its own; the next tile's is its neighbour's)."""
import math

from . import core
from .walls import FOOT_PX, GN, RAMP_CELLS, RAMP_PX, SHELF_CELLS, ZART

N = 128                     # samples a tile side, to trace the lines
TONE = "gW2"
LIFT = 0.005                # (over the stub's own surfaces where another piece has them)
CD = (RAMP_CELLS - SHELF_CELLS) / GN    # the crest's distance from the room side


def zof(d):
    """The stub's height at distance d from the room side: the foot's top at the side, up the ramp to the crest."""
    return (FOOT_PX + RAMP_PX * min(RAMP_CELLS - SHELF_CELLS, max(0.0, d) * GN)) / ZART


def _screen(p):
    x, y, z = p
    return (x - y) * 32, (x + y) * 16 - z * ZART


def strip(m, p, q, tone=TONE):
    """Segment p -> q (x, y, z) as a strip 1 px wide on screen, one-sided (up, or right for an upright line): its pixels
    line up with the grid instead of splitting over two."""
    (ax, ay), (bx, by) = _screen(p), _screen(q)
    dx, dy = bx - ax, by - ay
    ln = math.hypot(dx, dy)
    if ln < 1e-6:
        return
    if abs(dx) >= 0.3 * ln:                      # (off upright: widen it up, in z)
        k = ln / (ZART * abs(dx))
        o = (0.0, 0.0, k)
    else:                                       # (upright on screen: widen it right, along +x -y)
        h = ln / (32 * abs(dy))                 # (screen x of (h/2, -h/2): 32 h)
        o = (h / 2, -h / 2, 0.0)
    pts = [p, q, tuple(a + b for a, b in zip(q, o)), tuple(a + b for a, b in zip(p, o))]
    m.poly([core.G(x, y, z + LIFT) for x, y, z in pts], tone)


def _runs(cells):
    """Merge unit grid segments ((i, j) -> (i2, j2), axis-aligned) into maximal straight runs."""
    hz, vt = {}, {}
    for a, b in cells:
        (a, b) = sorted((a, b))
        (hz if a[1] == b[1] else vt).setdefault(a[1] if a[1] == b[1] else a[0], []).append(
            (a[0], b[0]) if a[1] == b[1] else (a[1], b[1]))
    out = []
    for key, segs in hz.items():
        for s0, s1 in _merge(segs):
            out.append(((s0, key), (s1, key)))
    for key, segs in vt.items():
        for s0, s1 in _merge(segs):
            out.append(((key, s0), (key, s1)))
    return out


def _merge(segs):
    segs, out = sorted(segs), []
    for s0, s1 in segs:
        if out and abs(out[-1][1] - s0) < 1e-9:
            out[-1] = (out[-1][0], s1)
        else:
            out.append((s0, s1))
    return out


def _level(d, c):
    """The level set d = c (L-inf distances: axis-aligned) as runs on the sample grid: the edges between samples
    either side of it, put on the grid line between them (in tile coordinates)."""
    segs = []
    for i in range(N):
        for j in range(N + 1):
            # horizontal grid edge between rows j-1 and j at column i: it separates samples (i, j-1) and (i, j)
            if 0 < j < N and (d[i][j - 1] <= c) != (d[i][j] <= c):
                segs.append(((i, j), (i + 1, j)))
    for i in range(N + 1):
        for j in range(N):
            if 0 < i < N and (d[i - 1][j] <= c) != (d[i][j] <= c):
                segs.append(((i, j), (i, j + 1)))
    return [((a[0] / N - 0.5, a[1] / N - 0.5), (b[0] / N - 0.5, b[1] / N - 0.5)) for a, b in _runs(segs)]


def _dirs(sp, x, y):
    """Which way the ramp at (x, y) falls: the axis and sign its distance grows along (L-inf: one of four)."""
    e = 0.5 / N
    gx = sp._inner(x + e, y) - sp._inner(x - e, y)
    gy = sp._inner(x, y + e) - sp._inner(x, y - e)
    return ("x", gx > 0) if abs(gx) > abs(gy) else ("y", gy > 0)


def wire(m, sp):
    xs = [(i + 0.5) / N - 0.5 for i in range(N)]
    d = [[sp._inner(x, y) for y in xs] for x in xs]
    # the crest: a level set, at its height
    for a, b in _level(d, CD):
        if not _stem_back(sp, a, b):
            strip(m, (*a, zof(CD)), (*b, zof(CD)))
    # the foot's top: along the tile's edges where the room side is (distance 0 there)
    for edge in range(4):
        ts = [i / N - 0.5 for i in range(N + 1)]
        pts = [((t, 0.5), (t, -0.5), (0.5, t), (-0.5, t))[edge] for t in ts]
        on = [k for k, p in enumerate(pts) if sp._inner(*p) < 1e-9]
        for k0, k1 in _merge([(k, k + 1) for k in on if k + 1 in on]):
            strip(m, (*pts[k0], zof(0.0)), (*pts[k1], zof(0.0)))
    # creases: where the fall direction changes on the ramp (0 < d < CD), straight lines; each from its foot to its top
    groups = {}
    for i in range(N - 1):
        for j in range(N - 1):
            if not 0 < d[i][j] < CD:
                continue
            here = _dirs(sp, xs[i], xs[j])
            for di, dj in ((1, 0), (0, 1)):
                if 0 < d[i + di][j + dj] < CD and _dirs(sp, xs[i + di], xs[j + dj]) != here:
                    key = tuple(sorted((here, _dirs(sp, xs[i + di], xs[j + dj]))))
                    groups.setdefault(key, []).append(((xs[i] + xs[i + di]) / 2, (xs[j] + xs[j + dj]) / 2))
    for pts in groups.values():
        for cl in _clusters(pts):
            lo = min(cl, key=lambda p: sp._inner(*p))
            hi = max(cl, key=lambda p: sp._inner(*p))
            a, b = _extend(sp, lo, hi)
            strip(m, (*a, zof(sp._inner(*a))), (*b, zof(sp._inner(*b))))
    # the fall line on the tile's -x and -y edges (a seam, or a run's free end)
    for edge in ("x", "y"):
        pts = [((-0.5, t) if edge == "x" else (t, -0.5)) for t in xs]
        on = [p for p in pts if 0 < sp._inner(*p) <= CD + 0.5 / N]
        if on and edge == ("x" if _dirs(sp, *on[0])[0] == "y" else "y"):
            a = min(on, key=lambda p: sp._inner(*p))
            b = max(on, key=lambda p: sp._inner(*p))
            a = (a[0], a[1] + 0.5 / N) if edge == "x" else (a[0] + 0.5 / N, a[1])
            strip(m, (*a, zof(0.0)), (*b, zof(sp._inner(*b))))


def _stem_back(sp, a, b):
    """A T's stem crest on its far side (the slope falling away from the camera, toward -x or -y): seen through the
    arm's slope in front of it, so left unlined (the fill there runs to the arm's own outline)."""
    (ax, ay), (bx, by) = a, b
    t = 1.0 / N
    if sp.mask & 14 == 14 and not sp.corners & 4 and abs(ax - bx) < t and abs(ax + 0.5 - CD) < t:
        return min(ay, by) >= 0.5 - CD - t
    if sp.mask & 7 == 7 and not sp.corners & 1 and abs(ay - by) < t and abs(ay + 0.5 - CD) < t:
        return min(ax, bx) >= 0.5 - CD - t
    return False


def _clusters(pts, gap=4 / N):
    out = []
    for p in sorted(pts):
        for cl in out:
            if any(abs(p[0] - q[0]) <= gap and abs(p[1] - q[1]) <= gap for q in cl[-8:]):
                cl.append(p)
                break
        else:
            out.append([p])
    return out


def _extend(sp, lo, hi):
    """A crease's ends pushed out to d = 0 and d = CD along its own direction (the samples stop half a step short)."""
    dl, dh = sp._inner(*lo), sp._inner(*hi)
    if dh - dl < 1e-9:
        return lo, hi
    vx, vy = (hi[0] - lo[0]) / (dh - dl), (hi[1] - lo[1]) / (dh - dl)
    return (lo[0] - vx * dl, lo[1] - vy * dl), (hi[0] + vx * (CD - dh), hi[1] + vy * (CD - dh))


def render(objs, W, H):
    """The "wire" sprite kind (env_build.render_sprite): objs = [plate, lines(, fill)]. Like env_build.render_ghost (the
    plate opaque and quantized; a pass's brightness becomes alpha over a pale tint) but its alpha weighted by coverage, so
    the 1 px lines are antialiased, and the fill a pass of its own, so its surfaces never hide a line: the passes' alphas
    combined. Returns (rgb, alpha uint8)."""
    import numpy as np
    from . import post
    SS = core.SS
    plate, *glass = objs
    for ob in glass:
        ob.hide_render = True
    rgb, a = core.render(W, H, "color")
    c, op = post.downsample(rgb, a > 0.5, SS, 8, True)
    plate.hide_render = True
    ga = 0.0
    for ob in glass:
        ob.hide_render = False
        rgb2, a2 = core.render(W, H, "color")
        ob.hide_render = True
        cov = post.blocks(a2 > 0.5, SS)
        lum = (post.blocks(rgb2.mean(-1), SS) * cov).sum(-1) / cov.shape[-1]
        ga = 1 - (1 - ga) * (1 - np.clip(lum / 255.0 * 0.65, 0, 0.9))
    plate.hide_render = False
    for ob in glass:
        ob.hide_render = False
    tint = np.array([200.0, 214.0, 232.0])
    mixed = np.where(op[..., None], c * (1 - ga[..., None]) + tint * ga[..., None], tint)
    alpha = np.where(op, 255, np.round(ga * 255)).astype(np.uint8)
    return mixed.astype(np.uint8), alpha
