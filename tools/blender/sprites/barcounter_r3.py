"""Bar counter look study round 3 (family `barcounter3`, palette set bar3, preview only; frame and heights in barcounter_study.py): built
the recovery pod's way, with revolved forms, see-through glass and light sources, in sci-fi colours.

  e1 synth bar: a pearl counter with round ends and a lit lip; three swan-neck dispensers over glowing pads, fed by
     conduits from a domed synth core behind the counter; a glass filling on the middle pad; saucer stools
  e2 mag-rail bar: a graphite counter with a capsule dispenser tower at one end, its lit alcove making a drink; an
     amber track along the counter top carrying a drink pod toward the seats
  e3 backlit wall bar: a navy counter before a tall curved panel glowing in nebula colours, a shelf of spigots and
     glasses silhouetted against it

All in px of the tile (u -48..48, v -32..32, z up), counter top 24, seats 15."""
import math

from .barcounter_study import FP, SEAT, STOOLS, SV, TOP, ZPX
from .bunk_study import _px
from .research_kit import Bench


def cyl(k, u, v, z0, z1, r0, col, top=None, r1=None, sides=16):
    """A cylinder (or cone, r0 at z0 to r1 at z1) in px."""
    k.cyl(u / 32, v / 32, z0 / ZPX, r0 / 32, (z1 - z0) / ZPX, col, top=top or col, sides=sides,
          rtop=None if r1 is None else r1 / 32)


def lathe(k, u, v, prof, col, top=None, sides=16):
    """A revolved form through (z, r) points in px."""
    for (z0, r0), (z1, r1) in zip(prof, prof[1:]):
        cyl(k, u, v, z0, z1, r0, col, top, r1, sides)


def saucer(k, u, body, cushion, ring=None):
    """A saucer stool: a disc foot, a slim stem, a flared cup and a cushion on it, an optional light ring under it."""
    lathe(k, u, SV, ((0, 4), (1, 4), (1, 1.2), (SEAT - 4, 1.2), (SEAT - 2, 5), (SEAT - 1, 5.2)), body)
    cyl(k, u, SV, SEAT - 1, SEAT, 4.6, cushion)
    if ring:
        cyl(k, u, SV, SEAT - 4, SEAT - 3, 3.2, ring)


def e1():
    k = Bench("bar_e1", FP)
    g = k.part("glass")
    _px(k, -42, 42, -15, -2, 0, 2, "barGraphite")                                 # recessed plinth
    _px(k, -42, 42, -16, 0, 2, TOP - 3, "barPearl")                                # body
    for su in (-1, 1):                                                             # round ends
        cyl(k, su * 42, -8, 0, 2, 7, "barGraphite")
        cyl(k, su * 42, -8, 2, TOP - 3, 8, "barPearl")
        cyl(k, su * 42, -8, TOP - 3, TOP, 9.5, "barPearl")
    _px(k, -42, 42, -18, 2, TOP - 3, TOP, "barPearl")                          # top
    _px(k, -42, 42, 0, 1, TOP - 5, TOP - 4, "barViolet")                           # lit lip under the top's edge
    lathe(k, 0, -26, ((0, 7), (3, 7), (3, 6), (26, 6), (30, 4), (33, 2), (34, 0.5)), "barPearl")   # synth core
    for z in (10, 18):
        cyl(k, 0, -26, z, z + 1, 6.3, "barViolet")                                 # its glowing bands
    for i, u in enumerate((-24, 0, 24)):
        _px(k, min(u, 0), max(u, 0) + 1, -20, -19, 14, 15, "barGraphite")          # conduit from the core
        _px(k, u, u + 1, -19, -15, 14, 15, "barGraphite")
        _px(k, u - 1, u + 1, -15, -13, TOP, 40, "barPearl")                        # the dispenser's neck,
        _px(k, u - 1, u + 1, -15, -6, 38, 41, "barPearl")                          # bending over the counter,
        _px(k, u - 1, u + 1, -8, -6, 35, 38, "barGraphite")                        # its nozzle
        _px(k, u - 1, u + 1, -8, -6, 34, 35, "barViolet")
        cyl(k, u, -7, TOP, TOP + 1, 3.5, "barViolet" if i == 1 else "barGraphite")  # the pad (lit where pouring)
    cyl(g, 0, -7, TOP + 1, TOP + 6, 1.8, "barPearl")                               # a glass on the lit pad
    cyl(k, 0, -7, TOP + 1, TOP + 4, 1.5, "barViolet")                              # filling
    for u in STOOLS:
        saucer(k, u, "barPearl", "barSeat")
    return k.build()


