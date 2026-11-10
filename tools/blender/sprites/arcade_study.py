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


# ---- round 3: every one a hologram ----------------------------------------------------------------------------------

def vpanel(k, u0, u1, v, z0, z1, col, t=0.004):
    """A thin vertical panel facing +v (holo film and glyphs)."""
    k.box((u0 + u1) / 2, v + t / 2, z0, u1 - u0, t, z1 - z0, col, top=col)


def ring_of(k, r, z, n, w, col, h=0.004):
    """A flat lit ring of n short tangent bars, radius r at height z."""
    for i in range(n):
        a = i * math.tau / n
        k.box(r * math.cos(a), r * math.sin(a), z, w, 0.012, h, col, top=col, rz=a + math.pi / 2)


def c1():
    """Holo orrery: a round pedestal cabinet, a control console jutting from its front, a lit emitter ring on its top."""
    k = Bench("arcade_c1", FP)
    k.cyl(0.0, 0.0, 0.0, 0.4, Z(3), "arcBodyK", top="arcBodyK", sides=16)                # the kick,
    k.cyl(0.0, 0.0, Z(3), 0.36, Z(23), "arcBody", top="arcBodyL", sides=16)              # the drum,
    k.cyl(0.0, 0.0, Z(26), 0.38, Z(2), "arcChrD", top="arcChr", sides=16)                # the chrome deck,
    k.cyl(0.0, 0.0, Z(28), 0.3, Z(0.6), "arcVio", top="arcVio", sides=16)                # the emitter ring,
    k.cyl(0.0, 0.0, Z(28), 0.25, Z(1), "arcBodyK", top="arcBodyK", sides=16)            # its dark lens well
    body(k, P(-8), P(8), [[(5, 6), (9, 6), (15, 20), (15, 24), (10, 26), (5, 26)]], BODY)   # the console,
    slab(k, P(-8), P(8), (15, 24), (10, 26), 0.5, PANEL)
    stick(k, -3.5, 13.5, 24.5)
    for u, col in ((1.5, "arcBtnY"), (4.5, "arcBtnB")):
        button(k, u, 13, 25, col)
    slab(k, P(-2), P(2), (10.3, 9), (11.6, 12), 0.3, one("arcCoin"), d=0.8)             # the coin slot
    for a in (0.6, 2.2, 3.9, 5.4):                                                       # lit seams down the drum
        k.box(0.365 * math.cos(a), 0.365 * math.sin(a), Z(6), 0.012, 0.012, Z(17), "arcVio", rz=a)
    return k.build()


def c1_holo():
    """A game in the round over the ring: a banded planet with lit latitude rings, a wide orbit ring with a ship on it,
    asteroids; beams up from the emitter to the planet."""
    k = Bench("arcade_c1_holo", FP)
    zc, R = Z(50), 0.17
    for z0, z1, r0, r1 in ((-1, -0.5, 0.3, 0.85), (-0.5, 0.5, 0.85, 0.85), (0.5, 1, 0.85, 0.3)):
        k.cyl(0.0, 0.0, zc + z0 * R, r0 * R, (z1 - z0) * R, "arcVioF", top="arcVioF", sides=12, rtop=r1 * R)
    for dz, r in ((-0.5, 0.86), (0.0, 0.87), (0.5, 0.86)):                               # lit latitude rings
        k.cyl(0.0, 0.0, zc + dz * R - 0.008, r * R, 0.016, "arcVio", top="arcVio", sides=12)
    ring_of(k, 0.4, zc - 0.05, 24, 0.11, "arcVio", h=0.02)                               # the orbit,
    k.box(0.4 * math.cos(0.9), 0.4 * math.sin(0.9), zc - 0.08, 0.1, 0.06, 0.07, "arcVio", top="arcVio",
          rz=0.9 + 1.57)                                                                 # a ship on it
    for a, r, dz in ((2.4, 0.4, 0.14), (4.0, 0.36, -0.12), (5.3, 0.42, 0.08)):           # asteroids
        k.box(r * math.cos(a), r * math.sin(a), zc + dz, 0.06, 0.06, 0.06, "arcVio", top="arcVio")
    for a in (0.3, 2.4, 4.5):                                                            # beams from the ring
        k.box(0.2 * math.cos(a), 0.2 * math.sin(a), Z(28.6), 0.014, 0.014, zc - R - Z(28.6), "arcVio")
    return k


