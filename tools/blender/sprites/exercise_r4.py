"""Exercise machine look study round 4 (family `exercise4`, preview only, r0): sculpted machines on the 1 x 2
footprint. Bodies are swept shells, not stacked primitives: `sweep` lofts a rounded (superellipse) section along a
smooth curve, its size changing as it goes, and the result is smooth shaded. The bunk's slate and red, off-white shells,
a few small lit points, on the family's own palette set (gym).

  w1 swoop bike: one swept chassis running low along the floor and curving up into the handlebar stem, a second sweep
     up to a sculpted saddle, a barrel hub in place of the flywheel
  w2 arc treadmill: a rounded deck that swells into a hood at the far end; two handrails sweep up out of the deck's
     sides and curl in to hold a console
  w3 press chair: a sculpted seat on a swept pedestal facing a rounded tower; two curved arms reach from the tower to
     grips either side of the rider

All in px of the footprint (u -16..16, v -32..32, z up); crew are about 59 px tall."""
import math

from . import core
from .bunk_study import _px
from .exercise_study import FP
from .research_kit import ZPX, Bench
from .shuttle_craft import smooth

# the family's own ramps (palette set "gym", selected alone) so smooth shading doesn't speckle between near shades
SHELL, SHELL_D, FRAME, FRAME_D, RAIL = "gymShell", "gymShellD", "gymSlate", "gymSlateD", "gymRail"
RUBBER_D, PAD, PAD_D, LIT = "gymRubber", "gymRed", "gymRedD", "gymLit"


def spline(ctrl, n=8):
    """Catmull-Rom through control points (tuples of any length; all values interpolate), n steps per span."""
    P = [ctrl[0]] + list(ctrl) + [ctrl[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(n):
            t = s / n
            out.append(tuple(0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t
                                    + (-a + 3 * b - 3 * c + d) * t ** 3) for a, b, c, d in zip(p0, p1, p2, p3)))
    out.append(tuple(ctrl[-1]))
    return out


def _norm(x):
    n = math.sqrt(sum(c * c for c in x)) or 1.0
    return tuple(c / n for c in x)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def sweep(k, ctrl, col, p=2.4, n=20, cap0=None, cap1=None, steps=8, side=(1.0, 0.0, 0.0)):
    """Loft a superellipse section along a Catmull-Rom curve. ctrl: (u, v, z, a, b) in px, a the half size across
    (horizontal, square to the path), b the other. Where the path runs straight up, a lies along `side`. Ends capped
    in cap0 / cap1 (default col)."""
    pts = spline(ctrl, steps)
    rings = []
    for i, (u, v, z, a, b) in enumerate(pts):
        q0, q1 = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        T = _norm((q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]))
        S = _cross(T, (0, 0, 1))
        S = _norm(S) if math.hypot(S[0], S[1]) > 1e-3 else side
        N = _cross(T, S)
        ring = []
        for j in range(n):
            t = (j + 0.5) * math.tau / n
            c, s = math.cos(t), math.sin(t)
            x, y = math.copysign(abs(c) ** (2 / p), c) * a, math.copysign(abs(s) ** (2 / p), s) * b
            w = [(u, v, z)[m] + x * S[m] + y * N[m] for m in range(3)]
            gx, gy = k.p(w[0] / 32, w[1] / 32)
            ring.append(core.G(gx, gy, w[2] / ZPX))
        rings.append(ring)
    for A, B in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            k.m.poly([A[i], A[j], B[j], B[i]], col, flip=True)
    k.m.poly(rings[0], cap0 or col, flip=True)
    k.m.poly(rings[-1][::-1], cap1 or col, flip=True)


def build(k):
    out = k.build()
    smooth(out[0])
    return out


