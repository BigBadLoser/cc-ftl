"""Stasis wheel and slab, shipped (family `stasis`; issue #116): the approved look study (slab_wheel.py s49a with the
bays of slab_bay.py, the hatch of slab_load.py, the hover cart of slab_study.py) as game sprites, four rotations.

Per rotation r (`module.stasis_wheel` is the r0 copy):
  module.stasis_wheel.r<r>            the wheel with every socket empty, its hatch shut (the base of every fill level)
  module.stasis_wheel.slot<i>.r<r>    slot i's slab alone, the wheel held out (no sprite where the wheel hides it all).
                                      Slot i stands at angle 45 + 36 i deg in the wheel's own frame (slot 0 at the
                                      hatch corner); the renderer draws full slots over the base back to front.
  slab.cart.r<r>[.fN]                 a slab on the hover cart along the rotation's long axis, ring loop frame N of
                                      HOVER_N (the first unsuffixed); the slab's foot toward the push bar.
The prisoner's face is pressed into a slab by a shader (a later slice), so one slab sprite serves empty and full."""
from . import core, post
from . import env_build as E
from . import slab_load as LD
from . import slab_wheel as W
from .modkit import K
from .recovery_study import SAMPLES, layer
from .slab_fill import module
from .slab_kit import angles, cassette, floor_fill, frame
from .slab_study import HOVER_N, PAL, hover_cart, level

FP, CART_FP = (3, 3), (1, 2)
A = "module.stasis_wheel"


def named(it, aid, fp):
    it = dict(it)
    it["id"], it["fp"] = aid, fp
    return it


def wheel_objs(rot):
    """The wheel (every socket empty) and the holdout floor round its pit and hatch."""
    W.VIEW[0] = rot
    k = K(f"stasis_r{rot}", FP, rot)
    module(k, tuple(range(10)))
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
    return out


def cart_items(rot):
    out = []
    for n in range(HOVER_N):
        core.clear_scene_meshes()
        post.select(PAL)
        k = K(f"stasis_cart_r{rot}", CART_FP, rot)
        s = level()
        hover_cart(k, s, n)
        cassette(k, s)
        c, op, g, ox, oy, _ = E.render_sprite("x", "prop", k.build())
        out.append(named(E.crop_item("x", CART_FP, c, op, g, ox, oy), f"slab.cart.r{rot}" + (f".f{n}" if n else ""),
                         CART_FP))
    return out


def job(rot, part):
    def run(rot=rot, part=part):
        import bpy
        bpy.context.scene.cycles.samples = SAMPLES          # as the study rendered it
        try:
            return wheel_items(rot) if part == "wheel" else cart_items(rot)
        finally:
            W.VIEW[0] = 0
            bpy.context.scene.cycles.samples = core.SAMPLES
    return run


def jobs(rots=range(4)):
    return [job(r, p) for r in rots for p in ("wheel", "cart")]
