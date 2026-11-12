"""Recovery pod look study, round 3 (family `recovery`, preview only): three more silhouettes, built as round 1's
(recovery_study.py: the pod under the patient, `.front` over them).

  r1 ribcage: alien-grown tech: violet fluid inside a cage of bone ribs that spiral up from a root base and close over
     it in a bulb, magenta nodes along the ribs, a glowing sac on a vein at the side
  r2 medigel aquarium: a square glass tank turned face-on, amber gel, in a heavy hazard-striped frame; a grated catwalk
     on top with a hatch wheel and rail, a ladder down its side, reserve drums and a pump box on the deck
  r3 field lift: no glass: a free blob of fluid held between a floor emitter and a ceiling emitter on a curved spine,
     three white halo rings floating round it"""
import math

from .modkit import K
from .recovery_study import FP, cross, screen
from .recovery_study2 import fluid, lathe, path
from .research_kit import bar

FILM_A, SHINE_A = 80, 200
BUBBLES = ((-0.2, 0.55), (-0.14, 0.95), (0.21, 0.72), (0.16, 1.3), (-0.22, 1.55), (0.05, 1.82), (0.24, 1.08),
           (-0.04, 0.42), (0.1, 2.0), (-0.18, 1.2))
VIOLET = ("recPu", "recPuL", "recPuFilm", "recGlowP")
AMBER = ("recOr", "recOrL", "recOrFilm", "recGlowO")
TEAL = ("recFl", "recFlL", "recFilm", "recGlow")


def front_of(a, lim=0.1):
    """True for an angle round the axis on the camera's side."""
    return math.cos(a - math.pi / 4) > lim


def shine(streaks, bubbles=BUBBLES, size=0.045):
    def build():
        k = K("rec_shine", FP)
        for u, v, z0, z1, w, rz in streaks:
            k.box(u, v, z0, w, 0.01, z1 - z0, "recShine", rz=rz)
        for s, z in bubbles:                                           # (s runs across the screen: along u - v)
            k.box(s * 0.7 + 0.25, -s * 0.7 + 0.25, z, size, size, size * 0.8, "recShine")
        return k.build()
    return build


def round_streaks(r, z0, z1):
    return tuple(((r + 0.02) * math.cos(a), (r + 0.02) * math.sin(a), z0 + d0, z1 - d1, w, a + math.pi / 2)
                 for a, w, d0, d1 in ((1.75, 0.06, 0, 0), (1.45, 0.03, 0.2, 0.35), (-0.15, 0.03, 0.4, 0.05)))


def film_of(prof, ramp, sides=24):
    def build():
        k = K("rec_film", FP)
        lathe(k, ((prof[0][0] + 0.04, prof[0][1]),) + tuple(prof[1:]), ramp[2], ramp[2], sides, grow=0.012)
        return k.build()
    return build


# ---- r1: ribcage ----------------------------------------------------------------------------------------------------
R1_FLUID = ((0.28, 0.3), (0.4, 0.44), (0.7, 0.48), (1.9, 0.48), (2.12, 0.4), (2.28, 0.22))
RIB = ((0.12, 0.8), (0.45, 0.72), (0.95, 0.66), (1.5, 0.66), (1.95, 0.58), (2.28, 0.42), (2.48, 0.2), (2.56, 0.04))
RIBS = 7
BONE = ("recBoneL", "recBone", "recBoneD")


def ribs(k, front):
    for i in range(RIBS):
        a0 = i * math.tau / RIBS + 0.2
        pts = []
        for j, (z, r) in enumerate(RIB):
            a = a0 + 0.35 * j / (len(RIB) - 1)                              # a slight spiral
            pts.append((r * math.cos(a), r * math.sin(a), z))
        mid = pts[3]
        if front_of(math.atan2(mid[1], mid[0])) != front:
            continue
        for p, q in zip(pts, pts[1:]):
            bar(k, p, q, 0.1 if p[2] < 1.6 else 0.08, BONE[1])
        for j in (2, 4):                                                   # nodes on each rib
            p = pts[j]
            k.box(p[0] * 1.06, p[1] * 1.06, p[2] - 0.04, 0.07, 0.07, 0.08, "recGlowP")


