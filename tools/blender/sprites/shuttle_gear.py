"""Shuttle landing gear look study (family `shuttle_gear`, preview only; issue #509): the transport shuttle standing on its
landing pad on retractable gear (stowed inside the keel in flight). Three gear designs, one view each, the shuttle in its
folded-wing pose lifted by the gear onto the pad's deck (PAD_Z):

  vehicle.shuttle.gear.g1   four telescoping legs, knee braces, broad round footpads, open gear doors
  vehicle.shuttle.gear.g2   twin skids along the keel on raked struts
  vehicle.shuttle.gear.g3   tricycle: a nose leg under the cockpit and two heavy main legs with rocker feet
  vehicle.shuttle.gear.g4   short stout legs under the engine shoulders, square feet, hazard bands
  vehicle.shuttle.gear.g5   jointed insect legs, a high knee, hex feet
  vehicle.shuttle.gear.g6   swing-out side frames (A-frames to long foot plates), like the turret outriggers

Origin = the craft's centre, as craft_item; drawn over a pad in the review sheet."""
import math

from . import core, post
from . import detail as D
from .shuttle_craft import transport_shuttle

PAD_Z = 0.24                  # the pad deck
KEEL = 0.5                    # keel underside above the craft's feet plane (the parked legs' height)


def _frame(m, heading):
    from lib.transport_forms import FlightFrame
    return FlightFrame(m, heading)


def door(f, u, v, side, z, lu=0.42, lv=0.28):
    """An open gear door hanging off the keel beside a leg well (side: which way it swings, -1/+1 in v)."""
    f.box(u, v, z - 0.02, lu + 0.06, lv + 0.06, 0.03, "dark", top="dark")                        # the well
    D.seg(f, (u - lu / 2, v + side * lv / 2, z), (u - lu / 2, v + side * (lv / 2 + 0.04), z - 0.3), 0.012, "steelD")
    f.box(u, v + side * (lv / 2 + 0.03), z - 0.16, lu, 0.025, 0.3, "steel", top="steelL")       # the door leaf


def g1(f, lift):
    """Four telescoping legs, knee braces, broad round footpads, open doors."""
    zk = KEEL + lift
    for u in (-1.35, 1.2):
        for sv in (-1, 1):
            v = sv * 1.0
            fv = sv * 1.25                                                          # feet splay out
            f.vcyl(u, fv, 0.0, 0.22, 0.05, "steelD", top="steel", sides=12)          # footpad
            f.vcyl(u, fv, 0.05, 0.1, 0.06, "steel", top="steelL", sides=8)           # ankle
            D.seg(f, (u, fv, 0.1), (u, v, zk - 0.05), 0.075, "steelD")               # lower oleo
            D.seg(f, (u, (fv + v) / 2 + sv * 0.02, (0.1 + zk) / 2), (u, v, zk), 0.1, "steelL")   # upper sleeve
            D.seg(f, (u, fv * 0.92, 0.22), (u - 0.25 * (1 if u > 0 else -1), v * 0.7, zk), 0.035, "steel")  # brace
            door(f, u, v, sv, zk)


def g2(f, lift):
    """Twin skids along the keel on raked struts."""
    zk = KEEL + lift
    for sv in (-1, 1):
        v = sv * 1.15
        D.seg(f, (-1.9, v, 0.07), (1.7, v, 0.07), 0.07, "steelD", cap="steel", capstart="steel")   # the skid
        D.seg(f, (1.7, v, 0.07), (2.0, v, 0.22), 0.06, "steelD", cap="steel")                    # upturned toe
        for u in (-1.2, 1.0):
            D.seg(f, (u, v, 0.1), (u + 0.25, sv * 0.85, zk), 0.07, "steelL")
            D.seg(f, (u, v, 0.1), (u - 0.25, sv * 0.85, zk), 0.05, "steel")
            f.box(u, v, 0.05, 0.22, 0.16, 0.1, "steel", top="steelL")                            # strut shoe
        door(f, -0.1, sv * 0.8, sv, zk, lu=2.4, lv=0.2)


def g3(f, lift):
    """Tricycle: a nose leg under the cockpit and two heavy main legs with rocker feet."""
    zk = KEEL + lift
    u = 1.75                                                                          # nose leg
    f.box(u, 0, 0.0, 0.34, 0.26, 0.06, "steelD", top="steel")
    D.seg(f, (u, 0, 0.06), (u, 0, zk + 0.05), 0.07, "steelL")
    D.seg(f, (u - 0.3, 0, zk), (u, 0, 0.3), 0.035, "steel")
    door(f, u, 0, 1, zk + 0.05, lu=0.36, lv=0.22)
    door(f, u, 0, -1, zk + 0.05, lu=0.36, lv=0.22)
    for sv in (-1, 1):                                                                # main legs
        fv, v = sv * 1.2, sv * 0.95
        f.box(-1.2, fv, 0.0, 0.7, 0.3, 0.07, "steelD", top="steel")                   # rocker foot
        f.box(-1.2, fv, 0.07, 0.3, 0.2, 0.08, "steel", top="steelL")
        for du in (-0.09, 0.09):                                                      # doubled oleo
            D.seg(f, (-1.2 + du, fv, 0.12), (-1.2 + du, v, zk), 0.065, "steelL")
        D.seg(f, (-1.2, fv * 0.9, 0.35), (-0.65, v * 0.8, zk), 0.04, "steel")         # drag brace
        door(f, -1.2, v, sv, zk, lu=0.5, lv=0.3)


