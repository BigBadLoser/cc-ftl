"""Incendiary launcher bay (2x2): a pressurised gel reservoir with a regulated injection system.

  lift       the laser bay's lift adapted: the rams stand further out (on round-ended ears grown out of the flange and
             of the ram collar, each as thick as what it grows from), the ram collar is a narrow ring so the injection
             hardware under it shows; two flange bolts give way to the manifold brackets
  reservoir  a gel sphere on a cradle ring and struts round the core, an equator band, a hazard band, a light band low
             on it
  manifold   a red header arc across the front on two brackets: the sphere's two outlets drop into it through flanges,
             the two risers leave its capped ends through gate-valve bodies, an inline regulator on each
  rail       the risers turn inward into a header band above the sphere; a vertical injector rail climbs from it into the
             collar with two injector modules, each with a red hand wheel; a red feed pipe runs straight up from the top
             module into the collar

Frame and FRONT as turret_bay_laser (u = grid +x, v = grid +y, origin = footprint centre at floor level)."""
import math

from mathutils import Vector

from . import cmbkit, core, detail as D
from . import turret_bay_laser as L
from . import turret_bays as TB
from . import turret_concepts as TC
from .cmbkit import Frame

_g = TC._g
P, obox, FRONT, TOP, FL, R = L.P, L.obox, L.FRONT, L.TOP, L.FLANGE, L.R
RAMS = (FRONT + math.pi / 2, FRONT - math.pi / 2)
RAM_R, COLLAR_R = 0.52, 0.3          # the rams' radius, the narrow ram collar's
SC, SR = 0.84, 0.34                  # the sphere: centre height, radius
ZI = TOP - 0.42                      # the ram collar's underside
ZH = SC + SR + 0.02                  # just above the sphere: the header band
RISERS = (FRONT - math.pi / 4 - 0.06, FRONT + math.pi / 4 + 0.06)
BRACKETS = tuple(FRONT + s * (math.pi / 4 + 0.06 + 0.4) / 2 for s in (-1, 1))   # between each riser and outlet


def lift(f):
    _g("lift")
    f.vcyl(0, 0, 0, FL, 0.14, "gm", top="steel", sides=32)
    f.vcyl(0, 0, 0.14, FL - 0.12, 0.1, "steelD", top="steel", sides=28)
    for k in range(12):
        a = (k + 0.5) * math.tau / 12
        if any(abs((a - b + math.pi) % math.tau - math.pi) < 0.2 for b in BRACKETS):
            continue                                                                      # under a manifold bracket
        u, v = P(a, FL - 0.06)
        f.vcyl(u, v, 0.14, 0.028, 0.035, "steelL", top="plate", sides=6)
    L.hazard_ring(f, RAM_R + 0.16, RAM_R + 0.24)
    zc = ZI
    f.vcyl(0, 0, zc, COLLAR_R, 0.09, "steel", top="steelL", sides=32)
    f.vcyl(0, 0, zc - 0.025, COLLAR_R + 0.005, 0.025, "steelD", sides=32)
    for k in range(12):
        u, v = P((k + 0.5) * math.tau / 12, COLLAR_R - 0.05)
        f.vcyl(u, v, zc + 0.09, 0.02, 0.022, "steelL", top="plate", sides=6)
    f.vcyl(0, 0, TOP - 0.12, R + 0.08, 0.12, "steelL", top="steel", sides=28)          # roof collar
    f.vcyl(0, 0, TOP, R - 0.02, 0.025, "steel", top="steelL", sides=28)
    for a in RAMS:
        u, v = P(a, RAM_R)
        obox(f, a, FL - 0.2, RAM_R, 0.09, 0.0, 0.14, "gm", "steel")                       # flange ear, as thick as it,
        f.vcyl(u, v, 0.0, 0.09, 0.14, "gm", top="steel", sides=16)                       # its rounded end
        f.vcyl(u, v, 0.14, 0.085, 0.1, "gm", top="steel", sides=16)                      # the cylinder's boss
        D.seg(f, (u, v, 0.24), (u, v, 0.95), 0.055, "steelD", 12, cap="steel")
        D.seg(f, (u, v, 0.95), (u, v, zc - 0.06), 0.03, "steelL", 10, cap="steelL")
        obox(f, a, R + 0.08, RAM_R, 0.09, zc, zc + 0.09, "steel", "steelL")              # collar ear, as wide as its boss
        f.vcyl(u, v, zc, 0.09, 0.09, "steel", top="steelL", sides=16)                   # the boss on the ear
        f.vcyl(u, v, zc - 0.06, 0.05, 0.06, "steelL", sides=12)                          # gland sleeve under it
        f.vcyl(u, v, zc + 0.09, 0.05, 0.03, "steelD", top="plate", sides=6)              # rod nut