def c2():
    """Open-frame upright: the classic upright, its head an open frame with emitters in its corners."""
    k = Bench("arcade_c2", FP)
    W, S = 9, 11
    body(k, P(-W), P(W), [
        [(-12, 0), (7, 0), (8, 3), (8, 28), (-12, 28)],
        [(-12, 28), (8, 28), (13, 31), (13, 34), (6, 37), (-12, 37)]], BODY)  # the lower body and panel,
    body(k, P(-W), P(W), [[(-12, 37), (-9, 37), (-9, 56), (-12, 56)]], INNER)  # a thin dark back
    body(k, P(-W), P(W), [[(-12, 56), (6, 56), (6, 60), (-12, 60)]], BODY)    # the top bar,
    for u0, u1 in ((P(-S), P(-W)), (P(W), P(S))):                             # the posts: the side panels
        body(k, u0, u1, [[(-13, 0), (9, 0), (9, 28), (-13, 28)],
                         [(-13, 28), (9, 28), (14, 31), (14, 35), (7, 39), (7, 61), (-13, 61)]], BODY)
        trim(k, u0, u1, [(9, 0), (9, 28), (14, 31), (14, 35), (7, 39), (7, 61)], "arcVio")
    for u in (-W + 1.5, W - 1.5):                                             # emitters in the frame's top corners
        k.box(P(u), P(6.5), Z(54.5), P(2), P(1.5), Z(1.5), "arcVio", top="arcVio")
    slab(k, P(-W), P(W), (13, 34), (6, 37), 0.5, PANEL)
    stick(k, -4, 10.5, 34)
    for u, col in ((1, "arcBtnY"), (4, "arcBtnB"), (7, "arcBtnY")):
        button(k, u, 9.5, 35, col)
    blk(k, P(-4), P(4), P(8), P(8.6), Z(8), Z(22), CHROME)
    for u in (-2, 2):
        flat(k, P(u - 0.8), P(u + 0.8), P(8.6) + 0.006, Z(16), Z(19), "arcCoin")
    flat(k, P(-W), P(W), P(8) + 0.006, Z(0), Z(3), "arcChrD")
    side(k, P(S), P(-11), P(5), Z(12), Z(15), "arcVioF")
    return k.build()


def c2_holo():
    """The screen filling the frame, in bold horizontal shapes that hold at 1x: a sliced sun on the horizon, the floor's
    grid lines, the car; a title floating out in front of the top bar."""
    k = Bench("arcade_c2_holo", FP)
    v = P(5)
    vpanel(k, P(-7.5), P(7.5), v, Z(38), Z(55.5), "arcVioF")
    def lit(u0, u1, z0, z1):
        vpanel(k, P(u0), P(u1), v + 0.006, Z(z0), Z(z1), "arcVio")
    for z, w in ((48, 4.5), (50.5, 4), (53, 2.6)):                # the sun, in slices
        lit(-w, w, z, z + 1.6)
    lit(-7.5, 7.5, 46, 47)                                        # the horizon,
    for z in (43, 40.5):                                          # the floor's grid
        lit(-7.5, 7.5, z, z + 1)
    lit(-2, 2, 38.5, 41.5)                                        # the car
    vpanel(k, P(-9), P(9), P(7), Z(62), Z(67), "arcVioF")         # the floating title,
    for u0, u1 in ((-7.5, -3), (-1.5, 2.5), (4, 7.5)):
        vpanel(k, P(u0), P(u1), P(7) + 0.006, Z(63.5), Z(65.5), "arcVio")
    return k


