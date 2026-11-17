"""The station hull's straight-run designs (#524; station_hull.DESIGN), after the ref's straight variants (design
reference only): each its detail over the base, set in the base's slots (its panel lines: the seams a quarter in from
each end, the line under the bullnose, the groove, the step).

Positions are in art px across the tile from its far end (P): the screen-left end of the face rising to the right, as
the ref's; the other face is its mirror, as hull 46's art is.

  1  dents and a long gouge (ref T3-7)
  2  the dents alone (ref T3-6)
  4  a tower in the middle slot (ref T3-5; station_hull_tower)
  5  a bay let into the middle slot (ref T3-2; station_hull_bay)
  3  a module in the middle slot (ref T3-3): two boxes a px off the face, the top one from a px over the top down to the
     line under the bullnose (a vent in its front), the lower one from under that line down to the groove (a seam
     across it, a rounded seam outline under that); a dark recess from the groove down to the step; a box and two short rails in the far slot"""
import math

from . import core
from . import wall3d as T
from . import station_hull as SH
from .wall3d_ext_geom import D, F, LINE

# A dent: (px across, px under the bullnose's foot, half its width and its height in px, its outline: radius scales round
# it from +u, eased between, its tilt in degrees on the face), painted as a shallow pit: its lit lower lip, a darker
# ring, its shaded upper inside
DENTS = ((7, 0, 3, 1.7, (1.0, 1.25, 0.8, 0.9, 1.15, 0.7, 0.95, 1.05), 15),
         (13, 29.5, 2.6, 1.5, (1.0, 0.7, 1.05, 1.3, 0.9, 1.0, 0.75, 1.15), -12),
         (25, 52, 2.4, 1.9, (0.8, 1.15, 1.2, 0.85, 0.7, 1.05, 1.3, 0.9), 35))
GOUGE = (28, 25, 5, 1.0, (1.0, 0.75, 1.1, 1.0, 0.85, 1.25, 0.8, 1.0), 6)   # a long shallow dent out to the tile's edge
DENT_LIP, DENT_RING, DENT_PIT = "stL", "stM", "stD"

MODULE, TOWER, BAY, STRIPE = 3, 4, 5, 6
DESIGNS = {1: DENTS + (GOUGE,), 2: DENTS, MODULE: (), TOWER: (), BAY: (), STRIPE: ()}   # (STRIPE: the base, its livery
                                    # down the middle slot too: the ref's T3-4)
NO_TABS = {MODULE, TOWER, BAY}      # designs without the groove's tabs (the recess takes the middle slot's foot), the
                                    # plate on the line under the bullnose and that line's lit px (the boxes take the
                                    # middle slot)
ONE_BLOCK = {TOWER: 1, BAY: 0}      # designs whose step carries one block over both: px its middle stands higher

BOX_OUT, BOX_UP, BOX_GAP = 1, 1, 2   # the middle slot's boxes: px off the face, the top one's top px over the top's, the
                                    # gap between them (the line under the bullnose)
BOX_SIDE = SH.SEAM                  # their ends (the seams')
BOX_LINE = SH.SEAM                  # the lines on them, down their unseen end's edge too (over the top box's chamfer and
                                    # along its top)
PLATE_BACK, PLATE_R = 4, 2          # the top box's top runs this many px back past the top's seam, its back corners
                                    # rounded this many px
BOX_CHAMFER = 2                     # the top box's top front edge chamfered this many px, in the bullnose's top band's tone
VENTS = (7, 10)                     # its vent's slots, px under the top
VENT_W = 5
LOW_DROP = 2                        # the lower box's top this many px under the line under the bullnose's foot
LOW_LINE = 5                        # a seam across it this many px under its top
LOW_FRAME = 2                       # under that, a seam outline (its corners rounded off) this many px in from each edge
LOW_FRAME_TOP = 4                   # (its top this many px under the seam across)
HANDLE = (1, 2)                     # a handle in it, a line in the darker seam tone: px in from its near side, from its
                                    # top and foot
LOW_LIT = "stL"                     # a faint lit px under the box's top edge and the seam across, and down inside its near
                                    # side (the ref's left on the face rising to the right)
