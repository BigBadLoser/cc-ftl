"""Breached walls in relief (derelict dressing; the wall3d.py look): tile.{wall|hull}.{full.|}m<mask>.breach[.v1|.v2]
(three tears, picked per tile by the renderer) and the intact neighbour's exposed end beside each,
tile.{wall|hull}.{full.|}breach.end.{w|n}[.v1|.v2] (the same variant as the breach it borders).

The wall is torn down along a few big teeth (never noise; each variant meets the tile edges at its own heights, so a
breached run steps at its seams), as clean straight cuts instead of the old cell staircase. Each arm is a solid cut by
the tear: its torn top shows the section (two lit skins round a dark core), the frame ribs stand up out of it, and the
face's relief (wall3d) is cut off along the tear with a lit torn edge. The skirt is whole; the cables hang out of the
tear as before."""
import math

from mathutils import Vector

from . import derelict_walls as DW
from . import wall3d as T
from . import walls as W
from .rockwall import faces
from .rockwall_stone import _end

T.RAMPS.setdefault("grey", (("dark", "steelD", "gmD", "gm", "plate", "plate"),
                            ("dark", "dark", "steelD", "gmD", "gm", "plate")))


# Variants: the tear (t, fraction from the tear bottom to the edge height; the teeth stand inside the tile and the
# edges end at each variant's own mid heights, so a breached run just steps at its seams, no tooth at every seam), the
# ribs (t, height fraction), lo (the tear bottom moved up / down: v2 is torn down to the skirt), keep (v1: the tear
# between these fractions of the wall's height, most of the wall left standing) and the cables (t, colour; v0 only)
# along a run along x / along y. The renderer picks one per tile by its hash.
VARIANTS = [
    {"tear": {"x": [(-0.5, 0.6), (-0.38, 0.92), (-0.27, 0.3), (-0.17, 0.62), (-0.06, 0.0), (0.12, 0.08), (0.24, 0.55),
                    (0.31, 0.2), (0.42, 0.85), (0.5, 0.5)],
              "y": [(-0.5, 0.5), (-0.4, 0.8), (-0.3, 0.15), (-0.12, 0.35), (0.0, 0.0), (0.16, 0.45), (0.27, 0.1),
                    (0.4, 0.9), (0.5, 0.6)]},
     "ribs": DW.RIBS, "lo": 0.0,
     "cables": {"x": ((-0.08, "hivis"), (0.14, "strap")), "y": ((0.0, "hivis"), (-0.27, "strap"))}},
    {"tear": {"x": [(-0.5, 0.7), (-0.3, 0.95), (-0.1, 0.55), (0.15, 0.6), (0.32, 0.9), (0.5, 0.75)],
              "y": [(-0.5, 0.65), (-0.25, 0.9), (0.0, 0.5), (0.25, 0.85), (0.5, 0.7)]},
     "ribs": {"x": [(-0.1, 1.15), (0.2, 1.1)], "y": [(-0.1, 1.15), (0.2, 1.1)]}, "keep": (0.6, 0.8), "lo": 0.0,
     "cables": None},
    {"tear": {"x": [(-0.5, 0.3), (-0.4, 0.55), (-0.32, 0.05), (-0.1, 0.0), (0.02, 0.45), (0.08, 0.4), (0.14, 0.0),
                    (0.32, 0.0), (0.42, 0.35), (0.5, 0.2)],
              "y": [(-0.5, 0.25), (-0.42, 0.5), (-0.35, 0.0), (-0.15, 0.05), (-0.05, 0.0), (0.12, 0.2), (0.22, 0.0),
                    (0.36, 0.1), (0.45, 0.55), (0.5, 0.3)]},
     "ribs": {"x": [(-0.2, 0.7), (0.24, 1.0)], "y": [(-0.25, 0.9), (0.3, 0.75)]}, "lo": -0.06, "cables": None},
]


def tear_range(fam, level, variant):
    """(tear bottom, edge height) of a variant: derelict_walls' range with the bottom moved by the variant's lo, or a
    variant's own keep (fractions of the wall's height: v1 leaves 60-80% of it standing)."""
    lo, edge = DW.tear_range(fam, level)
    v = VARIANTS[variant]
    if "keep" in v:
        top = W.wall_top(fam, level)
        lo, edge = top * v["keep"][0], top * v["keep"][1]
    return max(W.skirt_top() + 0.02, min(edge - 0.1, lo + v["lo"])), edge


