"""Arcade cabinet look study (family `arcade`, preview only): a 1x1 leisure cabinet, classic style with some sci-fi
uplift, facing +v (toward the camera, bottom left). One body each; the details are the cabinet's working parts: the lit
marquee, the screen behind its bezel, the control panel (stick and buttons), the coin door, the kick plate, the side art
and edge trim.

  a1 classic upright: a dark cabinet, side panels proud of the front framing a tilted screen, a jutting control panel,
      a lit marquee box, a coin door; neon edge trim and side art bands
  a2 hooded: a white shell, wider at the top than the foot, its sides sweeping forward into a hood whose lit underside
      shades a deep-set screen; a wide control shelf with a trackball
  a3 fibreglass: one swelling teal shell (a bulbous head over a narrow waist and a wide foot), chrome trim, the screen set
      into its face, the controls on the waist

Units: P(n) = n px along u or v (1/32 tile), Z(n) = n z px. Width runs along u, depth along v, the front at +v."""
import math

from .research_kit import Bench
from .research_r13 import P, Z, blk, flat
from .research_r14 import side
from .research_r15 import prism

FP = (1, 1)
BODY = ("arcBodyL", "arcBody", "arcBodyD")
SHELL = ("arcShellL", "arcShell", "arcShellD")
TEAL = ("arcTealL", "arcTeal", "arcTealD")
CHROME = ("arcChrL", "arcChr", "arcChrD")
INNER = ("arcBodyK",) * 3
PANEL = ("arcPanel", "arcPanel", "arcPanelD")
GLASS = ("arcGlass",) * 3


def one(c):
    return (c,) * 3


def pz(pts):
    """A profile in (v px, z px) to tile units."""
    return [(P(v), Z(z)) for v, z in pts]


def body(k, u0, u1, pieces, ramp, slope=None):
    """Sweep convex profile pieces (v px, z px) across u0..u1; faces sloping up toward the camera take `slope`."""
    for pts in pieces:
        prism(k, "u", u0, u1, pz(pts), ramp, slope)


def slab(k, u0, u1, a, b, t, ramp, d=0.0):
    """A slab t px thick lying on the line a -> b (v px, z px) of the side profile, d px out from it toward +v / +z."""
    (v0, z0), (v1, z1) = a, b
    L = math.hypot(v1 - v0, z1 - z0)
    nv, nz = (z1 - z0) / L, -(v1 - v0) / L                           # the normal on the camera side of a -> b
    if nv < 0 or (nv == 0 and nz < 0):
        nv, nz = -nv, -nz
    p = [(v0 + nv * d, z0 + nz * d), (v1 + nv * d, z1 + nz * d)]
    body(k, u0, u1, [[p[0], p[1], (p[1][0] + nv * t, p[1][1] + nz * t), (p[0][0] + nv * t, p[0][1] + nz * t)]], ramp)


def trim(k, u0, u1, edges, col):
    """Neon or chrome edge trim along a chain of profile points, 1 px proud."""
    for a, b in zip(edges, edges[1:]):
        slab(k, u0, u1, a, b, 0.8, one(col) if isinstance(col, str) else col)


def screen(k, u0, u1, a, b, glyphs):
    """A dark glass screen on the line a -> b, phosphor glyph rows on it (fractions along the line, a lit colour)."""
    slab(k, u0, u1, a, b, 0.5, GLASS)
    (v0, z0), (v1, z1) = a, b
    w = u1 - u0
    for f, ga, gb, col in glyphs:
        p = (v0 + (v1 - v0) * f, z0 + (z1 - z0) * f)
        q = (v0 + (v1 - v0) * (f + 0.08), z0 + (z1 - z0) * (f + 0.08))
        slab(k, u0 + w * ga, u0 + w * gb, p, q, 0.3, one(col), d=0.5)


def stick(k, u, v, z, ball="arcStick"):
    """A joystick: a post with a ball on top, 4 px."""
    k.cyl(P(u), P(v), Z(z), P(0.6), Z(3), "arcChrD", top="arcChr", sides=8)
    k.box(P(u), P(v), Z(z + 3), P(2.4), P(2.4), Z(2.2), ball, top=ball)


def button(k, u, v, z, col):
    k.box(P(u), P(v), Z(z), P(1.6), P(1.6), Z(1), col, top=col)


# ---- a1: classic upright --------------------------------------------------------------------------------------------

