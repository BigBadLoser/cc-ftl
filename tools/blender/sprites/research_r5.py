"""Research bench look studies, round 5: j specimen tank, k prototype test bay, l light table. One unit each, its own
form, a place to work built in.

  j  a long lit aquarium across the back row (alien fronds, a creature, glowing spores in the water), on a cabinet;
     the desk is a ledge on its front (keyboard, notes, a vial rack); probes dip in from the lit hood; a filter unit at
     the front right is plumbed into it. Hologram: a label pane tracking the creature
  k  a caged test cell: a prototype on a test stand (coils round a gold core), instrument columns at the sides; its
     front is a blast shield of glass on a desk-height base that is the desk (keyboard, a guarded abort button,
     notes). Hologram: a HUD on the glass (a target bracket round the prototype, a trace, readings)
  l  a lab cabinet across the back (specimen drawers both sides, jars on the left, a tool tray on the right) with a
     backlit table tilted toward the chair in the middle, a winged specimen pinned out on it, a camera and magnifier
     boom over it. Hologram: two labels on short leaders to its parts"""
import math

from .modkit import K
from .research_kit import Bench, bar, body, chair, ring
from .research_r3 import _pane
from .research_r4 import keyboard, slate


# ---- j: the specimen tank -------------------------------------------------------------------------------------------

TV, TB, TH = -0.56, 0.5, 0.62     # the tank: centre v, its base top, the water depth


def _frond(k, u, v, h, lean, col, top):
    """A frond: a stalk leaning `lean`, with three leaf blades up it."""
    k.box(u, v, TB + 0.04, 0.035, 0.035, h, col, rx=lean)
    for i, t in enumerate((0.35, 0.6, 0.85)):
        k.box(u + (0.04 if i % 2 else -0.04), v - h * t * math.sin(lean), TB + 0.04 + h * t * math.cos(lean),
              0.1, 0.03, 0.05, top, rz=0.5 if i % 2 else -0.5, ry=0.5 if i % 2 else -0.5)


