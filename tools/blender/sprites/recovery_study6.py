"""Recovery pod look study, round 6 (family `recovery`, preview only): round 5's lantern and gem with working detail,
the housings kept clean. Built as round 1's (recovery_study.py: the pod under the patient, `.front` over them); the
hologram is its own translucent front layer.

  t1b lantern+: feed pipes up both sides into the hat, a vent ring and a beacon on the hat, a filter canister with a
      fluid gauge piped into the base (right), a console kiosk on a stem (left) projecting the patient's vitals as a
      hologram: a body outline, the hurt arm red, a heartbeat, bars
  t2b gem+: the pylon (right) made a control column with a side screen and a projector on top; over it a hologram of
      the patient turning (a body outline, the hurt leg red) in a ring; three fine pipes up the left facet from a
      junction box, a rack of three medicine cartridges, a floor conduit, a vent ring and an emitter on the crown

`plate` and `rect` build flat panels in any plane (a tilted console face, a hologram sheet)."""
import math

from .modkit import K
from .recovery_study import FP, cross
from .recovery_study3 import FILM_A, SHINE_A, film_of, round_streaks, shine
from .recovery_study4 import CLIN, FRONT, TS, quad
from .recovery_study5 import MINT, R, N, RODS, T1_FLUID, at, octa, t1_back, t1_top, t2_back, t2_film, t2_top
from .research_kit import bar
from .medbay import trace

HOLO_A = 165


def add(a, *vs):
    return tuple(a[i] + sum(s * v[i] for s, v in vs) for i in range(3))


def cross3(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def normal(X, Y):
    n = cross3(X, Y)
    if n[0] * N[0] + n[1] * N[1] + n[2] * 0.3 < 0:                    # toward the camera
        n = tuple(-c for c in n)
    L = math.sqrt(sum(c * c for c in n))
    return tuple(c / L for c in n)


def rect(k, O, X, Y, x0, x1, y0, y1, col, off=0.0):
    """A flat rectangle on the plane O + X x + Y y, off along its normal (toward the camera)."""
    n = normal(X, Y)
    quad(k, [add(O, (x, X), (y, Y), (off, n)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))], col, n)


def plate(k, O, X, Y, w, h, t, col, edge=None):
    """A slab: x -w/2 .. w/2, y 0 .. h on the plane O + X x + Y y, t thick behind it."""
    edge = edge or col
    n = normal(X, Y)
    P = lambda x, y, d: add(O, (x, X), (y, Y), (d, n))                # noqa: E731
    c = ((-w / 2, 0), (w / 2, 0), (w / 2, h), (-w / 2, h))
    quad(k, [P(x, y, 0) for x, y in c], col, n)
    quad(k, [P(x, y, -t) for x, y in c], edge, tuple(-v for v in n))
    for (x0, y0), (x1, y1) in zip(c, c[1:] + c[:1]):
        out = add((0, 0, 0), ((y1 - y0), X), (-(x1 - x0), Y))
        quad(k, [P(x0, y0, 0), P(x1, y1, 0), P(x1, y1, -t), P(x0, y0, -t)], edge, out)


def pipe(k, pts, w=0.06, col="steelL", collar="steelD", every=0.45):
    for p, q in zip(pts, pts[1:]):
        bar(k, p, q, w, col)
        n = int(math.dist(p, q) / every)
        for i in range(1, n + 1):
            t = i / (n + 1)
            c = add(p, (t, tuple(q[j] - p[j] for j in range(3))))
            k.box(c[0], c[1], c[2] - 0.025, w * 1.6, w * 1.6, 0.05, collar)


