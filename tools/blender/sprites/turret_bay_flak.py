"""Flak cannon bay (2x2): the hull scrap the turret fires is tipped into a funnel round the foot of a screw lift and
carried up through the roof to the turret.

  lift     the laser bay's lift widened: the rams stand out on ears grown from the flange and the narrow ram collar (as
           the incendiary bay's), so the funnel fits between them; the keep-clear ring moves out with them
  drive    an octagonal gearbox on the flange, a drive motor with a brass hub bolted to one flat
  tube     the screw lift: an octagonal tube from the gearbox up into the ram collar, joint bands at its foot, an
           inspection slot on the camera's flat where the brass flights show, slanting as a helix does
  funnel   a flared octagonal intake on a collar round the tube, loose scrap heaped in it, a hazard lip on its rim, two
           gussets under it to the tube

The shape language is the turret's (turret_flak): octagonal sections with flats to the camera, dark joint bands, hazard
paint, brass hubs. About 36 px a world unit: nothing under 0.06. Frame and FRONT as turret_bay_laser (u = grid +x,
v = grid +y, origin = footprint centre at floor level); built the same way round for every rotation, as the laser bay."""
import math

from . import cmbkit, core, detail as D
from . import turret_bay_laser as L
from . import turret_bays as TB
from . import turret_concepts as TC
from .cmbkit import Frame

_g = TC._g
P, obox, FRONT, TOP = L.P, L.obox, L.FRONT, L.TOP
ZI = TOP - 0.42                       # the ram collar's underside
RAM_R, COLLAR_R, FL = 0.54, 0.3, 0.46
RAMS = (FRONT + math.pi / 2, FRONT - math.pi / 2)
SCRAP = ("rust", "steel", "rustD", "gm", "plate", "steelL", "rust", "steelD")   # none emissive: idle bays carry no glow
T8 = math.tan(math.pi / 8)


def oct_pts(r):
    """An octagon of inradius r, its flats facing k x 45 degrees (one of them FRONT, toward the camera)."""
    R_ = r / math.cos(math.pi / 8)
    return [P(math.radians(22.5 + 45 * k), R_) for k in range(8)]


def octa(f, r, z0, z1, mat, top=None):
    TB.prism(f, oct_pts(r), z0, z1, mat, top=top or mat)


def frustum(f, r0, z0, r1, z1, mat, top=None):
    """An octagonal taper from inradius r0 at z0 to r1 at z1, with a top face."""
    a, b = oct_pts(r0), oct_pts(r1)
    for i in range(8):
        j = (i + 1) % 8
        f.poly([f.pt(*a[i], z0), f.pt(*a[j], z0), f.pt(*b[j], z1), f.pt(*b[i], z1)], mat, flip=True)
    if top:
        f.poly([f.pt(*p, z1) for p in b], top, flip=True)


def flat(f, k, r, z0, z1, mat, t=0.012, w=None, off=0.0):
    """A plate on flat k (facing k x 45 deg) of an octagon of inradius r."""
    obox(f, math.radians(45 * k), r - 0.004, r + t, (r * T8 - 0.004) if w is None else w, z0, z1, mat, mat, off=off)


def scrap(f, pts, z, seed=7):
    """Loose scrap: grid-square chunks of mixed metal at uneven heights, one at each (u, v)."""
    _g("scrap")
    k = seed
    for u, v in pts:
        k = (k * 1103515245 + 12345) & 0x7fffffff
        w = 0.08 + (k >> 9) % 3 * 0.02
        f.box(u, v, z, w, w, 0.05 + (k >> 5) % 3 * 0.03, SCRAP[k % len(SCRAP)], top=SCRAP[(k >> 3) % len(SCRAP)])


def lift(f, ring=(0.68, 0.76)):
    """The laser bay's lift with the rams out on ears (flange and collar), a narrow ram collar, the roof collar."""
    _g("lift")
    f.vcyl(0, 0, 0, FL, 0.14, "gm", top="steel", sides=32)
    for k in range(12):
        a = (k + 0.5) * math.tau / 12
        if any(abs((a - b + math.pi) % math.tau - math.pi) < 0.25 for b in RAMS):
            continue
        u, v = P(a, FL - 0.06)
        f.vcyl(u, v, 0.14, 0.028, 0.035, "steelL", top="plate", sides=6)
    L.hazard_ring(f, *ring)
    zc = ZI
    f.vcyl(0, 0, zc, COLLAR_R, 0.09, "steel", top="steelL", sides=32)
    f.vcyl(0, 0, zc - 0.025, COLLAR_R + 0.005, 0.025, "steelD", sides=32)
    f.vcyl(0, 0, TOP - 0.12, L.R + 0.08, 0.12, "steelL", top="steel", sides=28)          # roof collar
    f.vcyl(0, 0, TOP, L.R - 0.02, 0.025, "steel", top="steelL", sides=28)
    for a in RAMS:
        u, v = P(a, RAM_R)
        obox(f, a, FL - 0.2, RAM_R, 0.09, 0.0, 0.14, "gm", "steel")
        f.vcyl(u, v, 0.0, 0.09, 0.14, "gm", top="steel", sides=16)
        f.vcyl(u, v, 0.14, 0.085, 0.1, "gm", top="steel", sides=16)
        D.seg(f, (u, v, 0.24), (u, v, 0.95), 0.055, "steelD", 12, cap="steel")
        D.seg(f, (u, v, 0.95), (u, v, zc - 0.06), 0.03, "steelL", 10, cap="steelL")
        obox(f, a, COLLAR_R - 0.02, RAM_R, 0.09, zc, zc + 0.09, "steel", "steelL")
        f.vcyl(u, v, zc, 0.09, 0.09, "steel", top="steelL", sides=16)
        f.vcyl(u, v, zc - 0.06, 0.05, 0.06, "steelL", sides=12)
        f.vcyl(u, v, zc + 0.09, 0.05, 0.03, "steelD", top="plate", sides=6)


