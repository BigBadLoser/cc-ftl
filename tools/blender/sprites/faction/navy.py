"""Navy (set 4): light plates, a maroon band, a dark header with a lit tube on brackets and white caps; its shell (also
civil's) and its straight-run designs."""
import math

from mathutils import Vector

from .. import wall3d as T
from .base import Faction, _style
from .parts import LINE, PAINT, PX, _slab, body, bracket, corner_piece, flat, prism, tube, tube_prof
from .shell import FreeEnds, _end_section, _ends, _ramp_chamfer


NAVY_SEAM = 7.5 / 32               # the plate seams, in from each tile edge, up the face and down the ramp (on the px
                                    # grid: a px wide, they fill whole px on both faces)


NAVY_C = 3 / 32                     # a partition's outer corner: chamfered this far along each axis, wall and ramp


class NavyShell(FreeEnds, T.Shell):
    """The shell with its faces in the ramp plates' tone (set 4's wall and ramp are one light grey, its shade side a
    step darker); the dark outlines at the foot and under the top stay. A partition's outer corner is chamfered
    (NAVY_C) down the wall and the ramp, the ramp's chamfer a band of constant width (as Recessed's) carrying the
    plates' tone, the toe band and the foot line."""
    line = None

    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        self.foot = (T.STYLE or {}).get("foot", 0.0)  # (STYLE foot: the ramp ends in an upright face, as CornerCut's)
        if self.foot:
            self.run = math.ceil(self.run * T.W.GN - 1e-6) / T.W.GN
        self.find_ends()
        self.find_holes()
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
                    and self.keep is None and (T.STYLE or {}).get("chamfer")):     # (a look without: square)
                self.line = (T.snap(x1), T.snap(y1))
                lim = self.line[0] + self.line[1] - NAVY_C + 1e-9
                self.keep = lambda ci, cj: ci / T.W.GN - 0.5 + cj / T.W.GN - 0.5 <= lim
                self.diag = self.skirt_halves = True

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
        d = self._cdist(x, y)[0]
        if self.foot:
            return self.foot + (self.zs - self.foot) * (1.0 - d / self.run) if d <= self.run + 1e-9 else 0.0
        return self.zs * max(0.0, 1.0 - d / self.run)

    def col_skirt(self, i, j, kind, x, y):
        d, r = self._dist(x, y)
        if self.line is None or (x - self.line[0] + y - self.line[1] + NAVY_C) / 2 < d - 1 / T.W.GN:
            return super().col_skirt(i, j, kind, x, y)
        d = max(d, (x - self.line[0] + y - self.line[1] + NAVY_C) / 2)   # (the cells along its edges too: they reach
        fam = "blue" if r[1] == "hull" else "wall"                       # past the plates, so in the joints' tone they
                                                                         # dotted the edges)
        if self.foot and d > self.run - 1 / T.W.GN:                      # (the chamfer's toe crosses cells: their
            return self.col_face("y", x, y, 0.0)                         # drop is the upright foot's, in its colour)
        if d < 0.02:                                                     # the line where the ramp meets the wall
            return T.RAMPS[fam][0][(T.STYLE or {}).get("joint", 1)]
        if self.run - 0.03 > d >= (T.STYLE or {}).get("toe_at", 0.72) * self.run and not self.foot:
            return T.RAMPS["ochre"][0][4]
        return T.RAMPS[fam][0][3]

    def col_face(self, face, x, y, z):
        if z < self.foot - 1e-6:                        # the ramp's upright foot, in the toe band's colour
            return T.RAMPS[(T.STYLE or {}).get("toe") or "wall"][0 if face == "y" else 1][2]
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
        T.run(k, ax, plane, a, b, pe, zh, rt, PX, "rose", 1, 0)          # the dark header, up to the cap (a step under
                                                                         # it showed as a dotted line on the black top)
        tv = T.VARIANT[0]                               # (a straight piece's variant: NAVY_PAIRS)
        if tv == 5:
            navy_band(k, ax, plane, a, b, pe, zh, H)
        else:
            T.run(k, ax, plane, a, b, pe, zh - 0.33 * H, zh, PAINT, "ochre", 3, 0)              # the maroon band
        if tv in (1, 2, 3, 4):
            for s0, s1 in T.spans(a, b):
                navy_top(k, ax, plane, s0 + 0.06, s1 - 0.06, zs + 0.1, zh - 0.02, F, tv)
        zc, r, dc = rt - 0.1, 0.055, PX + 0.055                                                  # the tube, high up
        if not endf:                                    # (none on a wall's end face; it stops in the end bracket)
            tube(k, ax, plane, a + (0.02 if back else 0.0), b - (0.02 if end1 else 0.0), dc, zc, r,
                 mitre=(mit[0], 0.0 if end1 else mit[1]))
        if cp:
            corner_piece(k, X, plane, C, _slab(zh, rt, PX), "rose", 1)
            corner_piece(k, X, plane, C, _slab(zh - 0.33 * H, zh, PAINT), "ochre", 3)
            prof, cols = tube_prof(dc, zc, r)
            corner_piece(k, X, plane, C, prof, "wall", 0, cols, "or")
        bw = 0.1
        clear = {"out": 0.05, "in": dc + r + 0.03}      # brackets clear of a corner (and of the other face's tube)
        for s0, s1 in ([] if endf else T.spans(a, b)):  # one bracket a tile, at the tile's middle (clear of a
            lo = s0 + ((0.02 if back else clear.get(ends[0], 0.0)) if abs(s0 - a) < 1e-6 else 0.0)   # corner)
            hi = s1 - ((0.02 if end1 else clear.get(ends[1], 0.0)) if abs(s1 - b) < 1e-6 else 0.0)
            um = (s0 + s1) / 2
            if lo <= um - bw / 2 and um + bw / 2 <= hi:
                bracket(k, ax, plane, um - bw / 2, um + bw / 2, dc, zc, 0.085, zc - 0.15, zc + 0.1, F, 4)
        if hull and variant:
            for s0, s1 in T.spans(a, b):
                if s1 - s0 > 0.6:
                    uc = (s0 + s1) / 2
                    T.paint(k, ax, plane, uc - 0.1, uc + 0.1, zh - 0.3, zh - 0.06, 2 * PAINT, F, 4)
    return face


