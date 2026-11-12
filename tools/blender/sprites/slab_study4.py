"""Stasis slab look study, round 4 (family `slab`, preview only; issue #116), after review of round 3: storage as
catalog modules is the direction; one more like the turntable but packed as a flap wheel; every cart a hover cart, three
ways of showing it floats. Sets (r0 only; the slabs are round 3's):

  s10 / c10  flap wheel (3x3): twelve ribbed blocks set radially round a turntable core like the cards of a flip
             display, their faces all turned one way round, so the faces on one side fan open to the room. Cart: a
             ground-effect sled, a lit skirt round its foot and a wide glow on the floor under it
  s11 / c11  jukebox (3x2): cassettes standing edge-on in a crate like records, a light on each top edge; a gantry
             has lifted one out and holds it tilted over the crate, its face to the room. Cart: a floating cradle, no
             deck: two emitter clamps hold the slab's ends in the air over a field sheet
  s12 / c12  paternoster (3x2): glass-cased slabs hung on a vertical loop between two towers, the front run tilted to
             the room so four faces show at once. Cart: two hover pods, one at each end, gripping the slab between
             them, beams down to the floor"""
import math

from .modkit import K
from .slab_study import L, T, W
from .slab_study3 import SlabF, cassette, glass, glass_case, glass_edges, ribbed

UP = (0.0, 0.0, 1.0)


def flap_wheel(k, skew=0.0):
    """s10: twelve ribbed blocks round a core, radial (or turned `skew` off radial, like turbine blades: s10b), faces
    all turned the same way round."""
    k.cyl(0, 0, 0.0, 1.48, 0.12, "dark", top="steelD", sides=48)
    k.cyl(0, 0, 0.07, 1.485, 0.02, "slbAmb", sides=48)
    k.cyl(0, 0, 0.12, 0.6, 2.12, "slbGr", top="slbGrL", sides=16)
    out = []
    n = 12
    for i in range(n):
        th = math.radians(45 + 360 * i / n)
        R = (math.cos(th), math.sin(th), 0.0)
        ts = th - skew
        N = (-math.sin(ts), math.cos(ts), 0.0)                              # the face looks round the wheel
        O = (R[0] * 1.05, R[1] * 1.05, 0.14)
        out.append(ribbed(k, SlabF(O, UP, N)))
    k.cyl(0, 0, 2.24, 1.46, 0.08, "dark", top="steelD", sides=48)
    k.cyl(0, 0, 2.32, 0.6, 0.08, "slbGr", top="slbGrL", sides=16)
    k.cyl(0, 0, 2.21, 1.465, 0.02, "slbAmb", sides=48)
    return out


def jukebox(k):
    """s11: cassettes on edge in a crate; a gantry over it holding one lifted out, tilted to the room."""
    k.box(0, 0.0, 0.0, 2.95, 1.95, 0.2, "dark", top="steelD")
    out = []
    xs = [-1.22 + i * 0.35 for i in range(8)]
    for i, u in enumerate(xs):
        if i == 4:
            continue                                                         # the one lifted out
        s = cassette(k, SlabF((u, -1.0, 0.2 + W / 2 + 0.04), (0.0, 1.0, 0.0), (1.0, 0.0, 0.0)))
        out.append(s)
        k.box(u - 0.02, 0.0, 0.2 + W + 0.08, 0.05, 0.3, 0.02, "slbCy" if i % 3 else "slbAmb")   # its top light
    for v in (-0.96, 0.96):                                                  # the crate's long walls
        k.box(0, v, 0.2, 2.9, 0.06, 0.5, "steelD", top="steel")
    for u in (-1.45, 1.45):
        k.box(u, 0.0, 0.2, 0.06, 1.95, 0.5, "steelD", top="steel")
        k.box(u, 0.0, 0.2, 0.12, 0.14, 2.4, "steel", top="steelL")          # the gantry's posts
    k.box(0, 0.0, 2.6, 3.0, 0.16, 0.12, "steelD", top="steel")               # its beam
    b = math.radians(40)
    N = (0.0, math.cos(b), math.sin(b))
    lifted = cassette(k, SlabF((-1.0, 0.05, 1.86), (1.0, 0.0, 0.0), N))
    out.append(lifted)
    for u in (-1.08, 1.08):                                                  # the carriage's hangers
        k.box(u, 0.0, 1.8, 0.06, 0.06, 0.82, "steel", top="steelL")
    k.box(0, 0.0, 2.5, 2.3, 0.2, 0.1, "dark", top="steelD")                 # the carriage
    k.box(0, 0.1, 2.52, 0.4, 0.02, 0.05, "slbCy")
    return out


