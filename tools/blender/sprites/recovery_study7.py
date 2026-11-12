"""Recovery pod look study, round 7 (family `recovery`, preview only): the lantern and the gem with their working parts
grown out of the housing (no free-standing props), and holograms built as the arcade's and the research bench's: a
recessed lit projector in the housing, a fan of rays from its lens, solid lit shapes in a few colours, rendered by
research_kit.holo_item (lit px near opaque, film faint).

  t1c lantern: a console wing moulded into the base at the front-left: a sloped control face and a projector behind
      it throwing a vitals screen (a heartbeat, three bars, a cross) up on its rays; a filter housing fused into the
      base at the right, its gauge facing out, piped into the right strut; the two front rods made conduit struts
      with lit flow windows, socketed into base and hat
  t2c gem: a hex control column fused to the right facet on a web, up into the crown, its screen facing out; a
      projector set into the plinth's step at the front-left throwing a turning figure of the patient (the hurt leg
      red) on a lit ring; three pipes up the left facet in a recessed fairing socketed into the plinth; three
      medicine cartridges docked into slots in the plinth step at the front-right"""
import math

from .modkit import K
from .recovery_study5 import R, N, T1_FLUID, at, octa, t2_back, t2_film
from .recovery_study2 import lathe
from .recovery_study3 import FILM_A, SHINE_A, film_of, round_streaks, shine
from .recovery_study4 import CLIN, FRONT, base, fluid
from .recovery_study6 import UP, XS, add, normal, plate, rect, t2b_top
from .medbay import trace
from .research_kit import bar

HOLO = "holo"                                       # the layer is rendered by research_kit.holo_item
LIT, FILM, RED, GRN, AMB = "recGlow", "recHoloF", "recHoloR", "recHoloG", "recGlowO"


def block(k, O, X, Y, x0, x1, y0, y1, col, lift=0.01, t=0.012):
    """A raised block on the plane O + X x + Y y, its face `lift` off the plane."""
    n = normal(X, Y)
    plate(k, add(O, ((x0 + x1) / 2, X), (y0, Y), (lift, n)), X, Y, x1 - x0, y1 - y0, t, col)


def rays(k, lens, corners, edge_pts=()):
    for q in corners:
        bar(k, lens, q, 0.012, LIT)
    for q in edge_pts:
        bar(k, lens, q, 0.01, FILM)


def lerp(p, q, f):
    return tuple(p[i] + (q[i] - p[i]) * f for i in range(3))


def projector(k, u, v, z, r=0.1):
    """A recessed projector: a steel collar with a lit rim round a dark well, the lens at its floor."""
    k.cyl(u, v, z - 0.04, r, 0.05, "steelD", top="steel", sides=16)
    k.cyl(u, v, z + 0.01, r + 0.004, 0.012, "cyan", top="cyan", sides=16)
    k.cyl(u, v, z + 0.005, r - 0.03, 0.01, "dark", top="dark", sides=16)
    k.cyl(u, v, z + 0.012, 0.04, 0.01, LIT, top=LIT, sides=10)
    return (u, v, z + 0.02)


# ---- t1c ------------------------------------------------------------------------------------------------------------
A_CON = FRONT + math.radians(78)                    # the console wing
A_FIL = FRONT - math.radians(95)                    # the filter housing
STRUTS = tuple(FRONT + s * math.radians(62) for s in (1, -1))
BACK_RODS = tuple(FRONT + math.radians(d) for d in (140, 220))
TILT = math.radians(55)
PANEL_Y = (-math.sin(TILT) * N[0], -math.sin(TILT) * N[1], math.cos(TILT))
SCREEN_Y = (-math.sin(0.25) * N[0], -math.sin(0.25) * N[1], math.cos(0.25))
LENS1 = at(A_CON, 0.72)[:2]


