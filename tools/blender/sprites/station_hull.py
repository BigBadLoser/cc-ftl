"""Station hull look (#524; family `station_hull`): a station's hull from outside (roofed), on the ship hull's own belly.
After the user's station hull reference (design reference only: our own geometry here). Built as the ship hull is
(wall3d_ext: the shell block, its outer faces dressed through wall3d_ext_geom's Face), on a section of its own
(RoundSection): upright from the floor, then rounded over into the top in a big bullnose, lit in bands from its top
edge down. Two seams a tile run up the face, plumb on screen up to the bullnose's lower bands and following it over
into the top, to a seam across the top; a groove near the foot with tabs where the seams cross it, a line under the
bullnose from seam to seam, a bright ledge over a step running along the foot, a line along the top's
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
GROOVE = 0.40 + 3 / core.ZPX        # the groove's height over the deck
UNDER = 5                           # the line under the bullnose: this many px under its foot
RAIL = 4 / 32                       # the line along the top's back: this far in from the back
TOP_SEAM = 5 / 32                   # the seam across the top this far in past the bullnose's top edge (the seams end on it)
FOOT_OUT = 4 / 32                   # the step along the foot: how far proud
FOOT_H = 3 / core.ZPX + FOOT_OUT    # its top over the deck (about 8 px)
FOOT_BLOCKS = (7, 5, 8, 5, 7)       # the step's two blocks across a tile: gap, block, gap, block, gap (px; 32 px a tile
                                    # cannot split in three equal whole gaps); a px proud of its top and front
CHAMFER_SEAM = 1                    # the corner's seams down its chamfer, this many px in from its edges

FACE, FACE_LO, END, TOP = "stS", "stL", "stE", "stL"      # the face, its band under the groove, the shell, the top
# the bullnose's bands from its top edge down to the face: colour, share of the arc (the lightest the widest)
BANDS = (("stW", 0.36), ("stB", 0.26), ("stH", 0.18), ("stL", 0.12), ("stS", 0.08))
PLUMB_BAND = 3                      # the seams stand plumb on screen from this band's top down (stL)
SEAM, GROOVE_D, GROOVE_L, UNDER_L = "stM", "stD", "stH", "stH"
TAB, TAB_TOP, TAB_SIDE = "stB", "stW", "stH"
PLATE_Z = lambda s, zt: (s.z_at(zt, 3), s.z_at(zt, -3))   # noqa: E731  the plate on the line under the bullnose:
                                    # its foot and top on screen, px under / over zt (6 px, centred on the line and
                                    # its lit px under it)
TAB_W, TAB_IN = 3, 4                # the tabs on the groove: px wide, px in from their seam toward the tile's middle
FOOT, FOOT_TOP = FACE_LO, "stW"     # the step: its front the face's lower band's tone
STEP_FRONT = 4                      # its front px tall, flat under (its blocks' a px more)
BLOCK, BLOCK_LIT = FACE, "stH"      # its blocks: the face's tone, lit along their front's top edge


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
            if pz > 0.85 and min(z0, z1) >= self.H - 1e-6:      # (the top itself: the bullnose's flat
                                                                # facets under it keep their band)
                out.append(TOP)
            elif pd < 0.3 and pz < 0.3:
                out.append(None)
            elif zm > self.zb + 1e-6:
                a = (self._angle(z0) + self._angle(z1)) / 2      # (by angle, not height: the top facets are flat)
                out.append(_band(1 - a / (math.pi / 2)))
            else:
                out.append(FACE if zm > GROOVE else FACE_LO)
        return out


class RoundFace(Face):
    def plumb(self, u0, u1, z0, z1, zk, col):
        """A band [u0, u1] up the front from z0 to z1, a line with no lit edge (as Face.line's with bevel=False: its
        core a px, not LINE_W, which goes with a lit edge): over zk it follows the front (Face.line), under it it
        stands plumb on screen under where it is at zk (screen x goes as u - d: it moves along the face as far as the
        front stands out)."""
        if z1 > zk:
            self.line(u0, u1, zk, z1, col, bevel=False)
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


def _step_prof(s):
    """The step's section: its top and a front STEP_FRONT px tall, flat under."""
    zf = s.z_at(FOOT_H, STEP_FRONT)
    return [(D - 0.01, zf), (D - 0.01, FOOT_H), (D + FOOT_OUT, FOOT_H), (D + FOOT_OUT, zf)]


STEP_COLS = [None, FOOT_TOP, FOOT, None]


def _block_prof(s):
    """A foot block's section: the step's, a px proud of its top and front; its front's top px a lit edge; the back of its
    top (a px out from the face: its px on screen in line with the face's seam a px over the step) carries on the
    seam where the step meets the face, through the block on screen."""
    zt, out = s.z_at(FOOT_H, -1), FOOT_OUT + LINE
    zf = s.z_at(FOOT_H, STEP_FRONT + 1)                         # (its front a px under the step's, flat under)
    return [(D - 0.01, zf), (D - 0.01, zt), (D + LINE, zt), (D + out, zt), (D + out, s.z_at(zt, 1)), (D + out, zf)]


