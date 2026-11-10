"""Research bench look studies, round 2: d specimen tank, e holo table (kept as a reference), f analysis cabinet.

  d  a glass tank of glowing fluid with a creature suspended in it, a scan ring round it, instrument towers piped
     into it; the desk wings come forward round the chair with sloped control panels
  e  a round projector table at the back, the desk sweeping round the chair in two curved arms, emitter horns at the
     back corners; a big amber hologram of the find (a wire globe round a crystal) floats over the table
  f  one tall cabinet; its middle is a lit glass chamber with a sample on a turntable, a manipulator and glove ports
     reaching in; sample drawers on the left, instruments on the right, counter wings round the chair; a lime readout
     projected over it"""
import math

from .modkit import K
from .research_kit import FP, Bench, bar, body, chair, ring, slope_panel


# ---- d: the specimen tank -------------------------------------------------------------------------------------------

def tank_d(layer):
    k = Bench(f"research_d_{layer}")
    G, F = "resBio", "resFluid"
    TOP = 0.66
    body(k, 0.0, -0.52, 2.96, 0.88, TOP)                                              # back run
    for su in (-1, 1):                                                                # wings round the chair
        body(k, su * 1.0, 0.36, 0.94, 0.86, 0.6, col="steelD")
        slope_panel(k, su * 1.0, 0.36, 0.56, 0.8, 0.74, su * 0.3, G)
    k.box(0.0, -0.94, TOP, 2.96, 0.06, 0.16, "gm", top="steelL")                     # back lip
    # instrument towers in the back corners, sloped faces toward the chair, piped into the tank
    for su in (-1, 1):
        tu = su * 1.02
        k.box(tu, -0.62, TOP, 0.8, 0.62, 0.52, "steel", top="plate", bevel=0.02)
        k.box(tu, -0.38, TOP + 0.5, 0.8, 0.2, 0.08, "steelD", top="gm")
        k.box(tu, -0.62, TOP + 0.52, 0.8, 0.6, 0.18, "steel", top="plate", rx=0.35, bevel=0.02)
        k.box(tu, -0.33, TOP + 0.14, 0.62, 0.02, 0.28, "dark")                         # its screen
        for i, w in enumerate((0.4, 0.24, 0.48, 0.3)):
            k.box(tu - 0.29 + w / 2 + 0.02, -0.315, TOP + 0.18 + i * 0.055, w, 0.02, 0.03, G)
        for i in range(3):
            k.box(tu + su * 0.25, -0.32, TOP + 0.02 + i * 0.04, 0.12, 0.02, 0.02, "gmD")
        for dz, col in ((0.3, "gm"), (0.42, "pcb")):                                  # pipes to the tank collar
            bar(k, (tu - su * 0.4, -0.62, TOP + dz), (su * 0.34, -0.55, TOP + 0.1 + dz * 0.3), 0.07, col)
    # the tank: a collar, a glass cylinder of lit fluid with a creature in it, a cap with pipes back to the wall
    tu, tv = 0.0, -0.5
    k.cyl(tu, tv, TOP, 0.42, 0.16, "gm", top="steelL", sides=20)
    k.cyl(tu, tv, TOP + 0.16, 0.36, 0.04, "steelD", top="dark", sides=20)
    for i in range(10):
        a = i * math.tau / 10
        k.box(tu + 0.425 * math.cos(a), tv + 0.425 * math.sin(a), TOP + 0.05, 0.04, 0.04, 0.05,
              G if i % 2 else "gmD", rz=a)
    z0, h = TOP + 0.2, 0.92
    k.part("glass").cyl(tu, tv, z0, 0.33, h, "glassL", top="glassL", sides=20)
    k.part("fluid").cyl(tu, tv, z0, 0.3, h - 0.08, F, top=G, sides=20)
    # the creature: a dark body, a pale belly, curling tendrils, an eye spot
    k.cyl(tu, tv, z0 + 0.36, 0.15, 0.2, "resSpec", sides=12, rtop=0.13)              # mantle
    k.cyl(tu, tv, z0 + 0.56, 0.13, 0.12, "resSpec", sides=12, rtop=0.05)
    k.cyl(tu, tv, z0 + 0.3, 0.12, 0.06, "resSpecL", sides=12, rtop=0.15)               # pale underside
    for du in (-0.06, 0.06):
        k.box(tu + du, tv + 0.12, z0 + 0.46, 0.05, 0.04, 0.05, "resEye")
    for i in range(5):
        a = i * math.tau / 5 + 0.4
        m = (tu + 0.15 * math.cos(a + 0.3), tv + 0.15 * math.sin(a + 0.3), z0 + 0.2)
        bar(k, (tu + 0.09 * math.cos(a), tv + 0.09 * math.sin(a), z0 + 0.32), m, 0.045, "resSpec")
        bar(k, m, (tu + 0.2 * math.cos(a + 0.7), tv + 0.2 * math.sin(a + 0.7), z0 + 0.06), 0.035, "resSpec")
    for (du, dv, dz) in ((0.12, -0.05, 0.6), (-0.15, 0.08, 0.5), (0.08, 0.12, 0.66)):   # bubbles
        k.box(tu + du, tv + dv, z0 + dz, 0.04, 0.04, 0.04, G)
    k.cyl(tu, tv, z0 + h, 0.38, 0.08, "gm", top="steelL", sides=20)                     # cap
    k.cyl(tu, tv, z0 + h + 0.08, 0.14, 0.06, "steelD", top="steelL", sides=12)
    for su in (-1, 1):
        bar(k, (tu + su * 0.12, tv - 0.1, z0 + h + 0.1), (tu + su * 0.12, -0.9, z0 + h + 0.1), 0.06, "gm")
        bar(k, (tu + su * 0.12, -0.9, z0 + h + 0.1), (tu + su * 0.12, -0.9, TOP + 0.1), 0.06, "gm")
    for su in (-1, 1):                                                                # the scan ring's rails
        k.box(tu + su * 0.43, tv - 0.08, z0, 0.05, 0.05, h, "steelD")
    chair(k, "gm", "pcb")
    return k.build()