def tank_j(layer):
    k = Bench(f"research_j_{layer}")
    G = "resBio"
    body(k, 0.0, TV, 2.96, 0.8, TB, col="steel", top="gm")                             # the cabinet under it
    # the tank: a steel frame, glass walls, the water, a sand bed, fronds, a creature, spores
    w, d = 2.84, 0.7
    k.box(0.0, TV, TB, w, d, 0.04, "gm", top="dark")
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(su * (w / 2 - 0.03), TV + sv * (d / 2 - 0.03), TB, 0.06, 0.06, TH + 0.1, "steelD")
    k.part("glass").box(0.0, TV, TB + 0.04, w - 0.06, d - 0.06, TH + 0.04, "glassL")
    k.part("fluid").box(0.0, TV, TB + 0.04, w - 0.1, d - 0.1, TH - 0.04, "resFluid", top="resWater")
    k.box(0.0, TV, TB + 0.04, w - 0.1, d - 0.1, 0.06, "resSand", top="resSand")
    for u, v, h, lean in ((-1.1, -0.7, 0.5, 0.15), (-0.95, -0.45, 0.36, -0.2), (-0.55, -0.72, 0.56, 0.05),
                          (0.45, -0.7, 0.48, 0.2), (0.7, -0.5, 0.34, -0.15), (1.1, -0.66, 0.54, 0.1)):
        _frond(k, u, v, h, lean, "resFrond", "resFrondL")
    k.cyl(-0.2, -0.6, TB + 0.1, 0.12, 0.08, "resSpecL", top="resSpecL", sides=10, rtop=0.08)  # a shell on the sand
    cu, cv, cz = 0.12, -0.52, TB + 0.34                                               # the creature, drifting
    k.cyl(cu, cv, cz, 0.13, 0.14, "resSpec", sides=12, rtop=0.06)
    k.cyl(cu, cv, cz - 0.03, 0.1, 0.03, "resSpecL", sides=12)
    for du in (-0.05, 0.05):
        k.box(cu + du, cv + 0.11, cz + 0.06, 0.04, 0.03, 0.04, "resEye")
    for i in range(4):
        a = i * math.tau / 4 + 0.6
        bar(k, (cu + 0.07 * math.cos(a), cv + 0.07 * math.sin(a), cz), (cu + 0.14 * math.cos(a + 0.4),
            cv + 0.14 * math.sin(a + 0.4), cz - 0.2), 0.035, "resSpec")
    for u, v, z in ((-0.7, -0.4, 0.3), (-0.35, -0.7, 0.48), (0.5, -0.42, 0.22), (0.92, -0.6, 0.42), (-1.0, -0.6, 0.5)):
        k.box(u, v, TB + z, 0.05, 0.05, 0.05, G)                                       # glowing spores
    # the hood: a lid with a light bar along its front, two probes dipping in, cables to the wall
    hz = TB + TH + 0.1
    k.box(0.0, TV, hz, w + 0.04, d + 0.04, 0.1, "steel", top="steelL", bevel=0.02)
    k.box(0.0, TV + d / 2 + 0.025, hz + 0.02, w - 0.2, 0.02, 0.05, G)
    for pu in (-0.55, 0.62):
        k.cyl(pu, TV - 0.1, hz + 0.1, 0.06, 0.08, "gm", top="steelL", sides=10)
        k.box(pu, TV - 0.1, TB + 0.22, 0.04, 0.04, hz - TB - 0.12, "steelL")
        k.box(pu, TV - 0.1, TB + 0.18, 0.03, 0.03, 0.04, G)
    bar(k, (-0.55, TV - 0.1, hz + 0.18), (-0.55, -0.95, hz + 0.18), 0.04, "gmD")
    bar(k, (0.62, TV - 0.1, hz + 0.18), (0.62, -0.95, hz + 0.18), 0.04, "gmD")
    # the ledge desk on the cabinet's front, at the chair: brackets, a top, keyboard, notes, a vial rack
    lv = TV + 0.4 + 0.12
    for su in (-1, 1):
        k.box(su * 0.6, lv - 0.08, 0.36, 0.05, 0.16, 0.24, "steelD")
    k.box(0.0, lv, 0.6, 1.5, 0.28, 0.04, "gm", top="plate", bevel=0.01)
    keyboard(k, 0.0, lv + 0.02, 0.64)
    slate(k, -0.5, lv + 0.01, 0.64, G, rz=0.15)
    k.box(0.5, lv - 0.02, 0.64, 0.3, 0.1, 0.04, "steelD", top="dark")
    for i, col in enumerate(("resBio", "hivis", "resBio", "medRed")):
        k.cyl(0.39 + i * 0.075, lv - 0.02, 0.64, 0.025, 0.12, "lvW", top=col, sides=8)
    # the filter unit at the front right, piped into the tank
    fu, fv = 1.05, 0.42
    k.box(fu, fv, 0.0, 0.62, 0.5, 0.06, "dark")
    k.box(fu, fv, 0.06, 0.66, 0.54, 0.4, "steel", top="gm", bevel=0.02)
    for du in (-0.15, 0.15):
        k.cyl(fu + du, fv - 0.05, 0.46, 0.1, 0.32, "steelL", top="steel", sides=14)
        k.cyl(fu + du, fv - 0.05, 0.6, 0.105, 0.04, "pcb", sides=14)
        bar(k, (fu + du, fv - 0.05, 0.78), (fu + du, -0.2, 0.78), 0.05, "gm")
        bar(k, (fu + du, -0.2, 0.78), (fu + du, -0.2, hz + 0.05), 0.05, "gm")
    k.box(fu - 0.1, fv + 0.275, 0.24, 0.2, 0.02, 0.06, G)
    chair(k, "gm", "navy")
    return k.build()


def tank_j_holo():
    """A label pane tracking the creature: a bright corner bracket round it and a pane off to its side."""
    k = K("research_j_holo", (3, 2), 0)
    G, F = "resBio", "resBioF"
    cu, cv, cz = 0.12, -0.42, TB + 0.34
    for su in (-1, 1):
        for sz in (-1, 1):
            bar(k, (cu + su * 0.22, cv, cz + sz * 0.2), (cu + su * 0.12, cv, cz + sz * 0.2), 0.02, G)
            bar(k, (cu + su * 0.22, cv, cz + sz * 0.2), (cu + su * 0.22, cv, cz + sz * 0.1), 0.02, G)
    bar(k, (cu + 0.22, cv, cz + 0.2), (cu + 0.42, cv + 0.05, cz + 0.36), 0.015, G)
    _pane(k, cu + 0.62, cv + 0.06, cz + 0.32, 0.36, 0.2, 0.1, G, F, ((0, 1, 0.2), (0, 0.5, 0.14), (1, 0.0, 0.1)))
    return k


# ---- k: the prototype test bay --------------------------------------------------------------------------------------

