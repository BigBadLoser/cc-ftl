"""Stasis slab storage, the flap wheel (family `slab`, preview only; issue #116): twelve cassette slabs round a core on a
3x3, turned 40 deg off radial so the faces on the near side fan open to the room. Round 8, after round 7 (liked: a
believable mechanism holding each slab to the frame, and one that can believably turn the wheel; too grey, too safe,
only weapon-bay ideas): each variant gets its own paint and a drive and a hold the bays don't use.

  s22  Geneva indexer (navy, safety orange, brass, cream): an orange Geneva star on the spindle's top, stepped one slab
       at a time by the crank pin of a drive wheel hung from a back pillar with its motor; a spring detent at the front
       locks the deck; each slab in a navy side frame strutted to the star, a cream cell plate on its foot clamp
  s23  ferris drive (oxide red, cream, black rubber): the rim turned by pairs of tyres pressing on its outside; each
       slab hangs like a gondola in a yoke on brass trunnions, from an upper ring held by tie rods off the hub top
  s24  ratchet and drawers (olive drab, hazard yellow, brass): a hydraulic ram pushes a pawl round a brass saw-tooth
       ring, a sprung holding pawl stops it running back; each slab rides a sled on radial rails (the front one slid out
       to load), its head held by a sprung latch hook; a control pedestal with an e-stop and a beacon"""
import math

from . import detail as D
from .core import G as GV
from .recovery_study4 import quad
from .slab_study import L, Slab, beam, cassette

UP = (0.0, 0.0, 1.0)
N12, SKEW, R0 = 12, math.radians(40), 1.0
FRONT = math.pi / 4                                 # the footprint's front corner (toward the viewer)
BACK = FRONT + math.pi


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


def prism(k, pts, z0, z1, col, top=None):
    """A flat polygon [(u, v)] (counter-clockwise from above) extruded from z0 to z1."""
    quad(k, [(u, v, z1) for u, v in pts], top or col, (0, 0, 1))
    quad(k, [(u, v, z0) for u, v in pts], col, (0, 0, -1))
    for (u0, v0), (u1, v1) in zip(pts, pts[1:] + pts[:1]):
        quad(k, [(u0, v0, z0), (u1, v1, z0), (u1, v1, z1), (u0, v0, z1)], col, (v1 - v0, u0 - u1, 0))


def angles():
    return [math.radians(45 + 360 * i / N12) for i in range(N12)]


def at(r, a, z=0.0):
    return (r * math.cos(a), r * math.sin(a), z)


def slab_at(k, th, z0, r=R0, caps="dark"):
    ts = th - SKEW
    return cassette(k, Slab(at(r, th, z0), UP, (-math.sin(ts), math.cos(ts), 0.0)), body="gm", caps=caps)


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


def bolts(k, r, z, n, s=0.05, col="steelL"):
    for i in range(n):
        k.cyl(*at(r, (i + 0.5) * math.tau / n)[:2], z, s / 2, 0.025, col, top=col, sides=6)


def motor(k, u, v, z, h=0.4, body="gm", fins="steelD"):
    """A finned drive motor standing on its bracket."""
    k.box(u, v, z, 0.36, 0.36, 0.06, "steelD", top="steel")
    k.cyl(u, v, z + 0.06, 0.15, h, body, sides=12)
    for i in range(4):
        k.cyl(u, v, z + 0.14 + i * (h - 0.14) / 4, 0.2, 0.03, fins, sides=12)
    k.cyl(u, v, z + 0.06 + h, 0.08, 0.07, "steelD", top="steel", sides=10)


def spring(k, a, b, r=0.05, n=5, col="brass"):
    """A coil spring from a to b: a rod and n coils."""
    tube(k, a, b, r * 0.35, "steelL")
    for i in range(n):
        t0, t1 = (i + 0.2) / n, (i + 0.6) / n
        p = [tuple(a[j] + (b[j] - a[j]) * t for j in range(3)) for t in (t0, t1)]
        tube(k, p[0], p[1], r, col, sides=8)


def base(k, deck, rim="steelD"):
    """The fixed striped platform; the turning deck (colour `deck`) on a race over it."""
    k.cyl(0, 0, 0.0, 1.48, 0.1, "steelD", top="steel", sides=48)
    hazard(k, 1.42, 0.1)
    k.cyl(0, 0, 0.1, 1.28, 0.06, "steelD", top="steel", sides=48)
    k.cyl(0, 0, 0.16, 1.25, 0.02, "dark", sides=48)
    if deck:
        k.cyl(0, 0, 0.18, 1.25, 0.12, deck, sides=48)


