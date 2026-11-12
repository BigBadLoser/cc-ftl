"""Stasis slab storage, the flap wheel (family `slab`, preview only; issue #116): twelve cassette slabs round a core on a
3x3, turned 40 deg off radial so the faces on the near side fan open to the room. Round 7, after round 6: the packing
stays, the sleek sci-fi look goes; built in the weapon bays' language instead (turret_bay_missile, _incendiary):
gunmetal and steel, mechanisms you can read (races, ring gears, pinions, cages, pipes, valves, bolted clamps), hazard
paint for the edges and the hand parts, light only where the field is.

  s19  carousel: a slewing ring on a striped platform, a ring gear round the deck driven by a finned motor through a
       pinion at the front; each slab's foot in a bolted cup on the deck, its head in a clamp on a box arm from an open
       cage of longerons and hoops round a field column of coils
  s20  manifold: the slabs on a bolted turntable round a banded field vessel; a header pipe ring over their heads, a
       drop to each head through a valve with a hand wheel; the feed comes up from the floor at the front through a
       gate valve and a regulator, over to a rotary union on the vessel
  s21  gantry: an overhead slewing ring on three braced columns (the front left open), a pinion motor on a girder;
       each slab hangs from the ring by a spreader and two links, its foot guided by a pin and roller in a floor track;
       a pendant controller hangs at the front"""
import math

from . import detail as D
from .core import G as GV
from .slab_study import L, Slab, beam, cassette

UP = (0.0, 0.0, 1.0)
N12, SKEW, R0 = 12, math.radians(40), 1.0
FRONT = math.pi / 4                                 # the footprint's front corner (toward the viewer)


class KF:
    """A modkit.K seen as a cmbkit Frame (pt, poly), so detail.py's tubes draw into it."""

    def __init__(self, k):
        self.k, self.m = k, k.m

    def pt(self, u, v, z, **_):
        return GV(*self.k.p(u, v), z)

    def poly(self, pts, color, flip=False):
        self.k.m.poly(pts, color, flip=flip)


def tube(k, a, b, r, col, sides=8):
    D.seg(KF(k), a, b, r, col, sides, cap=col, capstart=col)


def angles():
    return [math.radians(45 + 360 * i / N12) for i in range(N12)]


def at(r, a, z=0.0):
    return (r * math.cos(a), r * math.sin(a), z)


def slabs(k, z0):
    out = []
    for th in angles():
        ts = th - SKEW
        out.append(cassette(k, Slab(at(R0, th, z0), UP, (-math.sin(ts), math.cos(ts), 0.0)), body="gm"))
    return out


def ring(k, r, z, h, w, col, top=None, n=48, skip=None, colf=None):
    """A ring of n segments at radius r: w wide (radially), h tall. skip(i): leave segment i out; colf(i): its colour."""
    for i in range(n):
        if skip and skip(i):
            continue
        a = (i + 0.5) * math.tau / n
        c = colf(i) if colf else col
        k.box(*at(r, a)[:2], z, math.tau * r / n * 1.08, w, h, c, top=top or c, rz=a + math.pi / 2)


def hazard(k, r, z, w=0.08, n=40):
    ring(k, r, z, 0.012, w, None, n=n, colf=lambda i: "hazY" if i % 2 else "hazK")


def bolts(k, r, z, n, s=0.05):
    for i in range(n):
        k.cyl(*at(r, (i + 0.5) * math.tau / n)[:2], z, s / 2, 0.025, "steelL", top="steel", sides=6)


def motor(k, u, v, z, h=0.5):
    """A finned drive motor standing on its bracket."""
    k.box(u, v, z, 0.36, 0.36, 0.06, "steelD", top="steel")
    k.cyl(u, v, z + 0.06, 0.15, h, "gm", top="steelL", sides=12)
    for i in range(5):
        k.cyl(u, v, z + 0.14 + i * (h - 0.14) / 5, 0.2, 0.03, "steelD", top="steel", sides=12)
    k.cyl(u, v, z + 0.06 + h, 0.08, 0.07, "steelD", top="gm", sides=10)


def platform(k, deck=True):
    """The striped platform, a slewing ring (lower race, seam), the deck as its upper race."""
    k.cyl(0, 0, 0.0, 1.48, 0.1, "steelD", top="steel", sides=48)
    hazard(k, 1.42, 0.1)
    if deck:
        k.cyl(0, 0, 0.1, 1.3, 0.06, "steelD", top="steel", sides=48)
        k.cyl(0, 0, 0.16, 1.27, 0.02, "dark", sides=48)
        k.cyl(0, 0, 0.18, 1.3, 0.1, "gm", top="steelL", sides=48)
        bolts(k, 1.2, 0.28, 24)


