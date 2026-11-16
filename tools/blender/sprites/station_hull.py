"""Station hull look (#524; family `station_hull`): a station's hull from outside (roofed), on the ship hull's own belly.
After the user's station hull reference (design reference only: our own geometry here). Built as the ship hull is
(wall3d_ext: the shell block, its outer faces dressed through wall3d_ext_geom's Face), on a section of its own
(RoundSection): upright from the floor, then rounded over into the top in a big bullnose, lit in bands from its top
edge down. Two seams a tile run up the face, plumb on screen up to the bullnose's lower bands and following it over
into the top, to a seam across the top; a groove near the foot with tabs where the seams cross it, a line under the
bullnose from seam to seam, a bright ledge with a row of chunky light blocks along the foot, a line along the top's
back. Its own palette set (`station`).

Ids follow the faction looks' scheme (structure.py: tile.<fam>.<look>.<rest of the default id>), look `station`:

  tile.hull.station.ext.o<o>.m<mask>   the upper hull (as tile.hull.ext.o<o>.m<mask>: o 1 space at +y, 2 at +x, 3 both,
                                       the outer corner; mask the hull ring's neighbours); the belly is the ship's."""
import math

from mathutils import Vector

from . import core
from . import wall3d as T
from .wall3d_ext import STRAIGHT, ext_shell
from .wall3d_ext_geom import D, E, F, LINE, Face, Section

R_D, R_Z = 0.32, 0.46               # the bullnose: this far in along the top, this far down the face (tiles)
ROUND = 16                          # its facets
CORNER_C = 16 / 32                  # the outer corner's chamfer along each axis (the ship hull's)
SEAMS = (0.25, 0.75)                # seams across a tile, as fractions of it
GROOVE = 0.40                       # the groove's height over the deck
UNDER = 3                           # the line under the bullnose: this many px under its foot
RAIL = 3 / 32                       # the line along the top's back: this far in from the back
TOP_SEAM = 7 / 32                   # the seam across the top this far in past the bullnose's top edge (the seams end on it)
FOOT_N, FOOT_W, FOOT_OUT, FOOT_H = 3, 0.26, 3 / 32, 0.15   # the foot blocks: a tile, wide, proud, tall
LEDGE_H = 2                         # the bright ledge along the foot, px tall
SEAM_W = 1.0                        # the seams' core, px (the hull's long lines: LINE_W, with coverage AA)
CHAMFER_SEAM = 1                    # the corner's seams down its chamfer, this many px in from its edges

FACE, FACE_LO, END, TOP = "stS", "stL", "stE", "stL"      # the face, its band under the groove, the shell, the top
# the bullnose's bands from its top edge down to the face: colour, share of the arc (the lightest the widest)
BANDS = (("stW", 0.36), ("stB", 0.26), ("stH", 0.18), ("stL", 0.12), ("stS", 0.08))
PLUMB_BAND = 3                      # the seams stand plumb on screen from this band's top down (stL)
SEAM, GROOVE_D, GROOVE_L, UNDER_L = "stM", "stD", "stH", "stH"
TAB, TAB_TOP, TAB_SIDE = "stB", "stW", "stH"
FOOT, FOOT_TOP, FOOT_SIDE, LEDGE = "stB", "stW", "stH", "stW"


def _band(t):
    """The bullnose's colour at t along its arc from its top edge (0) to the face (1)."""
    for col, w in BANDS:
        if t < w:
            return col
        t -= w
    return BANDS[-1][0]


class RoundSection(Section):
    """wall3d_ext_geom's Section with a bullnose for its lean: upright to the bend zb, then a quarter ellipse R_D in
    and R_Z up to the top (the armour's front d out from its own face, D on the upright)."""

    def __init__(self, H):
        super().__init__(H)
        self.zb = H - R_Z
        self.levels = [self.zb + R_Z * math.sin(math.pi / 2 * i / ROUND) for i in range(ROUND + 1)]

    def _angle(self, z):
        return math.asin(min(1.0, max(0.0, (z - self.zb) / R_Z)))

    def lean_d(self, z):
        return D - R_D * (1 - math.cos(self._angle(z)))

    def lean(self, z0=0.0):
        z = max(z0, self.zb)
        return [(self.lean_d(v), v) for v in [z] + [v for v in self.levels if v > z + 1e-9]]

    def front(self, z0, z1, off=0.0):
        """The front from z0 to z1 (across the bend and over the bullnose: its facets' levels between)."""
        lo, hi = min(z0, z1), max(z0, z1)
        mid = [v for v in [self.zb] + self.levels if lo + 1e-9 < v < hi - 1e-9]
        zs = [z0] + (mid if z1 >= z0 else mid[::-1]) + [z1]
        return [(self.lean_d(z) - off, z) for z in zs]

    def band_z(self, i):
        """The height of the bullnose's band i's top edge (0 the top)."""
        t = sum(w for _, w in BANDS[:i])
        return self.zb + R_Z * math.sin(math.pi / 2 * (1 - t))

    def chamfer(self, c):
        return lambda z: c

    def cols(self, prof, role):
        """Edge tones by facing and height: the top TOP, the bullnose its bands, the face FACE (FACE_LO under the
        groove); faces turned back or down unseen."""
        n = len(prof)
        dc, zc = sum(p[0] for p in prof) / n, sum(p[1] for p in prof) / n
        out = []
        for i in range(n):
            (d0, z0), (d1, z1) = prof[i], prof[(i + 1) % n]
            pd, pz = z1 - z0, d0 - d1
            if pd * ((d0 + d1) / 2 - dc) + pz * ((z0 + z1) / 2 - zc) < 0:
                pd, pz = -pd, -pz
            h = math.hypot(pd, pz) or 1.0
            pd, pz, zm = pd / h, pz / h, (z0 + z1) / 2
            if pz > 0.85 and min(z0, z1) >= self.H - T.LIP - 1e-6:
                out.append(TOP)
            elif pd < 0.3 and pz < 0.3:
                out.append(None)
            elif zm > self.zb + 1e-6:
                out.append(_band(1 - self._angle(zm) / (math.pi / 2)))
            else:
                out.append(FACE if zm > GROOVE else FACE_LO)
        return out


