"""The station hull's straight-run designs (#524; station_hull.DESIGN), after the ref's straight variants (design
reference only): each its detail over the base, set in the base's slots (its panel lines: the seams a quarter in from
each end, the line under the bullnose, the groove, the step).

Positions are in art px across the tile from its far end (P): the screen-left end of the face rising to the right, as
the ref's; the other face is its mirror, as hull 46's art is.

  1  dents and a long gouge (ref T3-7)
  2  the dents alone (ref T3-6)
  3  a module in the middle slot (ref T3-3): two boxes a px off the face, the top one from a px over the top down to the
     line under the bullnose (a vent in its front), the lower one from under that line down to the groove (a framed
     plate on it); a dark recess from the groove down to the step; a box and two short rails in the far slot"""
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
NO_TABS = {MODULE}                  # designs without the groove's tabs (the recess takes the middle slot's foot) and the
                                    # plate on the line under the bullnose (the boxes take the middle slot)

BOX_OUT, BOX_UP, BOX_GAP = 1, 1, 2   # the middle slot's boxes: px off the face, the top one's top px over the top's, the
                                    # gap between them (the line under the bullnose)
BOX_SIDE = SH.SEAM                  # their ends (the seams')
BOX_CHAMFER = 3                     # the top box's top front edge chamfered this many px, in the bullnose's top band's tone
VENTS = (4, 7, 10)                  # its vent's slots, px under the top
VENT_W = 5
PLATE = (11, 21, 18, 30)            # the framed plate: px across, px under the bullnose's foot
PLATE_IN = 2                        # its inner frame line, px in
HANDLE = (14, 2, 7)                 # a slot in it: px across, px from its top and foot
RECESS = (11, 21, 0)                # the recess: px across, its top px over the groove (down to the step)
RECESS_BACK, RECESS_RIM, RECESS_SIDE, RECESS_SILL = "stD", "stK", "stE", "stB"   # its back wall; the shadow under its
                                    # lip and down its far side; its near side; the sill in its foot
GREEBLE = (25, 29, 24, 29)          # a box in the far slot
STUBS = ((25, 26), (27, 28))        # two short rails over it
STUB_Z = (3, 12)


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


def _frame(f, u0, u1, z0, z1, d, col, px):
    """A painted 1 px outline."""
    zx = px / core.ZPX
    for a in ((u0, u1, z0, z0 + zx), (u0, u1, z1 - zx, z1), (u0, u0 + LINE, z0, z1), (u1 - LINE, u1, z0, z1)):
        _rect(f, *a, d, col)


def gap(s):
    """The gap between the module's boxes (z0, z1): the seams up the face break across it."""
    zl = s.z_at(s.z_at(s.zb, SH.UNDER), -1)
    return s.z_at(zl, BOX_GAP + 1), zl


def _module(f, s0, zk):
    s, H, px = f.sec, f.sec.H, 1 / core.ZPX
    under = lambda n: s.z_at(s.zb, n)                       # noqa: E731  n px under the bullnose's foot
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
    m = (a + b) / 2
    for n in VENTS:                                         # its vent (px rows under its top on screen)
        zv = zl + lift + round((top - zl) / px) * px - n * px
        _rect(f, m - VENT_W / 2 * LINE, m + VENT_W / 2 * LINE, zv - px, zv, out + 0.001, SH.GROOVE_D)
    # the lower box: from BOX_GAP px under the line's top (the line its gap) and a px more, down to a px over the
    # groove's line
    z1, z0 = gap(s)[0] + lift, s.z_at(SH.GROOVE, -2) + lift
    f.part(a, b, [(D - 0.01, z0), (D - 0.01, z1), (out, z1), (out, z0)], [None, SH.FACE, SH.FACE, None], BOX_SIDE,
           end=False)
    # the framed plate on it
    p0, p1, n0, n1 = PLATE
    u0, u1 = _span(s0, p0, p1)
    SH._part(f, u0, u1, under(n1), under(n0), (BOX_OUT + 1) * LINE, SH.FACE, "stH", SH.SEAM)
    fd = out + LINE + 0.001
    i = PLATE_IN * LINE
    _frame(f, u0 + i, u1 - i, under(n1 - PLATE_IN), under(n0 + PLATE_IN), fd, SH.SEAM, 1)
    hp, ht, hf = HANDLE
    hu = _u(s0, hp)
    _rect(f, hu - LINE, hu, under(n1 - hf), under(n0 + ht), fd, SH.GROOVE_D)
    # the recess, from the groove down to the step
    p0, p1, up = RECESS
    u0, u1 = _span(s0, p0, p1)
    zt, zf = s.z_at(SH.GROOVE, -up), s.z_at(SH.FOOT_H, -1)
    _rect(f, u0, u1, zf, zt, D + 0.003, RECESS_BACK)
    _rect(f, u1 - LINE, u1, zf, zt, D + 0.004, RECESS_SIDE)             # (u1: the near side, p0)
    _rect(f, u0, u0 + LINE, zf, zt, D + 0.004, RECESS_RIM)
    _rect(f, u0, u1, s.z_at(zt, 2), zt, D + 0.005, RECESS_RIM)
    _rect(f, u0, u1, zf, s.z_at(zf, -2), D + 0.005, RECESS_SILL)
    # the far slot: a box, two short rails over it
    p0, p1, n0, n1 = GREEBLE
    u0, u1 = _span(s0, p0, p1)
    SH._part(f, u0, u1, under(n1), under(n0), LINE, SH.FACE, "stH", SH.SEAM)
    for p0, p1 in STUBS:
        u0, u1 = _span(s0, p0, p1)
        SH._part(f, u0, u1, under(STUB_Z[1]), under(STUB_Z[0]), LINE, SH.FACE, "stH", SH.SEAM)


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