def paternoster(k):
    """s12: glass slabs hung on a vertical loop between two towers, the front run tilted to the room."""
    k.box(0, 0.0, 0.0, 2.95, 1.9, 0.12, "plate", top="medWhite")
    for u in (-1.4, 1.4):                                                    # the towers
        k.box(u, 0.0, 0.12, 0.16, 1.7, 2.7, "plate", top="medWhite")
        k.box(u + (-0.081 if u > 0 else 0.081), 0.0, 0.3, 0.004, 1.2, 2.3, "dark")   # the chain's slot
        k.box(u + (-0.083 if u > 0 else 0.083), 0.7, 0.3, 0.004, 0.03, 2.3, "slbCy")
    k.box(0, 0.0, 2.82, 2.96, 1.72, 0.14, "plate", top="medWhite")           # the head
    out = []
    g = math.radians(50)
    for z in (0.32, 0.92, 1.52, 2.12):                                       # the front run
        N = (0.0, math.cos(g), math.sin(g))
        out.append(glass(k, SlabF((-1.0, 0.42, z), (1.0, 0.0, 0.0), N)))
        for u in (-1.31, 1.31):
            k.box(u, 0.42, z + 0.25, 0.04, 0.08, 0.08, "steel", top="steelL")   # the pivots
    for z in (0.62, 1.22, 1.82):                                             # the back run, facing away
        N = (0.0, -math.cos(g), math.sin(g))
        glass(k, SlabF((-1.0, -0.42, z), (1.0, 0.0, 0.0), N))
    return out


# ---- hover carts ----------------------------------------------------------------------------------------------------
def sled(k):
    """c10: a ground-effect sled, low, its foot ringed by a lit skirt; a tow handle."""
    k.box(0, 0.0, 0.24, 0.92, 1.92, 0.16, "dark", top="steelD")
    k.box(0, 0.0, 0.2, 0.96, 1.96, 0.04, "slbCy")                             # the lit skirt
    k.box(0, 0.0, 0.17, 0.86, 1.86, 0.03, "steelD")
    k.box(0, 0.8, 0.4, 0.7, 0.18, 0.12, "steelD", top="steel")
    k.box(0, -1.04, 0.3, 0.08, 0.16, 0.06, "steel", top="steelL")             # the tow handle
    k.box(0, -1.2, 0.32, 0.06, 0.32, 0.04, "steel", top="steelL")
    k.box(0, -1.36, 0.3, 0.4, 0.06, 0.08, "slbCy")
    return [ribbed(k, SlabF((0.0, -0.95, 0.4 + T), (0.0, 1.0, 0.06), (0.0, -0.06, 1.0)))]


def sled_glow(k):
    k.box(0, 0.0, 0.0, 1.3, 2.3, 0.003, "slbFilm")


def sled_shadow(k):
    k.box(0, 0.0, 0.004, 0.8, 1.8, 0.003, "dark")


def cradle(k):
    """c11: a floating cradle: two emitter clamps hold the slab's ends in the air, a push bar on the foot clamp."""
    z = 0.62
    for v, h in ((-1.05, z - 0.06), (1.05, z + 0.14)):
        k.box(0, v, h - 0.16, 0.98, 0.2, 0.34, "dark", top="steelD")          # the clamp
        k.cyl(0, v, h - 0.2, 0.16, 0.04, "steelD", top="steel", sides=14)    # its emitter
        k.cyl(0, v, h - 0.21, 0.13, 0.012, "slbCy", sides=14)
        k.box(0, v + (0.1 if v > 0 else -0.1), h, 0.6, 0.012, 0.05, "slbCy")
    for u in (-0.4, 0.4):                                                    # the push bar
        k.box(u, -1.2, z - 0.1, 0.05, 0.05, 0.6, "steel", top="steelL")
    k.box(0, -1.2, z + 0.48, 0.86, 0.06, 0.06, "steelL")
    a = math.radians(6)
    return [cassette(k, SlabF((0.0, -0.98, z), (0.0, math.cos(a), math.sin(a)), (0.0, -math.sin(a), math.cos(a))))]