CV0, CV1, SH = -0.95, -0.22, 1.36  # the cell's back and front (the shield plane), its height


def test_k(layer):
    k = Bench(f"research_k_{layer}")
    G, W = "resGold", "resScan"
    cw = 2.3
    # the cell: a back wall and side walls with hazard bands, a roof frame with lights
    k.box(0.0, CV0 + 0.04, 0.0, cw, 0.08, SH, "steel", top="gm")
    for i in range(5):
        k.box(-0.9 + i * 0.45, CV0 + 0.085, 0.1, 0.3, 0.012, SH - 0.2, "plateB")       # its inner panels
    for su in (-1, 1):
        k.box(su * cw / 2, (CV0 + CV1) / 2, 0.0, 0.1, CV1 - CV0, SH, "steel", top="gm")
        for i in range(5):
            k.box(su * (cw / 2 + 0.055), CV1 - 0.06 - i * 0.14, 0.1, 0.012, 0.07, 0.14,
                  "hazY" if i % 2 == 0 else "hazK")
    k.box(0.0, CV0 + 0.04, SH, cw + 0.1, 0.1, 0.08, "gm", top="steelL")             # an open roof frame:
    for su in (-1, 1):                                                                # beams round the top,
        k.box(su * cw / 2, (CV0 + CV1) / 2, SH, 0.12, CV1 - CV0, 0.08, "gm", top="steelL")
    k.box(-0.15, (CV0 + CV1) / 2, SH, 0.1, CV1 - CV0, 0.08, "gm", top="steelL")     # one across over the
    k.box(-0.15, -0.58, SH - 0.05, 0.05, 0.4, 0.04, W)                                # stand, its light
    # the prototype on its test stand: a stand on legs, coils round a lit core, cables back to the wall
    pu, pv = -0.15, -0.6
    for su in (-1, 1):
        for sv in (-1, 1):
            k.box(pu + su * 0.22, pv + sv * 0.16, 0.0, 0.06, 0.06, 0.36, "steelD")
    k.box(pu, pv, 0.36, 0.56, 0.42, 0.06, "gm", top="steel")
    k.cyl(pu, pv, 0.42, 0.22, 0.12, "gmD", top="steel", sides=18)
    k.cyl(pu, pv, 0.54, 0.12, 0.6, G, sides=16)
    for z in (0.6, 0.78, 0.96):
        k.cyl(pu, pv, z, 0.21, 0.08, "brass", top="brass", sides=18)
    k.cyl(pu, pv, 1.14, 0.17, 0.08, "gm", top="steelL", sides=16)
    k.cyl(pu, pv, 1.22, 0.06, 0.08, "steelD", top=G, sides=10)
    bar(k, (pu, pv - 0.12, 1.2), (pu, CV0 + 0.1, 1.28), 0.05, "black")
    bar(k, (pu + 0.18, pv, 0.45), (pu + 0.18, CV0 + 0.1, 0.45), 0.05, "medRed")
    k.box(0.6, -0.55, 0.0, 0.08, 0.08, 0.7, "steelD")                                 # a sensor boom aimed at it
    bar(k, (0.6, -0.55, 0.7), (0.25, -0.6, 0.8), 0.05, "steelL")
    k.box(0.22, -0.6, 0.76, 0.1, 0.1, 0.08, "gm", top="dark")
    # instrument columns in the back corners, outside the cell, readouts toward the chair
    for su in (-1, 1):
        iu = su * 1.33
        k.box(iu, -0.6, 0.0, 0.3, 0.7, 1.3, "steel", top="steelL", bevel=0.02)
        for i in range(3):
            k.box(iu, -0.245, 0.5 + i * 0.22, 0.22, 0.02, 0.14, "dark")
            k.box(iu - 0.03, -0.235, 0.54 + i * 0.22, 0.12 - 0.03 * i, 0.02, 0.04, G if i != 1 else W)
    # the shield: a base at desk height across the front, a thick frame, the glass
    k.box(0.0, CV1 + 0.02, 0.0, cw + 0.1, 0.14, 0.62, "steel", top="gm", bevel=0.02)
    for su in (-1, 1):
        k.box(su * (cw / 2 - 0.02), CV1, 0.62, 0.12, 0.14, SH - 0.62, "gm", top="steelL")
    k.box(0.0, CV1, SH - 0.1, cw, 0.14, 0.12, "gm", top="steelL")
    k.part("glass").box(0.0, CV1, 0.62, cw - 0.2, 0.04, SH - 0.72, "glassL")
    # the desk: a ledge forward of the shield base, a keyboard, the guarded abort button, notes, a readout strip
    dv = CV1 + 0.24
    k.box(0.0, dv, 0.0, 1.6, 0.3, 0.08, "dark")
    k.box(0.0, dv, 0.08, 1.64, 0.34, 0.5, "steelD", top="gm", bevel=0.02)
    k.box(0.0, dv + 0.02, 0.58, 1.7, 0.4, 0.04, "gm", top="plate", bevel=0.01)
    keyboard(k, 0.0, dv + 0.04, 0.62)
    k.box(0.52, dv + 0.0, 0.62, 0.16, 0.16, 0.04, "hazY", top="hazK")
    k.cyl(0.52, dv, 0.66, 0.05, 0.04, "red", sides=12)
    k.box(0.52, dv - 0.08, 0.66, 0.16, 0.02, 0.1, "glassL")                             # its flip guard, raised
    slate(k, -0.55, dv + 0.02, 0.62, G, rz=0.12)
    k.box(0.0, dv - 0.14, 0.62, 1.2, 0.06, 0.06, "dark", rx=0.4)
    for i, w in enumerate((0.3, 0.18, 0.24)):
        k.box(-0.4 + i * 0.4, dv - 0.12, 0.65, w, 0.02, 0.02, G if i != 1 else W, rx=0.4)
    chair(k, "gm", "medRed")
    return k.build()


