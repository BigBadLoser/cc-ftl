"""Drone family sprites (#318), family `drones` (models in drones.py). Runs inside Blender.

Drones (type = defence | repair | medic, k = heading 0..7 clockwise from grid +x, like the crew and turrets). Each
sprite's anchor is the drone's centre unless noted; the renderer lifts it by its altitude (ZPX px per tile of height)
over `drone.shadow`, and does the hover bob (about 1 px) and the thruster glow pulse itself.
  drone.<type>.fly.d<k>            flying (thruster lips lit)
  drone.<type>.work.d<k>.f0..f1    working: muzzle flash / welding sparks / the emitter pulse, flickering
  drone.medic.work.beam.d<k>       the treatment light as its own see-through layer (alpha drones.BEAM_ALPHA, glow scaled
                                   to match), cut where the drone hides it: drawn over the drone and its patient
  drone.<type>.inert.d<k>          powered down: thrusters and eye dark, tilted. Anchor = the floor under it (it lies on
                                   the deck; in space the same sprite drifts). Ion-stunned: fx.ion_disabled over it
  drone.<type>.docked.d1           in a bay cradle (thrusters off), see below
  drone.shadow                     the floor shadow (alpha SHADOW_ALPHA baked in)

The bay (`module.drone_bay`, 2x2, every rotation built the same way round like the weapon bays: the cage is round and
its rails and cabinet are placed for the camera). Anchored like every module (the front-most tile's centre).
  module.drone_bay.r<r>[.charging|.unpowered]   the bay with no drones; .charging lights the charge contacts only
  ... and each + `.front`                       the bay pixels in front of a docked drone, drawn over the drones
  module.drone_bay.r<r>.damaged[.flicker] / .destroyed   damage.py's recipe, built in this family
  module.drone_bay.hatch.stowed / .hatch.f0..f4          the roof hatch above the roof plating, anchored at the
                                                         footprint centre like turret.<stem>.stowed: closed, then opening
The game draws docked drones itself (any type, any livery): `drone.<type>.docked.d1` with its anchor DOCK_PX[i] px
(right, down) from the module anchor, i = 0 the lower cradle, 1 the upper (the top fills first), between the bay and
its `.front`, lower drone first."""
import math

import numpy as np
from mathutils import Matrix

from . import core, drones, env_build, post
from . import turret_bays as TB
from . import turret_concepts as TC
from .cmbkit import Frame
from .human_render import THETA

TYPES = ("defence", "repair", "medic")
WORK_FRAMES = 2
SHADOW_ALPHA = 0.4
HATCH_R = 0.86                              # roof hatch radius (the drones span 0.78)
HATCH_OPEN = (0.2, 0.4, 0.6, 0.8, 1.0)      # hatch.f0..f4 leaf opening
BAY = "module.drone_bay"
CENTRE = core.G(-0.5, -0.5, 0.0)            # the footprint centre from the module anchor (front-most tile centre)
DOCK_D = 1                                  # docked drones face the camera


def _dock_z(i):
    return drones.PADS[i] + drones.DOCK_DZ


def _dock_px(i):
    right, up = core.screen_xy(CENTRE + core.G(0, 0, _dock_z(i)))
    return round(right), round(-up)


DOCK_PX = tuple(_dock_px(i) for i in range(2))


def _drone(kind, state, d, frame=0):
    rig = drones.drone(kind, state, frame)
    e = rig.root.rotation_euler
    rig.root.rotation_euler = (e[0], e[1], math.radians(THETA[d]))
    if state == "inert":
        rig.ground()                        # lying on the deck: the anchor is the floor under it
    return rig


def _drop(rig):
    import bpy
    for ob in [p.obj for p in rig.parts] + [e for e, _ in rig.joints.values()]:
        bpy.data.objects.remove(ob, do_unlink=True)


def _alpha(op, a):
    return np.where(op, round(255 * a), 0).astype(np.uint8)


# ---- drones -----------------------------------------------------------------------------------------------------

def beam_item(d):
    """The medic's treatment light at heading d, alone: the drone a holdout, alpha BEAM_ALPHA, glow scaled to it."""
    core.clear_scene_meshes()
    post.select(True)
    rig = _drone("medic", "work", d)
    beam = rig.objects("beam")
    for ob in rig.objects():
        ob.is_holdout = ob not in beam
    sid = f"drone.medic.work.beam.d{d}"
    c, op, g, ox, oy, _ = env_build.render_sprite(sid, "prop", beam)
    g = g.copy()
    g[..., :3] = (g[..., :3] * drones.BEAM_ALPHA).astype(g.dtype)
    it = env_build.crop_item(sid, (1, 1), c, op, g, ox, oy, _alpha(op, drones.BEAM_ALPHA))
    return [it] if it else []


def shadow_item():
    core.clear_scene_meshes()
    post.select(True)
    rig = drones.shadow()
    c, op, g, ox, oy, _ = env_build.render_sprite("drone.shadow", "prop", rig.objects())
    it = env_build.crop_item("drone.shadow", (1, 1), c, op, g, ox, oy, _alpha(op, SHADOW_ALPHA))
    return [it] if it else []


