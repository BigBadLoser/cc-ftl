"""Recovery pod look study, round 4 (family `recovery`, preview only): sleek medical, built as round 1's
(recovery_study.py: the pod under the patient, `.front` over them). Glossy white housings, clinical pale-cyan fluid,
thin light lines; each with its own silhouette.

  s1 halo frame: a glass capsule rounded at both ends, standing in a tall white elliptical ring set in the screen's plane
     (it rises from the base beside the patient and closes over their head), a light line round its inner face
  s2 tulip: three white petals rise round the back and sides of the tank, flaring a little, light seams in the gaps
     between them; a slim halo hangs over the tank between the petal tips
  s3 clamshell: one smooth egg, its back half a white shell and its front half glass, light seams down both edges where
     they meet, on a slim neck over a disc; a tablet kiosk at its side

`shell` builds smooth surfaces of revolution (an arc of a profile, with thickness) straight from faces."""
import math

from mathutils import Vector

from .core import G as GV
from .modkit import K
from .recovery_study import FP, cross, screen
from .recovery_study2 import fluid, lathe
from .recovery_study3 import BUBBLES, FILM_A, SHINE_A, film_of, round_streaks, shine
from .research_kit import bar

CLIN = ("recCl", "recClL", "recClFilm", "recGlow")
Q = math.pi / 4
FRONT = Q                                                   # the angle round the axis that faces the camera


def quad(k, pts, col, out):
    """A face through pts (local u, v, z), wound so its normal points along `out` (local u, v, z)."""
    P = [GV(*k.p(u, v), z) for u, v, z in pts]
    n = (P[1] - P[0]).cross(P[2] - P[0])
    o = GV(*k.p(out[0], out[1]), out[2]) - GV(*k.p(0, 0), 0)
    k.m.poly(P, col, flip=n.dot(o) < 0)


def shell(k, prof, a0, a1, col, t=0.04, n=None, inner=None, edge=None, arcs=None):
    """The arc a0..a1 (radians round the axis) of the profile prof [(z, r)], t thick: outer face in col, inner in
    `inner`, the cut edges in `edge`. arcs: an (a0, a1) per profile point instead (a petal narrowing to its tip)."""
    inner, edge = inner or col, edge or col
    arcs = arcs or [(a0, a1)] * len(prof)
    n = n or max(2, int(max(abs(b - a) for a, b in arcs) / 0.12))
    A = [[a + (b - a) * i / n for i in range(n + 1)] for a, b in arcs]

    def pt(a, z, r):
        return (r * math.cos(a), r * math.sin(a), z)
    for j, ((z0, r0), (z1, r1)) in enumerate(zip(prof, prof[1:])):
        L0, L1 = A[j], A[j + 1]
        ri0, ri1 = max(r0 - t, 0.0), max(r1 - t, 0.0)
        for i in range(n):
            m = (L0[i] + L0[i + 1] + L1[i] + L1[i + 1]) / 4
            out = (math.cos(m) * (z1 - z0), math.sin(m) * (z1 - z0), r0 - r1)
            quad(k, [pt(L0[i], z0, r0), pt(L0[i + 1], z0, r0), pt(L1[i + 1], z1, r1), pt(L1[i], z1, r1)], col, out)
            quad(k, [pt(L0[i], z0, ri0), pt(L0[i + 1], z0, ri0), pt(L1[i + 1], z1, ri1), pt(L1[i], z1, ri1)], inner,
                 tuple(-c for c in out))
        for e, s in ((0, -1), (n, 1)):                                  # the cut edges
            a = (L0[e] + L1[e]) / 2
            tan = (-math.sin(a) * s, math.cos(a) * s, 0)
            quad(k, [pt(L0[e], z0, r0), pt(L1[e], z1, r1), pt(L1[e], z1, ri1), pt(L0[e], z0, ri0)], edge, tan)
    for j, d in ((0, -1), (len(prof) - 1, 1)):                          # the end rims
        z, r = prof[j]
        if r > t:
            for b0, b1 in zip(A[j], A[j][1:]):
                quad(k, [pt(b0, z, r), pt(b1, z, r), pt(b1, z, r - t), pt(b0, z, r - t)], edge, (0, 0, d))


def seam(k, prof, a, col, w=0.035, out=0.01):
    """A light line down the profile at angle a."""
    pts = [((r + out) * math.cos(a), (r + out) * math.sin(a), z) for z, r in prof]
    for p, q in zip(pts, pts[1:]):
        bar(k, p, q, w, col)


