"""Shuttle landing gear look study (family `shuttle_gear`, preview only; issue #509): the transport shuttle standing on its
landing pad on retractable gear (stowed inside the keel in flight). Three gear designs, one view each, the shuttle in its
folded-wing pose lifted by the gear onto the pad's deck (PAD_Z):

  vehicle.shuttle.gear.g1   four telescoping legs, knee braces, broad round footpads, open gear doors
  vehicle.shuttle.gear.g2   twin skids along the keel on raked struts
  vehicle.shuttle.gear.g3   tricycle: a nose leg under the cockpit and two heavy main legs with rocker feet

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


GEAR = {"g1": (g1, 0.25), "g2": (g2, 0.12), "g3": (g3, 0.3)}


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