class Stub(T.Shell):
    """The shell cut down to the skirt's height: the skirt and the arms' footprint; the arms themselves are solids."""
    def __init__(self, mask, fam, level, variant=0):
        super().__init__(mask, fam, level)
        self.v = VARIANTS[variant]
        self.lo, self.edge = tear_range(fam, level, variant)

    def cell_top(self, i, j):
        return self.zs if T.W.Strip.cell_top(self, i, j) is not None else None

    def topz(self, x, y):
        return self.zs

    def col_top(self, i, j, kind, x, y):
        return "wK"

    def axis(self, r):
        """The arm a rect belongs to: the post follows the run; an arm (or corner fill) beside the post runs along x,
        one above or below it along y."""
        if r is self.rects[0]:
            return "x" if (self.mask & 10 or not self.mask & 5) else "y"
        px0, px1 = self.rects[0][0][:2]
        return "x" if r[0][0] >= px1 - 1e-9 or r[0][1] <= px0 + 1e-9 else "y"

    def height(self, r, t):
        """The torn top of rect r at t along its arm."""
        return min(r[3], self.lo + (self.edge - self.lo) * DW._prof(self.v["tear"][self.axis(r)], t))

    def at(self, x, y):
        """The torn top at a point of the footprint (None off it)."""
        r = self._rect_at(x, y, 1e-9)
        if not r:
            return None
        return self.height(r, x if self.axis(r) == "x" else y)


def prism(k, sp, r, fam):
    """An arm cut by the tear: its sides, its torn top (lit skins round a dark core), its ends, its ribs."""
    x0, x1, y0, y1 = r[0]
    ax = sp.axis(r)
    a, b, c0, c1 = (x0, x1, y0, y1) if ax == "x" else (y0, y1, x0, x1)
    us = sorted({a, b} | {t for t, _ in sp.v["tear"][ax] if a < t < b})

    def Q(u, c, z):
        return Vector((u, c, z)) if ax == "x" else Vector((c, u, z))
    up, along, across = Vector((0, 0, 1)), Q(1, 0, 0), Q(0, 1, 0)
    for s0, s1 in zip(us, us[1:]):
        z0, z1 = sp.height(r, s0), sp.height(r, s1)
        for c, sgn in ((c1, 1), (c0, -1)):
            k.poly([Q(s0, c, 0), Q(s1, c, 0), Q(s1, c, z1), Q(s0, c, z0)], fam, 1, across * sgn)
        R = T.RAMPS[fam][0]                     # the section in fixed tones, whatever the tooth's slope
        for q0, q1, col in ((c0, c0 + T.LINE, R[4]), (c0 + T.LINE, c1 - T.LINE, R[1]), (c1 - T.LINE, c1, R[4])):
            k.poly([Q(s0, q0, z0), Q(s1, q0, z1), Q(s1, q1, z1), Q(s0, q1, z0)], fam, 0, up, fixed=col)
    R = T.RAMPS[fam][1 if ax == "y" else 0]     # its ends: the torn section too, so a step at a seam reads as torn
    for u, sgn in ((a, -1), (b, 1)):            # metal, not as the face of a box
        z = sp.height(r, u)
        for q0, q1, col in ((c0, c0 + T.LINE, R[4]), (c0 + T.LINE, c1 - T.LINE, R[1]), (c1 - T.LINE, c1, R[4])):
            k.poly([Q(u, q0, 0), Q(u, q1, 0), Q(u, q1, z), Q(u, q0, z)], fam, 0, along * sgn, fixed=col)
    cm, w = (c0 + c1) / 2, 0.03
    for t, h in sp.v["ribs"][ax]:
        if a + w < t < b - w:
            zt = min(r[3] - 0.12, sp.lo + (sp.edge - sp.lo) * h)
            pts = [(t - w, cm - w), (t + w, cm - w), (t + w, cm + w), (t - w, cm + w)]
            T.raised(k, [p if ax == "x" else (p[1], p[0]) for p in pts], 0.0, zt, "grey", 2)