def c3():
    """Holo pinball: a pinball table on legs (bumpers, flippers and lanes under its glass, a plunger, flipper buttons, a
    coin door), its backbox an emitter post at the rear."""
    k = Bench("arcade_c3", FP)
    for u in (-7.5, 7.5):                                         # the legs
        for v in (-10, 11):
            k.box(P(u), P(v), 0.0, P(2), P(2), Z(19), "arcChrD", top="arcChr")
            k.box(P(u), P(v), 0.0, P(3), P(3), Z(1), "arcChrD", top="arcChr")
    body(k, P(-9), P(9), [[(-12, 18), (13, 18), (13, 25), (-12, 29)]], BODY)                # the table, rising to the rear
    for u0, u1 in ((P(-9.5), P(-9)), (P(9), P(9.5))):
        trim(k, u0, u1, [(13, 18), (13, 25), (-12, 29)], "arcVio")
    slab(k, P(-8), P(8), (12, 25.2), (-11, 28.8), 0.3, one("arcBodyK"))                     # the playfield,
    lane = lambda f: (12 - 23 * f, 25.2 + 3.6 * f)                                            # noqa: E731
    for u, f, col in ((-3, 0.7, "arcScrP"), (3, 0.7, "arcCyan"), (0, 0.55, "arcBtnY")):     # the bumpers,
        v, z = lane(f)
        k.cyl(P(u), P(v), Z(z + 0.3), P(1.6), Z(1.5), col, top=col, sides=8)
    for u, a in ((-3, -0.5), (3, 0.5)):                                                      # the flippers,
        v, z = lane(0.15)
        k.box(P(u), P(v), Z(z + 0.3), P(4), P(1), Z(0.8), "arcChrL", top="arcChrL", rz=a)
    for u in (-6, 6):                                                                        # the lanes
        v0, z0 = lane(0.3)
        v1, z1 = lane(0.9)
        slab(k, P(u - 0.4), P(u + 0.4), (v0, z0 + 0.3), (v1, z1 + 0.3), 0.6, one("arcChr"))
    k.part("glass").box(0.0, P(0.5), Z(25), P(17), P(24), Z(4.5), "glassL")                # the glass (a rough wedge)
    k.cyl(P(6), P(13.5), Z(20.5), P(0.7), Z(1), "arcChr", top="arcChrL", sides=8)           # the plunger,
    k.box(P(6), P(14.5), Z(20.2), P(1.6), P(1), Z(1.6), "arcStick", top="arcStick")
    side(k, P(9), P(9), P(11), Z(22), Z(24), "arcBtnB")                                      # a flipper button,
    blk(k, P(-4), P(2), P(13), P(13.5), Z(19), Z(24), CHROME)                               # the coin door,
    flat(k, P(-2), P(0), P(13.5) + 0.006, Z(21), Z(23), "arcCoin")
    blk(k, P(-6), P(6), P(-12), P(-9), Z(29), Z(33), BODY)                                  # the emitter post,
    flat(k, P(-5), P(5), P(-9) + 0.006, Z(31), Z(32.5), "arcVio")                           # its lens
    return k.build()


def c3_holo():
    """The backglass as a hologram over the rear: the game's title, art (a planet and a rocket), the score."""
    k = Bench("arcade_c3_holo", FP)
    v = P(-10.5)
    vpanel(k, P(-11), P(11), v, Z(34), Z(58), "arcVioF")
    for u0, u1, z0, z1 in ((-11, 11, 34, 35), (-11, 11, 57, 58), (-11, -10, 34, 58), (10, 11, 34, 58),   # the frame,
                           (-8, -2, 52, 54.5), (0, 3, 52, 54.5), (5, 8, 52, 54.5),                        # the title,
                           (-7, 7, 37, 38.5)):                                                            # the score
        vpanel(k, P(u0), P(u1), v + 0.006, Z(z0), Z(z1), "arcVio")
    k.cyl(P(-4), v + 0.01, Z(41), P(3.5), Z(8), "arcVio", top="arcVio", sides=10)        # the planet (a disc on the glass)
    k.box(P(4), v + 0.012, Z(40), P(1.6), 0.004, Z(9), "arcVio")                         # the rocket,
    k.box(P(4), v + 0.012, Z(40), P(3.6), 0.004, Z(2), "arcVio")                         # its fins
    return k


# ---- round 4: variants of C1 (the drum, its front console, the emitter ring, a game in the round) --------------------

GOLD = ("arcGoldL", "arcGold", "arcGoldD")


