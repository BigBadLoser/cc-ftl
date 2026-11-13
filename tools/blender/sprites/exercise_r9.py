"""Exercise look study round 9 (family `exercise9`, palette set gym, preview only, r0): the sparring droid turned to
face the camera square (45 degrees on the footprint), so both arms and the face show. Built in the droid's own frame
(x to its left-right on screen, y toward the camera, z up) and turned onto the footprint by `D`.

  v3j boxer: a dark head with a lit visor; white armoured upper arms on dark pins, dark forearms, red gloves up in guard
  v3k faceplate: a white head with a dark faceplate and lit slit; the arms on a dark yoke across the shoulders, bare
     twin-rod forearms
  v3l heavy: broad white pauldrons over a narrow waist, a dark head sunk between them with one lit eye, long arms
     reaching forward with the gloves toward the camera

All in px of the footprint (u -16..16, v -32..32, z up); crew are about 59 px tall."""
import math

from .exercise_r4 import FRAME, FRAME_D, LIT, PAD, RAIL, SHELL, SHELL_D, build, sweep
from .exercise_r5 import loop
from .exercise_study import FP
from .research_kit import Bench

V = -16                                                                            # the droid's centre on the footprint
TURN = [math.pi / 4]                                                               # its turn: 45 deg faces the camera,
                                                                                   # 0 faces +v (round 5's way)


def D(x, y, z, a=1.0, b=None):
    """Droid frame -> a sweep control point on the footprint."""
    c, s = math.cos(TURN[0]), math.sin(TURN[0])
    return (x * c + y * s, V + y * c - x * s, z, a, a if b is None else b)


def sw(k, pts, col, **kw):
    sweep(k, [D(*p) for p in pts], col, side=(math.cos(TURN[0]), -math.sin(TURN[0]), 0.0), **kw)


def turned(f, a, name):
    """f built at turn a (radians), under its own sprite name."""
    def g():
        TURN[0] = a
        try:
            return f(name)
        finally:
            TURN[0] = math.pi / 4
    return g


def body(k, torso=True):
    sweep(k, [(0, V, 0, 11, 11), (0, V, 3, 10, 10), (0, V, 6, 6, 6), (0, V, 8, 3, 3)], FRAME_D, p=2.0)   # base
    sweep(k, [(0, V, 8, 2, 2), (0, V, 24, 2, 2)], RAIL)                            # post
    loop(k, 0, V, 24, 6, 1, FRAME, plane="uv")                                     # gimbal ring
    if torso:
        sw(k, [(0, 0, 24, 5, 3.5), (0, 0, 30, 8, 5), (0, 0, 40, 9, 5.5), (0, 0, 46, 6, 4)], SHELL, p=2.6,
           cap0=SHELL_D)


def head(k, shell, z=49, face=None, eye="slit", r=5):
    sw(k, [(0, 0, z - 3, 2), (0, 0, z, 2)], FRAME_D)                               # neck
    sw(k, [(0, 0, z, r - 1, r - 1.5), (0, 0, z + 4, r, r - 0.5), (0, 0, z + 8, r - 2, r - 2), (0, 0, z + 9, 1)],
       shell, p=2.4)
    zc = z + 4
    if face:
        sw(k, [(r * 1.04 * math.sin(t), (r - 0.4) * math.cos(t), zc, 0.8, 2.6) for t in (-1.1, -0.55, 0, 0.55, 1.1)],
           face, p=3)
    if eye is None:
        pass
    elif eye == "slit":
        sw(k, [(r * 1.1 * math.sin(t), r * 0.98 * math.cos(t), zc + 0.5, 0.5, 0.7) for t in (-0.8, -0.4, 0, 0.4, 0.8)],
           LIT, p=2.0)
    else:
        sw(k, [(0, r - 0.8, zc, 1.6), (0, r + 0.3, zc, 1.4)], LIT, p=2.0)


def pin(k, x, y, z, r=2.2, w=1.6):
    sw(k, [(x - w, y, z, r), (x + w, y, z, r)], FRAME_D, p=2.0)


def glove(k, x, y, z, r=4):
    sw(k, [(x, y - 2, z - 1, r * 0.7), (x, y, z, r), (x, y + 2.5, z + 1, r * 0.6)], PAD, p=2.2)


def v3j(name="ex_v3j"):
    k = Bench(name, FP)
    body(k)
    head(k, FRAME_D)
    for s in (-1, 1):
        pin(k, s * 10, 0, 43, 3)                                                   # shoulder
        sw(k, [(s * 11, 0, 43, 3.2), (s * 12.5, 2, 38, 3), (s * 13, 4, 34, 2.4)], SHELL, p=2.4)   # armoured upper arm
        pin(k, s * 13, 4, 34)                                                      # elbow
        sw(k, [(s * 13, 4, 34, 1.8), (s * 10, 8, 40, 1.8)], FRAME_D)               # forearm
        glove(k, s * 8, 10, 43)
    return build(k)


def v3k():
    k = Bench("ex_v3k", FP)
    body(k)
    head(k, SHELL, face=FRAME_D)
    sw(k, [(-13, 0, 43, 2), (13, 0, 43, 2)], FRAME_D, p=2.0)                       # yoke across the shoulders
    for s in (-1, 1):
        sw(k, [(s * 12.5, 0, 43, 3.4), (s * 14, 0, 43, 3.4)], FRAME, p=2.0, cap0=FRAME_D, cap1=FRAME_D)   # pivot disc
        sw(k, [(s * 13, 0, 42, 2.2), (s * 13, 4, 34, 2.2)], SHELL)                 # upper arm
        pin(k, s * 13, 4, 34)                                                      # elbow
        for d in (-1, 1):                                                          # twin-rod forearm
            sw(k, [(s * 13 + d, 4, 34, 0.8), (s * 9 + d, 8, 40, 0.8)], RAIL)
        sw(k, [(s * 9.5, 7.5, 39, 2.2), (s * 9, 8.5, 41, 2.2)], FRAME_D)            # wrist collar
        glove(k, s * 8, 10, 43)
    return build(k)