# ---- s22 Geneva indexer ---------------------------------------------------------------------------------------------
def geneva_lobe(a0, a1, ri=0.42, ro=0.8, dip=0.68, slot=0.06):
    """One lobe of the star between slots at a0 and a1: straight slot sides, a concave arc where the drive's locking
    disc rides."""
    d0, d1 = slot / ri, slot / ro
    pts = [at(ri, a0 + d0)[:2], at(ro, a0 + d1)[:2]]
    for t in (0.25, 0.5, 0.75):
        r = ro - (ro - dip) * math.sin(math.pi * (t - 0.25) / 0.5)
        pts.append(at(r, a0 + (a1 - a0) * t)[:2])
    return pts + [at(ro, a1 - d1)[:2], at(ri, a1 - d0)[:2]]


def geneva(k):
    """s22."""
    z0 = 0.42
    zt = z0 + L + 0.1                                                        # the side frames' top bar, the star
    zg = zt - 0.05
    base(k, "navy")
    ring(k, 1.27, 0.18, 0.12, 0.05, "steelD", n=24, skip=lambda i: i % 2)   # the deck's detent notches
    bolts(k, 1.12, 0.3, 24, col="brass")
    k.cyl(0, 0, 0.3, 0.22, zg - 0.3, "navy", sides=12)                      # the spindle
    for z in (0.5, 1.4):
        k.cyl(0, 0, z, 0.25, 0.06, "brass", sides=12)
    out = []
    for th in angles():
        s = slab_at(k, th, z0, caps="navy")
        out.append(s)
        s.box(k, -0.1, 0.1, -0.5, 0.5, -0.32, 0.1, "navy", face="navy")      # the foot clamp
        s.box(k, -0.06, 0.06, -0.14, 0.14, 0.1, 0.115, "medWhite")            # its cell plate
        s.box(k, -0.02, 0.02, -0.08, 0.08, 0.115, 0.12, "dark")
        for w in (-1, 1):                                                    # the side frame
            a, b = sorted((w * 0.46, w * 0.54))
            s.box(k, 0.1, L + 0.15, a, b, -0.3, -0.12, "navy")
            s.box(k, 0.95, 1.05, a - 0.02 * w, b + 0.02 * w, -0.32, -0.1, "hivis")   # a clamp shoe
        s.box(k, L + 0.05, L + 0.15, -0.54, 0.54, -0.3, -0.12, "navy")
        h = s.p(L + 0.1, 0.0, -0.21)
        beam(k, at(0.7, math.atan2(h[1], h[0]), zt), (h[0], h[1], zt), 0.08, 0.08, "navy")   # strut to the star
    k.cyl(0, 0, zg, 0.46, 0.1, "hivis", sides=24)                           # the star: hub and twelve lobes
    slots = angles()
    for a0, a1 in zip(slots, slots[1:] + [slots[0] + math.tau]):
        prism(k, geneva_lobe(a0, a1), zg, zg + 0.1, "hivis")
    k.cyl(0, 0, zg + 0.1, 0.16, 0.06, "brass", sides=12)
    dc = at(0.83, BACK)                                                      # the drive wheel, its crank pin in a slot
    k.cyl(dc[0], dc[1], zg + 0.12, 0.26, 0.06, "steelD", top="steel", sides=20)
    lk = at(0.95, BACK)
    k.cyl(lk[0], lk[1], zg + 0.02, 0.17, 0.1, "brass", sides=16)            # its locking disc
    pin = at(0.62, BACK)
    beam(k, (dc[0], dc[1], zg + 0.21), (pin[0], pin[1], zg + 0.21), 0.09, 0.06, "hivis")
    k.cyl(pin[0], pin[1], zg + 0.02, 0.045, 0.22, "brass", sides=8)
    za = zg + 0.4
    pu, pv, _ = at(1.9, BACK)                                                # the back pillar and its arm
    k.box(pu, pv, 0.0, 0.4, 0.4, 0.06, "steelD", top="steel")
    k.box(pu, pv, 0.06, 0.22, 0.22, za + 0.08 - 0.06, "navy")
    beam(k, (pu, pv, za), (dc[0], dc[1], za), 0.18, 0.16, "navy")
    tube(k, (pu, pv, za - 0.7), at(1.35, BACK, za - 0.08), 0.03, "steelD")
    tube(k, (dc[0], dc[1], zg + 0.18), (dc[0], dc[1], za - 0.08), 0.045, "steelL")   # the drive shaft
    motor(k, dc[0], dc[1], za + 0.08, h=0.26, body="hivis")
    fu, fv, _ = at(1.62, FRONT)                                              # the detent at the front
    k.box(fu, fv, 0.0, 0.3, 0.3, 0.06, "steelD", top="steel")
    k.box(fu, fv, 0.06, 0.14, 0.14, 0.3, "navy", rz=FRONT)
    spring(k, at(1.56, FRONT, 0.26), at(1.32, FRONT, 0.26), r=0.05)
    tube(k, at(1.62, FRONT, 0.36), at(1.74, FRONT, 0.7), 0.025, "hivis")     # its release lever
    k.cyl(*at(1.74, FRONT)[:2], 0.68, 0.05, 0.06, "dark", sides=8)
    return out


