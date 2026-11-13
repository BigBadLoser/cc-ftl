"""The slab on its hover cart (family `stasis`; issue #116), apart from the wheel so the wheel's edits leave its cache alone:
  slab.cart.r<r>[.fN]   a slab on the hover cart along the rotation's long axis, ring loop frame N of HOVER_N (the first
                        unsuffixed); the slab's foot toward the push bar, which is at the end away from where it is pushed."""
from . import core, post
from . import env_build as E
from .modkit import K
from .recovery_study import SAMPLES
from .slab_kit import cassette
from .slab_study import HOVER_N, PAL, hover_cart, level

CART_FP = (1, 2)


def named(it, aid, fp):
    it = dict(it)
    it["id"], it["fp"] = aid, fp
    return it


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


def job(rot):
    def run(rot=rot):
        import bpy
        bpy.context.scene.cycles.samples = SAMPLES          # as the study rendered it
        try:
            return cart_items(rot)
        finally:
            bpy.context.scene.cycles.samples = core.SAMPLES
    return run


def jobs(rots=range(4)):
    return [job(r) for r in rots]
