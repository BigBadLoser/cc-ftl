"""Flak cannon bay (2x2) concepts, round 2: where the hull scrap the turret fires goes in, is broken up and is lifted up
through the roof. Each concept is ONE machine on the lift axis, its parts meeting at flanges and collars, with the
scrap's path readable: in, processed, up the neck into the roof collar. The shape language is the turret's: octagonal
sections with flats to the camera, dark joint bands, a hazard band, brass hubs.

All stand on a widened version of the laser bay's lift (flange, keep-clear ring, rams, ram and roof collars) with the
rams moved out on ears, as the incendiary bay does, so the machine between them can be wide. About 36 px a world unit:
nothing under 0.06.

  A  MILL     a hammer-mill housing (octagon) over a gearbox, a feed throat with a hazard lip on its front, side motors
              bolted to it; it tapers into the lift neck
  B  AUGER    an octagonal screw-lift tube from a gearbox to the roof, an inspection window showing the brass flights;
              a flared intake funnel round its foot on struts, loose scrap in it
  C  PRESS    a compaction press: a mould with an open loading door and scrap inside, four tie rods up to a crosshead,
              a coaxial ring cylinder; the compacted charge goes up the neck through it

Frame and FRONT as turret_bay_laser (u = grid +x, v = grid +y, origin = footprint centre at floor level)."""
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
SCRAP = ("rust", "steel", "rustD", "gm", "orange", "steelL", "rust", "steelD")
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


def hazard(f, r, z0, z1):
    for k in range(8):
        flat(f, k, r, z0, z1, "hazY" if k % 2 == 0 else "hazK")


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


def neck(f, z0, r=0.15, bands=()):
    """The lift neck: the charge goes up it into the ram collar and on through the roof."""
    _g("neck")
    f.vcyl(0, 0, z0, r, ZI - z0, "steelD", sides=20)
    for z in bands:
        f.vcyl(0, 0, z, r + 0.03, 0.06, "steel", top="steelL", sides=20)


def motor(f, k, r, z, length=0.26, rad=0.11):
    """A drive motor bolted radially to flat k of an octagon of inradius r: a mounting flange, a ribbed body, a
    brass-hubbed end cap."""
    _g("motor")
    a = math.radians(45 * k)
    D.seg(f, (*P(a, r - 0.01), z), (*P(a, r + 0.04), z), rad + 0.04, "steelD", 16, cap="steel")
    D.seg(f, (*P(a, r + 0.04), z), (*P(a, r + length), z), rad, "gm", 16, cap="steelL")
    for t in (0.35, 0.65):
        rr = r + 0.04 + (length - 0.04) * t
        D.seg(f, (*P(a, rr - 0.02), z), (*P(a, rr + 0.02), z), rad + 0.025, "steelL", 16, cap="steelL",
              capstart="steelL")
    D.seg(f, (*P(a, r + length), z), (*P(a, r + length + 0.02), z), rad * 0.45, "brass", 12, cap="brass")


def at(r, s_):
    """(u, v) r out toward the camera (FRONT), s_ across it."""
    c, d = math.cos(FRONT), math.sin(FRONT)
    return (r * c - s_ * d, r * d + s_ * c)


def hopper(f, r, z0, z1, lo, hi):
    """A square feed hopper square to FRONT, centred r out: (half width, half depth) at its foot z0 and its rim z1;
    dark inside, a hazard lip on the side toward the camera."""
    _g("hopper")
    c = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    a = [(*at(r + lo[1] * i, lo[0] * j), z0) for i, j in c]
    b = [(*at(r + hi[1] * i, hi[0] * j), z1) for i, j in c]
    for i in range(4):
        j = (i + 1) % 4
        f.poly([f.pt(*a[i]), f.pt(*a[j]), f.pt(*b[j]), f.pt(*b[i])], "gm", flip=True)
    f.poly([f.pt(*p) for p in a], "dark", flip=True)
    obox(f, FRONT, r + hi[1] - 0.02, r + hi[1] + 0.03, hi[0] + 0.02, z1 - 0.06, z1, "hazY", "hazY")
    for k in (-1, 1):
        obox(f, FRONT, r - hi[1], r + hi[1] + 0.03, 0.025, z1 - 0.05, z1, "steelL", "steelL", off=k * (hi[0] + 0.02))


# ---- A: MILL -------------------------------------------------------------------------------------------------------

def mill(rot=0):
    m = core.Mesh("bay_flak_mill")
    f = Frame(m, 1, square=True)
    TB._floor(-1.0, 1.0)
    lift(f)
    _g("gearbox")
    octa(f, 0.3, 0.14, 0.32, "steelD", "steel")
    _g("housing")
    r, z0, z1 = 0.36, 0.32, 0.96
    octa(f, r, z0, z1, "gm", "steel")
    octa(f, r + 0.018, z0, z0 + 0.06, "steelD")                                            # joint bands
    octa(f, r + 0.018, z1 - 0.06, z1, "steelD", "steel")
    hazard(f, r, 0.44, 0.5)
    _g("throat")
    obox(f, FRONT, 0.2, r + 0.14, 0.12, 0.56, 0.8, "gm", "steel")                          # throat into the housing
    hopper(f, r + 0.12, 0.8, 1.04, (0.12, 0.1), (0.21, 0.18))
    scrap(f, [at(r + 0.12 + dr, s_) for dr, s_ in ((-0.05, -0.08), (0.04, 0.0), (-0.03, 0.09))], 0.84, seed=5)
    motor(f, 0, r, 0.66)
    motor(f, 2, r, 0.66)
    _g("taper")
    frustum(f, r, z1, 0.19, z1 + 0.16, "steel", "steelL")
    neck(f, z1 + 0.16, bands=(1.24, 1.44))
    return [m.build()] if cmbkit.REC is None else []


