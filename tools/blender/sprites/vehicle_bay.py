"""Shuttle bay sprite family (module.vehicle_bay, 4x5, the whole footprint is the pit) and the shuttle parked in it.

The bay model is shuttle_bay.py (pit, doors, gangway, claw towers and arms), the shuttle is shuttle_craft.transport_shuttle.
The shuttle hangs in the claws, feet at shuttle_bay.FEET_Z (pit floor + LIFT 0.85), nose +v at r0 so its side hatch faces the
long +u side (the access side), heading +90 deg per rotation. Both are drawn from the footprint's front-most tile.

Flight art lives in the `shuttle` family (craft_jobs): vehicle.shuttle.fly.d0..d7, vehicle.shuttle.docked.d0/2/4/6.

Sprites, per rotation r (bay frame = the sim's rotated footprint):
  module.vehicle_bay.r<r>               shuttle home: doors closed, claws gripping, gate lamps green
  module.vehicle_bay.r<r>.empty         shuttle away: doors closed, claws folded, lamps off
  module.vehicle_bay.r<r>.fold.f0..f1   claws folding back (shuttle still parked; draw .parked.fold.f<i> over it)
  module.vehicle_bay.r<r>.open.f0..f2   launch doors sliding open (shuttle gone; gangway retracted from f1)
  vehicle.shuttle.parked.r<r>[.fold.f<i>]   the shuttle in the bay, rendered with that bay state as a holdout, so it is drawn
                                        AFTER the bay sprite and only shows where it is in front of the bay (the claws and
                                        towers hold their pixels in front of it)
The renderer cuts both into screen strips per footprint diagonal for depth sorting (see moduleView). Glow = lamps."""
import math

import numpy as np

from . import core, env_build, post, shuttle_bay as B

ID = "module.vehicle_bay"
SHUTTLE = "vehicle.shuttle.parked"
FOLD = (0.4, 0.8)                       # claw fold per .fold.f<i>
OPEN = (0.2, 0.4, 0.66)                 # door open fraction per .open.f<i> (arms folded)
LIVERY = {"mkP": "#527593", "mkS": "#c7a15e"}      # the player livery stands in for the export keys (no per-faction remap yet)
# state -> kwargs of shuttle_bay.bay(rot, **kw)
BAY = {"": dict(), "empty": dict(fold=1.0, home=False)}
BAY.update({f"fold.f{i}": dict(fold=f) for i, f in enumerate(FOLD)})
BAY.update({f"open.f{i}": dict(t=t, fold=1.0, home=False) for i, t in enumerate(OPEN)})
PARKED = {"": dict(), **{f"fold.f{i}": dict(fold=f) for i, f in enumerate(FOLD)}}


def footprint(rot):
    return (5, 4) if rot % 2 else (4, 5)


def _render(sid, kind, objs, holdouts, fp):
    """Render the visible objects (holdouts may be huge, so they stay out of the canvas size) to a cropped manifest item."""
    import math as m
    for ob in holdouts:
        ob.is_holdout = True
    vis = [o for o in objs if o not in holdouts]
    xmin, xmax, ymin, ymax = core.extent_px(vis)
    W = 2 * (int(m.ceil(max(-xmin, xmax))) + 5)
    H = 2 * (int(m.ceil(max(-ymin, ymax))) + 5)
    rgb, a = core.render(W, H, "color")
    c, op = post.downsample(rgb, a > 0.5, core.SS, 8, True)
    if kind == "prop":
        c, op = post.outline(c, op, True)
    else:
        c, op = env_build._pad1(c), env_build._pad1(op)
    grgb, _ = core.render(W, H, "glow")
    g = env_build._pad1(post.glow_down(grgb, core.SS, 3))
    return env_build.crop_item(sid, fp, c, op, g, (W + 2) // 2, (H + 2) // 2)


def shuttle_objs(rot):
    """The parked shuttle, centred on the pit, heading +90 deg per rotation, feet at FEET_Z."""
    from lib import palette
    from . import shuttle_craft as SC
    for k, hx in LIVERY.items():
        palette._data[k] = {"hex": hx}
    obs = SC.transport_shuttle(math.pi / 2 + rot * math.pi / 2, "parked", dz=B.FEET_Z)
    c = B.BayFrame(None, rot).pt(0.0, 0.0, 0.0)
    for ob in obs:
        ob.location = (ob.location.x + c.x, ob.location.y + c.y, ob.location.z)
    return obs


def bay_item(rot, state):
    core.clear_scene_meshes()
    post.select(True)
    objs = B.bay(rot, **BAY[state])
    return [_render(f"{ID}.r{rot}" + (f".{state}" if state else ""), "block", objs, objs[1:], footprint(rot))]


def shuttle_item(rot, state):
    core.clear_scene_meshes()
    post.select(True)
    hold = B.bay(rot, **PARKED[state])
    objs = shuttle_objs(rot) + hold
    return [_render(f"{SHUTTLE}.r{rot}" + (f".{state}" if state else ""), "prop", objs, hold, footprint(rot))]


def craft_item(name, state, heading):
    """The shuttle alone (no bay), origin = its centre with the feet / belly plane at z 0, for the sector view."""
    core.clear_scene_meshes()
    post.select(True)
    from lib import palette
    from . import shuttle_craft as SC
    for k, hx in LIVERY.items():
        palette._data[k] = {"hex": hx}
    return [_render(name, "prop", SC.transport_shuttle(heading, state), [], (1, 1))]


def craft_jobs():
    """Flight art (family `shuttle`): vehicle.shuttle.fly.d0..d7 (wings spread, nozzles lit; d0 = +x, d2 = +y) and
    vehicle.shuttle.docked.d0/d2/d4/d6 (legs up, wings folded, nozzles dark, nose out: the rear ramp meets the airlock)."""
    fly = [lambda d=d: craft_item(f"vehicle.shuttle.fly.d{d}", "fly", d * math.pi / 4) for d in range(8)]
    docked = [lambda d=d: craft_item(f"vehicle.shuttle.docked.d{d}", "docked", d * math.pi / 4) for d in (0, 2, 4, 6)]
    return fly + docked


def jobs():
    out = [lambda r=r, s=s: bay_item(r, s) for r in range(4) for s in BAY]
    return out + [lambda r=r, s=s: shuttle_item(r, s) for r in range(4) for s in PARKED]