# ---- s23 ferris drive -----------------------------------------------------------------------------------------------
def ferris(k):
    """s23."""
    z0 = 0.52
    zu = z0 + L + 0.42                                                       # the upper ring
    base(k, None)
    for i in range(6):                                                       # the turning rim and its spokes
        a = (i + 0.5) * math.pi / 3
        beam(k, at(0.3, a, 0.38), at(1.18, a, 0.38), 0.1, 0.1, "rust", top="rustD")
    ring(k, 1.2, 0.3, 0.14, 0.1, "rust", top="rustD")
    ring(k, 1.27, 0.32, 0.1, 0.035, "black")                                # its tread band
    for a in (FRONT + math.pi / 3, FRONT + math.pi, FRONT - math.pi / 3):   # the tyre drives, pressing on the rim
        k.box(*at(1.56, a)[:2], 0.1, 0.3, 0.6, 0.12, "rustD", top="rust", rz=a)
        for da in (-0.13, 0.13):
            t = at(1.42, a + da)
            k.cyl(t[0], t[1], 0.26, 0.14, 0.14, "black", top="steelD", sides=16)
            k.cyl(t[0], t[1], 0.4, 0.06, 0.03, "steelL", sides=10)
        m = at(1.6, a)
        k.box(m[0], m[1], 0.22, 0.26, 0.42, 0.28, "rust", top="rustD", rz=a)   # its motor and guard
        for dz in (0.28, 0.36, 0.44):
            k.box(*at(1.735, a)[:2], dz, 0.012, 0.34, 0.03, "dark", rz=a)
        k.box(m[0], m[1], 0.5, 0.2, 0.3, 0.03, "hivis", rz=a)
    k.cyl(0, 0, 0.3, 0.3, zu + 0.25 - 0.3, "medWhite", sides=14)            # the hub
    for z in (0.5, 1.5, zu - 0.2):
        k.cyl(0, 0, z, 0.33, 0.08, "rust", top="rustD", sides=14)
    k.cyl(0, 0, zu + 0.25, 0.36, 0.14, "rust", top="rustD", sides=14)       # its bearing housing, a brass cap
    k.cyl(0, 0, zu + 0.39, 0.18, 0.08, "brass", sides=12)
    ring(k, R0, zu - 0.05, 0.1, 0.1, "rust", top="rustD")                   # the upper ring
    out = []
    for th in angles():
        s = slab_at(k, th, z0)
        out.append(s)
        tp = at(R0, th, zu + 0.05)
        tube(k, (0, 0, zu + 0.36), tp, 0.016, "steelL")                     # its tie rod
        for w in (-1, 1):                                                    # the yoke
            a, b = sorted((w * 0.5, w * 0.58))
            s.box(k, 1.15, L + 0.22, a, b, -0.16, -0.06, "rust")
            tube(k, s.p(1.25, w * 0.4, -0.11), s.p(1.25, w * 0.64, -0.11), 0.07, "brass", sides=10)   # trunnion
        s.box(k, L + 0.14, L + 0.22, -0.58, 0.58, -0.16, -0.06, "rust", face="rustD")
        hp = s.p(L + 0.22, 0.0, -0.11)
        tube(k, hp, (hp[0], hp[1], zu - 0.05), 0.03, "steelL")                # the hanger
        k.box(hp[0], hp[1], zu - 0.16, 0.08, 0.08, 0.08, "hivis")
        s.box(k, -0.05, 0.03, -0.14, 0.14, 0.06, 0.08, "medWhite")           # a cell plate
    return out


