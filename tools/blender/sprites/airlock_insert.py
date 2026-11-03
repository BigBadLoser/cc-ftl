"""The airlock's hull insert (airlock.py): a clamp ring round the docking collar's tube and a rib from the ring's back
up over the hull's slope into a clamp block that grips the hull's top edge. Blue grey (BLUE), lines cut 1 px deep:
two grooves along the rib, its clamp block's top and the ring's top flat, seams across the rib, a joint at each of the
ring's octagon corners, a jaw seam round the clamp block. The ring is built with the collar (it wraps the tube in front
of the hull); the rib and clamp block are the hull row's brace.

Geometry in the airlock frame at the hull tile: d out from the tile's middle (u - HULL_U), r along the hull, z up. The
hull it is fitted to is the exterior hull's straight run (wall3d_ext): its upright face at d SLOPE[0][0] up to the
slope's start, the slope up to the top's front edge at d 0, the top at TOP_Z. The collar's axis (airlock.ZC) is set so
its mounting flange's top meets the slope's start."""
import math

from . import core
from . import hull_engine as HE

BLUE = ("nvH5", "nvH4", "nvH3", "nvH2", "nvH1", "nvH0")   # the insert's ramp, dark to light (HE.RAMP's order)
SLOPE = ((0.502, 1.199), (0.0, 2.05))  # the hull's slope (d, z): its start over the upright face, the top's front edge
TOP_Z = 2.05
K = math.cos(math.pi / 8)
LW = 0.035                             # a line's width (about 1 px)
DEP = 0.03                             # a cut line's depth (about 1 px)
GW = 0.04                              # a groove's width
CH = 0.035                             # the ring's back edge: chamfer
TOP = 3 / 39.2                         # the ring's top flat stands this much taller (3 px)
BW, BT = 0.15 + 1 / 32, 0.12 + 3 / 39.2   # the rib: half width, thickness
LINES = (-BW * 0.55, BW * 0.55)        # the grooves along the rib (and on to the ring's and the clamp's tops)
SEAM_Z, SEAM_G = 2.085, 0.03           # the clamp block's jaw seam: its bottom, its height


def _ring_dims():
    from . import airlock as AL
    tube = AL.RR - 0.06                                  # the collar tube's radius
    return AL.ZC, tube + 0.01, tube + 0.17               # axis; the ring's apothems: on the tube, its outside


D0, D1 = 0.6 + 5 / 32, 0.76 + 5 / 32  # the ring's back and front (d)


class _B(HE._Builder):
    """HE's face / prism builder in the airlock frame at the hull tile."""
    def __init__(self, rot, name):
        from . import airlock as AL
        f = AL.frame(None, rot)
        self.pt = lambda d, r, z: f.pt(AL.HULL_U + d, r, z)
        self.m = core.Mesh(name)


def _tone_i(n):
    d, r, z = n
    return 4 if z > 0.8 else 5 if z > 0.2 else 2 if abs(r) > abs(d) else 3 if d > 0 else 1


def _groove(n, base=None, k=2):
    """A cut line's floor: k ramp steps darker than the face's tone (by facing, or `base`, a RAMP index)."""
    return HE.RAMP[max(0, (_tone_i(n) if base is None else base) - k)]


def _blue(build):
    """build() with HE's ramp swapped for BLUE (its faces tone by facing on it)."""
    was, HE.RAMP = HE.RAMP, BLUE
    try:
        return build()
    finally:
        HE.RAMP = was


# ---- the clamp ring -------------------------------------------------------------------------------------------------

def _rounded(zc, a, t, n=4, lift=0.0):
    """An octagon about the axis (apothem a, flats top and bottom, the top flat raised `lift`), its corners rounded t
    along each edge: (r, z) points, n + 1 per corner."""
    R = a / K
    v = [(R * math.cos(math.pi / 8 + k * math.pi / 4), zc + R * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)]
    v[1], v[2] = (v[1][0], v[1][1] + lift), (v[2][0], v[2][1] + lift)
    side = R * 2 * math.sin(math.pi / 8)
    out = []
    for k in range(8):
        p, c, q = v[k - 1], v[k], v[(k + 1) % 8]
        e0 = [c[j] + (p[j] - c[j]) * t / side for j in (0, 1)]
        e1 = [c[j] + (q[j] - c[j]) * t / side for j in (0, 1)]
        for i in range(n + 1):
            u = i / n
            out.append(tuple((1 - u) ** 2 * e0[j] + 2 * u * (1 - u) * c[j] + u * u * e1[j] for j in (0, 1)))
    return out