def body_holo(k, O, X, Y, s, hurt):
    """A body outline (head, torso, arms, legs) on the plane, s tall; the part `hurt` red."""
    parts = {"head": (-0.07, 0.07, 0.84, 1.0), "torso": (-0.13, 0.13, 0.48, 0.8), "armL": (-0.21, -0.15, 0.46, 0.8),
             "armR": (0.15, 0.21, 0.46, 0.8), "legL": (-0.12, -0.02, 0.0, 0.46), "legR": (0.02, 0.12, 0.0, 0.46)}
    for name, (x0, x1, y0, y1) in parts.items():
        col = "medRed" if name == hurt else "recGlow"
        lw = 0.012 / s
        for a0, a1, b0, b1 in ((x0, x1, y0, y0 + lw), (x0, x1, y1 - lw, y1), (x0, x0 + lw, y0, y1), (x1 - lw, x1, y0, y1)):
            rect(k, O, X, Y, a0 * s, a1 * s, b0 * s, b1 * s, col)
        if name == hurt:
            rect(k, O, X, Y, x0 * s, x1 * s, y0 * s, y1 * s, "medRed", -0.004)


UP = (0.0, 0.0, 1.0)
XS = (TS[0], TS[1], 0.0)                                              # screen right


# ---- t1b ------------------------------------------------------------------------------------------------------------
KIOSK = (-0.74, 0.6)
TILT = math.radians(38)
KY = (-math.sin(TILT) * N[0], -math.sin(TILT) * N[1], math.cos(TILT))  # up the console face, leaning back
SIDE = tuple(FRONT + s * math.radians(108) for s in (1, -1))          # the feed pipes: screen left and right


def t1b_extra():
    k = K("rec_t1b", FP)
    for a in SIDE:                                                   # feed pipes up the sides into the hat
        k.box(*at(a, 0.86)[:2], 0.12, 0.16, 0.16, 0.1, "steelD", top="steel", rz=a)
        pipe(k, [at(a, 0.86, 0.2), at(a, 0.86, 2.28), at(a, 0.78, 2.42)], w=0.07, col="medWhite", collar="steel")
        k.box(*at(a, 0.86)[:2], 1.15, 0.13, 0.13, 0.1, "cyan", rz=a)                   # a lit flow sleeve
    u, v = 0.82, -0.6                                                # the filter canister
    k.cyl(u, v, 0.0, 0.17, 0.06, "steelD", top="steel", sides=16)
    k.cyl(u, v, 0.06, 0.15, 0.72, "medWhite", top="plate", sides=16)
    k.cyl(u, v, 0.78, 0.12, 0.06, "steel", top="steelL", sides=16)
    k.cyl(u, v, 0.84, 0.04, 0.06, "steelD", top="steel", sides=8)
    gx = add((u, v, 0.0), (0.15, (N[0], N[1], 0)))
    rect(k, gx, XS, UP, -0.035, 0.035, 0.16, 0.66, "dark")           # its gauge: a fluid column, half full
    rect(k, gx, XS, UP, -0.025, 0.025, 0.17, 0.44, "recCl", 0.003)
    for i in range(4):
        rect(k, gx, XS, UP, 0.04, 0.07, 0.2 + i * 0.13, 0.215 + i * 0.13, "steelL", 0.002)
    pipe(k, [(u - 0.1, v + 0.06, 0.62), (0.55, -0.4, 0.62), (0.5, -0.38, 0.14)], w=0.05)
    ku, kv = KIOSK                                                   # the console kiosk
    k.cyl(ku, kv, 0.0, 0.16, 0.04, "medWhite", top="plate", sides=16)
    k.cyl(ku, kv, 0.04, 0.035, 0.82, "steelL", top="steel", sides=8)
    O = (ku, kv, 0.86)
    plate(k, O, XS, KY, 0.42, 0.28, 0.05, "medWhite", "plate")
    rect(k, O, XS, KY, -0.18, 0.18, 0.04, 0.24, "dark", 0.004)
    trace(lambda a, b: rect(k, O, XS, KY, a - 0.006, a + 0.006, 0.17 + b - 0.006, 0.17 + b + 0.006, "green", 0.008),
          [(-0.15, 0.0), (-0.07, 0.0), (-0.03, 0.05), (0.0, -0.04), (0.03, 0.0), (0.15, 0.0)], d=0.012)
    for i, col in enumerate(("cyan", "cyan", "recGlowO", "medRed")):
        rect(k, O, XS, KY, -0.15 + i * 0.05, -0.12 + i * 0.05, 0.07, 0.11 + 0.025 * (3 - i), col, 0.008)
    k.box(ku, kv, 1.06, 0.05, 0.05, 0.03, "recGlow")                  # the projector lens on its top edge
    path_c = [(ku + 0.1, kv - 0.1, 0.02), (-0.5, 0.35, 0.02), (-0.4, 0.3, 0.1)]      # a floor conduit to the base
    for p, q in zip(path_c, path_c[1:]):
        bar(k, p, q, 0.06, "gmD")
    return k.build()


