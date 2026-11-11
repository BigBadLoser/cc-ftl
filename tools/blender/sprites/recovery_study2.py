"""Recovery pod look study, round 2 (family `recovery`, preview only): three designs with a shape of their own, built as
round 1's (recovery_study.py: the pod under the patient, `.front` over them).

  q1 gantry capsule: a glass capsule with a domed top, no cap: a crane mast at the right reaches over it and grips its
     crown with a claw; an orange surgeon arm at the left works at the glass; ribbed hoses across the deck
  q2 bio-vat: an egg of green fluid on three splayed rust legs, a valve wheel on its neck, a bellows pump piped into it,
     drip bags on a pole: a scrapper's healing vat
  q3 scan prism: a six-sided crystal tank of blue fluid between three white fins leaning in to its cap, a scanner ring
     round it at knee height, a hologram of the patient beside it (the hurt leg red)"""
import math

from .modkit import K
from .recovery_study import FP, SIDES, Z0, cross, screen
from .research_kit import bar

TEAL = ("recFl", "recFlL", "recFilm", "recGlow")       # fluid side, top, front film, the light under it
GREEN = ("recGr", "recGrL", "recGrFilm", "recGlowG")
BLUE = ("recBl", "recBlL", "recBlFilm", "recGlowB")
CAPSULE = ((0.28, 0.44), (1.86, 0.44), (2.0, 0.4), (2.12, 0.3), (2.2, 0.14))             # (z, r) up the tank
EGG = ((0.3, 0.27), (0.5, 0.45), (0.8, 0.58), (1.15, 0.62), (1.5, 0.56), (1.85, 0.44), (2.1, 0.3), (2.26, 0.2))
HEX_R, HEX_Z1 = 0.47, 2.2
PRISM = ((Z0, HEX_R), (HEX_Z1, HEX_R))


def lathe(k, prof, col, top, sides=SIDES, grow=0.0):
    for (z0, r0), (z1, r1) in zip(prof, prof[1:]):
        k.cyl(0, 0, z0, r0 + grow, z1 - z0, col, top=top, sides=sides, rtop=r1 + grow)


def fluid(k, prof, ramp, sides=SIDES):
    lathe(k, prof, ramp[0], ramp[1], sides)
    k.cyl(0, 0, prof[0][0], prof[0][1] + 0.006, 0.05, ramp[3], top=ramp[3], sides=sides)


def film(prof, ramp, sides=SIDES):
    def build():
        k = K("rec_film", FP)
        lathe(k, ((prof[0][0] + 0.05, prof[0][1]),) + tuple(prof[1:]), ramp[2], ramp[2], sides, grow=0.012)
        return k.build()
    return build


def shine(streaks, bubbles):
    """Streaks down the glass (angle, r, width, z0, z1) and bubbles in front of the patient (across the tank, z)."""
    def build():
        k = K("rec_shine", FP)
        for a, r, w, z0, z1 in streaks:
            k.box((r + 0.02) * math.cos(a), (r + 0.02) * math.sin(a), z0, w, 0.01, z1 - z0, "recShine",
                  rz=a + math.pi / 2)
        for s, z in bubbles:                                           # (s runs across the screen: along u - v)
            k.box(s * 0.7 + 0.25, -s * 0.7 + 0.25, z, 0.03, 0.03, 0.025, "recShine")
        return k.build()
    return build


def path(k, pts, w, col):
    for a, b in zip(pts, pts[1:]):
        bar(k, a, b, w, col)


def hose(k, pts, r=0.045, col="gmD", rib="dark"):
    """A ribbed hose lying along pts: a bar with a collar every few px."""
    path(k, pts, r * 2, col)
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(math.dist(a, b) / 0.09))
        for i in range(n + 1):
            t = i / n
            k.box(*(a[j] + (b[j] - a[j]) * t for j in range(2)), a[2] + (b[2] - a[2]) * t - r * 1.3, r * 2.6, r * 2.6,
                  r * 2.6, rib, rz=math.atan2(b[1] - a[1], b[0] - a[0]))


def umbilical(k, ztop, col="dark"):
    """The patient's air line, down the back of the tank to the head."""
    path(k, ((0.0, -0.06, ztop), (-0.05, -0.16, 2.0), (-0.02, -0.14, 1.78)), 0.035, col)


STREAM = ((-0.22, 0.5), (-0.2, 0.8), (-0.24, 1.15), (-0.19, 1.5), (-0.23, 1.8), (0.2, 0.65), (0.24, 1.0), (0.18, 1.4),
          (0.22, 1.72), (0.02, 0.42), (-0.04, 2.0))


