"""Shuttle landing gear (issue #509): the transport shuttle's four retractable legs, and the shuttle standing on them on its
landing pad.

Plane-style bays on the hull's real skin (measured with tools/blender/review/shuttle_hull_probe.py): the aft legs fold
fore-and-aft inside the engine shoulders and swing down out of openings in the shoulders' flat undersides (z 0.84-0.9
over v 1.0-1.2); the fore legs fold inside the nose and swing out of openings in the belly near its chines (z 0.36-0.4).
No doors. Each leg: a splayed strut with a sleeve and hazard band, a brace that is also its retraction jack, a round
footpad. Legs and braces cross the skin only inside a bay opening.

  vehicle.shuttle.pad.d{0,2,4,6}.f{0..4}   on the pad, gear f0 stowed .. f4 down and locked (the body lifted by LIFT the
                                           whole way: it settles in the game, not in the sprite); the folded-wing pose
  vehicle.shuttle.pad.d{0,2,4,6}.r{1..4}   gear down, the rear loading ramp opening: r4 open, its lip on the pad's deck
                                           (r0 is f4: ramp shut)

Origin = the craft's centre with the pad's ground plane at z 0 (the pad deck at PAD_Z), like craft_item."""
import math

from . import core, post
from . import detail as D
from .shuttle_craft import transport_shuttle

PAD_Z = 0.24                  # the landing pad's deck
KEEL = 0.5                    # keel underside above the craft's feet plane (its parked legs' height)
LIFT = 0.25                   # how much higher the gear stands the body than the parked legs
FRAMES = 5
RAMP_FRAMES = 4               # r1..r4 (r0 = f4)

# (hip u, hip v, hip z, fold direction along u, bay u0, u1, v0, v1, the skin's z there, foot v)
BAYS = ((-1.6, 1.15, 1.0, 1, -1.72, -0.32, 0.98, 1.32, 0.845, 1.45),
        (1.55, 0.46, 0.55, -1, 0.58, 1.66, 0.3, 0.62, 0.37, 0.95))


def _ease(t):
    return t * t * (3 - 2 * t)


def _norm(a):
    n = math.sqrt(sum(x * x for x in a))
    return tuple(x / n for x in a)


def _slerp(a, b, s):
    return _norm(tuple(a[i] + (b[i] - a[i]) * s for i in range(3)))


def band(f, a, b, r, n=3):
    """Hazard bands along a strut from a to b (n alternating yellow and black)."""
    for k in range(n):
        t0, t1 = 0.35 + 0.08 * k, 0.35 + 0.08 * (k + 1)
        p0 = tuple(a[i] + (b[i] - a[i]) * t0 for i in range(3))
        p1 = tuple(a[i] + (b[i] - a[i]) * t1 for i in range(3))
        D.seg(f, p0, p1, r, "hazY" if k % 2 == 0 else "hazK")


def leg(f, hip, stow, down, L, anchor, s):
    """One leg from `hip`, its direction swung from `stow` to `down` (unit vectors) by s; the brace from `anchor` (inside
    the bay) to 0.6 of the leg is its jack; the round footpad stays level."""
    d = _slerp(stow, down, s)
    end = tuple(hip[i] + d[i] * L for i in range(3))
    D.seg(f, hip, end, 0.07, "steelL")
    D.seg(f, hip, tuple(hip[i] + d[i] * L * 0.45 for i in range(3)), 0.095, "steel")         # the sleeve
    band(f, hip, end, 0.075)
    f.vcyl(hip[0], hip[1], hip[2] - 0.07, 0.085, 0.09, "steelD", sides=8)                    # the hinge
    mid = tuple(hip[i] + d[i] * L * 0.6 for i in range(3))
    D.seg(f, anchor, mid, 0.035, "steel")                                                       # brace / jack
    D.seg(f, anchor, tuple(anchor[i] + (mid[i] - anchor[i]) * 0.5 for i in range(3)), 0.05, "steelD")
    D.seg(f, end, (end[0], end[1], end[2] - 0.06), 0.21, "steelD", cap="steel", capstart="steel")   # footpad


def gear(f, s):
    """All four legs at deploy fraction s (0 stowed .. 1 down), the body LIFT above its parked height."""
    for uh, vh, zh, dirn, u0, u1, v0, v1, zs, fv in BAYS:
        z = zs + LIFT
        for sv in (-1, 1):
            f.box((u0 + u1) / 2, sv * (v0 + v1) / 2, z + 0.002, u1 - u0, v1 - v0, 0.004, "dark", top="dark")   # the bay
            hip = (uh, sv * vh, zh + LIFT)
            foot = (0.0, sv * fv - hip[1], 0.06 - hip[2])
            L = math.sqrt(sum(x * x for x in foot))
            leg(f, hip, (dirn, 0.0, 0.0), _norm(foot), L, (uh + dirn * 0.35, sv * vh, hip[2]), s)


def on_pad(heading, n, ramp=0):
    """The shuttle on its pad at gear frame n (0 stowed .. FRAMES - 1 down), its rear ramp at frame `ramp` (0 shut ..
    RAMP_FRAMES open, reaching down LIFT further to the deck)."""
    from lib.transport_forms import FlightFrame
    objs = transport_shuttle(heading, "docked", dz=PAD_Z + LIFT, ramp_open=_ease(ramp / RAMP_FRAMES), ramp_floor=-LIFT)
    m = core.Mesh(f"shuttle_gear_f{n}_r{ramp}")
    m.dz = PAD_Z
    gear(FlightFrame(m, heading), _ease(n / (FRAMES - 1)))
    return objs + [m.build()]
