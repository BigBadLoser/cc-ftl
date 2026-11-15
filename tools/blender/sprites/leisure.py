"""Leisure furniture (families `bunk_module`, `exercise_module`, `planter_module`, `vending_module`; the bench is
bench.py): the approved look studies rendered as modules, four rotations each, one state (art only: no module defs use
them yet, except module.bed).

  module.bunk          bunk_study b1h: the double bunk bed, 1x2 (approved 2026-11-12)
  module.bed           bunk_study s3: the single bed to match, B1h's lower deck alone, 1x2 (approved 2026-11-12); it
                       replaces props.py's bed (the mattress top stays at 9 px, 0.23, so sleeping crew lie as before)
  module.exercise      exercise_r12 v6g: the sparring droid, 1x1, crew stand in front on +v (approved 2026-11-13)
  (module.bench, bench_module: bench.py, as it has a front overlay for seated crew)
  module.planter       planter_r2 pl1a: the deep-blue glazed pot with a broad-leaf bush, 1x1 (approved 2026-11-13)
  module.vending       vending_r23 vm1c23a: the paper-cup machine, 1x1 (approved 2026-11-14)
  module.vending_red   vending_r24 vm1c24e: the red machine with the side can, 1x1 (approved 2026-11-14)

Ids are what moduleArt.ts looks up: `module.<x>.r<r>`, and `module.<x>` (r0) for anything without rotations. The studies build at r0
(K's default rotation); `turned` builds one at rotation r by giving every K made meanwhile that rotation, so each
piece goes through K.p exactly as a module built with `rot` would. Each family keeps its study's palette selection,
so its pixels match what was approved. The vending machines render with 64 samples (their pale tops mottle at the
pipeline's 4), set on the scene for their jobs only, as recovery.py does. Each job renders one module at one rotation
itself (r0 also gives the plain id), so a job is keyed by this module's source and what it imports."""
import numpy as np

from . import bunk_study, core, env_build as E, exercise_r12, modkit, planter_r2, post, vending_r23, vending_r24

FAMILIES = {  # family: [(module id, footprint at r0, (study module, design)), ...], palette selection
    "bunk_module": ([("module.bunk", (1, 2), ("bunk_study", "b1h")),
                     ("module.bed", (1, 2), ("bunk_study", "s3"))], True),
    "exercise_module": ([("module.exercise", (1, 1), ("exercise_r12", "v6g"))], "only:gym"),
    "planter_module": ([("module.planter", (1, 1), ("planter_r2", "pl1a"))], "only:planter"),
    "vending_module": ([("module.vending", (1, 1), ("vending_r23", "vm1c23a")),
                        ("module.vending_red", (1, 1), ("vending_r24", "vm1c24e"))], "only:vending"),
}
SAMPLES = {"vending_module": 64}
BERTHS = {"module.bunk": 2, "module.bed": 1}   # beds: front overlays per berth over their sleepers (bed_front.py)


def turned(build, rot):
    """`build()` with every K it makes (Bench included) at rotation `rot` unless it names one."""
    init = modkit.K.__init__

    def at(self, name, fp, r=0):
        init(self, name, fp, r or rot)
    modkit.K.__init__ = at
    try:
        return build()
    finally:
        modkit.K.__init__ = init


STUDIES = {m.__name__.rsplit(".", 1)[1]: m for m in (bunk_study, exercise_r12, planter_r2, vending_r23,
                                                     vending_r24)}


def job(family, sid, fp, study, name, rot):
    # Everything that tells the jobs apart is a default argument: the render cache keys a job by its code and defaults.
    def run(family=family, sid=sid, fp=fp, study=study, name=name, rot=rot):
        import bpy
        build = STUDIES[study].DESIGNS[name]
        base = sid.rsplit(".r", 1)[0]
        if base in BERTHS:                       # (before the scene is read: building the crew rig replaces it)
            return bed_items(family, sid, fp, build, rot, BERTHS[base])
        sc = bpy.context.scene
        sc.cycles.samples = SAMPLES.get(family, core.SAMPLES)
        try:
            core.clear_scene_meshes()
            post.select(palette(family))
            f = fp if rot % 2 == 0 else (fp[1], fp[0])
            c, op, g, ox, oy, al = E.render_sprite(sid, "prop", turned(build, rot))
            out = []
            for aid in ([sid] if rot else [sid, sid.removesuffix(".r0")]):
                it = E.crop_item(aid, f, c, op, g, ox, oy, al)
                if it:
                    out.append(it)
            return out
        finally:
            sc.cycles.samples = core.SAMPLES
    return run


def bed_items(family, sid, fp, build, rot, berths):
    """A bed's sprite and its front overlays `<asset>.front.b<b>.r<r>` (bed_front.py). The crew rig is built first
    (building it clears the scene) and hidden, and the bed is dropped after each render instead of clearing the scene."""
    from . import bed_front as BF
    from . import consoles as CO
    from .research_bench import drop
    hr, (_, rig) = CO._rig()
    hr.set_state(rig, [], [])
    post.select(palette(family))
    f = fp if rot % 2 == 0 else (fp[1], fp[0])
    objs = turned(build, rot)
    c, op, g, ox, oy, al = E.render_sprite(sid, "prop", objs)
    drop(objs)
    W, H = op.shape[1] - 2, op.shape[0] - 2
    objs = turned(build, rot)
    masks = BF.split(op, BF.occluders(objs, fp, rot, berths, W, H))
    drop(objs)
    front = np.zeros_like(op)
    for m in masks:
        front |= m
    gb = g.copy()
    gb[front] = 0
    base = sid.rsplit(".r", 1)[0]
    out = [E.crop_item(aid, f, c, op, gb, ox, oy, al) for aid in ([sid] if rot else [sid, base])]
    for b, m in enumerate(masks):
        if m.any():
            gm = g.copy()
            gm[~m] = 0
            out.append(E.crop_item(f"{base}.front.b{b}.r{rot}", f, c, m, gm, ox, oy, np.where(m, al, 0) if al is not None else None))
    return [it for it in out if it]


def jobs(family, rots=range(4)):
    """One job per module and rotation: `module.<x>.r<r>`, and `module.<x>` at r0 as well."""
    mods, _ = FAMILIES[family]
    return [job(family, f"{sid}.r{r}", fp, study, name, r)
            for sid, fp, (study, name) in mods for r in rots]


def palette(family):
    return FAMILIES[family][1]