def console(k, ramp, w=8):
    """C1's control console jutting from the drum's front: a sloped panel, the stick, two buttons, a coin slot."""
    body(k, P(-w), P(w), [[(5, 6), (9, 6), (15, 20), (15, 24), (10, 26), (5, 26)]], ramp)
    slab(k, P(-w), P(w), (15, 24), (10, 26), 0.5, PANEL)
    stick(k, -3.5, 13.5, 24.5)
    for u, col in ((1.5, "arcBtnY"), (4.5, "arcBtnB")):
        button(k, u, 13, 25, col)
    slab(k, P(-2), P(2), (10.3, 9), (11.6, 12), 0.3, one("arcCoin"), d=0.8)


def emitter(k, glow, deck=("arcChrD", "arcChr"), z=26):
    """The chrome deck on the drum's top, the lit emitter ring, its dark lens well."""
    k.cyl(0.0, 0.0, Z(z), 0.38, Z(2), deck[0], top=deck[1], sides=16)
    k.cyl(0.0, 0.0, Z(z + 2), 0.3, Z(0.6), glow, top=glow, sides=16)
    k.cyl(0.0, 0.0, Z(z + 2), 0.25, Z(1), "arcBodyK", top="arcBodyK", sides=16)


def seams(k, r, z0, h, col, angles=(0.6, 2.2, 3.9, 5.4)):
    for a in angles:
        k.box(r * math.cos(a), r * math.sin(a), Z(z0), 0.012, 0.012, Z(h), col, rz=a)


def beams(k, col, top, r=0.2, angles=(0.3, 2.4, 4.5)):
    for a in angles:
        k.box(r * math.cos(a), r * math.sin(a), Z(28.6), 0.014, 0.014, top - Z(28.6), col)


def planet(k, zc, R, film, lit):
    for z0, z1, r0, r1 in ((-1, -0.5, 0.3, 0.85), (-0.5, 0.5, 0.85, 0.85), (0.5, 1, 0.85, 0.3)):
        k.cyl(0.0, 0.0, zc + z0 * R, r0 * R, (z1 - z0) * R, film, top=film, sides=12, rtop=r1 * R)
    for dz, r in ((-0.5, 0.86), (0.0, 0.87), (0.5, 0.86)):
        k.cyl(0.0, 0.0, zc + dz * R - 0.008, r * R, 0.016, lit, top=lit, sides=12)


def d1():
    """White drum, cyan: C1 in a white shell with cyan seams and ring, chrome deck, a dark console."""
    k = Bench("arcade_d1", FP)
    k.cyl(0.0, 0.0, 0.0, 0.4, Z(3), "arcBodyK", top="arcBodyK", sides=16)
    k.cyl(0.0, 0.0, Z(3), 0.36, Z(23), "arcShellD", top="arcShell", sides=16)
    k.cyl(0.0, 0.0, Z(12), 0.365, Z(2), "arcChrD", top="arcChr", sides=16)              # a chrome belt
    emitter(k, "arcCyan")
    seams(k, 0.365, 15, 9, "arcCyan")
    console(k, BODY)
    return k.build()


def d1_holo():
    """A cyan planet with lit rings, a pink moon and an amber ship on a cyan orbit, cyan beams."""
    k = Bench("arcade_d1_holo", FP)
    zc = Z(50)
    planet(k, zc, 0.17, "arcCyanF", "arcCyan")
    ring_of(k, 0.4, zc - 0.05, 24, 0.11, "arcCyan", h=0.02)
    a = 2.6
    k.cyl(0.4 * math.cos(a), 0.4 * math.sin(a), zc - 0.08, 0.06, 0.12, "arcPinkF", top="arcPink", sides=10)   # the moon
    a = 0.9
    k.box(0.4 * math.cos(a), 0.4 * math.sin(a), zc - 0.08, 0.1, 0.06, 0.07, "arcAmb", top="arcAmb", rz=a + 1.57)
    for a, r, dz in ((4.0, 0.36, -0.12), (5.3, 0.42, 0.08)):
        k.box(r * math.cos(a), r * math.sin(a), zc + dz, 0.05, 0.05, 0.05, "arcAmbF", top="arcAmb")
    beams(k, "arcCyan", zc - 0.17)
    return k