def motor(f, k, r, z, length=0.26, rad=0.11, ribs=(0.35, 0.65), hub=0.45):
    """A drive motor bolted radially to flat k of an octagon of inradius r: a mounting flange, a ribbed body, a
    brass-hubbed end cap."""
    _g("motor")
    a = math.radians(45 * k)
    D.seg(f, (*P(a, r - 0.01), z), (*P(a, r + 0.04), z), rad + 0.04, "steelD", 16, cap="steel")
    D.seg(f, (*P(a, r + 0.04), z), (*P(a, r + length), z), rad, "gm", 16, cap="steelL")
    for t in ribs:
        rr = r + 0.04 + (length - 0.04) * t
        D.seg(f, (*P(a, rr - 0.02), z), (*P(a, rr + 0.02), z), rad + 0.025, "steelL", 16, cap="steelL",
              capstart="steelL")
    D.seg(f, (*P(a, r + length), z), (*P(a, r + length + 0.02), z), rad * hub, "brass", 12, cap="brass")


def helix_window(f, r, z0, z1, k=1, n=4, t=0.06, slope=0.05):
    """An inspection slot on flat k of an octagon tube, the screw's brass flights showing through it, each slanting
    up to the right across the slot as a helix does."""
    _g("window")
    w = r * T8 - 0.025
    flat(f, k, r, z0, z1, "dark", t=0.006, w=w)
    a = math.radians(45 * k)
    ca, sa = math.cos(a), math.sin(a)
    ro = r + 0.012

    def pt(s_, z):
        return f.pt(ca * ro - sa * s_, sa * ro + ca * s_, z)
    span = (z1 - z0 - 0.06) / n
    for i in range(n):
        zc = z0 + 0.04 + i * span
        lo, hi = zc - slope / 2, zc + slope / 2                                              # left end, right end
        f.poly([pt(w, lo), pt(-w, hi), pt(-w, hi + t), pt(w, lo + t)], "brass", flip=True)
    for z in (z0 - 0.05, z1):                                                              # frame bands above, below
        octa(f, r + 0.02, z, z + 0.05, "steel", "steelL")


def rim_lip(f, r0, r1, z, h=0.03):
    """A flat octagonal lip on top of a funnel rim, its flats painted yellow and black in turn."""
    _g("lip")
    a, b = oct_pts(r0), oct_pts(r1)
    for i in range(8):
        j = (i + 1) % 8
        TB.prism(f, [a[i], b[i], b[j], a[j]], z, z + h, "hazY" if i % 2 == 0 else "hazK")


def bay_flak(rot=0):
    m = core.Mesh("bay_flak")
    f = Frame(m, 1, square=True)
    TB._floor(-1.0, 1.0)
    lift(f)
    _g("gearbox")
    octa(f, 0.3, 0.14, 0.36, "steelD", "steel")
    octa(f, 0.31, 0.3, 0.36, "steel", "steelL")
    motor(f, 0, 0.3, 0.25, length=0.28, rad=0.1, ribs=(0.5,), hub=0.6)
    _g("tube")
    r = 0.2
    octa(f, r, 0.36, ZI, "gm", "steel")
    octa(f, r + 0.02, 0.36, 0.42, "steelD", "steel")
    helix_window(f, r, 1.06, ZI - 0.1)
    _g("funnel")
    zf0, zf1, rt = 0.66, 0.86, 0.48
    octa(f, r + 0.04, zf0 - 0.06, zf0 + 0.02, "steel", "steelL")                            # funnel collar on the tube
    frustum(f, r + 0.01, zf0, rt, zf1, "steelD")
    frustum(f, rt + 0.01, zf1 - 0.05, rt + 0.01, zf1, "steel")                              # rim band (open)
    rim_lip(f, rt - 0.03, rt + 0.03, zf1)
    for k in (0, 2):                                                                        # gussets under it
        a = math.radians(45 * k)
        pts = [P(a, r + 0.03), P(a, rt - 0.04)]
        D.rail(f, (*pts[0], zf0 - 0.06), (*pts[1], zf1 - 0.06), 0.035, "steel")
    scrap(f, [P(FRONT + (k - 7.5) * 0.4, 0.33) for k in range(16)], 0.74)
    return [m.build()] if cmbkit.REC is None else []


TB.BAYS["flak"] = bay_flak
