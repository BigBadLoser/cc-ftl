"""Recovery pod look study, round 8 (family `recovery`, preview only): the lantern (round 5's t1) with the field lift's
spine (round 3's r3), its detail on the object and its hologram the treatment itself. Built as round 1's
(recovery_study.py: the pod under the patient, `.front` over them), plus `under` layers composited into the pod.

  u1 spine lantern: the wide drum on its stepped base, a glass dome for a top (glass hides nothing, so the pod stays
     low: the patient floats at FLOAT, about 2.45 tall in all against round 5's 2.7); a white spine rises from a pump
     housing at the back-left, carries a conduit and a vitals screen, and arches over to hang the lantern hat above the
     dome; a console fascia on the plinth's face under the patient (a readout, a status light, buttons). The hologram
     is a scanner ring round the tank fed by a curtain of rays from the hat's rim; it sweeps the patient head to foot
     (`u1.fN`, FRAMES frames at the renderer's ANIM_FPS; `u1` is a still at chest height)."""
import math

from .modkit import K
from .recovery_study2 import fluid as fluid_col, lathe
from .recovery_study3 import FILM_A, SHINE_A, film_of, round_streaks, shine
from .recovery_study4 import CLIN, FRONT, base
from .recovery_study5 import N, R, at
from .recovery_study6 import UP, XS, add, rect
from .recovery_study7 import FILM, LIT
from .medbay import trace
from .research_kit import bar

HOLO = "holo"
FP8 = (2, 2)
FLOAT = 0.2                                         # the patient's feet
DOME = ((0.18, 0.5), (0.22, R), (1.92, R), (2.02, 0.56), (2.1, 0.44), (2.15, 0.26), (2.17, 0.06))
HAT_Z, HAT_R = 2.27, 0.44
SPINE_A = math.radians(160)                      # back-left, clear of the tank on screen
SPINE = tuple((r * math.cos(SPINE_A), r * math.sin(SPINE_A), z) for r, z in
              ((0.86, 0.3), (0.94, 0.9), (0.93, 1.6), (0.82, 2.24), (0.5, 2.5), (0.0, 2.52)))
RING_R = R + 0.08
SWEEP = (0.45, 0.8, 1.15, 1.5, 1.8, 1.5, 1.15, 0.8)            # the scanner ring's height per frame
STILL = 1.2


def front_of(a, lim=0.0):
    return math.cos(a - FRONT) > lim


def u1_back(fluid=True):
    k = K("rec_u1", FP8)
    base(k, 0.96)
    k.cyl(0, 0, 0.14, 0.7, 0.04, "steel", top="steelL", sides=40)
    if fluid:
        globals()["fluid_col"](k, DOME, CLIN, 40)
    for p, q in zip(SPINE[:4], SPINE[1:4]):                             # the spine's lower run
        bar(k, p, q, 0.22, "medWhite")
        bar(k, add(p, (0.1, (N[0], N[1], 0))), add(q, (0.1, (N[0], N[1], 0))), 0.035, "cyan")
    u, v, _ = SPINE[0]                                                  # its foot: a pump housing
    k.box(u, v, 0.0, 0.4, 0.4, 0.46, "medWhite", top="plate", rz=SPINE_A, bevel=0.02)
    k.box(u, v, 0.3, 0.41, 0.41, 0.02, "cyan", rz=SPINE_A)
    g = add((u, v, 0.0), (0.21, (N[0], N[1], 0)))
    rect(k, g, XS, UP, -0.09, 0.09, 0.08, 0.24, "dark", 0.002)          # its gauge
    rect(k, g, XS, UP, -0.075, 0.03, 0.1, 0.22, "recCl", 0.004)
    k.box(*at(SPINE_A, 0.7)[:2], 0.04, 0.3, 0.26, 0.24, "medWhite", top="plate", rz=SPINE_A, bevel=0.015)   # fused in
    s = add(SPINE[2], (0.13, (N[0], N[1], 0)))                          # a vitals screen on the spine
    rect(k, (s[0], s[1], 0), XS, UP, -0.08, 0.08, 1.05, 1.42, "dark", 0.002)
    trace(lambda a, b: rect(k, (s[0], s[1], 0), XS, UP, a - 0.006, a + 0.006, 1.32 + b - 0.006, 1.32 + b + 0.006,
                            "green", 0.005), [(-0.06, 0.0), (-0.02, 0.0), (-0.005, 0.04), (0.01, -0.03), (0.025, 0.0),
                                              (0.06, 0.0)], d=0.01)
    for i, (w, col) in enumerate(((0.11, "cyan"), (0.07, "recGlowO"), (0.04, "cyan"))):
        rect(k, (s[0], s[1], 0), XS, UP, -0.06, -0.06 + w, 1.1 + i * 0.05, 1.13 + i * 0.05, col, 0.005)
    O = (0.975 * N[0], 0.975 * N[1], 0.0)                               # the console fascia on the plinth's face
    k.box(*at(FRONT, 0.84)[:2], 0.0, 0.66, 0.26, 0.24, "medWhite", top="plate", rz=FRONT + math.pi / 2, bevel=0.015)
    rect(k, O, XS, UP, -0.3, 0.3, 0.025, 0.04, "cyan", 0.004)
    rect(k, O, XS, UP, -0.24, 0.1, 0.08, 0.2, "dark", 0.004)
    trace(lambda a, b: rect(k, O, XS, UP, -0.07 + a - 0.006, -0.07 + a + 0.006, 0.14 + b - 0.006, 0.14 + b + 0.006,
                            "green", 0.008), [(-0.15, 0.0), (-0.05, 0.0), (-0.02, 0.04), (0.01, -0.035), (0.04, 0.0),
                                              (0.15, 0.0)], d=0.012)
    for i, col in enumerate(("green", "cyan", "recGlowO")):
        rect(k, O, XS, UP, 0.14 + i * 0.05, 0.17 + i * 0.05, 0.12, 0.15, col, 0.008)
    return k.build()