# ---- B: AUGER ------------------------------------------------------------------------------------------------------

def auger(rot=0):
    m = core.Mesh("bay_flak_auger")
    f = Frame(m, 1, square=True)
    TB._floor(-1.0, 1.0)
    lift(f)
    _g("gearbox")
    octa(f, 0.3, 0.14, 0.36, "steelD", "steel")
    motor(f, 0, 0.3, 0.25, rad=0.09)
    _g("tube")
    r = 0.2
    octa(f, r, 0.36, ZI, "gm", "steel")
    for z in (0.36, 0.98, ZI - 0.08):
        octa(f, r + 0.02, z, z + 0.06, "steelD", "steel")
    _g("window")
    z0, z1 = 1.06, ZI - 0.12
    flat(f, 1, r, z0, z1, "dark", t=0.006, w=r * T8 - 0.025)
    n = 5
    for i in range(n):
        z = z0 + 0.04 + i * (z1 - z0 - 0.08) / (n - 1)
        flat(f, 1, r, z - 0.025, z + 0.025, "brass", t=0.008, w=r * T8 - 0.03)            # flights through the slot
    _g("funnel")
    zf0, zf1, rt = 0.66, 0.86, 0.48
    frustum(f, r + 0.01, zf0, rt, zf1, "steelD")
    frustum(f, rt + 0.01, zf1 - 0.05, rt + 0.01, zf1, "steel")                              # rim band (open)
    hazard(f, rt, zf1 - 0.035, zf1 - 0.005)
    for k in (1, 3, 5, 7):                                                                  # struts to the flange
        a = math.radians(45 * k)
        D.rail(f, (*P(a, FL - 0.08), 0.14), (*P(a, rt - 0.02), zf1 - 0.04), 0.04, "steel")
    scrap(f, [P(FRONT + (k - 7.5) * 0.4, 0.33) for k in range(16)], 0.74)
    return [m.build()] if cmbkit.REC is None else []


# ---- C: PRESS ------------------------------------------------------------------------------------------------------

def press(rot=0):
    m = core.Mesh("bay_flak_press")
    f = Frame(m, 1, square=True)
    TB._floor(-1.0, 1.0)
    lift(f)
    _g("mould")
    r, z0, z1 = 0.34, 0.14, 0.62
    octa(f, r, z0, z1, "gm", "steel")
    octa(f, r + 0.02, z1 - 0.06, z1, "steelD", "steel")
    _g("door")
    w = r * T8
    obox(f, FRONT, r - 0.01, r + 0.006, w - 0.02, z0 + 0.1, z1 - 0.1, "dark", "dark")        # loading door, open
    scrap(f, [P(FRONT + d, r - 0.03) for d in (-0.2, 0.0, 0.2)], z0 + 0.12, seed=11)
    scrap(f, [P(FRONT + d, r - 0.05) for d in (-0.1, 0.1)], z0 + 0.22, seed=4)
    for s in (-1, 1):
        obox(f, FRONT, r - 0.01, r + 0.03, 0.025, z0 + 0.06, z1 - 0.06, "hazY", "hazY", off=s * (w - 0.01))
    _g("ties")
    zc0, zc1 = 1.18, 1.32
    for k in (1, 3, 5, 7):                                                                  # tie rods on the corners
        u, v = P(math.radians(45 * k), r + 0.02)
        D.seg(f, (u, v, z1), (u, v, zc0), 0.04, "steelL", 10)
        f.vcyl(u, v, z1, 0.06, 0.05, "steel", top="steelL", sides=10)
        f.vcyl(u, v, zc1, 0.05, 0.04, "steelD", top="plate", sides=6)                     # nuts
    _g("platen")
    octa(f, 0.3, 0.74, 0.84, "steel", "steelL")
    _g("cylinder")
    octa(f, r + 0.04, zc0, zc1, "gm", "steelL")                                              # crosshead
    f.vcyl(0, 0, 0.84, 0.26, zc0 - 0.84, "steelD", top="steel", sides=24)                  # ring cylinder
    f.vcyl(0, 0, 0.96, 0.27, 0.06, "steel", sides=24)
    neck(f, zc1, bands=(1.46,))
    return [m.build()] if cmbkit.REC is None else []


CONCEPTS = {"flakbayA": mill, "flakbayB": auger, "flakbayC": press}
for _k, _fn in CONCEPTS.items():
    TB.BAYS[_k] = _fn
