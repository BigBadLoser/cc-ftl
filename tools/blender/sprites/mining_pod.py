"""The MINING POD (vehicle.mining_pod): a one-seat ball of a miner that sits in a 3x3 bay.

Local frame as shuttle_craft (u = nose, v across, z up, origin at the footprint centre on the pad; `Spin(heading)`).
Shape: a ribbed sphere (swept from a slightly squared round section) banded with armour plates, a big round viewport on
the nose with the cockpit lit warm behind it, a hatch panel on each flank, a yellow ore hopper on its back with the main
nozzles in its back face, a mining laser on a chin mount under the viewport, four manoeuvring thrusters round its equator and
four stubby legs. Warm dark steel hull (c4F), industrial yellow accents (c4T).

States: parked / docked (legs down, hopper shut, laser stowed, nozzles dark), fly (legs up, nozzles lit), mine (legs up,
laser lowered, emitter lit; `bob` lifts it for the hover loop), and full (parked, hopper lids open on a heap of ore)."""
import math

from . import core
from .shuttle_bay import lbox
from .shuttle_craft import Spin, _g, patch, profile, smooth, sweep

C = 1.12                      # the sphere's centre height above the pad (legs down)
R = 0.86                      # its radius
BALL = [(-0.74, 0.42), (-0.64, 0.66), (-0.44, 0.82), (-0.15, R), (0.2, R), (0.46, 0.8), (0.62, 0.66), (0.68, 0.6)]
SECTION = profile(n=20, p=2.3)          # round, a little squared: the ribbed look of a pressure hull
WIN_R = 0.5                   # viewport glass radius
HOLD = (-1.18, -0.6, 0.48, 0.5, 1.22)   # ore hopper: u0, u1, half width, z0, z1
NOZ_Z = 0.82                  # main nozzles, on the hopper's back face
RCS = ((0.32, R + 0.02), (-0.4, R + 0.02))
LASER_U, LASER_Z = 0.5, 0.42
HULL, HULL_D, HULL_L = "c4F2", "c4F4", "c4F1"
YEL, YEL_D = "c4T2", "c4T4"
GLOW = "cyan"
BEAM = "orange"


def _r(u):
    """The ball's radius at u."""
    for (a, ra), (b, rb) in zip(BALL, BALL[1:]):
        if a <= u <= b:
            return ra + (rb - ra) * (u - a) / (b - a)
    return BALL[-1][1]


def body(f):
    _g("hull")
    B = [(u, r, r, 0, C) for u, r in BALL]
    sweep(f, B, SECTION, HULL, cap0=HULL_D)
    patch(f, B, -0.55, 0.42, 200, 340, 1.01, HULL_D, n=9, steps=5)            # the shaded underside plates
    patch(f, B, -0.3, 0.25, 235, 305, 1.02, "grime", n=5, steps=2)
    _g("plates")
    patch(f, B, -0.5, 0.36, 55, 125, 1.035, HULL_L, n=7, steps=4)             # the dorsal armour plate
    patch(f, B, -0.12, 0.08, 45, 135, 1.06, YEL, n=9, steps=2)                # its yellow band
    patch(f, B, -0.42, -0.32, 50, 130, 1.06, YEL_D, n=7, steps=1)
    for t0, t1 in ((-25, 25), (155, 205)):                                   # flank plates
        patch(f, B, -0.45, 0.4, t0, t1, 1.03, HULL_L, n=5, steps=4)
    for u in (-0.5, 0.44):                                                   # the ribs
        k = _r(u) * 1.055
        sweep(f, [(u - 0.035, k, k, 0, C), (u + 0.035, k, k, 0, C)], SECTION, "steelD")
    _g("hatch")
    for sv in (-1, 1):                                                       # a hatch on each flank
        f.box(-0.05, sv * (R + 0.04), C - 0.05, 0.52, 0.06, 0.46, HULL_D, base=False)
        f.box(-0.05, sv * (R + 0.07), C - 0.05, 0.4, 0.02, 0.34, "glassD", base=False)
        f.box(-0.05, sv * (R + 0.08), C + 0.08, 0.36, 0.012, 0.04, "lens", base=False)
        f.box(0.24, sv * (R + 0.06), C - 0.05, 0.05, 0.03, 0.14, YEL, base=False)   # the handle


def viewport(f):
    """The round window on the nose: a heavy frame ring, dark glass, the cockpit glowing warm behind it."""
    _g("window")
    u = BALL[-1][0]
    f.hcyl(u - 0.04, u + 0.06, 0, C, WIN_R + 0.12, "steelD", sides=24, cap="steelD")
    f.hcyl(u + 0.06, u + 0.075, 0, C, WIN_R, "drK", sides=24, cap="drD")     # the lit cockpit, through the glass
    for k in range(8):                                                       # lamps round the inside of the rim
        a = k * math.tau / 8 + math.pi / 8
        f.box(u + 0.08, (WIN_R - 0.07) * math.cos(a), C + (WIN_R - 0.07) * math.sin(a), 0.01, 0.05, 0.05,
              "orange" if k % 2 else "flameY", base=False)
    f.box(u + 0.078, 0, C - 0.12, 0.01, 0.34, 0.2, "drK", base=False)        # the seat back, in silhouette
    f.box(u + 0.079, 0, C + 0.12, 0.01, 0.62, 0.02, "drK", base=False)       # the glass's crossbar
    f.box(u + 0.082, 0, C + 0.3, 0.01, 0.5, 0.04, "lens", base=False)        # a reflection on the glass