def w1():
    k = Bench("ex_w1", FP)
    sweep(k, [(0, 27, 3, 8, 3), (0, 14, 3, 9, 3.5), (0, -4, 4, 8, 3.5), (0, -16, 12, 4, 3.5), (0, -21, 26, 3, 3),
              (0, -22, 36, 2.5, 2.5)], SHELL, p=2.8, cap0=SHELL_D)                     # chassis
    sweep(k, [(0, 14, 5, 3.5, 3), (0, 11, 14, 3, 2.6), (0, 8, 24, 2.6, 2.4)], SHELL)    # saddle stem
    sweep(k, [(0, 15, 26, 3, 2), (0, 9, 27, 5, 2.4), (0, 2, 26.5, 3.5, 2)], PAD, p=3)    # saddle
    sweep(k, [(-12, -17, 37, 1.3, 1.3), (-9, -21, 38, 1.4, 1.4), (0, -23, 37, 1.6, 1.6), (9, -21, 38, 1.4, 1.4),
              (12, -17, 37, 1.3, 1.3)], RAIL)                                           # handlebars
    for s in (-1, 1):
        sweep(k, [(s * 12.5, -18, 37, 1.6, 1.6), (s * 12, -13, 36.5, 1.6, 1.6)], RUBBER_D)   # grips
    sweep(k, [(-5, -6, 16, 6, 6), (-3, -6, 16, 9, 9), (3, -6, 16, 9, 9), (5, -6, 16, 6, 6)], FRAME, p=2.0,
          cap0=FRAME_D, cap1=FRAME_D)                                                    # barrel hub
    for s in (-1, 1):
        cap = [(s * 5, -6, 16, 2.5, 2.5), (s * 6, -6, 16, 2, 2)]
        sweep(k, cap if s > 0 else cap[::-1], LIT, p=2.0)                                # lit axle caps
        sweep(k, [(s * 6.5, -6, 16, 1, 1), (s * 6.5, -2, 11, 1, 1)], RAIL)              # crank arms
        sweep(k, [(s * 7, -4, 11, 1.2, 1), (s * 10, -2, 11, 1.2, 1)], RUBBER_D)          # pedals
    sweep(k, [(0, -24, 38, 3, 2), (0, -26, 41, 3, 2.2)], FRAME_D)                        # console
    _px(k, -1, 1, -25, -24, 41, 42, LIT)
    return build(k)


def w2():
    k = Bench("ex_w2", FP)
    sweep(k, [(0, 28, 3, 12, 2.5), (0, 0, 3, 12.5, 2.8), (0, -18, 3.5, 12.5, 3.2), (0, -25, 6, 12, 5.5),
              (0, -29, 7, 11, 5)], SHELL, p=4, cap0=SHELL_D)                             # deck swelling into a hood
    _px(k, -9, 9, -18, 27, 5, 6, RUBBER_D)                                              # belt
    for s in (-1, 1):
        sweep(k, [(s * 12, -8, 5, 1.8, 1.8), (s * 12.5, -16, 16, 1.8, 1.8), (s * 12.5, -22, 30, 1.8, 1.8),
                  (s * 11, -26, 38, 1.8, 1.8), (s * 4, -28, 42, 1.8, 1.8)], SHELL, p=2.4)   # handrail sweeps
        sweep(k, [(s * 12.6, -21, 28, 2, 2), (s * 12.6, -14, 30, 2, 2), (s * 12.4, -8, 30, 1.6, 1.6)],
              RUBBER_D)                                                                  # grips
    sweep(k, [(-6, -28, 42, 4, 3), (6, -28, 42, 4, 3)], FRAME_D, p=3)                   # console
    _px(k, -4, 4, -25, -24, 43, 44, LIT)
    _px(k, -12, 12, -24, -23, 4, 5, PAD)                                                # red line on the hood
    return build(k)


def w3():
    k = Bench("ex_w3", FP)
    sweep(k, [(0, -26, 0, 9, 6), (0, -26, 20, 8, 5), (0, -26, 44, 7, 4.5), (0, -26, 50, 5, 3.5),
              (0, -26, 52, 2, 1.5)], SHELL, p=3, cap0=SHELL_D)                           # tower
    _px(k, -1, 1, -21, -20, 34, 36, LIT)                                                # its lamp
    sweep(k, [(0, -22, 2, 7, 2), (0, 10, 2, 8, 2.2)], FRAME_D, p=4)                     # base sweep
    sweep(k, [(0, 8, 2, 4, 3), (0, 8, 10, 2.5, 2), (0, 8, 14, 3, 2.5)], FRAME_D)         # seat pedestal
    sweep(k, [(0, -2, 16, 6, 2), (0, 6, 15, 8, 2.6), (0, 14, 17, 7, 2.4)], PAD, p=3)     # seat
    sweep(k, [(0, 15, 17, 7, 2.4), (0, 17, 28, 7, 2.2), (0, 16, 40, 6, 2)], PAD, p=3)    # backrest
    sweep(k, [(0, 16, 17, 5, 2), (0, 18, 28, 5, 2), (0, 18, 38, 4, 2)], PAD_D, p=3)     # its shell
    for s in (-1, 1):
        sweep(k, [(s * 8, -25, 40, 2, 2), (s * 12, -18, 41, 2, 2), (s * 13, -8, 36, 1.8, 1.8),
                  (s * 12, -1, 31, 1.6, 1.6)], SHELL)                                    # curved arms
        sweep(k, [(s * 12, -1, 31, 2, 2), (s * 10, 2, 30, 2, 2)], RUBBER_D)              # grips
    return build(k)


DESIGNS = {"w1": w1, "w2": w2, "w3": w3}


def jobs():
    return [(f"module.exercise.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
