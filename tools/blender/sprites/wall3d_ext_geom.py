"""The exterior hull's geometry (wall3d_ext): one parametric section that every top design is cut from, its tones, and
a face builder that lays parts along a face, mitres them at its ends and carries every part that reaches an outer
corner round the corner's chamfer the same way (so nothing built on a face can stop short of a corner or miss it).

Units: u along the face and d out from the block's face in tiles (an art px along either is LINE), z in tiles of
height; heights given in art px are measured on screen (Section.z_at)."""
import os
from contextlib import contextmanager

from . import core
from . import wall3d as T

PAINT, LINE = T.PAINT, T.LINE
E = 0.5 - 1 / 32                    # the ship's outline (a cell short of the tile's edge)
D = E                               # the armour's depth: the block's face stands this far in from the outline (at
                                    # the tile's middle: its top half a tile deep, as hull 46's)
LEAN_RISE = 0.8                     # hull 46 T3's front (measured off its end): upright from the floor, then leaning
                                    # back in one plane from the outline, this far under the top, to the top's front
                                    # edge D in (its measured roll onto the top made a second angle at a corner)
F = "steel"
YS = T.RAMPS[F][0]                  # the tones (both near faces alike: hull 46 mirrors its art, no shade side)
HILITE = "hsW"                      # a seam's lit edge on the lean (a step over its near-white)
TOP = YS[3]                         # the tops (the lean a step lighter, the upright part a step darker)
DEBUG = set(filter(None, os.environ.get("EXT_DEBUG", "").split(",")))   # detail groups (Face.tag) drawn all in
DEBUG_COL = "dbgR"                                                      # DEBUG_COL, to check their shape and size
LINE_W = 1.3                        # long painted lines' weight, in px (the sprites coverage anti-aliased,
                                    # env_build.AA: a line over a pixel wide keeps its rows joined along an edge)
SHADE = 0.002                       # painted shade's face out from the front (over the seams' paint, 0.001)
ROLES = {"face": 0, "plate": 1, "plate2": 2, "floor": -1}   # a part's tone, in steps over its face's; "dark" (a
                                                            # seam's floor, a recess's shadowed edge) three under


