"""Exercise look study round 24 (family `exercise11`, palette set gym, preview only, r0 at round 5's turn): back to the
round-body sparring droid (V3t2 / V3t3: white ear plates, green eyes, dark arms) with the robot crew's details borrowed:
grey plating on the limbs, a thin amber seam round the torso, and in one take the robots' dark hinge at the elbow.

  v5a discs: V3t2's white joint discs, the amber seam, grey plates over the dark arms
  v5b clevis: V3t3's white clevis and elbow guard, the amber seam, grey plates
  v5c robot hinge: a dark hinge drum across the elbow with grey caps (the crew robots' joint), the amber seam, grey
     plates, the guard pushed forward a little off the chest

Droid frame in px (x across, y toward its front, z up), turned onto the footprint by exercise_r9.D."""
from .exercise_r4 import build
from .exercise_r9 import body, glove, head_plates, pin, sw, turned
from .exercise_study import FP
from .research_kit import Bench

SHELL, SHELL_D, DARK, DARK_L, MID, RAIL = "gymShell", "gymShellD", "gymSlateD", "gymRubber", "gymSlate", "gymRail"
ACCENT, EYE = "gymAmber", "gymEyeG"


def seam(k):
    sw(k, [(0, 0, 34.2, 9.3, 5.9), (0, 0, 36.2, 9.4, 6.0)], ACCENT, p=2.6)          # thin amber seam round the torso


def plated_arm(k, s, el=(13, 3, 33.5), wr=(10, 8, 40), fist=(8, 11, 44)):
    """A dark arm with grey plates: a dark core strut, a grey plate over the upper arm and the forearm (stopping short of
    the joints so the dark shows there), a white wrist collar, the glove."""
    e, w = (s * el[0], el[1], el[2]), (s * wr[0], wr[1], wr[2])
    sw(k, [(s * 11, 0, 43, 1.6), (s * 12.5, 1.5, 38, 1.6), (e[0], e[1] - 0.5, e[2] + 1.5, 1.5)], DARK)       # core
    sw(k, [(e[0], e[1] + 1, e[2], 1.5), (w[0], w[1], w[2], 1.5)], DARK)
    sw(k, [(s * 11.6, 0.4, 41, 2.4), (s * 12.6, 1.6, 37.5, 2.5), (s * 12.8, 2.2, 36, 2.2)], MID, p=3)       # upper plate
    m = [(a + b) / 2 for a, b in zip(e, w)]
    sw(k, [(e[0] + (m[0] - e[0]) * 0.3, e[1] + (m[1] - e[1]) * 0.3, e[2] + (m[2] - e[2]) * 0.3, 2.3),
           (*m, 2.5), (w[0] + (m[0] - w[0]) * 0.2, w[1] + (m[1] - w[1]) * 0.2, w[2] + (m[2] - w[2]) * 0.2, 2.1)],
       MID, p=3)                                                                   # forearm plate
    sw(k, [(w[0], w[1] + 0.2, w[2] + 0.3, 2.6), (s * (abs(w[0]) - 0.7), w[1] + 1.2, w[2] + 1.8, 2.6)], SHELL)  # wrist
    glove(k, s * fist[0], fist[1], fist[2])


def v5a(k):
    for s in (-1, 1):
        sw(k, [(s * 10, 0, 43, 3.6), (s * 12, 0, 43, 3.6)], SHELL, p=2.0, cap0=SHELL_D, cap1=SHELL_D)   # shoulder disc
        sw(k, [(s * 12, 0, 43, 1.3), (s * 12.6, 0, 43, 1.3)], DARK, p=2.0)
        plated_arm(k, s)
        sw(k, [(s * 13.6, 3, 33.5, 3.2), (s * 15.2, 3, 33.5, 3.2)], SHELL, p=2.0, cap0=SHELL_D, cap1=SHELL_D)  # elbow
        sw(k, [(s * 15.2, 3, 33.5, 1.2), (s * 15.8, 3, 33.5, 1.2)], DARK, p=2.0)


def v5b(k):
    for s in (-1, 1):
        pin(k, s * 10, 0, 43, 3)
        plated_arm(k, s)
        for x in (10.8, 15.2):
            sw(k, [(s * (x - 0.6), 3, 33.5, 2.8, 3.2), (s * (x + 0.6), 3, 33.5, 2.8, 3.2)], SHELL, p=3, cap0=SHELL_D,
               cap1=SHELL_D)                                                       # clevis cheeks
        sw(k, [(s * 10, 3, 33.5, 1), (s * 16, 3, 33.5, 1)], DARK, p=2.0)          # pin
        sw(k, [(s * 13, 1.5, 32, 2.2, 1.6), (s * 13, -1, 30.5, 1.2, 1), (s * 13, -2, 30, 0.4)], SHELL, p=2.4)  # guard


def v5c(k):
    el, wr, fist = (13, 5, 34), (10, 11, 40), (8, 14, 43.5)                        # guard pushed forward a little
    for s in (-1, 1):
        pin(k, s * 10, 0, 43, 3)
        sw(k, [(s * 9.5, 0, 46, 3, 2.5), (s * 12, 0, 46.5, 3.5, 3), (s * 14, 0, 45, 2.6, 2.4)], SHELL, p=3)  # pauldron
        plated_arm(k, s, el, wr, fist)
        sw(k, [(s * 11.2, el[1], el[2], 2.6), (s * 14.8, el[1], el[2], 2.6)], DARK_L, p=2.0, cap0=MID, cap1=MID)  # hinge


def droid(arms, name):
    def f(nm=name):
        k = Bench(nm, FP)
        body(k)
        seam(k)
        head_plates(k, EYE)
        arms(k)
        return build(k)
    return f


DESIGNS = {n: turned(droid(a, f"ex_{n}"), 0.0, f"ex_{n}") for n, a in (("v5a", v5a), ("v5b", v5b), ("v5c", v5c))}


def jobs():
    return [(f"module.exercise.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