def test_k_holo():
    """The HUD on the shield glass: a target bracket round the prototype, a trace, two readings."""
    k = K("research_k_holo", (3, 2), 0)
    W, F = "resScan", "resScanF"
    v = CV1 + 0.04
    bu, bz = -0.15, 0.72
    for su in (-1, 1):
        for sz in (-1, 1):
            bar(k, (bu + su * 0.3, v, bz + sz * 0.3), (bu + su * 0.18, v, bz + sz * 0.3), 0.025, W)
            bar(k, (bu + su * 0.3, v, bz + sz * 0.3), (bu + su * 0.3, v, bz + sz * 0.18), 0.025, W)
    pts = [(0.35 + i * 0.07, v, 1.2 + 0.08 * math.sin(i * 1.3)) for i in range(9)]       # a trace
    for a, b in zip(pts, pts[1:]):
        bar(k, a, b, 0.02, W)
    k.box(0.63, v, 1.1, 0.66, 0.02, 0.24, F)
    for i, w in enumerate((0.3, 0.2)):
        k.box(-0.85 + w / 2, v, 1.18 - i * 0.08, w, 0.02, 0.035, W)
    k.box(-0.72, v, 1.04, 0.34, 0.02, 0.24, F)
    return k


# ---- l: the light table ---------------------------------------------------------------------------------------------

LC, LT = (0.0, -0.4, 0.82), 0.5   # the table's centre and tilt (toward the chair)


def _on_table(k, a, b, h, su, sv, sz, col, top=None, rz=0.0):
    """A box lying on the tilted table: a along u, b up the slope (toward the back), h above the surface."""
    d = (-math.cos(LT), math.sin(LT))                                                 # up the slope: (v, z)
    n = (math.sin(LT), math.cos(LT))                                                  # the surface normal: (v, z)
    hc = h + sz / 2
    v = LC[1] + b * d[0] + hc * n[0]
    z = LC[2] + b * d[1] + hc * n[1]
    k.box(LC[0] + a, v, z - sz / 2, su, sv, sz, col, top=top, rx=-LT, rz=rz)