def tank_d_holo():
    """The scan ring (a lit band and a translucent scan plane through the tank) and a readout pane over a tower."""
    k = K("research_d_holo", FP, 0)
    G, F = "resBio", "resBioF"
    tu, tv, z = 0.0, -0.5, 1.5
    ring(k, "z", tu, tv, z, 0.42, 24, 0.05, 0.05, G)
    k.cyl(tu, tv, z + 0.01, 0.4, 0.02, F, top=F, sides=24)
    v0, z0, w, h, lean = -0.4, 1.42, 0.62, 0.36, 0.3                                  # pane over the right tower
    for t in (0.0, h - 0.035):
        k.box(1.0, v0 - t * math.sin(lean), z0 + t * math.cos(lean), w, 0.02, 0.035, G, rx=lean)
    k.box(1.0, v0 - h / 2 * math.sin(lean), z0 + 0.03, w - 0.02, 0.02, h - 0.06, F, rx=lean)
    for i in range(7):                                                                # a helix trace on it
        t = 0.06 + 0.22 * (0.5 + 0.5 * math.sin(i * 0.9))
        k.box(0.76 + i * 0.08, v0 - t * math.sin(lean) + 0.012, z0 + t * math.cos(lean), 0.05, 0.02, 0.05, G,
              rx=lean)
    return k


# ---- e: the holo table ----------------------------------------------------------------------------------------------

ARC_C, ARC_R = (0.0, 0.38), 0.86


