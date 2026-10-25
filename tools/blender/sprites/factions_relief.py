"""The faction looks' reliefs (factions.py): face layouts for the walls and the far hull after Space Haven's wall sets
(navy: set 4, drone: set 5, civil: set 6, bastion: set 8), and scrap's patch plates. Each layout has wall3d's face
signature; families: wall / blue (the look's wall / hull ramp), ochre (its trim), rose (its second tone)."""
import math

from mathutils import Vector

from . import wall3d as T
from .restyle import hashf

PX, PAINT, LINE = T.PX, T.PAINT, T.LINE


def body(hull):
    return "blue" if hull else "wall"


def glow(k, ax, plane, u0, u1, z0, z1, col, on=PAINT):
    """An emissive strip (palette name col) on a part standing `on` proud."""
    k.poly([T.P(ax, plane, u, z, on + PAINT) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], "wall", 0,
           T.OUT(ax), fixed=col)


def ALONG(ax):
    return Vector((1, 0, 0)) if ax == "y" else Vector((0, 1, 0))


def prism(k, ax, plane, u0, u1, prof, fam, lvl, cols=None, cap=None, mitre=(False, False)):
    """A part over [u0, u1] with a (d, z) cross-section (a convex polygon); cols: a fixed palette name per edge (edge
    i runs from prof[i] to prof[i + 1]), cap: one for its two ends. A mitred end (an outer corner at u0 / u1) runs on
    by each point's depth (times the mitre: True / 1 for a square corner, its diagonal; sqrt 2 - 1 for a 45-degree
    chamfer, the 135-degree joint's bisector), so it meets the next part."""
    o, up = T.OUT(ax), Vector((0, 0, 1))
    ua = [u0 - d * float(mitre[0]) for d, _ in prof]
    ub = [u1 + d * float(mitre[1]) for d, _ in prof]
    n = len(prof)
    dc, zc = sum(q[0] for q in prof) / n, sum(q[1] for q in prof) / n
    for i in range(n):
        (d0, z0), (d1, z1) = prof[i], prof[(i + 1) % n]
        pd, pz = z1 - z0, d0 - d1
        if pd * ((d0 + d1) / 2 - dc) + pz * ((z0 + z1) / 2 - zc) < 0:
            pd, pz = -pd, -pz
        j = (i + 1) % n
        k.poly([T.P(ax, plane, ua[i], z0, d0), T.P(ax, plane, ub[i], z0, d0), T.P(ax, plane, ub[j], z1, d1),
                T.P(ax, plane, ua[j], z1, d1)], fam, lvl, o * pd + up * pz, fixed=cols[i] if cols else None)
    for us, sg in ((ua, -1), (ub, 1)):
        k.poly([T.P(ax, plane, u, z, d) for u, (d, z) in zip(us, prof)], fam, lvl, ALONG(ax) * sg + o * 0.01, fixed=cap)


def tube(k, ax, plane, u0, u1, dc, zc, r, n=8):
    """A round lit tube along the face: a lit orange front line, plain orange round it, darker underneath."""
    prof = [(dc + r * math.cos(2 * math.pi * i / n + math.pi / n), zc + r * math.sin(2 * math.pi * i / n + math.pi / n))
            for i in range(n)]
    cols = []
    for i in range(n):
        s = math.sin(2 * math.pi * (i + 1) / n)
        c = math.cos(2 * math.pi * (i + 1) / n)
        cols.append("fxO" if c > 0.9 else "orL" if s > -0.2 else "orM")
    prism(k, ax, plane, u0, u1, prof, "wall", 0, cols, "or")


def bracket(k, ax, plane, u0, u1, dc, zc, rb, zlo, zhi, fam, lvl):
    """A rounded arm from the face out to a tube's axis, its underside angled back to the face."""
    arc = [(dc + rb * math.cos(math.radians(t)), zc + rb * math.sin(math.radians(t))) for t in (90, 45, 0, -45, -90)]
    prism(k, ax, plane, u0, u1, [(0.0, zhi)] + arc + [(0.0, zlo)], fam, lvl)


def cuts(a, b, off):
    """Seams `off` in from each tile edge, per tile part of [a, b] (as wall3d.skirt lays its plates)."""
    return [u for s0, s1 in T.spans(a, b) if s1 - s0 > 2 * off + 1e-3 for u in (s0 + off, s1 - off)]


def seams(a, b):
    """The tile seams strictly inside [a, b]."""
    return [c - 0.5 for c in range(-1, 3) if a + 1e-6 < c - 0.5 < b - 1e-6]


# ---- navy (set 4): light plates, a maroon band, a dark header carrying a round lit tube on rounded brackets --------

NAVY_SEAM = 0.24                    # the plate seams, in from each tile edge, up the face and down the ramp


