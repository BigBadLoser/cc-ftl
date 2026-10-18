"""Wall and hull blocks (grid frame, origin = tile centre at floor level). Surface colours: wallart.py.

Profile (after Space Haven, measured): a vertical wall with a flat cap stands on a straight sloped SKIRT (rise SKIRT * HF
at 55 degrees). A partition is a TW band set back from the tile's far edges (-x, -y: away from the camera, which sees +x,
+y and the tops) by wall_back(), with an arm to every connected side; its front skirt toe reaches the tile's near edge,
and a back skirt stays hidden behind it. The far hull is a thicker strip along the far edges whose skirt also reaches the
near edge; an arm off a straight hull run is a partition. Skirts are mitred at corners and ends (L-inf distance).

View levels (LEVELS): up = everything full height; cut = partitions cut CUT above the skirt (black cut cap), the rear
hull stays full; low = partitions are skirt-high stubs and every hull side is a ghost. The skirt is the same in every
level. Hull ghosts (hull.py) are low near-black rims with the below-deck belly hanging from the camera-facing sides.

Every piece is a heightfield on a 32x32 cell grid (`Spec`): covered cells are the wall body (top surface at topz), the
others are skirt (skirtz) or floor; camera-facing vertical faces are emitted where the body ends or steps down. Cells may
be half cells (a triangle) for 45 degree chamfers."""
import math

from . import core
from . import wallart as A

GN = 32
# Heights (tiles; crew are 1.5 tall). Interior walls rise to HF; the roof is a ROOF_T slab on top of them (HF .. HF +
# ROOF_T, roofs.ZR is its top); the hull rises to the roof's top so the roof sits flush with it. Everything else is
# derived from HF when a piece is built, so HF stays the single height knob.
HF = 1.85          # interior wall height (chosen by the user)
ROOF_T = 0.2       # roof slab thickness
SKIRT = 0.30       # skirt rise as a fraction of HF (Space Haven: about 0.3 of the wall), the same in every view level
SLOPE = math.tan(math.radians(55))   # skirt rise / run (Space Haven: 55 degrees)
CUT = 0.2          # cutaway: the wall face kept above the skirt
T = TW = 10 / 32   # partition thickness (Space Haven: cap 19-22 px on a 64 px tile, minus a 2 px outline: ~0.30)
ZG = 0.30          # ghost hull: front rim top AND rear crest height (one value, so they meet flush at corners)
DROP = 1.5         # ghost hull: the below-deck belly's depth on the camera-facing sides (13.webp: ~1.2 tiles)
CURVE = 0.35       # ... of which the last part curves back under the ship
BEV = 3 / 32       # ghost rim: narrow lit chamfer on its outer edge
H = 0.5            # (compat) legacy cut height, unused by the wall pieces
DZ = 1 / 40        # vertical face row height (about 1 px)
BIT = {"n": 1, "e": 2, "s": 4, "w": 8}
EDGES = {"f": "y0y1x0x1", "se": "y0x0", "nw": "y1x1", "ne": "y1x0", "sw": "y0x1"}
TRI = {"se": (0, 1, 3), "nw": (1, 2, 3), "ne": (0, 2, 3), "sw": (0, 1, 2)}   # kept corners of a half cell
LEVELS = ("up", "cut", "low")        # walls up / cutaway / shortest (see wall_top)


def hull_top():
    """Top of the full-height hull: the roof slab's top."""
    return HF + ROOF_T


def skirt_top(level="up"):
    return SKIRT * HF


def skirt_run(level="up"):
    return skirt_top() / SLOPE


def hull_thick():
    """The far hull stands at the tile's far edge; its skirt toe reaches the near edge (Space Haven)."""
    return max(TW, 1.0 - skirt_run())


def wall_back():
    """A partition is set back from the tile's far edge by this much (a hidden back skirt), so its front skirt toe
    reaches the near tile edge as in Space Haven, at the measured slope and thickness."""
    return max(0.0, math.floor((1.0 - TW - skirt_run()) * GN) / GN)      # snapped to the cell grid


def wall_top(fam, level):
    """up: everything full. cut: partitions cut CUT above the skirt, the (rear) hull stays full. low: partitions are
    skirt-high stubs (the hull is a ghost there, see hull.py)."""
    if fam == "hull":
        return hull_top() if level != "low" else ZG
    return {"up": HF, "cut": skirt_top() + CUT, "low": skirt_top()}[level]


def profile(fam, level):
    """(wall thickness, wall top z, skirt top z)."""
    return (hull_thick() if fam == "hull" else TW), wall_top(fam, level), skirt_top()


def lerp(a, b, t):
    return a + (b - a) * t


