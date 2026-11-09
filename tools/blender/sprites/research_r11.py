"""Research companions, round 11: the 1x2 dissection table and sample analyzer as machines, not desks (after the user's
reference): one body in three tiers by height (a brown plinth, a recessed navy body, a cream deck overhanging it), the
subject inside the machine (a sunken bed under glass, an enclosed chamber), one tall sculpted part that does the work,
controls as bezels set into the deck's front rail, panel seams and rail notches for rhythm, nothing loose on top.
Local frame: footprint (2, 1), u -1..1, v -0.5..0.5, the work side at +v. Everything big on the px grid.

  x2  scanner arch: a long glass-lidded bed, the specimen in it; a chunky arch off the back rail reaches over the bed
      with a gold scan bar under its head. Hologram: the scan slice standing up out of the bed
  x3  canopy: the bed's glass canopy lifted open on its cream frame, a strut holding it. Hologram: anatomy labels on
      the canopy glass, leaders down to the specimen
  x4  manipulator hood: a raised hood along the back, two jointed arms out of it over the open bed. Hologram: the
      exploded view (plates floating where they came off)
  y2  chamber tower: a tower at the right end with a tall glass window, a specimen held in fluid in it; a sunken rack
      of vials under glass along the rest. Hologram: the spectrum over the rack
  y3  centrifuge: a navy drum in the deck under a glass dome, a rotor of vials in it, a sensor arch over it. Hologram:
      readout rings over the dome
  y4  sample tunnel: a channel down the deck carries capsules through a cream tunnel with a lit window. Hologram: a
      molecule over the tunnel and a small chart"""
import math

from .modkit import K
from .research_kit import PXG, Bench, bar, ring, zpx
from .research_r3 import _pane

FP2 = (2, 1)
G, F, GL = "resGold", "resGoldF", "resGlyph"
U1, V1 = 30 * PXG, 14 * PXG       # half extents: plinth and deck (0.9375 x 0.4375)
BU, BV = 28 * PXG, 12 * PXG       # the navy body, recessed 2 px
ZP, ZB, ZD = zpx(4), zpx(16), zpx(20)   # tops: plinth, body, deck


# ---- the machine kit ------------------------------------------------------------------------------------------------

def patch(k, face, c, p, w, z, h, col):
    """A flush colour patch on a face: 'v' the plane v = p (facing +v) centred on u = c; 'u' the plane u = p."""
    if face == "v":
        k.box(c, p + 0.002, z, w, 0.004, h, col)
    else:
        k.box(p + 0.002, c, z, 0.004, w, h, col)


def base(k):
    """The plinth (brown, the full footprint), the navy body recessed on it with seams and a lighter panel."""
    k.box(0.0, 0.0, 0.0, 2 * U1, 2 * V1, ZP, "resBrn", top="resBrnL")
    k.box(0.0, 0.0, ZP, 2 * BU, 2 * BV, ZB - ZP, "resNvy", top="resNvyL")
    for i in range(-2, 3):                                                            # seams on the front,
        patch(k, "v", i * 12 * PXG, BV, PXG, ZP, ZB - ZP, "resNvyD")
    patch(k, "u", 0.0, BU, PXG, ZP, ZB - ZP, "resNvyD")                                # and the side
    for c in (-18 * PXG, 18 * PXG):
        patch(k, "v", c, BV, 8 * PXG, ZP + zpx(3), zpx(5), "resNvyL")                 # two panels between them


def deck(k, hole=None):
    """The cream deck over the body, the full footprint; hole = (u0, u1, v0, v1) leaves an opening (a bed) in it."""
    h = ZD - ZB
    if hole is None:
        k.box(0.0, 0.0, ZB, 2 * U1, 2 * V1, h, "lvW2", top="lvW")
        return
    u0, u1, v0, v1 = hole
    k.box(0.0, (-V1 + v0) / 2, ZB, 2 * U1, v0 + V1, h, "lvW2", top="lvW")              # back rail,
    k.box(0.0, (v1 + V1) / 2, ZB, 2 * U1, V1 - v1, h, "lvW2", top="lvW")               # front rail,
    k.box((-U1 + u0) / 2, (v0 + v1) / 2, ZB, u0 + U1, v1 - v0, h, "lvW2", top="lvW")   # the ends
    k.box((u1 + U1) / 2, (v0 + v1) / 2, ZB, U1 - u1, v1 - v0, h, "lvW2", top="lvW")


