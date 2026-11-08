"""Escape pod sprite family `escape_pod` (escape_pod.py), named like the mining pod's (pod_family.py) so the game draws
them the same way. Craft sprites: origin = the pod's centre on the ground, its lowest point at z 0 (podView adds the hover).
  vehicle.escape_pod.fly.d0..d7            flying, leaning back, thrusters lit (d0 = +x, d2 = +y)
  vehicle.escape_pod.drift.d0..d7.f0..f1   adrift: upright, thrusters dark, the beacon lit (f0) and dark (f1)
  vehicle.escape_pod.docked.d0/2/4/6       on its side, the hatch toward d: docked nose first at an airlock (its axis
                                           AXIS above the origin, the hatch's face HATCH_FACE ahead of it: podView puts
                                           them on the collar's), or lifting out of / settling into a pod bay
  vehicle.escape_pod.parked.r<r>[.fold.f<i>]   in a pod bay of rotation r: the docked pose, the hatch to the bay's gate
                                           (its +u side), on the pit floor; rendered with that bay state as a holdout, as
                                           the mining pod's parked sprites are (pod_family.parked_item)
"""
import math

from . import core, post, vehicle_bay as VB, escape_pod as E, pod_bay as B, pod_family as PF

CRAFT, PARKED_ID = "vehicle.escape_pod", "vehicle.escape_pod.parked"
HATCH_FACE = E.hatch_face()
AXIS = E.VARIANTS["h"]["rb"] * 1.04            # docked: the axis's height over the lowest point (the shield's rim)
PARKED_SAMPLES = 32                            # the bay's soft shadows speckle the white hull at the default 4


def craft_item(name, heading, state, beacon=False):
    core.clear_scene_meshes()
    post.select(True)
    return [VB._render(name, "prop", E.pod(heading, "h", state, beacon, foot=0.0), [], (1, 1))]


def gate_heading(rot):
    """The heading from a pod bay's centre to its gate (the bay's +u side), grid radians."""
    bf = B.BayFrame(None, rot, B.FOOT)
    (x0, y0), (x1, y1) = bf.xy(0.0, 0.0), bf.xy(1.0, 0.0)
    return math.atan2(y1 - y0, x1 - x0)


def parked_item(rot, state):
    import bpy
    core.clear_scene_meshes()
    post.select(True)
    hold = B.bay(rot, **PF.PARKED[state])
    obs = E.pod(gate_heading(rot), "h", "docked", foot=-B.PIT)
    c = B.BayFrame(None, rot, B.FOOT).pt(0.0, 0.0, 0.0)
    for ob in obs:
        ob.location = (ob.location.x + c.x, ob.location.y + c.y, ob.location.z)
    cyc = bpy.context.scene.cycles
    was, cyc.samples = cyc.samples, PARKED_SAMPLES
    try:
        return [VB._render(f"{PARKED_ID}.r{rot}" + (f".{state}" if state else ""), "prop", obs + hold, hold, B.FOOT)]
    finally:
        cyc.samples = was


def jobs():
    # (a list per line: the render cache tells callable jobs apart by their code and line, not the function they call)
    fly = [lambda d=d: craft_item(f"{CRAFT}.fly.d{d}", d * math.pi / 4, "fly") for d in range(8)]
    drift = [lambda d=d, k=k: craft_item(f"{CRAFT}.drift.d{d}.f{k}", d * math.pi / 4, "drift", k == 0)
             for d in range(8) for k in (0, 1)]
    docked = [lambda d=d: craft_item(f"{CRAFT}.docked.d{d}", d * math.pi / 4, "docked") for d in (0, 2, 4, 6)]
    parked = [lambda r=r, s=s: parked_item(r, s) for r in range(4) for s in PF.PARKED]
    return fly + drift + docked + parked