class RoundFace(Face):
    def plumb(self, u0, u1, z0, z1, zk, col, w=None):
        """A band [u0, u1] (its core w px, as Face.line's) up the front from z0 to z1: over zk it follows the front
        (Face.line), under it it stands plumb on screen under where it is at zk (screen x goes as u - d: it moves
        along the face as far as the front stands out)."""
        u0 = u1 - (u1 - u0) * (SEAM_W if w is None else w)
        if z1 > zk:
            self.line(u0, u1, zk, z1, col, bevel=False, weight=1.0)
        dk = self.sec.lean_d(zk)
        pts = self.sec.front(z0, min(z1, zk))
        col = T.SEAM_PASS or col
        o, up = T.OUT(self.ax), Vector((0, 0, 1))
        for (da, za), (db, zb) in zip(pts, pts[1:]):
            sa, sb = da - dk, db - dk
            q = [T.P(self.ax, self.plane, u + s, z, d + 0.001) for u, s, z, d in
                 ((u0, sa, za, da), (u1, sa, za, da), (u1, sb, zb, db), (u0, sb, zb, db))]
            self.k.poly(q, F, 3, o * (zb - za) + up * (da - db), fixed=col)

    def at_face(self, u, zk):
        """Where a plumb band at u (plumb under zk) stands on the upright face."""
        return u + D - self.sec.lean_d(zk)


def _part(f, u0, u1, z0, z1, out, face, top, side, end=False):
    """A block on the upright face over [u0, u1] x [z0, z1], out proud: its front `face`, its top `top`, its ends
    `side`."""
    pf = f.on(z0, z1, -0.01, out, hang=False)
    f.part(u0, u1, pf, [None, top, face, None], side, end=end)


def _chamfer_part(f, t0, t1, z0, z1, out, face, top, side):
    pf = f.on(z0, z1, -0.01, out, hang=False)
    f.on_chamfer(t0, t1, pf, [None, top, face, None], side)


def build(k, ax, plane, a, b, ends, H):
    """The station's armour over [a, b] of a face (wall3d's face arguments)."""
    s = RoundSection(H)
    f = RoundFace(k, ax, plane, a, b, ends, s, CORNER_C)
    back = min((r[0][2] if ax == "y" else r[0][0]) for r in T.SHELL.rects if r[1] == "hull") - plane
    zk = s.band_z(PLUMB_BAND)
    zt = s.z_at(s.zb, UNDER)
    g0, g1 = s.z_at(GROOVE, 2), s.z_at(GROOVE, -3)          # a tab over the groove
    ts = E - round((R_D + TOP_SEAM) * 32) / 32               # (the top's lines on the art px grid: clean iso lines)
    rail = back + RAIL
    for s0, s1 in T.spans(a, b):
        whole = s1 - s0 > 1 - 1e-6
        for z0, z1 in ((0.0, GROOVE), (GROOVE, H)):
            f.block(s0, s1, z0, z1)
        f.line(s0, s1, GROOVE, s.z_at(GROOVE, -1), GROOVE_D, bevel=False)
        f.line(s0, s1, s.z_at(GROOVE, 1), GROOVE, GROOVE_L, bevel=False)
        f.line(s0, s1, FOOT_H, s.z_at(FOOT_H, -LEDGE_H), LEDGE, bevel=False)
        f.top_line(s0, s1, ts - LINE, ts, SEAM)
        f.top_line(s0, s1, rail - LINE, rail, SEAM)
        if whole:
            for fr in SEAMS:
                u = s0 + fr - LINE / 2
                f.plumb(u, u + LINE, s.z_at(GROOVE, -3), H, zk, SEAM)
                f.top_line(u, u + LINE, ts, D - R_D, SEAM)
                g = f.at_face(u + LINE / 2, zk)
                _part(f, g - 1.5 * LINE, g + 1.5 * LINE, g0, g1, LINE, TAB, TAB_TOP, TAB_SIDE)
            v0, v1 = (f.at_face(s0 + fr, zk) for fr in SEAMS)
            f.line(v0 + LINE / 2, v1 - LINE / 2, zt, s.z_at(zt, -1), SEAM, bevel=False)
            f.line(v0 + LINE / 2, v1 - LINE / 2, s.z_at(zt, 1), zt, UNDER_L, bevel=False)
        e = f.edge_u(0.0) if f.ch and abs(s1 - b) < 1e-6 else s1     # (the foot blocks: on the flat face)
        n = max(1, round(FOOT_N * (e - s0)))
        for j in range(n):
            c = s0 + (e - s0) * (j + 0.5) / n
            _part(f, c - FOOT_W / 2, c + FOOT_W / 2, 0.0, FOOT_H, FOOT_OUT, FOOT, FOOT_TOP, FOOT_SIDE)
    if f.ch:
        _corner(f, zt, g0, g1)