def bed(k, hole, floor="gm", top="steelD", depth=3, lid=True):
    """The sunken bed in a deck hole: its floor `depth` px under the deck, a glass lid flush with the deck."""
    u0, u1, v0, v1 = hole
    fz = ZD - zpx(depth)
    k.box((u0 + u1) / 2, (v0 + v1) / 2, ZB, u1 - u0, v1 - v0, fz - ZB, floor, top=top)
    if lid:
        k.part("glass").box((u0 + u1) / 2, (v0 + v1) / 2, ZD - 0.012, u1 - u0, v1 - v0, 0.012, "glassL")
    return fz


def notches(k, u0, u1, v, n_step=4):
    """The rail's rhythm: 2 px notches every n_step px along u at v, on the deck top."""
    u = u0
    while u <= u1 + 1e-6:
        k.box(u, v, ZD, 2 * PXG, PXG, 0.004, "lvWS")
        u += n_step * PXG


def bezel(k, u, w, n=3, a=0.6, v=V1 - 3 * PXG):
    """A raised bezel on the front rail, its face tipped up toward +v: a dark screen with n gold glyphs."""
    h, d = zpx(4), 4 * PXG
    k.box(u, v, ZD, w, d, h, "lvW2", top="resNvyD", rx=-a)
    cv, cz = v + h / 2 * math.sin(a), ZD + h / 2 + h / 2 * math.cos(a)                # its face's centre
    for j in range(n):
        gu = u - w * 0.3 + j * w * 0.6 / max(1, n - 1)
        gw = (0.04, 0.025, 0.035)[j % 3]
        k.box(gu, cv + 0.005 * math.sin(a), cz + 0.005 * math.cos(a) - 0.004, gw, 0.03, 0.008, GL, rx=-a)


def specimen(k, u, v, z, s=0.7):
    """A carapaced creature opened up, scaled s: the shell's rim, the soft body, organs, legs splayed."""
    k.cyl(u, v, z, 0.23 * s, zpx(2), "resSpec", top="resSpecL", sides=16)
    k.cyl(u, v, z + zpx(2), 0.18 * s, zpx(1), "resWingL", top="resWingL", sides=16)
    for (du, dv, q, col) in ((-0.06, 0.04, 0.09, "medRed"), (0.06, -0.02, 0.07, "resBio"), (0.0, -0.09, 0.06, "hivis")):
        k.box(u + du * s, v + dv * s, z + zpx(3), q * s, q * s, zpx(1), col)
    for sg in (-1, 1):
        for a in (0.5, 0.0, -0.5):
            bar(k, (u + sg * 0.22 * s * math.cos(a), v + 0.22 * s * math.sin(a), z + 0.02),
                (u + sg * 0.36 * s * math.cos(a * 1.3), v + 0.36 * s * math.sin(a * 1.3), z + 0.02), 0.03, "resSpec")


def machine(name, fp=FP2):
    return Bench(name, fp)


# ---- x2: scanner arch -----------------------------------------------------------------------------------------------

HOLE_X = (-26 * PXG, 26 * PXG, -6 * PXG, 7 * PXG)


def x2(layer):
    k = machine(f"research_x2_{layer}")
    base(k)
    deck(k, HOLE_X)
    fz = bed(k, HOLE_X)
    specimen(k, -0.25, 0.02, fz)
    for u, v, rz in ((0.3, -0.04, 0.4), (0.5, 0.06, -0.3)):                           # two plates off it, in the bed
        k.box(u, v, fz, 0.13, 0.1, zpx(1), "resSpec", top="resSpecL", rz=rz)
    notches(k, -26 * PXG, 26 * PXG, -10 * PXG)
    for u in (-0.62, 0.62):
        bezel(k, u, 0.2)
    # the arch: a bridge across the bed (legs on the back and front rails), chamfered shoulders, a gold scan bar
    au, aw, ah = 0.2, 8 * PXG, zpx(14)
    for lv in (-11 * PXG, 11 * PXG):
        k.box(au, lv, ZD, aw, 4 * PXG, ah, "lvW2", top="lvW")
    k.box(au, 0.0, ZD + ah, aw, 2 * V1, zpx(4), "lvW2", top="lvW")
    for sv, rx in ((-1, 0.785), (1, -0.785)):
        k.box(au, sv * (V1 - 0.02), ZD + ah + zpx(1), aw, 0.09, 0.09, "lvW2", top="lvW", rx=rx)
    k.box(au, 0.0, ZD + ah - zpx(1), aw - 2 * PXG, 18 * PXG, zpx(1), "resNvyD")
    k.box(au, 0.0, ZD + ah - zpx(1) - 0.006, 2 * PXG, 16 * PXG, 0.006, G)               # its scan bar,
    k.box(au, 0.0, fz + 0.002, 0.02, 13 * PXG, 0.004, G)                              # the line it draws on the bed
    patch(k, "v", au, V1, aw - 2 * PXG, ZD + ah + zpx(2), zpx(1), G)
    return k.build()


