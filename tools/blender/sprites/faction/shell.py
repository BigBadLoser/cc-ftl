"""A faction look's shell: one LookShell (wall3d.Shell) for every look, its behaviour put together from the features
the look lists (its Style.features), each a small class with a say in a fixed set of hooks. Several features share a
hook in their list's order: the first to answer (anything but NO) decides. The ramp's foot (Style.foot) is the
shell's own, for any look: its run then ends on a cell line, where the upright foot is drawn (walls._foot_faces).

Also here: the end face's section and a chamfered corner's ramp plates, for the looks that cut their ends square."""
import math

from mathutils import Vector

from .. import wall3d as T
from .parts import LINE, OPP, PAINT

NO = object()                       # a hook's answer when the feature has no say


class Feature:
    """A shell feature: setup once the shell's rects are known, then its say in the hooks (NO: none)."""
    def setup(self, sp):
        pass

    def skip_skirt(self, sp, i, j):
        return False

    def cover(self, sp, i, j):
        return NO

    def cell_top(self, sp, i, j):
        return NO

    def drop_at(self, sp, x, y):
        return NO

    def col_skirt(self, sp, i, j, kind, x, y):
        return NO

    def col_face(self, sp, face, x, y, z):
        return NO


class LookShell(T.Shell):
    """wall3d.Shell built from the current look's features. What features may set on it: end_sides (free ends),
    holes (ramp holes: (ax, plane, u0, u1, d0, d1)), face_holes, keep / diag / skirt_halves (walls.Spec's corner cut),
    line (an outer corner's wall line), band (the ramp's chamfer width there) and clip (the cap's)."""
    line = None
    band = 0.0
    clip = 0.0

    def __init__(self, *args, **kw):
        super().__init__(*args, **kw)
        self.features = T.style().features
        self.foot = T.style().foot
        if self.foot:                                   # (its toe on a cell line, where the upright foot is drawn)
            self.run = math.ceil(self.run * T.W.GN - 1e-6) / T.W.GN
        self.end_sides, self.holes, self.face_holes = [], [], []
        for f in self.features:
            f.setup(self)

    def _ask(self, hook, *args):
        for f in self.features:
            v = getattr(f, hook)(self, *args)
            if v is not NO:
                return v
        return NO

    # -- the wall's free ends (FreeEnds sets end_sides) --
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

    # -- the ramp: its profile, with an outer corner's chamfer band (line, band) --
    def _cdist(self, x, y):
        """(distance from the wall's line with the corner chamfered, its rect, on the chamfer?). The chamfer is a band
        of constant width running straight out from the corner (its edges parallel, along x = y), so its slope is
        gentler than the faces' and meets them along those edges: its distance is (dx + dy + band) / 2."""
        d, r = self._dist(x, y)
        if self.line is None:
            return d, r, False
        c = (x - self.line[0] + y - self.line[1] + self.band) / 2
        return (c, r, True) if c > d + 1e-9 else (d, r, False)

    def skirtz(self, x, y):
        d = self._cdist(x, y)[0]
        if self.foot:
            return self.foot + (self.zs - self.foot) * (1.0 - d / self.run) if d <= self.run + 1e-9 else 0.0
        return self.zs * max(0.0, 1.0 - d / self.run)

    def cap_clip(self, q):                              # the far hull's armour plates cut on the corner's chamfer
        return self.line[0] + self.line[1] - self.clip - q[0] - q[1]

    # -- the hooks --
    def skip_skirt(self, i, j):                         # no ramp past a wall's end, nor over a hole cut in it
        c = {"x": (i + 0.5) / T.W.GN - 0.5, "y": (j + 0.5) / T.W.GN - 0.5}
        if any((c[s[1]] - p) * (1 if s[0] == "+" else -1) > 0 for s, p in self.end_sides):
            return True
        for ax, plane, u0, u1, d0, d1 in self.holes:
            u, d = (c["x"], c["y"] - plane) if ax == "y" else (c["y"], c["x"] - plane)
            if u0 < u < u1 and d0 < d < d1:
                return True
        if any(f.skip_skirt(self, i, j) for f in self.features):
            return True
        return super().skip_skirt(i, j)

    def cover(self, i, j):
        v = self._ask("cover", i, j)
        return super().cover(i, j) if v is NO else v

    def cell_top(self, i, j):
        v = self._ask("cell_top", i, j)
        return super().cell_top(i, j) if v is NO else v

    def drop_at(self, x, y):
        v = self._ask("drop_at", x, y)
        return super().drop_at(x, y) if v is NO else v

    def col_skirt(self, i, j, kind, x, y):
        v = self._ask("col_skirt", i, j, kind, x, y)
        return super().col_skirt(i, j, kind, x, y) if v is NO else v

    def col_face(self, face, x, y, z):
        v = self._ask("col_face", face, x, y, z)
        return super().col_face(face, x, y, z) if v is NO else v


