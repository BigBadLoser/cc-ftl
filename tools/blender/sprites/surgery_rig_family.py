"""The surgical rig's sprite family (`surgery_rig`, families.py; #311): per rotation n, all ids under module.surgery_rig.

  .r{n}.idle / .r{n}.active               the body (the column, flange and console projector; lit in surgery)
  .front.r{n}.idle                        the rest, folded by the column: boom, piston, halo and arms, drawn over the bed
  .front.r{n}.<phase>[.f{i}]              the front through each animation phase (surgery_rig_anim.PHASES: deploy, the
                                          three stage loops, the swaps between them and stow; frame 0 has no .f)
  .holo.r{n}[.f{i}]                       the console hologram, its scan line's SCAN-frame sweep (its own loop)
  module.surgery_rig                      r0 idle body (the plain id)

The front is rendered with the body as a holdout ("over"), so it holds only what is in front of the column. Frames run at
surgery_rig_anim.FPS; the game picks them from the operation's progress."""
from . import core, post
from . import env_build as E
from .research_kit import holo_item
from .surgery_rig import build, holo_layer
from .surgery_rig_anim import PHASES, SCAN, pose, scan, still

A = "module.surgery_rig"
FP = (1, 1)
PAL = "surgery"


def _fresh():
    core.clear_scene_meshes()
    post.select(PAL)


def _item(sid, kind, objs):
    return E.crop_item(sid, FP, *E.render_sprite(sid, kind, objs))


def _front(sid, P, rot):
    _fresh()
    b, f = build(P, rot, sid.replace(".", "_"), split=True)
    return _item(sid, "over", (f, f + b))


def base_job(rot):
    """The body idle and lit, and the front folded by the column."""
    def run(rot=rot):
        out = []
        for st in ("idle", "active"):
            _fresh()
            b, f = build(still("idle" if st == "idle" else "cut"), rot, f"rig_body_{st}_{rot}", split=True)
            for o in f:                                  # (the scene renders whole: the front out of it)
                o.hide_render = True
            out.append(_item(f"{A}.r{rot}.{st}", "prop", b))
            if rot == 0 and st == "idle":
                out.append(_item(A, "prop", b))
        out.append(_front(f"{A}.front.r{rot}.idle", still("idle"), rot))
        return [it for it in out if it]
    return run


def phase_job(rot, ph):
    """Every frame of one animation phase's front."""
    def run(rot=rot, ph=ph):
        n = PHASES[ph]
        return [it for it in (_front(f"{A}.front.r{rot}.{ph}" + (f".f{i}" if i else ""), pose(ph, i / n), rot)
                              for i in range(n)) if it]
    return run


def holo_job(rot):
    """The console hologram's scan sweep, the rig at work as its holdout."""
    def run(rot=rot):
        out = []
        for i in range(SCAN):
            _fresh()
            mask, objs = holo_layer(scan(still("cut"), i), rot, f"h{rot}_{i}")
            out.append(holo_item(f"{A}.holo.r{rot}" + (f".f{i}" if i else ""), FP, mask, objs))
        return [it for it in out if it]
    return run


def jobs(rots=range(4)):
    return [j for r in rots for j in [base_job(r), holo_job(r)] + [phase_job(r, ph) for ph in PHASES]]
