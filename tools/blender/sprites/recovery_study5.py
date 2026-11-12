"""Recovery pod look study, round 5 (family `recovery`, preview only): sleek medical, roomier tanks (radius R, up from
round 4's 0.42-0.48; taller to match, so the wider rim still clears the patient's head from the camera). Built as
round 1's (recovery_study.py: the pod under the patient, `.front` over them).

  t1 lantern: a wide glass drum between a stepped white base and a broad overhanging hat that lights the tank from
     above, four slim white rods round the back and sides
  t2 gem: an octagonal glass prism of pale mint fluid on a tiered octagonal plinth, under a faceted crown; light
     lines up the back edges, a slim pylon fused to one facet
  t3 alcove slab: a tall white slab with a rounded top stands behind the tank like a wall unit, a visor curving off it
     over the tank, displays set flush in its face"""
import math

from .modkit import K
from .recovery_study import FP
from .recovery_study2 import fluid, lathe
from .recovery_study3 import FILM_A, SHINE_A, film_of, round_streaks, shine
from .recovery_study4 import CLIN, FRONT, TS, base, quad, seam, shell
from .research_kit import bar

MINT = ("recMn", "recMnL", "recMnFilm", "recGlow")
R = 0.6
N = (math.cos(FRONT), math.sin(FRONT))             # toward the camera, in (u, v)


def at(a, r, z=0.0):
    return (r * math.cos(a), r * math.sin(a), z)


# ---- t1: lantern ----------------------------------------------------------------------------------------------------
T1_FLUID = ((0.28, 0.5), (0.34, R), (2.36, R), (2.42, 0.54))
RODS = tuple(FRONT + math.radians(d) for d in (62, 140, 220, 298))           # two front-side, two back


def t1_back():
    k = K("rec_t1", FP)
    base(k, 0.96)
    lathe(k, ((0.14, 0.82), (0.2, 0.8), (0.24, 0.72)), "medWhite", "plate", 40)
    k.cyl(0, 0, 0.17, 0.825, 0.02, "cyan", sides=40)
    k.cyl(0, 0, 0.24, 0.66, 0.06, "steel", top="steelL", sides=40)
    fluid(k, T1_FLUID, CLIN, 40)
    rods(k, False)
    return k.build()


def rods(k, front):
    for a in RODS:
        if (math.cos(a - FRONT) > 0) == front:
            bar(k, at(a, R + 0.08, 0.24), at(a, R + 0.08, 2.42), 0.07, "medWhite")
            bar(k, at(a, R + 0.125, 0.5), at(a, R + 0.125, 2.2), 0.02, "cyan")


def t1_top():
    k = K("rec_t1_top", FP)
    rods(k, True)
    k.cyl(0, 0, 2.4, 0.62, 0.025, "recGlow", top="recGlow", sides=40)               # the light down into the tank
    lathe(k, ((2.42, 0.8), (2.47, 0.82), (2.53, 0.78), (2.6, 0.62), (2.66, 0.42), (2.7, 0.2)), "medWhite", "plate",
          40)                                                                         # the hat
    k.cyl(0, 0, 2.44, 0.825, 0.02, "cyan", sides=40)
    k.cyl(0, 0, 2.7, 0.14, 0.05, "steel", top="steelL", sides=20)
    return k.build()


# ---- t2: gem --------------------------------------------------------------------------------------------------------
T2_FLUID = ((0.32, R), (2.4, R))
OCT = 8


def octa(k, z, r, h, col, top=None, rtop=None):
    k.cyl(0, 0, z, r, h, col, top=top, sides=OCT, rtop=rtop)


def t2_back(hide_pylon=False):
    k = K("rec_t2", FP)
    octa(k, 0.0, 0.92, 0.05, "dark")
    octa(k, 0.05, 0.96, 0.1, "medWhite", top="plate")
    octa(k, 0.15, 0.84, 0.08, "plate", top="medWhite", rtop=0.78)
    octa(k, 0.16, 0.845, 0.02, "cyan")
    octa(k, 0.23, 0.7, 0.09, "medWhite", top="plate", rtop=0.66)
    lathe(k, T2_FLUID, MINT[0], MINT[1], OCT)
    octa(k, 0.32, R + 0.006, 0.04, "recGlow", top="recGlow")
    for i in range(OCT):                                                          # the vertical edges
        a = math.pi / OCT + i * math.tau / OCT
        if math.cos(a - FRONT) < 0.3:
            bar(k, at(a, R + 0.02, 0.32), at(a, R + 0.02, 2.4), 0.05, "medWhite")
            bar(k, at(a, R + 0.04, 0.45), at(a, R + 0.04, 2.25), 0.02, "cyan")
    if hide_pylon:
        return k.build()
    a = FRONT - math.radians(112)                                                  # the pylon
    pu, pv, _ = at(a, 0.84)
    k.box(pu, pv, 0.23, 0.2, 0.2, 1.3, "medWhite", top="plate", rz=a, bevel=0.015)
    k.box(pu + 0.1 * N[0], pv + 0.1 * N[1], 0.9, 0.16, 0.02, 0.3, "dark", rz=a + math.pi / 2 - FRONT + math.pi / 4)
    k.box(pu + 0.11 * N[0], pv + 0.11 * N[1], 1.0, 0.1, 0.02, 0.02, "green", rz=a + math.pi / 2 - FRONT + math.pi / 4)
    k.box(pu + 0.11 * N[0], pv + 0.11 * N[1], 0.6, 0.08, 0.02, 0.08, "medRed", rz=a + math.pi / 2 - FRONT + math.pi / 4)
    return k.build()