# ---- features several looks use ----------------------------------------------------------------------------------

class FreeEnds(Feature):
    """A partition's free ends ("+x" | "-x" | "+y" | "-y", plane: a free side with an arm opposite and none beside
    it), where the wall stops square: no ramp past it (skip_skirt), the ramps beside it cut square (wall3d.skirt reads
    is_end) and no ramp across its end face (end_face)."""
    def setup(self, sp):
        for r in sp.rects:
            x0, x1, y0, y1 = r[0]
            pl = {"+x": x1, "-x": x0, "+y": y1, "-y": y0}
            for sd in pl:
                perp = ("+y", "-y") if sd[1] == "x" else ("+x", "-x")
                if (r[1] == "wall" and abs(pl[sd]) < 0.5 - 1e-9 and not sp._adj(r, sd)
                        and sp._adj(r, OPP[sd]) and not any(sp._adj(r, q) for q in perp)):
                    sp.end_sides.append((sd, T.snap(pl[sd])))


class RampHoles(Feature):
    """A ramp design's hole (its look's ramp_hole): (ax, plane, u0, u1, d0, d1), one per stretch."""
    def setup(self, sp):
        rh = T.style().ramp_hole
        hd = rh(T.VARIANT[1]) if rh and T.VARIANT[1] else None
        if hd:
            off = T.seam()
            for ax, plane, a, b, _ in T.faces(sp):
                for s0, s1 in T.spans(a, b):
                    if s1 - s0 > 2 * off + 0.3:
                        sp.holes.append((ax, T.snap(plane), s0 + off - hd[2], s1 - off + hd[2], hd[0] * sp.run,
                                         hd[1] * sp.run))


class SlotHoles(Feature):
    """The base design's handle slot cut into the ramp (its look's slot_hole: from, to down the slope as fractions of
    its run, half width), centred on each field, on the shell's grid."""
    def setup(self, sp):
        sh = T.style().slot_hole
        if sh and not T.VARIANT[1]:
            g = 1 / T.W.GN
            sn = lambda v: round(v / g) * g                                 # noqa: E731
            for ax, plane, a, b, _ in T.faces(sp):
                for s0, s1 in T.spans(a, b):
                    if s1 - s0 > 0.3:
                        uc = (s0 + s1) / 2
                        sp.holes.append((ax, T.snap(plane), sn(uc - sh[2]), sn(uc + sh[2]), sn(sh[0] * sp.run),
                                         sn(sh[1] * sp.run)))


class FaceHoles(Feature):
    """A top design's openings in the face (its look's face_holes): no shell face there (the design builds the
    opening's inside)."""
    def setup(self, sp):
        fh = T.style().face_holes
        if fh and T.VARIANT[0]:
            for ax, plane, a, b, top in T.faces(sp):
                sp.face_holes += [(ax, T.snap(plane)) + h for h in fh(a, b, sp.zs, top, T.VARIANT[0])]

    def col_face(self, sp, face, x, y, z):
        for ax, plane, u0, u1, z0, z1 in sp.face_holes:
            if face == ax and abs((y if ax == "y" else x) - plane) < 1e-6 and u0 < (x if ax == "y" else y) < u1 \
                    and z0 < z < z1:
                return None                             # (open)
        return NO