def band(f, a, b, r, n=4):
    """Hazard bands along a strut from a to b (n alternating yellow and black)."""
    for k in range(n):
        t0, t1 = 0.35 + 0.08 * k, 0.35 + 0.08 * (k + 1)
        p0 = tuple(a[i] + (b[i] - a[i]) * t0 for i in range(3))
        p1 = tuple(a[i] + (b[i] - a[i]) * t1 for i in range(3))
        D.seg(f, p0, p1, r, "hazY" if k % 2 == 0 else "hazK")


def g4(f, lift):
    """Short, stout legs straight down from under the engine shoulders, square feet, a hazard band on each."""
    zk = KEEL + lift + 0.35                                                           # the shoulder underside
    for u in (-1.75, -0.2):
        for sv in (-1, 1):
            v = sv * 1.3
            f.box(u, v, 0.0, 0.36, 0.36, 0.07, "steelD", top="steel")
            f.box(u, v, 0.07, 0.2, 0.2, 0.06, "steel", top="steelL")
            D.seg(f, (u, v, 0.13), (u, v, zk), 0.09, "steelL")
            D.seg(f, (u, v, zk - 0.25), (u, v, zk + 0.02), 0.12, "steel")             # the sleeve
            band(f, (u, v, 0.13), (u, v, zk), 0.095, n=3)
    D.seg(f, (1.6, 0, 0.05), (1.6, 0, KEEL + lift), 0.06, "steelL")                   # light nose prop
    f.box(1.6, 0, 0.0, 0.24, 0.24, 0.05, "steelD", top="steel")


def g5(f, lift):
    """Jointed insect legs: an upper arm out and up from the hull side to a high knee, a long shin down to a hex foot."""
    zk = KEEL + lift + 0.15
    for u in (-1.3, 1.25):
        for sv in (-1, 1):
            hip = (u, sv * 0.85, zk)
            knee = (u + (0.15 if u > 0 else -0.15), sv * 1.55, zk + 0.35)
            foot = (u + (0.3 if u > 0 else -0.3), sv * 1.75, 0.08)
            D.seg(f, hip, knee, 0.075, "steelL")
            f.vcyl(knee[0], knee[1], knee[2] - 0.08, 0.1, 0.16, "steel", top="steelL", sides=8)   # knee joint
            D.seg(f, knee, foot, 0.06, "steelL")
            band(f, knee, foot, 0.065, n=3)
            D.seg(f, (hip[0], hip[1], hip[2] - 0.2), ((knee[0] + foot[0]) / 2, (knee[1] + foot[1]) / 2, (knee[2] + foot[2]) / 2), 0.03, "steel")   # actuator
            f.vcyl(foot[0], foot[1], 0.0, 0.2, 0.06, "steelD", top="steel", sides=6)


def g6(f, lift):
    """Swing-out side frames (like the turret outriggers): an A-frame hinged at the belly's edge out and down to a long
    foot plate along each side."""
    zk = KEEL + lift
    for sv in (-1, 1):
        fv = sv * 1.6
        f.box(-0.1, fv, 0.0, 2.6, 0.26, 0.06, "steelD", top="steel")                  # foot plate
        f.box(-0.1, fv, 0.06, 2.2, 0.12, 0.05, "hazY", top="hazY")
        for k in range(6):
            f.box(-1.2 + k * 0.44, fv, 0.11, 0.2, 0.125, 0.004, "hazK", top="hazK")
        for u in (-1.1, 0.9):
            D.seg(f, (u - 0.35, sv * 0.85, zk), (u, fv, 0.1), 0.06, "steelL")         # A-frame
            D.seg(f, (u + 0.35, sv * 0.85, zk), (u, fv, 0.1), 0.06, "steelL")
            f.vcyl(u, fv, 0.06, 0.09, 0.1, "steel", top="steelL", sides=8)            # foot hinge
        D.seg(f, (-1.6, sv * 0.85, zk), (1.4, sv * 0.85, zk), 0.07, "steel")          # hinge beam under the belly edge


GEAR = {"g4": (g4, 0.2), "g5": (g5, 0.25), "g6": (g6, 0.2)}


def landed(key, heading=0.0):
    fn, lift = GEAR[key]
    objs = transport_shuttle(heading, "docked", dz=PAD_Z + lift)
    m = core.Mesh(f"shuttle_gear_{key}")
    m.dz = PAD_Z
    fn(_frame(m, heading), lift)
    return objs + [m.build()]


def _item(key):
    from lib import palette
    from .vehicle_bay import LIVERY, _render
    core.clear_scene_meshes()
    post.select(True)
    for k, hx in LIVERY.items():
        palette._data[k] = {"hex": hx}
    return [_render(f"vehicle.shuttle.gear.{key}", "prop", landed(key), [], (1, 1))]


def jobs():
    return [lambda k=k: _item(k) for k in GEAR]