# ---- q1: gantry capsule ---------------------------------------------------------------------------------------------
MAST = (0.72, -0.72)


def q1_back():
    k = K("rec_q1", FP)
    k.cyl(0, 0, 0.0, 1.0, 0.1, "gmD", top="gm", sides=8)
    k.cyl(0, 0, 0.1, 0.66, 0.07, "steelD", top="steel", sides=SIDES)
    k.cyl(0, 0, 0.1, 0.665, 0.025, "hivis", sides=SIDES)
    k.cyl(0, 0, 0.17, 0.52, 0.11, "medWhite", top="plate", sides=SIDES, rtop=0.47)
    fluid(k, CAPSULE, TEAL)
    umbilical(k, 2.18)
    u, v = MAST                                                         # the crane mast
    k.box(u, v, 0.1, 0.5, 0.5, 0.4, "gmD", top="gm", bevel=0.02)
    k.box(u, v, 0.5, 0.51, 0.51, 0.07, "hivis")
    k.box(u, v, 0.57, 0.32, 0.32, 1.95, "medWhite", top="plate", bevel=0.015)
    k.box(u, v + 0.17, 1.2, 0.24, 0.03, 0.34, "gmD")
    screen(k, u, v + 0.19, 1.23, 0.2, 0.28)
    cross(k, u, v + 0.17, 0.75)
    k.cyl(u - 0.22, v + 0.22, 0.5, 0.045, 1.5, "steelL", top="steel", sides=8)             # its ram
    k.cyl(u - 0.22, v + 0.22, 0.5, 0.07, 0.6, "steelD", top="steel", sides=8)
    hose(k, ((u - 0.2, v + 0.3, 0.14), (0.5, 0.1, 0.14), (0.62, 0.42, 0.14), (0.42, 0.52, 0.14)))
    hose(k, ((u - 0.3, v + 0.1, 0.14), (0.15, -0.72, 0.14), (-0.3, -0.62, 0.14)), col="steelD")
    a = (-0.74, 0.7)                                                    # the surgeon arm
    k.cyl(*a, 0.1, 0.2, 0.12, "gmD", top="gm", sides=10)
    k.cyl(*a, 0.22, 0.13, 0.2, "steelD", top="steel", sides=10)
    sh, el, wr, tip = (a[0], a[1], 0.5), (-0.86, 0.6, 1.3), (-0.6, 0.5, 1.62), (-0.42, 0.4, 1.3)
    path(k, ((a[0], a[1], 0.4), sh), 0.12, "steelD")
    bar(k, sh, el, 0.13, "hivis")
    bar(k, el, wr, 0.1, "hivis")
    bar(k, wr, tip, 0.06, "steelL")
    for p, s in ((sh, 0.17), (el, 0.15), (wr, 0.12)):
        k.box(p[0], p[1], p[2] - s / 2, s, s, s, "steelD", top="steel", bevel=0.02)
    k.box(tip[0], tip[1], tip[2] - 0.04, 0.07, 0.07, 0.07, "recGlow")
    return k.build()


def q1_top():
    k = K("rec_q1_top", FP)
    u, v = MAST
    zt = 2.56
    k.box(u, v, zt - 0.12, 0.4, 0.4, 0.2, "gmD", top="gm", bevel=0.02)                    # the jib over the crown
    bar(k, (u, v, zt), (0.0, 0.0, zt), 0.16, "medWhite")
    bar(k, (u, v, zt - 0.1), (0.2, -0.2, zt - 0.1), 0.08, "hivis")
    k.cyl(0, 0, 2.2, 0.16, 0.12, "steelD", top="steel", sides=10)
    k.cyl(0, 0, 2.32, 0.1, zt - 2.36, "steelL", top="steel", sides=8)
    k.box(0, 0, zt - 0.1, 0.24, 0.24, 0.2, "gmD", top="gm", bevel=0.02)
    for a in (0.8, 2.9, 5.0):                                           # the claw's fingers down the dome
        c, s = math.cos(a), math.sin(a)
        path(k, ((0.12 * c, 0.12 * s, 2.3), (0.34 * c, 0.34 * s, 2.24), (0.42 * c, 0.42 * s, 2.02)), 0.07, "steelD")
    return k.build()


# ---- q2: bio-vat ----------------------------------------------------------------------------------------------------
PUMP = (0.7, -0.62)
POLE = (-0.74, 0.5)