class Chamfer(Feature):
    """A partition's outer corner chamfered c along each axis down the wall and the ramp, the ramp's chamfer a band of
    constant width (LookShell._cdist), the cap's plates cut on it (not at a wall's free end: that is no corner)."""
    def __init__(self, c):
        self.c = c

    def setup(self, sp):
        for r in sp.rects:
            x0, x1, y0, y1 = r[0]
            if any(sd[0] == "+" for sd, _ in sp.end_sides):
                break
            if (not sp._adj(r, "+x") and not sp._adj(r, "+y") and x1 < 0.5 - 1e-9 and y1 < 0.5 - 1e-9
                    and sp.keep is None):
                sp.line = (T.snap(x1), T.snap(y1))
                sp.band = sp.clip = self.c
                lim = sp.line[0] + sp.line[1] - self.c + 1e-9
                sp.keep = lambda ci, cj: ci / T.W.GN - 0.5 + cj / T.W.GN - 0.5 <= lim
                sp.diag = sp.skirt_halves = True


class FloorDrop(Feature):
    """The faces reach the floor (no drop under it for a ghost's belly)."""
    def drop_at(self, sp, x, y):
        return 0.0


class FootTone(Feature):
    """The ramp's upright foot (the shell's foot) in a family's level (its y face's ramp; the x face's)."""
    def __init__(self, fam, lvl):
        self.fam, self.lvl = fam, lvl

    def col_face(self, sp, face, x, y, z):
        if z < sp.foot - 1e-6:
            return T.RAMPS[self.fam][0 if face == "y" else 1][self.lvl]
        return NO


# ---- the end face's section and a chamfered corner's ramp, for the looks that stop their ends square -------------

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
    run, ta = T.W.skirt_run(), T.style().toe_at
    nrm = Vector((zs / (2 * run), zs / (2 * run), 1.0)).normalized()

    def cq(t):                                          # the chamfer t down its slope: its two edges
        z = zs * (1 - t / run)
        return Vector((X - C + t, Y + t, z)), Vector((X + t, Y - C + t, z))
    for t0, t1, fam, lvl in ((0.02, ta * run, F, 3), (ta * run, run - 0.03, "ochre", 3), (run - 0.03, run, F, 2)):
        (a0, b0), (a1, b1) = cq(t0), cq(t1)
        k.poly([q + nrm * 2 * PAINT for q in (a0, b0, b1, a1)], fam, lvl, nrm)


def _end_section(k, ax, plane, a, b, zs, zt, F):
    """A wall's end face, under its face parts: the section of its foot and its two ramps down to the floor (each
    ending in an upright foot where the shell's ramps do), with edge highlights up its two edges (to zt) and down the
    ramps' slopes."""
    sh = T.SHELL
    run, ft = getattr(sh, "run", T.W.skirt_run()), max(getattr(sh, "foot", 0.0), 0.0035)
    sec = [(a - run, 0.0035), (b + run, 0.0035), (b + run, ft), (b, zs), (a, zs), (a - run, ft)]
    k.poly([T.P(ax, plane, u, z, 0.0) for u, z in (sec if ft > 0.0035 else sec[:2] + sec[3:5])], F, 2, T.OUT(ax))
    if ft > 0.0035:                                     # (the feet in the toe band's colour, on across the section)
        k.poly([T.P(ax, plane, u, z, PAINT) for u, z in ((a - run, 0.0035), (b + run, 0.0035), (b + run, ft),
                                                           (a - run, ft))],
               T.style().toe or F, 2, T.OUT(ax))
    hl = [[(b - LINE, zs), (b, zs), (b, zt), (b - LINE, zt)], [(a, zs), (a + LINE, zs), (a + LINE, zt), (a, zt)],
          [(b, zs), (b + run, ft), (b + run - 0.06, ft), (b, zs - 0.035)],
          [(a, zs), (a, zs - 0.035), (a - run + 0.06, ft), (a - run, ft)]]
    for q in hl:
        k.poly([T.P(ax, plane, u, z, PAINT) for u, z in q], F, 5, T.OUT(ax))