HOLE_FOOT = "stL"                   # (the foot of a window let into a box's front, seen from over it)
TOP_LIT = "stB"                     # (the near edge of the top box's top: two steps over its tone)
MID_LINE = SH.GROOVE_D              # the seam across each box (the darker seam tone)
RECESS_LIT = SH.FACE_LO             # the recess: a lit px where its upright inside meets its lean
RECESS_SHADE = (SH.DARK_P, 6)       # its lip's shadow on its lean: tone, px down from its top
GAP_SHADE = SH.SEAM                    # the top box's shadow in the gap under it
RECESS = (11, 21, 0)                # a recess in the face: px across, its top px under the groove (down to the seam where
                                    # the step meets the face)
RECESS_IN, RECESS_FOOT, RECESS_BACK = 1, 5, 4   # its inside: upright RECESS_IN px in for RECESS_FOOT px, then leaning
                                    # back to RECESS_BACK px in at its top
RECESS_FACE, RECESS_SLOPE, RECESS_WALL = SH.DARK_P, SH.SEAM_P, SH.END_P   # its inside's upright face, its lean, its
                                    # ends (the recess in the livery band: its insides take the paint, the lines in it
                                    # don't)
RECESS_SEAM = "stE"                 # the step's seam carried along its foot


def dress(f, s0, design, zk):
    """A whole straight span's detail in its design."""
    if design in (1, STRIPE):                               # (the livery down the middle slot: ref T3-7, T3-4)
        SH.stripe(f, s0, zk)
    if design in (1, 2):
        for dent in DESIGNS[design]:
            _dent(f, s0, *dent)
    elif design == MODULE:
        _module(f, s0, zk)
    elif design == TOWER:
        from .station_hull_tower import tower
        tower(f, s0, zk)
    elif design == BAY:
        from .station_hull_bay import machinery
        machinery(f, s0)


def _u(s0, p):
    """The u p px across the tile from its far end."""
    return s0 + 1 - p * LINE


def _span(s0, p0, p1):
    return _u(s0, p1), _u(s0, p0)


def _rect(f, u0, u1, z0, z1, d, col):
    """A painted rectangle on a plumb front d out."""
    pts = [T.P(f.ax, f.plane, u, z, d) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))]
    f.k.poly(pts, F, 3, T.OUT(f.ax), fixed=T.SEAM_PASS or col)


def _plate(f, a, b, back, top, n=4, ends=(True, True), col=SH.TOP):
    """The top box's top carried PLATE_BACK px back past `back` as a slab off the hull's top (its back corners rounded
    PLATE_R px, at the ends `ends` says (a's, b's): else square, running on into the next tile): its top TOP, its sides
    the boxes' ends' tone."""
    r, d0 = PLATE_R * LINE, back - PLATE_BACK * LINE
    pl = [(b, back + 0.001)]
    for c, sg, rd in ((b - r, 1, ends[1]), (a + r, -1, ends[0])):     # (round its two back corners)
        if not rd:
            pl.append((b if sg > 0 else a, d0))
            continue
        for i in range(n + 1):
            t = math.pi / 2 * i / n
            if sg > 0:
                pl.append((c + r * math.cos(t), d0 + r - r * math.sin(t)))
            else:
                pl.append((c - r * math.sin(t), d0 + r - r * math.cos(t)))
    pl.append((a, back + 0.001))
    H = f.sec.H
    f.k.poly([T.P(f.ax, f.plane, u, top, d) for u, d in pl], F, 3, core.Vector((0, 0, 1)),
             fixed=T.SEAM_PASS or col)
    cu, cd = sum(p[0] for p in pl) / len(pl), sum(p[1] for p in pl) / len(pl)
    o = T.P(f.ax, 0, 0, 0, 0)
    for (u0, d0_), (u1, d1) in zip(pl, pl[1:]):
        nu, nd = d1 - d0_, -(u1 - u0)
        if nu * ((u0 + u1) / 2 - cu) + nd * ((d0_ + d1) / 2 - cd) < 0:
            nu, nd = -nu, -nd
        q = [T.P(f.ax, f.plane, u, z, d) for u, z, d in ((u0, H, d0_), (u1, H, d1), (u1, top, d1), (u0, top, d0_))]
        f.k.poly(q, F, 3, (T.P(f.ax, 0, nu, 0, nd) - o).normalized(), fixed=T.SEAM_PASS or BOX_SIDE)
    for (u0, d0_), (u1, d1) in zip(pl[1:-2], pl[2:-1]):      # its back and back corners outlined on its top (its far
        ln = math.hypot(u1 - u0, d1 - d0_)                  # end's edge is BOX_LINE's; its near end shows its side)
        iu, idd = -(d1 - d0_) / ln * LINE, (u1 - u0) / ln * LINE
        if iu * (cu - u0) + idd * (cd - d0_) < 0:
            iu, idd = -iu, -idd
        q = [T.P(f.ax, f.plane, u, top + T.PAINT, d) for u, d in ((u0, d0_), (u1, d1), (u1 + iu, d1 + idd),
                                                                   (u0 + iu, d0_ + idd))]
        f.k.poly(q, F, 3, core.Vector((0, 0, 1)), fixed=T.SEAM_PASS or BOX_LINE)