class Section:
    """A design's section through the armour, d out from the block's face; `back`: the block's face that much
    further in than the armour's own (the armour builds the top's front back out over it), `upright_in`: the upright
    part set that far in under the lean's foot."""

    def __init__(self, H, back=0.0, upright_in=0.0):
        self.H, self.back, self.upright_in = H, back, upright_in
        self.zb = H - LEAN_RISE                     # the bend: upright under it, leaning over it

    def lean_d(self, z):
        """How far the lean stands out of the armour's own face at height z (D at the bend, 0 at the top)."""
        return D * min(1.0, max(0.0, (self.H - z) / LEAN_RISE))

    def lean(self, z0=0.0):
        """The lean as (d, z) points (d out from the armour's own face), from height z0 (or the bend) up."""
        z = max(z0, self.zb)
        return [(self.lean_d(z), z), (0.0, self.H)]

    def front(self, z0, z1, off=0.0):
        """The front between heights z0 and z1 (not across the bend) as (d, z) points, off in."""
        if z0 < self.zb - 1e-6:
            f = D + self.back - self.upright_in - off
            return [(f, z0), (f, z1)]
        return [(self.lean_d(z) + self.back - off, z) for z in (z0, z1)]

    def sec(self, z0, z1, off=0.0):
        """The section between heights z0 and z1: back to the block's face, the front off in."""
        return [(0.0, z0)] + self.front(z0, z1, off) + [(0.0, z1)]

    def sy(self, z):
        """The front at height z on screen, in art px down."""
        return -z * core.ZPX + self.front(z, z)[0][0] * core.TILE_H / 2

    def z_at(self, z, n):
        """The height whose front is n art px under the front at z on screen (n < 0: over), by bisection (the front
        is monotonic on screen)."""
        y = self.sy(z) + n
        lo, hi = (0.0, z) if n > 0 else (z, self.H)
        for _ in range(48):
            m = (lo + hi) / 2
            if self.sy(m) > y:                          # (under it on screen: higher)
                lo = m
            else:
                hi = m
        return (lo + hi) / 2

    def chamfer(self, c):
        """An outer corner's chamfer by height: c on the upright part, to nothing up the lean by how far the lean
        stands out (its face a triangle there, as hull 46's: a clean tip at the top's corner)."""
        return lambda z: c if z <= self.zb + 1e-6 else c * self.lean_d(z) / D

    def cols(self, prof, role):
        """A part's edge tones by facing: the lean near white, the upright part blue-grey, tops TOP (a recess's floor
        a step under); a lit step (a seam's or a recess's lower edge) two steps over its face; the bottom and back
        unseen. role: ROLES, or "dark"."""
        n = len(prof)
        cr = [prof[i][0] * prof[(i + 1) % n][1] - prof[(i + 1) % n][0] * prof[i][1] for i in range(n)]
        A = sum(cr) / 2
        cd = sum((prof[i][0] + prof[(i + 1) % n][0]) * cr[i] for i in range(n)) / (6 * A)
        cz = sum((prof[i][1] + prof[(i + 1) % n][1]) * cr[i] for i in range(n)) / (6 * A)
        out = []
        for i in range(n):
            (d0, z0), (d1, z1) = prof[i], prof[(i + 1) % n]
            pd, pz = z1 - z0, d0 - d1
            if pd * ((d0 + d1) / 2 - cd) + pz * ((z0 + z1) / 2 - cz) < 0:
                pd, pz = -pd, -pz
            h = (pd * pd + pz * pz) ** 0.5 or 1.0
            pd, pz = pd / h, pz / h
            face = 2 if (z0 + z1) / 2 < self.zb else 5                  # upright / lean
            if pz > 0.85:
                if z0 >= self.H - T.LIP - 1e-6:
                    out.append(TOP if role == "face" else YS[2])
                else:
                    out.append(YS[4 if z0 < self.zb else 5])
            elif pd < 0.3:
                out.append(None)
            else:
                out.append(YS[max(1, face - 3) if role == "dark" else min(5, face + ROLES[role])])
        return out


