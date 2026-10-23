"""The MINING POD (vehicle.mining_pod): a stubby single-seat miner, about 2.6 tiles across, that nearly fills its 3x3 bay.

Local frame as shuttle_craft (u = nose, v across, z up, origin at the footprint centre on the pad; `Spin(heading)`).
Shape: a chunky hull swept from a rounded rectangle, a glass cockpit bubble on the nose, a boxy ore hold behind it with
two hopper lids, a mining laser on a chin mount under the canopy, four manoeuvring thruster pods on the corners and a pair of
main nozzles at the stern, four short skid legs. Industrial yellow (c4T) over dark steel, grime on the lower hull.

States: parked / docked (legs down, lids shut, laser stowed, nozzles dark), fly (legs up, nozzles lit), mine (legs up,
laser lowered, emitter lit; `bob` lifts it for the hover loop), and full (the hold's lids open on a heap of ore)."""
import math

from . import core
from .shuttle_bay import lbox
from .shuttle_craft import Spin, _g, patch, profile, smooth, sweep

LEN = 2.5                     # nose to nozzle lips
BELLY = 0.36                  # skirt bottom above the pad on the legs
HULL = [(-1.05, 0.66, 0.36, 0, 0.78), (-0.9, 0.8, 0.44, 0, 0.8), (0.3, 0.8, 0.44, 0, 0.8), (0.7, 0.68, 0.38, 0, 0.78),
        (0.92, 0.42, 0.26, 0, 0.74)]
CANOPY = [(0.18, 0.46, 0.34, 0, 1.12), (0.55, 0.48, 0.36, 0, 1.1), (0.88, 0.4, 0.3, 0, 1.04), (1.12, 0.22, 0.17, 0, 0.98)]
HOLD = (-1.0, -0.12, 0.58, 1.12, 1.52)   # ore hold: u0, u1, half width, z0, z1
RCS = ((0.62, 0.86), (-0.78, 0.86))      # thruster pods: (u, |v|)
NOZ_V, NOZ_Z, NOZ_R = 0.36, 0.78, 0.17   # main nozzles
LASER_U = 0.78                           # chin laser mount, under the canopy
YEL, YEL_D, YEL_S = "c4T2", "c4T4", "c4T1"   # body, lower band / edges, lit trim
STEEL, STEEL_D = "c4F2", "c4F4"
GLOW = "cyan"                            # thrusters (as every drive)
BEAM = "orange"                          # the laser emitter


def hull(f):
    _g("hull")
    sweep(f, HULL, profile(), YEL, cap0=STEEL_D, cap1=YEL)
    patch(f, HULL, -0.95, 0.75, 200, 340, 1.01, YEL_D, n=9, steps=4)          # dark lower band
    patch(f, HULL, -0.6, 0.2, 235, 305, 1.02, "grime", n=5, steps=2)          # belly grime
    for sv in (-1, 1):
        f.box(-0.1, sv * 0.805, 0.86, 1.6, 0.03, 0.05, YEL_S, base=False)    # lit shoulder rail
        f.box(0.2, sv * 0.8, 0.66, 0.5, 0.03, 0.12, "hazK", base=False)       # hazard flash
        for k in range(3):
            f.box(0.03 + k * 0.12, sv * 0.81, 0.66, 0.05, 0.02, 0.12, "hazY", base=False)


def canopy(f):
    _g("canopy")
    sweep(f, CANOPY, profile(n=16, p=2.4), STEEL_D, cap1=STEEL_D)
    patch(f, CANOPY, 0.24, 1.08, 15, 165, 1.03, "glassD", n=13, steps=5)
    patch(f, CANOPY, 0.42, 0.58, 30, 150, 1.045, "lens", n=13, steps=2)      # one reflection band
    f.box(0.32, 0, 1.47, 0.2, 0.08, 0.02, "steelD", base=False)               # canopy hinge


def hold(f, full):
    _g("hold")
    u0, u1, hw, z0, z1 = HOLD
    f.box((u0 + u1) / 2, 0, z0, u1 - u0, 2 * hw, z1 - z0, STEEL, top=STEEL_D)
    for sv in (-1, 1):                                                       # ribbed sides
        for k in range(4):
            f.box(u0 + 0.12 + k * (u1 - u0 - 0.24) / 3, sv * (hw + 0.012), z0 + 0.02, 0.06, 0.024, z1 - z0 - 0.06, YEL_D)
    um, lu = (u0 + u1) / 2, u1 - u0
    for sv in (-1, 1):                                                       # the rim: a frame round the hopper mouth
        f.box(um, sv * (hw - 0.02), z1 - 0.04, lu + 0.04, 0.08, 0.06, YEL_D, top=YEL)
    for su in (-1, 1):
        f.box(um + su * (lu / 2 - 0.02), 0, z1 - 0.04, 0.08, 2 * hw, 0.06, YEL_D, top=YEL)
    if not full:
        f.box(um, 0, z1 - 0.04, lu - 0.08, 2 * hw - 0.08, 0.05, STEEL_D)
        for sv in (-1, 1):                                                   # two hopper lids, hazard seam between
            f.box(um, sv * hw / 2, z1 + 0.02, lu - 0.1, hw - 0.06, 0.04, YEL, top=YEL)
            f.box(um, sv * (hw - 0.08), z1 + 0.06, lu - 0.2, 0.04, 0.012, YEL_S)
        for k in range(5):
            f.box(u0 + 0.12 + k * 0.17, 0, z1 + 0.02, 0.08, 0.06, 0.05, "hazY" if k % 2 else "hazK")
        return
    f.box(um, 0, z1 - 0.2, lu - 0.08, 2 * hw - 0.08, 0.16, "dark")         # the hopper's floor, deep in shadow
    lid, ang = hw - 0.04, math.radians(115)                                  # lids swung up and out on their hinges
    for sv in (-1, 1):
        def corner(a, b, d, sv=sv):
            r = 0.0 if b < 0 else lid
            th = 0.0 if d < 0 else 0.04
            return (um + a * (lu - 0.1) / 2, sv * (hw - r * math.cos(ang) + th * math.sin(ang)),
                    z1 + 0.02 + r * math.sin(ang) + th * math.cos(ang))
        lbox(f, corner, {"side": YEL_D, "top": YEL})
    lumps = ((-0.85, -0.3, 0.14, "orM"), (-0.65, 0.22, 0.16, "or"), (-0.42, -0.12, 0.18, "orL"), (-0.25, 0.3, 0.13, "rkM"),
             (-0.62, -0.36, 0.12, "rk"), (-0.3, -0.34, 0.13, "or"), (-0.86, 0.3, 0.13, "rk"), (-0.55, 0.02, 0.2, "orM"),
             (-0.22, 0.04, 0.14, "orL"), (-0.75, 0.04, 0.15, "or"))
    for u, v, r, col in lumps:                                               # the heap, mounded over the rim
        f.vcyl(u, v, z1 - 0.12, r, 0.12 + 0.75 * r, col, top=col, rtop=r * 0.4, sides=6)