def cup(k, s, l0, l1):
    """A bolted clamp round one end cap of the slab (l0..l1 along it), a lock lever in hazard paint."""
    s.box(k, l0, l1, -0.5, 0.5, -0.32, 0.1, "gm", face="steelL")
    for w in (-0.38, 0.38):
        s.box(k, l0 + 0.04, l0 + 0.1, w - 0.03, w + 0.03, 0.1, 0.12, "steel")
    s.box(k, l0 + 0.03, l1 - 0.03, -0.07, 0.07, 0.1, 0.13, "hazY")


def carousel(k):
    """s19."""
    z0, zs = 0.36, 0.36 + L + 0.34                                            # the slabs' foot, the arms' centre line
    platform(k)
    ring(k, 1.33, 0.18, 0.1, 0.06, "steelL", n=72, skip=lambda i: i % 2)    # the ring gear's teeth
    k.cyl(*at(1.4, FRONT)[:2], 0.16, 0.1, 0.14, "steelL", top="steel", sides=12)   # the pinion
    beam(k, at(1.72, FRONT, 0.3), at(1.4, FRONT, 0.3), 0.16, 0.12, "gm", top="steel")   # its gearbox
    motor(k, *at(1.74, FRONT)[:2], 0.0)
    tube(k, at(1.74, FRONT + 0.25, 0.05), at(2.0, FRONT + 0.1, 0.05), 0.04, "steelD")   # its cable
    k.cyl(0, 0, 0.28, 0.16, zs - 0.28, "dark", top="steelD", sides=10)       # the field column
    for i in range(6):                                                       # its coils
        z = 0.6 + i * 0.3
        k.cyl(0, 0, z, 0.25, 0.07, "steelD", top="steel", sides=12)
        k.cyl(0, 0, z + 0.12, 0.19, 0.04, "slbCy", sides=12)
    for i in range(8):                                                       # the cage: longerons, hoops, X braces
        a = (i + 0.5) * math.tau / 8
        tube(k, at(0.44, a, 0.28), at(0.44, a, zs), 0.035, "steel")
    for z in (0.28, 1.05, 1.8, 2.45):
        ring(k, 0.46, z, 0.08, 0.06, "gm", top="steelL", n=16)
    for i in range(8):
        a0, a1 = (i + 0.5) * math.tau / 8, (i + 1.5) * math.tau / 8
        if abs(math.remainder((a0 + a1) / 2 - FRONT, math.tau)) < 1.2:
            continue                                                         # open toward the room
        for z0_, z1_ in ((0.36, 1.05), (1.13, 1.8)):
            tube(k, at(0.44, a0, z0_), at(0.44, a1, z1_), 0.022, "steelD")
            tube(k, at(0.44, a1, z0_), at(0.44, a0, z1_), 0.022, "steelD")
    out = slabs(k, z0)
    for s in out:
        cup(k, s, -0.08, 0.1)
        s.box(k, L - 0.08, L + 0.08, -0.16, 0.16, -0.3, 0.09, "gm", face="steelL")   # the head clamp
        s.box(k, L - 0.05, L + 0.05, -0.05, 0.05, 0.09, 0.115, "hazY")
        h = s.p(L, 0.0, -0.1)
        a = math.atan2(h[1], h[0])
        beam(k, at(0.46, a, zs), (h[0], h[1], zs), 0.08, 0.1, "gm", top="steelL")   # the arm
        tube(k, (h[0], h[1], z0 + L + 0.08), (h[0], h[1], zs), 0.035, "steel")   # its hanger
        k.box(h[0], h[1], zs - 0.07, 0.12, 0.12, 0.14, "steelD", top="steel", rz=a)   # the arm's end block
        tube(k, at(0.48, a, zs - 0.45), at(0.75, a, zs - 0.05), 0.022, "steelD")   # its knee brace
    k.cyl(0, 0, zs - 0.1, 0.52, 0.2, "gm", top="steelL", sides=16)          # the top hoop, bolted
    bolts(k, 0.44, zs + 0.1, 12)
    k.cyl(0, 0, zs + 0.1, 0.3, 0.1, "steelD", top="steel", sides=12)
    return out