class Face:
    """One outer face being dressed (wall3d's face arguments): parts along it over [u0, u1], each mitred where it
    meets the face's ends (square at an outer end) and, at an outer corner (the face's b end), stopped at the
    corner's chamfer and carried round it (by the y face, once)."""

    def __init__(self, k, ax, plane, a, b, ends, sec, chamfer=None):
        self.k, self.ax, self.plane, self.a, self.b, self.sec, self.ends = k, ax, plane, a, b, sec, ends
        self.mt = tuple(1.0 if e == "out" else 0.0 for e in ends)
        self.c = chamfer if chamfer and ends[1] == "out" else 0.0
        self.ch = sec.chamfer(chamfer) if self.c else None
        self.dbg = False

    @contextmanager
    def tag(self, name):
        """Build a named group of detail (drawn all in DEBUG_COL when it is in DEBUG)."""
        was, self.dbg = self.dbg, self.dbg or name in DEBUG
        try:
            yield
        finally:
            self.dbg = was

    def _cols(self, cols, cap, n):
        return ([DEBUG_COL] * n, DEBUG_COL) if self.dbg else (cols, cap)

    def part(self, u0, u1, prof, cols=None, cap=None, fam=F, lvl=3, wrap=True, short=0.0, end=None):
        """A part over [u0, u1] with a (d, z) section; at the face's b end (end: whether it reaches it, by default
        when u1 is b; a detail placed beside the corner says not) it is mitred, and at an outer corner it stops at
        the chamfer (or `short` of it) and (wrap) runs on round it."""
        from .factions_relief import corner_piece, prism
        cols, cap = self._cols(cols, cap, len(prof))
        m0 = self.mt[0] if abs(u0 - self.a) < 1e-6 else 0.0
        end = abs(u1 - self.b) < 1e-6 if end is None else end
        if end and self.ch:
            ch = self.ch
            prism(self.k, self.ax, self.plane, u0, u1 - short, prof, fam, lvl, cols, cap,
                  mitre=(m0, lambda d, z: d - ch(z)))
            if wrap and self.ax == "y":
                corner_piece(self.k, self.b, self.plane, ch, prof, fam, lvl, cols,
                             cap[1] if isinstance(cap, tuple) else cap)
        else:
            prism(self.k, self.ax, self.plane, u0, u1, prof, fam, lvl, cols, cap, mitre=(m0, self.mt[1] if end else 0))

    def block(self, u0, u1, z0, z1, role="face", off=0.0):
        """The armour over [u0, u1] x [z0, z1] (not across the bend), its front off in. Its ends on a tile's edge
        (not the face's own, unless it runs on into the next tile) take its front's tone: the next tile hides them,
        but where it meets this one on a slant on screen anti-aliasing mixes their samples in (dark, they read as
        dots); its other ends (a recess's walls) keep their own."""
        pf = self.sec.sec(z0, z1, off)
        cols = self.sec.cols(pf, role)

        def seam(u, e, t):
            return abs(u + 0.5 - round(u + 0.5)) < 1e-6 and not (abs(u - e) < 1e-6 and t != "cont")
        caps = tuple(cols[1] if seam(u, e, t) else None for u, e, t in ((u0, self.a, self.ends[0]),
                                                                         (u1, self.b, self.ends[1])))
        self.part(u0, u1, pf, cols, caps)

    def on(self, z0, z1, base, out, hang=True):
        """The section of a part on the front from `base` out to `out` (from the front, < 0: in); hang: whether one on
        the lean may stand out past the upright part's front by the bend (else it stops there)."""
        fr, up = self.sec.front(z0, z1), self.sec.front(0.0, 0.0)[0][0]
        lim = (lambda d, z: d) if hang or z0 < self.sec.zb - 1e-6 else (lambda d, z: min(d, up))
        return [(d + base, z) for d, z in fr] + [(lim(d + out, z), z) for d, z in fr[::-1]]

    def line(self, u0, u1, z0, z1, col, wrap=True, end=None, bevel=True, weight=None):
        """A painted band on the front (all but flush); one that does not wrap an outer corner stops at the edge
        seam along its chamfer (a px short of it). bevel: a px of highlight beside it, as hull 46's seams (a dark
        core, its lit edge): under a band along the face, on its +u side of one down it (the art mirrored, so both
        faces alike)."""
        short = 0.0 if wrap else LINE
        along = (u1 - u0) / LINE >= self.sec.sy(z0) - self.sec.sy(z1)
        length = (u1 - u0) / LINE if along else self.sec.sy(z0) - self.sec.sy(z1)
        w = weight if weight is not None else (LINE_W if bevel and length >= 6 else 1.0)
        c0, c1 = z0, z1                                 # (the core thinned to w px away from its lit edge:
        if along:                                       # coverage anti-aliasing tones it; short, paired and faint
            c1 = z0 + (z1 - z0) * w                     # lines stay whole)
            pf = self.on(c0, c1, -0.01, 0.001)
        else:
            pf = self.on(z0, z1, -0.01, 0.001)
        cu0 = u1 - (u1 - u0) * w if not along else u0
        self.part(cu0, u1, pf, [col] * len(pf), col, wrap=wrap, short=short, end=end)
        if not bevel:
            return
        hi = HILITE if z0 >= self.sec.zb - 1e-6 else YS[4]
        if along:
            pf = self.on(self.sec.z_at(z0, 1), z0, -0.01, 0.001)
            self.part(u0, u1, pf, [hi] * len(pf), hi, wrap=wrap, short=short, end=end)
        else:
            self.part(u1, u1 + LINE, pf, [hi] * len(pf), hi, end=False)

    def edge_u(self, z):
        """Where the front meets the outer corner's chamfer at height z, along the face."""
        return self.b + self.sec.front(z, z)[0][0] - self.ch(z)

    def edge_line(self, z0, z1, col, inset=0, w=1.0):
        """A painted band w px wide along the outer corner's chamfer edge on this face (each face its own), inset px
        in from it (under a px: coverage anti-aliasing tones it)."""
        from .factions_relief import prism
        if self.ch:
            ch, pf = self.ch, self.on(z0, z1, -0.01, 0.001)
            cols, cap = self._cols([col] * len(pf), col, len(pf))
            u1 = self.b - inset * LINE
            prism(self.k, self.ax, self.plane, u1 - w * LINE, u1, pf, F, 3, cols, cap,
                  mitre=(lambda d, z: ch(z) - d, lambda d, z: d - ch(z)))

    def raised(self, u0, u1, z0, z1, base, out, role="plate", col=None, cap=None, end=None):
        """A part on the front from `base` out to `out`, toned by role or all col; its ends cap (by default col, or
        the shell's tone for their facing: unlike on the two faces); not overhanging the upright part."""
        pf = self.on(z0, z1, base, out, hang=False)
        self.part(u0, u1, pf, [col] * len(pf) if col else self.sec.cols(pf, role), cap or col, end=end)

    def shade(self, u0, u1, z0, z1, col=YS[1], under=2, base=0.0, side=1.0):
        """Painted shade round a part a px proud over [u0, u1] x [z0, z1] on this face (or on a recess's floor base
        in from it): `side` px beside its far (-u) end and `under` px under it (the part hides half a px of that),
        where its unseen faces are (painted behind the part, over the seams: it hides the rest; never across the
        bend). (On the lean its side runs slant on screen: a px there breaks into dots, so it takes more.)"""
        zb = self.sec.zb if z0 >= self.sec.zb - 1e-6 else 0.0
        pf = self.on(max(zb, self.sec.z_at(z0, under)), z1, base - 0.01, base + SHADE)
        self.part(u0 - side * LINE, u1, pf, [col] * len(pf), col, end=False)

    def shade_chamfer(self, t0, t1, z0, z1, col=YS[1], under=2):
        """shade for a part over [t0, t1] of the outer corner's chamfer: a px beside both its ends (each side on)."""
        pf, p = self.on(self.sec.z_at(z0, under), z1, -0.01, SHADE), self.chamfer_t(1)
        self.on_chamfer(t0 - p, t1 + p, pf, [col] * len(pf), col)

    def chamfer_t(self, n):
        """How far across the outer corner's chamfer (0 the y face's edge, 1 the x face's) n art px are on screen,
        on its upright part (its full width)."""
        return n / (core.TILE_W * self.c)

    def on_chamfer(self, t0, t1, pf, cols, cap=None, fam=F, lvl=3):
        """A part on the outer corner's chamfer over [t0, t1] of its width (built by the y face, once)."""
        from .factions_relief import corner_piece
        if self.ch and self.ax == "y":
            cols, cap = self._cols(cols, cap, len(pf))
            corner_piece(self.k, self.b, self.plane, self.ch, pf, fam, lvl, cols, cap, t=(t0, t1))

    def top_line(self, u0, u1, d0, d1, col):
        """A painted band on the top over [u0, u1] x [d0, d1] (d from the block's face), mitred where it meets a
        face's outer end (the top's corner is square: the other face's band meets it on the diagonal)."""
        m0 = self.mt[0] if abs(u0 - self.a) < 1e-6 else 0.0
        m1 = 1.0 if self.ch or self.mt[1] else 0.0
        m1 = m1 if abs(u1 - self.b) < 1e-6 else 0.0
        pts = ((u0 - d0 * m0, d0), (u1 + d0 * m1, d0), (u1 + d1 * m1, d1), (u0 - d1 * m0, d1))
        self.k.poly([T.P(self.ax, self.plane, u, self.sec.H + PAINT, d) for u, d in pts],
                    F, 3, core.Vector((0, 0, 1)), fixed=DEBUG_COL if self.dbg else col)
