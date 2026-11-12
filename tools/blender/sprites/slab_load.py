"""Stasis slab storage, loading (family `slab`, preview only; issue #116): how a slab gets in and out of the pit wheel
(s49a). Upright in the wheel a slab can neither lift out (its head is 0.06 under the canopy) nor tip flat (it would hit
the floor past the pit's mouth), so it comes and goes by a hatch in the front corner (round 21's option B, chosen; the
tip-out lift at the window was dropped as unconvincing):

  hb0  idle: the hatch closed, flush, its striped rim round it
  hb1  the cart has set the slab face up on the hatch's tipping cradle, head out (the prisoner on show)
  hb2  the cradle tips it up about its foot
  hb3  upright on the hatch, its face to the wheel
  hb4  lowered through the hatch (its head now under the canopy) and turned on the hatch's turntable to the wheel's angle
  hb5  run in under the floor to the wheel's empty socket; the hatch shut

The hatch is a round turntable merged into the pit's mouth by a channel as wide as a slab: the hole is star-shaped from
the wheel's centre, so the holdout floor follows it (PIT: a radius by angle)."""
import math

from . import slab_wheel as W
from .slab_kit import FRONT, at, cassette, frame, rot, tube
from .slab_study import T, Slab

P = W.SCHEMES["s49a"]
ST = FRONT                                          # the loading station: the wheel's slab 0 stands there
LAMP = (FRONT - 0.25, FRONT + 0.25)
HC, HR, CW = 1.68, 0.44, 0.47                       # the hatch: its centre's radius (on the corner's axis), radius,
#                                                     the channel's half width into the pit


def r_hole(a):
    """The pit's mouth with the hatch, by angle from the wheel's centre."""
    d = math.remainder(a - ST, math.tau)
    r = W.RP
    b = HC * math.cos(d)
    disc = HR * HR - (HC * HC - b * b)
    if disc >= 0:
        r = max(r, b + math.sqrt(disc))
    if abs(d) < math.pi / 2:
        t = HC / math.cos(d)
        if abs(t * math.sin(d)) <= CW:
            r = max(r, t)
    return r


N = 256
GAP = max(abs(math.remainder(i * math.tau / N - ST, math.tau)) for i in range(N) if r_hole(i * math.tau / N) > W.RP + 1e-6)


def sectors(k, r0f, r1f, z0, z1, colf):
    """Thin sectors over the hatch's angles, r0f(a) to r1f(a); colf(i) their colours."""
    from .slab_kit import prism
    for i in range(N):
        a0, a1 = i * math.tau / N, (i + 1) * math.tau / N
        if abs(math.remainder((a0 + a1) / 2 - ST, math.tau)) > GAP + 0.03:
            continue
        p0, p1, q0, q1 = r0f(a0), r0f(a1), r1f(a0), r1f(a1)
        if min(q0 - p0, q1 - p1) <= 0.002:
            continue
        prism(k, [at(p0, a0)[:2], at(q0, a0)[:2], at(q1, a1)[:2], at(p1, a1)[:2]], z0, z1, colf(i))


def hatch(k, shut):
    rp = lambda a: W.RP                                                      # noqa: E731
    sectors(k, r_hole, lambda a: r_hole(a) + 0.07, 0.0, 0.012,                  # the striped rim on the floor
            lambda i: "hazY" if (i // 2) % 2 else "hazK")
    if shut:                                                                 # the lid, flush: the turntable's plate
        sectors(k, rp, r_hole, -0.01, 0.01, lambda i: "steel")
        c = at(HC, ST)
        k.cyl(c[0], c[1], 0.01, 0.3, 0.006, "steelD", sides=24)
        k.cyl(c[0], c[1], 0.01, 0.08, 0.012, "steelL", sides=10)
    else:                                                                    # open: the shaft's dark bottom, the
        sectors(k, rp, r_hole, -W.D, -W.D + 0.01, lambda i: "dark")           # turntable down in it
        c = at(HC, ST)
        k.cyl(c[0], c[1], -0.5, HR - 0.04, 0.04, "steelD", top="steel", sides=24)


def module(k, skip, shut):
    out = W.geneva_over_tyres(k, P, lights=LAMP, skip=skip, gap=GAP)
    hatch(k, shut)
    return out


def at_hatch(z, tilt=0.0):
    """The slab on the hatch's cradle, foot at height z, its face to the wheel, tipped `tilt` (rad) head-outward."""
    out = (math.cos(ST), math.sin(ST), 0.0)
    tang = (-math.sin(ST), math.cos(ST), 0.0)
    U, Nn = (0.0, 0.0, 1.0), tuple(-c for c in out)
    if tilt:
        U, Nn = rot(U, tang, tilt), rot(Nn, tang, tilt)
    return Slab(at(HC, ST, z), U, Nn)


def cradle(k, s, ram=True):
    """The tipping cradle behind slab s: a yellow frame on its back, cross bars, the hinge at its foot, a ram."""
    s.box(k, 0.05, 1.05, -0.32, 0.32, -T - 0.08, -T - 0.03, "hazY", face="steelD")
    for l in (0.12, 0.9):
        s.box(k, l - 0.05, l + 0.05, -0.38, 0.38, -T - 0.1, -T - 0.03, "steelD")
    tube(k, s.p(0.0, -0.4, -T - 0.1), s.p(0.0, 0.4, -T - 0.1), 0.06, "steel", sides=10)       # the hinge
    if ram:
        foot = s.p(0.0, 0.0, -T - 0.1)
        a, b = (foot[0], foot[1], -0.45), s.p(0.75, 0.0, -T - 0.1)
        m = tuple(a[i] + (b[i] - a[i]) * 0.55 for i in range(3))
        tube(k, a, m, 0.055, "hazY", sides=10)
        tube(k, m, b, 0.028, "steelL", sides=8)


def cart(k, s):
    """The hover cart's two emitter clamps under slab s's ends (a stand-in for c11)."""
    for l in (0.35, 1.25):
        c = s.p(l, 0.0, -T - 0.12)
        k.box(c[0], c[1], c[2] - 0.2, 0.22, 1.0, 0.2, "dark", top="steelD", rz=ST)
        k.cyl(c[0], c[1], c[2] - 0.25, 0.14, 0.03, "slbCy", sides=12)


def stage(n):
    def build(k):
        out = module(k, skip=() if n in (0, 5) else (0,), shut=n in (0, 5))
        if n == 1:
            s = at_hatch(0.12 + T + 0.05, math.radians(90))
        elif n == 2:
            s = at_hatch(0.12 + (T + 0.05) * 0.6, math.radians(45))
        elif n == 3:
            s = at_hatch(0.12)
        elif n == 4:
            s = cassette(k, frame(ST, W.Z0, r=HC))
        else:
            return out
        if n < 4:
            cassette(k, s)
            cradle(k, s)
        if n == 1:
            cart(k, s)
        return out + [s]
    return build


DESIGNS = {f"hb{i}": (stage(i), (3, 3)) for i in range(6)}
PIT = {v: r_hole for v in DESIGNS}