def t2_top():
    k = K("rec_t2_top", FP)
    octa(k, 2.4, R + 0.08, 0.06, "steelD", top="steel")
    octa(k, 2.46, R + 0.18, 0.1, "medWhite", top="plate")
    octa(k, 2.49, R + 0.185, 0.02, "cyan")
    octa(k, 2.56, R + 0.12, 0.12, "plate", top="medWhite", rtop=0.36)                # the faceted crown
    octa(k, 2.68, 0.36, 0.06, "medWhite", top="plate", rtop=0.2)
    octa(k, 2.74, 0.12, 0.03, "recGlow", top="recGlow")
    return k.build()


def t2_film():
    k = K("rec_film", FP)
    lathe(k, ((0.36, R + 0.012), (2.4, R + 0.012)), MINT[2], MINT[2], OCT)
    return k.build()


# ---- t3: alcove slab ------------------------------------------------------------------------------------------------
T3_FLUID = ((0.28, 0.5), (0.34, R), (2.34, R), (2.4, 0.55))
SLAB_D, SLAB_T = -0.78, 0.16                        # the slab's front plane (along N from the axis), its thickness
SLAB_W, SLAB_TOP = 0.88, 2.15                       # its half width; where its rounded top begins


def slab_outline(n=16):
    xs = [(-SLAB_W, 0.0)] + [(-SLAB_W * math.cos(math.pi * i / n), SLAB_TOP + SLAB_W * 0.9 * math.sin(math.pi * i / n))
                             for i in range(n + 1)] + [(SLAB_W, 0.0)]
    return xs


def slab(k, d, t, outline, col, edge):
    """A flat slab in the screen's plane: outline (x along the screen, z), front face at d along N, t thick."""
    def p(x, z, dd):
        return (x * TS[0] + dd * N[0], x * TS[1] + dd * N[1], z)
    quad(k, [p(x, z, d) for x, z in outline], col, (N[0], N[1], 0))
    quad(k, [p(x, z, d - t) for x, z in outline], edge, (-N[0], -N[1], 0))
    for (x0, z0), (x1, z1) in zip(outline, outline[1:] + outline[:1]):
        out = (TS[0] * (z1 - z0), TS[1] * (z1 - z0), -(x1 - x0))
        quad(k, [p(x0, z0, d), p(x1, z1, d), p(x1, z1, d - t), p(x0, z0, d - t)], edge, out)


def t3_back():
    k = K("rec_t3", FP)
    base(k, 0.9)
    slab(k, SLAB_D, SLAB_T, slab_outline(), "medWhite", "plate")
    inset = [(x * 0.82, 0.25 + (z - 0.0) * 0.9) for x, z in slab_outline()]
    slab(k, SLAB_D + 0.012, 0.01, inset, "plate", "plate")                       # a recessed panel
    for s in (-1, 1):                                                           # light lines down its sides
        x = s * SLAB_W * 0.9
        bar(k, (x * TS[0] + (SLAB_D + 0.02) * N[0], x * TS[1] + (SLAB_D + 0.02) * N[1], 0.3),
            (x * TS[0] + (SLAB_D + 0.02) * N[0], x * TS[1] + (SLAB_D + 0.02) * N[1], SLAB_TOP), 0.03, "cyan")
    for x, z in ((-0.72, 1.55), (0.72, 1.55)):                                   # displays flush in its face,
        u, v = x * TS[0] + (SLAB_D + 0.02) * N[0], x * TS[1] + (SLAB_D + 0.02) * N[1]   # beside the tank
        k.box(u, v, z, 0.2, 0.012, 0.42, "dark", rz=-math.pi / 4)
        k.box(u, v, z + 0.3, 0.14, 0.02, 0.02, "green", rz=-math.pi / 4)
        k.box(u, v, z + 0.2, 0.1, 0.02, 0.02, "cyan", rz=-math.pi / 4)
        k.box(u, v, z + 0.1, 0.14, 0.02, 0.02, "green", rz=-math.pi / 4)
    k.cyl(0, 0, 0.14, 0.68, 0.12, "plate", top="medWhite", sides=40, rtop=0.64)
    fluid(k, T3_FLUID, CLIN, 40)
    return k.build()


def t3_top():
    k = K("rec_t3_top", FP)
    k.cyl(0, 0, 2.38, R + 0.04, 0.04, "steelD", top="steel", sides=40)
    k.cyl(0, 0, 2.36, R - 0.04, 0.02, "recGlow", top="recGlow", sides=40)
    shell(k, ((2.42, 0.72), (2.5, 0.7), (2.58, 0.6), (2.64, 0.4), (2.66, 0.0)), FRONT + math.radians(95),
          FRONT + math.radians(265), "medWhite", t=0.05, inner="steelL", edge="plate")       # the visor off the slab
    shell(k, ((2.42, 0.72), (2.5, 0.7), (2.58, 0.6), (2.64, 0.4), (2.66, 0.0)), FRONT - math.radians(95),
          FRONT + math.radians(95), "medWhite", t=0.05, inner="steelL", edge="plate")
    n = 30
    for i in range(n):
        a = (i + 0.5) * math.tau / n
        k.box(0.725 * math.cos(a), 0.725 * math.sin(a), 2.44, 0.16, 0.02, 0.02, "cyan", rz=a + math.pi / 2)
    return k.build()


DESIGNS = {
    "t1": (t1_back, ((film_of(T1_FLUID, CLIN, 40), FILM_A), (shine(round_streaks(R, 0.5, 2.2)), SHINE_A),
                     (t1_top, 255))),
    "t2": (t2_back, ((t2_film, FILM_A), (shine(round_streaks(R, 0.5, 2.2)[:2]), SHINE_A), (t2_top, 255))),
    "t3": (t3_back, ((film_of(T3_FLUID, CLIN, 40), FILM_A), (shine(round_streaks(R, 0.5, 2.2)), SHINE_A),
                     (t3_top, 255))),
}
