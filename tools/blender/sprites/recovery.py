"""Recovery pod (family `recovery_pod`): `module.recovery`, the approved look study u3 (recovery_study10.py, the spine
lantern: a wide round tank of fluid on a stepped plinth, a glass dome, a white spine from a lobe of the plinth arching
over to hang a lit hat above the tank, a console on the plinth, a hologram scanner ring) as a 2x2 module, four
rotations (parts and the per-rotation layout in recovery_kit.py). The patient floats upright in the tank.

Sprites per rotation r (`module.recovery` is the r0 idle copy):
  module.recovery.r<r>                 powered, the bubbles' first frame (the still: build menu, ghost)
  module.recovery.r<r>.unpowered       every light dark, no bubbles
  module.recovery.r<r>.active[.fN]     powered: FRAMES frames of rising bubbles at the renderer's ANIM_FPS. Bubbles
                                       always play while powered, patient or not.
The patient is drawn between the pod and an overlay of everything in front of them (the fluid's near film, the glass
and dome, the near bubbles, the spine's bend and the hat):
  module.recovery.front.r<r>[.active[.fN]]   the overlay, powered (frames match the pod's)
  module.recovery.front.r<r>.unpowered        unpowered
The scanner, played every so often over the pod (each pod on its own offset; render-side, not sim): SCAN frames of a
sweep, foot to head and back, a far half drawn under the patient and a near half over them:
  module.recovery.scan.back.r<r>[.fN], module.recovery.scan.front.r<r>[.fN]   (the first frame unsuffixed, as .active's)
Layering: pod at K, scan.back K + 0.01, patient K + 0.02, front K + 0.03, scan.front K + 0.04."""
from . import core, env_build as E, post
from .recovery_kit import Pod
from .recovery_study import FP, PAL, SAMPLES, layer
from .recovery_study9 import SWEEP, scan, surface_film
from .recovery_study10 import bubbles, dome, glass_edges
from .research_bench import over
from .research_kit import holo_item

FRAMES = 8                                          # the bubble loop: 2 s at ANIM_FPS 4, the 16-frame pace kept
SCAN = len(SWEEP)                                   # the scanner's sweep: 16 frames, 4 s
A = "module.recovery"


def named(it, aid):
    it = dict(it)
    it["id"], it["fp"] = aid, FP
    return it


def render(build):
    core.clear_scene_meshes()
    post.select(PAL)
    c, op, g, ox, oy, _ = E.render_sprite("x", "prop", build())
    return E.crop_item("x", FP, c, op, g, ox, oy)


def lay(pod, build, alpha):
    """`build`'s parts seen past the pod's solid parts (not its fluid), every px at `alpha` (or a hologram)."""
    core.clear_scene_meshes()
    post.select(PAL)
    return holo_item("x", FP, pod.mask(), build()) if alpha == "holo" else layer(pod.mask(), build(), alpha)


def stack(items):
    out = None
    for it in items:
        if it is not None:
            out = it if out is None else over(out, it)
    return out


def items(rot):
    on, off = Pod(rot), Pod(rot, off=True)
    body, dark = render(on.back), render(off.back)
    glass = [lay(on, b, a) for b, a in ((surface_film, 110), (dome, 72), (glass_edges, 170))]
    top, top_off = lay(on, on.top, 255), lay(off, off.top, 255)
    r = f".r{rot}"
    out = [named(dark, f"{A}{r}.unpowered"), named(stack(glass + [top_off]), f"{A}.front{r}.unpowered")]
    for f in range(FRAMES):
        tag = f".f{f}" if f else ""
        pod = stack([body, lay(on, bubbles(f, False, FRAMES, True), 220)])
        front = stack(glass + [lay(on, bubbles(f, True, FRAMES, True), 220), top])
        out += [named(pod, f"{A}{r}.active{tag}"), named(front, f"{A}.front{r}.active{tag}")]
        if f == 0:
            out += [named(pod, f"{A}{r}"), named(front, f"{A}.front{r}")]
            if rot == 0:
                out.append(named(pod, A))
    for f, h in enumerate(SWEEP):
        for half, near in (("back", False), ("front", True)):
            it = lay(on, scan(h, near), "holo")
            if it is not None:
                out.append(named(it, f"{A}.scan.{half}{r}" + (f".f{f}" if f else "")))
    return out


def job(rot):
    def run(rot=rot):
        import bpy
        bpy.context.scene.cycles.samples = SAMPLES          # curved white and fluid faces speckle at the pipeline's 4
        try:
            return items(rot)
        finally:
            bpy.context.scene.cycles.samples = core.SAMPLES
    return run


def jobs(rots=range(4)):
    return [job(r) for r in rots]