def v3l():
    k = Bench("ex_v3l", FP)
    body(k, torso=False)
    sw(k, [(0, 0, 24, 4, 3), (0, 0, 30, 5, 4), (0, 0, 38, 8, 5), (0, 0, 44, 10, 5.5), (0, 0, 47, 6, 4)], SHELL,
       p=2.6, cap0=SHELL_D)                                                        # narrow waist, broad chest
    head(k, FRAME_D, z=46, eye="round", r=4.5)
    for s in (-1, 1):
        sw(k, [(s * 8, 0, 49, 2), (s * 11, 0, 49, 5), (s * 14, 0, 46, 4), (s * 15, 0, 42, 2)], SHELL, p=2.4)  # pauldron
        pin(k, s * 12, 0, 42, 2.6)                                                 # shoulder
        sw(k, [(s * 12, 0, 42, 2), (s * 12, 5, 33, 2)], FRAME)                     # upper arm
        pin(k, s * 12, 5, 33)                                                      # elbow
        sw(k, [(s * 12, 5, 33, 1.8), (s * 9, 12, 38, 1.8)], FRAME_D)               # forearm, reaching forward
        glove(k, s * 8, 14, 39, 4.2)
    return build(k)


DESIGNS = {"v3j": v3j, "v3k": v3k, "v3l": v3l,
           "v3j0": turned(v3j, 0.0, "ex_v3j0")}                                     # boxer, round 5's turn


def jobs():
    return [(f"module.exercise.{v}", FP, "prop", f) for v, f in DESIGNS.items()]


# ---- round 10: the boxer (v3j) with elbows that read and three new faces ----------------------------------------------
def boxer_arms(k):
    """Boxer arms with readable elbows: white upper arm, a big dark elbow pin with lit-grey caps and a white elbow
    guard behind it, a mid-slate forearm (so the pin sits between two tones), a dark wrist collar, the glove."""
    for s in (-1, 1):
        pin(k, s * 10, 0, 43, 3)                                                   # shoulder
        sw(k, [(s * 11, 0, 43, 3.2), (s * 12.5, 1.5, 38.5, 3), (s * 13, 3, 35.5, 2.2)], SHELL, p=2.4)  # upper arm
        sw(k, [(s * 11.2, 4, 34, 2.9), (s * 14.8, 4, 34, 2.9)], FRAME_D, p=2.0, cap0=RAIL, cap1=RAIL)   # elbow pin
        sw(k, [(s * 13, 3, 33, 2.4), (s * 13.5, 1, 30.5, 1.6), (s * 13.6, 0, 29.5, 0.5)], SHELL, p=2.2)  # elbow guard
        sw(k, [(s * 13, 5, 35, 2.2), (s * 10.5, 8, 39, 2)], FRAME)                 # forearm
        sw(k, [(s * 10.3, 8.2, 39.3, 2.5), (s * 9.5, 9.2, 40.8, 2.5)], FRAME_D)     # wrist collar
        glove(k, s * 8, 10, 43)


def face_t(k):
    """Dark helmet, a lit visor slit with a dark brow ridge over it and a vertical nose ridge splitting it (a T)."""
    head(k, FRAME_D)
    z = 53
    sw(k, [(5.4 * math.sin(t), 5.1 * math.cos(t), z + 2.2, 0.8, 0.7) for t in (-0.9, -0.45, 0, 0.45, 0.9)], FRAME,
       p=2.5)                                                                      # brow ridge
    sw(k, [(0, 5.2, z + 1.5, 0.7, 0.6), (0, 5.4, z - 3, 0.9, 0.6)], FRAME, p=2.5)  # nose ridge


def face_eyes(k):
    """White helmet with a dark face plate and two round lit eyes."""
    head(k, SHELL, face=FRAME_D, eye=None)
    for x in (-2, 2):
        sw(k, [(x, 5.0, 53, 1.1), (x, 5.8, 53, 0.9)], LIT, p=2.0)


def face_shield(k):
    """White helmet, a big dark glass face shield, a lit bar inside it, dark ear discs either side."""
    head(k, SHELL, eye=None)
    sw(k, [(5.4 * math.sin(t), 5.0 * math.cos(t), 52.5, 0.9, 3.4) for t in (-1.0, -0.5, 0, 0.5, 1.0)], FRAME_D,
       p=3.5)                                                                      # face shield
    sw(k, [(4.6 * math.sin(t), 5.7 * math.cos(t), 52.5, 0.5, 0.6) for t in (-0.5, -0.25, 0, 0.25, 0.5)], LIT, p=2.0)
    for s in (-1, 1):
        sw(k, [(s * 4.6, 0, 53, 2.4), (s * 6, 0, 53, 2.4)], FRAME_D, p=2.0, cap0=RAIL, cap1=RAIL)   # ear discs


def boxer2(face, name):
    def f(nm=name):
        k = Bench(nm, FP)
        body(k)
        face(k)
        boxer_arms(k)
        return build(k)
    return f


R10 = {"v3m": boxer2(face_t, "ex_v3m"), "v3n": boxer2(face_eyes, "ex_v3n"), "v3o": boxer2(face_shield, "ex_v3o")}
for _n, _f in R10.items():                                                         # at round 5's turn, as asked,
    DESIGNS[_n] = turned(_f, 0.0, f"ex_{_n}")
    DESIGNS[_n + "c"] = _f                                                         # and facing the camera