def _lerp(p, q, f):
    return (p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f)


def _inset(zc, p, dd):
    """p moved dd in toward the axis."""
    r, z = p[0], p[1] - zc
    ln = math.hypot(r, z)
    return (r * (ln - dd) / ln, zc + z * (ln - dd) / ln)


def _band_pieces(pk, pk1, qk, qk1, cuts):
    """A level band (inner edge pk..pk1, outer qk..qk1, r falling from k to k1) cut at the r values `cuts`:
    [(inner a, outer a, outer b, inner b, r mid)]."""
    def at(p0, p1, r):
        t = (r - p0[0]) / (p1[0] - p0[0])
        return (r, p0[1] + (p1[1] - p0[1]) * t)
    xs = [x for x in sorted(cuts, reverse=True) if pk1[0] < x < pk[0] and qk1[0] < x < qk[0]]
    ins, outs = [pk] + [at(pk, pk1, x) for x in xs] + [pk1], [qk] + [at(qk, qk1, x) for x in xs] + [qk1]
    return [(ins[j], outs[j], outs[j + 1], ins[j + 1], (outs[j][0] + outs[j + 1][0]) / 2) for j in range(len(ins) - 1)]


def ring(rot, band=0.62):
    """The clamp ring: an octagon round the collar's tube, corners rounded, the back edge chamfered, the top flat
    taller. A joint cut at each corner across the front and round the rim; the rib's grooves carried across the top
    flat and out through its front edge; a red band on the top flat's front (outside `band`); a bolt mid each flat."""
    return _blue(lambda: _ring(rot, band))


def _ring(rot, band):
    zc, a_in, a_out = _ring_dims()
    b = _B(rot, "airlock_clamp_ring")
    t = 0.09
    o, os_, i = (_rounded(zc, a_out, t, lift=TOP), _rounded(zc, a_out - CH, t * (a_out - CH) / a_out, lift=TOP),
                 _rounded(zc, a_in, t * a_in / a_out))
    n = len(o)
    tcuts = sorted({x + e for x in LINES for e in (-GW / 2, GW / 2)})
    in_groove = lambda r: any(abs(r - x) < GW / 2 for x in LINES)  # noqa: E731
    F = (1, 0, 0)
    joint = lambda k: k % 5 in (1, 2)  # noqa: E731
    TF = 9                                                 # (the top flat's segment)
    for k in range(n):
        k1 = (k + 1) % n
        seam = joint(k)
        dep = DEP if seam else 0.0
        ok, ok1 = (_inset(zc, o[k], DEP), _inset(zc, o[k1], DEP)) if seam else (o[k], o[k1])
        sk, sk1 = (_inset(zc, os_[k], DEP), _inset(zc, os_[k1], DEP)) if seam else (os_[k], os_[k1])
        mr, mz = (ok[0] + ok1[0]) / 2, (ok[1] + ok1[1]) / 2 - zc
        for outer, (f0, f1) in ((False, (0, band)), (True, (band, 1))):          # (the front, in two bands)
            col = _groove(F, 5, k=1) if seam else "medRed" if (k == TF and outer) else HE.RAMP[5]
            pk, pk1, qk, qk1 = _lerp(i[k], ok, f0), _lerp(i[k1], ok1, f0), _lerp(i[k], ok, f1), _lerp(i[k1], ok1, f1)
            if k == TF and outer:                                                 # (the top grooves run out through it)
                for a0, a1, b1, b0, rm in _band_pieces(pk, pk1, qk, qk1, tcuts):
                    if in_groove(rm):
                        a1, b1 = (a1[0], a1[1] - DEP), (b1[0], b1[1] - DEP)
                    b.face([(D1, *a0), (D1, *a1), (D1, *b1), (D1, *b0)], F, col)
            else:
                b.face([(D1 - dep, *pk), (D1 - dep, *qk), (D1 - dep, *qk1), (D1 - dep, *pk1)], F, col)
        if seam != joint(k - 1):                                                  # (a joint's end walls)
            s = 1 if seam else -1
            nn = (0, s * (o[k1][0] - o[k][0]), s * (o[k1][1] - o[k][1]))
            oi, si = _inset(zc, o[k], DEP), _inset(zc, os_[k], DEP)
            b.face([(D1, *i[k]), (D1 - DEP, *i[k]), (D1 - DEP, *o[k]), (D1, *o[k])], nn)
            b.face([(D1, *o[k]), (D0 + CH, *o[k]), (D0, *os_[k]), (D0, *si), (D0 + CH, *oi), (D1 - DEP, *oi),
                    (D1 - DEP, *o[k])], nn)
        if k == TF:                                                               # (the top flat: its grooves)
            xs = [o[k][0]] + sorted(tcuts, reverse=True) + [o[k1][0]]
            for ra, rb in zip(xs, xs[1:]):
                cut = in_groove((ra + rb) / 2)
                z = o[k][1] - (DEP if cut else 0)
                b.face([(D1, ra, z), (D0 + CH, ra, z), (D0 + CH, rb, z), (D1, rb, z)], (0, 0, 1),
                       _groove((0, 0, 1)) if cut else None)
                if cut:
                    for r, s in ((ra, -1), (rb, 1)):
                        b.face([(D1, r, o[k][1]), (D1, r, z), (D0 + CH, r, z), (D0 + CH, r, o[k][1])], (0, s, 0))
        else:
            b.face([(D1 - dep, *ok), (D0 + CH, *ok), (D0 + CH, *ok1), (D1 - dep, *ok1)], (0, mr, mz),
                   _groove((0, mr, mz), k=1) if seam else None)
        b.face([(D0 + CH, *ok), (D0, *sk), (D0, *sk1), (D0 + CH, *ok1)], (-1, mr, mz),
               _groove((-1, mr, mz), k=1) if seam else None)
        b.face([(D0, *i[k]), (D0, *sk), (D0, *sk1), (D0, *i[k1])], (-1, 0, 0), HE.RAMP[0])
    for k in range(8):                                                            # (a bolt mid each flat)
        tt = math.pi / 4 * (k + 1)
        a = (a_in + a_out) / 2
        HE._box(b, D1, a * math.cos(tt), zc + a * math.sin(tt), 0.012)
    return [b.m.build()]


