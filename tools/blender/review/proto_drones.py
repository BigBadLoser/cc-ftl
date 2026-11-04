"""Quick pixel renders of the drone prototypes (runs in Blender) to .npz for drones_composite.py.
  blender -b --factory-startup --python tools/blender/review/proto_drones.py -- <out dir> [s=<samples>] <job> ...
Jobs: d:<defence|repair|medic>:<fly|work|docked|inert>:<dir 0..7>[:<frame>]   a drone (anchor = its centre)
      shadow                                                                  the floor shadow
      bay:<docked 0..2>[:charge]                                              the bay at r0
Game-scale sprites through env_build.render_sprite (kind "prop"), low samples, denoised: previews, not final art."""
import math
import sys
from pathlib import Path
import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, drones, env_build, post  # noqa: E402
from sprites.human_render import THETA  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
OUT = Path(args[0])
OUT.mkdir(parents=True, exist_ok=True)
SAMPLES = next((int(a[2:]) for a in args if a.startswith("s=")), 16)


def meshes():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def render(tag, build, objs=None):
    core.setup_scene()
    sc = core._state["scene"]
    sc.cycles.samples, sc.cycles.use_denoising = SAMPLES, True
    clear()
    core.setup_scene()
    post.select(True)
    rig = build()
    beam = rig.objects("beam") if hasattr(rig, "objects") else []
    for ob in beam:                                   # the drone without its beam
        ob.hide_render = True
    c, op, g, ox, oy, _ = env_build.render_sprite("x", "prop", [o for o in meshes() if o not in beam])
    np.savez(OUT / f"{tag}.npz", rgba=post.to_rgba(c, op), glow=g, ox=ox, oy=oy)
    print("pixel", tag, flush=True)
    if beam:                                          # the beam on its own, cut where the drone hides it
        for ob in meshes():
            ob.is_holdout = ob not in beam
            ob.hide_render = False
        c, op, g, ox, oy, _ = env_build.render_sprite("x", "prop", beam)
        np.savez(OUT / f"{tag}_beam.npz", rgba=post.to_rgba(c, op), glow=g, ox=ox, oy=oy)
        print("pixel", tag + "_beam", flush=True)


def job(j):
    p = j.split(":")
    if p[0] == "d":
        kind, state, d = p[1], p[2], int(p[3])
        fr = int(p[4]) if len(p) > 4 else 0

        def b():
            rig = drones.drone(kind, state, fr)
            e = rig.root.rotation_euler
            rig.root.rotation_euler = (e[0], e[1], math.radians(THETA[d]))
            return rig
        render(j.replace(":", "_"), b)
    elif p[0] == "shadow":
        render("shadow", drones.shadow)
    elif p[0] == "bay":
        render(j.replace(":", "_"), lambda: drones.bay(int(p[1]), len(p) > 2))


for j in [a for a in args[1:] if not a.startswith("s=")]:
    job(j)
