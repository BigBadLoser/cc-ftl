"""Bar look study round 6 (family `barcounter6`, palette set bar6, preview only; heights as barcounter_study.py: counter
top 24 px, stool seats 15): three new formats, none a plain counter with a back bar. Each makes plain where the drinks
come from at a glance.

  h1 island bar (2x2): a round counter ringing a tall glass drink column, its layers of drink piped to taps round its
     foot; self-serve, so no bartender's side; three stools round the front
  h2 container bar (3x2): a rust cargo container on the back row with its long side swung up into an awning on struts;
     inside, shelves of bottles and a lamp; its lower half is the counter, a wood ledge on it; stools on the front row
  h3 robot bar (3x2): a slate counter with a wood top; behind it a yellow industrial arm pours from a bottle into a glass
     on the counter, beside a two-tier bottle carousel and a glass rack

All in px of the tile (u across, v deep, front +v toward the camera, z up)."""
import math

from .barcounter_r3 import cyl, lathe
from .barcounter_study import SEAT, TOP, ZPX
from .bunk_study import _px
from .research_kit import Bench

FP3, FP2 = (3, 2), (2, 2)
BOTTLES = ("b6Amber", "b6Ruby", "b6Mint", "b6Glass")


def seg(k, a, b, v, w, col):
    """A square bar w px thick from a = (u, z) to b = (u, z) in px, at depth v: a box along z tilted about v."""
    du, dz = (b[0] - a[0]) / 32, (b[1] - a[1]) / ZPX
    n = math.hypot(du, dz)
    cu, cz = (a[0] + b[0]) / 64, (a[1] + b[1]) / 2 / ZPX
    k.box(cu, v / 32, cz - n / 2, w / 32, w / 32, n, col, ry=math.atan2(du, dz))


def seg3(k, a, b, w, col, su=None):
    """A bar w px thick (su px wide along u, default w) from a = (u, v, z) to b in px: a box along z tilted onto a-b."""
    d = ((b[0] - a[0]) / 32, (b[1] - a[1]) / 32, (b[2] - a[2]) / ZPX)
    n = math.sqrt(sum(x * x for x in d))
    c = ((a[0] + b[0]) / 64, (a[1] + b[1]) / 64, (a[2] + b[2]) / 2 / ZPX)
    k.box(c[0], c[1], c[2] - n / 2, (su or w) / 32, w / 32, n, col, rx=math.asin(-d[1] / n), ry=math.atan2(d[0], d[2]))


def bottle(k, u, v, z, col, h=7, r=1.5):
    cyl(k, u, v, z, z + h - 2, r, col)
    cyl(k, u, v, z + h - 2, z + h, 0.6, col)


def stool(k, u, v, seat, stem="b6Char"):
    """A pedestal stool: a disc foot, a stem, a round cushion."""
    cyl(k, u, v, 0, 1, 4, stem)
    cyl(k, u, v, 1, SEAT - 2, 1, stem)
    cyl(k, u, v, SEAT - 2, SEAT, 5, seat)


# ---- h1 island bar ------------------------------------------------------------------------------------------------
def h1():
    k = Bench("bar_h1", FP2)
    g = k.part("glass")
    lathe(k, 0, -4, ((0, 17), (2, 17)), "b6Char", sides=24)                          # recessed plinth
    lathe(k, 0, -4, ((2, 18), (TOP - 2, 18)), "b6Bone", sides=24)                   # the ring's body
    cyl(k, 0, -4, TOP - 2, TOP, 20.5, "b6Sage", sides=24)                            # its top, overhanging
    cyl(k, 0, -4, 9, 10, 18.4, "b6Brass", sides=24)                                  # a brass band round it
    lathe(k, 0, -4, ((TOP, 7.5), (TOP + 2, 7.5), (TOP + 2, 6)), "b6Brass", sides=16)  # the column's collar
    cyl(g, 0, -4, TOP + 2, 58, 7, "b6Glass", sides=16)                               # the glass column
    for z0, z1, col in ((TOP + 2, 36, "b6Amber"), (36, 45, "b6Ruby"), (45, 53, "b6Mint")):
        cyl(k, 0, -4, z0, z1, 5.6, col, sides=16)                                    # three layers of drink
    for z in (36, 45):
        cyl(k, 0, -4, z, z + 1, 6, "b6Brass", sides=16)                              # the trays between them
    cyl(k, 0, -4, 58, 61, 7, "b6Brass", sides=16)                                    # cap
    cyl(k, 0, -4, 61, 62, 2, "b6Lamp", sides=8)                                      # a lamp on top
    for a, col in ((-50, "b6Amber"), (0, "b6Ruby"), (50, "b6Mint")):                # taps to the front, one a layer
        r = math.radians(a + 90)
        tu, tv = 10 * math.cos(r), -4 + 10 * math.sin(r)
        cu, cv = 6.5 * math.cos(r), -4 + 6.5 * math.sin(r)
        _px(k, round(min(cu, tu)) - 1, round(max(cu, tu)) + 1, round(min(cv, tv)) - 1, round(max(cv, tv)) + 1,
            TOP + 8, TOP + 10, "b6Brass")                                            # spout
        cyl(k, tu, tv, TOP + 5, TOP + 8, 0.8, "b6Brass")
        cyl(k, tu, tv, TOP + 3, TOP + 5, 0.6, col)                                   # a drop of its drink
        cyl(k, tu, tv, TOP, TOP + 1, 2.4, "b6Char")                                  # drip pad
    cyl(g, 10 * math.cos(math.radians(90)), -4 + 10, TOP + 1, TOP + 6, 1.8, "b6Glass")  # a glass under the ruby tap
    for a in (-55, 0, 55):                                                           # stools round the front
        r = math.radians(a + 90)
        stool(k, 26 * math.cos(r), -4 + 26 * math.sin(r), "b6Sage")
    return k.build()


