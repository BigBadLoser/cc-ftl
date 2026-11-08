"""Escape pod sprite family (escape_pod.py). Preview phase: `escape_pod_variants` renders each cone variant's flying
headings d0, d2 and d5 as vehicle.escape_pod.<variant>.fly.d<d>, and drifting (upright, beacon on in f0, off in f1) as
.drift.d<d>.f<k>, to pick a shape."""
import math

from . import core, post, vehicle_bay as VB, escape_pod as E

CRAFT = "vehicle.escape_pod"


def craft_item(name, heading, variant, state, beacon=False):
    core.clear_scene_meshes()
    post.select(True)
    return [VB._render(name, "prop", E.pod(heading, variant, state, beacon), [], (1, 1))]


def variant_jobs():
    return [lambda v=v, d=d: craft_item(f"{CRAFT}.{v}.fly.d{d}", d * math.pi / 4, v, "fly")
            for v in E.VARIANTS for d in (0, 2, 5)] + \
        [lambda v=v, d=d, k=k: craft_item(f"{CRAFT}.{v}.drift.d{d}.f{k}", d * math.pi / 4, v, "drift", k == 0)
         for v in E.VARIANTS for d in (0, 2, 5) for k in (0, 1)] + \
        [lambda v=v, d=d: craft_item(f"{CRAFT}.{v}.docked.d{d}", d * math.pi / 4, v, "docked")
         for v in E.VARIANTS for d in (0, 2, 5)]


def dock_item(rot, variant="h"):
    """Preview: the pod docked nose first at an airlock of rotation rot (its housing, open, and its collar, docked),
    the hatch's mating face on the collar's, the axes level (airlock.ZC): <CRAFT>.<v>.airlock.r<rot>."""
    from . import airlock as A, airlock_collar as CO
    core.clear_scene_meshes()
    post.select(A.HULL_PAL)
    fr = A.frame(None, rot)
    ox, oy = fr.xy(0.0, 0.0)
    out_x, out_y = (a - b for a, b in zip(fr.xy(1.0, 0.0), (ox, oy)))      # outward through the hull, grid
    cx, cy = fr.xy(A.COLLAR_END + E.hatch_face(variant), 0.0)
    obs = E.pod(math.atan2(-out_y, -out_x), variant, "docked", axis=A.ZC)
    for ob in obs:
        ob.location = ob.location + core.G(cx, cy, 0.0)
    co = CO.collar(rot, 1.0, True)                                          # (camera-facing rotations: with the hull row)
    co = list({id(o): o for o in co[1] + co[0]}.values()) if isinstance(co, tuple) else co
    objs = A.housing(rot, 1.0) + co + obs
    return A._item(f"{CRAFT}.{variant}.airlock.r{rot}", "prop", objs, A.HULL_U + 1, 0.0, rot)


def bay_item(rot, variant="h"):
    """Preview: the pod parked in a pod bay of rotation rot in its docked pose (on its side, the hatch to the bay's
    gate, as at an airlock), resting on the pit floor: <CRAFT>.<v>.inbay.r<rot>."""
    from . import pod_bay as B
    core.clear_scene_meshes()
    post.select(True)
    hold = B.bay(rot)
    bf = B.BayFrame(None, rot, B.FOOT)
    (x0, y0), (x1, y1) = bf.xy(0.0, 0.0), bf.xy(1.0, 0.0)                  # the gate is on the bay's +u side
    obs = E.pod(math.atan2(y1 - y0, x1 - x0), variant, "docked", foot=-B.PIT)
    c = bf.pt(0.0, 0.0, 0.0)
    for ob in obs:
        ob.location = (ob.location.x + c.x, ob.location.y + c.y, ob.location.z)
    return [VB._render(f"{CRAFT}.{variant}.inbay.r{rot}", "block", hold + obs, hold[1:], B.FOOT)]


def place_jobs():
    # (one lambda a line: the render cache tells jobs apart by their code and line, not the function they call)
    docks = [lambda r=r: dock_item(r) for r in range(4)]
    bays = [lambda r=r: bay_item(r) for r in range(4)]
    return docks + bays
