"""The station hull's straight-run designs (#524; station_hull.DESIGN), after the ref's straight variants (design
reference only): each its detail over the base, set in the base's slots (its panel lines: the seams a quarter in from
each end, the line under the bullnose, the groove, the step).

Positions are in art px across the tile from its far end (P): the screen-left end of the face rising to the right, as
the ref's; the other face is its mirror, as hull 46's art is.

  1  dents and a long gouge (ref T3-7)
  2  the dents alone (ref T3-6)
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

MODULE = 3
DESIGNS = {1: DENTS + (GOUGE,), 2: DENTS, MODULE: ()}
NO_TABS = {MODULE}                  # designs without the groove's tabs (the recess takes the middle slot's foot), the
                                    # plate on the line under the bullnose and that line's lit px (the boxes take the
                                    # middle slot)

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
LOW_LIT = "stL"                     # a faint lit px under the box's top edge and the seam across, and down inside its near
                                    # side (the ref's left on the face rising to the right)
GAP_SHADE = SH.GROOVE_D                # the top box's shadow in the gap under it
RECESS = (11, 21, -1)               # the recess: px across, its top px over the groove (down to the step)
RECESS_BACK, RECESS_RIM, RECESS_SIDE, RECESS_SILL = "stD", "stK", "stE", "stB"   # its back wall; the shadow under its
                                    # lip and down its far side; its near side; the sill in its foot


def dress(f, s0, design, zk):
    """A whole straight span's detail in its design."""
    if design in (1, 2):
        for dent in DESIGNS[design]:
            _dent(f, s0, *dent)
    elif design == MODULE:
        _module(f, s0, zk)


def _u(s0, p):
    """The u p px across the tile from its far end."""
    return s0 + 1 - p * LINE


def _span(s0, p0, p1):
    return _u(s0, p1), _u(s0, p0)


def _rect(f, u0, u1, z0, z1, d, col):
    """A painted rectangle on a plumb front d out."""
    pts = [T.P(f.ax, f.plane, u, z, d) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))]
    f.k.poly(pts, F, 3, T.OUT(f.ax), fixed=T.SEAM_PASS or col)


def _plate(f, a, b, back, top, n=4):
    """The top box's top carried PLATE_BACK px back past `back` as a slab off the hull's top (its back corners rounded
    PLATE_R px): its top TOP, its sides the boxes' ends' tone."""
    r, d0 = PLATE_R * LINE, back - PLATE_BACK * LINE
    pl = [(b, back + 0.001)]
    for c, sg in ((b - r, 1), (a + r, -1)):                  # (round its two back corners)
        for i in range(n + 1):
            t = math.pi / 2 * i / n
            if sg > 0:
                pl.append((c + r * math.cos(t), d0 + r - r * math.sin(t)))
            else:
                pl.append((c - r * math.sin(t), d0 + r - r * math.cos(t)))
    pl.append((a, back + 0.001))
    H = f.sec.H
    f.k.poly([T.P(f.ax, f.plane, u, top, d) for u, d in pl], F, 3, core.Vector((0, 0, 1)),
             fixed=T.SEAM_PASS or SH.TOP)
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


def gap(s):
    """The gap between the module's boxes (z0, z1): the seams up the face break across it."""
    zl = s.z_at(s.z_at(s.zb, SH.UNDER), -1)
    return s.z_at(zl, BOX_GAP + LOW_DROP), zl


def _module(f, s0, zk):
    s, H, px = f.sec, f.sec.H, 1 / core.ZPX
    v0, v1 = (f.at_face(s0 + fr, zk) for fr in SH.SEAMS)
    a, b = min(v0, v1) - LINE / 2, max(v0, v1) + LINE / 2  # the middle slot out over its seams
    zt = s.z_at(s.zb, SH.UNDER)                             # the line under the bullnose (its dark px over zt)
    out = D + BOX_OUT * LINE
    lift = 0.5 * BOX_OUT * px                               # (a front LINE out stands a half px lower on screen: lifted
                                                            # back so its edges and paint keep to the face's px rows)
    # the top box: back from the top's seam, its top a px over the top's, its front a px off the face, down to the line
    back = SH.E - round((SH.R_D + SH.TOP_SEAM) * 32) / 32
    zl = s.z_at(zt, -1)                                     # (the line's top)
    top, z0 = H + BOX_UP * px, zl + lift
    c = BOX_CHAMFER
    f.part(a, b, [(back, z0), (back, top), (out - c * LINE, top), (out, top - c * px), (out, z0)],
           [None, SH.TOP, SH.BANDS[0][0], SH.FACE, None], BOX_SIDE, end=False)
    _plate(f, a, b, back, top)
    _rect(f, a, a + LINE, z0, top - c * px, out + 0.001, BOX_LINE)              # (a: the end turned from view)
    e = 0.001
    f.k.poly([T.P(f.ax, f.plane, u, z, d) for u, z, d in ((a, top + e, out - c * LINE + e), (a + LINE, top + e,
              out - c * LINE + e), (a + LINE, top - c * px + e, out + e), (a, top - c * px + e, out + e))],
             F, 3, T.OUT(f.ax), fixed=T.SEAM_PASS or BOX_LINE)
    d0 = back - PLATE_BACK * LINE + PLATE_R * LINE
    f.k.poly([T.P(f.ax, f.plane, u, top + T.PAINT, d) for u, d in ((a, d0), (a + LINE, d0),
              (a + LINE, out - c * LINE), (a, out - c * LINE))], F, 3, core.Vector((0, 0, 1)),
             fixed=T.SEAM_PASS or BOX_LINE)
    m = (a + b) / 2
    for n in VENTS:                                         # its vent (px rows under its top on screen)
        zv = zl + lift + round((top - zl) / px) * px - n * px
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
    _rect(f, a, b, zs - px, zs, fd, BOX_LINE)
    i = LOW_FRAME                                           # an outline under it, its corner px left out
    u0, u1, za, zb = a + i * LINE, b - i * LINE, z0 + i * px, zs - px - i * px
    _rect(f, u0 + LINE, u1 - LINE, zb - px, zb, fd, BOX_LINE)
    _rect(f, u0 + LINE, u1 - LINE, za, za + px, fd, BOX_LINE)
    _rect(f, u0, u0 + LINE, za + px, zb - px, fd, BOX_LINE)
    _rect(f, u1 - LINE, u1, za + px, zb - px, fd, BOX_LINE)
    _rect(f, a + LINE, b, z1 - px, z1, fd, LOW_LIT)                          # (faint lit px)
    _rect(f, a + LINE, b, zs - 2 * px, zs - px, fd, LOW_LIT)
    _rect(f, b - LINE, b, z0, z1 - px, fd, LOW_LIT)    # the recess, from the groove down to the step
    p0, p1, up = RECESS
    u0, u1 = _span(s0, p0, p1)
    zt, zf = s.z_at(SH.GROOVE, -up), s.z_at(SH.FOOT_H, -1)
    _rect(f, u0, u1, zf, zt, D + 0.003, RECESS_BACK)
    _rect(f, u1 - LINE, u1, zf, zt, D + 0.004, RECESS_SIDE)             # (u1: the near side, p0)
    _rect(f, u0, u0 + LINE, zf, zt, D + 0.004, RECESS_RIM)
    _rect(f, u0, u1, s.z_at(zt, 2), zt, D + 0.005, RECESS_RIM)
    _rect(f, u0, u1, zf, s.z_at(zf, -2), D + 0.005, RECESS_SILL)


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