NAVY_PAIRS = [(0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2),
              (5, 0), (5, 1), (5, 2)]                   # set 4: tops x ramps (no lit rack T3 or window panel T4)


def _box(k, ax, plane, u0, u1, z0, z1, d, cols, ch=0.0):
    """A box standing d proud, its top and foot chamfered ch, its faces in fixed colours (cols: foot, front, top;
    its ends the foot's)."""
    prism(k, ax, plane, u0, u1, [(0.0, z0), (d, z0 + ch), (d, z1 - ch), (0.0, z1)], "wall", 0,
          cols=[cols[0], cols[1], cols[2], cols[0]], cap=cols[0])


def navy_top(k, ax, plane, u0, u1, z0, z1, F, t):
    """A navy face's middle (u0..u1 x z0..z1, from over its foot strip to under its header) for top design t (set 4):
    1 control boxes, 2 red lockers, 3 a canister rack, 4 a window panel, each in a dark recess."""
    uc = (u0 + u1) / 2
    T.paint(k, ax, plane, u0, u1, z0, z1, 3 * PAINT, "rose", 1)                                      # the recess
    a, b, c, e = u0 + 0.04, u1 - 0.04, z0 + 0.04, z1 - 0.04                                          # inside it
    d = 4 * PAINT
    if t == 1:                                          # two control boxes: light bezels, dark windows packed with
        zm = (c + e) / 2                                # red and cream parts and small lights
        a, b = a + 0.06, b - 0.06
        for q0, q1 in ((c + 0.02, zm - 0.02), (zm + 0.02, e - 0.02)):
            T.slab(k, ax, plane, a, b, q0, q1, PX, F, 3)                                                 # bezel
            w0, w1, v0, v1 = a + 0.04, b - 0.04, q0 + 0.04, q1 - 0.04
            T.paint(k, ax, plane, w0, w1, v0, v1, PX, "rose", 1)                                         # window
            cw, ch = (w1 - w0) / 4, (v1 - v0) / 3
            for i in range(4):
                for j in range(3):
                    x0, y0 = w0 + i * cw, v0 + j * ch
                    if (i + j) % 3 == 1:                                                                 # cream parts
                        T.paint(k, ax, plane, x0 + LINE / 2, x0 + cw - LINE / 2, y0 + 0.01, y0 + ch - 0.01,
                                PX + PAINT, F, 5)
                    else:                                                                                # red parts
                        flat(k, ax, plane, x0 + LINE / 2, x0 + cw - LINE / 2, y0 + 0.01, y0 + ch - 0.01,
                             PX + 2 * PAINT, ("lvR", "drM", "lvR2")[(i + 2 * j) % 3])
            for fu, fz, col in ((0.3, 0.7, "green"), (0.65, 0.35, "green"), (0.8, 0.75, "flameY")):      # lights
                uu, zz = w0 + fu * (w1 - w0), v0 + fz * (v1 - v0)
                flat(k, ax, plane, uu - LINE, uu + LINE, zz - 0.025, zz + 0.025, PX + 3 * PAINT, col)
    elif t == 2:                                        # two red lockers, a lid notch on the upper
        zm = (c + e) / 2
        for q0, q1 in ((c, zm - 0.015), (zm + 0.015, e)):
            _box(k, ax, plane, a, b, q0, q1, 2 * PX, ("lvR2", "lvR", "drM"), ch=PX)              # (chamfered)
        flat(k, ax, plane, a + 0.04, uc - 0.04, e - 0.08, e - 0.055, 2 * PX + PAINT, "lvR2")
    elif t == 3:                                        # a rack of cream canisters
        nr, nc = 5, 3
        w, h = (b - a) / nc, (e - c) / nr
        for i in range(nc):
            for j in range(nr):
                T.slab(k, ax, plane, a + i * w + 2 * LINE, a + (i + 1) * w - 2 * LINE, c + j * h + 0.025,
                       c + (j + 1) * h - 0.025, PX / 2, F, 4)
    elif t == 4:                                        # a window panel: maroon over grey-blue glass
        zm = c + 0.55 * (e - c)
        T.paint(k, ax, plane, a, b, zm, e, d, "ochre", 2)
        T.paint(k, ax, plane, a, b, c, zm, d, F, 1)