# ---- the rib and its clamp block ------------------------------------------------------------------------------------

def _resample(path, step):
    """The path at even arc-length steps, and the arc length at each."""
    out, ss, acc = [path[0]], [0.0], 0.0
    for a, b in zip(path, path[1:]):
        ln = math.hypot(b[0] - a[0], b[1] - a[1])
        m = max(1, round(ln / step))
        for i in range(1, m + 1):
            t = i / m
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            ss.append(acc + ln * t)
        acc += ln
    return out, ss


def _rib_path(a, zc, gap=0.02, start_deg=20, sm=0.12, k1=0.10, k2=0.08, top_run=0.2, end_d=-0.02):
    """The rib's centreline (d, z): off the ring's back at `a` nearly level, an elbow onto a line `gap` clear of the
    hull's slope, straight up it, then a bend level into the clamp block at height zc."""
    (p0, p1) = SLOPE
    ln = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    u = ((p1[0] - p0[0]) / ln, (p1[1] - p0[1]) / ln)
    n = (u[1], -u[0])
    off = gap + BT / 2
    b = (p0[0] + n[0] * off, p0[1] + n[1] * off)
    on = lambda s: (b[0] + u[0] * s, b[1] + u[1] * s)  # noqa: E731
    m, sc = on(sm), (zc - b[1]) / u[1]
    c, n2 = on(sc), on(sc - top_run)
    r = math.radians(start_deg)
    q1, q2 = (a[0] - math.cos(r) * k1, a[1] + math.sin(r) * k1), (m[0] - u[0] * k2, m[1] - u[1] * k2)
    p = [tuple((1 - t) ** 3 * a[j] + 3 * t * (1 - t) ** 2 * q1[j] + 3 * t * t * (1 - t) * q2[j] + t ** 3 * m[j]
               for j in (0, 1)) for t in (k / 8 for k in range(9))]
    p.append(n2)
    e = (end_d, zc)
    p += [tuple((1 - t) ** 2 * n2[j] + 2 * t * (1 - t) * c[j] + t * t * e[j] for j in (0, 1))
          for t in (k / 8 for k in range(1, 9))]
    return p