def _work(kind, d, k):
    rig = _drone(kind, "work", d, k)
    if kind == "medic":                     # the beam is its own layer
        for ob in rig.objects("beam"):
            ob.hide_render = True
        return [o for o in rig.objects() if o not in rig.objects("beam")]
    return rig.objects()


def drone_jobs():
    out = []
    for kind in TYPES:
        for d in range(8):
            out.append((f"drone.{kind}.fly.d{d}", (1, 1), "prop", lambda k=kind, d=d: _drone(k, "fly", d).objects()))
            for f in range(WORK_FRAMES):
                out.append((f"drone.{kind}.work.d{d}.f{f}", (1, 1), "prop", lambda k=kind, d=d, f=f: _work(k, d, f)))
            out.append((f"drone.{kind}.inert.d{d}", (1, 1), "prop", lambda k=kind, d=d: _drone(k, "inert", d).objects()))
        out.append((f"drone.{kind}.docked.d{DOCK_D}", (1, 1), "prop",
                    lambda k=kind: _drone(k, "docked", DOCK_D).objects()))
    out += [lambda d=d: beam_item(d) for d in range(8)]
    out.append(shadow_item)
    return out


# ---- the bay ----------------------------------------------------------------------------------------------------

def bay_objs(state=""):
    """The empty bay moved so the module anchor is the origin. state: "" (powered), charging or unpowered."""
    objs = drones.bay(0, state == "charging", state != "unpowered")
    for ob in objs:
        ob.matrix_world = Matrix.Translation(CENTRE) @ ob.matrix_world
    return objs


def _occluders(bay, W, H):
    """(hit, seen): pixels where the bay hides a drone docked on either cradle (any type), and where a docked drone
    shows with the bay in front of it (drone alone vs drone with the bay as a holdout), as robot_bay does."""
    hit = np.zeros((H + 2, W + 2), bool)
    seen = hit.copy()
    for i in range(2):
        for kind in TYPES:
            rig = _drone(kind, "docked", DOCK_D)
            rig.root.location = CENTRE + core.G(0, 0, _dock_z(i))
            vis = []
            for holdout in (False, True):
                for o in bay:
                    o.is_holdout, o.hide_render = holdout, not holdout
                rgb, a = core.render(W, H, "color")
                vis.append(np.pad(post.downsample(rgb, a > 0.5, core.SS, 6, False)[1], 1))
            hit |= vis[0] & ~vis[1]
            seen |= vis[1]
            _drop(rig)
    for o in bay:
        o.is_holdout, o.hide_render = False, False
    return hit, seen


def bay_items(rot, state):
    """module.drone_bay.r<rot>[.state] and its `.front` overlay (the bay pixels over a docked drone, grown 1 px over
    the outline ring, like robot_bay's). The main sprite keeps every pixel; its glow leaves out the overlay's share."""
    core.clear_scene_meshes()
    post.select(True)
    objs = bay_objs(state)
    sid = f"{BAY}.r{rot}" + (f".{state}" if state else "")
    c, op, g, ox, oy, _ = env_build.render_sprite(sid, "prop", objs)
    W, H = op.shape[1] - 2, op.shape[0] - 2
    rgb, a = core.render(W, H, "color")
    ring = op & ~np.pad(post.downsample(rgb, a > 0.5, core.SS, 8, False)[1], 1)
    hit, seen = _occluders(objs, W, H)
    near = hit.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        near |= np.roll(hit, (dy, dx), (0, 1))
    fr = op & (hit | (near & (ring | ~seen)))
    gb, gf = g.copy(), g.copy()
    gb[fr] = 0
    gf[~fr] = 0
    out = [env_build.crop_item(sid, (2, 2), c, op, gb, ox, oy)]
    if fr.any():
        out.append(env_build.crop_item(f"{sid}.front", (2, 2), c, fr, gf, ox, oy))
    return out


def hatch_objs(opening):
    """The roof hatch (turret_bays.hatch) with a fixed coaming round it, centred on the footprint at the roof plane."""
    obs = TB.hatch(HATCH_R, opening)
    m = core.Mesh("drone_hatch_coaming")
    TC.coaming(Frame(m, 1, square=True), HATCH_R - 0.06)
    ob = m.build()
    ob.matrix_world = Matrix.Translation((0, 0, TC.ZR))
    return obs + [ob]


def bay_jobs(rots=range(4)):
    from . import damage
    out = [lambda r=r, s=s: bay_items(r, s) for r in rots for s in ("", "charging", "unpowered")]
    for r in rots:                          # damage states: damage.py's recipe, built here so the family is self-contained
        for level in damage.DMG + ("damaged.flicker",):
            sid = f"{BAY}.r{r}.{level}"
            out.append((sid, (2, 2), "prop", damage.wrap(lambda: bay_objs(""), level, sid)))
    out.append((f"{BAY}.hatch.stowed", (2, 2), "prop", lambda: hatch_objs(0.0)))
    for f, o in enumerate(HATCH_OPEN):
        out.append((f"{BAY}.hatch.f{f}", (2, 2), "prop", lambda o=o: hatch_objs(o)))
    return out


def jobs():
    return drone_jobs() + bay_jobs()
