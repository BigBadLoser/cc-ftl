"""The surgical rig's sprite family (`surgery_rig`, families.py; #311): per rotation n, all ids under module.surgery_rig.

  .r{n}.idle / .r{n}.active               the body (the column, flange and console projector; lit in surgery)
  .front.r{n}.idle                        the rest, folded by the column: boom, piston, halo and arms, drawn over the bed
  .front.r{n}.<phase>[.f{i}]              the front through each animation phase (surgery_rig_anim.PHASES: deploy, the
                                          three stage loops, the swaps between them and stow; frame 0 has no .f)
  .holo.r{n}[.f{i}]                       the console hologram, its scan line's SCAN-frame sweep (its own loop)
  module.surgery_rig                      r0 idle body (the plain id)

The same set again under module.surgery_rig.m (`.m.r{n}.idle`, `.m.front.r{n}...`, `.m.holo.r{n}...`): the rig mirrored
(surgery_rig.MK), for the bed's other long side. The plain set's halo reaches toward local +u, the mirrored one's toward
-u; the game picks the one whose halo reaches toward the bed's head (render/rigArt.ts).

The front is rendered with the body as a holdout ("over"), so it holds only what is in front of the column. Frames run at
surgery_rig_anim.FPS; the game picks them from the operation's progress."""
from . import core, post
from . import env_build as E
from .research_kit import holo_item
from .surgery_rig import build, face, holo_layer
from .surgery_rig_anim import PHASES, SCAN, pose, scan, still

A = "module.surgery_rig"
FP = (1, 1)
PAL = "surgery"


def _fresh():
    core.clear_scene_meshes()
    post.select(PAL)


def _item(sid, kind, objs):
    return E.crop_item(sid, FP, *E.render_sprite(sid, kind, objs))


def _front(sid, P, rot, hand):
    _fresh()
    b, f = build(P, rot, sid.replace(".", "_"), split=True, hand=hand)
    return _item(sid, "over", (f, f + b))


def _base(hand):
    return A if hand == 1 else A + ".m"


def base_job(rot, hand=1):
    """The body idle and lit, and the front folded by the column."""
    def run(rot=rot, hand=hand):
        face(rot, hand)
        a, out = _base(hand), []
        for st in ("idle", "active"):
            _fresh()
            b, f = build(still("idle" if st == "idle" else "cut"), rot, f"rig_body_{st}_{rot}", split=True, hand=hand)
            for o in f:                                  # (the scene renders whole: the front out of it)
                o.hide_render = True
            out.append(_item(f"{a}.r{rot}.{st}", "prop", b))
            if rot == 0 and st == "idle" and hand == 1:
                out.append(_item(A, "prop", b))
        out.append(_front(f"{a}.front.r{rot}.idle", still("idle"), rot, hand))
        return [it for it in out if it]
    return run


def phase_job(rot, ph, hand=1):
    """Every frame of one animation phase's front."""
    def run(rot=rot, ph=ph, hand=hand):
        face(rot, hand)
        n, a = PHASES[ph], _base(hand)
        return [it for it in (_front(f"{a}.front.r{rot}.{ph}" + (f".f{i}" if i else ""), pose(ph, i / n), rot, hand)
                              for i in range(n)) if it]
    return run


def holo_job(rot, hand=1):
    """The console hologram's scan sweep, the rig at work as its holdout."""
    def run(rot=rot, hand=hand):
        face(rot, hand)
        out, a = [], _base(hand)
        for i in range(SCAN):
            _fresh()
            mask, objs = holo_layer(scan(still("cut"), i), rot, f"h{rot}_{i}", hand)
            out.append(holo_item(f"{a}.holo.r{rot}" + (f".f{i}" if i else ""), FP, mask, objs))
        return [it for it in out if it]
    return run


def jobs(rots=range(4), hands=(1, -1)):
    return [j for h in hands for r in rots for j in [base_job(r, h), holo_job(r, h)] + [phase_job(r, ph, h) for ph in PHASES]]