def q2_back():
    k = K("rec_q2", FP)
    k.cyl(0, 0, 0.0, 0.8, 0.05, "dark", top="gmD", sides=10)                             # drip tray
    for a in (math.radians(100), math.radians(225), math.radians(350)):                 # three splayed legs
        c, s = math.cos(a), math.sin(a)
        foot, knee, hip = (0.96 * c, 0.96 * s, 0.0), (0.78 * c, 0.78 * s, 0.62), (0.4 * c, 0.4 * s, 0.36)
        k.box(foot[0], foot[1], 0.0, 0.22, 0.22, 0.06, "rustD", top="rust", rz=a)
        bar(k, foot, knee, 0.11, "rust")
        bar(k, knee, hip, 0.09, "rustD")
        k.box(knee[0], knee[1], knee[2] - 0.08, 0.16, 0.16, 0.16, "steelD", top="steel", rz=a)
    k.cyl(0, 0, 0.24, 0.4, 0.1, "rustD", top="rust", sides=SIDES)                        # the cradle ring
    k.cyl(0, 0, 0.1, 0.14, 0.16, "steelD", sides=8)                                     # drain
    fluid(k, EGG, GREEN)
    umbilical(k, 2.24)
    u, v = PUMP                                                         # the bellows pump
    k.box(u, v, 0.0, 0.46, 0.46, 0.5, "rust", top="rustD", bevel=0.02)
    k.box(u, v + 0.235, 0.12, 0.3, 0.02, 0.26, "gmD")
    k.box(u - 0.06, v + 0.25, 0.2, 0.12, 0.02, 0.12, "medWhite")                        # a gauge
    k.box(u - 0.06, v + 0.262, 0.24, 0.02, 0.012, 0.06, "medRed")
    k.box(u + 0.1, v + 0.25, 0.16, 0.05, 0.02, 0.05, "green")
    for i in range(6):                                                                  # the bellows
        w = 0.34 if i % 2 == 0 else 0.26
        k.box(u, v, 0.5 + i * 0.06, w, w, 0.06, "gmD" if i % 2 else "dark", top="gm")
    k.box(u, v, 0.86, 0.36, 0.36, 0.06, "steelD", top="steel")
    hose(k, ((u - 0.2, v + 0.2, 0.06), (0.3, -0.1, 0.06), (0.16, 0.0, 0.16)), col="rustD")
    u, v = POLE                                                         # drip bags on a pole
    k.cyl(u, v, 0.0, 0.14, 0.05, "steelD", top="steel", sides=8)
    k.cyl(u, v, 0.05, 0.03, 2.0, "steelL", sides=6)
    k.box(u, v, 2.02, 0.4, 0.035, 0.035, "steelL", rz=math.radians(-45))
    for d, col in ((-0.13, "recGr"), (0.13, "iceB")):
        bu, bv = u + d, v + d
        k.box(bu, bv, 1.68, 0.13, 0.07, 0.3, "glassL", bevel=0.025, rz=math.radians(-45))
        k.box(bu, bv, 1.7, 0.135, 0.075, 0.16, col, bevel=0.02, rz=math.radians(-45))
        path(k, ((bu, bv, 1.68), (bu + 0.05, bv - 0.05, 1.45), (-0.4, 0.28, 1.6)), 0.03, "recGrD")
    k.box(-0.2, -0.78, 0.0, 0.3, 0.3, 0.34, "rustD", top="rust", bevel=0.02)             # a spare canister
    return k.build()


def q2_top():
    k = K("rec_q2_top", FP)
    k.cyl(0, 0, 2.24, 0.25, 0.1, "rustD", top="rust", sides=12)                          # the neck
    k.cyl(0, 0, 2.34, 0.18, 0.08, "steelD", top="steel", sides=12)
    k.cyl(0, 0, 2.42, 0.04, 0.14, "steelL", sides=6)
    for i in range(12):                                                                 # the valve wheel
        a = i * math.tau / 12
        k.box(0.19 * math.cos(a), 0.19 * math.sin(a), 2.53, 0.11, 0.04, 0.04, "medRed", rz=a + math.pi / 2)
    for a in (0.3, 0.3 + math.pi / 2):
        k.box(0, 0, 2.535, 0.38, 0.03, 0.03, "medRed", rz=a)
    u, v = PUMP                                                         # the pump's line up into the neck
    path(k, ((u, v, 0.9), (u, v, 2.0), (0.4, -0.36, 2.42), (0.16, -0.14, 2.38)), 0.08, "rustD")
    return k.build()


# ---- q3: scan prism -------------------------------------------------------------------------------------------------
FINS = tuple(math.radians(a) for a in (135, 225, 315))
RING_Z, RING_R = 1.12, 0.68