def a1():
    k = Bench("arcade_a1", FP)
    W, S = 9, 11                                   # half widths: the body, the side panels (px)
    body(k, P(-W), P(W), [
        [(-12, 0), (7, 0), (8, 3), (8, 28), (-12, 28)],                       # the lower body
        [(-12, 28), (8, 28), (13, 31), (13, 34), (6, 37), (-12, 37)],          # the control panel
        [(-12, 37), (6, 37), (2, 51), (-12, 51)],                             # behind the screen
        [(-12, 51), (2, 51), (6, 53), (6, 60), (-12, 60)]], BODY)             # the marquee box
    edge = [(9, 0), (9, 28), (14, 31), (14, 35), (7, 53), (7, 61)]
    for u0, u1 in ((P(-S), P(-W)), (P(W), P(S))):                             # the side panels, proud of the front
        body(k, u0, u1, [[(-13, 0), (9, 0), (9, 28), (-13, 28)],
                         [(-13, 28), (9, 28), (14, 31), (14, 35), (7, 53), (7, 61), (-13, 61)]], BODY)
        trim(k, u0, u1, edge, "arcPink")                                      # neon T-molding on their front edges
    side(k, P(S), P(-11), P(5), Z(12), Z(15), "arcCyanF")                     # side art: two bands sweeping up
    side(k, P(S), P(-11), P(9), Z(17), Z(19), "arcPinkF")
    side(k, P(S), P(-11), P(-3), Z(44), Z(47), "arcCyanF")
    slab(k, P(-W), P(W), (13, 34), (6, 37), 0.5, PANEL)                      # the control panel's top
    stick(k, -4, 10.5, 34)
    for u, col in ((1, "arcBtnY"), (4, "arcBtnB"), (7, "arcBtnY")):
        button(k, u, 9.5, 35, col)
    slab(k, P(-W), P(W), (6, 37), (2, 51), 0.4, INNER)                        # the bezel,
    screen(k, P(-7), P(7), (5.4, 39), (2.4, 49), [(0.2, 0.1, 0.5, "arcScrG"), (0.45, 0.55, 0.9, "arcScrP"),
                                                 (0.7, 0.2, 0.8, "arcScrG")])
    flat(k, P(-W), P(W), P(6) + 0.006, Z(53), Z(60), "arcMarq")               # the lit marquee,
    for a, b, z in ((0.15, 0.55, 57), (0.6, 0.85, 57), (0.25, 0.75, 55)):
        flat(k, P(-W + 2 * W * a), P(-W + 2 * W * b), P(6) + 0.012, Z(z), Z(z + 1.2), "arcPink")
    blk(k, P(-4), P(4), P(8), P(8.6), Z(8), Z(22), CHROME)                    # the coin door,
    for u in (-2, 2):
        flat(k, P(u - 0.8), P(u + 0.8), P(8.6) + 0.006, Z(16), Z(19), "arcCoin")   # its lit coin slots
    flat(k, P(-W), P(W), P(8) + 0.006, Z(0), Z(3), "arcChrD")                 # the kick plate
    return k.build()


# ---- a2: hooded -----------------------------------------------------------------------------------------------------

def a2():
    k = Bench("arcade_a2", FP)
    body(k, P(-8), P(8), [
        [(-11, 0), (6, 0), (6, 26), (-11, 26)],                               # the foot, narrower than the head,
        [(-11, 26), (6, 26), (14, 30), (14, 33), (-11, 33)]], SHELL)          # the wide control shelf
    body(k, P(-10), P(10), [[(-12, 33), (4, 33), (2, 52), (-12, 52)]], INNER)  # the dark head the screen sits in
    body(k, P(-10), P(10), [[(-12, 52), (2, 52), (12, 56), (12, 59), (6, 63), (-12, 63)]], SHELL)   # the hood
    for u0, u1 in ((P(-12), P(-10)), (P(10), P(12))):                         # the side cheeks: the hood's sides
        body(k, u0, u1, [[(-12, 33), (6, 33), (12, 56), (12, 59), (6, 63), (-12, 63)]], SHELL)
    slab(k, P(-10), P(10), (2, 52), (12, 56), 0.4, one("arcCyan"))    # the hood's lit underside
    trim(k, P(10), P(12), [(6, 33), (12, 56)], "arcCyan")                     # a neon line down each cheek
    trim(k, P(-12), P(-10), [(6, 33), (12, 56)], "arcCyan")
    screen(k, P(-8), P(8), (3.8, 35), (2.2, 50), [(0.2, 0.1, 0.6, "arcScrG"), (0.45, 0.4, 0.9, "arcScrG"),
                                                 (0.7, 0.15, 0.5, "arcScrP")])
    slab(k, P(-8), P(8), (14, 33), (-11, 33), 0.5, PANEL)                     # the shelf's top,
    k.box(P(-3), P(10), Z(33.5), P(3.6), P(3.6), Z(2.4), "arcBtnB", top="arcCyan")   # a trackball,
    for u in (2, 5):
        button(k, u, 9, 33.5, "arcBtnY")
    blk(k, P(-6), P(6), P(6), P(6.6), Z(3), Z(22), SHELL)                     # a front panel down the foot,
    flat(k, P(-1.5), P(1.5), P(6.6) + 0.006, Z(15), Z(19), "arcCoin")         # the coin slot,
    flat(k, P(-8), P(8), P(6) + 0.006, Z(0), Z(2), "arcBodyK")                # a dark kick
    return k.build()