def d2():
    """Brass arena: a dark drum banded in brass, an amber ring, the console in brass."""
    k = Bench("arcade_d2", FP)
    k.cyl(0.0, 0.0, 0.0, 0.4, Z(3), "arcGoldD", top="arcGold", sides=16)
    k.cyl(0.0, 0.0, Z(3), 0.36, Z(23), "arcBodyD", top="arcBody", sides=16)
    for z in (6, 18):
        k.cyl(0.0, 0.0, Z(z), 0.365, Z(1.2), "arcGoldD", top="arcGold", sides=16)        # brass bands
    emitter(k, "arcAmb", deck=("arcGoldD", "arcGoldL"))
    seams(k, 0.365, 8, 9, "arcAmb", angles=(0.4, 1.4, 2.4, 3.4, 4.4, 5.4))
    console(k, GOLD)
    return k.build()


def d2_holo():
    """A battle arena floating over the ring: an amber grid platform, a pink and a cyan fighter on it, a shot between
    them, the score as a halo above; amber beams."""
    k = Bench("arcade_d2_holo", FP)
    zp, h = Z(44), 0.3
    k.box(0.0, 0.0, zp, 2 * h, 2 * h, 0.01, "arcAmbF", top="arcAmbF")                   # the platform,
    for i in range(5):                                                                   # its grid
        t = -h + i * h / 2
        k.box(t, 0.0, zp + 0.01, 0.014, 2 * h, 0.006, "arcAmb", top="arcAmb")
        k.box(0.0, t, zp + 0.01, 2 * h, 0.014, 0.006, "arcAmb", top="arcAmb")
    for (u, v), film, lit in (((-0.15, -0.12), "arcPinkF", "arcPink"), ((0.14, 0.13), "arcCyanF", "arcCyan")):
        k.box(u, v, zp + 0.01, 0.07, 0.07, 0.09, film, top=lit)                         # the fighters,
        k.box(u, v, zp + 0.1, 0.04, 0.04, 0.04, lit, top=lit)
    k.box(0.0, 0.0, zp + 0.06, 0.24, 0.014, 0.014, "arcPink", rz=0.8)                    # a shot
    ring_of(k, 0.16, Z(60), 14, 0.07, "arcAmb", h=0.02)                                  # the score halo
    beams(k, "arcAmb", zp, r=0.22, angles=(0.8, 2.4, 3.9, 5.5))
    return k


def d3():
    """Teal hourglass: the drum pinched at the waist (a wide foot, a narrow waist, the deck flaring out), teal with
    chrome bands and a green ring."""
    k = Bench("arcade_d3", FP)
    k.cyl(0.0, 0.0, 0.0, 0.4, Z(3), "arcBodyK", top="arcBodyK", sides=16)
    k.cyl(0.0, 0.0, Z(3), 0.37, Z(11), "arcTealD", top="arcTeal", sides=16, rtop=0.24)  # the foot tapering in,
    k.cyl(0.0, 0.0, Z(14), 0.24, Z(12), "arcTealD", top="arcTealL", sides=16, rtop=0.36)  # flaring out to the deck
    k.cyl(0.0, 0.0, Z(13.5), 0.25, Z(1), "arcChrD", top="arcChr", sides=16)              # a chrome band at the waist
    emitter(k, "arcGrn")
    console(k, TEAL, w=7)
    return k.build()