BLOCK_COLS = [None, GROOVE_D, BLOCK, BLOCK_LIT, BLOCK, None]


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
    g0, g1 = s.z_at(GROOVE, 3), s.z_at(GROOVE, -2)          # a tab on the groove
    ts = E - round((R_D + TOP_SEAM) * 32) / 32               # (the top's lines on the art px grid: clean iso lines)
    rail = back + RAIL
    for s0, s1 in T.spans(a, b):
        whole = s1 - s0 > 1 - 1e-6
        for z0, z1 in ((0.0, GROOVE), (GROOVE, H)):
            f.block(s0, s1, z0, z1)
        f.line(s0, s1, GROOVE, s.z_at(GROOVE, -1), GROOVE_D, bevel=False)
        f.line(s0, s1, s.z_at(GROOVE, 1), GROOVE, GROOVE_L, bevel=False)
        f.line(s0, s1, FOOT_H, s.z_at(FOOT_H, -1), GROOVE_D, bevel=False)    # a seam where the step meets the face
        f.top_line(s0, s1, ts - LINE, ts, SEAM)
        f.top_line(s0, s1, rail - LINE, rail, SEAM)
        if whole:
            for fr, sg in zip(SEAMS, (1, -1)):
                u = s0 + fr - LINE / 2
                f.plumb(u, u + LINE, s.z_at(GROOVE, -1), H, zk, SEAM)     # (from the groove up)
                f.top_line(u, u + LINE, ts, D - R_D, SEAM)
                g = f.at_face(u + LINE / 2, zk) + sg * TAB_IN * LINE     # (a tab on the groove, in from the seam)
                _part(f, g - TAB_W / 2 * LINE, g + TAB_W / 2 * LINE, g0, g1, LINE, TAB, TAB_TOP, TAB_SIDE)
            v0, v1 = (f.at_face(s0 + fr, zk) for fr in SEAMS)
            f.line(v0 + LINE / 2, v1 - LINE / 2, zt, s.z_at(zt, -1), GROOVE_D, bevel=False)
            f.line(v0 + LINE / 2, v1 - LINE / 2, s.z_at(zt, 1), zt, UNDER_L, bevel=False)
            m, hw = (v0 + v1) / 2, (TAB_W / 2 + 1) * LINE           # a plate on it, in the middle, a px wider
            _part(f, m - hw, m + hw, *PLATE_Z(s, zt), LINE, TAB, TAB_TOP, TAB_SIDE)
        f.part(s0, s1, _step_prof(s), STEP_COLS, False)          # the step along the foot, one piece (open
                                                                # ends: it runs on; round an outer corner)
        if whole:
            u = s0
            for i, w in enumerate(FOOT_BLOCKS):
                if i % 2:
                    f.part(u, u + w * LINE, _block_prof(s), BLOCK_COLS, GROOVE_D)    # (its sides the seam's)
                u += w * LINE
    if f.ch:
        _corner(f, zt, g0, g1)


def _corner(f, zt, g0, g1):
    """The outer corner's chamfer: a seam down each edge, CHAMFER_SEAM px in, with a tab on the groove in from it; the
    line under the bullnose across between them, a plate on it in the middle; the step's two blocks."""
    t, s = f.chamfer_t, f.sec
    W = f.c * core.TILE_W
    sf = f.on(s.z_at(GROOVE, -1), s.H, -0.01, 0.001)
    for e, sg in ((CHAMFER_SEAM, 1), (W - CHAMFER_SEAM - 1, -1)):
        f.on_chamfer(t(e), t(e + 1), sf, [SEAM] * len(sf), SEAM)
        c = e + 0.5 + sg * TAB_IN
        _chamfer_part(f, t(c - TAB_W / 2), t(c + TAB_W / 2), g0, g1, LINE, TAB, TAB_TOP, TAB_SIDE)
    for z0, z1, col in ((zt, s.z_at(zt, -1), GROOVE_D), (s.z_at(zt, 1), zt, UNDER_L)):
        pf = f.on(z0, z1, -0.01, 0.001)
        f.on_chamfer(t(CHAMFER_SEAM + 1), t(W - CHAMFER_SEAM - 1), pf, [col] * len(pf), col)
    u = (W - sum(FOOT_BLOCKS)) / 2                           # the step's blocks across it, as a tile's
    for i, w in enumerate(FOOT_BLOCKS):
        if i % 2:
            f.on_chamfer(t(u), t(u + w), _block_prof(s), BLOCK_COLS, GROOVE_D)
        u += w
    hw = TAB_W / 2 + 1
    _chamfer_part(f, t(W / 2 - hw), t(W / 2 + hw), *PLATE_Z(s, zt), LINE, TAB, TAB_TOP, TAB_SIDE)


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
