"""Robot bay (module.robot_bay), 1x2: a charging cradle the robot backs into, the charger tower on the tile behind it.

Layout (bay frame, robot_kit character frame: x = the docked robot's right, f = away from the tower, z up; origin =
the cradle tile centre). In the robots' own language: light shell plates over a dark exposed frame,
hinge discs, a wedge brow plate on the tower with the status light as its single round eye. The tower (about 1.6
tall, under the 1.85 walls) holds a dark alcove with a light charging spine standing out of it: its contact strip
meets the walkers' back packs at any height. The cradle tile has two foot clamps with floor
contacts and knee-high side rails; no floor slab. A docking clamp on the spine folds up flush, and swings out to hold
the drone by its dorsal fin (`.charging.drone`). Two jointed tool arms fold against the alcove cheeks and reach over
the cradle while assembling, over a part-built robot of that type in bare primer (no livery).

Sprites, per rotation r (cradle = the footprint's rotated (0, 0) tile, as the sim's rotateOffset; tower = rotated (0, 1)):
  module.robot_bay.r<r>                  empty: status light green (front and back of the tower)
  module.robot_bay.r<r>.charging         contacts lit, light cyan (a walker docks: the crew sprite in its charge clip)
  module.robot_bay.r<r>.charging.drone   the same, docking clamp swung out for the drone
  module.robot_bay.r<r>.assembling.<t>   tool arms out over a part-built <t> (worker, repair, security), light amber
  module.robot_bay.r<r>.charging[.drone].front   overlay: the bay pixels in front of the docked robot
Renderer layering (as the consoles): bay at its depth K, the docked robot at K + 0.02, the front overlay at K + 0.03.
Unpowered is the renderer's job: glow off. Glow: only the contacts and the status light."""
import math

import numpy as np

from . import core, env_build, post, robots
from .robot_kit import Rig

ID = "module.robot_bay"
TYPES = ("worker", "repair", "security")
STATES = ("", "charging", "charging.drone") + tuple(f"assembling.{t}" for t in TYPES)
PRIMER = "plate"                # a part-built robot in bare primer, no livery
ARM = "hazY"                    # tool arms: industrial yellow, apart from the primer-grey robot they build
SHELL, SHELL_D, FRAME, FRAME_L = "sole", "plate", "dark", "steelD"    # the robots' look: light shells over a dark frame
LIGHT = {"": "green", "charging": "cyan", "charging.drone": "cyan", "assembling": "orange"}
FACE = {0: 6, 1: 0, 2: 2, 3: 4}          # docked robot's facing (sim direction) per rotation: away from the tower


def _rot_offset(rot, dx, dy, w=1, h=2):
    """The sim's rotateOffset for a [w, h] footprint."""
    x, y = dx, dy
    for _ in range(rot):
        x, y = h - 1 - y, x
        w, h = h, w
    return x, y


def placement(rot):
    """(cradle tile relative to the sprite origin = the front-most footprint tile, facing direction) for rotation rot."""
    cr, tw = _rot_offset(rot, 0, 0), _rot_offset(rot, 0, 1)
    front = max((cr, tw), key=lambda t: (t[0] + t[1], t[0]))
    return (cr[0] - front[0], cr[1] - front[1]), FACE[rot]


def _tower(rig, light, contacts):
    """The robots' language: light shell plates over a dark exposed frame, tapered and chamfered, hinge discs, and a
    wedge brow plate on top with the status light as the single round eye (front and back)."""
    p = rig.part("root")
    p.rbox((0, -1.0, 0.31), (0.7, 0.44, 0.62), FRAME, r=0.05, taper=0.92)                  # base frame
    for sx in (1, -1):
        p.rbox((sx * 0.35, -1.0, 0.33), (0.07, 0.46, 0.5), SHELL, r=0.03, taper=0.8)      # base side shells
        p.rbox((sx * 0.34, -0.62, 0.5), (0.09, 0.28, 1.0), FRAME, top=SHELL_D, r=0.03, taper=0.85)   # cradle cheeks
        p.rbox((sx * 0.35, -0.62, 0.62), (0.1, 0.24, 0.5), SHELL, r=0.03, taper=0.85)     # cheek shells
    p.rbox((0, -0.775, 0.33), (0.5, 0.05, 0.44), SHELL, r=0.03, taper=0.85)               # base front shell
    p.rbox((0, -1.0, 0.64), (0.58, 0.38, 0.05), SHELL_D, r=0.04)                           # waist band
    p.rbox((0, -1.04, 1.1), (0.38, 0.32, 0.86), FRAME, r=0.05)                             # column core (the alcove)
    p.rbox((0, -1.12, 1.12), (0.58, 0.32, 0.66), SHELL, r=0.08, taper=1.18)                # column shell, chest-like
    p.rbox((0, -1.1, 0.83), (0.5, 0.33, 0.04), SHELL_D, r=0.06)                            # seam under the shell
    for sx in (1, -1):
        p.cyl((sx * 0.3, -0.95, 1.22), 0.045, 0.05, FRAME, axis="x")                       # shell hinge discs
    p.rbox((0, -0.98, 1.6), (0.5, 0.06, 0.52), SHELL, r=0.03, taper=0.75, axis="f")        # brow plate, over the alcove
    p.rbox((0, -0.86, 1.5), (0.22, 0.12, 0.16), FRAME, r=0.03, taper=0.7, axis="f")        # sensor wedge under it
    rig.part("root", "light").ball((0, -0.79, 1.5), (0.04, 0.02, 0.035), light)            # status eye, front
    p.rbox((0, -0.68, 0.97), (0.14, 0.32, 0.08), SHELL_D, r=0.03)                          # spine bracket
    p.rbox((0, -0.5, 0.98), (0.19, 0.09, 0.86), SHELL, top=SHELL_D, r=0.045)               # charging spine: light shell,
    p.rbox((0, -0.452, 0.98), (0.09, 0.02, 0.66), FRAME, r=0.015)                          # dark contact slot,
    rig.part("root", "contacts").box((0, -0.44, 0.98), (0.05, 0.02, 0.6), "cyan" if contacts else FRAME)   # contacts
    for z in (0.52, 1.44):
        p.cyl((0, -0.5, z), 0.055, 0.22, FRAME, axis="x")                                  # spine hinge discs
    p.rbox((0, -1.29, 1.36), (0.18, 0.06, 0.12), FRAME, r=0.03)                            # back: sensor and eye,
    rig.part("root", "light").ball((0, -1.325, 1.36), (0.035, 0.02, 0.03), light)
    for z in (0.22, 0.34, 0.46):                                                           # vents in the base frame
        p.rbox((0, -1.225, z), (0.36, 0.02, 0.05), FRAME_L, r=0.01)


