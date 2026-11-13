"""Stasis wheel and slab, shipped (family `stasis`; issue #116): the approved look study (slab_wheel.py s49a with the
bays of slab_bay.py, the hatch of slab_load.py, the hover cart of slab_study.py) as game sprites, four rotations.

Per rotation r (`module.stasis_wheel` is the r0 copy):
  module.stasis_wheel.r<r>            the wheel with every socket empty, its hatch shut (the base of every fill level)
  module.stasis_wheel.slot<i>.r<r>    slot i's slab alone, the wheel held out (no sprite where the wheel hides it all).
                                      Slot i stands at angle 45 + 36 i deg in the wheel's own frame (slot 0 at the
                                      hatch corner); the renderer draws full slots over the base back to front.
  module.stasis_wheel.lamp<i>.<c>.r<r>  slot i's rim lamp lit, c = cy (a prisoner held), amb (an empty slab ready) or red
                                      (running on its reserve: the renderer pulses it); dark in the base. On the top rim, so
                                      the fill shows at every rotation.
The wheel has a window front and back (the back one is seen at the half turn). The hover cart is slab_cart.py.
The prisoner's face is pressed into a slab by a shader (a later slice), so one slab sprite serves empty and full."""
from . import core, post
from . import env_build as E
from . import slab_load as LD
from . import slab_wheel as W
from .modkit import K
from .recovery_study import SAMPLES, layer
from .slab_fill import module
from .slab_kit import angles, cassette, floor_fill, frame
from .slab_study import PAL

FP = (3, 3)
LAMPS = (("cy", "slbCy"), ("amb", "slbAmb"), ("red", "slbRed"))
A = "module.stasis_wheel"


def named(it, aid, fp):
    it = dict(it)
    it["id"], it["fp"] = aid, fp
    return it


def wheel_objs(rot):
    """The wheel (every socket empty) and the holdout floor round its pit and hatch."""
    W.VIEW[0] = rot
    k = K(f"stasis_r{rot}", FP, rot)
    module(k, tuple(range(10)), windows=2, lamps=True)
    objs = k.build()
    f = K(f"stasis_floor_r{rot}", FP, rot)
    floor_fill(f, LD.r_hole, -0.04, 0.0, "dark", half=4.0)
    for o in f.build():
        o.is_holdout = True
        objs.append(o)
    return objs


def slot_objs(rot, i):
    k = K(f"stasis_slot{i}_r{rot}", FP, rot)
    cassette(k, frame(angles()[i], W.Z0))
    return k.build()


def lamp_objs(rot, i, col):
    k = K(f"stasis_lamp{i}_r{rot}", FP, rot)
    W.rim_lamp(k, angles()[i], col)
    return k.build()


def wheel_items(rot):
    core.clear_scene_meshes()
    post.select(PAL)
    c, op, g, ox, oy, _ = E.render_sprite("x", "prop", wheel_objs(rot))
    base = E.crop_item("x", FP, c, op, g, ox, oy)
    out = [named(base, f"{A}.r{rot}", FP)] + ([named(base, A, FP)] if rot == 0 else [])
    for i in range(10):
        core.clear_scene_meshes()
        post.select(PAL)
        it = layer(wheel_objs(rot), slot_objs(rot, i), 255)
        if it is not None:
            out.append(named(it, f"{A}.slot{i}.r{rot}", FP))
    for i in range(10):
        for tag, col in LAMPS:
            core.clear_scene_meshes()
            post.select(PAL)
            it = layer(wheel_objs(rot), lamp_objs(rot, i, col), 255)
            if it is not None:
                out.append(named(it, f"{A}.lamp{i}.{tag}.r{rot}", FP))
    return out


def job(rot):
    def run(rot=rot):
        import bpy
        bpy.context.scene.cycles.samples = SAMPLES          # as the study rendered it
        try:
            return wheel_items(rot)
        finally:
            W.VIEW[0] = 0
            bpy.context.scene.cycles.samples = core.SAMPLES
    return run


def jobs(rots=range(4)):
    return [job(r) for r in rots]
