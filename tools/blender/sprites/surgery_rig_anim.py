"""The surgical rig's animation (surgery_rig.py draws a pose): a timeline of phases, each a function of t in [0, 1) to a
Pose. Loops (the stages: cut, open, close) are seamless; the rest play once: deploy (idle to cut: the boom swings over
the patient, the piston runs out, the cut's arms unfold), the swaps between stages (the outgoing tool folds as the next
unfolds) and stow (close to idle, deploy backwards).

Frames are FPS a second; PHASES gives each phase its frame count."""
import math

FPS = 8
PHASES = {"deploy": 18, "cut": 8, "swap.cut": 14, "open": 8, "swap.open": 14, "close": 8, "stow": 18}
SCAN = 40                                               # frames of one sweep of the console's scan line (its own loop)
STAGES = {"cut": ("laser", "cutter", "camera"), "open": ("cutter", "clamp", "camera"),
          "close": ("clamp", "suture", "camera")}
NEXT = {"cut": "open", "open": "close"}


class Pose:
    """hub (u, v, z); fold per arm (0 working, 1 folded; missing = folded); aim offsets per arm (u, v, z); jaw (the
    clamp's opening, 1 at rest); beam (the laser fires); on (lights); holo (the console is lit; None = off, else its scan
    line's place 0..1, which runs on its own clock: scan())."""

    def __init__(self, hub, fold=None, aim=None, jaw=1.0, beam=False, on=True, holo=0.0):
        self.hub, self.fold, self.aim = hub, fold or {}, aim or {}
        self.jaw, self.beam, self.on, self.holo = jaw, beam, on, holo


def ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def span(t, a, b):
    """t's progress through [a, b], eased."""
    return ease((t - a) / (b - a))


def hub_at(s, z):
    """The hub swung s of the way from idle to over the patient (about the column's axis), at height z."""
    from .surgery_rig import HUB_IDLE, HUB_ON
    c = (0.0, -0.04)
    a0, a1 = (math.atan2(h[1] - c[1], h[0] - c[0]) for h in (HUB_IDLE, HUB_ON))
    r0, r1 = (math.hypot(h[0] - c[0], h[1] - c[1]) for h in (HUB_IDLE, HUB_ON))
    a, r = a0 + (a1 - a0) * s, r0 + (r1 - r0) * s
    return (c[0] + r * math.cos(a), c[1] + r * math.sin(a), z)


def _z(s):
    from .surgery_rig import HUB_IDLE, HUB_ON
    return HUB_IDLE[2] + (HUB_ON[2] - HUB_IDLE[2]) * s


def stage(name, t):
    """A stage's loop at t: the tools' small working motions round the incision (u runs across the patient's belly)."""
    from .surgery_rig import HUB_ON
    w = math.tau * t
    fold = {k: 0.0 for k in STAGES[name]}
    if name == "cut":                                    # the laser draws the line, the cutter follows it, the camera tracks
        aim = {"laser": (0.07 * math.sin(w), 0.0, 0.0),
               "cutter": (0.07 * math.sin(w - 1.0), 0.0, 0.02 * (1 - abs(math.cos(w - 1.0)))),
               "camera": (0.04 * math.sin(w - 0.5), 0.0, 0.02 * math.cos(w))}
        return Pose(HUB_ON, fold, aim, beam=True)
    if name == "open":                                   # the clamp opens, grips and draws back; the cutter dabs
        aim = {"clamp": (0.0, 0.0, 0.035 * (1 - math.cos(w)) / 2),
               "cutter": (0.03 * math.cos(w), 0.0, -0.03 * max(0.0, math.sin(2 * w))),
               "camera": (0.02 * math.sin(w), 0.0, 0.015 * math.cos(w))}
        return Pose(HUB_ON, fold, aim, jaw=1.0 + 0.7 * (1 + math.sin(w + 1.2)) / 2)
    aim = {"suture": (0.07 * math.sin(w), 0.0, 0.05 * abs(math.sin(2 * w))),   # close: the needle stitches along the line
           "clamp": (0.0, 0.0, 0.01 * math.sin(w)),
           "camera": (0.05 * math.sin(w - 0.4), 0.0, 0.015 * math.cos(w))}
    return Pose(HUB_ON, fold, aim, jaw=0.8)


def pose(phase, t):
    """The rig at t (0..1) through a phase of PHASES (or 'idle')."""
    from .surgery_rig import HUB_IDLE, HUB_ON
    if phase == "idle":
        return Pose(HUB_IDLE, on=False, holo=None)
    if phase in STAGES:
        return stage(phase, t)
    n = PHASES[phase]
    loop = PHASES["cut"]
    if phase.startswith("swap."):                        # the outgoing tool folds, the incoming one unfolds after it,
        a = phase[5:]                                    # and the tools that stay keep working throughout
        b = NEXT[a]
        pa = stage(a, t * n / loop % 1.0)                # a's loop running on from its end
        pb = stage(b, (t - 1.0) * n / loop % 1.0)        # b's loop, arriving at its start as the swap ends
        out = (set(STAGES[a]) - set(STAGES[b])).pop()
        inn = (set(STAGES[b]) - set(STAGES[a])).pop()
        w = span(t, 0.2, 0.8)                            # the staying tools' work eases from a's motion to b's
        aim = {k: tuple(pa.aim[k][i] + (pb.aim[k][i] - pa.aim[k][i]) * w for i in range(3)) for k in set(pa.aim) & set(pb.aim)}
        aim[out], aim[inn] = pa.aim[out], pb.aim[inn]
        fold = {k: 0.0 for k in STAGES[b]}
        fold[out] = span(t, 0.0, 0.55)
        fold[inn] = 1.0 - span(t, 0.45, 1.0)
        jaw = pb.jaw if "clamp" == inn else pa.jaw + (pb.jaw - pa.jaw) * w
        return Pose(HUB_ON, fold, aim, jaw=jaw, beam=pa.beam)   # (the laser fires only while fully out: arm())
    d = t if phase == "deploy" else 1.0 - t             # stow plays deploy backwards
    s1, s2 = span(d, 0.0, 0.25), span(d, 0.19, 0.39)           # swing out, then the piston runs the ring down
    first = "cut" if phase == "deploy" else "close"
    fold = {k: 1.0 - span(d, 0.33 + 0.11 * i, 0.78 + 0.11 * i) for i, k in enumerate(STAGES[first])}   # the arms one by one,
    work = stage(first, ((t - 1.0) if phase == "deploy" else t) * n / loop % 1.0)  # each at work while it is out
    return Pose(hub_at(s1, _z(s2)), fold, work.aim, jaw=work.jaw, beam=work.beam, on=True, holo=0.0 if d > 0.2 else None)


def still(state):
    """A state's rest pose (its loop's first frame; idle folded by the column)."""
    return pose(state, 0.0)


def scan(P, tick):
    """P with its console's scan line at frame `tick` of the job (its own SCAN-frame sweep, so it never jumps between phases)."""
    if P.holo is not None:
        P.holo = tick % SCAN / SCAN
    return P


def timeline(loops=2, phases=("deploy", "cut", "swap.cut", "open", "swap.open", "close", "stow")):
    """The performance as (phase, t) frames: deploy, each stage looped `loops` times with the swaps between, stow."""
    out = []
    for ph in phases:
        n = PHASES[ph]
        reps = loops if ph in STAGES else 1
        out += [(ph, i / n) for _ in range(reps) for i in range(n)]
    return out