def d3_holo():
    """Falling blocks: a green well outlined in light, settled blocks at its foot, a piece falling, green beams."""
    k = Bench("arcade_d3_holo", FP)
    w, z0, z1 = 0.17, Z(33), Z(60)
    for u in (-w, w):                                                                    # the well's edges
        for v in (-w, w):
            k.box(u, v, z0, 0.014, 0.014, z1 - z0, "arcGrn")
    for z in (z0, z1):
        for u in (-w, w):
            k.box(u, 0.0, z, 0.014, 2 * w, 0.014, "arcGrn")
        for v in (-w, w):
            k.box(0.0, v, z, 2 * w, 0.014, 0.014, "arcGrn")
    s = 0.085
    cols = (("arcPinkF", "arcPink"), ("arcAmbF", "arcAmb"), ("arcCyanF", "arcCyan"), ("arcGrnF", "arcGrn"))
    for i, (u, v, lev, c) in enumerate(((-1, -1, 0, 0), (0, -1, 0, 0), (1, -1, 0, 1), (-1, 0, 0, 2), (0, 0, 0, 1),
                                        (1, 0, 0, 1), (-1, 1, 0, 2), (1, 1, 0, 3), (-1, -1, 1, 3), (1, 0, 1, 0))):
        film, lit = cols[c]
        k.box(u * s, v * s, z0 + lev * s * 1.1, s * 0.92, s * 0.92, s, lit, top=lit)      # the settled blocks, lit,
    for u, v, lev in ((0, 0, 4), (1, 0, 4), (0, 0, 5), (0, 0, 6)):                       # the falling piece
        k.box(u * s, v * s, z0 + lev * s * 1.1, s * 0.92, s * 0.92, s, "arcPink", top="arcPink")
    beams(k, "arcGrn", z0)
    return k


# ---- round 5: holograms that read as a game (score, lives, shots, a goal) --------------------------------------------

def pips(k, u0, v, z, n, col, step=0.05, size=0.03):
    """A row of small lit blocks along u (lives, score digits)."""
    for i in range(n):
        k.box(u0 + i * step, v, z, size, size, size, col, top=col)


def e1():
    """Paddle court: a squat eight-sided drum, navy with a white belt, a cyan ring, the console."""
    k = Bench("arcade_e1", FP)
    k.cyl(0.0, 0.0, 0.0, 0.42, Z(3), "arcBodyK", top="arcBodyK", sides=8)
    k.cyl(0.0, 0.0, Z(3), 0.39, Z(23), "arcBodyD", top="arcBody", sides=8)
    k.cyl(0.0, 0.0, Z(15), 0.395, Z(2.5), "arcShellD", top="arcShell", sides=8)          # a white belt
    k.cyl(0.0, 0.0, Z(26), 0.41, Z(2), "arcChrD", top="arcChr", sides=8)
    k.cyl(0.0, 0.0, Z(28), 0.3, Z(0.6), "arcCyan", top="arcCyan", sides=16)
    k.cyl(0.0, 0.0, Z(28), 0.25, Z(1), "arcBodyK", top="arcBodyK", sides=16)
    console(k, BODY)
    return k.build()


def e1_holo():
    """A wide court tilted toward the player, laid out as the classic paddle game: paddles on the left and right ends,
    a dashed centre line down the middle, the ball crossing with its trail, both scores in the far half; cyan beams."""
    k = Bench("arcade_e1_holo", FP)
    a, b = (12, 36), (-13, 51)                                    # the court's near and far edges (v, z px)
    U = 15
    slab(k, P(-U), P(U), a, b, 0.3, one("arcCyanF"))
    def at(f):
        return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
    def lit(u0, u1, f0, f1, col):
        slab(k, P(u0), P(u1), at(f0), at(f1), 0.3, one(col), d=0.3)
    lit(-U, U, 0.0, 0.04, "arcCyan")                              # the border,
    lit(-U, U, 0.96, 1.0, "arcCyan")
    lit(-U, -U + 1, 0.0, 1.0, "arcCyan")
    lit(U - 1, U, 0.0, 1.0, "arcCyan")
    for f in (0.08, 0.26, 0.44, 0.62, 0.8):                       # the centre line, dashed, down the middle
        lit(-0.6, 0.6, f, f + 0.1, "arcCyan")
    lit(-U + 2, -U + 3.5, 0.3, 0.55, "arcAmb")                    # the left paddle,
    lit(U - 3.5, U - 2, 0.5, 0.75, "arcPink")                     # the right one,
    lit(5, 7.5, 0.42, 0.5, "arcAmb")                              # the ball,
    for u, f in ((2.5, 0.44), (0, 0.46), (-2.5, 0.48)):           # its trail, back toward the left paddle
        lit(u, u + 1.6, f, f + 0.05, "arcAmbF")
    for u0 in (-8, 4):                                            # the scores, in the court's colour, small
        lit(u0, u0 + 1.4, 0.78, 0.9, "arcCyan")
        lit(u0 + 2.4, u0 + 3.8, 0.78, 0.9, "arcCyan")
    for u in (-10, 10):                                           # beams to the court's near edge
        k.box(P(u), P(6), Z(28.6), 0.014, 0.014, Z(39) - Z(28.6), "arcCyan")
    return k