def hold(f, full):
    _g("hold")
    u0, u1, hw, z0, z1 = HOLD
    um, lu = (u0 + u1) / 2, u1 - u0
    f.box(um, 0, z0, lu, 2 * hw, z1 - z0, YEL, top=YEL_D)
    for sv in (-1, 1):                                                       # ribbed sides
        for k in range(3):
            f.box(u0 + 0.1 + k * (lu - 0.2) / 2, sv * (hw + 0.012), z0 + 0.04, 0.05, 0.024, z1 - z0 - 0.08, YEL_D)
    f.box(u0 - 0.01, 0, z1 - 0.16, 0.02, 2 * hw - 0.1, 0.08, "hazK")
    _g("nozzle")
    for sv in (-1, 1):                                                       # main nozzles under the hopper
        f.hcyl(u0 + 0.02, u0 - 0.12, sv * 0.22, NOZ_Z, 0.11, "steelD", r1=0.15, sides=12, cap="dark")
    if not full:
        for sv in (-1, 1):                                                   # two lids
            f.box(um, sv * hw / 2, z1, lu - 0.06, hw - 0.04, 0.04, YEL, top=YEL)
        f.box(um, 0, z1, lu - 0.1, 0.05, 0.05, "hazK")
        return
    f.box(um, 0, z1 - 0.04, lu - 0.06, 2 * hw - 0.06, 0.04, "dark")
    lid, ang = hw - 0.03, math.radians(115)                                  # lids swung up and out on their hinges
    for sv in (-1, 1):
        def corner(a, b, d, sv=sv):
            r = 0.0 if b < 0 else lid
            th = 0.0 if d < 0 else 0.04
            return (um + a * (lu - 0.06) / 2, sv * (hw - r * math.cos(ang) + th * math.sin(ang)),
                    z1 + r * math.sin(ang) + th * math.cos(ang))
        lbox(f, corner, {"side": YEL_D, "top": YEL})
    for u, v, r, col in ((um - 0.12, -0.2, 0.13, "orM"), (um + 0.1, 0.18, 0.14, "or"), (um, 0.0, 0.17, "orL"),
                         (um - 0.14, 0.24, 0.11, "rk"), (um + 0.14, -0.22, 0.11, "rkM")):
        f.vcyl(u, v, z1 - 0.06, r, 0.08 + 0.7 * r, col, top=col, rtop=r * 0.4, sides=6)


def thrusters(f, lit):
    _g("rcs")
    for u, av in RCS:
        for sv in (-1, 1):
            f.box(u, sv * av, C - 0.36, 0.22, 0.16, 0.24, HULL_D, top=HULL)
            for du in (-1, 1):
                f.hcyl(u + du * 0.11, u + du * 0.17, sv * av, C - 0.24, 0.05, "steelD", r1=0.065, sides=8,
                       cap=GLOW if lit else "dark")
    if lit:
        for sv in (-1, 1):
            f.hcyl(HOLD[0] - 0.1, HOLD[0] - 0.11, sv * 0.22, NOZ_Z, 0.1, GLOW, sides=12, cap="arc")


def laser(f, down, lit):
    """The mining laser on a chin mount under the viewport: level when stowed, tipped forward and down when mining."""
    _g("laser")
    f.box(LASER_U - 0.06, 0, LASER_Z - 0.08, 0.3, 0.3, 0.14, HULL_D, top=HULL)
    f.hcyl(LASER_U - 0.05, LASER_U + 0.05, 0, LASER_Z, 0.11, YEL_D, sides=10, cap=YEL_D, capstart=YEL_D)
    kw = dict(pitch=math.radians(-55 if down else -6), pu=LASER_U, pz=LASER_Z)
    f.hcyl(LASER_U, LASER_U + 0.38, 0, LASER_Z, 0.075, "steel", r1=0.06, sides=10, **kw)
    for a in range(3):
        t = a * math.tau / 3 + math.pi / 2
        f.box(LASER_U + 0.27, 0.065 * math.cos(t), LASER_Z + 0.065 * math.sin(t), 0.14, 0.035, 0.035, YEL_D, base=False, **kw)
    f.hcyl(LASER_U + 0.38, LASER_U + 0.43, 0, LASER_Z, 0.06, "steelD", r1=0.08, sides=10, cap=BEAM if lit else "dark", **kw)


def legs(f):
    _g("legs")
    for su in (-0.42, 0.3):
        for sv in (-0.5, 0.5):
            f.vcyl(su, sv, 0.0, 0.1, 0.04, "steelD", top="steel", sides=8)
            f.vcyl(su, sv, 0.04, 0.035, 0.36, "steelL", sides=6)


def greeble(f):
    _g("greeble")
    f.vcyl(-0.3, -0.3, C + 0.78, 0.025, 0.24, "steelL", sides=6)           # antenna
    f.box(-0.3, -0.3, C + 1.02, 0.05, 0.05, 0.04, "red")
    for sv in (-1, 1):
        f.box(0.2, sv * 0.36, C + 0.74, 0.12, 0.08, 0.05, "steelD", top="arc")   # a work lamp each side of the plate


def pod(heading, state="parked", bob=0.0, dz=0.0):
    """state: parked / docked, fly, mine or full (parked with the hopper open on its ore)."""
    m = core.Mesh(f"mining_pod_{state}")
    m.dz = dz + (0.0 if state in ("parked", "docked", "full") else 0.35 + bob)
    f = Spin(m, heading)
    body(f)
    viewport(f)
    hold(f, state == "full")
    thrusters(f, state in ("fly", "mine"))
    laser(f, state == "mine", state == "mine")
    if state in ("parked", "docked", "full"):
        legs(f)
    greeble(f)
    return [smooth(m.build())]