# ---- a3: fibreglass -------------------------------------------------------------------------------------------------

def a3():
    k = Bench("arcade_a3", FP)
    W = 10
    body(k, P(-W), P(W), [
        [(-13, 0), (9, 0), (7, 6), (3, 18), (-12, 18)],                       # the wide foot, tapering in,
        [(-12, 18), (3, 18), (3, 26), (-12, 26)],                             # the waist,
        [(-12, 35), (6, 35), (9, 42), (9, 50), (6, 56), (-12, 56)],           # the swelling head,
        [(-12, 56), (6, 56), (1, 61), (-9, 62), (-12, 60)]], TEAL, "arcTeal")  # rounding over the top
    body(k, P(-W), P(W), [[(-12, 26), (3, 26), (11, 29), (11, 32), (6, 35), (-12, 35)]], PANEL)   # the control pod
    rim = [(9, 0), (7, 6), (3, 18), (3, 26), (11, 29), (11, 32), (6, 35), (9, 42), (9, 50), (6, 56), (1, 61), (-9, 62)]
    for u0 in (P(-W), P(W - 1)):
        trim(k, u0, u0 + P(1), rim, "arcChr")                                 # chrome edging the shell's profile
    slab(k, P(-W + 1), P(W - 1), (9, 41), (9, 51), 0.4, INNER)                # the bezel,
    screen(k, P(-7), P(7), (9.4, 42.5), (9.4, 50), [(0.25, 0.1, 0.6, "arcScrG"), (0.5, 0.45, 0.85, "arcScrP"),
                                                   (0.75, 0.2, 0.7, "arcScrG")])
    stick(k, -4, 8.5, 32)
    for u, col in ((1, "arcBtnY"), (4, "arcBtnB")):
        button(k, u, 8, 32.5, col)
    slab(k, P(-2), P(2), (6.33, 8), (5.0, 12), 0.3, one("arcCoin"), d=0.8)     # the coin slot on the foot
    side(k, P(W), P(-12), P(-2), Z(40), Z(44), "arcCyanF")                    # a stripe down the side
    return k.build()


# ---- round 2 ---------------------------------------------------------------------------------------------------------

VIO = one("arcVio")
VIO_F = one("arcVioF")
ORANGE = ("arcOrgL", "arcOrg", "arcOrgD")