def recess(s0):
    """The module's recess (u0, u1), or None."""
    return _span(s0, *RECESS[:2])


def blocks(f, s0, s1):
    """The face's armour on a whole span in the module design: the base's two blocks, the lower one round the recess,
    and the recess's inside."""
    s = f.sec
    f.block(s0, s1, SH.GROOVE, s.H)
    p0, p1, n = RECESS
    u0, u1 = _span(s0, p0, p1)
    zt, zf = s.z_at(SH.GROOVE, n), SH.FOOT_H                # (its foot on the step: the seam where the step meets the
                                                            # face breaks across it)
    f.block(s0, u0, 0.0, SH.GROOVE)
    f.block(u1, s1, 0.0, SH.GROOVE)
    f.block(u0, u1, 0.0, zf)
    if zt < SH.GROOVE - 1e-6:
        f.block(u0, u1, zt, SH.GROOVE)
    zk = s.z_at(zf, -RECESS_FOOT)
    di, db = D - RECESS_IN * LINE, D - RECESS_BACK * LINE
    f.part(u0, u1, [(db - 0.01, zf), (db - 0.01, zk), (di, zk), (di, zf)], [None, None, RECESS_FACE, None], None,
           end=False)
    f.part(u0, u1, [(db - 0.01, zk), (db - 0.01, zt), (db, zt), (di, zk)], [None, None, RECESS_SLOPE, None], None,
           end=False)
    o = T.P(f.ax, 0, 0, 0, 0)
    for u, sg in ((u0, 1), (u1, -1)):                       # its ends (the armour's either side), in shadow
        q = [T.P(f.ax, f.plane, u + sg * 0.001, z, d) for z, d in ((zf, db), (zf, D), (zt, D), (zt, db))]
        f.k.poly(q, F, 3, (T.P(f.ax, 0, sg, 0, 0) - o).normalized(), fixed=T.SEAM_PASS or RECESS_WALL)
    px = 1 / core.ZPX
    _rect(f, u0, u1, s.z_at(zk, 1), zk, di + 0.001, RECESS_LIT)        # (its upright inside's top edge, lit)
    col, n = RECESS_SHADE                                   # (its lip's shadow on its lean)
    lean = lambda z: di + (db - di) * (z - zk) / (zt - zk) + 0.001     # noqa: E731
    zs = zt - n * px
    q = [T.P(f.ax, f.plane, u, z, lean(z)) for u, z in ((u0, zs), (u1, zs), (u1, zt), (u0, zt))]
    f.k.poly(q, F, 3, (T.P(f.ax, 0, 0, di - db, zt - zk) - o).normalized(), fixed=T.SEAM_PASS or col)
    _rect(f, u0, u1, zf, zf + px, di + 0.001, RECESS_SEAM)              # (the step's seam carried along its foot, a
                                                                        # step darker: its inside is the seam's tone)
    _rect(f, u1, u1 + LINE, zf, s.z_at(SH.GROOVE, -1), D + 0.002, SH.GROOVE_D)   # (a dark seam down its near
                                                                        # edge, up into the groove's line)


def gap(s):
    """The gap between the module's boxes (z0, z1): the seams up the face break across it."""
    zl = s.z_at(s.z_at(s.zb, SH.UNDER), -1)
    return s.z_at(zl, BOX_GAP + LOW_DROP), zl


def _box_back():
    """Where the boxes' tops meet the hull's top."""
    return SH.E - round((SH.R_D + SH.TOP_SEAM) * 32) / 32


