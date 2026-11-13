"""Stasis slab storage, loading (family `slab`, preview only; issue #116): how a slab gets in and out of the pit wheel
(s49a). Upright in the wheel a slab can neither lift out (its head is 0.06 under the canopy) nor tip flat (it would hit
the floor past the pit's mouth), so it comes and goes by a hatch in the front corner (round 21's option B, chosen; the
tip-out lift at the window was dropped as unconvincing):

  idle: the yellow tipping cradle stands upright on the hatch's platform, flush with the floor (a loading stand)
  in:   the cradle folds flat to the right, across the screen; the cart slides in from the right, lowers the slab onto
        it face up (the prisoner on show) and pulls away; the cradle tips the slab up; the platform sinks until its
        head is under the canopy; a shuttle takes it by its foot and runs it in while the platform sinks on with the
        cradle (it sits on the slab's back, and any turn swings the back into it), then turns it 40 deg to the wheel's
        angle as it goes; the platform rises with the cradle (a gate swing was tried: it swung out of the slot)
  out:  the same, backwards
Frames hc00-hc28 (KEYS). Round 24: tipping across the screen (toward the camera read oddly); the turn moved into the
slide (it was a 130 deg turntable turn and the cradle dropping down the shaft). The tip goes right, not left: left, the
slab would need a 140 deg turn and hits its neighbours; right, 40 deg clears them by 0.035.

The hatch is a round turntable merged into the pit's mouth by a channel as wide as a slab: the hole is star-shaped from
the wheel's centre, so the holdout floor follows it (PIT: a radius by angle)."""
import math

from . import slab_bay as B
from . import slab_wheel as W
from .slab_kit import FRONT, at, cassette, rot, tube
from .slab_study import Slab, T

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


def sectors(k, r0f, r1f, z0, z1, colf, side=0, shift=(0.0, 0.0)):
    """Thin sectors over the hatch's angles, r0f(a) to r1f(a); colf(i) their colours."""
    from .slab_kit import prism
    for i in range(N):
        a0, a1 = i * math.tau / N, (i + 1) * math.tau / N
        d = math.remainder((a0 + a1) / 2 - ST, math.tau)
        if abs(d) > GAP + 0.03 or (side and (d > 0) != (side > 0)):
            continue
        p0, p1, q0, q1 = r0f(a0), r0f(a1), r1f(a0), r1f(a1)
        if min(q0 - p0, q1 - p1) <= 0.002:
            continue
        pts = [at(p0, a0)[:2], at(q0, a0)[:2], at(q1, a1)[:2], at(p1, a1)[:2]]
        prism(k, [(u + shift[0], v + shift[1]) for u, v in pts], z0, z1, colf(i))