def e2():
    """Platformer: a two-tier drum (a wide navy base, a narrower teal tier carrying the ring), the console on the base."""
    k = Bench("arcade_e2", FP)
    k.cyl(0.0, 0.0, 0.0, 0.42, Z(3), "arcBodyK", top="arcBodyK", sides=16)
    k.cyl(0.0, 0.0, Z(3), 0.39, Z(15), "arcBodyD", top="arcBody", sides=16)              # the base,
    k.cyl(0.0, 0.0, Z(18), 0.4, Z(1.5), "arcChrD", top="arcChr", sides=16)               # its rim,
    k.cyl(0.0, 0.0, Z(19.5), 0.29, Z(12), "arcTealD", top="arcTealL", sides=16)         # the upper tier,
    seams(k, 0.295, 21, 9, "arcGrn", angles=(0.2, 1.8, 3.4, 5.0))
    emitter(k, "arcGrn", z=31)
    console(k, BODY, w=7)
    return k.build()


def stage(k, z0, z1, r, lit, film):
    """The projection's bounds, so the game reads as one thing: a film disc with a lit rim at its foot, a lit ring
    capping it."""
    k.cyl(0.0, 0.0, z0, r, 0.006, film, top=film, sides=16)
    ring_of(k, r, z0, 20, r * 0.33, lit, h=0.014)
    ring_of(k, r, z1, 20, r * 0.33, lit, h=0.014)


def e2_holo():
    """A girder climber on a wide upright panel over the drum: sloped pink girders zigzagging up, cyan ladders joining
    them, amber crates rolling down, the climber at the foot, a robot boss at the top beside the goal star, the score
    and lives across the top; on a green stage."""
    k = Bench("arcade_e2_holo", FP)
    stage(k, Z(35), Z(35), 0.3, "arcGrn", "arcGrnF")
    v = P(1)
    U, z0, z1 = 15, 37, 71
    def poly(pts, col, dv=0.0):
        prism(k, "v", v + dv, v + dv + 0.004, pz(pts), one(col))
    def rect(u0, u1, za, zb, col, dv=0.006):
        poly([(u0, za), (u1, za), (u1, zb), (u0, zb)], col, dv)
    rect(-U, U, z0, z1, "arcGrnF", dv=0.0)                        # the screen,
    rect(-U, U, z0, z0 + 0.8, "arcGrn")                           # its frame
    rect(-U, U, z1 - 0.8, z1, "arcGrn")
    rect(-U, -U + 0.8, z0, z1, "arcGrn")
    rect(U - 0.8, U, z0, z1, "arcGrn")
    girders = (((-13, 40), (13, 42.5)), ((-13, 50.5), (13, 48)), ((-13, 56), (13, 58.5)), ((-13, 64), (2, 64)))
    for (ua, za), (ub, zb) in girders:                            # the girders, sloping
        poly([(ua, za), (ub, zb), (ub, zb + 1.6), (ua, za + 1.6)], "arcPink")
    for u, za, zb in ((9, 42.2, 48), (-9, 50.2, 56), (-3, 57.4, 64)):   # the ladders: two rails and rungs
        rect(u - 1.2, u - 0.6, za, zb, "arcCyan")
        rect(u + 0.6, u + 1.2, za, zb, "arcCyan")
        z = za + 1.2
        while z < zb - 0.5:
            rect(u - 1.2, u + 1.2, z, z + 0.5, "arcCyan")
            z += 1.6
    for u, z in ((4, 50.6), (-6, 58.1), (7, 44.3)):              # the crates, rolling down
        rect(u - 1.2, u + 1.2, z, z + 2.4, "arcAmb")
    rect(-11, -9, 42, 45, "arcCyan")                              # the climber,
    rect(-11, -9, 45, 46.6, "arcAmb")
    rect(-12, -7, 65.6, 69.5, "arcGrn")                           # the robot boss,
    rect(-11, -10, 67.4, 68.4, "arcPink")
    rect(-9, -8, 67.4, 68.4, "arcPink")
    rect(-0.5, 1.5, 66, 68, "arcAmb")                             # the goal star,
    for i in range(3):                                            # the lives,
        rect(6 + i * 2.3, 7.4 + i * 2.3, 67, 68.6, "arcPink")
    return k


