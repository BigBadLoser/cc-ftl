"""The arcade cabinet's parts (approved look study j2): the round drum with a recessed projector, a brick breaker on a
near-upright hologram screen. `arcade.py` builds the module from these: `j` the cabinet, `j2_holo` its hologram, `BALL`
the play frames; `film` and `ring_of` are shared with the game table's hologram.

Units: P(n) = n px along u or v (1/32 tile), Z(n) = n z px. Width runs along u, depth along v, the front at +v."""
import math

from .research_kit import Bench, bar
from .research_r13 import P, Z
from .research_r15 import prism

FP = (1, 1)
BODY = ("arcBodyL", "arcBody", "arcBodyD")
PANEL = ("arcPanel", "arcPanel", "arcPanelD")


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


def stick(k, u, v, z, ball="arcStick"):
    """A joystick: a post with a ball on top, 4 px."""
    k.cyl(P(u), P(v), Z(z), P(0.6), Z(3), "arcChrD", top="arcChr", sides=8)
    k.box(P(u), P(v), Z(z + 3), P(2.4), P(2.4), Z(2.2), ball, top=ball)


def button(k, u, v, z, col):
    k.box(P(u), P(v), Z(z), P(1.6), P(1.6), Z(1), col, top=col)


def ring_of(k, r, z, n, w, col, h=0.004):
    """A flat lit ring of n short tangent bars, radius r at height z."""
    for i in range(n):
        a = i * math.tau / n
        k.box(r * math.cos(a), r * math.sin(a), z, w, 0.012, h, col, top=col, rz=a + math.pi / 2)


def console(k, ramp, w=8, coin="arcCoin"):
    """C1's control console jutting from the drum's front: a sloped panel, the stick, two buttons, a coin slot."""
    body(k, P(-w), P(w), [[(5, 6), (9, 6), (15, 20), (15, 24), (10, 26), (5, 26)]], ramp)
    slab(k, P(-w), P(w), (15, 24), (10, 26), 0.5, PANEL)
    stick(k, -3.5, 13.5, 24.5)
    for u, col in ((1.5, "arcBtnY"), (4.5, "arcBtnB")):
        button(k, u, 13, 25, col)
    slab(k, P(-2), P(2), (10.3, 9), (11.6, 12), 0.3, one(coin), d=0.8)


def seams(k, r, z0, h, col, angles=(0.6, 2.2, 3.9, 5.4)):
    for a in angles:
        k.box(r * math.cos(a), r * math.sin(a), Z(z0), 0.012, 0.012, Z(h), col, rz=a)


ROWS = ("arcCyan", "arcGrn", "arcAmb", "arcPink")
BALL = ((-6, 0.24), (-3, 0.33), (0, 0.42), (3.5, 0.5), (1.5, 0.4), (-2.5, 0.31))   # the ball's (u px, f) per frame
PADDLE = (-6, -5, -4, -3, -4, -5)                                                    # the paddle's middle (u px)
HIT, HIT_FRAME = (0, 3), 3                                                           # the brick it strikes, and when
TILT_A, TILT_B, TILT_W = (0, 42), (-5, 69), 14                      # the screen's foot (over the ring's middle) and


def tilt_screen(k, a=None, b=None, frame=None):
    """G2's game: a screen standing near upright to face the player, a lit cyan border, the bricks raised off it, the paddle up off its
    foot, the ball crossing with its trail glowing flat on the screen. Returns its corners (foot left, foot right, head
    right, head left) in tile units."""
    a, b, W = a or TILT_A, b or TILT_B, TILT_W
    def at(f):
        return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
    def lit(u0, u1, f0, f1, col, t=0.4, d=0.3):
        slab(k, P(u0), P(u1), at(f0), at(f1), t, one(col), d=d)
    lit(-W, W, 0.0, 0.03, "arcCyan")                                                     # the border
    lit(-W, W, 0.97, 1.0, "arcCyan")
    lit(-W, -W + 1, 0.0, 1.0, "arcCyan")
    lit(W - 1, W, 0.0, 1.0, "arcCyan")
    gone = {(0, 1), (0, 3), (1, 3), (0, 4)}
    for r, col in enumerate(ROWS):                                                       # the bricks, raised
        for c, u in enumerate((-10, -5, 0, 5, 10)):
            if (r, c) not in gone:
                hit = frame is not None and frame == HIT_FRAME and (r, c) == HIT
                lit(u - 2.1, u + 2.1, 0.56 + r * 0.1, 0.64 + r * 0.1, "arcMarq" if hit else col, t=2.0)
    if frame is None:                                                                    # the study's still:
        lit(-6, 1, 0.12, 0.17, "arcCyan", t=1.6)                                         # the paddle,
        lit(4, 6.4, 0.34, 0.42, "arcAmb", t=2.0)                                         # the ball,
        for u, f, w in ((2.4, 0.3, 1.6), (0.8, 0.255, 1.2), (-0.6, 0.22, 0.8)):          # its trail
            lit(u, u + w, f, f + 0.04, "arcAmb", t=0.4)
    else:                                                                                # a frame of play
        (bu, bf), (pu, pf) = BALL[frame], BALL[frame - 1]
        lit(PADDLE[frame] - 3.5, PADDLE[frame] + 3.5, 0.12, 0.17, "arcCyan", t=1.6)
        lit(bu - 1.2, bu + 1.2, bf - 0.04, bf + 0.04, "arcAmb", t=2.0)
        for g, w in ((0.35, 1.6), (0.65, 1.1)):                                          # the trail, back toward
            tu, tf = bu + (pu - bu) * g, bf + (pf - bf) * g                              # where it was
            lit(tu - w / 2, tu + w / 2, tf - 0.02, tf + 0.02, "arcAmb", t=0.4)
    return [(P(-W), P(a[0]), Z(a[1])), (P(W), P(a[0]), Z(a[1])), (P(W), P(b[0]), Z(b[1])), (P(-W), P(b[0]), Z(b[1]))]


