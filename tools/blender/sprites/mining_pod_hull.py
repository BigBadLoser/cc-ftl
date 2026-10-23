"""The mining pod's hull surfaces (mining_pod.py): lofts that can be cut, exactly, by the rear thruster's bore and by
recessed panels, and the recesses themselves.

A loft is shuttle_craft.sweep's: rings of a profile through stations (u, half width, half height, v, z). Its faces are
cut in their own parameters, so every piece lies on the face it came from and meets its uncut neighbours flush:
- the bore: a BORE_N-gon cylinder along the body frame's v (the pod's u) through the back; each back face reaching it
  is, in the (u, z) plane, a quad less the bore's polygon (peeled off edge by edge into convex pieces);
- recesses: rectangles in (u, profile angle); each face is its rectangle less theirs. `recess` then sinks a floor below
  them on the same facets and walls it round."""
import math

from .shuttle_craft import profile, station

BORE_N = 64                   # the bore is this many-sided: the hull is cut along exactly the polygon its wall follows


def bore_corner(i, r, zc):
    a = i * math.tau / BORE_N
    return r * math.cos(a), zc + r * math.sin(a)


def _halfplane(poly, a, b, c):
    """The part of a convex 2D polygon where a*x + b*y <= c."""
    out = []
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        dp, dq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if dp <= 0:
            out.append(p)
        if (dp < 0) != (dq < 0) and abs(dp - dq) > 1e-12:
            t = dp / (dp - dq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def _minus_bore(poly, r, zc):
    """A convex (u, z) polygon less the bore's polygon about (0, zc): convex pieces, peeled off edge by edge."""
    pieces, rest = [], poly
    h = r * math.cos(math.pi / BORE_N)                                      # each edge's distance from the axis
    for i in range(BORE_N):
        a = (i + 0.5) * math.tau / BORE_N
        nx, nz = math.cos(a), math.sin(a)
        piece = _halfplane(rest, -nx, -nz, -nz * zc - h)                     # outside this edge
        if len(piece) >= 3:
            pieces.append(piece)
        rest = _halfplane(rest, nx, nz, nz * zc + h)                         # inside it: carry on round
        if len(rest) < 3:
            break
    return pieces


def _on_face(q, u, z):
    """The point of face q (corners: station a at profile i, a at j, b at j, b at i) at (u, z), on the face itself."""
    s = 0.0 if abs(q[3][0] - q[0][0]) < 1e-9 else (u - q[0][0]) / (q[3][0] - q[0][0])
    lo = q[0][2] + (q[3][2] - q[0][2]) * s                                  # z of the face's i edge at u
    hi = q[1][2] + (q[2][2] - q[1][2]) * s                                  # and of its j edge
    t = 0.0 if abs(hi - lo) < 1e-9 else (z - lo) / (hi - lo)
    a = [q[0][x] + (q[3][x] - q[0][x]) * s for x in range(3)]
    b = [q[1][x] + (q[2][x] - q[1][x]) * s for x in range(3)]
    return (u, a[1] + (b[1] - a[1]) * t, z)


def _bilinear(q, ua, ub, ti, tj, u, t):
    """The point of face q at (u, profile angle t), on the face itself."""
    s = (u - ua) / (ub - ua) if ub != ua else 0.0
    w = (t - ti) / (tj - ti) if tj != ti else 0.0
    return tuple(q[0][x] * (1 - s) * (1 - w) + q[1][x] * (1 - s) * w + q[2][x] * s * w + q[3][x] * s * (1 - w)
                 for x in range(3))


def _rect_minus(r, c):
    """Rectangle r (u0, u1, t0, t1) less rectangle c: up to four rectangles."""
    if c[0] >= r[1] or c[1] <= r[0] or c[2] >= r[3] or c[3] <= r[2]:
        return [r]
    out = []
    if c[0] > r[0]:
        out.append((r[0], c[0], r[2], r[3]))
    if c[1] < r[1]:
        out.append((c[1], r[1], r[2], r[3]))
    m0, m1 = max(r[0], c[0]), min(r[1], c[1])
    if c[2] > r[2]:
        out.append((m0, m1, r[2], c[2]))
    if c[3] < r[3]:
        out.append((m0, m1, c[3], r[3]))
    return out


def _angles(prof):
    return [math.degrees(math.atan2(pz, pv)) % 360 for pv, pz in prof]


def loft(f, stations, prof, mat, cap0=None, cap1=None, closed=True, hole=None, zc=0.0, recesses=()):
    """shuttle_craft.sweep, cut by the bore (radius `hole` about z = zc) and by `recesses` ((u0, u1, t0, t1) rectangles
    in u and profile angle, degrees)."""
    local = [[(u, v0 + pv * sv, z0 + pz * sz) for pv, pz in prof] for u, sv, sz, v0, z0 in stations]
    rings = [[f.pt(*p) for p in ring_] for ring_ in local]
    n = len(prof)
    ang = _angles(prof)
    for k, (A, B) in enumerate(zip(rings, rings[1:])):
        ua, ub = stations[k][0], stations[k + 1][0]
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            q = [local[k][i], local[k][j], local[k + 1][j], local[k + 1][i]]
            if hole and all(p[1] > 1e-6 for p in q) and min(abs(p[2] - zc) for p in q) < hole + 0.005 and \
                    min(abs(p[0]) for p in q) < hole + 0.005:
                uz = [(p[0], p[2]) for p in q]
                cw = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(uz, uz[1:] + uz[:1])) < 0
                for piece in _minus_bore(uz[::-1] if cw else uz, hole, zc):      # cut counter-clockwise,
                    pts = [f.pt(*_on_face(q, u, z)) for u, z in piece]
                    f.poly(pts[::-1] if cw else pts, mat, flip=True)            # drawn in the face's own winding
                continue
            ti, tj = ang[i], ang[j] + (360 if ang[j] <= ang[i] else 0)
            whole = (ua, ub, ti, tj)
            pieces = [whole]
            for r0, r1, s0, s1 in recesses:
                for sh in (-360, 0, 360):
                    pieces = [p for pc in pieces for p in _rect_minus(pc, (r0, r1, s0 + sh, s1 + sh))]
            if pieces == [whole]:
                f.poly([A[i], A[j], B[j], B[i]], mat, flip=True)
                continue
            for u0, u1, t0, t1 in pieces:
                f.poly([f.pt(*_bilinear(q, ua, ub, ti, tj, u, t)) for u, t in ((u0, t0), (u0, t1), (u1, t1), (u1, t0))],
                       mat, flip=True)
    if cap0:
        f.poly(rings[0], cap0, flip=True)
    if cap1:
        f.poly(rings[-1][::-1], cap1, flip=True)