def table_e(layer):
    k = Bench(f"research_e_{layer}")
    G = "resAmb"
    H = 0.6
    # the projector table: a round drum, a bezel, the dark emitter well and its lit lens rings
    pu, pv = 0.0, -0.46
    k.cyl(pu, pv, 0.0, 0.56, 0.08, "dark", sides=28)
    k.cyl(pu, pv, 0.08, 0.62, H - 0.12, "steel", top="steelL", sides=28)
    for i in range(14):                                                               # panel seams round the drum
        a = i * math.tau / 14
        k.box(pu + 0.625 * math.cos(a), pv + 0.625 * math.sin(a), 0.14, 0.02, 0.03, H - 0.3, "steelD", rz=a)
    k.cyl(pu, pv, H - 0.04, 0.66, 0.06, "gm", top="plate", sides=28)
    k.cyl(pu, pv, H + 0.02, 0.52, 0.03, "steelD", top="dark", sides=28)
    ring(k, "z", pu, pv, H + 0.03, 0.47, 24, 0.025, 0.04, G)
    ring(k, "z", pu, pv, H + 0.03, 0.25, 16, 0.025, 0.035, G)
    k.cyl(pu, pv, H + 0.03, 0.08, 0.04, "steelL", top=G, sides=10)
    # the desk: two curved arms round the chair, from the table out to the front tiles, ending in pedestals
    cu, cv = ARC_C
    for side in (-1, 1):
        n = 5
        for i in range(n):
            th = math.radians(270 + side * (44 + i * 13))
            u, v = cu + ARC_R * math.cos(th), cv + ARC_R * math.sin(th)
            rz = th + math.pi / 2
            k.box(u, v, 0.0, 0.26, 0.4, 0.08, "dark", rz=rz)
            k.box(u, v, 0.08, 0.32, 0.48, H - 0.12, "steel", top="plate", rz=rz)
            k.box(u, v, 0.15, 0.33, 0.49, H - 0.32, "plateB", rz=rz)
            k.box(u, v, H - 0.04, 0.34, 0.52, 0.04, "gm", top="plate", rz=rz)
            ui, vi = cu + (ARC_R - 0.17) * math.cos(th), cv + (ARC_R - 0.17) * math.sin(th)
            k.box(ui, vi, H, 0.3, 0.1, 0.04, "blueGrey", top="dark", rz=rz)            # inner control strip
            if i % 2 == 0:
                k.box(ui, vi, H + 0.04, 0.1, 0.06, 0.012, G if i % 4 == 0 else "hivis", rz=rz)
        th = math.radians(270 + side * (44 + n * 13 - 4))
        u, v = cu + ARC_R * math.cos(th), cv + ARC_R * math.sin(th)
        k.cyl(u, v, 0.0, 0.26, H + 0.06, "steelD", top="gm", sides=14)                  # pedestal end
        k.cyl(u, v, H + 0.06, 0.18, 0.04, "steel", top=G, sides=14)
    # emitter horns in the back corners, aimed at the space over the table
    for su in (-1, 1):
        hu, hv = su * 1.2, -0.68
        k.box(hu, hv, 0.0, 0.34, 0.34, 0.08, "dark")
        k.box(hu, hv, 0.08, 0.28, 0.28, 1.12, "steel", top="steelL", bevel=0.03)
        for z in (0.3, 0.6, 0.9):
            k.box(hu, hv, z, 0.3, 0.3, 0.04, "steelD")
        k.box(hu - su * 0.06, hv + 0.06, 1.2, 0.2, 0.2, 0.28, "gm", top="steelL", ry=-su * 0.5, bevel=0.02)
        k.box(hu - su * 0.16, hv + 0.1, 1.27, 0.08, 0.1, 0.12, G, ry=-su * 0.5)        # its lit lens
        k.box(hu, hv + 0.15, 0.4, 0.06, 0.02, 0.06, G)
    chair(k, "steelD", "rust")
    return k.build()


def table_e_holo():
    """The find as a hologram: a wire globe (three rings and meridians) round a slowly turning crystal, the beam up
    from the lens, two label panes, faint film fills."""
    k = K("research_e_holo", FP, 0)
    G, F = "resAmb", "resAmbF"
    pu, pv, cz, R = 0.0, -0.46, 1.2, 0.4
    for zz, rr in ((0.0, R), (0.24, R * 0.8), (-0.24, R * 0.8)):
        ring(k, "z", pu, pv, cz + zz, rr, 24, 0.025, 0.025, G)
    ring(k, "u", pu, pv, cz, R, 24, 0.025, 0.025, G)
    ring(k, "v", pu, pv, cz, R, 24, 0.025, 0.025, G)
    k.cyl(pu, pv, cz - 0.3, 0.3, 0.6, F, top=F, sides=16)                             # the globe's film
    k.box(pu, pv, cz - 0.2, 0.2, 0.2, 0.2, G, rz=0.6, rx=0.62, ry=0.5)                # the crystal
    k.box(pu, pv, cz - 0.02, 0.12, 0.12, 0.26, G, rz=0.6, taper=0.1)
    k.cyl(pu, pv, 0.64, 0.1, cz - 0.64 - R + 0.05, F, rtop=0.24, sides=12)            # the beam
    for su, z in ((-1, 1.42), (1, 1.05)):                                             # label panes off its sides
        bar(k, (pu + su * R * 0.8, pv, z), (pu + su * (R + 0.18), pv + 0.1, z + 0.05), 0.02, G)
        k.box(pu + su * (R + 0.35), pv + 0.12, z - 0.02, 0.32, 0.02, 0.16, F)
        for i in range(2):
            k.box(pu + su * (R + 0.33), pv + 0.135, z + 0.02 + i * 0.06, 0.22 - 0.08 * i, 0.02, 0.03, G)
    return k