def cradle_beams(k):
    for v, h in ((-1.05, 0.56), (1.05, 0.76)):
        k.cyl(0, v, 0.0, 0.22, h - 0.37, "slbFilm", sides=14, rtop=0.13)


def cradle_sheet(k):
    k.box(0, 0.0, 0.42, 0.7, 1.9, 0.01, "slbFilm")


def cradle_floor(k):
    k.box(0, 0.0, 0.003, 0.7, 1.7, 0.003, "dark")
    for v in (-1.05, 1.05):
        k.cyl(0, v, 0.0, 0.26, 0.004, "slbFilm", sides=16)


def pods(k):
    """c12: two hover pods at the slab's ends gripping it between them; a guide handle on the foot pod."""
    z = 0.5
    for v in (-1.08, 1.08):
        k.cyl(0, v, z - 0.1, 0.28, 0.32, "plate", top="medWhite", sides=20)
        k.cyl(0, v, z - 0.12, 0.24, 0.02, "slbCy", sides=20)
        k.cyl(0, v, z + 0.2, 0.16, 0.05, "slbCy", sides=16)
        for u in (-0.3, 0.3):                                                # the grips
            k.box(u, v - (0.16 if v > 0 else -0.16), z, 0.06, 0.24, 0.16, "plate", top="medWhite")
    k.box(0, -1.45, z + 0.05, 0.05, 0.3, 0.05, "steel", top="steelL")        # the guide handle
    k.box(0, -1.58, z + 0.05, 0.4, 0.05, 0.08, "slbCy")
    return [glass(k, SlabF((0.0, -0.98, z), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)))]


def pods_beams(k):
    for v in (-1.08, 1.08):
        k.cyl(0, v, 0.0, 0.3, 0.38, "slbFilm", sides=16, rtop=0.22)


def pods_floor(k):
    k.box(0, 0.0, 0.003, 0.7, 1.8, 0.003, "dark")
    for v in (-1.08, 1.08):
        k.cyl(0, v, 0.0, 0.34, 0.004, "slbFilm", sides=18)


def single(build, fp, name):
    def go():
        k = K(name, fp)
        build(k)
        return k.build()
    return go


def glass_over(v):
    """The glass case and its lit edges over each glass slab of design v (as round 3's)."""
    def part(which):
        def go():
            fn, fp = DESIGNS[v]
            slabs = [s for s in fn(K("tmp", fp)) if getattr(s, "mask_n", None) == -0.027]
            k = K(f"slab_{v}_{which}", fp)
            for s in slabs:
                (glass_case if which == "film" else glass_edges)(s)(k)
            return k.build()
        return go
    return [(part("film"), 60), (part("edges"), 200)]


DESIGNS = {"s10": (flap_wheel, (3, 3)), "s10b": (lambda k: flap_wheel(k, math.radians(40)), (3, 3)), "s11": (jukebox, (3, 2)), "s12": (paternoster, (3, 2)),
           "c10": (sled, (1, 2)), "c11": (cradle, (1, 2)), "c12": (pods, (1, 2))}
OVERLAYS = {"c10": [(single(sled_glow, (1, 2), "gl"), 120), (single(sled_shadow, (1, 2), "sh"), 120)],
            "c11": [(single(cradle_floor, (1, 2), "fl"), 120), (single(cradle_beams, (1, 2), "bm"), 55),
                    (single(cradle_sheet, (1, 2), "st"), 60)],
            "c12": [(single(pods_floor, (1, 2), "fl"), 120), (single(pods_beams, (1, 2), "bm"), 55)]
            + glass_over("c12"),
            "s12": glass_over("s12")}
assert L == 2.0 and W == 0.8