def x2_holo():
    k = K("research_x2_holo", FP2, 0)
    au = 0.2
    k.box(au, 0.0, ZD + 0.02, 0.012, 0.4, 0.3, F)                                       # the slice, standing up
    for z, w in ((0.06, 0.18), (0.12, 0.3), (0.18, 0.26), (0.24, 0.14)):
        k.box(au + 0.008, 0.0, ZD + 0.02 + z, 0.012, w, 0.02, G)                        # its cross-section
    bar(k, (au, -0.2, ZD + 0.32), (au, 0.2, ZD + 0.32), 0.015, G)
    return k


# ---- x3: canopy -----------------------------------------------------------------------------------------------------

def x3(layer):
    k = machine(f"research_x3_{layer}")
    base(k)
    deck(k, HOLE_X)
    fz = bed(k, HOLE_X, lid=False)
    specimen(k, 0.0, 0.02, fz, s=0.85)
    notches(k, -26 * PXG, 26 * PXG, 10 * PXG + PXG / 2, 6)
    bezel(k, -0.72, 0.18)
    bezel(k, 0.72, 0.18)
    # the canopy, lifted: a cream frame hinged on the back rail, leaning back, glass in it
    b, H = 0.42, 0.5
    u0, u1, v0 = HOLE_X[0], HOLE_X[1], HOLE_X[2]
    cv, cz = v0 - H / 2 * math.sin(b), ZD + H / 2 * math.cos(b)                       # its centre
    k.box(0.0, v0 - 0.02, ZD, u1 - u0 + 4 * PXG, 0.08, zpx(3), "lvW2", top="lvW")       # the hinge bar
    for u in (u0, u1):
        k.box(u, cv, cz - H / 2, 3 * PXG, 0.05, H, "lvW2", top="lvW", rx=b)            # its sides,
    k.box(0.0, v0 - H * math.sin(b), ZD + H * math.cos(b) - 0.04, u1 - u0 + 3 * PXG, 0.08, 0.08,
          "lvW2", top="lvW", rx=b)                                                     # its top bar,
    k.part("glass").box(0.0, cv + 0.01, cz - H / 2, u1 - u0, 0.02, H, "glassL", rx=b)  # the glass
    bar(k, (u1 + 2 * PXG, 6 * PXG, ZD), (u1 + 2 * PXG, cv, cz), 0.04, "steelL")         # a strut holding it
    k.cyl(u1 + 2 * PXG, 6 * PXG, ZD, 0.035, zpx(2), "brass", sides=8)
    patch(k, "v", 0.0, V1, 40 * PXG, ZD - zpx(2), zpx(1), G)                           # a gold line on the rail
    return k.build()


def x3_holo():
    k = K("research_x3_holo", FP2, 0)
    b, H, v0 = 0.42, 0.5, HOLE_X[2]
    for i, (u, t, w) in enumerate(((-0.45, 0.7, 0.26), (0.1, 0.5, 0.3), (0.5, 0.75, 0.22))):
        v, z = v0 - H * t * math.sin(b) + 0.03, ZD + H * t * math.cos(b)
        k.box(u, v, z, w, 0.01, 0.1, F, rx=b)                                          # a label on the glass,
        k.box(u, v + 0.012, z + 0.06, w * 0.7, 0.01, 0.02, G, rx=b)
        bar(k, (u, v, z), (0.04 * (i - 1), 0.02, ZD - zpx(2) + 0.04), 0.012, G)        # its leader to the specimen
    return k


# ---- x4: manipulator hood -------------------------------------------------------------------------------------------