# ---- f: the analysis cabinet ----------------------------------------------------------------------------------------

def cabinet_f(layer):
    k = Bench(f"research_f_{layer}")
    G, L = "resLime", "resLamp"
    BH, TOPZ = 0.62, 1.56
    body(k, 0.0, -0.55, 2.96, 0.8, BH, col="lvW2", top="lvW", panel="lvWS")           # base run
    for su in (-1, 1):                                                                # counter wings round the chair
        body(k, su * 1.0, 0.33, 0.94, 0.86, BH, col="lvW2", top="lvW", panel="lvWS")
    for su in (-1, 1):                                                                # tall side columns
        k.box(su * 1.05, -0.58, BH, 0.86, 0.74, TOPZ - BH, "lvW2", top="lvW", bevel=0.02)
    k.box(0.0, -0.58, TOPZ - 0.2, 1.3, 0.74, 0.2, "lvW2", top="lvW", bevel=0.02)       # header over the chamber
    k.box(0.0, -0.2, TOPZ - 0.17, 1.24, 0.02, 0.1, "gm")                               # its trim
    k.box(0.0, -0.58, TOPZ, 2.9, 0.68, 0.06, "steel", top="steelL", bevel=0.01)        # one roof cap over it all
    for i in range(5):
        k.box(-0.6 + i * 0.3, -0.62, TOPZ + 0.06, 0.12, 0.42, 0.03, "gmD")             # vent grille on top
    # the chamber: lit back wall, a floor, a lamp bar along the top front edge, glass front
    cz0, cz1 = BH, TOPZ - 0.2
    k.box(0.0, -0.9, cz0, 1.24, 0.06, cz1 - cz0, "lvW", top="lvW")
    k.box(0.0, -0.58, cz0, 1.24, 0.7, 0.03, "steelL", top="steelL")
    k.box(0.0, -0.28, cz1 - 0.06, 1.2, 0.08, 0.05, L)
    k.part("glass").box(0.0, -0.22, cz0 + 0.02, 1.24, 0.03, cz1 - cz0 - 0.04, "glassL", rx=0.08)
    for su in (-1, 1):
        k.box(su * 0.64, -0.22, cz0, 0.05, 0.08, cz1 - cz0, "steelD")                  # glass frame posts
    k.box(0.0, -0.18, cz0, 1.32, 0.1, 0.06, "steel", top="steelL")                    # sill
    # inside: a turntable with the sample, a scanner head over it, a manipulator arm from the ceiling, gloves
    k.cyl(0.0, -0.58, cz0 + 0.03, 0.2, 0.06, "gm", top="steelL", sides=16)
    k.cyl(0.0, -0.58, cz0 + 0.09, 0.08, 0.04, "steelD", sides=10)
    k.box(0.0, -0.58, cz0 + 0.12, 0.17, 0.17, 0.22, G, rz=0.5, rx=0.4, ry=0.3)          # the sample, lit
    k.box(0.0, -0.58, cz0 + 0.3, 0.1, 0.1, 0.2, G, rz=0.5, taper=0.2)
    bar(k, (-0.4, -0.8, cz1), (-0.3, -0.62, cz0 + 0.42), 0.06, "hivis")                # manipulator
    bar(k, (-0.3, -0.62, cz0 + 0.42), (-0.12, -0.58, cz0 + 0.28), 0.05, "hivis")
    k.box(-0.11, -0.58, cz0 + 0.22, 0.07, 0.07, 0.07, "gmD")
    k.box(0.22, -0.66, cz0 + 0.5, 0.18, 0.16, 0.1, "steelD", top="gm")                 # scanner head on a stalk
    k.box(0.22, -0.66, cz0 + 0.6, 0.04, 0.04, cz1 - cz0 - 0.6, "steelL")
    k.box(0.22, -0.66, cz0 + 0.48, 0.12, 0.1, 0.02, G)
    for su in (-1, 1):                                                                # glove ports, gloves inside
        pu = su * 0.36
        ring(k, "v", pu, -0.2, cz0 + 0.34, 0.11, 12, 0.05, 0.04, "steelL")
        bar(k, (pu, -0.24, cz0 + 0.34), (pu * 0.7, -0.5, cz0 + 0.22), 0.09, "black")
        k.box(pu * 0.62, -0.54, cz0 + 0.14, 0.1, 0.1, 0.1, "black", bevel=0.03)
    # left column: sample drawers with lit tags, a cold store door with a frosted window
    lu = -1.05
    for i in range(3):
        z = BH + 0.06 + i * 0.16
        k.box(lu - 0.15, -0.205, z, 0.46, 0.02, 0.13, "lvWS")
        k.box(lu - 0.15, -0.19, z + 0.04, 0.14, 0.02, 0.04, G if i == 1 else "gmD")
    k.box(lu + 0.24, -0.205, BH + 0.06, 0.3, 0.02, 0.8, "lvWS")
    k.box(lu + 0.24, -0.19, BH + 0.5, 0.18, 0.02, 0.24, "iceB")
    k.box(lu + 0.12, -0.185, BH + 0.3, 0.03, 0.03, 0.18, "steelD")                    # its handle
    # right column: two readouts, vent slats, a status lamp
    ru = 1.05
    for i, z in enumerate((BH + 0.42, BH + 0.08)):
        k.box(ru, -0.205, z, 0.62, 0.02, 0.3, "gm")
        k.box(ru, -0.195, z + 0.04, 0.54, 0.02, 0.22, "dark")
        for j, w in enumerate((0.36, 0.2, 0.44)[: 3 - i]):
            k.box(ru - 0.25 + w / 2, -0.18, z + 0.07 + j * 0.06, w, 0.02, 0.03, G)
    k.cyl(ru + 0.28, -0.4, TOPZ + 0.06, 0.06, 0.06, "steelD", top=G, sides=8)
    # built into the wings: a sample rack in a recess (left), a sloped keyboard (right)
    k.box(-1.0, 0.25, BH - 0.06, 0.6, 0.3, 0.07, "dark")
    for i in range(5):
        k.cyl(-1.24 + i * 0.12, 0.25, BH - 0.04, 0.035, 0.08, "lvW", top=("pcb", G, "medRed", "iceB", "hivis")[i],
              sides=8)
    k.box(1.0, 0.3, BH, 0.6, 0.36, 0.06, "gm", top="dark", ry=-0.25)
    for i in range(3):
        k.box(1.0, 0.2 + i * 0.1, BH + 0.06, 0.5, 0.05, 0.012, "steelD", ry=-0.25)
    chair(k, "lvW2", "pcb")
    return k.build()