def navy_band(k, ax, plane, a, b, ends, zh, H):
    """Top design 5 (set 4 T1-6): no recess; the maroon band thinner, a thin stripe under it."""
    T.run(k, ax, plane, a, b, ends, zh - 0.18 * H, zh, PAINT, "ochre", 3, 0)
    T.run(k, ax, plane, a, b, ends, zh - 0.28 * H, zh - 0.25 * H, PAINT, "ochre", 3, 0)


def navy_hole(r):
    """Where a navy ramp design is open (B1-2): (from, to) down the slope as fractions of its run (on through the toe
    band to near the floor), and how far past the field it reaches on either side."""
    return (0.06, 0.9, 0.12) if r == 1 else None


def _steel(k, q, n, up):
    k.poly(q, "wall", 0, n, fixed="fSH0" if n.normalized().dot(up) > 0.5 else "fSH2")      # neutral steel


def _collar(k, P, u, d, z, r, hw, up, n=8):
    """A steel collar round a pipe (centre (d, z), radius r) from u - hw to u + hw."""
    ring = [(d + r * math.cos(2 * math.pi * i / n + math.pi / n), z + r * math.sin(2 * math.pi * i / n + math.pi / n))
            for i in range(n)]
    c = P(u, z, d)
    for i in range(n):
        (da, za), (db, zb_) = ring[i], ring[(i + 1) % n]
        q = [P(u - hw, za, da), P(u + hw, za, da), P(u + hw, zb_, db), P(u - hw, zb_, db)]
        _steel(k, q, sum(q, Vector()) / 4 - c, up)
    for s_ in (-1, 1):
        q = [P(u + s_ * hw, zz, dd) for dd, zz in ring]
        _steel(k, q, P(1, 0, 0) - P(0, 0, 0) if s_ > 0 else P(0, 0, 0) - P(1, 0, 0), up)


