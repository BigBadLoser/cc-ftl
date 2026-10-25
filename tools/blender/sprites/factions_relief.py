"""The faction looks' reliefs (factions.py): face layouts for the walls and the far hull after Space Haven's wall sets
(navy: set 4, drone: set 5, civil: set 6, bastion: set 8), and scrap's patch plates. Each layout has wall3d's face
signature; families: wall / blue (the look's wall / hull ramp), ochre (its trim), rose (its second tone)."""
import math

from mathutils import Vector

from . import factions_variants as FV
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


def tube_prof(dc, zc, r, n=8):
    """A round lit tube's section and its edge colours: a lit orange front line, plain orange round it, darker
    underneath."""
    prof = [(dc + r * math.cos(2 * math.pi * i / n + math.pi / n), zc + r * math.sin(2 * math.pi * i / n + math.pi / n))
            for i in range(n)]
    cols = []
    for i in range(n):
        s = math.sin(2 * math.pi * (i + 1) / n)
        c = math.cos(2 * math.pi * (i + 1) / n)
        cols.append("fxO" if c > 0.9 else "orL" if s > -0.2 else "orM")
    return prof, cols


def tube(k, ax, plane, u0, u1, dc, zc, r, n=8, mitre=(0.0, 0.0)):
    """A round lit tube along the face (tube_prof)."""
    prof, cols = tube_prof(dc, zc, r, n)
    prism(k, ax, plane, u0, u1, prof, "wall", 0, cols, "or", mitre=mitre)


def bracket(k, ax, plane, u0, u1, dc, zc, rb, zlo, zhi, fam, lvl, cap=None):
    """An arm from the face out over a tube, rounded over its top, its front straight down a little past the axis and
    its underside flat back to the face (any facet turned down toward the camera meets it near edge-on and breaks
    into specks at the art's size). zlo is unused."""
    arc = [(dc + rb * math.cos(math.radians(t)), zc + rb * math.sin(math.radians(t))) for t in (90, 45, 0)]
    zb = zc - 0.4 * rb
    prism(k, ax, plane, u0, u1, [(0.0, zhi)] + arc + [(dc + rb, zb), (0.0, zb)], fam, lvl, cap=cap)


def cuts(a, b, off):
    """Seams `off` in from each tile edge, per tile part of [a, b] (as wall3d.skirt lays its plates)."""
    return [u for s0, s1 in T.spans(a, b) if s1 - s0 > 2 * off + 1e-3 for u in (s0 + off, s1 - off)]


def seams(a, b):
    """The tile seams strictly inside [a, b]."""
    return [c - 0.5 for c in range(-1, 3) if a + 1e-6 < c - 0.5 < b - 1e-6]


# ---- navy (set 4): light plates, a maroon band, a dark header carrying a round lit tube on rounded brackets --------

NAVY_SEAM = 0.24                    # the plate seams, in from each tile edge, up the face and down the ramp


NAVY_C = 3 / 32                     # a partition's outer corner: chamfered this far along each axis, wall and ramp


OPP = {"+x": "-x", "-x": "+x", "+y": "-y", "-y": "+y"}