def u1_top():
    k = K("rec_u1_top", FP8)
    for p, q in zip(SPINE[3:], SPINE[4:]):                              # the spine's arch over the dome
        bar(k, p, q, 0.22, "medWhite")
    bar(k, add(SPINE[3], (0.1, (N[0], N[1], 0))), add(SPINE[4], (0.06, (N[0], N[1], 0)), (0.08, UP)), 0.035, "cyan")
    lathe(k, ((HAT_Z, HAT_R), (HAT_Z + 0.05, HAT_R + 0.02), (HAT_Z + 0.1, HAT_R - 0.02), (HAT_Z + 0.16, 0.3),
              (HAT_Z + 0.2, 0.14)), "medWhite", "plate", 32)                     # the hat, hung from the arch
    k.cyl(0, 0, HAT_Z + 0.03, HAT_R + 0.022, 0.018, "cyan", sides=32)
    k.cyl(0, 0, HAT_Z - 0.03, HAT_R - 0.03, 0.035, LIT, top="steel", sides=32)        # its lit underside (the emitter)
    return k.build()


def emitters(n=16):
    return [(a, (HAT_R - 0.06) * math.cos(a), (HAT_R - 0.06) * math.sin(a)) for a in
            ((i + 0.5) * math.tau / n for i in range(n))]


def scan(h, front):
    """The scanner ring at height h (its near half or its far half), and the curtain of rays down to it from the hat's
    rim: lit at the sides, film elsewhere; none across the patient's front."""
    def build():
        k = K("rec_u1_scan", FP8)
        n = 40
        for i in range(n):
            a = (i + 0.5) * math.tau / n
            if front_of(a) != front:
                continue
            for dz, col in ((0.0, LIT), (0.05, LIT)):
                k.box(RING_R * math.cos(a), RING_R * math.sin(a), h + dz, 0.12, 0.018, 0.016, col, rz=a + math.pi / 2)
        for a, eu, ev in emitters():
            if front_of(a) != front or abs(math.sin(a - FRONT)) < 0.55:
                continue
            side = abs(math.sin(a - FRONT)) > 0.9
            bar(k, (eu, ev, HAT_Z - 0.01), (RING_R * math.cos(a), RING_R * math.sin(a), h + 0.05), 0.012,
                LIT if side else FILM)
        return k.build()
    return build


def design(h):
    return (u1_back, ((film_of(DOME, CLIN, 40), FILM_A), (shine(round_streaks(R, 0.4, 1.8)), SHINE_A),
                      (u1_top, 255), (scan(h, True), HOLO)), ((scan(h, False), HOLO),))


DESIGNS = {"u1": design(STILL), **{f"u1.f{i}": design(h) for i, h in enumerate(SWEEP)}}