def base(k, r=0.9, sides=32):
    k.cyl(0, 0, 0.0, r - 0.04, 0.04, "dark", sides=sides)
    lathe(k, ((0.04, r), (0.1, r - 0.02), (0.14, r - 0.1)), "medWhite", "plate", sides)
    k.cyl(0, 0, 0.07, r + 0.004, 0.02, "cyan", sides=sides)


# ---- s1: halo frame -------------------------------------------------------------------------------------------------
S1_FLUID = ((0.26, 0.2), (0.32, 0.36), (0.44, 0.43), (1.95, 0.43), (2.12, 0.38), (2.24, 0.26), (2.3, 0.08))
RING_C, RING_X, RING_Z = 1.5, 0.78, 1.0                      # the ring: its middle height, half width, half height
TS = (math.cos(-Q), math.sin(-Q))                           # the screen's left-right axis in (u, v)


def ring_pts(off=0.0, rin=0.0, z0=0.06, n=30):
    """The arch's centre line: straight up from z0 at the left, an elliptical top over the head, down to z0 at the
    right; rin in from it, off toward the camera. Points (u, v, z)."""
    x0, top = RING_X - rin, RING_Z - rin
    xz = [(-x0, z0)] + [(-x0 * math.cos(math.pi * i / n), RING_C + top * math.sin(math.pi * i / n))
                        for i in range(n + 1)] + [(x0, z0)]
    return [(x * TS[0] + off * 0.707, x * TS[1] + off * 0.707, z) for x, z in xz]


def halo_ring(k):
    pts = ring_pts()
    for p, q in zip(pts, pts[1:]):
        bar(k, p, q, 0.16, "medWhite")
    li = ring_pts(0.06, 0.07, z0=0.3)
    for p, q in zip(li, li[1:]):
        bar(k, p, q, 0.03, "cyan")
    for s in (-1, 1):                                                   # its feet
        x = s * RING_X
        k.box(x * TS[0], x * TS[1], 0.0, 0.3, 0.3, 0.14, "plate", top="medWhite", rz=-Q, bevel=0.02)


def s1_back():
    k = K("rec_s1", FP)
    base(k)
    k.cyl(0, 0, 0.14, 0.5, 0.08, "steel", top="steelL", sides=32)
    k.cyl(0, 0, 0.22, 0.46, 0.04, "medWhite", top="plate", sides=32)
    fluid(k, S1_FLUID, CLIN, 32)
    return k.build()


def s1_top():
    k = K("rec_s1_top", FP)
    halo_ring(k)
    x = RING_X + 0.02                                                   # a vitals strip on the ring's right side
    k.box(x * TS[0], x * TS[1], 1.15, 0.05, 0.22, 0.3, "gmD", rz=-Q)
    return k.build()


# ---- s2: tulip ------------------------------------------------------------------------------------------------------
S2_FLUID = ((0.26, 0.3), (0.32, 0.42), (2.0, 0.42), (2.14, 0.38), (2.22, 0.3))
PETAL = ((0.12, 0.66), (0.5, 0.58), (1.1, 0.54), (1.7, 0.58), (2.15, 0.72), (2.45, 0.88), (2.62, 0.98))
PETAL_HALF = tuple(math.radians(d) for d in (46, 44, 42, 38, 30, 18, 4))     # each petal narrows to a tip
PETALS = tuple(FRONT + math.pi + d for d in (-1.75, 0.0, 1.75))         # back, and either side
HALF = math.radians(42)


def s2_back():
    k = K("rec_s2", FP)
    base(k, 0.95)
    k.cyl(0, 0, 0.12, 0.58, 0.14, "plate", top="medWhite", sides=32, rtop=0.5)
    fluid(k, S2_FLUID, CLIN, 32)
    for c in PETALS:
        shell(k, PETAL, 0, 0, "medWhite", t=0.05, inner="steelL", edge="cyan", arcs=[(c - h, c + h) for h in PETAL_HALF])
        for s in (-1, 1):                                               # light seams in the gaps, on the tank
            a = c + s * (HALF + 0.17)
            if math.cos(a - FRONT) < 0.35:
                seam(k, ((0.4, 0.42), (2.0, 0.42)), a, "cyan", out=0.012)
    return k.build()