def e2():
    k = Bench("bar_e2", FP)
    g = k.part("glass")
    _px(k, -34, 48, -15, -2, 0, 2, "barNavy")                                      # plinth
    _px(k, -34, 48, -16, 0, 2, TOP - 2, "barGraphite")                             # body
    _px(k, -34, 48, 0, 1, 5, 6, "barAmberL")                                       # a light line low on its front
    _px(k, -34, 48, -17, 2, TOP - 2, TOP, "barGraphite")                           # top
    _px(k, -34, 46, -11, -10, TOP, TOP + 1, "barPearl")                            # the track: two rails
    _px(k, -34, 46, -7, -6, TOP, TOP + 1, "barPearl")
    _px(k, -34, 46, -10, -7, TOP - 1, TOP + 0, "barAmberL")                        # its lit groove (in the top)
    lathe(k, -40, -12, ((0, 8), (2, 8), (2, 7), (40, 7), (44, 5), (47, 2.5), (48, 0.5)), "barGraphite")  # tower
    cyl(k, -40, -12, 41, 42, 7.3, "barAmberL")                                     # its crown light
    _px(k, -37, -33, -8, -5, 20, 36, "barNavy")                                    # the alcove's frame (front, +v)
    _px(k, -36, -34, -6, -4, 22, 34, "barAmberL")                                  # its lit back
    cyl(g, -35, -3, 25, 30, 1.6, "barPearl")                                       # a drink in the alcove
    _px(k, 8, 12, -10, -7, TOP + 1, TOP + 2, "barPearl")                           # a pod on the track,
    cyl(g, 10, -8.5, TOP + 2, TOP + 7, 1.6, "barPearl")                            # its drink
    cyl(k, 10, -8.5, TOP + 2, TOP + 5, 1.3, "barAmberL")
    for u in STOOLS:
        saucer(k, u, "barGraphite", "barNavy", ring="barAmberL")
    return k.build()


def e3():
    k = Bench("bar_e3", FP)
    g = k.part("glass")
    R, CV = 90, 58                                                                 # the panel's arc: radius, centre v
    for i in range(-4, 5):                                                         # curved backlit panel
        a = i * 0.13
        u, v = R * math.sin(a), CV - R * math.cos(a)
        for z0, z1, col in ((0, 4, "barNavy"), (4, 22, "barTeal"), (22, 40, "barNebula"), (40, 46, "barNavy")):
            k.box(u / 32, v / 32, z0 / ZPX, 11.8 / 32, 2 / 32, (z1 - z0) / ZPX, col, top=col, rz=a)
    _px(k, -44, 44, -26, -22, 28, 29, "barGraphite")                               # shelf before the panel
    for j, u in enumerate(range(-40, 41, 8)):
        if j % 2:
            cyl(g, u, -24, 29, 34, 1.6, "barPearl")                                # glasses on it
        else:
            _px(k, u - 1, u + 1, -25, -23, 29, 35, "barGraphite")                  # spigots
            _px(k, u - 1, u + 1, -23, -21, 33, 35, "barGraphite")
    _px(k, -48, 48, -15, -2, 0, 2, "barGraphite")                                  # plinth
    _px(k, -48, 48, -16, 0, 2, TOP - 2, "barNavy")                                 # body
    _px(k, -48, 48, -17, 2, TOP - 2, TOP, "barNavy")                               # top
    _px(k, -48, 48, 1, 2, TOP - 3, TOP - 2, "barTeal")                             # lit front edge
    for u in (-30, 4, 30):
        cyl(g, u, -6, TOP, TOP + 5, 1.6, "barPearl")                               # drinks served on the counter
        cyl(k, u, -6, TOP, TOP + 3, 1.3, "barTeal" if u != 4 else "barNebula")
    for u in STOOLS:
        saucer(k, u, "barNavy", "barGraphite", ring="barTeal")
    return k.build()


DESIGNS = {"e1": e1, "e2": e2, "e3": e3}


def jobs():
    return [(f"module.barcounter.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