def t1c_back():
    k = K("rec_t1c", FP7)
    base(k, 0.96)
    lathe(k, ((0.14, 0.82), (0.2, 0.8), (0.24, 0.72)), "medWhite", "plate", 40)
    k.cyl(0, 0, 0.17, 0.825, 0.02, "cyan", sides=40)
    k.cyl(0, 0, 0.24, 0.66, 0.06, "steel", top="steelL", sides=40)
    fluid(k, T1_FLUID, CLIN, 40)
    for a in BACK_RODS:
        bar(k, at(a, R + 0.08, 0.24), at(a, R + 0.08, 2.42), 0.07, "medWhite")
    u, v, _ = at(A_CON, 0.8)                                                  # the console wing
    k.box(*at(A_CON, 0.66)[:2], 0.04, 0.4, 0.34, 0.26, "medWhite", top="plate", rz=A_CON + math.pi / 2, bevel=0.02)
    k.box(u, v, 0.04, 0.48, 0.4, 0.36, "medWhite", top="plate", rz=A_CON + math.pi / 2, bevel=0.025)
    k.box(u, v, 0.13, 0.485, 0.405, 0.018, "cyan", rz=A_CON + math.pi / 2)
    O = add(at(A_CON, 0.92), (0.4, UP), (0.02, (N[0], N[1], 0)))              # its sloped control face
    plate(k, O, XS, PANEL_Y, 0.38, 0.2, 0.05, "plate", "medWhite")
    rect(k, O, XS, PANEL_Y, -0.15, 0.06, 0.03, 0.17, "dark", 0.004)
    trace(lambda a, b: rect(k, O, XS, PANEL_Y, -0.045 + a - 0.006, -0.045 + a + 0.006, 0.1 + b - 0.006,
                            0.1 + b + 0.006, "green", 0.008),
          [(-0.09, 0.0), (-0.03, 0.0), (-0.01, 0.04), (0.01, -0.03), (0.03, 0.0), (0.09, 0.0)], d=0.012)
    for i, col in enumerate(("cyan", "recGlowO", "medRed")):
        block(k, O, XS, PANEL_Y, 0.09, 0.15, 0.04 + i * 0.045, 0.07 + i * 0.045, col, lift=0.012)
    projector(k, *LENS1, 0.42)
    u, v, _ = at(A_FIL, 0.84)                                                 # the filter housing
    k.box(*at(A_FIL, 0.68)[:2], 0.04, 0.3, 0.3, 0.42, "medWhite", top="plate", rz=A_FIL, bevel=0.02)
    k.cyl(u, v, 0.04, 0.19, 0.12, "plate", top="medWhite", sides=20)
    k.cyl(u, v, 0.16, 0.17, 0.82, "medWhite", top="plate", sides=20)
    k.cyl(u, v, 0.98, 0.15, 0.06, "steel", top="steelL", sides=20)
    g = add((u, v, 0.0), (0.172, (N[0], N[1], 0)))
    rect(k, g, XS, UP, -0.04, 0.04, 0.3, 0.88, "dark")                         # its gauge
    rect(k, g, XS, UP, -0.028, 0.028, 0.31, 0.62, "recCl", 0.003)
    for i in range(4):
        rect(k, g, XS, UP, 0.045, 0.075, 0.36 + i * 0.15, 0.375 + i * 0.15, "steelL", 0.002)
    return k.build()


def strut(k, a):
    """A conduit strut: socketed into base and hat, a lit flow window down its outer face."""
    p0, p1 = at(a, R + 0.09, 0.24), at(a, R + 0.09, 2.42)
    bar(k, p0, p1, 0.11, "medWhite")
    bar(k, at(a, R + 0.15, 0.55), at(a, R + 0.15, 2.15), 0.035, "cyan")
    for z in (0.24, 2.34):
        k.cyl(*at(a, R + 0.09)[:2], z, 0.085, 0.08, "steel", top="steelL", sides=12)


def t1c_top():
    k = K("rec_t1c_top", FP7)
    for a in STRUTS:
        strut(k, a)
    u, v, _ = at(A_FIL, 0.84)                                                 # the filter's line into the strut
    s = at(STRUTS[1], R + 0.09)
    bar(k, (u, v, 1.04), (u, v, 1.16), 0.07, "steel")
    bar(k, (u, v, 1.16), (s[0], s[1], 1.16), 0.07, "medWhite")
    k.cyl(s[0], s[1], 1.12, 0.08, 0.08, "steel", top="steelL", sides=12)
    k.cyl(0, 0, 2.4, 0.62, 0.025, LIT, top=LIT, sides=40)                     # the hat
    lathe(k, ((2.42, 0.8), (2.47, 0.82), (2.53, 0.78), (2.6, 0.62), (2.66, 0.42), (2.7, 0.2)), "medWhite", "plate", 40)
    k.cyl(0, 0, 2.44, 0.825, 0.02, "cyan", sides=40)
    for i in range(16):
        a = (i + 0.5) * math.tau / 16
        k.box(0.81 * math.cos(a), 0.81 * math.sin(a), 2.485, 0.1, 0.02, 0.02, "steelD", rz=a + math.pi / 2)
    k.cyl(0, 0, 2.7, 0.14, 0.05, "steel", top="steelL", sides=20)
    return k.build()