def scan_ring(k, front):
    """The scanner ring's near half (front) or far half."""
    n = 28
    for i in range(n):
        a = (i + 0.5) * math.tau / n
        if (math.cos(a - math.pi / 4) > 0) != front:
            continue
        c, s = math.cos(a), math.sin(a)
        k.box(RING_R * c, RING_R * s, RING_Z, 0.17, 0.09, 0.1, "plate", top="medWhite", rz=a + math.pi / 2)
        k.box((RING_R - 0.05) * c, (RING_R - 0.05) * s, RING_Z + 0.03, 0.15, 0.02, 0.04, "recGlowB", rz=a + math.pi / 2)
        if i % 7 == 0:
            k.box((RING_R + 0.04) * c, (RING_R + 0.04) * s, RING_Z - 0.03, 0.1, 0.06, 0.16, "gmD", rz=a + math.pi / 2)


def q3_back():
    k = K("rec_q3", FP)
    k.cyl(0, 0, 0.0, 1.02, 0.05, "dark", sides=6)
    k.cyl(0, 0, 0.05, 1.06, 0.1, "medWhite", top="plate", sides=6)
    k.cyl(0, 0, 0.15, 0.82, 0.03, "gmD", top="dark", sides=6)
    k.cyl(0, 0, 0.18, 0.56, 0.08, "steelD", top="steel", sides=6)
    fluid(k, PRISM, BLUE, 6)
    umbilical(k, HEX_Z1)
    for a in FINS:                                                      # the fins, a light strip up each
        c, s = math.cos(a), math.sin(a)
        k.box(0.92 * c, 0.92 * s, 0.15, 0.3, 0.2, 0.16, "gmD", top="gm", rz=a)
        bar(k, (0.92 * c, 0.92 * s, 0.25), (0.62 * c, 0.62 * s, HEX_Z1 + 0.14), 0.15, "medWhite")
        bar(k, (0.86 * c, 0.86 * s, 0.5), (0.63 * c, 0.63 * s, HEX_Z1 - 0.2), 0.05, "cyan")
    scan_ring(k, False)
    hu, hv = -0.74, 0.74                                                # the hologram of the patient
    k.cyl(hu, hv, 0.15, 0.2, 0.08, "gmD", top="dark", sides=10)
    k.cyl(hu, hv, 0.23, 0.13, 0.02, "cyan", top="cyan", sides=10)
    rz = math.radians(-45)
    for du, z, w, h, col in ((0, 1.02, 0.1, 0.11, "cyan"), (0, 0.72, 0.19, 0.28, "cyan"), (-0.14, 0.72, 0.05, 0.26, "cyan"),
                             (0.14, 0.72, 0.05, 0.26, "cyan"), (-0.055, 0.38, 0.07, 0.32, "medRed"),
                             (0.055, 0.38, 0.07, 0.32, "cyan")):
        k.box(hu + du * 0.7, hv + du * 0.7, z, w, 0.012, h, col, rz=rz)
    pu, pv = 0.8, -0.3                                                  # a status pylon
    k.box(pu, pv, 0.15, 0.22, 0.22, 0.75, "medWhite", top="plate", bevel=0.015)
    screen(k, pu, pv + 0.115, 0.55, 0.16, 0.22)
    cross(k, pu, pv + 0.115, 0.3, s=0.7)
    return k.build()


def q3_top():
    k = K("rec_q3_top", FP)
    k.cyl(0, 0, HEX_Z1, HEX_R + 0.06, 0.07, "steelD", top="steel", sides=6)
    k.cyl(0, 0, HEX_Z1 + 0.07, HEX_R + 0.16, 0.1, "medWhite", top="plate", sides=6)
    k.cyl(0, 0, HEX_Z1 + 0.1, HEX_R + 0.165, 0.025, "recGlowB", sides=6)
    k.cyl(0, 0, HEX_Z1 + 0.17, 0.3, 0.06, "gmD", top="gm", sides=6)
    k.cyl(0, 0, HEX_Z1 + 0.23, 0.12, 0.04, "recGlowB", top="recGlowB", sides=6)
    scan_ring(k, True)
    return k.build()


def glass(r, z0, z1):
    return ((1.75, r, 0.06, z0, z1), (1.45, r, 0.03, z0 + 0.2, z1 - 0.35), (-0.15, r, 0.03, z0 + 0.4, z1 - 0.05))


# back, then the front layers (builder, alpha) from the patient outward
DESIGNS = {
    "q1": (q1_back, ((film(CAPSULE, TEAL), 64), (shine(glass(0.44, 0.5, 1.85), STREAM), 150), (q1_top, 255))),
    "q2": (q2_back, ((film(EGG, GREEN), 64), (shine(glass(0.6, 0.8, 1.45), STREAM), 150), (q2_top, 255))),
    "q3": (q3_back, ((film(PRISM, BLUE, 6), 64), (shine((), STREAM), 150), (q3_top, 255))),
}