def _top_box(f, a, b, z0, out, slope=None, steep=1, hole=None):
    """A box on the middle slot [a, b] from z0 up to a px over the top, its front `out`, its top front edge chamfered,
    its top a plate run back past the top's seam; outlined down its far end (over the chamfer and along its top), faintly
    lit down its near end. Its top and chamfer (z, px)."""
    H, px = f.sec.H, 1 / core.ZPX
    back = _box_back()
    top, c = H + BOX_UP * px, BOX_CHAMFER
    prof, cols = [(back, z0), (back, top), (out - c * LINE, top), (out, top - c * px), (out, z0)], \
        [None, SH.TOP_P, SH.BANDS[0][0], SH.FACE, None]
    if slope:                                               # (its foot sloped back down to the face, `steep` px down a
        zb = z0 - steep * round((out - D) / LINE) * px      # px it's out)
        prof, cols = [(back, zb)] + prof[1:] + [(D, zb)], cols[:4] + [slope, None]
    if hole:                                                # (a window (u0, u1, z0, z1) in its front set back a px)
        _holed(f, a, b, prof, cols, back, out, hole)
    else:
        f.part(a, b, prof, cols, BOX_SIDE, end=False)
    _plate(f, a, b, back, top, col=SH.TOP_P)                # (its top in the livery: the ref's)
    _rect(f, a, a + LINE, z0, top - c * px, out + 0.001, BOX_LINE)              # (a: the end turned from view)
    _rect(f, b - LINE, b, z0, top - c * px, out + 0.001, LOW_LIT)               # (b: its near end, faintly lit)
    e = 0.001
    f.k.poly([T.P(f.ax, f.plane, u, z, d) for u, z, d in ((a, top + e, out - c * LINE + e), (a + LINE, top + e,
              out - c * LINE + e), (a + LINE, top - c * px + e, out + e), (a, top - c * px + e, out + e))],
             F, 3, T.OUT(f.ax), fixed=T.SEAM_PASS or BOX_LINE)
    d0 = back - PLATE_BACK * LINE + PLATE_R * LINE
    for u, col in ((a, BOX_LINE), (b - LINE, TOP_LIT)):     # (its two edges along its top)
        f.k.poly([T.P(f.ax, f.plane, v, top + T.PAINT, d) for v, d in ((u, d0), (u + LINE, d0),
                  (u + LINE, out - c * LINE), (u, out - c * LINE))], F, 3, core.Vector((0, 0, 1)),
                 fixed=T.SEAM_PASS or col)
    return top, c


def _holed(f, a, b, prof, cols, back, out, hole):
    """The box's body as pieces round a window in its front a px deep: whole either side of it; over and under it, the
    body cut at the window's top and bottom (its foot lit where it's seen); in it, the body a px short of the front."""
    h0, h1, z0, z1 = hole
    for u0, u1 in ((a, h0), (h1, b)):
        f.part(u0, u1, prof, cols, BOX_SIDE, end=False)
    over = [(back, z1)] + prof[1:4] + [(out, z1)]           # (prof: back foot, back top, chamfer, front's top, front's
    f.part(h0, h1, over, [None] + cols[1:4] + [None], BOX_SIDE, end=False)   # foot, (slope's foot))
    f.part(h0, h1, [prof[0], (back, z0), (out, z0)] + prof[4:], [None, HOLE_FOOT, SH.FACE] + cols[4:], BOX_SIDE,
           end=False)
    f.part(h0, h1, [(back, z0), (back, z1), (out - LINE, z1), (out - LINE, z0)], [None, None, SH.FACE, None], BOX_SIDE,
           end=False)