def x4(layer):
    k = machine(f"research_x4_{layer}")
    base(k)
    hole = (-26 * PXG, 26 * PXG, -4 * PXG, 8 * PXG)
    deck(k, hole)
    fz = bed(k, hole, lid=False)
    specimen(k, -0.2, 0.06, fz)
    plates = ((0.25, 0.0, 0.14, 0.4), (0.45, 0.1, 0.12, -0.3), (0.62, 0.0, 0.1, 0.8))
    for u, v, s, rz in plates:
        k.box(u, v, fz, s, s * 0.75, zpx(1), "resSpec", top="resSpecL", rz=rz)
    for u in (-0.6, 0.0, 0.6):
        bezel(k, u, 0.16, n=2)
    # the hood along the back: a raised block with a chamfered front, a gold seam, two jointed arms out over the bed
    k.box(0.0, -9 * PXG, ZD, 56 * PXG, 10 * PXG, zpx(10), "lvW2", top="lvW")
    k.box(0.0, -4 * PXG, ZD + zpx(6), 56 * PXG, 0.1, 0.1, "lvW2", top="lvW", rx=0.785)
    patch(k, "v", 0.0, -4 * PXG, 52 * PXG, ZD + zpx(2), zpx(1), G)
    notches(k, -24 * PXG, 24 * PXG, -9 * PXG, 6)
    for au, tu in ((-0.45, -0.25), (0.35, 0.3)):
        a, b2, c = (au, -4 * PXG, ZD + zpx(7)), (au + 0.05, 0.08, ZD + zpx(10)), (tu, 0.06, fz + 0.1)
        bar(k, a, b2, 0.07, "lvW2")
        bar(k, b2, c, 0.045, "lvWS")
        k.cyl(b2[0], b2[1], b2[2] - 0.04, 0.045, 0.08, "brass", sides=10)
        k.box(c[0], c[1], c[2] - 0.05, 0.03, 0.03, 0.05, G)
    return k.build()


def x4_holo():
    k = K("research_x4_holo", FP2, 0)
    plates = ((0.25, 0.0, 0.14, 0.4), (0.45, 0.1, 0.12, -0.3), (0.62, 0.0, 0.1, 0.8))
    fz = ZD - zpx(3)
    for i, (u, v, s, rz) in enumerate(plates):
        fu, fv, fz2 = -0.2 + 0.1 * (i - 1), 0.06, ZD + 0.12 + i * 0.09
        k.box(fu, fv, fz2, s, s * 0.75, 0.012, F, rz=rz)
        bar(k, (fu, fv, fz2), (u, v, fz + 0.04), 0.012, G)
    return k


# ---- y2: chamber tower ----------------------------------------------------------------------------------------------

def _vials(k, u0, u1, v, z, cols, step=3):
    u, i = u0, 0
    while u <= u1 + 1e-6:
        k.cyl(u, v, z, 0.03, 0.1, "lvW", top=cols[i % len(cols)], sides=8)
        u += step * PXG
        i += 1