def _cradle(rig, contacts):
    p = rig.part("root")
    for sx in (1, -1):
        p.rbox((sx * 0.12, 0.02, 0.015), (0.17, 0.32, 0.03), FRAME, r=0.015)                  # foot clamp: sole,
        p.rbox((sx * 0.12, 0.0, 0.05), (0.15, 0.24, 0.05), SHELL, r=0.02, taper=0.75)          # shell
        rig.part("root", "contacts").box((sx * 0.12, 0.13, 0.04), (0.08, 0.04, 0.03), "cyan" if contacts else "dark")
        p.rbox((sx * 0.38, 0.3, 0.16), (0.08, 0.08, 0.32), FRAME, r=0.02)                      # front post
        p.cyl((sx * 0.38, 0.3, 0.32), 0.05, 0.1, FRAME_L, axis="x")                           # its hinge disc
        p.plate((sx * 0.36, -0.52, 0.32), (sx * 0.38, 0.27, 0.32), 0.09, 0.07, SHELL, taper=0.85, r=0.03)   # rail shell
        p.rbox((sx * 0.38, 0.35, 0.32), (0.09, 0.05, 0.07), "hazY", r=0.015)                  # rail end marker


def _clamp(rig, out):
    """Drone docking clamp on the spine: folded up flush, or swung out over the cradle at fin height."""
    j = rig.joint("clamp", "root", (0, -0.5, 1.42))
    p = rig.part(j)
    p.cyl((0, -0.5, 1.42), 0.045, 0.16, "dark", axis="x")
    p.plate((0, -0.5, 1.42), (0, -0.2, 1.24), 0.08, 0.06, SHELL_D, taper=0.85, r=0.02)
    for sx in (1, -1):
        p.rbox((sx * 0.035, -0.17, 1.165), (0.03, 0.07, 0.08), "dark", r=0.01)
    rig.rot(j, pitch=0 if out else 88)


def _tool_arms(rig, out):
    """Two jointed tool arms on the alcove cheeks (industrial yellow on dark hinges, a welder and a gripper): folded
    down along the cheeks, or reaching over the cradle."""
    for side, sx in (("R", 1), ("L", -1)):
        sh, el = (sx * 0.34, -0.52, 0.98), (sx * 0.34, -0.52, 0.72)
        s = rig.joint(f"tool_{side}", "root", sh)
        e = rig.joint(f"tool_el_{side}", s, el)
        tip = (sx * 0.34, -0.52, 0.5)
        rig.part(s).cyl(sh, 0.05, 0.09, "dark", axis="x")
        rig.part(s).plate(sh, el, 0.07, 0.075, ARM, taper=0.85, r=0.02)
        rig.part(e).cyl(el, 0.045, 0.085, "dark", axis="x")
        rig.part(e).plate(el, tip, 0.065, 0.07, ARM, taper=0.8, r=0.02)
        rig.part(e).rbox((tip[0], tip[1], tip[2] - 0.02), (0.08, 0.08, 0.06), "dark", r=0.015)      # tool head
        if side == "R":                                                                         # welder nozzle
            rig.part(e).cyl((tip[0], tip[1], tip[2] - 0.11), 0.018, 0.08, "brass", taper=1.8)
        else:                                                                                   # gripper
            for df in (-0.025, 0.025):
                rig.part(e).rbox((tip[0], tip[1] + df, tip[2] - 0.1), (0.045, 0.025, 0.08), FRAME_L, r=0.01, taper=0.7)
        if out:
            rig.rot(s, pitch=-70, roll=sx * 22)
            rig.rot(e, pitch=-55)