def hazard_band(f, z, r, h=0.06):
    f.vcyl(0, 0, z, r, h * 0.6, "hazY", sides=32)
    f.vcyl(0, 0, z + h * 0.6, r, h * 0.4, "hazK", sides=32)


def pipe(f, pts, r=0.026, mat="medRed"):
    """A pipe through pts with an elbow fitting at each corner."""
    _g("pipe")
    for a, b in zip(pts, pts[1:]):
        D.seg(f, tuple(a), tuple(b), r, mat, 16)
    for p in pts[1:-1]:
        f.vcyl(p[0], p[1], p[2] - r * 1.4, r * 1.5, r * 2.8, "steel", top="steelL", sides=16)


def regulator(f, p):
    """An inline regulator on a vertical line: a body, a diaphragm disc, an adjusting knob on top."""
    _g("regulator")
    f.vcyl(p[0], p[1], p[2] - 0.06, 0.045, 0.12, "steel", top="steelL", sides=12)
    f.vcyl(p[0], p[1], p[2] - 0.015, 0.07, 0.03, "steelL", top="plate", sides=14)
    f.vcyl(p[0], p[1], p[2] + 0.06, 0.02, 0.04, "steelD", top="plate", sides=8)


def handwheel(f, p, d, r=0.065, stem=0.1):
    """A valve hand wheel facing along d: a stem out from p, a red rim with three spokes and a hub."""
    _g("handwheel")
    p, d = Vector(p), Vector(d).normalized()
    c = p + d * stem
    D.seg(f, tuple(p), tuple(c), 0.014, "steelL", 6)
    e1 = d.cross(Vector((0, 0, 1)))
    if e1.length < 1e-3:
        e1 = Vector((1, 0, 0))
    e1.normalize()
    e2 = d.cross(e1).normalized()
    n = 20
    for k in range(n):
        a0, a1 = k * math.tau / n, (k + 1) * math.tau / n
        D.seg(f, tuple(c + (e1 * math.cos(a0) + e2 * math.sin(a0)) * r),
              tuple(c + (e1 * math.cos(a1) + e2 * math.sin(a1)) * r), 0.013, "medRed", 8)
    for k in range(3):
        a = k * math.tau / 3 + 0.3
        D.seg(f, tuple(c), tuple(c + (e1 * math.cos(a) + e2 * math.sin(a)) * r), 0.009, "medRed", 5)
    D.seg(f, tuple(c - d * 0.01), tuple(c + d * 0.015), 0.022, "steelL", 8)


def reservoir(f):
    _g("sphere")
    nb = 14                                                                              # slices along u: hcyl frustums
    for k in range(nb):                                                                  # render both ways
        a0, a1 = math.pi * k / nb, math.pi * (k + 1) / nb
        f.hcyl(-SR * math.cos(a0), -SR * math.cos(a1), 0, SC, max(SR * math.sin(a0), 0.02), "gm",
               r1=max(SR * math.sin(a1), 0.02), sides=32)
    f.vcyl(0, 0, SC - 0.03, SR + 0.012, 0.06, "steel", top="steelL", sides=32)          # equator band
    hazard_band(f, SC + 0.1, SR * math.cos(math.asin(0.1 / SR)) + 0.004, 0.05)
    zl = SC - 0.2                                                                        # a light band low on it
    f.vcyl(0, 0, zl, SR * math.cos(math.asin(0.2 / SR)) + 0.006, 0.035, "steelL", sides=32)
    _g("cradle")
    zc = SC - SR + 0.02
    TC.vannulus(f, 0.3, 0.24, zc - 0.06, zc, "steel", "steelL")
    for k in range(6):
        a = FRONT + (k + 0.5) * math.tau / 6
        D.seg(f, (*P(a, 0.27), 0.24), (*P(a, 0.27), zc - 0.06), 0.025, "steel", 8)
        D.seg(f, (*P(a, 0.27), zc), (*P(a, SR - 0.03), SC - 0.03), 0.022, "steel", 8, cap="steelL")
    _g("core")
    f.vcyl(0, 0, 0.24, 0.16, 1.2, "steelD", sides=24)