def b1():
    """Holo cabinet: a classic lower cabinet whose screen is a projection; the projector housing on the deck behind the
    controls, its lens lit, the side panels trimmed in violet to match."""
    k = Bench("arcade_b1", FP)
    W, S = 9, 11
    body(k, P(-W), P(W), [
        [(-12, 0), (7, 0), (8, 3), (8, 26), (-12, 26)],                       # the lower body
        [(-12, 26), (8, 26), (13, 29), (13, 32), (6, 34), (-12, 34)]], BODY)  # the control panel
    body(k, P(-W), P(W), [[(-12, 34), (-3, 34), (-3, 38), (-6, 41), (-12, 41)]], BODY)     # the projector housing
    edge = [(9, 0), (9, 26), (14, 29), (14, 33), (7, 35)]
    for u0, u1 in ((P(-S), P(-W)), (P(W), P(S))):
        body(k, u0, u1, [[(-13, 0), (9, 0), (9, 26), (-13, 26)],
                         [(-13, 26), (9, 26), (14, 29), (14, 33), (7, 35), (-13, 35)]], BODY)
        trim(k, u0, u1, edge, "arcVio")
    side(k, P(S), P(-11), P(5), Z(12), Z(15), "arcVioF")                      # side art
    side(k, P(S), P(-11), P(9), Z(17), Z(19), "arcCyanF")
    slab(k, P(-W), P(W), (13, 32), (6, 34), 0.5, PANEL)
    stick(k, -4, 10.5, 32)
    for u, col in ((1, "arcBtnY"), (4, "arcBtnB"), (7, "arcBtnY")):
        button(k, u, 9.5, 33, col)
    slab(k, P(-6), P(6), (-3, 38), (-6, 41), 0.4, VIO)                        # the lens strip, aimed up and forward
    blk(k, P(-4), P(4), P(8), P(8.6), Z(8), Z(20), CHROME)                    # the coin door
    for u in (-2, 2):
        flat(k, P(u - 0.8), P(u + 0.8), P(8.6) + 0.006, Z(14), Z(17), "arcCoin")
    flat(k, P(-W), P(W), P(8) + 0.006, Z(0), Z(3), "arcChrD")
    return k.build()


def b1_holo():
    """The game screen projected over the deck: a film panel leaning back, a bright frame, rows of invaders, a ship, a
    score line; two faint beams down to the lens."""
    k = Bench("arcade_b1_holo", FP)
    a, b = (2, 40), (-2, 61)                                      # the panel's foot and head (v, z px)
    U = 12
    slab(k, P(-U), P(U), a, b, 0.3, VIO_F)
    def at(f):
        return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
    def line(u0, u1, f0, f1):
        slab(k, P(u0), P(u1), at(f0), at(f1), 0.3, VIO, d=0.3)
    line(-U, U, 0.0, 0.04)                                        # the frame
    line(-U, U, 0.96, 1.0)
    line(-U, -U + 1, 0.0, 1.0)
    line(U - 1, U, 0.0, 1.0)
    for row, f in enumerate((0.62, 0.74)):                        # the invaders
        for i in range(5):
            u = -8 + i * 4 + (row % 2) * 1
            line(u, u + 2, f, f + 0.07)
    line(-1, 1, 0.12, 0.22)                                       # the ship
    line(-2.5, 2.5, 0.12, 0.15)
    line(-9, -3, 0.86, 0.9)                                       # the score
    line(4, 9, 0.86, 0.9)
    return k


def b2():
    """Cocktail table: a low square cabinet with the screen face-up under a glass top, a control panel at each end
    (players face each other), a neon underglow round the kick."""
    k = Bench("arcade_b2", FP)
    R = 12
    blk(k, P(-R + 2), P(R - 2), P(-R + 2), P(R - 2), 0, Z(3), INNER)          # the kick,
    for v0 in (P(-R + 2) - 0.004, P(R - 2)):
        blk(k, P(-R + 2), P(R - 2), v0, v0 + 0.004, Z(1), Z(2), VIO)          # its underglow
    blk(k, P(R - 2), P(R - 2) + 0.004, P(-R + 2), P(R - 2), Z(1), Z(2), VIO)
    blk(k, P(-R), P(R), P(-R + 3), P(R - 3), Z(3), Z(22), BODY)               # the body,
    blk(k, P(-R), P(R), P(-R + 3), P(R - 3), Z(22), Z(23), CHROME)            # a chrome band,
    blk(k, P(-R + 1), P(R - 1), P(-R + 4), P(R - 4), Z(23), Z(24), INNER)     # the screen's well,
    k.box(0.0, 0.0, Z(24), P(2 * R - 6), P(2 * R - 10), Z(0.3), "arcGlass")
    for du, dv, w, h, col in ((-5, -4, 2, 2, "arcScrG"), (-1, -4, 2, 2, "arcScrG"), (3, -4, 2, 2, "arcScrG"),
                              (-3, -1, 2, 2, "arcScrP"), (1, -1, 2, 2, "arcScrP"), (0, 4, 3, 1.5, "arcScrG")):
        k.box(P(du), P(dv), Z(24.3), P(w), P(h), Z(0.3), col, top=col)
    k.part("glass").box(0.0, 0.0, Z(24), P(2 * R - 2), P(2 * R - 8), Z(1.5), "glassL")   # the glass top
    for sv in (-1, 1):                                                        # the two control panels
        v0, v1 = (P(R - 3), P(R + 1)) if sv > 0 else (P(-R - 1), P(-R + 3))
        prism(k, "u", P(-R + 2), P(R - 2), pz([(v0 / P(1), 16), (v1 / P(1), 17), (v1 / P(1), 21), (v0 / P(1), 21)]),
              BODY)
        blk(k, P(-R + 2), P(R - 2), v0, v1, Z(21), Z(22), PANEL)
        if sv > 0:
            stick(k, -5, R - 1, 22)
            for u, col in ((0, "arcBtnY"), (3, "arcBtnB"), (6, "arcBtnY")):
                button(k, u, R - 1.5, 22, col)
    blk(k, P(-3), P(3), P(R - 3), P(R - 2.4), Z(6), Z(14), CHROME)            # the coin door under the near panel
    flat(k, P(-1), P(1), P(R - 2.4) + 0.006, Z(10), Z(12), "arcCoin")
    return k.build()