def e3():
    """Tower shooter: a tall slim drum, dark with pink seams, a pink ring, a slimmer console."""
    k = Bench("arcade_e3", FP)
    k.cyl(0.0, 0.0, 0.0, 0.38, Z(3), "arcBodyK", top="arcBodyK", sides=16)
    k.cyl(0.0, 0.0, Z(3), 0.32, Z(29), "arcBodyD", top="arcBody", sides=16)
    for z in (8, 26):
        k.cyl(0.0, 0.0, Z(z), 0.325, Z(1), "arcChrD", top="arcChr", sides=16)
    seams(k, 0.325, 10, 15, "arcPink", angles=(0.4, 1.4, 2.4, 3.4, 4.4, 5.4))
    k.cyl(0.0, 0.0, Z(32), 0.34, Z(2), "arcChrD", top="arcChr", sides=16)
    k.cyl(0.0, 0.0, Z(34), 0.27, Z(0.6), "arcPink", top="arcPink", sides=16)
    k.cyl(0.0, 0.0, Z(34), 0.22, Z(1), "arcBodyK", top="arcBodyK", sides=16)
    console(k, BODY, w=6)
    return k.build()


def e3_holo():
    """The play runs up the beam: the cyan ship just over the ring, amber shots rising, two rings of enemies at the top
    (pink and green), one bursting, the score as a bar over it all; on a pink stage."""
    k = Bench("arcade_e3_holo", FP)
    stage(k, Z(37), Z(66), 0.3, "arcPink", "arcPinkF")
    zs = Z(40)
    k.box(0.0, 0.0, zs, 0.08, 0.14, 0.045, "arcCyan", top="arcCyan")                   # the ship,
    k.box(0.0, 0.02, zs, 0.24, 0.05, 0.03, "arcCyan", top="arcCyan")                    # its wings
    for dz in (0.12, 0.22, 0.32):                                                        # its shots
        k.box(0.0, 0.0, zs + dz, 0.022, 0.022, 0.06, "arcAmb", top="arcAmb")
    for r, z, n, col, size in ((0.22, Z(56), 6, "arcPink", 0.075), (0.12, Z(61), 4, "arcGrn", 0.065)):
        for i in range(n):
            a = i * math.tau / n + 0.3
            k.box(r * math.cos(a), r * math.sin(a), z, size, size, size * 0.8, col, top=col)   # the enemies
    a = 0.3 + math.tau / 6
    cu, cv, cz = 0.22 * math.cos(a), 0.22 * math.sin(a), Z(56) + 0.03
    for rz in (0.0, 0.785, 1.571, 2.356):                                                # a burst on one
        k.box(cu, cv, cz, 0.17, 0.016, 0.016, "arcAmb", rz=rz)
    pips(k, -0.12, P(-4), Z(69), 5, "arcCyan", step=0.06, size=0.035)                   # the score
    return k


def jobs():
    out = [(f"module.arcade.{v}", FP, "prop", f) for v, f in (("a1", a1), ("a2", a2), ("a3", a3), ("b1", b1),
                                                              ("b2", b2), ("b3", b3), ("c1", c1), ("c2", c2),
                                                              ("c3", c3), ("d1", d1), ("d2", d2), ("d3", d3),
                                                              ("e1", e1), ("e2", e2), ("e3", e3))]
    return out + [holo_job(f"module.arcade.{v}.holo", cab, holo) for v, cab, holo in
                  (("b1", b1, b1_holo), ("c1", c1, c1_holo), ("c2", c2, c2_holo), ("c3", c3, c3_holo),
                   ("d1", d1, d1_holo), ("d2", d2, d2_holo), ("d3", d3, d3_holo),
                   ("e1", e1, e1_holo), ("e2", e2, e2_holo), ("e3", e3, e3_holo))]