class FreeEnds:
    """A shell mixin: a partition's free ends ("+x" | "-x" | "+y" | "-y", plane: a free side with an arm opposite and
    none beside it), where the wall stops square: no ramp past it (skip_skirt), the ramps beside it cut square
    (wall3d.skirt reads is_end) and no ramp across its end face (end_face)."""
    end_sides = ()

    def find_ends(self):
        self.end_sides = []
        for r in self.rects:
            x0, x1, y0, y1 = r[0]
            pl = {"+x": x1, "-x": x0, "+y": y1, "-y": y0}
            for sd in pl:
                perp = ("+y", "-y") if sd[1] == "x" else ("+x", "-x")
                if (r[1] == "wall" and abs(pl[sd]) < 0.5 - 1e-9 and not self._adj(r, sd)
                        and self._adj(r, OPP[sd]) and not any(self._adj(r, q) for q in perp)):
                    self.end_sides.append((sd, T.snap(pl[sd])))

    def _adj(self, r, sd):
        """Does another rect touch r's side sd?"""
        x0, x1, y0, y1 = r[0]
        for o in self.rects:
            ox0, ox1, oy0, oy1 = o[0]
            if o is r:
                continue
            if sd[1] == "x" and oy0 < y1 and oy1 > y0 and abs((ox0 - x1) if sd[0] == "+" else (ox1 - x0)) < 1e-9:
                return True
            if sd[1] == "y" and ox0 < x1 and ox1 > x0 and abs((oy0 - y1) if sd[0] == "+" else (oy1 - y0)) < 1e-9:
                return True
        return False

    def is_end(self, ax, u, side):
        """Does a face along ax end at u (its low end: side -1) on a wall's free end?"""
        sd = ("+" if side > 0 else "-") + ("x" if ax == "y" else "y")
        return any(s == sd and abs(p - u) < 1e-6 for s, p in self.end_sides)

    def end_face(self, ax, plane):
        return any(s == "+" + ax and abs(p - plane) < 1e-6 for s, p in self.end_sides)

    def skip_skirt(self, i, j):                         # no ramp past a wall's end
        c = {"x": (i + 0.5) / T.W.GN - 0.5, "y": (j + 0.5) / T.W.GN - 0.5}
        if any((c[s[1]] - p) * (1 if s[0] == "+" else -1) > 0 for s, p in self.end_sides):
            return True
        return super().skip_skirt(i, j)


class NavyShell(FreeEnds, T.Shell):
    """The shell with its faces in the ramp plates' tone (set 4's wall and ramp are one light grey, its shade side a
    step darker); the dark outlines at the foot and under the top stay. A partition's outer corner is chamfered
    (NAVY_C) down the wall and the ramp, the ramp's chamfer a band of constant width (as Recessed's) carrying the
    plates' tone, the toe band and the foot line."""
    line = None

    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        self.find_ends()
        self.holes = []                                 # a ramp variant's hole: (ax, plane, u0, u1, d0, d1)
        rh = (T.STYLE or {}).get("ramp_hole")
        hd = rh(T.VARIANT[1]) if rh and T.VARIANT[1] else None
        if hd:
            off = (T.STYLE or {}).get("seam", T.STILE)
            for ax, plane, a, b, _ in T.faces(self):
                for s0, s1 in T.spans(a, b):
                    if s1 - s0 > 2 * off + 0.3:
                        self.holes.append((ax, T.snap(plane), s0 + off - hd[2], s1 - off + hd[2], hd[0] * self.run,
                                           hd[1] * self.run))
        fh = (T.STYLE or {}).get("face_holes")                  # a top variant's openings in the face: (ax, plane,
        self.face_holes = []                                    # u0, u1, z0, z1)
        if fh and T.VARIANT[0]:
            for ax, plane, a, b, top in T.faces(self):
                self.face_holes += [(ax, T.snap(plane)) + h for h in fh(a, b, self.zs, top, T.VARIANT[0])]
        for r in self.rects:
            x0, x1, y0, y1 = r[0]
            if any(sd[0] == "+" for sd, _ in self.end_sides):
                break                                   # (a wall's end is not a corner)
            if (not self._adj(r, "+x") and not self._adj(r, "+y") and x1 < 0.5 - 1e-9 and y1 < 0.5 - 1e-9
                    and self.keep is None):
                self.line = (T.snap(x1), T.snap(y1))
                lim = self.line[0] + self.line[1] - NAVY_C + 1e-9
                self.keep = lambda ci, cj: ci / T.W.GN - 0.5 + cj / T.W.GN - 0.5 <= lim
                self.diag = self.skirt_halves = True

    def skip_skirt(self, i, j):                         # no ramp over a ramp variant's hole
        x, y = (i + 0.5) / T.W.GN - 0.5, (j + 0.5) / T.W.GN - 0.5
        for ax, plane, u0, u1, d0, d1 in self.holes:
            u, d = (x, y - plane) if ax == "y" else (y, x - plane)
            if u0 < u < u1 and d0 < d < d1:
                return True
        return super().skip_skirt(i, j)

    def drop_at(self, x, y):
        return 0.0

    def cap_clip(self, q):                              # the far hull's armour plates cut on the chamfer too
        return self.line[0] + self.line[1] - NAVY_C - q[0] - q[1]

    def _cdist(self, x, y):
        d, r = self._dist(x, y)
        if self.line is None:
            return d, r, False
        c = (x - self.line[0] + y - self.line[1] + NAVY_C) / 2
        return (c, r, True) if c > d + 1e-9 else (d, r, False)

    def skirtz(self, x, y):
        return self.zs * max(0.0, 1.0 - self._cdist(x, y)[0] / self.run)

    def col_skirt(self, i, j, kind, x, y):
        d, r = self._dist(x, y)
        if self.line is None or (x - self.line[0] + y - self.line[1] + NAVY_C) / 2 < d - 1 / T.W.GN:
            return super().col_skirt(i, j, kind, x, y)
        d = max(d, (x - self.line[0] + y - self.line[1] + NAVY_C) / 2)   # (the cells along its edges too: they reach
        fam = "blue" if r[1] == "hull" else "wall"                       # past the plates, so in the joints' tone they
                                                                         # dotted the edges)
        if d < 0.02:                                                     # the line where the ramp meets the wall
            return T.RAMPS[fam][0][(T.STYLE or {}).get("joint", 1)]
        if self.run - 0.03 > d >= (T.STYLE or {}).get("toe_at", 0.72) * self.run:
            return T.RAMPS["ochre"][0][4]
        return T.RAMPS[fam][0][3]

    def col_face(self, face, x, y, z):
        for ax, plane, u0, u1, z0, z1 in self.face_holes:
            if face == ax and abs((y if ax == "y" else x) - plane) < 1e-6 and u0 < (x if ax == "y" else y) < u1 \
                    and z0 < z < z1:
                return None                             # (open: the variant builds the opening's inside)
        c = super().col_face(face, x, y, z)
        e = 0.5 / T.W.GN
        r = self._rect_at(x, y - e) if face == "y" else self._rect_at(x - e, y)
        top = r[3] if r else self.top
        if z < self.zs + 0.02 or z > top - 0.03:
            return c
        return T.RAMPS["blue" if r and r[1] == "hull" else "wall"][1 if face == "x" else 0][4 if face == "d" else 3]