def half_cell(keep, i, j):
    """Cell coverage from a corner predicate keep(ci, cj) on integer corner indices: 'f', a half-cell key or None."""
    k = [keep(i, j), keep(i + 1, j), keep(i + 1, j + 1), keep(i, j + 1)]
    n = sum(k)
    if n == 4:
        return "f"
    if n == 3:
        return ("nw", "ne", "se", "sw")[k.index(False)]
    return None


def _kind(pts):
    """Surface orientation of a planar polygon: flat, y / x (falls toward +y / +x), d (toward both), h (hip)."""
    (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = pts[:3]
    det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
    gx = ((z1 - z0) * (y2 - y0) - (z2 - z0) * (y1 - y0)) / det
    gy = ((x1 - x0) * (z2 - z0) - (x2 - x0) * (z1 - z0)) / det
    e = 1e-6
    if abs(gx) < e and abs(gy) < e:
        return "flat"
    if abs(gx) < e and gy < 0:
        return "y"
    if abs(gy) < e and gx < 0:
        return "x"
    if gx < 0 and gy < 0 and abs(gx - gy) < e:
        return "d"
    return "h"


class Spec:
    """Base heightfield piece. Subclasses define cover, topz, skirtz and the colour callbacks."""
    open_y = open_x = False      # tile boundary +y / +x edges get a vertical face where the body reaches them
    drop_y = drop_x = False      # ... reaching down to -drop_z (the hull ghost's belly) instead of the floor
    drop_z = DROP
    part = None                  # None = whole piece; "rim" = above the deck only; "belly" = the dropped part only
    diag = False                 # 'se' half cells get a camera-facing 45 degree face (reaching -DROP)

    def cover(self, i, j):
        return None

    def topz(self, x, y):
        return 0.0

    def cell_top(self, i, j):
        """Flat top height of a covered cell, or None to use topz at the corners (sloped tops)."""
        return None

    def skirtz(self, x, y):
        return 0.0

    def skip_skirt(self, i, j):
        return False

    def face_lo(self, x, y):
        return None

    def drop_at(self, x, y):
        return self.drop_z

    def belly(self, m, face, a, b):
        """Extra geometry hung under a dropped face (the ghost's curved belly)."""

    def col_top(self, i, j, kind, x, y):
        raise NotImplementedError

    def col_skirt(self, i, j, kind, x, y):
        raise NotImplementedError

    def col_face(self, face, x, y, z):
        raise NotImplementedError


def _polys(Pz, cv):
    if cv not in (None, "f"):
        return [[Pz[k] for k in TRI[cv]]]
    z = [p[2] for p in Pz]
    if abs(z[0] + z[2] - z[1] - z[3]) < 1e-9:
        return [Pz]
    if abs(z[0] - z[2]) <= abs(z[1] - z[3]):
        return [[Pz[0], Pz[1], Pz[2]], [Pz[0], Pz[2], Pz[3]]]
    return [[Pz[0], Pz[1], Pz[3]], [Pz[1], Pz[2], Pz[3]]]


def _face(m, sp, face, a, b, za, zt):
    """Vertical face over the ground segment a -> b (screen left to right), bottoms za, tops zt (per endpoint)."""
    h = max(zt[0] - za[0], zt[1] - za[1])
    if h <= 1e-6:
        return
    n = max(1, int(round(h / DZ)))
    xm, ym = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    for k in range(n):
        t0, t1 = k / n, (k + 1) / n
        p0, p1 = lerp(za[0], zt[0], t0), lerp(za[1], zt[1], t0)
        q0, q1 = lerp(za[0], zt[0], t1), lerp(za[1], zt[1], t1)
        col = sp.col_face(face, xm, ym, (p0 + p1 + q0 + q1) / 4)
        if col is None:
            continue
        m.poly([core.G(a[0], a[1], p0), core.G(b[0], b[1], p1), core.G(b[0], b[1], q1), core.G(a[0], a[1], q0)], col)


def emit(m, sp):
    """Add a Spec's surfaces to mesh m."""
    cov = [[sp.cover(i, j) for j in range(GN)] for i in range(GN)]
    has = lambda i, j, e: 0 <= i < GN and 0 <= j < GN and cov[i][j] is not None and e in EDGES[cov[i][j]]  # noqa: E731
    for j in range(GN):
        for i in range(GN):
            x0, y0 = i / GN - 0.5, j / GN - 0.5
            x1, y1 = x0 + 1 / GN, y0 + 1 / GN
            P = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
            cv = cov[i][j]
            if sp.part == "belly":
                continue
            if cv:
                ct = sp.cell_top(i, j)
                Pz = [(x, y, sp.topz(x, y) if ct is None else ct) for x, y in P]
                for poly in _polys(Pz, cv):
                    m.poly([core.G(*p) for p in poly], sp.col_top(i, j, _kind(poly), (x0 + x1) / 2, (y0 + y1) / 2))
            elif not sp.skip_skirt(i, j):
                Pz = [(x, y, sp.skirtz(x, y)) for x, y in P]
                if max(p[2] for p in Pz) < 1e-9:
                    continue
                for poly in _polys(Pz, None):
                    m.poly([core.G(*p) for p in poly], sp.col_skirt(i, j, _kind(poly), (x0 + x1) / 2, (y0 + y1) / 2))
    for j in range(GN):
        for i in range(GN):
            cv = cov[i][j]
            if not cv:
                continue
            x0, y0 = i / GN - 0.5, j / GN - 0.5
            x1, y1 = x0 + 1 / GN, y0 + 1 / GN
            for face, a, b, edge, nb, opp, last, op, dr in (
                    ("y", (x0, y1), (x1, y1), "y1", (i, j + 1), "y0", j == GN - 1, sp.open_y, sp.drop_y),
                    ("x", (x1, y1), (x1, y0), "x1", (i + 1, j), "x0", i == GN - 1, sp.open_x, sp.drop_x)):
                if edge not in EDGES[cv] or (last and not op) or (sp.part == "belly" and not (last and dr)):
                    continue
                ct = sp.cell_top(i, j)
                if has(*nb, opp):
                    cn = sp.cell_top(*nb)
                    if ct is None or cn is None or cn >= ct - 1e-6:
                        continue
                    _face(m, sp, face, a, b, (cn, cn), (ct, ct))     # step down to a lower neighbour
                    continue
                if last and dr:
                    zd = 0.0 if sp.part == "rim" else -sp.drop_at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                    za = (zd, zd)
                else:
                    za = (sp.skirtz(*a), sp.skirtz(*b))
                lo = sp.face_lo(*a), sp.face_lo(*b)
                za = tuple(z if q is None else max(z, q) for z, q in zip(za, lo))
                zt = (sp.topz(*a), sp.topz(*b)) if ct is None else (ct, ct)
                if sp.part == "belly":
                    zt = (0.0, 0.0)
                _face(m, sp, face, a, b, za, zt)
                if last and dr and sp.part != "rim":
                    sp.belly(m, face, a, b)
            if cv == "se" and sp.diag:
                a, b = (x0, y1), (x1, y0)
                zd = 0.0 if sp.part == "rim" else -sp.drop_at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                zt = (0.0, 0.0) if sp.part == "belly" else (sp.topz(*a), sp.topz(*b))
                _face(m, sp, "d", a, b, (zd, zd), zt)
                if sp.part != "rim":
                    sp.belly(m, "d", a, b)


# ---- far walls: interior partitions and the far hull -------------------------------------------------------------

class Strip(Spec):
    """A far wall piece. Partitions: a TW band set back by wall_back() from the far edges, an arm to every connected
    side, skirts all round (the front one reaches the near tile edge; the back one is hidden behind the wall). Hull: a
    hull_thick() strip along the far edges; an arm off a straight hull run is a partition at the partitions' offset."""

    def __init__(self, mask, fam, level, variant=0):
        self.mask, self.fam, self.level, self.variant = mask, fam, level, variant
        self.full = level == "up"
        t, self.top, self.zs = profile(fam, level)
        self.run = skirt_run()
        p0 = -0.5 + wall_back()
        p1 = p0 + TW
        wt = wall_top("wall", level)
        R = []
        if fam == "hull":
            R.append(((-0.5, -0.5 + t, -0.5, -0.5 + t), "hull", t, self.top))
            if mask & 2:
                R.append(((-0.5 + t, 0.5, p0, p1), "wall", TW, wt) if mask & 5 == 5 else
                         ((-0.5 + t, 0.5, -0.5, -0.5 + t), "hull", t, self.top))
            if mask & 4:
                R.append(((p0, p1, -0.5 + t, 0.5), "wall", TW, wt) if mask & 10 == 10 else
                         ((-0.5, -0.5 + t, -0.5 + t, 0.5), "hull", t, self.top))
        else:
            R.append(((p0, p1, p0, p1), "wall", TW, wt))
            for bit, box in ((1, (p0, p1, -0.5, p0)), (8, (-0.5, p0, p0, p1)), (2, (p1, 0.5, p0, p1)),
                             (4, (p0, p1, p1, 0.5))):
                if mask & bit:
                    R.append((box, "wall", TW, wt))
        self.rects = R
        k = round(t * GN)
        self.keep = (lambda ci, cj: ci + cj >= k) if fam == "hull" and mask == 6 else None   # chamfered outer corner

    def _rect_at(self, x, y, e=1e-9):
        for r in self.rects:
            x0, x1, y0, y1 = r[0]
            if x0 - e < x < x1 + e and y0 - e < y < y1 + e:
                return r
        return None

    def cover(self, i, j):
        cx, cy = (i + 0.5) / GN - 0.5, (j + 0.5) / GN - 0.5
        if not self._rect_at(cx, cy, 0.0):
            return None
        return half_cell(self.keep, i, j) if self.keep else "f"

    def topz(self, x, y):
        return self.top

    def cell_top(self, i, j):
        r = self._rect_at((i + 0.5) / GN - 0.5, (j + 0.5) / GN - 0.5, 0.0)
        return r[3] if r else None

    def _dist(self, x, y):
        best = (1e9, None)
        for r in self.rects:
            x0, x1, y0, y1 = r[0]
            d = max(x0 - x, x - x1, y0 - y, y - y1, 0.0)
            if d < best[0]:
                best = (d, r)
        return best

    def skirtz(self, x, y):
        z = 0.0
        for r in self.rects:
            x0, x1, y0, y1 = r[0]
            d = max(x0 - x, x - x1, y0 - y, y - y1, 0.0)
            z = max(z, self.zs * max(0.0, 1.0 - d / self.run))
        return z

    def col_top(self, i, j, kind, x, y):
        r = self._rect_at(x, y) or self.rects[0]
        if r is self.rects[0]:
            along_x = bool(self.mask & 2) or not self.mask & 4
        else:
            along_x = r[0][1] == 0.5 or r[0][0] == -0.5
        s, w = (x + 0.5, r[0][3] - y) if along_x else (0.5 - y, r[0][1] - x)
        return A.hull_cap(s, w, r[2], self.variant, r[1])

    def col_skirt(self, i, j, kind, x, y):
        d, r = self._dist(x, y)
        run = self.run
        s = x + 0.5 if kind == "y" else 0.5 - y
        if r[1] == "hull":
            return A.hull_skirt(kind, s, d, run, self.variant)
        return A.wall_skirt(kind, s, d, run, True)

    def col_face(self, face, x, y, z):
        e = 0.5 / GN
        r = self._rect_at(x, y - e) if face == "y" else self._rect_at(x - e, y)
        s = x + 0.5 if face == "y" else 0.5 - y
        top = r[3] if r else self.top
        if r and r[1] == "hull":
            return A.hull_inner_face(face, s, z, top, self.zs, True, self.variant)
        return A.wall_face(face, s, z, top, self.zs, self.full)


def block(mask, fam, deco=None, name=None, level="cut"):
    """A far wall / far hull piece at a view level. deco: hull colour variant (1 = ochre plate)."""
    m = core.Mesh(name or f"wall_{fam}_{mask}_{level}", flat=True)
    emit(m, Strip(mask, fam, level, 1 if deco == 1 else 0))
    return [m.build()]


def end_face(fam, side, level="up"):
    """Overlay where a wall or far hull butts into the low hull ghost (+y / +x neighbour): the cross-section of the
    wall and its skirts above the ghost rim (ZG). side s: the +y end of an S arm, e: the +x end of an E arm."""
    t, top, zs = profile(fam, level)
    run = skirt_run()
    lo, hi = (0.0, t) if fam == "hull" else (wall_back(), wall_back() + TW)
    m = core.Mesh(f"end_{fam}_{side}_{level}", flat=True)
    R = A.ramp("blue" if fam == "hull" else "wall", "y" if side == "s" else "x")
    for c in range(GN):
        u0, u1 = c / GN, (c + 1) / GN
        um = (u0 + u1) / 2
        body = lo <= um < hi
        zt = top if body else zs * max(0.0, 1.0 - max(lo - um, um - hi) / run)
        if zt <= ZG + 1e-6:
            continue
        rows = max(1, int(round((zt - ZG) / DZ)))
        for k in range(rows):
            z0, z1 = ZG + (zt - ZG) * k / rows, ZG + (zt - ZG) * (k + 1) / rows
            if body:
                col = R["H"] if z1 > top - 0.05 else (R["L"] if u0 <= lo + 1e-9 else R["M"])
            else:
                col = R["H"] if k == rows - 1 else R["M"]      # the skirt's cut section, in the skirt's own tone
            if side == "s":
                a, b = (-0.5 + u0, 0.5), (-0.5 + u1, 0.5)
            else:
                a, b = (0.5, -0.5 + u0), (0.5, -0.5 + u1)
            m.poly([core.G(*a, z0), core.G(*b, z0), core.G(*b, z1), core.G(*a, z1)], col)
    return [m.build()]
