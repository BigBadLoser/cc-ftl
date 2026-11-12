"""Recovery pod look study, round 9 (family `recovery`, preview only): round 8's spine lantern (u1) with a tank that
reads as fluid and rays that carry on through it.

  u2  the fluid ends in a surface (SURF) just over the patient's head: its lit top and a bright meniscus round the
      glass, the surface's near half a film over the patient (so their head is under it); an air gap above under a
      faint glass dome; the column lit near the floor light; three streams of bubbles rise from vents in the floor (two
      behind the patient, baked into the pod, one at each front side over them), looping with the scanner sweep. The
      hologram is rendered with the fluid left out of its holdout, so the rays run down through dome and fluid; those
      behind the patient are baked into the pod."""
import math

from .modkit import K
from .recovery_study2 import lathe
from .recovery_study3 import FILM_A
from .recovery_study4 import CLIN, FRONT, base
from .recovery_study5 import N, R, at
from .recovery_study8 import FP8, HAT_R, HAT_Z, RING_R, STILL, front_of, u1_back, u1_top
from .recovery_study7 import FILM, LIT
from .research_kit import bar

HOLO = "holo"
SURF = 1.9                                          # the fluid's surface
FLUID = ((0.18, 0.5), (0.22, R), (0.5, R), (SURF, R))
GLASS = ((SURF, R + 0.012), (1.94, R + 0.012), (2.03, 0.57), (2.1, 0.46), (2.15, 0.28), (2.17, 0.06))
STREAMS = ((FRONT + math.radians(150), False), (FRONT + math.radians(205), False),       # (angle, in front)
           (FRONT + math.radians(68), True), (FRONT - math.radians(70), True))
GAP, SPAN = 0.26, 1.56                              # bubble spacing up a stream; the stream's height (6 gaps)
FRAMES = 16                                         # the loop: 4 s at the renderer's ANIM_FPS 4 (round 8 had 8)
LO, HI = 0.45, 1.8                                  # the scanner's sweep, foot to head and back, eased at the ends
SWEEP = tuple(LO + (HI - LO) * (1 - math.cos(math.tau * f / FRAMES)) / 2 for f in range(FRAMES))
RISE = GAP / 4                                      # bubbles rise a quarter gap a frame: 4 gaps a loop, so it closes


def tank(k, fluid=True):
    """The fluid column: lit near the floor light, a lit top, a meniscus round the glass at the surface."""
    if not fluid:
        return
    k.cyl(0, 0, 0.18, R, 0.32, "recClL", top="recClL", sides=40)
    k.cyl(0, 0, 0.5, R, SURF - 0.5, "recCl", top="recClL", sides=40)
    k.cyl(0, 0, 0.18, R + 0.005, 0.05, "recGlow", top="recGlow", sides=40)
    k.cyl(0, 0, SURF - 0.03, R + 0.004, 0.03, "recShine", top="recClL", sides=40)


def u2_back(fluid=True):
    """u1's pod with the round-9 tank (u1_back without its fluid, then the tank)."""
    objs = u1_back(fluid=False)
    k = K("rec_u2_tank", FP8)
    tank(k, fluid)
    return objs + (k.build() if fluid else [])


u2_back.mask = lambda: u2_back(fluid=False)        # the hologram's holdout: the pod without the fluid


def bubbles(f, front):
    def build():
        k = K("rec_u2_bubbles", FP8)
        for a, fr in STREAMS:
            if fr != front:
                continue
            for i in range(int(SPAN / GAP)):
                z = 0.3 + (i * GAP + f * RISE) % SPAN
                s = (0.06, 0.08, 0.05, 0.095, 0.065, 0.075)[i % 6]
                w = 0.03 * math.sin(i * 1.7 + f * math.tau / FRAMES * 2)     # a little wobble (2 a loop)
                r = 0.42 if not fr else 0.5
                k.cyl(r * math.cos(a) - w * math.sin(a), r * math.sin(a) + w * math.cos(a), z, s / 2, s * 0.8,
                      "recShine", top="recShine", sides=8)
        return k.build()
    return build


def surface_film():
    """The near half of the fluid: its film over the patient, the surface's near half included."""
    k = K("rec_u2_film", FP8)
    lathe(k, ((0.22, R + 0.012), (SURF, R + 0.012)), "recCl", "recCl", 40)           # teal, its top the surface
    return k.build()


def glass():
    """The dome over the air gap, and streaks down the glass."""
    k = K("rec_u2_glass", FP8)
    lathe(k, GLASS, "recShine", "recShine", 40)
    return k.build()


def streaks():
    k = K("rec_u2_streaks", FP8)
    for a, w, z0, z1 in ((1.75, 0.06, 0.45, 1.8), (1.45, 0.03, 0.7, 1.5), (-0.15, 0.03, 0.9, 1.85)):
        k.box((R + 0.02) * math.cos(a), (R + 0.02) * math.sin(a), z0, w, 0.01, z1 - z0, "recShine", rz=a + math.pi / 2)
    return k.build()


def meniscus():
    """The meniscus round the glass, near side: soft (its own faint layer), so it does not cut across the face."""
    k = K("rec_u2_meniscus", FP8)
    k.cyl(0, 0, SURF - 0.025, R + 0.016, 0.025, "recShine", sides=40)
    return k.build()


def emitters(n=16):
    return [(a, (HAT_R - 0.08) * math.cos(a), (HAT_R - 0.08) * math.sin(a)) for a in
            ((i + 0.5) * math.tau / n for i in range(n))]


def scan(h, front):
    """The scanner ring at h (its near or far half) and the rays down to it from the hat's lit underside, running
    through dome and fluid: the far ones baked into the pod; the near ones only at the sides (none across the patient)."""
    def build():
        k = K("rec_u2_scan", FP8)
        n = 40
        for i in range(n):
            a = (i + 0.5) * math.tau / n
            if front_of(a) != front:
                continue
            for dz in (0.0, 0.05):
                k.box(RING_R * math.cos(a), RING_R * math.sin(a), h + dz, 0.12, 0.018, 0.016, LIT, rz=a + math.pi / 2)
        for a, eu, ev in emitters():
            near = front_of(a)
            if near != front or (near and abs(math.sin(a - FRONT)) < 0.55):
                continue
            side = abs(math.sin(a - FRONT)) > 0.85
            bar(k, (eu, ev, HAT_Z - 0.02), (RING_R * math.cos(a), RING_R * math.sin(a), h + 0.05), 0.014,
                LIT if side else FILM)
        return k.build()
    return build


def design(h, f):
    return (u2_back,
            ((surface_film, 110), (glass, 22), (streaks, 200), (meniscus, 70), (bubbles(f, True), 230), (u1_top, 255),
             (scan(h, True), HOLO)),
            ((bubbles(f, False), 230), (scan(h, False), HOLO)))


DESIGNS = {"u2": design(STILL, 0), **{f"u2.f{i}": design(h, i) for i, h in enumerate(SWEEP)}}
