"""Exercise machine look study round 5 (family `exercise5`, palette set gym, preview only, r0): three new concepts on
the 1 x 2 footprint, built from round 4's swept shells (`sweep`) and turned bars (`hcyl`).

  v1 centrifuge wheel: a big running wheel standing on an A-frame, the crew running on rungs inside its rim
  v2 swim tank: a glass capsule of water lying on a cradle, the crew swimming in place against jets at the far end
  v3 sparring droid: a padded training robot on a gimbal post at the far end, arms up in guard, a mat in front

All in px of the footprint (u -16..16, v -32..32, z up); crew are about 59 px tall."""
import math

from .bunk_study import _px
from .exercise_r3 import hcyl
from .exercise_r4 import FRAME, FRAME_D, LIT, PAD, PAD_D, RAIL, RUBBER_D, SHELL, SHELL_D, build, sweep
from .exercise_study import FP
from .research_kit import Bench

GLASS, WATER = "gymGlass", "gymWater"


def loop(k, u, cv, cz, R, r, col, n=24, plane="vz"):
    """A torus: a round tube of radius r swept round a circle of radius R centred at (u, cv, cz), in the v-z plane
    ('vz') or flat ('uv')."""
    pts = []
    for i in range(n + 1):
        t = i * math.tau / n
        if plane == "vz":
            pts.append((u, cv + R * math.cos(t), cz + R * math.sin(t), r, r))
        else:
            pts.append((u + R * math.cos(t), cv + R * math.sin(t), cz, r, r))
    sweep(k, pts, col, p=2.0, n=10, steps=3)


def v1():
    k = Bench("ex_v1", FP)
    C, R = 31, 28                                                                  # wheel centre height, rim radius
    for s in (-1, 1):
        loop(k, s * 12, 0, C, R, 2, SHELL)                                         # the two rims
        loop(k, s * 12.5, 0, C, R - 2.5, 0.8, PAD)                                 # red line inside each
        for i in range(6):                                                         # spokes
            t = i * math.tau / 6 + 0.3
            sweep(k, [(s * 12, 0, C, 1, 1), (s * 12, R * math.cos(t), C + R * math.sin(t), 1, 1)], FRAME)
        sweep(k, [(s * 14, -16, 0, 2.5, 2), (s * 14, 0, C, 2, 2), (s * 14, 16, 0, 2.5, 2)], FRAME_D, p=3)  # A-frame
        hcyl(k, "u", s * 12, s * 16, 0, C, 3.5, FRAME, cap=FRAME_D)               # axle housings
        hcyl(k, "u", s * 16, s * 16.5, 0, C, 2, LIT)
    for i in range(30):                                                            # running rungs
        t = i * math.tau / 30
        hcyl(k, "u", -12, 12, R * math.cos(t), C + R * math.sin(t), 1, RAIL, sides=8)
    sweep(k, [(0, -18, 0, 15, 1.5), (0, 18, 0, 15, 1.5)], FRAME_D, p=5)            # base plate
    return build(k)


def v2():
    k = Bench("ex_v2", FP)
    g, f = k.part("glass"), k.part("fluid")
    sweep(k, [(0, -29, 3, 12, 3), (0, 29, 3, 12, 3)], FRAME_D, p=4)                # cradle
    for v in (-20, 0, 20):
        sweep(k, [(0, v - 2, 6, 12.5, 4), (0, v + 2, 6, 12.5, 4)], FRAME, p=3)     # saddles under the tank
    sweep(g, [(0, -27, 20, 13, 14), (0, 27, 20, 13, 14)], GLASS, p=3, n=28)       # the glass capsule
    sweep(f, [(0, -26, 17, 12, 10.5), (0, 26, 17, 12, 10.5)], WATER, p=5, n=28)   # water inside, a flat top
    for s in (-1, 1):
        sweep(k, [(0, s * 27, 20, 14, 15), (0, s * 30, 20, 13.5, 14.5)][::s], SHELL, p=3, n=28,
              cap0=SHELL_D, cap1=SHELL_D)                                          # end collars
    for u in (-6, 0, 6):
        _px(k, u - 1, u + 1, -27, -26, 14, 16, LIT)                                # jets at the far end
    sweep(k, [(0, 31, 0, 8, 2), (0, 31, 9, 8, 2)], FRAME_D, p=4)                   # entry step
    _px(k, -6, 6, 29, 30, 34, 36, PAD)                                             # red hatch handle on the collar
    return build(k)


def v3(chest=True, mat=True, name="ex_v3"):
    k = Bench(name, FP)
    V = -18                                                                        # the droid's v
    sweep(k, [(0, V, 0, 11, 11), (0, V, 3, 10, 10), (0, V, 6, 6, 6), (0, V, 8, 3, 3)], FRAME_D, p=2.0)   # weighted base
    sweep(k, [(0, V, 8, 2, 2), (0, V, 24, 2, 2)], RAIL)                            # post
    loop(k, 0, V, 24, 6, 1, FRAME, plane="uv")                                     # gimbal ring
    sweep(k, [(0, V, 24, 5, 3.5), (0, V, 30, 8, 5), (0, V, 40, 9, 5.5), (0, V, 46, 6, 4)], SHELL, p=2.6,
          cap0=SHELL_D)                                                            # torso
    if chest:
        sweep(k, [(0, V + 3, 30, 5, 2), (0, V + 4, 42, 6, 2.2)], PAD, p=3)         # chest pad
    sweep(k, [(0, V, 46, 2, 2), (0, V, 49, 2, 2)], FRAME_D)                        # neck
    sweep(k, [(0, V, 49, 4, 4), (0, V, 53, 5, 4.5), (0, V, 57, 3, 3), (0, V, 58, 1, 1)], SHELL, p=2.4)   # head
    sweep(k, [(-3, V + 4, 53, 1, 0.8), (3, V + 4, 53, 1, 0.8)], LIT)               # visor slit
    for s in (-1, 1):                                                              # arms up in guard
        sweep(k, [(s * 9, V, 42, 2.5, 2.5), (s * 12, V + 4, 34, 2.2, 2.2), (s * 8, V + 10, 42, 2.2, 2.2)], FRAME)
        sweep(k, [(s * 8, V + 9, 40, 3, 3), (s * 7, V + 12, 44, 4, 4), (s * 6, V + 14, 47, 3, 3)], PAD, p=2.2)
        sweep(k, [(s * 9, V, 43, 3.5, 3.5), (s * 10, V, 44, 3, 3)], SHELL, p=2.2)  # shoulders
    if mat:
        _px(k, -14, 14, -4, 30, 0, 1, RUBBER_D)                                    # mat
        _px(k, -14, 14, 28, 30, 0, 2, PAD_D)                                       # its red edge
        _px(k, -14, 14, -4, -2, 0, 2, PAD_D)
    return build(k)


DESIGNS = {"v1": v1, "v2": v2, "v3": v3}


def jobs():
    return [(f"module.exercise.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