# ---- s24 ratchet and drawers ----------------------------------------------------------------------------------------
def ratchet(k):
    """s24."""
    z0 = 0.4
    zl = z0 + L + 0.1                                                        # the latch disc
    base(k, "jacket")
    for i in range(36):                                                      # the saw-tooth ring
        a, b = i * math.tau / 36, (i + 1) * math.tau / 36
        prism(k, [at(1.24, a)[:2], at(1.24, b)[:2], at(1.36, b)[:2]], 0.18, 0.3, "brass")
    k.cyl(0, 0, 0.3, 0.22, zl - 0.3, "jacket", sides=12)                    # the mast
    out = []
    for i, th in enumerate(angles()):
        r = R0 + (0.42 if i == 0 else 0.0)                                   # the front one slid out to load
        o = (-math.sin(th), math.cos(th))
        for side in (-0.2, 0.2):                                             # its rails
            a, b = at(0.4, th, 0.33), at(1.42 if i == 0 else 1.22, th, 0.33)
            beam(k, (a[0] + o[0] * side, a[1] + o[1] * side, 0.33), (b[0] + o[0] * side, b[1] + o[1] * side, 0.33),
                 0.05, 0.06, "steelL")
        s = slab_at(k, th, z0, r=r, caps="jacket")
        out.append(s)
        s.box(k, -0.06, 0.08, -0.48, 0.48, -0.34, 0.1, "jacket", face="jacketD")   # the sled
        s.box(k, -0.03, 0.05, -0.12, 0.12, 0.1, 0.115, "hazY")
        h = s.p(L, 0.0, -0.1)
        a = math.atan2(h[1], h[0])
        if i == 0:                                                           # its latch thrown up
            tube(k, at(0.62, a, zl + 0.05), at(0.82, a, zl + 0.5), 0.035, "hazY")
            continue
        beam(k, at(0.62, a, zl + 0.05), (h[0], h[1], zl + 0.05), 0.07, 0.08, "hazY")   # the latch hook
        tube(k, (h[0], h[1], zl + 0.05), (h[0], h[1], z0 + L - 0.02), 0.03, "hazY")
        spring(k, at(0.66, a, zl - 0.25), at(0.78, a, zl + 0.01), r=0.035, n=4)
    k.cyl(0, 0, zl - 0.06, 0.66, 0.12, "jacket", top="jacketD", sides=24)   # the latch disc, braced to the mast
    for j in range(4):
        a = FRONT + j * math.pi / 2
        tube(k, at(0.22, a, zl - 0.8), at(0.6, a, zl - 0.06), 0.025, "steelD")
    k.cyl(0, 0, zl + 0.06, 0.24, 0.14, "jacketD", top="jacket", sides=12)
    bolts(k, 0.5, zl + 0.06, 12, col="brass")
    pk = at(1.36, FRONT - 0.12)                                              # the drive pawl and its ram
    k.box(pk[0], pk[1], 0.18, 0.16, 0.1, 0.14, "hazY", rz=FRONT - 0.12)
    bp = at(1.62, FRONT - 0.45)
    k.box(bp[0], bp[1], 0.0, 0.26, 0.26, 0.06, "steelD", top="steel")
    k.box(bp[0], bp[1], 0.06, 0.1, 0.16, 0.22, "steelD", rz=FRONT - 0.45)
    mid = tuple(bp[j] + (pk[j] - bp[j]) * 0.6 for j in range(2))
    tube(k, (bp[0], bp[1], 0.26), (mid[0], mid[1], 0.26), 0.07, "jacket", sides=10)   # the cylinder
    tube(k, (mid[0], mid[1], 0.26), (pk[0], pk[1], 0.26), 0.03, "steelL")              # its rod
    tube(k, (bp[0], bp[1], 0.3), (bp[0] + 0.25, bp[1] - 0.05, 0.02), 0.025, "black")   # its hose
    hp = at(1.4, FRONT + 0.42)                                               # the holding pawl, sprung
    k.box(hp[0], hp[1], 0.18, 0.16, 0.1, 0.12, "hazY", rz=FRONT + 0.42)
    spring(k, at(1.66, FRONT + 0.42, 0.24), at(1.46, FRONT + 0.42, 0.24), r=0.045, n=4)
    k.box(*at(1.7, FRONT + 0.42)[:2], 0.0, 0.14, 0.14, 0.34, "steelD", top="steel")
    cu, cv, _ = at(1.86, FRONT + 0.06)                                       # the control pedestal
    k.box(cu, cv, 0.0, 0.3, 0.3, 0.05, "steelD", top="steel")
    k.box(cu, cv, 0.05, 0.1, 0.1, 0.72, "steelD", top="steel")
    k.box(cu, cv, 0.77, 0.34, 0.2, 0.26, "jacket", top="jacketD", rz=-FRONT)
    k.cyl(cu - 0.06, cv + 0.06, 1.03, 0.06, 0.05, "medRed", sides=10)        # the e-stop
    k.cyl(cu + 0.07, cv - 0.07, 1.03, 0.035, 0.03, "hivis", sides=8)
    k.cyl(cu, cv, 1.03, 0.02, 0.18, "steel", sides=6)
    k.cyl(cu, cv, 1.2, 0.05, 0.09, "slbAmb", sides=10)                       # the beacon
    return out


DESIGNS = {"s22": (geneva, (3, 3)), "s23": (ferris, (3, 3)), "s24": (ratchet, (3, 3))}
OVERLAYS = {}