def s2_top():
    k = K("rec_s2_top", FP)
    k.cyl(0, 0, 2.24, 0.45, 0.02, "cyan", top="cyan", sides=32)          # the halo over the tank
    k.cyl(0, 0, 2.26, 0.47, 0.05, "plate", top="medWhite", sides=32)
    k.cyl(0, 0, 2.31, 0.3, 0.025, "medWhite", top="cyan", sides=32)
    for c in PETALS:                                                    # held by fine struts to the petals
        bar(k, (0.46 * math.cos(c), 0.46 * math.sin(c), 2.28), (0.7 * math.cos(c), 0.7 * math.sin(c), 2.18), 0.03,
            "steelL")
    return k.build()


# ---- s3: clamshell -------------------------------------------------------------------------------------------------
EGG = ((0.16, 0.26), (0.3, 0.5), (0.6, 0.64), (1.0, 0.68), (1.6, 0.67), (2.0, 0.62), (2.24, 0.53), (2.45, 0.4),
       (2.6, 0.22), (2.67, 0.0))
LO, HI = 1, 6                                       # the window between EGG[LO] and EGG[HI] (z 0.3 .. 2.24)
WIN = EGG[LO:HI + 1]
S3_FLUID = ((0.24, 0.3),) + tuple((z, max(r - 0.07, 0.02)) for z, r in EGG[1:-1]) + ((2.6, 0.08),)
OPEN = math.radians(50)                             # the window's half-arc round the front
NEAR = (FRONT - math.pi / 2, FRONT + math.pi / 2)   # the near half (drawn over the patient)
SH = dict(t=0.05, inner="steelL", edge="plate")


def s3_back():
    k = K("rec_s3", FP)
    base(k, 0.82)
    k.cyl(0, 0, 0.1, 0.16, 0.1, "steelL", top="steel", sides=24)                # the neck
    fluid(k, S3_FLUID, CLIN, 32)
    shell(k, EGG[:LO + 1], NEAR[1], NEAR[0] + 2 * math.pi, "medWhite", **SH)    # the far half below and above
    shell(k, EGG[HI:], NEAR[1], NEAR[0] + 2 * math.pi, "medWhite", **SH)        # the window
    shell(k, WIN, FRONT + OPEN, FRONT + 2 * math.pi - OPEN, "medWhite", **SH)   # round the window's sides and back
    ku, kv = -0.86, 0.32                                                         # the tablet kiosk
    k.cyl(ku, kv, 0.0, 0.14, 0.04, "medWhite", top="plate", sides=16)
    k.cyl(ku, kv, 0.04, 0.025, 0.95, "steelL", sides=8)
    k.box(ku, kv, 0.95, 0.06, 0.34, 0.24, "medWhite", ry=-0.5, rz=-0.3)
    k.box(ku + 0.03, kv, 0.97, 0.02, 0.3, 0.2, "cyan", ry=-0.5, rz=-0.3)
    return k.build()


def s3_film():
    k = K("rec_film", FP)
    shell(k, tuple((z, r - 0.02) for z, r in WIN), FRONT - OPEN, FRONT + OPEN, "recClFilm", t=0.01)
    return k.build()


def s3_top():
    """The shell's near half below and above the window, and the window's light rim."""
    k = K("rec_s3_top", FP)
    shell(k, EGG[:LO + 1], NEAR[0], NEAR[1], "medWhite", **SH)
    shell(k, EGG[HI:], NEAR[0], NEAR[1], "medWhite", **SH)
    for a in (FRONT - OPEN, FRONT + OPEN):
        seam(k, WIN, a, "cyan", w=0.04, out=0.005)
    for z, r in (WIN[0], WIN[-1]):
        n = 16
        for i in range(n):
            a = FRONT - OPEN + 2 * OPEN * (i + 0.5) / n
            k.box((r + 0.005) * math.cos(a), (r + 0.005) * math.sin(a), z - 0.015, 2 * OPEN * r / n * 1.1, 0.025,
                  0.03, "cyan", rz=a + math.pi / 2)
    return k.build()


DESIGNS = {
    "s1": (s1_back, ((film_of(S1_FLUID, CLIN, 32), FILM_A), (shine(round_streaks(0.43, 0.5, 1.9)), SHINE_A),
                     (s1_top, 255))),
    "s2": (s2_back, ((film_of(S2_FLUID, CLIN, 32), FILM_A), (shine(round_streaks(0.42, 0.5, 1.95)), SHINE_A),
                     (s2_top, 255))),
    "s3": (s3_back, ((s3_film, FILM_A), (shine(round_streaks(0.62, 0.7, 1.9)[:2]), SHINE_A),
                     (s3_top, 255))),
}