def _beam(rot, path, seams):
    """The rib: a rectangular beam along `path` (sections square to it), grooves at LINES along its top, its whole
    length, and at the arc lengths `seams` necked DEP on its top and sides."""
    path, ss = _resample(path, LW / 2)
    b = _B(rot, "airlock_rib")
    fr = []
    for k in range(len(path)):
        a, c = path[max(0, k - 1)], path[min(len(path) - 1, k + 1)]
        td, tz = c[0] - a[0], c[1] - a[1]
        ln = math.hypot(td, tz)
        nd, nz = -tz / ln, td / ln
        if nz < 0 or (abs(nz) < 1e-6 and nd < 0):
            nd, nz = -nd, -nz
        fr.append((nd, nz))
    P = lambda k, h, r: (path[k][0] + fr[k][0] * h, r, path[k][1] + fr[k][1] * h)  # noqa: E731
    cuts = sorted({-BW, BW} | {x + e for x in LINES for e in (-GW / 2, GW / 2)})
    nseg = len(path) - 1
    seam = [any(abs((ss[k] + ss[k + 1]) / 2 - x) < GW / 2 for x in seams) for k in range(nseg)]
    T, Bt = BT / 2, -BT / 2
    for k in range(nseg):
        nd, nz = fr[k]
        up, dn = (nd, 0, nz), (-nd, 0, -nz)
        if seam[k]:
            w = BW - DEP
            b.face([P(k, T - DEP, -w), P(k, T - DEP, w), P(k + 1, T - DEP, w), P(k + 1, T - DEP, -w)], up,
                   _groove(up, k=1))
            for sg in (1, -1):
                b.face([P(k, T - DEP, sg * w), P(k, Bt, sg * w), P(k + 1, Bt, sg * w), P(k + 1, T - DEP, sg * w)],
                       (0, sg, 0), _groove((0, sg, 0), k=1))
        else:
            for r0, r1 in zip(cuts, cuts[1:]):
                cut = any(abs((r0 + r1) / 2 - x) < 1e-6 for x in LINES)
                h = T - DEP if cut else T
                b.face([P(k, h, r0), P(k, h, r1), P(k + 1, h, r1), P(k + 1, h, r0)], up, _groove(up) if cut else None)
                if cut:
                    for r, nn in ((r0, (0, 1, 0)), (r1, (0, -1, 0))):
                        b.face([P(k, T, r), P(k, T - DEP, r), P(k + 1, T - DEP, r), P(k + 1, T, r)], nn)
            for sg in (1, -1):
                b.face([P(k, T, sg * BW), P(k, Bt, sg * BW), P(k + 1, Bt, sg * BW), P(k + 1, T, sg * BW)], (0, sg, 0))
        b.face([P(k, Bt, -BW), P(k, Bt, BW), P(k + 1, Bt, BW), P(k + 1, Bt, -BW)], dn)
    for k in range(1, nseg):                                                      # (the seams' end walls)
        if seam[k] != seam[k - 1]:
            j = k + 1 if seam[k] else k - 1
            b.face([P(k, T, -BW), P(k, T, BW), P(k, Bt, BW), P(k, Bt, -BW)],
                   (path[j][0] - path[k][0], 0, path[j][1] - path[k][1]))
    for k, k2 in ((0, 1), (len(path) - 1, len(path) - 2)):
        b.face([P(k, T, -BW), P(k, T, BW), P(k, Bt, BW), P(k, Bt, -BW)],
               (path[k][0] - path[k2][0], 0, path[k][1] - path[k2][1]))
    return b.m.build()


def _clip(prof, c, keep_below):
    """A convex (d, z) profile cut at z = c, the part below (or above) kept."""
    inside = (lambda p: p[1] <= c + 1e-9) if keep_below else (lambda p: p[1] >= c - 1e-9)
    out = []
    for a, b in zip(prof, prof[1:] + prof[:1]):
        if inside(a):
            out.append(a)
        if inside(a) != inside(b):
            t = (c - a[1]) / (b[1] - a[1])
            out.append((a[0] + (b[0] - a[0]) * t, c))
    return out


def _bolt_side(b, d, z, sg, w, h=0.012, s=0.03):
    """A bolt head standing h off a side face (r = sg * w), a tone lighter than it."""
    r0, r1 = (w, w + h) if sg > 0 else (-w - h, -w)
    b.prism([(r0, z - s), (r1, z - s), (r1, z + s), (r0, z + s)], d - s, d + s, along="d", col=HE.RAMP[4])