def hatch(k, pz, leaves=0.0):
    """The hatch: its striped rim on the floor, the platform at height pz (0: flush), and its two leaves (1: shut over
    it, flush; 0: slid apart under the floor, out of sight)."""
    if leaves:
        for side in (-1, 1):                        # each leaf: its half of the opening, slid out sideways
            off = (1 - leaves) * 0.6 * side
            z0, z1 = (-0.012, 0.004) if leaves >= 1 else (-0.03, -0.016)   # shut flush; else dropped under the floor
            sectors(k, lambda a: W.RP, r_hole, z0, z1, lambda i: "steel", side=side,
                    shift=(ET[0] * off, ET[1] * off))
        r0, r1 = W.RP + 0.06, HC + HR - 0.02        # the seam between them: over the leaves only, not the pit mouth
        c = at((r0 + r1) / 2, ST)
        if leaves >= 1:
            k.box(c[0], c[1], 0.004, r1 - r0, 0.045, 0.004, "steelD", rz=ST)
    sectors(k, r_hole, lambda a: r_hole(a) + 0.07, 0.0, 0.012,               # the striped rim on the floor
            lambda i: "hazY" if (i // 2) % 2 else "hazK")
    if leaves >= 1:
        return
    if pz < -0.01:                                                           # the shaft's dark bottom
        sectors(k, lambda a: W.RP, r_hole, -1.75, -1.74, lambda i: "dark")
    sectors(k, lambda a: W.RP, r_hole, pz - 0.03, pz, lambda i: "steel")    # the platform
    c = at(HC, ST)
    k.cyl(c[0], c[1], pz, 0.36, 0.008, "steelD", sides=28)
    k.cyl(c[0], c[1], pz, 0.07, 0.02, "hazY", sides=10)


UP = (0.0, 0.0, 1.0)
EF = (math.cos(ST), math.sin(ST), 0.0)              # out along the corner's axis (toward the viewer)
ET = (-math.sin(ST), math.cos(ST), 0.0)             # across it, to the left on screen


def pose(z, tilt=0.0):
    """A slab frame on the hatch: foot at height z, its face to the left (ET), tipped `tilt` (rad) head to the right
    across the screen (about the corner's axis), so lying flat it is face up."""
    U, Nn = UP, ET
    if tilt:
        U, Nn = rot(U, EF, tilt), rot(Nn, EF, tilt)
    return Slab(at(HC, ST, z), U, Nn)


def swung(s, ang):
    """Frame s swung `ang` (rad) about a vertical hinge at its outer end, behind its back (the cradle opening)."""
    if not ang:
        return s
    h = s.p(0.0, -0.42, -T - 0.075)
    o = tuple(s.O[i] - h[i] for i in range(3))
    o = rot(o, UP, ang)
    return Slab(tuple(h[i] + o[i] for i in range(3)), rot(s.U, UP, ang), rot(s.N, UP, ang))


def cradle(k, s, pz):
    """The tipping cradle on the platform (at pz) behind frame s: a yellow frame, cross bars, the hinge at its foot,
    a ram from the platform, the gate post it swings open on."""
    s.box(k, 0.05, 1.05, -0.32, 0.32, -T - 0.08, -T - 0.03, "hazY", face="steelD")
    for l in (0.12, 0.9):
        s.box(k, l - 0.05, l + 0.05, -0.38, 0.38, -T - 0.1, -T - 0.03, "steelD")
    tube(k, s.p(0.0, -0.4, -T - 0.1), s.p(0.0, 0.4, -T - 0.1), 0.06, "steel", sides=10)       # the hinge
    foot = s.p(0.0, 0.0, -T - 0.1)
    for e in (-0.42, 0.42):                                                  # its hinge's brackets on the platform
        b = s.p(0.0, e, -T - 0.1)
        k.box(b[0], b[1], pz, 0.1, 0.1, max(0.02, b[2] - pz), "steelD")
    a, b = (foot[0], foot[1], pz), s.p(0.75, 0.0, -T - 0.1)
    if math.dist(a, b) > 0.3:
        m = tuple(a[i] + (b[i] - a[i]) * 0.55 for i in range(3))
        tube(k, a, m, 0.055, "hazY", sides=10)
        tube(k, m, b, 0.042, "steelL", sides=8)       # (rods >= 2 px)


def cart(k, s):
    """The hover cart under slab s: two emitter clamps at its ends, the push bar at its head (a stand-in for c11)."""
    for l in (0.35, 1.25):
        c = s.p(l, 0.0, -T - 0.12)
        k.box(c[0], c[1], c[2] - 0.2, 0.22, 1.0, 0.2, "dark", top="steelD", rz=ST + math.pi / 2)
        k.cyl(c[0], c[1], c[2] - 0.25, 0.14, 0.03, "slbCy", sides=12)
    a, b = s.p(1.75, -0.4, -T), s.p(1.75, 0.4, -T)
    for e in (a, b):
        tube(k, e, (e[0], e[1], e[2] + 0.55), 0.045, "steel", sides=8)
    tube(k, (a[0], a[1], a[2] + 0.55), (b[0], b[1], b[2] + 0.55), 0.045, "steelL", sides=8)


BED = 0.12 + T + 0.05                               # a flat slab's face height on the cradle
CART = 0.75                                         # and on the cart
SINK = -0.46                                        # the platform down: the slab's foot at the wheel's (Z0)
DEEP = -1.6                                         # and on down, the cradle's top below the slab's foot
# frames: (cradle tilt deg, platform z, cradle swing deg, slab: None | "home" | ("cart"/"left", out, z) | ("cradle",)
#          | ("slide", t, f): on the shuttle, t of the way in, turned f of the 40 deg to the wheel's angle)
# The run-in: the shuttle takes the slab by its foot and runs it straight in while the platform sinks on with the
# cradle (it sits on the slab's back: the slab can't turn until it is clear), then turns it as it goes.
KEYS = [(0, 0, 0, None), (30, 0, 0, None), (60, 0, 0, None), (90, 0, 0, None),
        (90, 0, 0, ("cart", 1.0, CART)), (90, 0, 0, ("cart", 0.0, CART)),
        (90, 0, 0, ("cart", 0.0, (CART + BED) / 2)), (90, 0, 0, ("cart", 0.0, BED)),
        (90, 0, 0, ("left", 0.6, BED)), (90, 0, 0, ("cradle",)),
        (72, 0, 0, ("cradle",)), (54, 0, 0, ("cradle",)), (36, 0, 0, ("cradle",)), (18, 0, 0, ("cradle",)),
        (0, 0, 0, ("cradle",)), (0, -0.15, 0, ("cradle",)), (0, -0.3, 0, ("cradle",)), (0, SINK, 0, ("cradle",))] + \
    [(0, SINK + (DEEP - SINK) * min(1.0, (j / 8) / 0.4), 0, ("slide", j / 8, max(0.0, (j / 8 - 0.4) / 0.6)))
     for j in range(1, 9)] + \
    []
# round 26: the cradle stows down the shaft under two sliding leaves when not in use (it stood in the corner as a
# loading stand). The loop: hd0-hd4 (shut; the leaves part; the cradle rises), hc00-hc25, he0-he1 (the leaves shut).
KEYS_D = [(0, DEEP, 0, None, 1.0), (0, DEEP, 0, None, 0.5), (0, DEEP, 0, None, 0.0), (0, -1.1, 0, None, 0.0),
          (0, -0.55, 0, None, 0.0)]
KEYS_E = [(0, DEEP, 0, "home", 0.5), (0, DEEP, 0, "home", 1.0)]


def frame_n(n, key=None):
    tilt, pz, swing, sl, leaves = (key or KEYS[n]) + ((0.0,) if len(key or KEYS[n]) == 4 else ())
    tilt, swing = math.radians(tilt), math.radians(swing)

    def build(k):
        home = sl in (None, "home")                 # None: the station's socket empty (a slab to come); "home": in
        out = W.geneva_over_tyres(k, P, lights=LAMP, empty=() if sl == "home" else (0,), gap=GAP)
        B.fittings(k, () if sl == "home" else (0,))
        hatch(k, pz, leaves)
        bed = pose(pz + 0.12 + (BED - 0.12) * math.sin(tilt), tilt)       # the cradle's frame (a slab on it)
        cradle(k, swung(bed, swing), pz)
        if home:
            return out
        if sl[0] in ("cart", "left"):
            s = pose(sl[2], math.radians(90))
            s = Slab(tuple(s.O[i] - ET[i] * sl[1] for i in range(3)), s.U, s.N)
            cart(k, s)
            if sl[0] == "left":                     # the cart pulls away; the slab stays on the cradle
                s = bed
        elif sl[0] == "cradle":
            s = bed
        else:                                       # on the shuttle, held by its foot: in and turning as it goes
            t, f = sl[1], sl[2]
            o = at(HC + (W.R0 - HC) * t, ST, W.Z0)
            s = Slab(o, UP, rot(ET, UP, math.radians(-40) * f))
            s.box(k, -0.12, 0.0, -0.42, 0.42, -T - 0.06, 0.06, "steelD", face="hazY")
        cassette(k, s)
        return out + [s]
    return build


DESIGNS = {f"hc{i:02d}": (frame_n(i), (3, 3)) for i in range(len(KEYS))}
DESIGNS.update({f"hd{j}": (frame_n(0, kk), (3, 3)) for j, kk in enumerate(KEYS_D)})
DESIGNS.update({f"he{j}": (frame_n(0, kk), (3, 3)) for j, kk in enumerate(KEYS_E)})
PIT = {v: r_hole for v in DESIGNS}
