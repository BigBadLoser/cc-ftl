"""Holo game table look study (family `gametable`, preview only): a 2x1 leisure table for two players, seated on stools
on the tiles in front and behind (+v and -v), each stool held off the table's foot by an arm so table and seats are one
body. The arcade's family look: navy with chrome trim and cyan light. The game is a hologram over the table top, from
emitter strips in the glass top. The variants share the table and differ in the game:

  k1 strategy board: a board of lit squares hovering over the top, tall pieces in pink (front) and cyan (back), one
      lifted mid-move
  k2 tabletop battle: holo terrain (mesas and a ridge), two small fleets facing off over it, shots crossing, a burst
  k3 card game: a fan of cards standing in front of each player, the draw pile and a face-up card in the middle, chips

Units: world (1 = a tile); z in world units too (a seat top at 0.39, the table top at 0.62, as the consoles' chair)."""
import math

from .arcade_study import ring_of
from .research_kit import Bench, bar

FP2 = (2, 1)
TOP = 0.62                                                           # the table top's height
SEATS = ((-0.5, 1.0), (0.5, -1.0))                                   # the stools: front left, back right (local u, v)


def stadium(k, hu, hv, z, h, col, top=None, sides=16):
    """A rounded slab: a box with half-round ends, hu x hv half sizes, the ends' radius hv."""
    k.box(0.0, 0.0, z, 2 * (hu - hv), 2 * hv, h, col, top=top)
    for s in (-1, 1):
        k.cyl(s * (hu - hv), 0.0, z, hv, h, col, top=top, sides=sides)


def stool(k, u, v, face):
    """A stool: a disc foot, a post, a padded seat with a chrome rim, a low back on the side away from the table;
    `face` = the way the sitter faces (-1: toward -v)."""
    k.cyl(u, v, 0.0, 0.14, 0.03, "arcBodyK", top="arcBodyK", sides=12)
    k.cyl(u, v, 0.03, 0.045, 0.26, "arcChrD", top="arcChr", sides=8)
    k.cyl(u, v, 0.29, 0.19, 0.04, "arcChrD", top="arcChr", sides=14)
    k.cyl(u, v, 0.33, 0.17, 0.06, "arcBodyD", top="arcBody", sides=14)
    k.box(u, v - face * 0.16, 0.36, 0.3, 0.05, 0.2, "arcBodyD", top="arcBody")              # the back
    k.box(u, v - face * 0.16, 0.56, 0.3, 0.05, 0.02, "arcCyan", top="arcCyan")             # its lit edge


def table(name, rot=0):
    """The table: a plinth, a stadium pedestal, the thick top with its chrome rim and dark glass, a lit inset border and
    the emitter strips; the two stools on arms off the plinth."""
    k = Bench(name, FP2, rot)
    stadium(k, 0.7, 0.24, 0.0, 0.04, "arcBodyK", top="arcBodyK")                         # the plinth,
    stadium(k, 0.62, 0.18, 0.04, TOP - 0.12, "arcBodyD", top="arcBody")                  # the pedestal,
    for s in (-1, 1):                                                                    # its lit seams
        k.box(s * 0.3, 0.181, 0.12, 0.02, 0.006, TOP - 0.24, "arcCyan")
    stadium(k, 0.96, 0.44, TOP - 0.1, 0.06, "arcChrD", top="arcChr")                    # the top: a chrome rim,
    stadium(k, 0.93, 0.41, TOP - 0.04, 0.04, "arcBodyD", top="arcGlass")                # the dark glass,
    for s in (-1, 1):                                                                    # a lit inset border,
        k.box(0.0, s * 0.33, TOP, 1.0, 0.014, 0.004, "arcCyan", top="arcCyan")
        k.box(s * 0.55, 0.0, TOP, 0.014, 0.66, 0.004, "arcCyan", top="arcCyan")
    for s in (-1, 1):                                                                    # the emitter strips
        k.box(s * 0.18, 0.0, TOP, 0.06, 0.5, 0.008, "arcCyan", top="arcCyan")
    for u, v in SEATS:                                                                   # the stools on their arms
        bar(k, (u * 0.7, v * 0.12, 0.03), (u, v, 0.03), 0.06, "arcChrD")
        stool(k, u, v, -1 if v > 0 else 1)
    return k.build()