def y2(layer):
    k = machine(f"research_y2_{layer}")
    base(k)
    hole = (-26 * PXG, 6 * PXG, -6 * PXG, 6 * PXG)
    deck(k, hole)
    fz = bed(k, hole, floor="resNvyD", top="resNvyD", depth=4)
    cols = ("resBio", "medRed", "hivis", "resVio")
    for v in (-3 * PXG, 3 * PXG):
        _vials(k, -24 * PXG, 4 * PXG, v, fz, cols)
    k.box(-10 * PXG, 0.0, fz, 30 * PXG, PXG, 0.004, G)                               # a lit seam between the rows
    notches(k, -26 * PXG, 4 * PXG, -10 * PXG)
    bezel(k, -0.45, 0.24)
    # the chamber: a C-shaped frame (a back column, a base, a cap reaching forward), a glass cylinder of fluid
    # between them, the specimen held in it, gold rings
    tu, th = 19 * PXG, zpx(30)
    k.box(tu, -10 * PXG, ZD, 18 * PXG, 8 * PXG, th + zpx(4), "lvW2", top="lvW")          # the column,
    patch(k, "v", tu, -6 * PXG, 4 * PXG, ZD + zpx(6), th - zpx(10), G)                 # a gold seam down it
    k.cyl(tu, 2 * PXG, ZD, 0.24, zpx(3), "lvW2", top="lvW", sides=24)                   # the base,
    k.box(tu, -4 * PXG, ZD + th, 18 * PXG, 12 * PXG, zpx(4), "lvW2", top="lvW")
    k.cyl(tu, 2 * PXG, ZD + th, 0.24, zpx(4), "lvW2", top="lvW", sides=24)               # the cap,
    cz0, ch = ZD + zpx(3), th - zpx(3)
    k.part("glass").cyl(tu, 2 * PXG, cz0, 0.19, ch, "glassL", top="glassL", sides=20)
    k.part("fluid").cyl(tu, 2 * PXG, cz0, 0.175, ch - zpx(4), "resFluid", sides=20)
    k.cyl(tu, 2 * PXG, cz0, 0.025, 0.2, "steelL", sides=8)
    sz = cz0 + 0.2
    k.cyl(tu, 2 * PXG, sz, 0.09, 0.13, "resSpec", top="resSpecL", sides=12, rtop=0.05)
    for i in range(4):
        a = i * math.tau / 4 + 0.4
        bar(k, (tu + 0.08 * math.cos(a), 2 * PXG + 0.08 * math.sin(a), sz + 0.06),
            (tu + 0.14 * math.cos(a + 0.5), 2 * PXG + 0.14 * math.sin(a + 0.5), sz + 0.22), 0.025, "resFrond")
    for z in (cz0 + zpx(1), ZD + th - zpx(1)):
        ring(k, "z", tu, 2 * PXG, z, 0.2, 20, zpx(1), 0.012, G)
    return k.build()


def y2_holo():
    k = K("research_y2_holo", FP2, 0)
    _pane(k, -0.42, -0.1, ZD + 0.22, 0.46, 0.26, 0.1, G, F, ((0, 1, 0.3), (0, 0.66, 0.2), (0, 0.33, 0.36), (0, 0.0, 0.16)))
    bar(k, (-0.42, -0.05, ZD + 0.02), (-0.42, -0.08, ZD + 0.22), 0.012, G)
    return k


# ---- y3: centrifuge -------------------------------------------------------------------------------------------------

def y3(layer):
    k = machine(f"research_y3_{layer}")
    base(k)
    deck(k)
    du, dr = -0.3, 0.3
    k.cyl(du, 0.0, ZD, dr + 0.03, zpx(3), "lvW2", top="lvW", sides=28)                  # the drum's rim,
    k.cyl(du, 0.0, ZD + zpx(3), dr, zpx(2), "resNvyD", top="resNvyD", sides=28)         # its well,
    for i in range(10):                                                              # the rotor of vials,
        a = i * math.tau / 10
        k.cyl(du + 0.2 * math.cos(a), 0.2 * math.sin(a), ZD + zpx(5), 0.032, 0.08, "lvW",
              top=("resBio", "medRed", "hivis", "resVio")[i % 4], sides=8)
    k.cyl(du, 0.0, ZD + zpx(5), 0.07, zpx(3), "steelL", top="steel", sides=12)
    ring(k, "z", du, 0.0, ZD + zpx(2), dr + 0.03, 28, zpx(1), 0.012, G)
    k.part("glass").cyl(du, 0.0, ZD + zpx(5), dr, 0.2, "glassL", sides=24, rtop=dr * 0.7)   # its dome
    # the sensor arch over it, across v: legs on the back and front rails, a beam, a head pointing down
    aw, ah = 6 * PXG, zpx(18)
    for lv in (-12 * PXG, 12 * PXG):
        k.box(du, lv, ZD, aw, 4 * PXG, ah, "lvW2", top="lvW")
    k.box(du, 0.0, ZD + ah, aw, 2 * V1, zpx(4), "lvW2", top="lvW")
    for sv, rx in ((-1, 0.785), (1, -0.785)):
        k.box(du, sv * (V1 - 0.02), ZD + ah + zpx(1), aw, 0.09, 0.09, "lvW2", top="lvW", rx=rx)
    k.box(du, 0.0, ZD + ah - zpx(5), 8 * PXG, 8 * PXG, zpx(5), "lvW2", top="lvW")         # the head,
    k.box(du, 0.0, ZD + ah - zpx(5) - 0.006, 4 * PXG, 4 * PXG, 0.006, G)
    patch(k, "v", du, V1, aw - 2 * PXG, ZD + ah + zpx(2), zpx(1), G)
    # the right of the deck: two bezels, a sample slot
    bezel(k, 0.4, 0.2)
    bezel(k, 0.72, 0.16, n=2)
    k.box(0.56, -6 * PXG, ZD, 14 * PXG, 6 * PXG, zpx(1), "resNvyD")
    notches(k, 0.36, 0.84, -11 * PXG)
    return k.build()