def _module(f, s0, zk):
    s, H, px = f.sec, f.sec.H, 1 / core.ZPX
    v0, v1 = (f.at_face(s0 + fr, zk) for fr in SH.SEAMS)
    a, b = min(v0, v1) - LINE / 2, max(v0, v1) + LINE / 2  # the middle slot out over its seams
    zt = s.z_at(s.zb, SH.UNDER)                             # the line under the bullnose (its dark px over zt)
    out = D + BOX_OUT * LINE
    lift = 0.5 * BOX_OUT * px                               # (a front LINE out stands a half px lower on screen: lifted
                                                            # back so its edges and paint keep to the face's px rows)
    # the top box: its front a px off the face, down to the line
    zl = s.z_at(zt, -1)                                     # (the line's top)
    z0 = zl + lift
    top, c = _top_box(f, a, b, z0, out)
    m = (a + b) / 2
    vn = VENTS[-1] + 1 + VENTS[0] - c                       # a seam across under its vent, as far under it as the
    for n in VENTS + (vn,):                                 # chamfer is over it; the vent (px rows under its top)
        zv = zl + lift + round((top - zl) / px) * px - n * px
        if n == vn:
            _rect(f, a, b, zv - px, zv, out + 0.001, MID_LINE)
            continue
        _rect(f, m - VENT_W / 2 * LINE, m + VENT_W / 2 * LINE, zv - px, zv, out + 0.001, SH.GROOVE_D)
    # the gap under it in its shadow (under the line), then the lower box, down to a px over the groove's line
    zg = gap(s)[0]
    _rect(f, a, b, zg, s.z_at(zl, 1), D + 0.002, GAP_SHADE)
    z1, z0 = zg + lift, s.z_at(SH.GROOVE, -3) + lift
    f.part(a, b, [(D - 0.01, z0), (D - 0.01, z1), (out, z1), (out, z0)], [None, SH.SEAM, SH.FACE, None], BOX_SIDE,
           end=False)
    fd = out + 0.001
    _rect(f, a, a + LINE, z0, z1, fd, BOX_LINE)
    zs = z1 - LOW_LINE * px                                 # a seam across it
    _rect(f, a, b, zs - px, zs, fd, MID_LINE)
    i = LOW_FRAME                                           # an outline under it, its corner px left out
    u0, u1, za, zb = a + i * LINE, b - i * LINE, z0 + i * px, zs - px - LOW_FRAME_TOP * px
    _rect(f, u0 + LINE, u1 - LINE, zb - px, zb, fd, BOX_LINE)
    _rect(f, u0 + LINE, u1 - LINE, za, za + px, fd, BOX_LINE)
    _rect(f, u0, u0 + LINE, za + px, zb - px, fd, BOX_LINE)
    _rect(f, u1 - LINE, u1, za + px, zb - px, fd, BOX_LINE)
    _rect(f, a + LINE, b, z1 - px, z1, fd, LOW_LIT)                          # (faint lit px)
    _rect(f, a + LINE, b, zs - 2 * px, zs - px, fd, LOW_LIT)
    _rect(f, b - LINE, b, z0, z1 - px, fd, LOW_LIT)
    hs, he = HANDLE                                         # the handle (u1: the near side)
    hu = u1 - (2 + hs) * LINE
    _rect(f, hu, hu + LINE, za + (1 + he) * px, zb - (1 + he) * px, fd, SH.GROOVE_D)


def _blob(f, s0, uc, zc, ru, rz, shape, tilt, d, col, n=32):
    """A painted blob on the upright front: an ellipse (radii ru along, rz up, art px) its radius scaled round it by
    shape (eased between), tilted `tilt` degrees, centred (uc, zc), d out; cut at the tile's edges (s0, s0 + 1)."""
    px = 1 / core.ZPX
    k, ca, sa = len(shape), math.cos(math.radians(tilt)), math.sin(math.radians(tilt))
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        t = a / (2 * math.pi) * k
        j, w = int(t) % k, t - int(t)
        w = (1 - math.cos(math.pi * w)) / 2
        r = shape[j] * (1 - w) + shape[(j + 1) % k] * w
        x, y = ru * r * math.cos(a), rz * r * math.sin(a)
        x, y = x * ca - y * sa, x * sa + y * ca
        u = min(max(uc - x * LINE, s0), s0 + 1)
        pts.append(T.P(f.ax, f.plane, u, zc + y * px, d))   # (-x: the art's +x runs to -u)
    f.k.poly(pts, F, 3, T.OUT(f.ax), fixed=T.SEAM_PASS or col)


def _dent(f, s0, u, n, ru, rz, shape, tilt):
    """A dent on the upright face: its lit lower lip (its outline a px down), the darker ring over it, the shaded
    inside (the outline turned a few steps round, smaller) up and back a half px."""
    s, px = f.sec, 1 / core.ZPX
    uc, zc = _u(s0, u), s.z_at(s.zb, n)
    pit = shape[3:] + shape[:3]
    _blob(f, s0, uc - 0.5 * LINE, zc - px, ru, rz, shape, tilt, D + 0.001, DENT_LIP)
    _blob(f, s0, uc, zc, ru, rz, shape, tilt, D + 0.0015, DENT_RING)
    _blob(f, s0, uc + 0.5 * LINE, zc + 0.5 * px, ru - 1.2, rz - 0.6, pit, tilt, D + 0.002, DENT_PIT)