def k1():
    return table("gametable_k1")


def k2():
    return table("gametable_k2")


def k3():
    return table("gametable_k3")


Z0 = TOP + 0.08                                                      # the hologram's floor


def k1_holo():
    """A board of 8x4 squares hovering over the top (film squares, lit grid lines), pink pieces on the front rows, cyan
    on the back, one pink piece lifted mid-move."""
    k = Bench("gametable_k1_holo", FP2)
    s, nu, nv = 0.17, 8, 4
    hu, hv = s * nu / 2, s * nv / 2
    for i in range(nu):
        for jj in range(nv):
            if (i + jj) % 2 == 0:
                k.box(-hu + (i + 0.5) * s, -hv + (jj + 0.5) * s, Z0, s, s, 0.004, "arcCyanF", top="arcCyanF")
    for i in range(nu + 1):
        k.box(-hu + i * s, 0.0, Z0, 0.012, 2 * hv, 0.006, "arcCyan", top="arcCyan")
    for jj in range(nv + 1):
        k.box(0.0, -hv + jj * s, Z0, 2 * hu, 0.012, 0.006, "arcCyan", top="arcCyan")
    def at(i, jj):
        return -hu + (i + 0.5) * s, -hv + (jj + 0.5) * s
    pieces = [((0, 3), 0.1), ((2, 3), 0.16), ((3, 2), 0.1), ((6, 3), 0.1), ((7, 2), 0.13)], \
             [((1, 0), 0.1), ((3, 0), 0.16), ((4, 1), 0.1), ((5, 0), 0.13), ((7, 0), 0.1)]
    for side, col in ((0, "arcPink"), (1, "arcCyan")):
        for (i, jj), h in pieces[side]:
            u, v = at(i, jj)
            k.box(u, v, Z0, 0.08, 0.08, h, col, top=col)                                 # a piece,
            k.box(u, v, Z0 + h, 0.05, 0.05, 0.04, col, top=col)                          # its head
    u, v = at(4, 2)
    k.box(u, v, Z0 + 0.2, 0.08, 0.08, 0.13, "arcPink", top="arcPink")                   # the lifted piece,
    k.box(u, v, Z0 + 0.007, 0.08, 0.08, 0.004, "arcPinkF", top="arcPinkF")               # its shadow square
    return k


def k2_holo():
    """Holo terrain (film mesas with lit rims, a ridge), an amber fleet on the left and a cyan one on the right facing
    off over it, shots crossing, a burst on one ship."""
    k = Bench("gametable_k2_holo", FP2)
    k.box(0.0, 0.0, Z0, 1.4, 0.6, 0.004, "arcGrnF", top="arcGrnF")                      # the ground,
    for u, v, su, sv, h in ((-0.3, -0.1, 0.24, 0.2, 0.14), (0.25, 0.12, 0.2, 0.16, 0.2), (0.0, -0.18, 0.5, 0.1, 0.08)):
        k.box(u, v, Z0, su, sv, h, "arcGrnF", top="arcGrnF")                            # mesas and a ridge,
        k.box(u, v, Z0 + h, su + 0.01, sv + 0.01, 0.006, "arcGrn", top="arcGrn")         # their lit rims
    for u, v, su, sv in ((0.0, -0.3, 1.4, 0.012), (0.0, 0.3, 1.4, 0.012), (-0.7, 0.0, 0.012, 0.6), (0.7, 0.0, 0.012, 0.6)):
        k.box(u, v, Z0, su, sv, 0.008, "arcGrn", top="arcGrn")                         # the map's lit edge
    zf = Z0 + 0.32
    for sgn, col in ((-1, "arcAmb"), (1, "arcCyan")):                                    # the fleets
        for du, dv in ((0.0, 0.0), (0.12, 0.16), (0.12, -0.16)):
            u, v = sgn * (0.42 + du), dv
            k.box(u, v, zf, 0.15, 0.07, 0.05, col, top=col)
            k.box(u + sgn * 0.05, v, zf, 0.05, 0.17, 0.02, col, top=col)                # their wings
    for v, col in ((0.12, "arcAmb"), (-0.05, "arcCyan")):                                # shots crossing
        bar(k, (-0.32, v, zf + 0.015), (0.32, -v * 0.5, zf + 0.015), 0.014, col)
    for rz in (0.0, 0.785, 1.571, 2.356):                                                # a burst
        k.box(0.45, 0.12, zf + 0.015, 0.14, 0.014, 0.014, "arcMarq", rz=rz)
    return k