def thrusters(f, lit):
    _g("rcs")
    for u, av in RCS:
        for sv in (-1, 1):
            f.box(u, sv * av, 0.62, 0.3, 0.2, 0.3, STEEL_D, top=STEEL)
            for du in (-1, 1):                                               # fore / aft nozzles
                f.hcyl(u + du * 0.15, u + du * 0.21, sv * av, 0.77, 0.06, "steelD", r1=0.075, sides=8,
                       cap=GLOW if lit else "dark")
            f.box(u, sv * (av + 0.1), 0.77, 0.12, 0.04, 0.12, "steelD", base=False)
            f.box(u, sv * (av + 0.125), 0.77, 0.07, 0.02, 0.07, GLOW if lit else "dark", base=False)
    _g("nozzle")
    for sv in (-1, 1):
        f.hcyl(-1.05, -1.2, sv * NOZ_V, NOZ_Z, NOZ_R - 0.02, "steelD", r1=NOZ_R + 0.02, sides=12)
        f.hcyl(-1.19, -1.2, sv * NOZ_V, NOZ_Z, NOZ_R - 0.03, "dark", sides=12, cap=GLOW if lit else "dark")


def laser(f, down, lit):
    """The mining laser on a chin mount under the canopy: stowed, its barrel lies level under the nose; mining, it tips
    forward and down, emitter lit."""
    _g("laser")
    f.box(LASER_U, 0, 0.4, 0.34, 0.36, 0.14, STEEL_D, top=STEEL)              # the mount
    f.hcyl(LASER_U - 0.06, LASER_U + 0.06, 0, 0.44, 0.13, YEL_D, sides=10, cap=YEL_D, capstart=YEL_D)   # the trunnion
    pitch = math.radians(-55 if down else -8)
    kw = dict(pitch=pitch, pu=LASER_U, pz=0.44)
    f.hcyl(LASER_U, LASER_U + 0.42, 0, 0.44, 0.085, STEEL, r1=0.07, sides=10, **kw)
    for a in range(3):                                                       # focusing fins
        t = a * math.tau / 3 + math.pi / 2
        f.box(LASER_U + 0.3, 0.075 * math.cos(t), 0.44 + 0.075 * math.sin(t), 0.16, 0.04, 0.04, YEL_D, base=False, **kw)
    f.hcyl(LASER_U + 0.42, LASER_U + 0.48, 0, 0.44, 0.07, "steelD", r1=0.09, sides=10, cap=BEAM if lit else "dark", **kw)


def legs(f):
    _g("legs")
    for su in (-0.75, 0.55):
        for sv in (-0.62, 0.62):
            f.vcyl(su, sv, 0.0, 0.11, 0.04, "steelD", top="steel", sides=8)
            f.vcyl(su, sv, 0.04, 0.04, BELLY + 0.08, "steelL", sides=6)
            f.box(su, sv, 0.3, 0.12, 0.12, 0.12, STEEL_D, top=STEEL)


def greeble(f):
    _g("greeble")
    f.vcyl(-0.05, -0.4, 1.2, 0.03, 0.22, "steelL", sides=6)                  # antenna
    f.box(-0.05, -0.4, 1.42, 0.06, 0.06, 0.05, "red")
    for sv in (-1, 1):
        f.box(0.95, sv * 0.3, 0.72, 0.06, 0.12, 0.07, "steelD", base=False)   # nose lamps
        f.box(0.985, sv * 0.3, 0.72, 0.012, 0.08, 0.04, "arc", base=False)
    f.box(-1.04, 0, 1.02, 0.03, 0.4, 0.08, "hazK", base=False)                # stern plate


def pod(heading, state="parked", bob=0.0, dz=0.0):
    """state: parked / docked, fly, mine or full (parked with the hold open on its ore)."""
    m = core.Mesh(f"mining_pod_{state}")
    m.dz = dz + (0.0 if state in ("parked", "docked", "full") else 0.35 + bob)
    f = Spin(m, heading)
    hull(f)
    canopy(f)
    hold(f, state == "full")
    thrusters(f, state in ("fly", "mine"))
    laser(f, state == "mine", state == "mine")
    if state in ("parked", "docked", "full"):
        legs(f)
    greeble(f)
    return [smooth(m.build())]