def film(k, pts, col="arcCyanF"):
    """A flat film polygon through 3D points (u, v, z), seen from both sides."""
    from .core import G as GV
    q = [GV(*k.p(u, v), z) for u, v, z in pts]
    k.m.poly(q, col)
    k.m.poly(q[::-1], col)


def lerp(p, q, f):
    return tuple(p[i] + (q[i] - p[i]) * f for i in range(3))


J_A, J_B = (6, 45), (2, 71)                                          # the screen's foot and head, in front of the
                                                                     # lens, so the beam meets it from behind
J_LENS = (0.0, 0.0, Z(29.7))


def j(rot=0, off=False):
    """The cabinet: a round navy drum on a dark kick, a chrome belt and lit seams, the control console in front; a
    recessed projector on top (a raised chrome collar with a lit rim round a dark well, the lens in a chrome housing at
    the well's floor, three struts holding the housing). `off`: unpowered, every light dark."""
    glow = "arcCyanOff" if off else "arcCyan"
    k = Bench("arcade_j", FP, rot)
    k.cyl(0.0, 0.0, 0.0, 0.4, Z(3), "arcBodyK", top="arcBodyK", sides=16)
    k.cyl(0.0, 0.0, Z(3), 0.37, Z(23), "arcBodyD", top="arcBody", sides=16)
    k.cyl(0.0, 0.0, Z(12), 0.375, Z(2), "arcChrD", top="arcChr", sides=16)
    seams(k, 0.375, 15, 9, glow)
    k.cyl(0.0, 0.0, Z(26), 0.38, Z(2), "arcChrD", top="arcChr", sides=16)              # the deck,
    k.cyl(0.0, 0.0, Z(28), 0.3, Z(0.3), "arcBodyK", top="arcBodyK", sides=16)          # the well's dark floor,
    n, r = 24, 0.335
    for i in range(n):                                                                   # the collar round it,
        a = i * math.tau / n
        k.box(r * math.cos(a), r * math.sin(a), Z(28), math.tau * r / n * 1.12, 0.07, Z(3.5), "arcChrD",
              top="arcChr", rz=a + math.pi / 2)
    ring_of(k, r, Z(31.5), n, 0.095, glow, h=Z(0.4))                              # its lit rim
    for a in (0.5, 2.6, 4.7):                                                            # the struts,
        k.box(0.2 * math.cos(a), 0.2 * math.sin(a), Z(28.3), 0.16, 0.025, Z(0.8), "arcChrD", top="arcChr", rz=a)
    k.cyl(0.0, 0.0, Z(28.3), 0.1, Z(1.2), "arcChrD", top="arcChr", sides=12)            # the lens housing,
    k.cyl(0.0, 0.0, Z(29.5), 0.065, Z(0.3), glow, top=glow, sides=12)        # the lens
    console(k, BODY, coin="arcCoinOff" if off else "arcCoin")
    return k.build()


def j2_holo(rot=0, frame=None):
    """Ray fan out of the well: lit rays to the corners, film-coloured rays to points along the foot and sides. The
    arcade module's hologram (arcade.py), `frame` its frame of play."""
    k = Bench("arcade_j2_holo", FP, rot)
    c = tilt_screen(k, J_A, J_B, frame)
    for q in c:
        bar(k, J_LENS, q, 0.01, "arcCyan")
    for f in (0.2, 0.4, 0.6, 0.8):
        bar(k, J_LENS, lerp(c[0], c[1], f), 0.01, "arcCyanF")
    for f in (0.33, 0.66):
        bar(k, J_LENS, lerp(c[0], c[3], f), 0.01, "arcCyanF")
        bar(k, J_LENS, lerp(c[1], c[2], f), 0.01, "arcCyanF")
    return k