def t1b_back():
    return t1_back() + t1b_extra()


def t1b_top():
    objs = t1_top()
    k = K("rec_t1b_top", FP)
    for i in range(16):                                              # a vent ring round the hat
        a = (i + 0.5) * math.tau / 16
        k.box(0.81 * math.cos(a), 0.81 * math.sin(a), 2.485, 0.1, 0.02, 0.02, "steelD", rz=a + math.pi / 2)
    k.cyl(0.3, -0.3, 2.62, 0.05, 0.12, "steelL", top="steel", sides=8)  # a beacon
    k.cyl(0.3, -0.3, 2.74, 0.045, 0.04, "recGlow", top="recGlow", sides=8)
    return objs + k.build()


HOLO_O = (KIOSK[0] - 0.05 * N[0], KIOSK[1] - 0.05 * N[1], 1.16)


def t1b_sheet():
    """The hologram's sheet and the beam up to it from the lens: faint."""
    k = K("rec_t1b_sheet", FP)
    rect(k, HOLO_O, XS, UP, -0.25, 0.25, 0.0, 0.78, "recFlK")
    ku, kv = KIOSK
    quad(k, [(ku + 0.02 * N[0], kv + 0.02 * N[1], 1.09), add(HOLO_O, (-0.25, XS)), add(HOLO_O, (0.25, XS))], "recFlK",
         (N[0], N[1], 0))
    return k.build()


def t1b_holo():
    """The hologram's lines: a body outline (the hurt arm red), a heartbeat over the chest, a frame."""
    k = K("rec_t1b_holo", FP)
    O = HOLO_O
    for y in (0.0, 0.76):
        rect(k, O, XS, UP, -0.25, 0.25, y, y + 0.02, "recGlow", 0.003)
    for x in (-0.25, 0.23):
        rect(k, O, XS, UP, x, x + 0.02, 0.0, 0.1, "recGlow", 0.003)
        rect(k, O, XS, UP, x, x + 0.02, 0.68, 0.78, "recGlow", 0.003)
    body_holo(k, add(O, (0.04, UP)), XS, UP, 0.68, "armR")
    trace(lambda a, b: rect(k, O, XS, UP, a - 0.008, a + 0.008, 0.42 + b - 0.008, 0.42 + b + 0.008, "medRed", 0.006),
          [(-0.2, 0.0), (-0.07, 0.0), (-0.03, 0.07), (0.01, -0.05), (0.05, 0.0), (0.2, 0.0)], d=0.014)
    return k.build()


# ---- t2b ------------------------------------------------------------------------------------------------------------
PY_A = FRONT - math.radians(112)
PY = at(PY_A, 0.84)
LEFT = FRONT + math.radians(99)