def facet(stations, prof, u, t, kk=1.0):
    """The point of a loft's faceted surface at (u, profile angle t), its radius scaled by kk about the axis."""
    k = max(0, min(len(stations) - 2, next((i for i in range(len(stations) - 1) if stations[i + 1][0] >= u),
                                               len(stations) - 2)))
    ang, n = _angles(prof), len(prof)
    tt = t % 360
    for i in range(n):
        ti, tj = ang[i], ang[(i + 1) % n] + (360 if ang[(i + 1) % n] <= ang[i] else 0)
        x = tt + (360 if tt < ti else 0)
        if ti <= x <= tj:
            break

    def pt(st, idx):
        su, sv, sz, v0, z0 = st
        pv, pz = prof[idx]
        return (su, v0 + pv * sv * kk, z0 + pz * sz * kk)
    j = (i + 1) % n
    q = [pt(stations[k], i), pt(stations[k], j), pt(stations[k + 1], j), pt(stations[k + 1], i)]
    return _bilinear(q, stations[k][0], stations[k + 1][0], ti, tj, u, x)


def recess(f, stations, prof, u0, u1, t0, t1, depth, wall, floor, screw=None):
    """A recessed panel where the loft was cut by (u0, u1, t0, t1): a floor `depth` (radius fraction) below the facets,
    walls round it down from the hull, and, if `screw`, a fastener in each of the floor's corners."""
    ang = sorted({a + s for a in _angles(prof) for s in (-360, 0, 360) if t0 < a + s < t1})
    us = [u0] + [st[0] for st in stations if u0 < st[0] < u1] + [u1]
    ts = [t0] + ang + [t1]
    lo = 1.0 - depth
    for a, b in zip(us, us[1:]):                                             # the floor
        for c, d in zip(ts, ts[1:]):
            f.poly([f.pt(*facet(stations, prof, u, t, lo)) for u, t in ((a, c), (a, d), (b, d), (b, c))], floor, flip=True)
    edges = [[(u, t0) for u in us], [(u1, t) for t in ts], [(u, t1) for u in us[::-1]], [(u0, t) for t in ts[::-1]]]
    for e in edges:                                                          # the walls
        for (ua, ta), (ub, tb) in zip(e, e[1:]):
            f.poly([f.pt(*facet(stations, prof, ua, ta)), f.pt(*facet(stations, prof, ub, tb)),
                    f.pt(*facet(stations, prof, ub, tb, lo)), f.pt(*facet(stations, prof, ua, ta, lo))], wall, flip=True)
    if screw:
        for uu in (u0 + 0.03, u1 - 0.03):
            for tc in (t0 + 4.0, t1 - 4.0):
                f.poly([f.pt(*facet(stations, prof, u, t, lo + 0.004)) for u, t in
                        ((uu - 0.014, tc - 1.8), (uu - 0.014, tc + 1.8), (uu + 0.014, tc + 1.8), (uu + 0.014, tc - 1.8))],
                       screw, flip=True)


def patch(f, body, u0, u1, t0, t1, k, mat, n=9, steps=4, hole=None, zc=0.0):
    """A panel lying on the hull: the arc t0..t1 (degrees) of its round section, scaled by k, over u0..u1 (as
    shuttle_craft.patch, but on the hull's own circle, not the shuttle's rounded square), cut by the bore."""
    us = [u0 + (u1 - u0) * i / steps for i in range(steps + 1)]
    loft(f, [station(body, u, k) for u in us], profile(t0, t1, n, p=2.0), mat, closed=False, hole=hole, zc=zc)
