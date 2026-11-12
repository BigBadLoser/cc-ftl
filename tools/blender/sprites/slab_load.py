"""Stasis slab storage, loading mock (family `slab`, preview only; issue #116): how a slab gets in and out of the pit
wheel (s49a). The wheel stands in a pit under a canopy, so an upright slab can neither lift straight out (its head is
0.06 under the canopy) nor tip flat where it stands (it would hit the floor past the pit's mouth). Two answers, a few
rough stills each (render with SLAB_NOMASK=1):

  la0-la4  tip-out lift at the window: the station's cradle tips the slab out about 20 deg (its head clears the canopy's
           lip), then lifts as it tips on until the slab lies flat at the cart's height over the pit's rim
  lb0-lb4  hatch in the front corner: the cart sets the slab on a tipping cradle at a floor hatch, the cradle stands it
           up, lowers it through the hatch, and a shuttle under the floor runs it in to the wheel's empty socket"""
import math

from . import slab_wheel as W
from .slab_kit import FRONT, at, cassette, frame, tube
from .slab_study import L, T

P = W.SCHEMES["s49a"]
ST = FRONT                                          # the loading station: the wheel's slab 0 stands there
LAMP = (FRONT - 0.25, FRONT + 0.25)
HB = 1.82                                           # option B's hatch: the slab's foot there, on the corner's axis


def module(k):
    return W.geneva_over_tyres(k, P, lights=LAMP, skip=(0,))


def cradle(k, s, col="hazY", ram_to=None):
    """The station's tipping cradle behind slab s: a frame on its back, the hinge at its foot, a ram to `ram_to`."""
    s.box(k, 0.05, 1.0, -0.3, 0.3, -T - 0.08, -T - 0.03, col, face="steelD")
    for l in (0.1, 0.95):
        s.box(k, l - 0.04, l + 0.04, -0.36, 0.36, -T - 0.1, -T - 0.03, "steelD")
    tube(k, s.p(0.0, -0.38, -T - 0.1), s.p(0.0, 0.38, -T - 0.1), 0.06, "steel", sides=10)   # the hinge
    if ram_to:
        a, b = ram_to, s.p(0.7, 0.0, -T - 0.1)
        m = tuple(a[i] + (b[i] - a[i]) * 0.55 for i in range(3))
        tube(k, a, m, 0.05, col, sides=10)
        tube(k, m, b, 0.025, "steelL", sides=8)


def cart(k, s):
    """The hover cart's two emitter clamps under slab s's ends (a stand-in)."""
    for l in (0.35, L - 0.35):
        c = s.p(l, 0.0, -T - 0.14)
        k.box(*k_uv(c), c[2] - 0.18, 0.5, 0.95, 0.2, "dark", top="steelD", rz=ST + math.pi / 2)
        k.cyl(*k_uv(c), c[2] - 0.24, 0.13, 0.03, "slbCy", sides=12)


def k_uv(p):
    return p[0], p[1]


def tip_out(tilt, lift, r, with_cart=False):
    """A frame of option A: slab 0 tipped `tilt` deg out, its foot lifted `lift` and at radius r."""
    def build(k):
        out = module(k)
        s = cassette(k, frame(ST, W.Z0, r=r, tilt=math.radians(tilt), lift=lift))
        foot = s.p(0.0, 0.0, -T - 0.1)
        k.cyl(foot[0], foot[1], -W.D, 0.09, foot[2] + W.D, "steel", top="steelL", sides=12)   # the lift's column
        k.cyl(foot[0], foot[1], -W.D, 0.16, 0.12, "hazY", sides=12)
        cradle(k, s, ram_to=(foot[0], foot[1], max(-W.D + 0.1, foot[2] - 0.35)))
        if with_cart:
            cart(k, s)
        return out + [s]
    return build


def hatch(k):
    """Option B's floor hatch: the open slot out from the pit's mouth, striped edges, its two leaves folded up."""
    a = ST
    n = (-math.sin(a), math.cos(a))
    mid = at((W.RP + 2.05) / 2, a)
    k.box(mid[0], mid[1], 0.0, 2.05 - W.RP, 0.56, 0.006, "dark", rz=a)
    for e in (-1, 1):
        c = (mid[0] + e * 0.31 * n[0], mid[1] + e * 0.31 * n[1])
        for j in range(5):                                              # striped edges
            q = at(W.RP + 0.06 + j * 0.11, a)
            k.box(q[0] + e * 0.31 * n[0], q[1] + e * 0.31 * n[1], 0.0, 0.1, 0.06, 0.012,
                  "hazY" if j % 2 else "hazK", rz=a)
        k.box(c[0] + e * 0.05 * n[0], c[1] + e * 0.05 * n[1], 0.0, 0.5, 0.03, 0.26, "steelD", top="steel", rz=a)


def hatch_in(stage):
    """A frame of option B (stage 0-4)."""
    def build(k):
        out = module(k)
        hatch(k)
        th = ST
        if stage == 0:                                          # on the cradle at the hatch, flat, the cart over it
            s = cassette(k, frame(th, 0.12, r=HB, tilt=math.radians(90)))
        elif stage == 1:                                        # tipping up
            s = cassette(k, frame(th, 0.12, r=HB, tilt=math.radians(45)))
        elif stage == 2:                                        # upright on the hatch
            s = cassette(k, frame(th, 0.12, r=HB))
        elif stage == 3:                                        # lowered through it (its head now under the canopy)
            s = cassette(k, frame(th, W.Z0, r=HB))
        else:                                                   # run in on the shuttle to the wheel's socket
            s = cassette(k, frame(th, W.Z0, r=1.05))
        if stage < 3:
            foot = s.p(0.0, 0.0, -T - 0.1)
            cradle(k, s, ram_to=(foot[0], foot[1], 0.02) if stage else None)
        if stage == 0:
            cart(k, s)
        return out + [s]
    return build


A = [(0, 0.0, 1.05), (20, 0.0, 1.05), (45, 0.36, 1.08), (70, 0.72, 1.12), (90, 0.96, 1.15)]
DESIGNS = {**{f"la{i}": (tip_out(*f, with_cart=i == 4), (3, 3)) for i, f in enumerate(A)},
           **{f"lb{i}": (hatch_in(i), (3, 3)) for i in range(5)}}
PIT = {v: W.RP for v in DESIGNS}