def t2b_extra():
    k = K("rec_t2b", FP)
    pu, pv = PY[0], PY[1]
    face = (pu + 0.105 * N[0], pv + 0.105 * N[1], 0.0)
    rect(k, face, XS, UP, -0.07, 0.07, 0.95, 1.3, "dark", 0.002)       # the column's screen
    for i, col in enumerate(("green", "cyan", "green", "cyan")):
        rect(k, face, XS, UP, -0.05, -0.05 + 0.03 * (4 - i), 1.0 + i * 0.07, 1.03 + i * 0.07, col, 0.005)
    for i, col in enumerate(("recGlow", "recGlowO", "steelL")):
        rect(k, face, XS, UP, -0.05 + i * 0.045, -0.02 + i * 0.045, 0.78, 0.81, col, 0.004)
    k.cyl(pu, pv, 1.53, 0.09, 0.04, "steelD", top="steel", sides=12)   # the projector on top
    k.cyl(pu, pv, 1.57, 0.06, 0.02, "recGlow", top="recGlow", sides=12)
    for p, q in (((pu - 0.05, pv - 0.05, 0.02), (0.35, -0.45, 0.02)),):   # floor conduit to the plinth
        bar(k, p, q, 0.06, "gmD")
    ju, jv, _ = at(LEFT, 0.84)                                          # junction box and pipes up the left
    k.box(ju, jv, 0.0, 0.22, 0.22, 0.32, "medWhite", top="plate", rz=LEFT, bevel=0.012)
    k.box(ju, jv, 0.24, 0.23, 0.23, 0.025, "cyan", rz=LEFT)
    for i, d in enumerate((-0.12, 0.0, 0.12)):
        b = LEFT + d
        pipe(k, [at(b, 0.84, 0.3), at(b, 0.76, 0.45), at(b, R + 0.1, 0.6), at(b, R + 0.1, 2.38),
                 at(b, R + 0.14, 2.48)], w=0.045, col=("medWhite", "recCl", "medWhite")[i], collar="steel",
             every=0.7)
    for z in (0.9, 1.6):                                                 # clamps
        k.box(*at(LEFT, R + 0.1)[:2], z, 0.1, 0.38, 0.07, "plate", top="medWhite", rz=LEFT)
    ru, rv = -0.5, 0.86                                                  # the cartridge rack
    k.box(ru, rv, 0.0, 0.18, 0.4, 0.06, "medWhite", top="plate", rz=-math.pi / 4 + math.pi / 2)
    k.box(ru - 0.05, rv - 0.05, 0.0, 0.06, 0.4, 0.42, "medWhite", top="plate", rz=-math.pi / 4 + math.pi / 2)
    for i, col in enumerate(("recMn", "recCl", "recOr")):
        cu, cv = ru + (i - 1) * 0.1, rv - (i - 1) * 0.1
        k.cyl(cu, cv, 0.06, 0.05, 0.26, "glassL", top=col, sides=10)
        k.cyl(cu, cv, 0.08, 0.042, 0.18, col, sides=10)
        k.cyl(cu, cv, 0.32, 0.05, 0.04, "steelL", top="steel", sides=10)
    return k.build()


def t2b_back():
    return t2_back() + t2b_extra()


def t2b_top():
    objs = t2_top()
    k = K("rec_t2b_top", FP)
    for i in range(OCT_V):
        a = math.pi / 8 + i * math.tau / OCT_V
        k.box(0.74 * math.cos(a), 0.74 * math.sin(a), 2.5, 0.16, 0.02, 0.025, "steelD", rz=a + math.pi / 2)
    k.cyl(0, 0, 2.77, 0.04, 0.12, "steelL", sides=8)                      # an emitter on the crown
    k.cyl(0, 0, 2.89, 0.07, 0.03, "recGlow", top="recGlow", sides=10)
    return objs + k.build()


OCT_V = 8


def t2b_holo():
    k = K("rec_t2b_holo", FP)
    pu, pv = PY[0], PY[1]
    O = (pu, pv, 1.62)
    n = 20
    for i in range(n):                                                   # a turning ring under the figure
        a = i * math.tau / n
        k.box(pu + 0.26 * math.cos(a), pv + 0.26 * math.sin(a), 1.63, 0.08, 0.016, 0.016, "recGlow",
              rz=a + math.pi / 2)
    body_holo(k, O, XS, UP, 0.82, "legL")
    for z in (1.9, 2.15):                                                # scan lines
        k.box(pu, pv, z, 0.4, 0.012, 0.008, "recGlow", rz=-math.pi / 4)
    return k.build()


DESIGNS = {
    "t1b": (t1b_back, ((film_of(T1_FLUID, CLIN, 40), FILM_A), (shine(round_streaks(R, 0.5, 2.2)), SHINE_A),
                       (t1b_top, 255), (t1b_sheet, 70), (t1b_holo, 220))),
    "t2b": (t2b_back, ((t2_film, FILM_A), (shine(round_streaks(R, 0.5, 2.2)[:2]), SHINE_A), (t2b_top, 255),
                       (t2b_holo, 220))),
}