def _partial(kind):
    """A part-built robot of `kind` in bare primer: no head, no arms (the drone: no arms or nacelles)."""
    saved = robots.CLOTH, robots.ACCENT
    robots.CLOTH, robots.ACCENT = PRIMER, FRAME_L
    try:
        rig = robots.BUILD[kind]()
    finally:
        robots.CLOTH, robots.ACCENT = saved
    from . import robot_render as rr
    rr.pose(rig, "idle", 0)
    keep = {"root", "body", "torso"} | {j for j in rig.joints if j.startswith(("hip_", "knee_", "ankle_"))}
    for p in rig.parts:
        if p.joint not in keep or any(p in rig.tags.get(t, []) for t in ("eye", "jet", "bar0", "bar1", "bar2", "bar3")):
            p.obj.hide_render = True
    if kind == "repair":
        rig.root.location.z += 0.08                          # cradled in the arms, lower than its hover
    return rig


def build(rot, state):
    """Mesh objects of the bay for rotation `rot` and `state`, placed for its sprite (origin = front-most tile)."""
    core.clear_scene_meshes()
    (dx, dy), d = placement(rot)
    kind = state.split(".")[1] if state.startswith("assembling") else None
    rig = Rig(f"bay{rot}")
    _tower(rig, LIGHT[state.split(".")[0] if kind else state], state.startswith("charging"))
    _cradle(rig, state.startswith("charging"))
    _clamp(rig, state == "charging.drone")
    _tool_arms(rig, bool(kind))
    rig.build()
    objs = rig.objects()
    roots = [rig.root]
    if kind:
        part = _partial(kind)
        objs += [o for o in part.objects() if not o.hide_render]
        roots.append(part.root)
    from . import human_render as hr
    for r in roots:
        r.rotation_euler = (0, 0, r.rotation_euler.z + math.radians(hr.THETA[d]))
        r.location = (r.location.x + dx, r.location.y - dy, r.location.z)
    return objs


def _occluders(rot, state, bay, W, H):
    """(hit, seen) for the robots that dock in this state: pixels where the bay hides a docked robot in some charge frame,
    and where the robot shows with the bay in front of it (3D: robot alone vs robot with the bay as a holdout)."""
    import bpy
    from . import robot_render as rr
    hit = np.zeros((H + 2, W + 2), bool)
    seen = hit.copy()
    (dx, dy), d = placement(rot)
    for kind in (("repair",) if state == "charging.drone" else ("worker", "security")):
        rig = robots.BUILD[kind]()
        for i in range(4):
            rig.root.rotation_euler = (0, 0, math.radians(rr.hr.THETA[d]))
            rr.pose(rig, "charge", i)
            rig.root.location = (dx, -dy, rig.root.location.z)
            vis = []
            for holdout in (False, True):
                for o in bay:
                    o.is_holdout, o.hide_render = holdout, not holdout
                rgb, a = core.render(W, H, "color")
                vis.append(np.pad(post.downsample(rgb, a > 0.5, core.SS, 6, False)[1], 1))
            hit |= vis[0] & ~vis[1]
            seen |= vis[1]
        for ob in [p.obj for p in rig.parts] + [e for e, _ in rig.joints.values()]:
            bpy.data.objects.remove(ob, do_unlink=True)
    for o in bay:
        o.is_holdout, o.hide_render = False, False
    return hit, seen


def items(rot, state):
    """The sprite for (rot, state); a charging state also gets its `.front` overlay: the bay pixels that hide a docked
    robot (grown 1 px over the outline ring), drawn over the robot like a console's desk front. The main sprite keeps
    every pixel; its glow leaves out the overlay's share."""
    post.select(True)
    objs = build(rot, state)
    fp = (2, 1) if rot % 2 else (1, 2)
    sid = f"{ID}.r{rot}" + (f".{state}" if state else "")
    c, op, g, ox, oy, _ = env_build.render_sprite(sid, "prop", objs)
    if not state.startswith("charging"):
        return [env_build.crop_item(sid, fp, c, op, g, ox, oy)]
    W, H = op.shape[1] - 2, op.shape[0] - 2
    rgb, a = core.render(W, H, "color")
    ring = op & ~np.pad(post.downsample(rgb, a > 0.5, core.SS, 8, False)[1], 1)
    hit, seen = _occluders(rot, state, objs, W, H)
    near = hit.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        near |= np.roll(hit, (dy, dx), (0, 1))
    fr = op & (hit | (near & (ring | ~seen)))
    gb, gf = g.copy(), g.copy()
    gb[fr] = 0
    gf[~fr] = 0
    out = [env_build.crop_item(sid, fp, c, op, gb, ox, oy)]
    if fr.any():
        out.append(env_build.crop_item(f"{sid}.front", fp, c, fr, gf, ox, oy))
    return out


def jobs():
    return [lambda r=r, s=s: items(r, s) for r in range(4) for s in STATES]