def _bar(k, P, u, d0, d1, zf, hw, ht, up):
    """A steel bar from d0 to d1 along the pipes' centre line (zf(d) its height), hw wide, ht thick each way."""
    out_, along = P(0, 0, 1) - P(0, 0, 0), P(1, 0, 0) - P(0, 0, 0)
    for zs_, n in ((ht, up), (-ht, -up)):
        _steel(k, [P(u - hw, zf(d0) + zs_, d0), P(u + hw, zf(d0) + zs_, d0), P(u + hw, zf(d1) + zs_, d1),
                   P(u - hw, zf(d1) + zs_, d1)], n + out_ * 0.3 * (1 if zs_ > 0 else -1), up)
    for s_ in (-1, 1):
        _steel(k, [P(u + s_ * hw, zf(d0) - ht, d0), P(u + s_ * hw, zf(d0) + ht, d0), P(u + s_ * hw, zf(d1) + ht, d1),
                   P(u + s_ * hw, zf(d1) - ht, d1)], along * s_, up)


def navy_ramp(plate, u0, u1, run_, r, k=None, pt=None, P=None, zs=0.0, hole=None, ax=0, plane=0.0, **_):
    """A navy ramp's design r (set 4). 1 (B1-2): its cover off over the hole the shell leaves (navy_hole): a dark
    cavity down to the floor (back, sides and floor), two pipes across it in the header tube's orange, tied by steel
    brackets. 2 (B1-3): two darker plates split down the middle. plate lays a plate on the slope, pt(u, d, rise) is
    a point on it, P(u, z, d) any point (d out from the wall)."""
    if r == 1 and hole:
        o0, o1, d0, d1 = hole
        zat = lambda d: zs * (1 - d / run_)            # noqa: E731   the ramp's height d out
        f = 0.004
        up, out_, along = Vector((0, 0, 1)), P(0, 0, 1) - P(0, 0, 0), P(1, 0, 0) - P(0, 0, 0)
        k.poly([P(o0, f, d0), P(o1, f, d0), P(o1, f, d1), P(o0, f, d1)], "wall", 0, up)                 # its floor,
        k.poly([P(o0, f, d0), P(o1, f, d0), P(o1, zat(d0), d0), P(o0, zat(d0), d0)], "wall", 0, out_)   # back
        for u, sg in ((o0, 1), (o1, -1)):                                                                # and sides
            k.poly([P(u, f, d0), P(u, zat(d0), d0), P(u, zat(d1), d1), P(u, f, d1)], "rose", 2, along * sg)
        rp = 0.06
        dz = (rp + 0.025) / math.cos(math.atan(zs / run_))           # sunk a radius and a bit under the slope
        rows = [d0 + fr * (d1 - d0) for fr in (0.18, 0.6)]
        for dd in rows:                                                     # the pipes, lit like the header tube
            tube(k, ax, plane, o0 - 0.005, o1 + 0.005, dd, zat(dd) - dz, rp)     # (ends in the side walls)
        w = o1 - o0
        for u in (o0 + w / 3, o0 + 2 * w / 3):         # steel brackets: a collar round each pipe, a bar between them
            for dd in rows:
                _collar(k, P, u, dd, zat(dd) - dz, rp + 0.015, 0.03, up)
            _bar(k, P, u, rows[0], rows[1], lambda d: zat(d) - dz, 0.02, 0.015, up)
    elif r == 2:
        uc = (u0 + u1) / 2
        for p0, p1 in ((u0 + 0.04, uc - LINE / 2), (uc + LINE / 2, u1 - 0.04)):
            plate([(p0, 0.04), (p1, 0.04), (p1, 0.66 * run_), (p0, 0.66 * run_)], PAINT, 1, 0.0)


class Navy(Faction):
    pre = "fN"

    def relief(self, sprite):
        return _style(navy, skirt=None, toe="ochre", seam=NAVY_SEAM, joint=4, shell=NavyShell, chamfer=NAVY_C,
                      ramp_var=navy_ramp, ramp_hole=navy_hole)

    pairs = NAVY_PAIRS
