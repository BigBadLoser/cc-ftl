"""Stasis slab storage, loading (family `slab`, preview only; issue #116): how a slab gets in and out of the pit wheel
(s49a). Upright in the wheel a slab can neither lift out (its head is 0.06 under the canopy) nor tip flat (it would hit
the floor past the pit's mouth), so it comes and goes by a hatch in the front corner (round 21's option B, chosen; the
tip-out lift at the window was dropped as unconvincing):

  idle: the yellow tipping cradle stands upright on the hatch's platform, flush with the floor (a loading stand)
  in:   the cradle folds flat; the cart slides in, lowers the slab onto it face up (the prisoner on show) and pulls away;
        the cradle tips the slab up; the platform sinks until its head is under the canopy, turns it 130 deg to the
        wheel's angle, and the slab runs in under the floor to the wheel's empty socket
  back: the platform rises, turning back; the empty cradle stands upright again
  out:  the same, backwards
Frames hb00-hb23 (KEYS); review/slab_preview.py makes the sheet, the GIF is cut from it.

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


def hatch(k, pz, turn):
    """The hatch: its striped rim on the floor, the platform (a turntable, `turn` rad) at height pz (0: flush)."""
    sectors(k, r_hole, lambda a: r_hole(a) + 0.07, 0.0, 0.012,               # the striped rim on the floor
            lambda i: "hazY" if (i // 2) % 2 else "hazK")
    if pz < -0.01:                                                           # the shaft's dark bottom
        sectors(k, lambda a: W.RP, r_hole, -W.D - 0.05, -W.D - 0.04, lambda i: "dark")
    sectors(k, lambda a: W.RP, r_hole, pz - 0.03, pz, lambda i: "steel")    # the platform
    c = at(HC, ST)
    k.cyl(c[0], c[1], pz, 0.36, 0.008, "steelD", sides=28)                 # its turntable, a bar across to show it turn
    k.box(c[0], c[1], pz, 0.66, 0.08, 0.014, "steelL", rz=ST + turn)
    k.cyl(c[0], c[1], pz, 0.07, 0.02, "hazY", sides=10)


def pose(z, tilt=0.0, turn=0.0, r=HC):
    """A slab frame on the hatch: foot at radius r, height z; face to the wheel, tipped `tilt` (rad) head-outward,
    then turned `turn` (rad) about the vertical (-130 deg brings it to the wheel's own angle)."""
    out = (math.cos(ST), math.sin(ST), 0.0)
    tang = (-math.sin(ST), math.cos(ST), 0.0)
    up = (0.0, 0.0, 1.0)
    U, Nn = up, tuple(-c for c in out)
    if tilt:
        U, Nn = rot(U, tang, tilt), rot(Nn, tang, tilt)
    if turn:
        U, Nn = rot(U, up, turn), rot(Nn, up, turn)
    return Slab(at(r, ST, z), U, Nn)


def cradle(k, s, pz):
    """The tipping cradle on the platform (at pz) behind frame s: a yellow frame, cross bars, the hinge at its foot,
    a ram from the platform."""
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
        tube(k, m, b, 0.028, "steelL", sides=8)


def cart(k, s):
    """The hover cart under slab s: two emitter clamps at its ends, the push bar at its head (a stand-in for c11)."""
    for l in (0.35, 1.25):
        c = s.p(l, 0.0, -T - 0.12)
        k.box(c[0], c[1], c[2] - 0.2, 0.22, 1.0, 0.2, "dark", top="steelD", rz=ST)
        k.cyl(c[0], c[1], c[2] - 0.25, 0.14, 0.03, "slbCy", sides=12)
    for e in (-0.38, 0.38):
        a, b = s.p(1.75, e, -T), s.p(1.75, e, -T + 0.55)
        tube(k, a, (b[0], b[1], a[2] + 0.55), 0.025, "steel", sides=6)
    a, b = s.p(1.75, -0.4, -T), s.p(1.75, 0.4, -T)
    tube(k, (a[0], a[1], a[2] + 0.55), (b[0], b[1], b[2] + 0.55), 0.03, "steelL", sides=6)


BED = 0.12 + T + 0.05                               # a flat slab's face height on the cradle
CART = 0.75                                         # and on the cart
D90, RAD = math.radians(90), math.radians
# frames: (cradle tilt deg, platform z, turn deg, slab: None | ("cart", out, z) | ("cradle",) | ("in", r))
KEYS = [(0, 0, 0, None), (45, 0, 0, None), (90, 0, 0, None),
        (90, 0, 0, ("cart", 0.9, CART)), (90, 0, 0, ("cart", 0.0, CART)), (90, 0, 0, ("cart", 0.0, (CART + BED) / 2)),
        (90, 0, 0, ("cart", 0.0, BED)), (90, 0, 0, ("left", 0.6, BED)), (90, 0, 0, ("cradle",)),
        (67, 0, 0, ("cradle",)), (45, 0, 0, ("cradle",)), (22, 0, 0, ("cradle",)), (0, 0, 0, ("cradle",)),
        (0, -0.15, 0, ("cradle",)), (0, -0.3, 0, ("cradle",)), (0, -0.46, 0, ("cradle",)),
        (0, -0.46, -43, ("cradle",)), (0, -0.46, -87, ("cradle",)), (0, -0.46, -130, ("cradle",)),
        (0, -0.46, -130, ("in", 1.47)), (0, -0.46, -130, ("in", 1.26)), (0, -0.46, -130, ("in", 1.05)),
        (0, -0.3, -87, "home"), (0, -0.15, -43, "home")]


def frame_n(n):
    tilt, pz, turn, sl = KEYS[n]
    tilt, turn = RAD(tilt), RAD(turn)

    def build(k):
        home = sl in (None, "home")
        out = W.geneva_over_tyres(k, P, lights=LAMP, skip=() if home else (0,), gap=GAP)
        hatch(k, pz, turn)
        bed = pose(pz + 0.12 + (BED - 0.12) * math.sin(tilt), tilt, turn)    # the cradle's frame (a slab on it)
        cradle(k, bed, pz)
        if home:
            return out
        if sl[0] in ("cart", "left"):
            o = (math.cos(ST), math.sin(ST), 0.0)
            s = pose(sl[2], D90)
            s = Slab(tuple(s.O[i] + o[i] * sl[1] for i in range(3)), s.U, s.N)
            cart(k, s)
            if sl[0] == "left":                     # the cart pulls away; the slab stays on the cradle
                s = bed
        elif sl[0] == "cradle":
            s = bed
        else:
            s = frame(ST, W.Z0, r=sl[1])
        cassette(k, s)
        return out + [s]
    return build


DESIGNS = {f"hb{i:02d}": (frame_n(i), (3, 3)) for i in range(len(KEYS))}
PIT = {v: r_hole for v in DESIGNS}