def _slab(z0, z1, d):
    return [(0.0, z0), (d, z0), (d, z1), (0.0, z1)]


def _ends(ax, plane, b, ends):
    """How a face of a chamfering look (NavyShell) ends: (endf: it is a wall's end face; end1: it runs to one at b;
    corner: its b end is a chamfered corner; back: its low end is a free end turning onto a hidden face)."""
    sh = T.SHELL
    endf = bool(getattr(sh, "end_face", None) and sh.end_face(ax, plane))
    end1 = bool(getattr(sh, "is_end", None) and sh.is_end(ax, b, 1))
    return endf, end1, ends[1] == "out" and not (endf or end1), ends[0] == "out"


def _ramp_chamfer(k, X, Y, C, zs, F):
    """Plates on the ramp's chamfer at a corner (X, Y), C along each axis: one step lighter than the ramp (a
    highlight), with the toe band and the foot line across it."""
    run, ta = T.W.skirt_run(), (T.STYLE or {}).get("toe_at", 0.72)
    nrm = Vector((zs / (2 * run), zs / (2 * run), 1.0)).normalized()

    def cq(t):                                          # the chamfer t down its slope: its two edges
        z = zs * (1 - t / run)
        return Vector((X - C + t, Y + t, z)), Vector((X + t, Y - C + t, z))
    for t0, t1, fam, lvl in ((0.02, ta * run, F, 3), (ta * run, run - 0.03, "ochre", 3), (run - 0.03, run, F, 2)):
        (a0, b0), (a1, b1) = cq(t0), cq(t1)
        k.poly([q + nrm * 2 * PAINT for q in (a0, b0, b1, a1)], fam, lvl, nrm)