def card(k, u, v, z, face, col, w=0.2, h=0.28, lean=0.0):
    """A card standing up, facing +v (face 1) or -v (-1): film body, a lit border, a symbol on its face."""
    rx = face * lean
    k.box(u, v, z, w, 0.004, h, "arcShellD" if face > 0 else "arcCyanF", top="arcShellD", rx=rx)
    k.box(u, v + face * 0.003, z + h - 0.012, w, 0.004, 0.012, "arcMarq", rx=rx)
    k.box(u, v + face * 0.003, z, w, 0.004, 0.012, "arcMarq", rx=rx)
    if face > 0:
        k.box(u, v + 0.005, z + h * 0.35, w * 0.4, 0.004, h * 0.3, col, rx=rx)


def k3_holo():
    """A card game: three cards fanned in front of each player (the near hand's faces to us, the far hand's backs), the
    draw pile and a face-up card floating over the middle, a stack of chips by each hand."""
    k = Bench("gametable_k3_holo", FP2)
    for i, (du, col) in enumerate(((-0.24, "arcPink"), (0.0, "arcAmb"), (0.24, "arcGrn"))):
        card(k, -0.45 + du, 0.28, Z0 + 0.06 + (0.04 if i == 1 else 0), 1, col, lean=0.25)  # the near hand,
        card(k, 0.45 + du, -0.28, Z0 + 0.06 + (0.04 if i == 1 else 0), -1, col, lean=0.25)  # the far hand (backs)
    for n in range(4):                                                                   # the draw pile,
        k.box(-0.12, 0.0, Z0 + n * 0.016, 0.2, 0.28, 0.01, "arcCyanF", top="arcCyan" if n == 3 else "arcCyanF")
    card(k, 0.14, 0.0, Z0 + 0.14, 1, "arcPink", w=0.22, h=0.3)                           # the face-up card
    ring_of(k, 0.15, Z0 + 0.08, 12, 0.07, "arcCyan", h=0.01)
    for u, v, col in ((-0.82, 0.2, "arcAmb"), (0.82, -0.2, "arcAmb")):                   # chip stacks
        for n in range(4):
            k.cyl(u, v, Z0 + n * 0.03, 0.06, 0.022, col, top=col, sides=10)
    return k


def holo_job(sid, cab, holo):
    def run(sid=sid):
        from . import core, post
        from .research_kit import holo_item
        core.clear_scene_meshes()
        post.select("arcade")
        it = holo_item(sid, FP2, cab(), holo().build())
        return [it] if it else []
    return run


def jobs():
    out = [(f"module.gametable.{v}", FP2, "prop", f) for v, f in (("k1", k1), ("k2", k2), ("k3", k3))]
    return out + [holo_job(f"module.gametable.{v}.holo", cab, holo) for v, cab, holo in
                  (("k1", k1, k1_holo), ("k2", k2, k2_holo), ("k3", k3, k3_holo))]