def manifold(k):
    """s20."""
    z0 = 0.36
    zh = z0 + L + 0.34                                                       # the header ring's centre line
    platform(k)
    k.cyl(0, 0, 0.28, 0.52, 0.1, "steelD", top="steel", sides=16)           # the vessel's cradle ring and struts
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        tube(k, at(0.5, a, 0.36), at(0.36, a, 0.75), 0.03, "steel")
    k.cyl(0, 0, 0.5, 0.4, 1.5, "gm", top="steelL", sides=16)                # the vessel
    for z in (0.62, 1.1, 1.75):
        k.cyl(0, 0, z, 0.44, 0.06, "steelL", top="steelL", sides=16)
    ring(k, 0.41, 1.3, 0.14, 0.02, None, n=24, colf=lambda i: "hazY" if i % 2 else "hazK")
    k.cyl(0, 0, 1.36, 0.42, 0.03, "slbCy", sides=16)                         # its level band
    k.cyl(0, 0, 2.0, 0.4, 0.22, "gm", top="steelL", sides=16, rtop=0.24)    # the dome
    k.cyl(0, 0, 2.22, 0.13, zh - 2.22, "steelL", top="steel", sides=10)     # the neck
    k.cyl(0, 0, zh - 0.12, 0.2, 0.24, "steelD", top="steel", sides=12)      # the rotary union
    for z in (zh - 0.06, zh + 0.04):
        k.cyl(0, 0, z, 0.22, 0.03, "steelL", sides=12)
    out = slabs(k, z0)
    hs = []
    for s in out:
        cup(k, s, -0.08, 0.1)
        h = s.p(L, 0.0, -0.1)
        hs.append(math.atan2(h[1], h[0]))
        s.box(k, L - 0.06, L + 0.05, -0.18, 0.18, -0.22, 0.02, "steelD", face="steel")   # the head coupling
        zm = (z0 + L + zh) / 2
        tube(k, (h[0], h[1], z0 + L + 0.05), (h[0], h[1], zh), 0.04, "gm")  # the drop
        k.box(h[0], h[1], zm - 0.08, 0.11, 0.11, 0.12, "steelD", top="steel")   # its valve
        k.cyl(h[0], h[1], zm + 0.04, 0.02, 0.05, "steel", sides=6)
        k.cyl(h[0], h[1], zm + 0.09, 0.075, 0.018, "hazY", sides=10)        # the hand wheel
    rh = math.hypot(*out[0].p(L, 0.0, -0.1)[:2])
    for i in range(24):                                                      # the header ring
        tube(k, at(rh, i * math.tau / 24 + hs[0], zh), at(rh, (i + 1) * math.tau / 24 + hs[0], zh), 0.05, "gm", sides=8)
    for a in hs:
        k.box(*at(rh, a)[:2], zh - 0.07, 0.14, 0.14, 0.14, "steelL", top="steelL", rz=a)   # its tee at each drop
    for i in range(4):                                                       # spokes out from the union
        a = hs[0] + math.pi / 12 + i * math.pi / 2
        tube(k, (0, 0, zh), at(rh, a, zh), 0.045, "gm")
    fa = FRONT - math.pi / 2                                                 # the feed riser, at the right corner
    fu, fv, _ = at(1.78, fa)
    zt = zh + 0.32
    k.box(fu, fv, 0.0, 0.3, 0.3, 0.06, "steelD", top="steel")
    tube(k, (fu, fv, 0.06), (fu, fv, zt), 0.065, "gm")
    for z in (0.5, 1.9):
        k.cyl(fu, fv, z, 0.095, 0.05, "steelL", sides=8)
    k.box(fu, fv, 0.9, 0.2, 0.2, 0.3, "gm", top="steel", rz=fa)           # the gate valve
    k.cyl(fu, fv, 1.2, 0.025, 0.14, "steel", sides=6)
    k.box(fu, fv, 1.34, 0.32, 0.03, 0.03, "hazY", rz=fa + math.pi / 2)    # its hand wheel, edge-on
    k.cyl(fu, fv, 1.34, 0.16, 0.025, "hazY", sides=12)
    k.cyl(fu, fv, 1.5, 0.12, 0.24, "steelL", top="steel", sides=10)          # the regulator
    k.cyl(*at(1.86, fa)[:2], 1.58, 0.06, 0.06, "plate", sides=10)          # its gauge
    tube(k, (fu, fv, zt), (0, 0, zt), 0.065, "gm")                          # over to the union
    k.box(fu, fv, zt - 0.09, 0.18, 0.18, 0.18, "steelL", top="steelL")
    k.cyl(0, 0, zh + 0.12, 0.1, zt - zh - 0.12, "steelL", sides=8)
    return out