def cabinet_f_holo():
    """A readout projected out over the chamber, tipped toward the chair: a lattice of the sample and two bars."""
    k = K("research_f_holo", FP, 0)
    G, F = "resLime", "resLimeF"
    v0, z0, w, h, lean = -0.3, 1.66, 0.9, 0.3, 0.25
    tip = lambda t: (v0 - t * math.sin(lean), z0 + t * math.cos(lean))  # noqa: E731
    for t in (0.0, h - 0.03):
        v, z = tip(t)
        k.box(0.0, v, z, w, 0.02, 0.03, G, rx=lean)
    v, z = tip(0.0)
    k.box(0.0, v - (h / 2) * math.sin(lean), z + 0.0, w - 0.02, 0.02, h, F, rx=lean)
    for i in range(4):
        for j in range(3):
            v, z = tip(0.08 + j * 0.11)
            k.box(-0.36 + i * 0.1, v + 0.015, z, 0.045, 0.02, 0.045, G, rx=lean)
    for j, bw in enumerate((0.3, 0.18)):
        v, z = tip(0.1 + j * 0.14)
        k.box(0.1 + bw / 2, v + 0.015, z, bw, 0.02, 0.04, G, rx=lean)
    for su in (-1, 1):                                                                # beams up from the header
        bar(k, (su * 0.3, -0.5, 1.62), (su * 0.42, v0, z0), 0.02, F)
    return k


BUILD = {"d": (tank_d, tank_d_holo), "e": (table_e, table_e_holo), "f": (cabinet_f, cabinet_f_holo)}