def b3():
    """Space-age orb: a sphere head holding the screen, on a chrome stalk rising from a flared foot through a control
    deck."""
    k = Bench("arcade_b3", FP)
    k.cyl(0.0, 0.0, 0.0, 0.36, Z(3), "arcOrgD", top="arcOrg", sides=20, rtop=0.3)          # the flared foot,
    k.cyl(0.0, 0.0, Z(3), 0.07, Z(25), "arcChrD", top="arcChr", sides=12)                 # the stalk,
    k.cyl(0.0, P(2), Z(24), 0.28, Z(3), "arcOrgD", top="arcOrg", sides=20, rtop=0.3)      # the control deck,
    k.cyl(0.0, P(2), Z(27), 0.3, Z(1), PANEL[2], top=PANEL[0], sides=20)
    zc, R = Z(44), 0.31                                                                   # the sphere head, in bands
    for z0, z1, r0, r1, col in ((-0.95, -0.6, 0.3, 0.8, "arcOrgD"), (-0.6, 0.0, 0.8, 1.0, "arcOrg"),
                                (0.0, 0.45, 1.0, 0.9, "arcOrg"), (0.45, 0.8, 0.9, 0.6, "arcOrgL"),
                                (0.8, 1.0, 0.6, 0.25, "arcOrgL")):
        k.cyl(0.0, 0.0, zc + z0 * R, r0 * R, (z1 - z0) * R, col, top=col, sides=12, rtop=r1 * R)
    sv = 0.25                                                                             # the screen in its face:
    k.box(0.0, sv, zc - 0.12, 0.38, 0.12, 0.25, "arcChrD", top="arcChr")                 # the bezel,
    k.box(0.0, sv + 0.065, zc - 0.1, 0.32, 0.01, 0.21, "arcGlass")                      # the glass
    for dz, du, w, col in ((0.06, -0.06, 0.12, "arcScrG"), (0.0, 0.05, 0.1, "arcScrP"), (-0.06, -0.02, 0.18, "arcScrG")):
        k.box(du, sv + 0.072, zc + dz - 0.012, w, 0.006, 0.024, col)
    k.box(0.0, -0.02, zc + R - 0.02, 0.12, 0.12, 0.06, "arcChr", top="arcChrL")         # a chrome cap,
    k.cyl(0.0, -0.02, zc + R + 0.04, 0.02, 0.05, "arcCyan", top="arcCyan", sides=8)      # its lit tip
    stick(k, -5, 9, 28)
    for u, col in ((0, "arcBtnY"), (3, "arcBtnB")):
        button(k, u, 9, 28, col)
    return k.build()


def holo_job(sid, cab, holo):
    """A translucent layer over the cabinet (as the research bench's): see research_kit.holo_item."""
    def run(sid=sid):
        from . import core, post
        from .research_kit import holo_item
        core.clear_scene_meshes()
        post.select("arcade")
        it = holo_item(sid, FP, cab(), holo().build())
        return [it] if it else []
    return run


def jobs():
    out = [(f"module.arcade.{v}", FP, "prop", f) for v, f in (("a1", a1), ("a2", a2), ("a3", a3), ("b1", b1),
                                                              ("b2", b2), ("b3", b3))]
    return out + [holo_job("module.arcade.b1.holo", b1, b1_holo)]