def _end_section(k, ax, plane, a, b, zs, zt, F):
    """A wall's end face, under its face parts: the section of its foot and its two ramps down to the floor, with
    edge highlights up its two edges (to zt) and down the ramps' slopes."""
    run = T.W.skirt_run()
    k.poly([T.P(ax, plane, u, z, 0.0) for u, z in ((a - run, 0.0035), (b + run, 0.0035), (b, zs), (a, zs))],
           F, 2, T.OUT(ax))
    hl = [[(b - LINE, zs), (b, zs), (b, zt), (b - LINE, zt)], [(a, zs), (a + LINE, zs), (a + LINE, zt), (a, zt)],
          [(b, zs), (b + run, 0.0035), (b + run - 0.06, 0.0035), (b, zs - 0.035)],
          [(a, zs), (a, zs - 0.035), (a - run + 0.06, 0.0035), (a - run, 0.0035)]]
    for q in hl:
        k.poly([T.P(ax, plane, u, z, PAINT) for u, z in q], F, 5, T.OUT(ax))


def navy(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        X, C = b, NAVY_C
        endf, end1, corner, back = _ends(ax, plane, b, ends)    # (at a wall's end the tube stops)
        if corner:                                      # the chamfered corner: the parts stop where it starts and
            b -= C                                      # carry round it on corner pieces (drawn with the y face)
        cp = corner and ax == "y"
        pe = ("in" if back else ends[0], ends[1])       # (at a hidden free end the parts stop square: run on, they
                                                        # stuck out past the end)
        T.run(k, ax, plane, a, b, pe, zs - 0.03, zs + 0.06, PAINT, F, 3, 0)
        if cp:
            corner_piece(k, X, plane, C, _slab(zs - 0.03, zs + 0.06, PAINT), F, 3)
            _ramp_chamfer(k, X, plane, C, zs, F)
        rt = min(top, T.W.wall_top("wall", "up")) if full else top     # laid out on a partition's height on every
        H = rt - zs                                                     # wall, so the far hull's parts line up
        zh = rt - 0.25 * H if full else top                             # the header's foot
        for s0, s1 in T.spans(a, b):                                    # plate seams (none on a corner's tile)
            if (abs(s0 - a) < 1e-6 and ends[0] != "cont") or (abs(s1 - b) < 1e-6 and ends[1] != "cont"):
                continue
            if s1 - s0 > 2 * NAVY_SEAM + 1e-3:
                for u in (s0 + NAVY_SEAM, s1 - NAVY_SEAM):
                    T.paint(k, ax, plane, u - LINE / 2, u + LINE / 2, zs - 0.03, zh, PAINT, F, 1)
        if ax == "y":                                   # a seam up an inner corner (on the lit face, one px, as the
            for u, e in ((a, ends[0]), (b, ends[1])):   # plates' seams)
                if e == "in":
                    u0 = u if u == a else u - LINE
                    T.paint(k, ax, plane, u0, u0 + LINE, zs - 0.03, zh, PAINT, F, 1)
        if endf:
            _end_section(k, ax, plane, a, b, zs, zh - 0.33 * H if full else top, F)
        if not full:
            return
        mit = (0.0 if back else {"in": -1.0}.get(ends[0], 0.0), {"out": 1.0, "in": -1.0}.get(ends[1], 0.0))
        T.run(k, ax, plane, a, b, pe, zh, rt - 0.02, PX, "rose", 1, 0)                           # the dark header
        tv = T.VARIANT[0]                               # (a straight piece's variant: factions_variants)
        if tv == 5:
            FV.navy_band(k, ax, plane, a, b, pe, zh, H)
        else:
            T.run(k, ax, plane, a, b, pe, zh - 0.33 * H, zh, PAINT, "ochre", 3, 0)              # the maroon band
        if tv in (1, 2, 3, 4):
            for s0, s1 in T.spans(a, b):
                FV.navy_top(k, ax, plane, s0 + 0.06, s1 - 0.06, zs + 0.1, zh - 0.02, F, tv)
        zc, r, dc = rt - 0.1, 0.055, PX + 0.055                                                  # the tube, high up
        if not endf:                                    # (none on a wall's end face; it stops in the end bracket)
            tube(k, ax, plane, a + (0.02 if back else 0.0), b - (0.02 if end1 else 0.0), dc, zc, r,
                 mitre=(mit[0], 0.0 if end1 else mit[1]))
        if cp:
            corner_piece(k, X, plane, C, _slab(zh, rt - 0.02, PX), "rose", 1)
            corner_piece(k, X, plane, C, _slab(zh - 0.33 * H, zh, PAINT), "ochre", 3)
            prof, cols = tube_prof(dc, zc, r)
            corner_piece(k, X, plane, C, prof, "wall", 0, cols, "or")
        bw = 0.1
        clear = {"out": 0.05, "in": dc + r + 0.03}      # brackets clear of a corner (and of the other face's tube)
        for s0, s1 in ([] if endf else T.spans(a, b)):
            lo = s0 + ((0.02 if back else clear.get(ends[0], 0.0)) if abs(s0 - a) < 1e-6 else 0.0)
            hi = s1 - ((0.02 if end1 else clear.get(ends[1], 0.0)) if abs(s1 - b) < 1e-6 else 0.0)
            if hi - lo < 2 * bw:
                continue
            for u0, u1 in ((lo - 0.003, lo + bw), (hi - bw, hi + 0.003)):                        # the brackets
                bracket(k, ax, plane, u0, u1, dc, zc, 0.085, zc - 0.15, zc + 0.1, F, 4)    # (past the tube's end)
        if hull and variant:
            for s0, s1 in T.spans(a, b):
                if s1 - s0 > 0.6:
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
            tv = T.VARIANT[0]                                       # (a straight piece's variant: factions_variants)
            if tv == 3:                                 # a red block, set back and shorter, between the columns
                Dr, cr, ri = D - PX, c * (D - PX) / D, 0.1  # only (under them it poked through their sides)
                prism(k, ax, plane, h0 + 0.12, h1 - 0.12,
                      [(0.0, z0 + ri), (Dr, z0 + ri + cr), (Dr, z1 - ri - cr), (0.0, z1 - ri)],
                      F, 2, cols=["lvR2", "lvR", "drM", "lvR2"], cap="lvR2")
            elif tv not in (1, 2):
                prism(k, ax, plane, h0, h1, [(0.0, z0), (D, z0 + c), (D, z1 - c), (0.0, z1)], F, 2,
                      mitre=(m0, m1), cap=sides[1])                                              # the block
            else:                                                                                # ... or its bay
                FV.drone_open(k, ax, plane, h0 + 0.12, h1 - 0.12, z0, z1, F, tv)
            Dc = D + 0.5 * PX if tv not in (1, 2) else D - PX     # (an open bay's columns stand back)
            lift = 0.5 * PX * math.hypot(c, D) / D          # the columns stand proud of the block's front and of its
            col = [(0.0, z0 - lift), (Dc, z0 - lift + c * Dc / D),         # sloped top and foot alike (raised
                   (Dc, z1 + lift - c * Dc / D), (0.0, z1 + lift)]          # strips carried up the slopes)
            o0, o1 = (Dc if m0 < 0 else 0.0), (Dc if m1 < 0 else 0.0)   # an inner mitre eats a part's depth: the
            for u0, u1, mt in ((h0, h0 + 0.12 + o0, (m0, 0.0)), (h1 - 0.12 - o1, h1, (0.0, m1))):   # columns widen
                prism(k, ax, plane, u0, u1, col, F, 3, mitre=mt, cap=sides[1])                   # its two columns
            f0, f1 = z0 + c, z1 - c                                                              # its front
            q0, q1 = h0 + o0, h1 - o1                           # (the front clear of the other face there)
            if tv == 3:                                                                          # a seam across it
                FV.flat(k, ax, plane, q0 + 0.14, q1 - 0.14, f0 + 0.14, f0 + 0.166, D - PX + PAINT, "lvR2")
            elif not tv:
                T.paint(k, ax, plane, q0 + 0.14, q1 - 0.14, f1 - 0.16, f1 - 0.04, D, "rose", 1)  # a dark recess ...
                for u in (q0 + 0.18, (q0 + q1) / 2 - 0.04, q1 - 0.26):
                    T.slab(k, ax, plane, u, u + 0.08, f1 - 0.13, f1 - 0.07, Dc, F, 3)            # ... with parts in it
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

def rbox(k, ax, plane, u0, u1, z0, z1, fam, lvl):
    """A one-px seam outline round [u0, u1] x [z0, z1] on a face, its corners rounded (a two-px radius: each corner
    a single diagonal step)."""
    L, t = LINE, 0.026                                  # one art px along the face, and up it
    for q in ((u0 + 2 * L, u1 - 2 * L, z0, z0 + t), (u0 + 2 * L, u1 - 2 * L, z1 - t, z1),
              (u0, u0 + L, z0 + 2 * t, z1 - 2 * t), (u1 - L, u1, z0 + 2 * t, z1 - 2 * t),
              (u0 + L, u0 + 2 * L, z0 + t, z0 + 2 * t), (u1 - 2 * L, u1 - L, z0 + t, z0 + 2 * t),
              (u0 + L, u0 + 2 * L, z1 - 2 * t, z1 - t), (u1 - 2 * L, u1 - L, z1 - 2 * t, z1 - t)):
        T.paint(k, ax, plane, q[0], q[1], q[2], q[3], 0.0, fam, lvl)


def civil(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        X, C = b, NAVY_C                                # (the corners and wall ends as navy's)
        endf, end1, corner, back = _ends(ax, plane, b, ends)
        if corner:
            b -= C
        cp = corner and ax == "y"
        pe = ("in" if back else ends[0], ends[1])
        zh = top - 0.13 * (top - zs) if full else top
        parts = [(zs - 0.03, zs + 0.05, PAINT, F, 4)]
        if full:
            parts += [(zh, top - 0.02, PX, "ochre", 3),                                         # the colour band ...
                      (top - 0.045, top - 0.02, PX + PAINT, "ochre", 4),                        # ... lit on top,
                      (zh, zh + 0.025, PX + PAINT, "ochre", 2)]                                 # ... dark below
        for z0, z1, d, fam, lvl in parts:
            T.run(k, ax, plane, a, b, pe, z0, z1, d, fam, lvl, 0)
            if cp:
                corner_piece(k, X, plane, C, _slab(z0, z1, d), fam, lvl)
        if cp:
            _ramp_chamfer(k, X, plane, C, zs, F)
        if endf:
            _end_section(k, ax, plane, a, b, zs, zh, F)
        if not full or endf:
            return
        for s0, s1 in T.spans(a, b):
            if s1 - s0 < 0.45:                          # (a short stretch, by a corner or a junction, stays plain:
                continue                                # its frame came out a cramped strip)
            f0, f1, g0, g1 = FV.civil_field(s0, s1, zs, zh)                                     # the drawers centred
                                                                                                # between the foot strip
            n = 2                                                                               # and the band, each
            h, gap = (g1 - g0) / n, 0.035                                                       # its own outline with
            uc = (f0 + f1) / 2                                                                  # rounded corners
            if T.VARIANT[0]:
                FV.civil_top(k, ax, plane, f0, f1, g0, g1, F, T.VARIANT[0])
                continue                                    # (a variant's own top)
            for i in range(n):
                z0, z1 = g0 + i * h + (gap / 2 if i else 0.0), g0 + (i + 1) * h - (gap / 2 if i < n - 1 else 0.0)
                rbox(k, ax, plane, f0, f1, z0, z1, F, 2)
                T.paint(k, ax, plane, uc - 0.08, uc + 0.08, z1 - 0.15, z1 - 0.09, 0.0, F, 2)     # a handle recess in the
                T.paint(k, ax, plane, uc - 0.08, uc + 0.08, z1 - 0.115, z1 - 0.09, PAINT, F, 1)  # seams' tone, its lip
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


class Recessed(FreeEnds, T.Shell):
    """The shell with its camera-facing faces set back by BAST_R: the cornice, posts and lower wall then stand at the
    wall's line and the face between them is cut in. The skirt, the face planes and the ends keep the wall's line
    (they read self.rects); only the covered cells (the body and its cap) shrink, and an outer corner of the body is
    cut off at 45 degrees (BAST_CR along each axis), so the recess turns the corner on a chamfer; the ramp and its lip
    turn the same corner on their own 45-degree face (BAST_CS)."""
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        self.find_ends()                                # (a free end is not recessed, nor chamfered)
        R = BAST_L + BAST_R
        body = []
        corner = None
        ends = {sd for sd, _ in self.end_sides}
        for r in self.rects:
            (x0, x1, y0, y1), fam, t, top = r
            cx = not self._adj(r, "+x") and x1 < 0.5 - 1e-9 and "+x" not in ends
            cy = not self._adj(r, "+y") and y1 < 0.5 - 1e-9 and "+y" not in ends
            body.append(((x0, x1 - (R if cx else 0), y0, y1 - (R if cy else 0)), fam, t, top))
            if cx and cy:                               # a partition's outer corner or the far hull's end
                self.line = (T.snap(x1), T.snap(y1))    # the wall's line at the corner
                corner = (self.line[0] - R, self.line[1] - R)
        self.body = body
        if corner and self.keep is None:
            lim = corner[0] + corner[1] - BAST_CR + 1e-9
            self.keep = lambda ci, cj: ci / T.W.GN - 0.5 + cj / T.W.GN - 0.5 <= lim
            self.diag = True

    def drop_at(self, x, y):
        return 0.0

    line = None

    def cap_clip(self, q):                              # the far hull's armour plates cut on the cornice's chamfer
        return self.line[0] + self.line[1] - BAST_C - q[0] - q[1]

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
        """The body: the footprint less a band R deep behind every camera-facing face, so the recess runs along the
        faces, into an inner corner and round a junction alike (a point is body when the footprint also holds it
        moved R along +x, +y and both; a probe past a tile edge the footprint reaches, or past a free end, counts as
        held). The outer corner's chamfer is the keep predicate's."""
        r = self._rect_at(x, y, 0.0)
        if r is None:
            return None
        R = BAST_L + BAST_R

        def held(px, py):
            px, py = min(px, 0.5 - 1e-6), min(py, 0.5 - 1e-6)
            for sd, pl in self.end_sides:
                if sd == "+x" and px > pl:
                    px = pl - 1e-6
                if sd == "+y" and py > pl:
                    py = pl - 1e-6
            return self._rect_at(px, py, 0.0) is not None
        return r if held(x + R, y) and held(x, y + R) and held(x + R, y + R) else None

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


def corner_piece(k, X, Y, C, prof, fam, lvl, cols=None, cap=None):
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
        k.poly([J1[i], J2[i], J2[j], J1[j]], fam, lvl, n_ * pd + up * pz, fixed=cols[i] if cols else None)
    k.poly(J1, fam, lvl, Vector((-1, 0, 0)), fixed=cap)
    k.poly(J2, fam, lvl, Vector((0, -1, 0)), fixed=cap)


def bastion(hull):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        H = top - zs
        R, C, L, PW = BAST_R, BAST_C, BAST_L, BAST_P
        endf, end1, _, _ = _ends(ax, plane, b, ends)
        d0 = -(L + R) + EPS                             # the parts fill the cut from the recessed face out to the lip
        dl = -L                                         # (the cornice to the wall's line)
        out = full and ends[1] == "out" and not end1
        kb = BAST_K if end1 else 0.0                    # (the cornice runs on to meet the end face's)
        bb = b - C if out else b                        # the chamfer takes over at an outer corner, on a joint
        ina, inb = ends[0] == "in", ends[1] == "in"     # inner corners: no posts; the recess and its parts run on
        mt = (-1.0 if ina else 0.0, 1.0 if out else -1.0 if inb else 0.0)    # into the corner, mitred to meet the
                                                                              # other face's (straight at the camera)

        def band(u0, u1, z0, z1, lvl, cap=None, front=dl, m=(False, False)):
            prism(k, ax, plane, u0, u1, [(d0, z0), (front, z0), (front, z1), (d0, z1)], F, lvl, cap=cap, mitre=m)
        if endf:                                        # a wall's end face: not recessed; its section, and the
            _end_section(k, ax, plane, a, b, zs, top - 0.21 if full else top, F)    # cornice turned onto it
            if full:
                band(a, b + BAST_K, top - 0.21, top - 0.02, 3, front=BAST_K)
            return
        zlo = zs + (0.08 if full else 0.3)                                                       # the lower wall's top
        zlo = min(zlo, top - 0.02)
        band(a, bb, zs, zlo, 3, m=mt)                                                            # the lower wall
        if not full:
            band(a, bb, zlo, top, 3)
            return
        zsl = zlo + 0.12 * H                                                                     # the slope's top
        zc0 = top - 0.21
        band(a - (BAST_K if ends[0] == "out" else 0.0), bb + kb, zc0, top - 0.02, 3, front=BAST_K, m=mt)  # cornice
        for s0, s1 in T.spans(a, b):
            for u in (s0 + 0.1, s1 - 0.1 - LINE):
                if s1 - s0 > 0.5 and u + LINE < bb:
                    T.paint(k, ax, plane, u, u + LINE, zc0, top - 0.02, BAST_K, F, 1)            # ... its joints
            ia, ib = ina and abs(s0 - a) < 1e-6, inb and abs(s1 - b) < 1e-6
            for lo, edge in ((True, s0), (False, s1)):           # the posts: the first shows its side too, so
                if not lo and out and abs(edge - b) < 1e-6:      # it is narrower by the depth, and the two read
                    continue                                     # the same width; none at a chamfered corner
                if (lo and ia) or (not lo and ib):
                    continue                                     # (nor an inner one)
                q0, q1 = (max(edge, a), edge + PW - R) if lo else (edge - PW, min(edge, bb))
                if q1 - q0 > 1e-6:
                    band(q0, q1, zlo, zc0, 3, cap="wD")                                          # (dark inner walls)
            corner = out and abs(s1 - b) < 1e-6
            f0 = s0 if ia else s0 + PW - R
            f1 = bb if corner or ib else min(s1 - PW, bb)
            if f1 - f0 < 0.1:
                continue
            prism(k, ax, plane, f0, f1, [(d0 + EPS, zlo), (dl, zlo), (d0 + EPS, zsl)], F, 3,
                  mitre=(mt[0] if ia else 0.0, mt[1] if corner or ib else 0.0))                  # the slope into it
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

class ScrapShell(FreeEnds, T.Shell):
    """The default shell, with a partition's free ends stopped square (FreeEnds); its corners stay square."""
    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        self.find_ends()


def scrap(hull, seed):
    def face(k, ax, plane, a, b, ends, zs, top, full, variant=0):
        F = body(hull)
        endf, end1, _, back = _ends(ax, plane, b, ends)
        if endf:                                        # a wall's end face: its section only
            _end_section(k, ax, plane, a, b, zs, top - 0.03, F)
            return
        pe = ("in" if back else ends[0], "in" if end1 else ends[1])   # (nothing runs on round a free end)
        (T.hull_face if hull else T.wall_face)(k, ax, plane, a, b, pe, zs, top, full, *((variant,) if hull else ()))
        hi = top - 0.2 if full else top
        for s0, s1 in T.spans(a, b):                    # patch plates: one or two a tile (most tiles), flat (one px
            if s1 - s0 < 0.4:                           # proud), in the wall's own grey or a dull rust
                continue
            for n in range(1 + (hashf(seed, round(s0, 3), ax, "n") > 0.5)):
                h = lambda *x: hashf(seed, round(s0, 3), ax, n, *x)   # noqa: E731
                if h("skip") < 0.2:
                    continue
                w = (0.25 + 0.25 * h("w")) * (s1 - s0)
                ht = (0.15 + 0.25 * h("h")) * (hi - zs)
                u0 = s0 + 0.05 + (s1 - s0 - w - 0.1) * h("u")
                z0 = zs + 0.05 + (hi - zs - ht - 0.05) * h("z")
                c = h("f")
                pf, lvl = (F, 2 + (h("l") > 0.5)) if c < 0.4 else ("ochre", 0) if c < 0.8 else ("ochre", 1)
                d = PX + 2 * PAINT * n                  # (a second laps over the first)
                T.slab(k, ax, plane, u0, u0 + w, z0, z0 + ht, d, pf, lvl)
                for cu in (u0 + 0.03, u0 + w - 0.03):                                           # its rivets
                    for cz in (z0 + 0.03, z0 + ht - 0.03):
                        T.paint(k, ax, plane, cu - LINE / 2, cu + LINE / 2, cz - 0.013, cz + 0.013, d, pf, lvl + 1)
    return face