def _corner(f, zt, g0, g1):
    """The outer corner's chamfer: a seam down each edge, CHAMFER_SEAM px in, with a tab over the groove; the line
    under the bullnose across between them; two foot blocks."""
    t, s = f.chamfer_t, f.sec
    W = f.c * core.TILE_W
    sf = f.on(s.z_at(GROOVE, -3), s.H, -0.01, 0.001)
    for e in (CHAMFER_SEAM, W - CHAMFER_SEAM - 1):
        f.on_chamfer(t(e), t(e + 1), sf, [SEAM] * len(sf), SEAM)
        _chamfer_part(f, t(e - 1), t(e + 2), g0, g1, LINE, TAB, TAB_TOP, TAB_SIDE)
    for z0, z1, col in ((zt, s.z_at(zt, -1), SEAM), (s.z_at(zt, 1), zt, UNDER_L)):
        pf = f.on(z0, z1, -0.01, 0.001)
        f.on_chamfer(t(CHAMFER_SEAM + 1), t(W - CHAMFER_SEAM - 1), pf, [col] * len(pf), col)
    fw = FOOT_W * core.TILE_W / math.sqrt(2)                 # (px across the chamfer)
    for c in (W / 4, 3 * W / 4):
        _chamfer_part(f, t(c - fw / 2), t(c + fw / 2), 0.0, FOOT_H, FOOT_OUT, FOOT, FOOT_TOP, FOOT_SIDE)


def _shell(o):
    """The ship hull's exterior shell (its block, cut a cell short of the outline), the armour's own face at the
    tile's middle (no BACK), in the station's tones."""
    base = ext_shell(o)

    class StationShell(base):
        def __init__(self, *args, **kw):
            T.Shell.__init__(self, *args, **kw)
            f = E - D
            out = []
            for (x0, x1, y0, y1), fam, tp, top in self.rects:
                if fam == "hull":
                    x1 = f if o & 2 else x1
                    y1 = f if o & 1 else y1
                out.append(((x0, x1, y0, y1), fam, tp, top))
            self.rects, self.keep, self.f = out, None, f

        def col_top(self, i, j, kind, x, y):
            return TOP

        def col_face(self, face, x, y, z):
            if abs((y if face == "y" else x) - self.f) < 1e-6:
                return None                             # (the armour covers its outer face)
            return END
    return StationShell


def _dress(k, ax, plane, a, b, ends, zs, top, full, variant=0):
    build(k, ax, plane, a, b, ends, top)


def _block(mask, o):
    return T.block(mask, "hull", 0, level="up", shell=_shell(o), dress=_dress)


def _wide(mask, o):
    """(own, wide): a straight run with a copy a tile either way along it (its edge px resolve as mid-run)."""
    own = _block(mask, o)
    more = []
    if (mask, o) in STRAIGHT:
        dx, dy = STRAIGHT[(mask, o)]
        for sg in (-1, 1):
            for ob in _block(mask, o):
                ob.location = ob.location + core.G(sg * dx, sg * dy, 0.0)
                more.append(ob)
    return own, own + more


PIECES = ((10, 1), (5, 2), (9, 3))
PALETTE = "only:station"


def _item(sid, build_fn):
    from . import env_build, post
    core.clear_scene_meshes()
    post.select(PALETTE)
    it = env_build.crop_item(sid, (1, 1), *env_build.render_sprite(sid, "wide", build_fn()))
    return [it] if it else []


def jobs():
    return [lambda m=m, o=o: _item(f"tile.hull.station.ext.o{o}.m{m}", lambda: _wide(m, o)) for m, o in PIECES]