def t1c_holo():
    """The vitals screen over the console: a lit border, a heartbeat and bars raised off it, a cross."""
    k = K("rec_t1c_holo", FP7)
    lens = (*LENS1, 0.44)
    O = add((*LENS1, 1.12), (0.3, (N[0], N[1], 0)), (-0.12, XS))           # out in front of the glass
    W, H = 0.34, 0.58
    X, Y = XS, SCREEN_Y
    for x0, x1, y0, y1 in ((-W, W, 0, 0.022), (-W, W, H - 0.022, H), (-W, -W + 0.022, 0, H), (W - 0.022, W, 0, H)):
        block(k, O, X, Y, x0, x1, y0, y1, LIT, lift=0.0, t=0.01)
    trace(lambda a, b: block(k, O, X, Y, a - 0.012, a + 0.012, 0.31 + b - 0.012, 0.31 + b + 0.012, GRN, t=0.03),
          [(-0.28, 0.0), (-0.12, 0.0), (-0.07, 0.1), (-0.02, -0.09), (0.03, 0.0), (0.28, 0.0)], d=0.022)
    for i, (w, col) in enumerate(((0.32, LIT), (0.22, AMB), (0.12, RED))):
        block(k, O, X, Y, -0.27, -0.27 + w, 0.21 - i * 0.065, 0.25 - i * 0.065, col, t=0.03)
    for x0, x1, y0, y1 in ((0.15, 0.27, 0.12, 0.16), (0.19, 0.23, 0.08, 0.2)):              # the cross
        block(k, O, X, Y, x0, x1, y0, y1, RED, t=0.03)
    c = [add(O, (x, X), (y, Y)) for x, y in ((-W, 0), (W, 0), (W, H), (-W, H))]
    rays(k, lens, c, [lerp(c[0], c[1], f) for f in (0.25, 0.5, 0.75)] + [lerp(c[0], c[3], 0.5), lerp(c[1], c[2], 0.5)])
    return k.build()


# ---- t2c ------------------------------------------------------------------------------------------------------------
A_COL = FRONT - math.radians(112)                   # the control column
A_FIG = FRONT + math.radians(50)                    # the figure's projector
A_PIPE = FRONT + math.radians(96)                   # the pipe fairing
A_CART = FRONT - math.radians(52)                   # the cartridges
STEP = 0.15                                         # the plinth's outer step


