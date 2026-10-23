"""Pod bay sprite family (module.pod_bay, 3x3) with the mining pod parked in it, and the mining pod's own family.

Named like the shuttle bay's (vehicle_bay.py), so the game can draw them the same way:

Family `pod_bay`, per rotation r (bay frame = the sim's rotated footprint):
  module.pod_bay.r<r>                  pod home: iris shut, clamp arms gripping, gate lamps green
  module.pod_bay.r<r>.empty            pod away: iris shut, arms folded, lamps off
  module.pod_bay.r<r>.fold.f0..f1      arms folding back (pod still parked; draw .parked.fold.f<i> over it)
  module.pod_bay.r<r>.open.f0..f2      the iris opening (pod gone)
  vehicle.mining_pod.parked.r<r>[.fold.f<i>]   the pod in the bay, rendered with that bay state as a holdout, so it is
                                       drawn AFTER the bay sprite and only shows where it is in front of the bay
The pod parks with a hatch to the boarding gate (heading r * 90 - 90 degrees), resting on its thruster bell on the pit
floor (pod_bay.PIT down).

Family `mining_pod` (the sector view; origin = the pod's centre, the bell's foot at z 0):
  vehicle.mining_pod.fly.d0..d7        8 headings (d0 = +x, d2 = +y), thrusters lit
  vehicle.mining_pod.mine.d0..d7.f0..f1   mining: hovering, laser down and lit, arms out; two frames of a slight bob
  vehicle.mining_pod.docked.d0/2/4/6   the docked pose (laser folded, thrusters dark): the lift off / settle in a bay

`emitter(d)` gives, for the mining sprites, where the beam leaves the laser: its mouth in sprite px from the craft
origin (right, down) and the barrel's direction on screen, so the renderer can start fx.mining.beam there."""
import math

from . import core, post, vehicle_bay as VB, pod_bay as B, mining_pod as P

BAY_ID, PARKED_ID, CRAFT = "module.pod_bay", "vehicle.mining_pod.parked", "vehicle.mining_pod"
BAY = {"": dict(), "empty": dict(fold=1.0, home=False)}
BAY.update({f"fold.f{i}": dict(fold=f) for i, f in enumerate(B.FOLD)})
BAY.update({f"open.f{i}": dict(t=t, fold=1.0, home=False) for i, t in enumerate(B.OPENS)})
PARKED = {"": dict(), **{f"fold.f{i}": dict(fold=f) for i, f in enumerate(B.FOLD)}}
HOVER = 0.35                           # the pod's hover in flight (mining_pod.pod lifts it by this): drop it back to 0
BOB = (0.0, 0.03)                      # the mining loop's two frames


def parked_heading(rot):
    """The parked pod's heading in a bay at rotation rot: a hatch to the gate on the bay's +x side."""
    return rot * math.pi / 2 - math.pi / 2


def pod_objs(rot, state="parked"):
    obs = P.pod(parked_heading(rot), state, dz=-B.PIT)
    c = B.BayFrame(None, rot, B.FOOT).pt(0.0, 0.0, 0.0)
    for ob in obs:
        ob.location = (ob.location.x + c.x, ob.location.y + c.y, ob.location.z)
    return obs


def bay_item(rot, state):
    core.clear_scene_meshes()
    post.select(True)
    objs = B.bay(rot, **BAY[state])
    return [VB._render(f"{BAY_ID}.r{rot}" + (f".{state}" if state else ""), "block", objs, objs[1:], B.FOOT)]


def parked_item(rot, state):
    core.clear_scene_meshes()
    post.select(True)
    hold = B.bay(rot, **PARKED[state])
    return [VB._render(f"{PARKED_ID}.r{rot}" + (f".{state}" if state else ""), "prop", pod_objs(rot) + hold, hold, B.FOOT)]


def craft_item(name, heading, state, bob=0.0):
    core.clear_scene_meshes()
    post.select(True)
    dz = 0.0 if state in ("parked", "docked") else -HOVER
    return [VB._render(name, "prop", P.pod(heading, state, bob=bob, dz=dz), [], (1, 1))]


def emitter(d, bob=0.0):
    """The mining laser's mouth for vehicle.mining_pod.mine.d<d> (px right and down from the origin) and the barrel's
    screen direction (a unit (right, down) vector)."""
    pitch = math.radians(-60)
    reach = P.LASER_U + 0.71                                                 # the flared emitter's mouth
    f = P.Spin(None, d * math.pi / 4)

    def px(u, z):
        x, y = f.xy(u, 0.0)
        right, up = core.screen_xy(core.G(x, y, z + bob))
        return right, -up
    lu = reach - P.LASER_U
    mouth = px(P.LASER_U + lu * math.cos(pitch), P.LASER_Z + lu * math.sin(pitch))
    back = px(P.LASER_U, P.LASER_Z)
    dx, dy = mouth[0] - back[0], mouth[1] - back[1]
    n = math.hypot(dx, dy) or 1.0
    return mouth, (dx / n, dy / n)


def jobs():
    out = [lambda r=r, s=s: bay_item(r, s) for r in range(4) for s in BAY]
    return out + [lambda r=r, s=s: parked_item(r, s) for r in range(4) for s in PARKED]


def craft_jobs():
    fly = [lambda d=d: craft_item(f"{CRAFT}.fly.d{d}", d * math.pi / 4, "fly") for d in range(8)]
    mine = [lambda d=d, k=k: craft_item(f"{CRAFT}.mine.d{d}.f{k}", d * math.pi / 4, "mine", BOB[k])
            for d in range(8) for k in range(len(BOB))]
    docked = [lambda d=d: craft_item(f"{CRAFT}.docked.d{d}", d * math.pi / 4, "docked") for d in (0, 2, 4, 6)]
    return fly + mine + docked