def _clamp(rot, prof, back, fd, R, w):
    """The clamp block as two jaws closed on the hull's top edge: a lower jaw on the slope and an upper over the top,
    a seam DEP deep between them; the rib's grooves along the upper jaw's top; a thin foot stepping back along the
    hull's top, bolted; two bolts through the jaws each side."""
    b = _B(rot, "airlock_clamp_block")
    zs, zg, zt = SEAM_Z, SEAM_Z + SEAM_G, TOP_Z + 0.2
    b.prism(_clip(prof, zs, True), -w, w)                                         # (the lower jaw)
    core_ = [(min(max(d, back + DEP), fd - DEP), z) for d, z in _clip(_clip(prof, zs, False), zg, True)]
    b.prism(core_, -w + DEP, w - DEP)                                             # (the seam)
    up = _clip(prof, zg, False)
    edge = next(j for j, (p, q) in enumerate(zip(up, up[1:] + up[:1])) if abs(p[1] - zt) < 1e-6 and abs(q[1] - zt) < 1e-6)
    b.prism(up, -w, w, skip=(edge,))                                              # (the upper jaw, its top below)
    xs = sorted({-w, w} | {x + e for x in LINES for e in (-GW / 2, GW / 2)})
    d0, d1 = back, fd - R
    for ra, rb in zip(xs, xs[1:]):
        cut = any(abs((ra + rb) / 2 - x) < 1e-6 for x in LINES)
        z = zt - (DEP if cut else 0)
        b.face([(d0, ra, z), (d1, ra, z), (d1, rb, z), (d0, rb, z)], (0, 0, 1), _groove((0, 0, 1)) if cut else None)
        if cut:
            for r, s in ((ra, 1), (rb, -1)):
                b.face([(d0, r, zt), (d0, r, z), (d1, r, z), (d1, r, zt)], (0, s, 0))
            b.face([(d1, ra, z), (d1, rb, z), (d1, rb, zt), (d1, ra, zt)], (-1, 0, 0))
    ft, fb = TOP_Z + 0.06, TOP_Z - 0.06                                           # (the foot: 2 px over the top)
    b.prism([(back - 0.17, fb), (back + 0.02, fb), (back + 0.02, ft), (back - 0.14, ft), (back - 0.17, ft - 0.03)],
            -w + 0.02, w - 0.02)
    for r in (-w + 0.07, w - 0.07):
        s = 0.025
        b.prism([(back - 0.085 - s, ft), (back - 0.085 + s, ft), (back - 0.085 + s, ft + 0.012), (back - 0.085 - s, ft + 0.012)],
                r - s, r + s, col=HE.RAMP[1])
    zb = (zg + zt - 0.02) / 2
    for sg in (1, -1):
        for d in (back + 0.09, back + 0.26):
            _bolt_side(b, d, zb, sg, w)
    return b.m.build()


def brace(rot):
    """The rib out of the ring's back, up clear of the hull's slope, into the clamp block on the hull's top edge."""
    return _blue(lambda: _brace(rot))


def _brace(rot):
    zc, _, a_out = _ring_dims()
    zt = zc + a_out + TOP                                 # (the ring's top)
    dr = SLOPE[1][0]                                      # (the top's front edge)
    fd, zin, drop = dr + 0.17, TOP_Z + 0.02, 3 / 39.2     # (the clamp's front; the rib's height into it; its foot down the slope)
    a = (D0 - 0.04, zt - 0.1)
    p = [(D0 + 0.08, zt - 0.13)] + _rib_path(a, zin, end_d=dr - 0.02)
    pts, ss = _resample(p, LW / 2)
    s_in = next(x for q, x in zip(pts, ss) if q[0] < fd)  # (where the rib enters the clamp)
    s_out = 0.16                                          # (clear of the ring)
    span = s_in - s_out
    beam = _beam(rot, p, (s_out + span / 3, s_out + 2 * span / 3))
    back, R = dr - 0.22 - 4 / 32, 0.1
    arc = [(fd - R + R * math.cos(t), TOP_Z + 0.2 - R + R * math.sin(t)) for t in (math.pi / 2 * k / 6 for k in range(7))]
    prof = [(back, TOP_Z - 0.06), (dr + 0.02, TOP_Z - 0.2 - drop), (fd, TOP_Z - 0.2 - drop)] + arc + [(back, TOP_Z + 0.2)]
    return [beam, _clamp(rot, prof, back, fd, R, BW + 2 / 32)]