def gantry(k):
    """s21."""
    z0, zt = 0.42, 3.0                                                      # the slabs' foot, the girders' top
    zr = zt - 0.3                                                            # the turning race's underside
    platform(k, deck=False)
    ring(k, R0, 0.1, 0.08, 0.16, "steelD", top="dark")                      # the floor track, a C channel
    for r in (R0 - 0.09, R0 + 0.09):
        ring(k, r, 0.1, 0.1, 0.03, "steelL")
    cols = [at(1.92, a) for a in (FRONT + math.pi / 2, FRONT + math.pi, FRONT - math.pi / 2)]
    for u, v, _ in cols:                                                     # the columns
        k.box(u, v, 0.0, 0.36, 0.36, 0.06, "steelD", top="steel")
        k.box(u, v, 0.06, 0.18, 0.18, zt - 0.06, "gm", top="steelL")
        beam(k, (u, v, zt - 0.08), (u * 1.2 / 1.92, v * 1.2 / 1.92, zt - 0.08), 0.16, 0.16, "gm", top="steelL")
    for (u0, v0, _), (u1, v1, _) in zip(cols, cols[1:]):                     # the back girders and X braces
        beam(k, (u0, v0, zt - 0.08), (u1, v1, zt - 0.08), 0.14, 0.16, "gm", top="steelL")
        tube(k, (u0, v0, 0.3), (u1, v1, zt - 0.3), 0.025, "steelD")
        tube(k, (u1, v1, 0.3), (u0, v0, zt - 0.3), 0.025, "steelD")
    ring(k, 1.2, zt - 0.24, 0.12, 0.12, "steelD", top="steel")              # the fixed outer race
    ring(k, 1.04, zr, 0.18, 0.18, "gm", top="steelL")                       # the turning race
    ring(k, 1.14, zr + 0.02, 0.1, 0.05, "steelL", n=72, skip=lambda i: i % 2)   # its gear teeth
    bolts(k, 1.04, zr + 0.18, 24)
    pa = FRONT + math.pi + 0.3                                               # the pinion and its motor, on a girder
    k.cyl(*at(1.22, pa)[:2], zr, 0.09, 0.14, "steelL", top="steel", sides=12)
    beam(k, at(1.3, pa, zt), at(1.62, pa, zt), 0.3, 0.06, "steelD", top="steel")
    motor(k, *at(1.3, pa)[:2], zt + 0.03, h=0.4)
    out = slabs(k, z0)
    for s in out:
        s.box(k, -0.06, 0.0, -0.22, 0.22, -0.22, 0.0, "steelD", face="steel")   # the foot shoe
        f = s.p(0.0, 0.0, -0.1)
        tube(k, (f[0], f[1], z0 - 0.06), (f[0], f[1], 0.16), 0.03, "steelL")   # the guide pin
        k.cyl(f[0], f[1], 0.12, 0.07, 0.06, "steel", top="steelL", sides=10)    # its roller
        s.box(k, L, L + 0.08, -0.08, 0.08, -0.16, -0.04, "steelL")           # the lifting eye
        s.box(k, L + 0.08, L + 0.16, -0.32, 0.32, -0.15, -0.05, "gm", face="steelL")   # the spreader
        s.box(k, L + 0.09, L + 0.15, -0.05, 0.05, -0.05, -0.03, "hazY")
        for w in (-0.27, 0.27):                                              # the links up to the race
            p = s.p(L + 0.16, w, -0.1)
            tube(k, p, (p[0], p[1], zr), 0.022, "steel")
    pa_ = FRONT - 0.75
    pu, pv, _ = at(1.22, pa_)                                                # the pendant controller
    tube(k, (pu, pv, zt - 0.24), (pu, pv, 1.25), 0.012, "dark")
    k.box(pu, pv, 0.95, 0.12, 0.08, 0.3, "hazY", top="hazY", rz=pa_)
    for z in (1.05, 1.13):
        k.box(*at(1.26, pa_)[:2], z, 0.05, 0.02, 0.04, "dark", rz=pa_)
    return out


DESIGNS = {"s19": (carousel, (3, 3)), "s20": (manifold, (3, 3)), "s21": (gantry, (3, 3))}
OVERLAYS = {}
