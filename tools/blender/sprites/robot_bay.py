"""Robot bay (module.robot_bay), 1x2: a charging cradle the robot backs into, the charger tower on the tile behind it.

Layout (bay frame, robot_kit character frame: x = the docked robot's right, f = away from the tower, z up; origin =
the cradle tile centre). The tower (about 1.6 tall, under the 1.85 walls) holds a dark alcove with a vertical charging
spine: its contact strip meets the walkers' back packs at any height. The cradle tile has two foot clamps with floor
contacts and knee-high side rails; no floor slab. A docking clamp on the spine folds up flush, and swings out to hold
the drone by its dorsal fin (`.charging.drone`). Two jointed tool arms fold against the alcove cheeks and reach over
the cradle while assembling, over a part-built robot of that type in bare primer (no livery).

Sprites, per rotation r (cradle = the footprint's rotated (0, 0) tile, as the sim's rotateOffset; tower = rotated (0, 1)):
  module.robot_bay.r<r>                  empty: status light green (front and back of the tower)
  module.robot_bay.r<r>.charging         contacts lit, light cyan (a walker docks: the crew sprite in its charge clip)
  module.robot_bay.r<r>.charging.drone   the same, docking clamp swung out for the drone
  module.robot_bay.r<r>.assembling.<t>   tool arms out over a part-built <t> (worker, repair, security), light amber
Unpowered is the renderer's job: glow off. Glow: only the contacts and the status light."""
import math

from . import core, env_build, post, robots
from .robot_kit import Rig, bl

ID = "module.robot_bay"
TYPES = ("worker", "repair", "security")
STATES = ("", "charging", "charging.drone") + tuple(f"assembling.{t}" for t in TYPES)
BODY, BODY_D, BODY_L, TRIM = "steel", "steelD", "steelL", "gm"
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
    p = rig.part("root")
    p.rbox((0, -1.0, 0.78), (0.8, 0.52, 1.56), BODY, top=BODY_L, r=0.05, taper=0.94)        # tower body
    p.rbox((0, -1.0, 1.585), (0.78, 0.54, 0.05), BODY_L, r=0.05)                            # top cap
    p.rbox((0, -0.73, 0.86), (0.5, 0.07, 1.18), "dark", r=0.03)                            # alcove recess
    for sx in (1, -1):                                                                     # alcove cheeks
        p.rbox((sx * 0.34, -0.6, 0.62), (0.09, 0.32, 1.24), BODY_D, top=BODY, r=0.03, taper=0.85)
        p.rbox((sx * 0.42, -1.0, 0.95), (0.03, 0.3, 0.5), "dark", r=0.01)                 # side vents
    p.rbox((0, -0.68, 0.95), (0.15, 0.07, 0.9), TRIM, r=0.03)                              # charging spine
    rig.part("root", "contacts").box((0, -0.64, 0.95), (0.06, 0.02, 0.62), "cyan" if contacts else BODY_D)
    rig.part("root", "light").box((0, -0.73, 1.5), (0.14, 0.03, 0.06), light)             # status light
    p.rbox((0, -0.72, 1.5), (0.2, 0.04, 0.1), "dark", r=0.02)
    # back face (the side the camera sees when the tower stands in front of the robot): service panel, vents, conduits
    p.rbox((0, -1.255, 0.82), (0.5, 0.04, 0.9), BODY_D, r=0.03)
    for z in (0.55, 0.68, 0.81):
        p.rbox((0, -1.275, z), (0.34, 0.02, 0.05), "dark", r=0.01)
    for sx in (1, -1):
        p.cyl((sx * 0.3, -1.275, 0.7), 0.035, 1.2, TRIM)
    p.rbox((0, -1.255, 1.38), (0.32, 0.04, 0.16), TRIM, r=0.02)
    rig.part("root", "light").box((0, -1.28, 1.38), (0.12, 0.02, 0.05), light)


def _cradle(rig, contacts):
    p = rig.part("root")
    for sx in (1, -1):
        p.rbox((sx * 0.12, 0.02, 0.025), (0.17, 0.3, 0.05), BODY_D, top=BODY, r=0.03)          # foot clamp
        rig.part("root", "contacts").box((sx * 0.12, 0.02, 0.055), (0.08, 0.14, 0.012), "cyan" if contacts else "dark")
        for f in (-0.32, 0.3):                                                                 # rail posts
            p.rbox((sx * 0.38, f, 0.15), (0.06, 0.06, 0.3), BODY_D, r=0.015)
        p.rbox((sx * 0.38, -0.02, 0.31), (0.07, 0.72, 0.05), BODY, r=0.02)                   # side rail
        p.rbox((sx * 0.38, 0.33, 0.31), (0.075, 0.06, 0.055), "hazY", r=0.01)                 # rail end marker


def _clamp(rig, out):
    """Drone docking clamp on the spine: folded up flush, or swung out over the cradle at fin height."""
    j = rig.joint("clamp", "root", (0, -0.64, 1.2))
    p = rig.part(j)
    p.cyl((0, -0.64, 1.2), 0.045, 0.16, "dark", axis="x")
    p.plate((0, -0.64, 1.2), (0, -0.2, 1.2), 0.08, 0.06, TRIM, taper=0.85, r=0.02)
    for sx in (1, -1):
        p.rbox((sx * 0.035, -0.17, 1.165), (0.03, 0.07, 0.08), "dark", r=0.01)
    rig.rot(j, pitch=0 if out else 88)


def _tool_arms(rig, out):
    """Two jointed tool arms on the alcove cheeks: folded up along them, or reaching over the cradle."""
    for side, sx in (("R", 1), ("L", -1)):
        sh, el = (sx * 0.34, -0.5, 1.15), (sx * 0.34, -0.5, 0.82)
        s = rig.joint(f"tool_{side}", "root", sh)
        e = rig.joint(f"tool_el_{side}", s, el)
        tip = (sx * 0.34, -0.5, 0.56)
        rig.part(s).cyl(sh, 0.045, 0.08, "dark", axis="x")
        rig.part(s).plate(sh, el, 0.06, 0.065, TRIM, taper=0.85, r=0.02)
        rig.part(e).cyl(el, 0.04, 0.075, "dark", axis="x")
        rig.part(e).plate(el, tip, 0.055, 0.06, TRIM, taper=0.8, r=0.02)
        rig.part(e).cyl(tip, 0.03, 0.07, BODY_D, taper=0.5)
        if out:
            rig.rot(s, pitch=-62, roll=sx * 18)
            rig.rot(e, pitch=-38)


def _partial(kind):
    """A part-built robot of `kind` in bare primer: no head, no arms (the drone: no arms or nacelles)."""
    saved = robots.CLOTH, robots.ACCENT
    robots.CLOTH, robots.ACCENT = "plate", TRIM
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


def items(rot, state):
    post.select(True)
    objs = build(rot, state)
    fp = (2, 1) if rot % 2 else (1, 2)
    sid = f"{ID}.r{rot}" + (f".{state}" if state else "")
    return [env_build.crop_item(sid, fp, *env_build.render_sprite(sid, "prop", objs))]


def jobs():
    return [lambda r=r, s=s: items(r, s) for r in range(4) for s in STATES]