def light_l(layer):
    k = Bench(f"research_l_{layer}")
    L, V = "resLamp", "resVio"
    # the cabinet across the back: drawer banks both sides, a recess in the middle for the table's stand
    for su in (-1, 1):
        u = su * 0.98
        body(k, u, -0.56, 0.98, 0.8, 0.66, col="lvW2", top="lvW", panel="lvW2", faces=(0, 1))
        for i in range(4):
            z = 0.1 + i * 0.13
            k.box(u, -0.155, z, 0.86, 0.02, 0.11, "lvWS")
            k.box(u - 0.2, -0.14, z + 0.04, 0.16, 0.02, 0.04, "plate")
            k.box(u + 0.2, -0.14, z + 0.035, 0.12, 0.025, 0.03, "steelD")
    k.box(0.0, -0.75, 0.0, 1.0, 0.4, 0.66, "lvW2", top="lvW", bevel=0.02)             # back of the middle bay
    k.box(0.0, -0.4, 0.0, 0.5, 0.3, 0.06, "dark")                                    # the table's stand
    k.box(0.0, -0.4, 0.06, 0.16, 0.16, 0.6, "steelD")
    # the light table: a frame, the lit glass, the specimen pinned out on it
    _on_table(k, 0.0, 0.0, -0.08, 1.26, 0.86, 0.08, "lvW2", top="lvW")
    _on_table(k, 0.0, 0.0, 0.0, 1.12, 0.72, 0.02, L)
    _on_table(k, 0.0, -0.43, -0.04, 1.2, 0.06, 0.08, "steel", top="steelL")           # a pen ledge on its lip
    _on_table(k, 0.0, 0.0, 0.02, 0.1, 0.42, 0.04, "resSpec", top="resSpec")            # body
    _on_table(k, 0.0, 0.22, 0.02, 0.12, 0.1, 0.05, "resSpec", top="resSpecL")          # head
    for su in (-1, 1):                                                                # wings, spread and pinned
        for b, w, rz in ((0.08, 0.36, 0.35), (-0.12, 0.28, -0.3)):
            _on_table(k, su * (0.06 + w / 2), b, 0.02, w, 0.14, 0.012, "resWing", top="resWing",
                      rz=su * rz)
            _on_table(k, su * (0.06 + w * 0.8), b + su * 0.0, 0.03, 0.03, 0.03, 0.04, "steelL", top="medRed")
    # the boom: a post at the back right, an arm over the table, a camera with a ring light and a magnifier
    pu, pv = 0.7, -0.88
    k.cyl(pu, pv, 0.66, 0.06, 0.9, "steelD", top="steel", sides=10)
    bar(k, (pu, pv, 1.5), (0.1, -0.5, 1.5), 0.05, "steelL")
    k.box(0.1, -0.5, 1.36, 0.14, 0.14, 0.14, "gm", top="steelL", bevel=0.02)
    k.cyl(0.1, -0.5, 1.32, 0.11, 0.04, "steelD", sides=16)
    k.cyl(0.1, -0.5, 1.315, 0.08, 0.012, L, sides=16)
    # on the cabinet: jars of preserved finds (left), a tool tray and notes (right)
    for i, (u, v) in enumerate(((-1.25, -0.72), (-1.0, -0.74), (-0.75, -0.72), (-1.12, -0.48), (-0.86, -0.48))):
        k.cyl(u, v, 0.66, 0.09, 0.03, "gm", sides=12)
        k.part("glass").cyl(u, v, 0.69, 0.085, 0.22, "glassL", top="glassL", sides=12)
        k.part("fluid").cyl(u, v, 0.7, 0.075, 0.16, "resFluid", sides=12)
        k.cyl(u, v, 0.74, 0.04, 0.08, ("resSpec", "resFrond", "resSpecL", "resSpec", "resFrond")[i], sides=8)
        k.cyl(u, v, 0.91, 0.09, 0.04, "lvWS", top="lvW", sides=12)
    k.box(1.0, -0.5, 0.66, 0.5, 0.26, 0.04, "steelD", top="dark")
    for i, (w, col) in enumerate(((0.36, "steelL"), (0.3, "steelL"), (0.26, "hivis"))):
        k.box(1.0, -0.58 + i * 0.08, 0.7, w, 0.025, 0.02, col, rz=0.08 * (i - 1))
    slate(k, 1.05, -0.78, 0.66, V, rz=-0.1)
    chair(k, "lvW2", "pcb")
    return k.build()


def light_l_holo():
    """Two labels on the specimen: a ring on the part, a short leader up to a small pane just above the table."""
    k = K("research_l_holo", (3, 2), 0)
    V, F = "resVio", "resVioF"
    cu, cv, cz = LC
    for a, b, pu in ((0.0, 0.22, -0.36), (0.34, 0.08, 0.5)):
        v = cv - b * math.cos(LT) + 0.03
        z = cz + b * math.sin(LT) + 0.04
        ring(k, "z", cu + a, v, z, 0.07, 12, 0.02, 0.02, V)
        bar(k, (cu + a, v, z), (pu, v, z + 0.3), 0.015, V)
        _pane(k, pu + (-0.14 if pu < 0 else 0.14), v, z + 0.28, 0.28, 0.12, 0.0, V, F, ((0, 1, 0.16), (0, 0.0, 0.1)))
    return k


BUILD = {"j": (tank_j, tank_j_holo), "k": (test_k, test_k_holo), "l": (light_l, light_l_holo)}