def r1_back():
    k = K("rec_r1", FP)
    lathe(k, ((0.0, 0.92), (0.08, 0.86), (0.16, 0.7), (0.24, 0.52)), "recPuD", "recPu", 9)       # the root mound
    for i in range(9):                                                                          # roots
        a = i * math.tau / 9 + 0.1
        bar(k, (0.55 * math.cos(a), 0.55 * math.sin(a), 0.16), (0.98 * math.cos(a), 0.98 * math.sin(a), 0.0), 0.09,
            "recBoneD")
    k.cyl(0, 0, 0.22, 0.5, 0.06, "recBoneD", top="recBone", sides=14)
    fluid(k, R1_FLUID, VIOLET)
    ribs(k, False)
    return k.build() + sac(0.7, -0.66)                                      # the sac on its vein


def sac(u, v):
    k = K("rec_r1_sac", FP)
    k.cyl(u, v, 0.0, 0.2, 0.06, "recBoneD", top="recBone", sides=10)
    for z0, r0, z1, r1 in ((0.06, 0.16, 0.2, 0.22), (0.2, 0.22, 0.4, 0.22), (0.4, 0.22, 0.56, 0.14),
                           (0.56, 0.14, 0.64, 0.05)):
        k.cyl(u, v, z0, r0, z1 - z0, "recGlowP" if z0 == 0.2 else "recPuL", top="recPuL", sides=10, rtop=r1)
    path(k, ((u, v, 0.55), (u * 0.8, v * 0.8, 0.8), (u * 0.5, v * 0.5, 0.62), (0.3, -0.3, 0.3)), 0.06, "recPuD")
    return k.build()


def r1_top():
    k = K("rec_r1_top", FP)
    ribs(k, True)
    lathe(k, ((2.5, 0.08), (2.58, 0.17), (2.7, 0.15), (2.78, 0.04)), "recBone", "recBoneL", 10)   # the crown bulb
    k.cyl(0, 0, 2.6, 0.18, 0.03, "recGlowP", sides=10)
    return k.build()


# ---- r2: medigel aquarium -------------------------------------------------------------------------------------------
S2 = 1.1                                    # the tank's side
A2 = S2 / math.sqrt(2)                      # its corners on the axes: (+-A2, 0), (0, +-A2); the front face between
T0, T1 = 0.28, 2.3                          # (A2, 0) and (0, A2), face-on to the camera
Q = math.pi / 4
POSTS = ((A2 + 0.05, 0.0), (0.0, A2 + 0.05), (-(A2 + 0.05), 0.0), (0.0, -(A2 + 0.05)))
FRONT_POSTS = POSTS[:2]


def post(k, u, v, h=T1 + 0.12):
    k.box(u, v, 0.14, 0.16, 0.16, h - 0.14, "gmD", top="gm", rz=Q)
    for z in (0.3, 0.42, 1.95):
        k.box(u, v, z, 0.17, 0.17, 0.06, "hivis", rz=Q)


def edge(k, a, b, z, h, col="gmD", top="gm", w=0.12):
    bar(k, (*a, z), (*b, z), w, col)


