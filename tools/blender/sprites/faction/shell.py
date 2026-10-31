"""Shell features several looks share (on wall3d.Shell): a partition's free ends, and the end face's section and a
chamfered corner's ramp plates for the looks that cut their ends square."""
from mathutils import Vector

from .. import wall3d as T
from .parts import LINE, OPP, PAINT


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

    def find_holes(self):
        """A ramp variant's holes (STYLE ramp_hole): (ax, plane, u0, u1, d0, d1), one per stretch."""
        self.holes = []
        rh = (T.STYLE or {}).get("ramp_hole")
        hd = rh(T.VARIANT[1]) if rh and T.VARIANT[1] else None
        if hd:
            off = (T.STYLE or {}).get("seam", T.STILE)
            for ax, plane, a, b, _ in T.faces(self):
                for s0, s1 in T.spans(a, b):
                    if s1 - s0 > 2 * off + 0.3:
                        self.holes.append((ax, T.snap(plane), s0 + off - hd[2], s1 - off + hd[2], hd[0] * self.run,
                                           hd[1] * self.run))

    def skip_skirt(self, i, j):                         # no ramp past a wall's end, nor over a ramp variant's hole
        c = {"x": (i + 0.5) / T.W.GN - 0.5, "y": (j + 0.5) / T.W.GN - 0.5}
        if any((c[s[1]] - p) * (1 if s[0] == "+" else -1) > 0 for s, p in self.end_sides):
            return True
        for ax, plane, u0, u1, d0, d1 in getattr(self, "holes", ()):
            u, d = (c["x"], c["y"] - plane) if ax == "y" else (c["y"], c["x"] - plane)
            if u0 < u < u1 and d0 < d < d1:
                return True
        return super().skip_skirt(i, j)


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
               (T.STYLE or {}).get("toe") or F, 2, T.OUT(ax))
    hl = [[(b - LINE, zs), (b, zs), (b, zt), (b - LINE, zt)], [(a, zs), (a + LINE, zs), (a + LINE, zt), (a, zt)],
          [(b, zs), (b + run, ft), (b + run - 0.06, ft), (b, zs - 0.035)],
          [(a, zs), (a, zs - 0.035), (a - run + 0.06, ft), (a - run, ft)]]
    for q in hl:
        k.poly([T.P(ax, plane, u, z, PAINT) for u, z in q], F, 5, T.OUT(ax))