def navy(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        T.run(k, ax, plane, a, b, ends, zs - 0.03, zs + 0.06, PAINT, F, 3, 0)
        H = top - zs
        zh = top - 0.25 * H if full else top                                                     # the header's foot
        for u in cuts(a, b, NAVY_SEAM):                                                          # plate seams
            T.paint(k, ax, plane, u - LINE / 2, u + LINE / 2, zs - 0.03, zh, PAINT, F, 1)
        if not full:
            return
        T.run(k, ax, plane, a, b, ends, zh, top - 0.02, PX, "rose", 1, 0)                       # the dark header
        zc, r, dc = top - 0.1, 0.055, PX + 0.055                                                 # the tube, high up
        bw = 0.1
        for s0, s1 in T.spans(a, b):
            lo = s0 + (0.05 if abs(s0 - a) < 1e-6 and ends[0] == "out" else 0.0)
            hi = s1 - (0.05 if abs(s1 - b) < 1e-6 and ends[1] == "out" else 0.0)
            for u0 in (lo, hi - bw):                                                             # the brackets
                bracket(k, ax, plane, u0, u0 + bw, dc, zc, 0.085, zc - 0.15, zc + 0.1, F, 4)
            tube(k, ax, plane, lo + bw, hi - bw, dc, zc, r)                                      # the tube
            if hi - lo > 0.5:                                                                    # a grille under it
                for i in range(4):
                    z = zh + 0.025 + i * 0.03
                    T.paint(k, ax, plane, hi - 0.3, hi - 0.12, z, z + 0.012, PX, F, 3)
        if ends[1] == "out":                                                 # round the corner: the tubes elbow
            tube(k, ax, plane, b - 0.05, b + dc + r, dc, zc, r)
        if ends[0] == "out":
            tube(k, ax, plane, a - dc - r, a + 0.05, dc, zc, r)
        T.run(k, ax, plane, a, b, ends, zh - 0.33 * H, zh, PAINT, "ochre", 3, 0)                # the maroon band
        if hull:
            for s0, s1 in T.spans(a, b):
                if s1 - s0 > 0.6 and variant:
                    uc = (s0 + s1) / 2
                    T.paint(k, ax, plane, uc - 0.1, uc + 0.1, zh - 0.3, zh - 0.06, 2 * PAINT, F, 4)
    return face


# ---- drone (set 5): a bright rail on top over a dark machinery band, a deep block over most of the wall (its top and
# foot sloping back to the wall, a column each side, a pull handle above and below), a short dark band over the ramp;
# the outer corner a narrow 45-degree channel cut in between the two blocks' ends, with a status-light column. The
# handles are dark pipes on stand-offs. ------------------------------------------------------------------------------

def handle(k, ax, plane, u0, u1, zc, d, r=0.03):
    """A pull handle: one smooth round bar out of the wall at u0, along d out, and back in at u1, its bends curved."""
    rr = min(d, 0.06)

    def W_(u, dd):
        return T.P(ax, plane, u, zc, dd)
    pts = bezier(W_(u0, -0.01), W_(u0, d), W_(u0 + rr, d), 6)
    pts += bezier(W_(u1 - rr, d), W_(u1, d), W_(u1, -0.01), 6)
    pipe(k, pts, r, "rose", 3, n=8)


DRONE_S = 7 / 32                    # the outer corner is cut off this far along each axis (on the shell's grid)
DRONE_E = DRONE_S                   # the faces' parts stop where the cut starts
DRONE_H = 0.006                     # the corner panel sits on the cut (just proud of the shell's own face there)


class CornerCut(T.Shell):
    """The shell with an outer corner cut off at 45 degrees (DRONE_S along each axis), for a corner face set back
    into the wall. The skirt keeps its square corner."""
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        for (x0, x1, y0, y1), fam, t, top in self.rects:
            adj_x = any(abs(o[0][0] - x1) < 1e-9 and o[0][2] < y1 and o[0][3] > y0 for o in self.rects)
            adj_y = any(abs(o[0][2] - y1) < 1e-9 and o[0][0] < x1 and o[0][1] > x0 for o in self.rects)
            if not adj_x and not adj_y and x1 < 0.5 - 1e-9 and y1 < 0.5 - 1e-9 and self.keep is None:   # (a
                # partition's outer corner or the far hull's)
                lim = T.snap(x1) + T.snap(y1) - DRONE_S + 1e-9     # (where the faces really stand)
                self.keep = lambda ci, cj: ci / T.W.GN - 0.5 + cj / T.W.GN - 0.5 <= lim
                self.diag = self.skirt_halves = True

    def drop_at(self, x, y):
        return 0.0

    def col_face(self, face, x, y, z):
        if face == "d":
            return T.RAMPS["wall"][0][2]
        return super().col_face(face, x, y, z)


def pipe(k, pts, r, fam, lvl, n=6, flat=None):
    """A round pipe along a horizontal polyline (one height), r its radius. flat = (top, sides): a thin pipe drawn
    square in section, its top one palette name and its sides another, so it reads as a clean lit line at the art's
    size (round facets each take their own shade and speckle)."""
    up = Vector((0, 0, 1))
    off = math.pi / n if flat else 0.0
    rings = []
    for i, p_ in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        side = t.cross(up).normalized()
        rings.append([p_ + (side * math.cos(2 * math.pi * j / n + off) + up * math.sin(2 * math.pi * j / n + off)) * r
                      for j in range(n)])
    for a_, b_, pa, pb in zip(rings, rings[1:], pts, pts[1:]):
        c = (pa + pb) / 2
        for j in range(n):
            q = [a_[j], b_[j], b_[(j + 1) % n], a_[(j + 1) % n]]
            o = sum(q, Vector()) / 4 - c
            k.poly(q, fam, lvl, o, fixed=(flat[0] if o.normalized().z > 0.5 else flat[1]) if flat else None)


def bezier(p0, p1, p2, n=8):
    return [p0 * (1 - t) ** 2 + p1 * 2 * t * (1 - t) + p2 * t * t for t in (i / n for i in range(n + 1))]


def chamfer(k, X, Y, e, h, zb, top, z1, F, D=0.0, zbox=None, black=True):
    """The corner channel: a 45-degree face from the y face's (X - e, Y + h) to the x face's (X + h, Y - e), set
    into the shell's cut corner (CornerCut), from the foot to the cap, its top the cap's black, carrying the status
    lights in a recessed terminal; zbox = (z0, z1, zband): a box standing out from it there, with two curved pipes
    from each of its sides to the blocks (D deep) that end beside the corner, and the faces' dark band below zband
    carried across it. t runs along it (-1 .. 1), d out of it."""
    r2 = 2 ** -0.5
    n, tang = Vector((r2, r2, 0)), Vector((r2, -r2, 0))
    cx, cy, wl = X + (h - e) / 2, Y + (h - e) / 2, (e + h) * r2

    def Q(t, z, d=0.0):
        return Vector((cx + t * wl * r2 + d * r2, cy - t * wl * r2 + d * r2, z))

    def box(t0, t1, z0_, z1_, d, fam, lvl, fixed=None):
        f = [Q(t0, z0_, d), Q(t1, z0_, d), Q(t1, z1_, d), Q(t0, z1_, d)]
        k.poly(f, fam, lvl, n, fixed=fixed)
        if d > 0.01:                                    # its top and foot; its ends face along the panel, edge
            bk = [Q(t0, z0_), Q(t1, z0_), Q(t1, z1_), Q(t0, z1_)]          # on to the camera, so they'd only alias
            for (i, j), o in (((3, 2), Vector((0, 0, 1))), ((0, 1), Vector((0, 0, -1)))):
                k.poly([f[i], f[j], bk[j], bk[i]], fam, lvl, o + n * 0.01, fixed=fixed)
    s_ = e - h
    pl = [(X - e, Y + h), (X + h, Y - e), (X, Y - e), (X, Y - s_), (X - s_, Y), (X - e, Y)]   # its body in plan
    if black:                                           # the cap's black, square over the cut like the rest of the
        k.poly([Vector((X - e, Y, top)), Vector((X, Y, top)), Vector((X, Y - e, top))], F, 3, Vector((0, 0, 1)),
               fixed="wK")                              # top (the far hull's armour plates already cover its cut)
    k.poly([Vector((x, y, zb)) for x, y in pl], F, 3, Vector((0, 0, -1)))
    zl = zb - 0.02 + PAINT                              # the skirt's flat top left in the cut, in the foot gap's dark
    k.poly([Vector((X - e, Y, zl)), Vector((X, Y, zl)), Vector((X, Y - e, zl))], "ochre", 1, Vector((0, 0, 1)))
    box(-1, 1, zb, top, 0.0, F, 2)                                                   # the channel's face
    box(-1, 1, top - 0.02, top, PAINT, F, 0)                     # the faces' dark line under the top, carried across
    if zbox:
        box(-1, 1, zb, zb + 0.05, PAINT, "ochre", 1)                                 # the faces' dark foot gap and
        box(-1, 1, zb + 0.05, zbox[2], PAINT, "rose", 2)                             # band, on round the corner
        bz0, bz1, bd = zbox[0], zbox[1], 3 * PX
        box(-0.5, 0.5, bz0, bz1, bd, F, 3)                                           # the box
        for z in (bz0 + 0.035, bz1 - 0.035):                                         # its pipes
            for sg in (-1, 1):
                p0, d1 = Q(0.5 * sg, z, bd * 0.5), tang * sg    # out of the box's side, along the panel ...
                if sg < 0:                                      # ... then one smooth bend into the block's end
                    p2, d2 = Vector((X - e - 0.02, Y + D * 0.55, z)), Vector((-1, 0, 0))
                else:
                    p2, d2 = Vector((X + D * 0.55, Y - e - 0.02, z)), Vector((0, -1, 0))
                a_ = ((p2 - p0).cross(d2)).z / d1.cross(d2).z   # the two runs' meeting point
                cn = p0 + d1 * a_
                rr = 0.6 * min(a_, (p2 - cn).length)
                pipe(k, [p0] + bezier(cn - d1 * rr, cn, cn + d2 * rr, 8) + [p2], 0.02, "rose", 2, n=4,
                     flat=(T.RAMPS["rose"][0][4], T.RAMPS["rose"][0][2]))
    t0, t1, p0_, p1_, fd = -0.45, 0.45, z1 - 0.24, z1 + 0.12, 0.75 * PX             # the terminal, in a recess: a
    for q in ((-0.64, t0, p0_ - 0.04, p1_ + 0.04), (t1, 0.64, p0_ - 0.04, p1_ + 0.04),        # frame standing round
              (t0, t1, p1_, p1_ + 0.04), (t0, t1, p0_ - 0.04, p0_)):                          # it, its floor dark
        box(q[0], q[1], q[2], q[3], fd, F, 3)
    box(t0, t1, p0_, p1_, PAINT, F, 1)
    for i, col in enumerate(("green", "green", "flameY", "red")):                    # its status lights
        zc = z1 + 0.05 - i * 0.065
        box(-0.22, 0.22, zc - 0.016, zc + 0.016, 2 * PAINT, F, 0, fixed=col)


def drone(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        zb = zs + 0.02
        corner = full and ends[1] == "out"
        D, c, e = 2.5 * PX, 2.5 * PX, DRONE_E               # the block's depth, its slopes' run, the channel's reach
        # how each end's parts meet the next face: an outer corner on its diagonal (1), an inner corner on its own
        # diagonal (-1: a part runs short by its depth, so the two faces' blocks and rails meet in a clean mitre)
        mit = [{"out": 1.0, "in": -1.0}.get(x, 0.0) for x in ends]
        if corner:                                          # stop short of the corner channel
            b, ends, mit[1] = b - e, (ends[0], "in"), 1.0
        T.run(k, ax, plane, a, b, ends, zb, zb + 0.05, PAINT, "ochre", 1, 0)                    # dark gap at the foot
        if not full:
            return
        H = T.W.wall_top("wall", "up") - zs              # laid out on a partition's height, on every wall (the far
        z0, z1 = zs + 0.11 * H, zs + 0.68 * H           # hull's extra height goes to its band under the rail), so
                                                        # blocks, handles and bands line up where walls meet
        T.run(k, ax, plane, a, b, ends, zb + 0.05, z0, PAINT, "rose", 2, 0)                     # the short dark band
        rt = min(top, T.W.wall_top("wall", "up"))       # the rail at a partition's top on every wall; the far
        if top > rt + 0.03:                             # hull's extra height above it a plain plate
            T.run(k, ax, plane, a, b, ends, rt, top - 0.02, PAINT, F, 2, 0)
        T.run(k, ax, plane, a, b, ends, z1, rt - 0.12, PAINT, "rose", 1, 0)                     # the machinery band
        rail = [(0.0, rt - 0.12), (2 * PX, rt - 0.12), (2 * PX, rt - 0.02), (0.0, rt - 0.02)]
        ra, rb, rm = a, b, list(mit)                    # the top rail; over a lower wall meeting an inner end (a
        for i, tt in enumerate(T.END_TOPS):             # partition at the far hull) it runs on over its top to meet
            if tt is not None and tt < rt - 0.12 - 1e-6 and not (i == 1 and corner):    # the rail from the other side
                rm[i] = 0.0
                if i == 0:
                    ra -= T.W.TW / 2
                else:
                    rb += T.W.TW / 2
        prism(k, ax, plane, ra, rb, rail, F, 3, mitre=tuple(rm))
        if corner and ax == "y":                                                                 # (on round the cut)
            corner_piece(k, b + e, plane, e, [(-0.02, rt - 0.12)] + rail[1:3] + [(-0.02, rt - 0.02)], F, 3)
        for s0, s1 in T.spans(a, b):
            uc = (s0 + s1) / 2
            at0, at1 = abs(s0 - a) < 1e-6 and ends[0] != "cont", abs(s1 - b) < 1e-6 and ends[1] != "cont"
            in0, in1 = at0 and ends[0] == "in", at1 and ends[1] == "in" and not corner
            if s1 - s0 > 0.3:
                if not (in0 and uc - 0.1 < a + 0.25) and not (in1 and uc + 0.1 > b - 0.25):   # (clear of the
                    T.slab(k, ax, plane, uc - 0.1, uc + 0.1, rt - 0.15, rt - 0.01, 3 * PX, F, 4)     # other face) its
                                                                                         # centre block

            h0, h1 = s0 + (0.0 if at0 else 0.03), s1 - (0.0 if at1 else 0.03)
            if h1 - h0 < 0.25:
                continue
            hc = (h0 + h1) / 2
            m0, m1 = (mit[0] if at0 else 0.0), (mit[1] if at1 and not corner else 0.0)
            sides = T.RAMPS[F][1 if ax == "y" else 0]               # its ends a shade darker than they'd light
            prism(k, ax, plane, h0, h1, [(0.0, z0), (D, z0 + c), (D, z1 - c), (0.0, z1)], F, 2,
                  mitre=(m0, m1), cap=sides[1])                                                  # the block
            Dc = D + 0.5 * PX
            lift = 0.5 * PX * math.hypot(c, D) / D          # the columns stand proud of the block's front and of its
            col = [(0.0, z0 - lift), (Dc, z0 - lift + c * Dc / D),         # sloped top and foot alike (raised
                   (Dc, z1 + lift - c * Dc / D), (0.0, z1 + lift)]          # strips carried up the slopes)
            o0, o1 = (Dc if m0 < 0 else 0.0), (Dc if m1 < 0 else 0.0)   # an inner mitre eats a part's depth: the
            for u0, u1, mt in ((h0, h0 + 0.12 + o0, (m0, 0.0)), (h1 - 0.12 - o1, h1, (0.0, m1))):   # columns widen
                prism(k, ax, plane, u0, u1, col, F, 3, mitre=mt, cap=sides[1])                   # its two columns
            f0, f1 = z0 + c, z1 - c                                                              # its front
            q0, q1 = h0 + o0, h1 - o1                           # (the front clear of the other face there)
            T.paint(k, ax, plane, q0 + 0.14, q1 - 0.14, f1 - 0.16, f1 - 0.04, D, "rose", 1)      # a dark recess ...
            for u in (q0 + 0.18, (q0 + q1) / 2 - 0.04, q1 - 0.26):
                T.slab(k, ax, plane, u, u + 0.08, f1 - 0.13, f1 - 0.07, Dc, F, 3)                # ... with parts in it
            hw = (h1 - h0) / 2 - 0.07
            g0 = max(hc - hw, a + Dc + 0.05) if at0 and ends[0] == "in" else hc - hw     # (clear of the other
            g1 = min(hc + hw, b - Dc - 0.05) if at1 and ends[1] == "in" and not corner else hc + hw   # face's block)
            if not (corner and abs(s1 - b) < 1e-6) and g1 - g0 > 0.15:  # (none on the corner's tile)
                handle(k, ax, plane, g0, g1, z1 + 0.12, 2 * PX)                                  # pull handles above
                handle(k, ax, plane, g0, g1, z0 - 0.065, 2 * PX)                                 # and below it
            if hull and variant:                                # the variant: a small recessed status panel
                pc, pw, r0, r1 = (q0 + q1) / 2, 0.13, f0 + 0.05, f0 + 0.19
                for v0, v1, w0, w1 in ((pc - pw - 0.03, pc - pw, r0 - 0.03, r1 + 0.03),
                                       (pc + pw, pc + pw + 0.03, r0 - 0.03, r1 + 0.03),
                                       (pc - pw, pc + pw, r1, r1 + 0.03), (pc - pw, pc + pw, r0 - 0.03, r0)):
                    T.slab(k, ax, plane, v0, v1, w0, w1, D + 0.5 * PX, F, 3)                     # its frame
                T.paint(k, ax, plane, pc - pw, pc + pw, r0, r1, D, "rose", 1)                    # its dark floor
                for i, col in enumerate(("green", "flameY", "red")):                             # its lights
                    uu = pc - 0.08 + i * 0.08
                    glow(k, ax, plane, uu - 0.022, uu + 0.022, r1 - 0.07, r1 - 0.035, col, D + PAINT)
        if corner and ax == "y":                            # the corner channel, once (the y face's end is the corner)
            chamfer(k, b + e, plane, e, DRONE_H, zb, top, z1, F, D + 0.5 * PX, (z0 + c, z0 + c + 0.14, z0),
                    black=not hull)
    return face


# ---- civil (set 6): white drawers flush with the wall, only their seams cut in; a colour band under the cap and
# along the skirt's foot ----------------------------------------------------------------------------------------------

def civil(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        T.run(k, ax, plane, a, b, ends, zs - 0.03, zs + 0.05, PAINT, F, 4, 0)
        if not full:
            return
        zh = top - 0.13 * (top - zs)
        T.run(k, ax, plane, a, b, ends, zh, top - 0.02, PX, "ochre", 3, 0)                      # the colour band ...
        T.run(k, ax, plane, a, b, ends, top - 0.045, top - 0.02, PX + PAINT, "ochre", 4, 0)     # ... lit on top,
        T.run(k, ax, plane, a, b, ends, zh, zh + 0.025, PX + PAINT, "ochre", 2, 0)             # ... dark below
        for s0, s1 in T.spans(a, b):
            if s1 - s0 < 0.3:
                continue
            f0, f1, g0, g1 = s0 + 0.07, s1 - 0.07, zs + 0.12, zh - 0.06
            for q in ((f0, f1, g0, g0 + 0.026), (f0, f1, g1 - 0.026, g1), (f0, f0 + LINE, g0, g1),
                      (f1 - LINE, f1, g0, g1)):
                T.paint(k, ax, plane, q[0], q[1], q[2], q[3], 0.0, "rose", 2)                   # the frame's seam
            for z in (g0 + 0.2, g1 - 0.2):
                for u in (f0, f1 - LINE):
                    T.paint(k, ax, plane, u - LINE, u + 2 * LINE, z - 0.013, z + 0.013, PAINT, "rose", 2)  # ticks
            n = 3 if hull else 2
            h = (g1 - g0) / n
            uc = (f0 + f1) / 2
            for i in range(n):                                                                  # the drawers: a seam
                z0 = g0 + i * h                                                                 # between them
                if i:
                    T.paint(k, ax, plane, f0 + LINE, f1 - LINE, z0 - 0.013, z0 + 0.013, 0.0, "rose", 2)
                T.paint(k, ax, plane, uc - 0.09, uc + 0.09, z0 + h - 0.2, z0 + h - 0.09, 0.0, "rose", 1)   # handle:
                for z in (z0 + h - 0.175, z0 + h - 0.125):                                      # light lines on dark
                    T.paint(k, ax, plane, uc - 0.07, uc + 0.07, z, z + 0.026, PAINT, F, 5)
                T.paint(k, ax, plane, uc - 0.013, uc + 0.013, z0 + h - 0.27, z0 + h - 0.245, 0.0, "rose", 1)  # lock
    return face


# ---- bastion (set 8): slate armour; a heavy cornice at the wall's line, the rest of the wall (posts at each tile edge,
# a lower wall) set back a cell from it so the ramp shows a lip, the face between the posts cut in further from a
# sloped foot up to the cornice (its detail comes later). An outer corner is chamfered through: the cornice, the lower
# wall, the slope and the recess itself each turn the corner on a 45-degree face, with no post there. ---------------

BAST_L = 2 / 32                     # the lip: the wall below the cornice stands this far back from the ramp's edge
BAST_R = 2 / 32                     # how far the recess is cut in behind that (two of the shell's cells)
BAST_P = T.STILE + 1 / 32           # a post's width
BAST_K = 1 / 32                     # how far the cornice stands out past the wall's line
BAST_C = 5 / 32                     # the corner chamfer's width along each axis, at the wall's line
BAST_CR = BAST_C                    # ... the shell's own corner cut behind the recess (the same chamfer, set back)
BAST_CS = BAST_C                    # ... and the ramp's: every chamfer on the corner spans the same screen columns
EPS = 0.002
R2 = 2 ** -0.5


class Recessed(T.Shell):
    """The shell with its camera-facing faces set back by BAST_R: the cornice, posts and lower wall then stand at the
    wall's line and the face between them is cut in. The skirt, the face planes and the ends keep the wall's line
    (they read self.rects); only the covered cells (the body and its cap) shrink, and an outer corner of the body is
    cut off at 45 degrees (BAST_CR along each axis), so the recess turns the corner on a chamfer; the ramp and its lip
    turn the same corner on their own 45-degree face (BAST_CS)."""
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        R = BAST_L + BAST_R
        body = []
        corner = None
        for (x0, x1, y0, y1), fam, t, top in self.rects:
            adj_x = any(abs(o[0][0] - x1) < 1e-9 and o[0][2] < y1 and o[0][3] > y0 for o in self.rects)
            adj_y = any(abs(o[0][2] - y1) < 1e-9 and o[0][0] < x1 and o[0][1] > x0 for o in self.rects)
            cx, cy = not adj_x and x1 < 0.5 - 1e-9, not adj_y and y1 < 0.5 - 1e-9
            body.append(((x0, x1 - (R if cx else 0), y0, y1 - (R if cy else 0)), fam, t, top))
            if cx and cy and fam == "wall":
                corner = (x1 - R, y1 - R)
                self.line = (x1, y1)                    # the wall's line at the corner
        self.body = body
        if corner and self.keep is None:
            lim = corner[0] + corner[1] - BAST_CR + 1e-9
            self.keep = lambda ci, cj: ci / T.W.GN - 0.5 + cj / T.W.GN - 0.5 <= lim
            self.diag = True

    def drop_at(self, x, y):
        return 0.0

    line = None

    def _cdist(self, x, y):
        """(distance from the wall's line with the corner chamfered, its rect, on the chamfer?). The chamfer is a band
        of constant width running straight out from the corner (its edges parallel, along x = y), so its slope is
        gentler than the faces' and meets them along those edges: its distance is (dx + dy + a) / 2."""
        d, r = self._dist(x, y)
        if self.line is None:
            return d, r, False
        c = (x - self.line[0] + y - self.line[1] + BAST_CS) / 2
        return (c, r, True) if c > d + 1e-9 else (d, r, False)

    def skirtz(self, x, y):
        return self.zs * max(0.0, 1.0 - self._cdist(x, y)[0] / self.run)

    def _body_at(self, x, y):
        for r in self.body:
            x0, x1, y0, y1 = r[0]
            if x0 < x < x1 and y0 < y < y1:
                return r
        return None

    def cover(self, i, j):
        cx, cy = (i + 0.5) / T.W.GN - 0.5, (j + 0.5) / T.W.GN - 0.5
        if not self._body_at(cx, cy):
            return None
        return T.W.half_cell(self.keep, i, j) if self.keep else "f"

    def cell_top(self, i, j):
        r = self._body_at((i + 0.5) / T.W.GN - 0.5, (j + 0.5) / T.W.GN - 0.5)
        return r[3] if r else None

    def col_skirt(self, i, j, kind, x, y):              # the lip lit; the joints at the ramp's top the same on both
        d, r, ch = self._cdist(x, y)                    # faces (the default leaves the +x one black); the chamfer a
        fam = "blue" if r[1] == "hull" else "wall"      # plain plate (no plates are laid on it)
        if d < 1e-9:
            return T.RAMPS[fam][0][4]
        R = T.RAMPS[fam][1 if kind == "x" else 0]
        if d >= self.run - 1 / 32:
            return R[0]
        return R[1]

    def col_face(self, face, x, y, z):                  # the cut face: the wall's own tone
        e = 0.5 / T.W.GN
        r = self._rect_at(x, y - e) if face == "y" else self._rect_at(x - e, y)
        return T.RAMPS["blue" if r and r[1] == "hull" else "wall"][1 if face == "x" else 0][2]


def corner_piece(k, X, Y, C, prof, fam, lvl):
    """A face part's profile ((d, z): d out from the wall's line) carried round an outer corner chamfered C along each
    axis: each point runs from (X - C + d, Y + d) on the y face to (X + d, Y - C + d) on the x face. So every
    chamfer on the corner, at any depth, has the same width and the same two edges on screen (the joints run along
    x = y, straight at the camera), and it meets the faces' parts (prism with mitre=True at u = X - C)."""
    n_, up = Vector((R2, R2, 0)), Vector((0, 0, 1))
    J1 = [Vector((X - C + d, Y + d, z)) for d, z in prof]
    J2 = [Vector((X + d, Y - C + d, z)) for d, z in prof]
    m = len(prof)
    dc, zc = sum(q[0] for q in prof) / m, sum(q[1] for q in prof) / m
    for i in range(m):
        j = (i + 1) % m
        (d0, z0), (d1, z1) = prof[i], prof[j]
        pd, pz = z1 - z0, d0 - d1
        if pd * ((d0 + d1) / 2 - dc) + pz * ((z0 + z1) / 2 - zc) < 0:
            pd, pz = -pd, -pz
        k.poly([J1[i], J2[i], J2[j], J1[j]], fam, lvl, n_ * pd + up * pz)
    k.poly(J1, fam, lvl, Vector((-1, 0, 0)))
    k.poly(J2, fam, lvl, Vector((0, -1, 0)))


def bastion(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        H = top - zs
        R, C, L, PW = BAST_R, BAST_C, BAST_L, BAST_P
        d0 = -(L + R) + EPS                             # the parts fill the cut from the recessed face out to the lip
        dl = -L                                         # (the cornice to the wall's line)
        out = full and ends[1] == "out"
        bb = b - C if out else b                        # the chamfer takes over at an outer corner, on a joint
        mt = (False, out)                               # straight at the camera

        def band(u0, u1, z0, z1, lvl, cap=None, front=dl, m=(False, False)):
            prism(k, ax, plane, u0, u1, [(d0, z0), (front, z0), (front, z1), (d0, z1)], F, lvl, cap=cap, mitre=m)
        zlo = zs + (0.08 if full else 0.3)                                                       # the lower wall's top
        zlo = min(zlo, top - 0.02)
        band(a, bb, zs, zlo, 3, m=mt)                                                            # the lower wall
        if not full:
            band(a, bb, zlo, top, 3)
            return
        zsl = zlo + 0.12 * H                                                                     # the slope's top
        zc0 = top - 0.21
        band(a - (BAST_K if ends[0] == "out" else 0.0), bb, zc0, top - 0.02, 3, front=BAST_K, m=mt)  # the cornice
        for s0, s1 in T.spans(a, b):
            for u in (s0 + 0.1, s1 - 0.1 - LINE):
                if s1 - s0 > 0.5 and u + LINE < bb:
                    T.paint(k, ax, plane, u, u + LINE, zc0, top - 0.02, BAST_K, F, 1)            # ... its joints
            for lo, edge in ((True, s0), (False, s1)):           # the posts: the first shows its side too, so
                if not lo and out and abs(edge - b) < 1e-6:      # it is narrower by the depth, and the two read
                    continue                                     # the same width; none at a chamfered corner
                q0, q1 = (max(edge, a), edge + PW - R) if lo else (edge - PW, min(edge, bb))
                if q1 - q0 > 1e-6:
                    band(q0, q1, zlo, zc0, 3, cap="wD")                                          # (dark inner walls)
            corner = out and abs(s1 - b) < 1e-6
            f0, f1 = s0 + PW - R, bb if corner else min(s1 - PW, bb)
            if f1 - f0 < 0.1:
                continue
            prism(k, ax, plane, f0, f1, [(d0 + EPS, zlo), (dl, zlo), (d0 + EPS, zsl)], F, 3,
                  mitre=mt if corner else (False, False))                                        # the slope into it
        if out and ax == "y":                           # round the chamfer, once (the corner is the y face's end):
            X, Y = b, plane                             # the same parts, their backs sunk into the shell's cut corner
            db = -(L + R) - 0.03
            run_ = T.W.skirt_run()                      # the ramp's chamfer: a plate flush with the faces' plates,
            sl = Vector((1, 1, -2 * zs / run_))         # between the same top joint and foot (the chamfer's slope
            nrm = Vector((-1, 1, 0)).cross(sl).normalized()   # is gentler: it falls along both axes at once)
            if nrm.z < 0:
                nrm = -nrm

            def pt(u, dd, rise):
                return Vector((X - C + dd + u * C, Y + dd - u * C, zs * (1 - dd / run_))) + nrm * rise
            T.plate(k, [(0.0, 0.02), (1.0, 0.02), (1.0, run_ - 0.045), (0.0, run_ - 0.045)], pt, nrm, 0.0, PAINT,
                    F, 1)
            corner_piece(k, X, Y, C, [(db, zs), (dl, zs), (dl, zlo), (db, zlo)], F, 3)              # lower wall
            corner_piece(k, X, Y, C, [(db, zlo), (dl, zlo), (d0 + EPS, zsl), (db, zsl)], F, 3)      # the slope (its
            # face the faces' own, so its edges meet theirs; only its hidden back is sunk)
            corner_piece(k, X, Y, C, [(db, zc0), (BAST_K, zc0), (BAST_K, top - 0.02), (db, top - 0.02)], F, 3)
    return face


# ---- scrap: the default layout with mismatched bolted patch plates -------------------------------------------------

def scrap(hull, seed):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        (T.hull_face if hull else T.wall_face)(k, ax, plane, a, b, ends, zs, top, full, *((variant,) if hull else ()))
        F = body(hull)
        hi = top - 0.2 if full else top
        for s0, s1 in T.spans(a, b):
            h = lambda *x: hashf(seed, round(s0, 3), ax, *x)   # noqa: E731
            for n in range(1 + (h("n") > 0.6)):
                if h(n, "skip") < 0.2 or s1 - s0 < 0.4:
                    continue
                w = (0.3 + 0.35 * h(n, "w")) * (s1 - s0)
                ht = (0.2 + 0.35 * h(n, "h")) * (hi - zs)
                u0 = s0 + 0.05 + (s1 - s0 - w - 0.1) * h(n, "u")
                z0 = zs + 0.05 + (hi - zs - ht - 0.05) * h(n, "z")
                pf = ("ochre", F, "rose")[int(h(n, "f") * 3)]
                d = 2 * PX + PAINT * n
                T.slab(k, ax, plane, u0, u0 + w, z0, z0 + ht, d, pf, 2 + (h(n, "l") > 0.5))
                for cu in (u0 + 0.03, u0 + w - 0.03):
                    for cz in (z0 + 0.03, z0 + ht - 0.03):
                        T.paint(k, ax, plane, cu - LINE / 2, cu + LINE / 2, cz - 0.013, cz + 0.013, d, pf, 4)
    return face