def t2c_extra():
    k = K("rec_t2c", FP7)
    u, v, _ = at(A_COL, 0.84)                                                  # the column
    k.box(*at(A_COL, 0.66)[:2], 0.23, 0.12, 0.3, 2.2, "plate", top="medWhite", rz=A_COL + math.pi / 2)   # its web
    k.cyl(u, v, STEP, 0.2, 0.1, "plate", top="medWhite", sides=6)
    k.cyl(u, v, STEP + 0.1, 0.16, 2.2, "medWhite", top="plate", sides=6)
    k.cyl(u, v, 0.8, 0.165, 0.02, "cyan", sides=6)
    k.cyl(u, v, 2.0, 0.165, 0.02, "cyan", sides=6)
    face = add((u, v, 0.0), (0.15, (N[0], N[1], 0)))
    rect(k, face, XS, UP, -0.075, 0.075, 1.05, 1.5, "dark", 0.003)
    trace(lambda a, b: rect(k, face, XS, UP, a - 0.006, a + 0.006, 1.38 + b - 0.006, 1.38 + b + 0.006, "green", 0.006),
          [(-0.06, 0.0), (-0.02, 0.0), (-0.005, 0.04), (0.01, -0.03), (0.025, 0.0), (0.06, 0.0)], d=0.01)
    for i, (w, col) in enumerate(((0.1, "cyan"), (0.07, "recGlowO"), (0.05, "cyan"))):
        rect(k, face, XS, UP, -0.055, -0.055 + w, 1.12 + i * 0.06, 1.15 + i * 0.06, col, 0.006)
    projector(k, *at(A_FIG, 0.84)[:2], STEP + 0.02, r=0.12)                    # the figure's projector, in the step
    a = A_PIPE                                                                 # the pipe fairing and its socket
    k.box(*at(a, 0.8)[:2], STEP, 0.3, 0.26, 0.2, "medWhite", top="plate", rz=a + math.pi / 2, bevel=0.015)
    k.box(*at(a, R + 0.1)[:2], 0.3, 0.26, 0.2, 2.1, "medWhite", top="plate", rz=a + math.pi / 2)
    k.box(*at(a, R + 0.2)[:2], 0.4, 0.17, 0.012, 1.85, "dark", rz=a + math.pi / 2)
    for i, d in enumerate((-0.05, 0.0, 0.05)):
        b = a + d / (R + 0.2)
        bar(k, at(b, R + 0.21, 0.42), at(b, R + 0.21, 2.22), 0.03, ("steelL", "recCl", "steelL")[i])
    for z in (0.7, 1.3, 1.9):
        k.box(*at(a, R + 0.21)[:2], z, 0.04, 0.2, 0.04, "steel", rz=a + math.pi / 2)
    for i, col in enumerate(("recMn", "recCl", "recOr")):                      # cartridges docked in the step
        b = A_CART + (i - 1) * 0.15
        cu, cv, _ = at(b, 0.86)
        k.cyl(cu, cv, STEP - 0.03, 0.065, 0.04, "steelD", top="dark", sides=12)
        k.cyl(cu, cv, STEP, 0.05, 0.2, "glassL", top=col, sides=10)
        k.cyl(cu, cv, STEP + 0.02, 0.042, 0.14, col, sides=10)
        k.cyl(cu, cv, STEP + 0.2, 0.052, 0.04, "steelL", top="steel", sides=10)
    return k.build()


def t2c_back():
    return t2_back(hide_pylon=True) + t2c_extra()


def t2c_holo():
    """The patient as a solid lit amber figure (the hurt leg red) on a lit ring over the projector, rays up to the ring,
    amber so it reads against the mint tank (as the research bench's gold hologram)."""
    k = K("rec_t2c_holo", FP7)
    u, v, _ = at(A_FIG, 0.84)
    z0, r, S = 0.5, 0.22, 1.35
    lens = (u, v, STEP + 0.04)
    n = 22
    ring = []
    for i in range(n):
        a = i * math.tau / n
        k.box(u + r * math.cos(a), v + r * math.sin(a), z0 - 0.02, 0.07, 0.02, 0.02, AMB, rz=a + math.pi / 2)
        if i % 4 == 0:
            ring.append((u + r * math.cos(a), v + r * math.sin(a), z0 - 0.02))
    rays(k, lens, ring[::2], ring[1::2])
    T = -math.pi / 4                                                           # the figure faces the camera
    parts = ((0, 0.75, 0.085, 0.08, 0.1, AMB), (0, 0.42, 0.16, 0.08, 0.28, AMB),               # head, torso
             (-0.125, 0.41, 0.045, 0.05, 0.28, AMB), (0.125, 0.41, 0.045, 0.05, 0.28, AMB),   # arms
             (-0.05, 0.0, 0.055, 0.06, 0.39, RED), (0.05, 0.0, 0.055, 0.06, 0.39, AMB))       # legs, the left hurt
    for dx, z, w, d, h, col in parts:
        k.box(u + S * dx * XS[0], v + S * dx * XS[1], z0 + S * z, S * w, d, S * h, col, rz=T)
    return k.build()


FP7 = (2, 2)
DESIGNS = {
    "t1c": (t1c_back, ((film_of(T1_FLUID, CLIN, 40), FILM_A), (shine(round_streaks(R, 0.5, 2.2)), SHINE_A),
                       (t1c_top, 255), (t1c_holo, HOLO))),
    "t2c": (t2c_back, ((t2_film, FILM_A), (shine(round_streaks(R, 0.5, 2.2)[:2]), SHINE_A), (t2b_top, 255),
                       (t2c_holo, HOLO))),
}