def manifold(f):
    rm, zm = 0.4, 0.24
    a0, a1 = RISERS[0] - 0.02, RISERS[1] + 0.02
    n = 32
    _g("header")
    pts = [Vector((*P(a0 + (a1 - a0) * k / n, rm), zm)) for k in range(n + 1)]
    for p, q in zip(pts, pts[1:]):
        D.seg(f, tuple(p), tuple(q), 0.045, "medRed", 18)
    for a in (a0, a1):                                                                    # end caps
        d = Vector((-math.sin(a), math.cos(a), 0)) * (1 if a == a1 else -1)
        c = Vector((*P(a, rm), zm))
        D.seg(f, tuple(c - d * 0.01), tuple(c + d * 0.02), 0.06, "steel", 14, cap="steelL", capstart="steelL")
    for a in BRACKETS:
        obox(f, a, rm - 0.05, rm + 0.05, 0.035, 0.14, zm - 0.03, "steelD", "steel")
    _g("inlets")
    for da in (-0.4, 0.4):
        a = FRONT + da
        out = Vector((*P(a, SR * 0.5), SC - SR * 0.86))
        q = Vector((*P(a, rm), zm + 0.04))
        pipe(f, [out, Vector((out.x, out.y, zm + 0.16)), Vector((q.x, q.y, zm + 0.16)), q], r=0.03)
        f.vcyl(q.x, q.y, zm + 0.03, 0.05, 0.03, "steel", top="steelL", sides=12)
    _g("takeoffs")
    for a in RISERS:
        q = Vector((*P(a, rm), zm))
        f.vcyl(q.x, q.y, zm + 0.04, 0.045, 0.1, "steel", top="steelL", sides=12)          # gate-valve body
        pipe(f, [Vector((q.x, q.y, zm + 0.14)), Vector((q.x, q.y, ZH - 0.25))])
        regulator(f, (q.x, q.y, 0.95))


def rail(f, rr=0.4):
    zh = ZH + 0.02
    _g("header")
    f.vcyl(0, 0, zh, 0.21, 0.1, "gm", top="steelL", sides=28)
    f.vcyl(0, 0, zh + 0.035, 0.215, 0.03, "steel", sides=28)
    for a in RISERS:
        q = Vector((*P(a, rr), zh + 0.05))
        pipe(f, [Vector((q.x, q.y, ZH - 0.25)), q, Vector((*P(a, 0.22), zh + 0.05))])
    _g("rail")
    obox(f, FRONT, 0.17, 0.27, 0.07, zh + 0.1, ZI, "steelD", "steel")                    # the channel
    for o in (-0.065, 0.065):
        obox(f, FRONT, 0.17, 0.29, 0.012, zh + 0.1, ZI, "steel", "steelL", off=o)        # its flanges
    obox(f, FRONT, 0.15, 0.3, 0.09, ZI - 0.04, ZI, "steel", "steelL")                    # its foot into the collar
    d = Vector((math.cos(FRONT), math.sin(FRONT), 0))
    span = ZI - (zh + 0.1)
    for k in range(2):
        z = zh + 0.12 + (k + 0.5) * span / 2 - 0.05
        obox(f, FRONT, 0.24, 0.33, 0.06, z - 0.05, z + 0.05, "gm", "steelL")             # injector module
        handwheel(f, (*P(FRONT, 0.33), z), d, r=0.045, stem=0.05)
    _g("neck")
    f.vcyl(0, 0, zh + 0.1, 0.14, TOP - 0.12 - zh - 0.1, "steelD", sides=18)
    f.vcyl(0, 0, zh + 0.18, 0.17, 0.05, "steel", top="steelL", sides=18)
    _g("feed")
    p = Vector((*P(FRONT, 0.315), zh + 0.12 + 1.5 * span / 2))                             # from the top module
    D.seg(f, tuple(p), (p.x, p.y, ZI), 0.026, "medRed", 16)                              # straight into the collar


def bay_incendiary(rot=0):
    """Built the same way round for every rotation, as the laser bay (turret_bay_laser.bay_laser)."""
    m = core.Mesh("bay_incendiary")
    f = Frame(m, 1, square=True)
    TB._floor(-1.0, 1.0)
    lift(f)
    reservoir(f)
    manifold(f)
    rail(f)
    return [m.build()] if cmbkit.REC is None else []


TB.BAYS["incendiary"] = bay_incendiary