def y3_holo():
    k = K("research_y3_holo", FP2, 0)
    du = -0.3
    for z, r in ((ZD + 0.4, 0.22), (ZD + 0.5, 0.16), (ZD + 0.58, 0.1)):
        ring(k, "z", du, 0.0, z, r, 20, 0.012, 0.012, G)
    k.box(du + 0.3, 0.0, ZD + 0.38, 0.22, 0.01, 0.14, F)
    for i, w in enumerate((0.14, 0.08, 0.18)):
        k.box(du + 0.3 - 0.1 + w / 2, 0.006, ZD + 0.48 - i * 0.04, w, 0.01, 0.02, G)
    return k


# ---- y4: sample tunnel ----------------------------------------------------------------------------------------------

def y4(layer):
    k = machine(f"research_y4_{layer}")
    base(k)
    hole = (-27 * PXG, 27 * PXG, -3 * PXG, 3 * PXG)
    deck(k, hole)
    fz = bed(k, hole, floor="resNvyD", top="resNvyD", depth=2, lid=False)
    k.box(0.0, 0.0, fz, 54 * PXG, PXG, 0.004, G)                                     # the track's guide light
    for u, col in ((-0.78, "resBio"), (-0.62, "medRed"), (0.62, "hivis"), (0.78, "resBio")):
        k.cyl(u, 0.0, fz, 0.05, zpx(3), "lvW", top=col, sides=10)                        # capsules on it
    notches(k, -26 * PXG, 26 * PXG, -9 * PXG)
    bezel(k, -0.7, 0.18)
    bezel(k, 0.7, 0.18)
    # the tunnel: walls either side of the channel, a roof with chamfers, a lit window in its front wall
    tw, th = 30 * PXG, zpx(14)
    k.box(0.0, -8 * PXG, ZD, tw, 10 * PXG, th, "lvW2", top="lvW")                         # back wall,
    k.box(0.0, 7 * PXG, ZD, tw, 8 * PXG, th, "lvW2", top="lvW")                           # front wall,
    k.box(0.0, -PXG, ZD + th, tw, 26 * PXG, zpx(5), "lvW2", top="lvW")                    # roof
    for sv, rx in ((-1, 0.785), (1, -0.785)):
        k.box(0.0, sv * 12 * PXG - PXG, ZD + th + zpx(3), tw, 0.09, 0.09, "lvW2", top="lvW", rx=rx)
    patch(k, "v", 0.0, 11 * PXG, tw - 6 * PXG, ZD + zpx(4), zpx(7), "resNvyD")            # the window,
    for u in (-0.2, 0.0, 0.2):
        patch(k, "v", u, 11 * PXG + 0.002, 0.06, ZD + zpx(5), zpx(4), ("resBio", "hivis", "medRed")[int(u * 5 + 1)])
    patch(k, "v", 0.0, 11 * PXG + 0.003, tw - 6 * PXG, ZD + zpx(10), zpx(1), G)            # its lamp
    return k.build()


def y4_holo():
    k = K("research_y4_holo", FP2, 0)
    mz = ZD + zpx(19) + 0.25
    atoms = [(0.0, 0.0, 0.0), (0.14, 0.04, 0.06), (-0.12, 0.06, 0.08), (0.04, -0.12, 0.1), (0.2, -0.08, -0.06)]
    for i, (a, b, c) in enumerate(atoms):
        k.box(a, b, mz + c, 0.06, 0.06, 0.06, G if i % 2 == 0 else F, rz=0.785)
    for i, j in ((0, 1), (0, 2), (0, 3), (1, 4)):
        p, q = atoms[i], atoms[j]
        bar(k, (p[0], p[1], mz + p[2] + 0.03), (q[0], q[1], mz + q[2] + 0.03), 0.015, G)
    bar(k, (0.0, 0.0, ZD + zpx(19)), (0.0, 0.0, mz), 0.015, G)
    return k


BUILD = {v: (globals()[v], globals()[f"{v}_holo"], FP2) for v in ("x2", "x3", "x4", "y2", "y3", "y4")}