def r2_back():
    k = K("rec_r2", FP)
    k.box(0, 0, 0.0, S2 + 0.5, S2 + 0.5, 0.06, "dark", rz=Q)
    k.box(0, 0, 0.06, S2 + 0.44, S2 + 0.44, 0.08, "gm", top="steelD", rz=Q)
    k.box(0, 0, 0.14, S2 + 0.12, S2 + 0.12, 0.14, "gmD", top="gm", rz=Q)
    k.box(0, 0, T0, S2, S2, T1 - T0, AMBER[0], top=AMBER[1], rz=Q)                        # the gel
    k.box(0, 0, T0, S2 + 0.01, S2 + 0.01, 0.05, AMBER[3], top=AMBER[3], rz=Q)
    for u, v in POSTS[2:]:
        post(k, u, v)
    for a, b in ((POSTS[2], POSTS[3]), (POSTS[2], POSTS[1]), (POSTS[3], POSTS[0])):        # back top beams
        edge(k, a, b, T1 + 0.06, 0.1)
    lu, lv = A2 / 2 + 0.17, -A2 / 2 - 0.17                                                # the ladder (right face)
    for d in (-0.13, 0.13):
        bar(k, (lu + d * 0.707, lv + d * 0.707, 0.14), (lu + d * 0.707, lv + d * 0.707, 2.3), 0.04, "steelL")
    for z in [0.35 + 0.22 * i for i in range(9)]:
        k.box(lu, lv, z, 0.26, 0.03, 0.03, "steel", rz=Q)
    for u, v in ((-0.66, 0.66), (-0.84, 0.4)):                                            # reserve drums
        k.cyl(u, v, 0.06, 0.15, 0.48, "recOr", top="hivis", sides=12)
        k.cyl(u, v, 0.14, 0.155, 0.04, "gmD", sides=12)
        k.cyl(u, v, 0.4, 0.155, 0.04, "gmD", sides=12)
    pu, pv = 0.66, -0.68                                                                   # the pump box
    k.box(pu, pv, 0.06, 0.34, 0.3, 0.46, "gmD", top="gm", bevel=0.015)
    screen(k, pu, pv + 0.155, 0.22, 0.26, 0.2)
    cross(k, pu + 0.18, pv, 0.3, face="u", s=0.6)
    path(k, ((pu - 0.1, pv + 0.1, 0.2), (0.3, -0.35, 0.2)), 0.07, "steelD")
    path(k, ((-0.5, -0.5, 0.06), (-0.5, -0.5, 2.3), (-0.2, -0.2, 2.3)), 0.07, "steelD")      # a feed line at the back
    return k.build()


def r2_film():
    k = K("rec_film", FP)
    k.box(0, 0, T0 + 0.04, S2 + 0.024, S2 + 0.024, T1 - T0 - 0.04, AMBER[2], top=AMBER[2], rz=Q)
    return k.build()


def r2_top():
    k = K("rec_r2_top", FP)
    for u, v in FRONT_POSTS:
        post(k, u, v)
    edge(k, FRONT_POSTS[0], FRONT_POSTS[1], T1 + 0.06, 0.1)                                # the front top beam
    edge(k, FRONT_POSTS[0], FRONT_POSTS[1], 0.24, 0.1, w=0.1)                              # and sill
    k.box(0, 0, T1 + 0.1, S2 + 0.36, S2 + 0.36, 0.06, "steelD", top="gmD", rz=Q)            # the catwalk grate
    for i in range(-4, 5):
        k.box(i * 0.11, -i * 0.11, T1 + 0.16, 0.02, S2 + 0.3, 0.01, "dark", rz=Q)
    k.cyl(0, 0, T1 + 0.16, 0.2, 0.05, "steel", top="steelL", sides=12)                      # the hatch
    for i in range(8):
        a = i * math.tau / 8
        k.box(0.16 * math.cos(a), 0.16 * math.sin(a), T1 + 0.24, 0.08, 0.03, 0.03, "hivis", rz=a + math.pi / 2)
    k.cyl(0, 0, T1 + 0.21, 0.03, 0.06, "steelD", sides=6)
    c = A2 + 0.2                                                                           # the rail, round the back
    corners = ((c, 0), (0, -c), (-c, 0), (0, c))
    for a, b in zip(corners, corners[1:]):
        for z in (T1 + 0.36, T1 + 0.56):
            bar(k, (*a, z), (*b, z), 0.03, "hivis")
        for p in (a, b):
            bar(k, (*p, T1 + 0.16), (*p, T1 + 0.58), 0.035, "steelL")
    return k.build()