def cables(m, fam, mask, level, cs):
    """derelict_walls._cables, hung clear of the face's relief (behind its posts and bands they read as dashes)."""
    lo, _ = DW.tear_range(fam, level)
    yf = (-0.5 + W.hull_thick()) if fam == "hull" else (-0.5 + W.wall_back() + W.TW)
    yf += T.PX + 0.01
    run, zs = W.skirt_run(), W.skirt_top()
    sides = []
    if mask & 10 or not mask & 5:
        sides.append(("x", *cs["x"]))
    if mask & 5 and not mask & 10:
        sides.append(("y", *cs["y"]))
    for ax, *cs in sides:
        for t, col in cs:
            n = 14
            for i in range(n):
                f0, f1 = i / n, (i + 1) / n
                z0, z1 = (lo + 0.02) * (1 - f0), (lo + 0.02) * (1 - f1)
                d0 = yf + max(0.0, zs - z0) / zs * run * 0.9                # follows the skirt once below its top
                d1 = yf + max(0.0, zs - z1) / zs * run * 0.9
                sway = 0.03 * math.sin(f0 * 2.5 + t * 7)
                pa = (t + sway, d0) if ax == "x" else (d0, -t + sway)
                pb = (t + sway, d1) if ax == "x" else (d1, -t + sway)
                m.box(((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (z0 + z1) / 2), (0.045, 0.045, abs(z0 - z1) + 0.02),
                      col)
            end = (t + 0.05, yf + run * 0.95) if ax == "x" else (yf + run * 0.95, -t + 0.05)
            m.box((end[0], end[1], 0), (0.07, 0.07, 0.04), "brass", base=True)


def breach(mask, fam, level, variant=0):
    sp = Stub(mask, fam, level, variant)
    k = T.Relief(f"wall3d_breach_{fam}_{mask}_{level}_{variant}")
    T.W.emit(k.m, sp)
    for r in sp.rects:
        k.side = None
        prism(k, sp, r, "blue" if r[1] == "hull" else "wall")
    for ax, plane, a, b, top in faces(sp):
        e = 1e-3
        um = (a + b) / 2
        r = sp._rect_at(*((um, plane - e) if ax == "y" else (plane - e, um)), 0.0)
        hull = r is not None and r[1] == "hull"
        plane = T.snap(plane)
        k.side = ax
        T.skirt(k, sp, ax, plane, a, b, "blue" if hull else "wall")
        full = top > W.skirt_top() + W.CUT + 0.05
        ends = (_end(sp, ax, plane, a, -1), _end(sp, ax, plane, b, 1))
        T.CLIP = (lambda u, ax=ax, plane=plane: sp.at(*((u, plane - e) if ax == "y" else (plane - e, u))) or 0.0)
        try:
            if hull:
                T.hull_face(k, ax, plane, a, b, ends, sp.zs, top, full, 0)
            else:
                T.wall_face(k, ax, plane, a, b, ends, sp.zs, top, full)
        finally:
            T.CLIP = None
    if sp.v["cables"]:
        cables(k.m, fam, mask, level, sp.v["cables"])
    return [k.m.build()]


def breach_end(fam, side, level, variant=0):
    """The intact neighbour's end, exposed at the -x (w) / -y (n) edge of a breached piece, from the variant's tear
    height at that edge to the wall top: the wall3d.end_face section (one face, a dark outline, a lit lip under the
    cap)."""
    lo, hi = tear_range(fam, level, variant)
    edge = lo + (hi - lo) * VARIANTS[variant]["tear"]["x" if side == "w" else "y"][0][1]
    top = W.wall_top(fam, level)
    if fam == "hull":
        a, b = 0.0, W.hull_thick() + T.PX
    else:
        a, b = W.wall_back(), W.wall_back() + W.TW + T.PX
    ax = "x" if side == "w" else "y"
    F = "blue" if fam == "hull" else "wall"
    k = T.Relief(f"wall3d_breach_end_{fam}_{side}_{level}_{variant}")
    k.side = ax

    def quad(u0, u1, z0, z1, lvl, d=0.0):
        k.poly([T.P(ax, -0.5, u - 0.5, z, d) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], F, lvl, T.OUT(ax))
    quad(a, b, edge, top, 2)
    quad(a, a + T.LINE, edge, top, 1, T.PAINT)
    quad(b - T.LINE, b, edge, top, 1, T.PAINT)
    quad(a, b, top - 0.026, top, 4, T.PAINT)
    return [k.m.build()]


PRE = {"up": "full.", "cut": ""}
SPRITES = []
for _fam in ("wall", "hull"):
    for _lv, _pre in PRE.items():
        for _m in range(16):
            for _v in range(len(VARIANTS)):
                SPRITES.append((f"tile.{_fam}.{_pre}m{_m}.breach{f'.v{_v}' if _v else ''}", (1, 1), "block",
                                lambda m=_m, f=_fam, lv=_lv, v=_v: breach(m, f, lv, v)))
        for _v in range(len(VARIANTS)):
            for _s in ("w", "n"):
                SPRITES.append((f"tile.{_fam}.{_pre}breach.end.{_s}{f'.v{_v}' if _v else ''}", (1, 1), "block",
                                lambda s=_s, f=_fam, lv=_lv, v=_v: breach_end(f, s, lv, v)))