# ---- h2 container bar -------------------------------------------------------------------------------------------
def h2():
    k = Bench("bar_h2", FP3)
    g = k.part("glass")
    V0, V1, H = -31, -4, 44                                                          # the container's depth, height
    _px(k, -48, 48, V0, V1, 0, 2, "b6Char")                                          # skids
    _px(k, -48, 48, V0, V0 + 2, 2, H, "b6Rust")                                      # back wall
    _px(k, -46, 46, V0 + 2, V1, 2, 3, "b6Dark")                                      # floor inside
    _px(k, -46, 46, V0 + 2, V0 + 3, 3, H - 2, "b6Bone")                              # back wall, inside (lit)
    for u0 in (-48, 46):
        _px(k, u0, u0 + 2, V0, V1, 2, H, "b6Rust")                                   # ends
    _px(k, -48, 48, V0, V1, H - 2, H, "b6Rust")                                      # roof
    for u0 in (-48, 46):
        _px(k, u0, u0 + 2, V1, V1 + 1, 2, H, "b6RustD")                              # corner posts
    _px(k, -48, 48, V1, V1 + 1, H - 2, H, "b6RustD")                                 # top rail
    _px(k, -46, 46, V1 - 1, V1, 2, TOP - 2, "b6Rust")                                # the lower half of the side:
    for u in range(-44, 46, 4):                                                      # the counter's front, ribbed
        _px(k, u, u + 2, V1, V1 + 1, 3, TOP - 3, "b6RustD")
    _px(k, -48, 48, V1 - 3, V1 + 4, TOP - 2, TOP, "b6Wood")                          # wood ledge along it
    for v in range(V0 + 4, V1 - 2, 4):                                               # the ends' ribs
        _px(k, -49, -48, v, v + 2, 4, H - 4, "b6RustD")
        _px(k, 48, 49, v, v + 2, 4, H - 4, "b6RustD")
    # the upper half of the side, hinged at the top rail and swung up and out on two struts
    L, ang = H - TOP, math.radians(55)                                               # its height; swung up 55 deg
    tip = (V1 + L * math.cos(ang), H + L * math.sin(ang))                            # its far edge (v, z)
    seg3(k, (0, V1, H), (0, tip[0], tip[1]), 2, "b6Rust", su=96)                     # the panel
    for u in range(-44, 46, 4):
        seg3(k, (u + 1, V1 - 0.8, H + 1.2), (u + 1, tip[0] - 0.8, tip[1] + 1.2), 1.5, "b6RustD", su=2)   # its ribs
    for u in (-40, 40):
        seg3(k, (u, V1 + 2, TOP), (u, (V1 + tip[0]) / 2 + 1, (H + tip[1]) / 2), 1.5, "b6Char")   # struts
    # inside: shelves of bottles, a cooler, a lamp
    _px(k, -44, 20, V0 + 3, V0 + 14, 3, 15, "b6Wood")                                # a back cabinet,
    for z in (15, 24):                                                               # two tiers of bottles on it,
        if z > 15:
            _px(k, -44, 20, V0 + 3, V0 + 10, z, z + 1, "b6Wood")                     # the upper on a shelf
        for i, u in enumerate(range(-41, 19, 5)):
            bottle(k, u, V0 + (11 if z == 15 else 7), z + 1, BOTTLES[(i + z) % 4], h=8, r=1.8)
    _px(k, 24, 44, V0 + 3, V0 + 12, 3, TOP + 14, "b6Steel")                          # a cooler at the right
    _px(g, 26, 42, V0 + 12, V0 + 13, 6, TOP + 12, "b6Glass")                         # its glass door
    for z in (10, 18, 26):
        for u in range(28, 42, 4):
            bottle(k, u, V0 + 8, z, BOTTLES[(u // 4 + z) % 4], h=6, r=1.3)
    for u in (-24, 4):                                                               # lamps hung from the roof inside
        cyl(k, u, V0 + 20, H - 8, H - 2, 0.4, "b6Char")
        cyl(k, u, V0 + 20, H - 10, H - 8, 2.5, "b6Char", r1=1)
        cyl(k, u, V0 + 20, H - 11, H - 10, 2, "b6Lamp")
    for u in (-26, 10):
        cyl(g, u, V1 - 1, TOP, TOP + 5, 1.8, "b6Glass")                              # drinks on the ledge
        cyl(k, u, V1 - 1, TOP, TOP + 3, 1.5, "b6Amber" if u < 0 else "b6Ruby")
    for u in (-32, 0, 32):
        stool(k, u, 16, "b6Teal")
    return k.build()


# ---- h3 robot bar -----------------------------------------------------------------------------------------------
def h3():
    k = Bench("bar_h3", FP3)
    g = k.part("glass")
    _px(k, -48, 48, -15, -2, 0, 2, "b6Char")                                         # plinth
    _px(k, -48, 48, -16, 0, 2, TOP - 2, "b6Slate")                                   # body
    for u in (-16, 16):
        _px(k, u, u + 1, 0, 1, 4, TOP - 4, "b6Char")                                 # panel seams
    _px(k, -48, 48, -17, 2, TOP - 2, TOP, "b6Wood")                                  # wood top
    # the arm: a pedestal behind the counter, shoulder, upper arm up, forearm reaching forward over the counter
    AV = -26
    cyl(k, 0, AV, 0, 4, 7, "b6Char")
    cyl(k, 0, AV, 4, 30, 4.5, "b6Hivis")                                             # pedestal
    cyl(k, 0, AV, 30, 34, 5.5, "b6Char")                                             # turntable
    sh, el, wr = (0, AV, 37), (-6, AV + 4, 56), (-15, -9, 44)                        # shoulder, elbow, wrist (u, v, z)
    seg3(k, sh, el, 6, "b6Hivis")                                                    # upper arm
    seg3(k, el, wr, 5, "b6Hivis")                                                    # forearm
    for (u, v, z), r in ((sh, 4.5), (el, 3.5), (wr, 3)):
        k.box(u / 32, v / 32, (z - r) / ZPX, 2 * r / 32, 2 * r / 32, 2 * r / ZPX, "b6Char")   # joints
    # the gripper holds a bottle tipped over the glass on the counter, pouring
    b0, b1, b2 = (-14, -8, 46), (-21, -5, 37), (-23, -4, 34)                         # bottle base, shoulder, mouth
    seg3(k, b0, b1, 4, "b6Amber")                                                    # bottle body
    seg3(k, b1, b2, 2, "b6Amber")                                                    # its neck
    _px(k, -18, -13, -10, -6, 41, 44, "b6Char")                                      # the gripper's jaws round it
    _px(k, -24, -23, -5, -4, TOP + 5, 34, "b6Amber")                                 # the pour
    cyl(g, -23, -4, TOP, TOP + 6, 2.2, "b6Glass")                                    # the glass
    cyl(k, -23, -4, TOP, TOP + 3, 1.9, "b6Amber")
    # a two-tier bottle carousel at the right, a glass rack at the left
    cyl(k, 34, -24, 0, 2, 7, "b6Char")
    cyl(k, 34, -24, 2, 46, 1, "b6Steel")
    for z in (TOP + 4, TOP + 13):
        cyl(k, 34, -24, z, z + 1, 7, "b6Steel")
        for i in range(8):
            a = i * math.tau / 8
            bottle(k, 34 + 5 * math.cos(a), -24 + 5 * math.sin(a), z + 1, BOTTLES[i % 4], h=7, r=1.3)
    _px(k, -44, -28, -30, -20, 0, TOP + 8, "b6Slate")                                # glass rack cabinet
    for z in (TOP + 1, TOP + 5):
        for u in range(-42, -29, 4):
            cyl(g, u, -22, z, z + 3, 1.4, "b6Glass")
    cyl(k, -36, -25, TOP + 8, TOP + 9, 1, "b6Lamp")                                  # a status lamp
    for u in (-32, 0, 32):
        stool(k, u, 16, "b6Leather", stem="b6Steel")
    return k.build()


DESIGNS = {"h1": (FP2, h1), "h2": (FP3, h2), "h3": (FP3, h3)}


def jobs():
    return [(f"module.barcounter.{v}", fp, "prop", f) for v, (fp, f) in DESIGNS.items()]