# ---- r3: field lift -------------------------------------------------------------------------------------------------
R3_FLUID = ((0.26, 0.12), (0.32, 0.32), (0.46, 0.42), (0.7, 0.45), (1.9, 0.45), (2.1, 0.4), (2.22, 0.28),
            (2.28, 0.1))
RINGS = ((0.72, 0.64), (1.36, 0.68), (2.0, 0.62))
SPINE_D = (math.cos(math.radians(200)), math.sin(math.radians(200)))    # out to the screen's left, behind the axis
SPINE = tuple((r * SPINE_D[0], r * SPINE_D[1], z) for r, z in ((0.88, 0.1), (0.96, 0.9), (0.94, 1.8), (0.76, 2.5),
                                                               (0.4, 2.72), (0.0, 2.72)))


def halo(k, front):
    n = 26
    for z, r in RINGS:
        for i in range(n):
            a = (i + 0.5) * math.tau / n
            if (math.cos(a - Q) > 0) != front:
                continue
            c, s = math.cos(a), math.sin(a)
            k.box(r * c, r * s, z, 0.17, 0.06, 0.06, "plate", top="medWhite", rz=a + math.pi / 2)
            k.box((r - 0.035) * c, (r - 0.035) * s, z + 0.01, 0.16, 0.02, 0.04, "recGlow", rz=a + math.pi / 2)


def r3_back():
    k = K("rec_r3", FP)
    k.cyl(0, 0, 0.0, 0.95, 0.06, "dark", sides=16)
    k.cyl(0, 0, 0.06, 0.88, 0.08, "medWhite", top="plate", sides=16)
    k.cyl(0, 0, 0.14, 0.62, 0.05, "steelD", top="steel", sides=16)
    k.cyl(0, 0, 0.19, 0.3, 0.04, "recGlow", top="recGlow", sides=16, rtop=0.42)              # the floor emitter
    k.cyl(0, 0, 0.11, 0.885, 0.025, "cyan", sides=16)
    fluid(k, R3_FLUID, TEAL)
    halo(k, False)
    for p, q in zip(SPINE, SPINE[1:]):
        bar(k, p, q, 0.22, "medWhite")
    for p, q in zip(SPINE[:4], SPINE[1:4]):
        bar(k, (p[0] * 0.88, p[1] * 0.88, p[2]), (q[0] * 0.88, q[1] * 0.88, q[2]), 0.05, "cyan")
    u, v = SPINE[0][:2]
    k.box(u, v, 0.06, 0.42, 0.42, 0.22, "gmD", top="gm", rz=math.radians(200))
    screen(k, u * 0.95 + 0.12, v * 0.95 + 0.2, 1.05, 0.2, 0.26)                              # a readout on the spine
    return k.build()


def r3_top():
    k = K("rec_r3_top", FP)
    halo(k, True)
    k.cyl(0, 0, 2.5, 0.42, 0.04, "recGlow", top="steelD", sides=16, rtop=0.3)                # the ceiling emitter,
    k.cyl(0, 0, 2.54, 0.48, 0.1, "plate", top="medWhite", sides=16, rtop=0.36)               # flared down
    k.cyl(0, 0, 2.64, 0.22, 0.12, "steelD", top="steel", sides=12)
    for p, q in zip(SPINE[4:], SPINE[5:]):
        bar(k, p, q, 0.22, "medWhite")
    return k.build()


DESIGNS = {
    "r1": (r1_back, ((film_of(R1_FLUID, VIOLET), FILM_A), (shine(round_streaks(0.48, 0.5, 1.9)), SHINE_A),
                     (r1_top, 255))),
    "r2": (r2_back, ((r2_film, FILM_A), (shine(((A2 - 0.12, 0.15, 0.4, 2.1, 0.05, -Q),
                                                 (A2 - 0.24, 0.27, 0.6, 1.8, 0.03, -Q))), SHINE_A),
                     (r2_top, 255))),
    "r3": (r3_back, ((film_of(R3_FLUID, TEAL), FILM_A), (shine(()), SHINE_A), (r3_top, 255))),
}
