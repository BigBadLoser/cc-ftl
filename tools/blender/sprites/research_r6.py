"""Research bench look studies, round 6: three variants of the light table (round 5's l). Each keeps the lab cabinet
across the back with a backlit table tilted toward the chair in the middle; the subject, the side units and the
hologram change.

  l1  entomologist: drawer banks both sides, a winged specimen pinned out (symmetric: body, wings, legs, pins), the
      camera boom, jars and a tool tray on the cabinet. Hologram: two labels on short leaders
  l2  archivist: a broken stone tablet with lit glyphs on the table, a shelf hutch over the cabinet (jars, specimen
      boxes, stacked slates), a magnifier lamp. Hologram: the tablet's missing part rebuilt as a ghost
  l3  dissection: a creature opened out on a flatter tray, a tall glass-door specimen fridge on the left, a microscope
      on the right, a camera hood over the tray. Hologram: an anatomy layer over the creature"""
import math

from .modkit import K
from .research_kit import Bench, bar, body, chair, ring
from .research_r3 import _pane
from .research_r4 import lamp, slate


class Table:
    """The tilted light table: centre (u, v, z), tilt toward the chair. put() lays a box on it: a along u, b up the
    slope (toward the back), h above the surface."""

    def __init__(self, k, c, tilt):
        self.k, self.c, self.t = k, c, tilt

    def at(self, a, b, h):
        d, n = (-math.cos(self.t), math.sin(self.t)), (math.sin(self.t), math.cos(self.t))
        return self.c[0] + a, self.c[1] + b * d[0] + h * n[0], self.c[2] + b * d[1] + h * n[1]

    def put(self, a, b, h, su, sv, sz, col, top=None, rz=0.0, bevel=0.0):
        u, v, z = self.at(a, b, h + sz / 2)
        self.k.box(u, v, z - sz / 2, su, sv, sz, col, top=top, rx=-self.t, rz=rz, bevel=bevel)

    def build(self, w=1.26, d=0.86, light="resLamp"):
        """The frame, the lit glass, a pen ledge along its lip, the stand under it."""
        k, (u, v, z) = self.k, self.c
        k.box(u, v, 0.0, 0.5, 0.3, 0.06, "dark")
        k.box(u, v, 0.06, 0.16, 0.16, z - 0.16, "steelD")
        self.put(0.0, 0.0, -0.08, w, d, 0.08, "lvW2", top="lvW")
        self.put(0.0, 0.0, 0.0, w - 0.14, d - 0.14, 0.02, light)
        self.put(0.0, -d / 2 + 0.03, -0.04, w - 0.06, 0.06, 0.08, "lvW2", top="lvW")


def drawers(k, u, n=4, top=0.66, skip=()):
    """A drawer bank: the cabinet section, n drawers with label plates and pulls on its front (none for the drawers in
    skip, numbered from the bottom: they are drawn open elsewhere)."""
    body(k, u, -0.56, 0.98, 0.8, top, col="lvW2", top="lvW", panel="lvW2", faces=(0, 1), lip="lvW2")
    for i in range(n):
        if i in skip:
            continue
        z = 0.1 + i * (top - 0.14) / n
        h = (top - 0.14) / n - 0.02
        k.box(u, -0.155, z, 0.86, 0.02, h, "lvWS")
        k.box(u - 0.2, -0.14, z + h * 0.35, 0.16, 0.02, 0.04, "plate")
        k.box(u + 0.2, -0.14, z + h * 0.3, 0.12, 0.025, 0.03, "steelD")


def jar(k, u, v, z, inner, r=0.085, h=0.22):
    """A specimen jar: a dark base, glass, fluid, the thing in it, a cream lid."""
    k.cyl(u, v, z, r + 0.005, 0.03, "gm", sides=12)
    k.part("glass").cyl(u, v, z + 0.03, r, h, "glassL", top="glassL", sides=12)
    k.part("fluid").cyl(u, v, z + 0.04, r - 0.01, h - 0.06, "resFluid", sides=12)
    k.cyl(u, v, z + 0.08, r * 0.45, h * 0.4, inner, sides=8)
    k.cyl(u, v, z + h + 0.03, r + 0.005, 0.04, "lvWS", top="lvW", sides=12)


def tool_tray(k, u, v, z):
    k.box(u, v, z, 0.5, 0.26, 0.04, "steelD", top="dark")
    for i, (w, col) in enumerate(((0.36, "steelL"), (0.3, "steelL"), (0.26, "hivis"))):
        k.box(u, v - 0.08 + i * 0.08, z + 0.04, w, 0.025, 0.02, col, rz=0.08 * (i - 1))


def middle_bay(k):
    k.box(0.0, -0.75, 0.0, 0.94, 0.4, 0.655, "lvW2", top="lvW", bevel=0.02)


# ---- l1: the entomologist -------------------------------------------------------------------------------------------

T1 = ((0.0, -0.4, 0.82), 0.5)


def _insect(T):
    """A winged specimen pinned out, symmetric about a = 0: abdomen, thorax, head, two pairs of wings, six legs, pins."""
    T.put(0.0, -0.1, 0.02, 0.11, 0.26, 0.05, "resSpec", top="resSpecL", bevel=0.02)       # abdomen
    T.put(0.0, 0.08, 0.02, 0.13, 0.12, 0.06, "resSpec", top="resSpec", bevel=0.02)        # thorax
    T.put(0.0, 0.18, 0.02, 0.09, 0.08, 0.05, "resSpec", top="resSpecL", bevel=0.02)       # head
    for s in (-1, 1):
        T.put(s * 0.2, 0.14, 0.03, 0.3, 0.14, 0.012, "resWingL", top="resWingL", rz=s * 0.3)  # fore wings,
        T.put(s * 0.2, 0.14, 0.042, 0.26, 0.025, 0.008, "resSpec", rz=s * 0.3)                # a vein each
        T.put(s * 0.17, -0.02, 0.03, 0.24, 0.12, 0.012, "resWingL", top="resWingL", rz=-s * 0.35)
        T.put(s * 0.17, -0.02, 0.042, 0.2, 0.025, 0.008, "resSpec", rz=-s * 0.35)
        T.put(s * 0.32, 0.2, 0.05, 0.035, 0.035, 0.05, "steelL", top="medRed")               # pins at the tips
        T.put(s * 0.27, -0.08, 0.05, 0.035, 0.035, 0.05, "steelL", top="medRed")
        for j, (bb, rz) in enumerate(((0.12, 0.6), (0.06, 0.0), (0.0, -0.6))):
            T.put(s * 0.1, bb - 0.02, 0.02, 0.12, 0.02, 0.02, "resSpec", rz=s * rz)          # legs
        T.put(s * 0.035, 0.26, 0.02, 0.02, 0.1, 0.02, "resSpec", rz=s * 0.4)                # antennae


def l1(layer):
    k = Bench(f"research_l1_{layer}")
    V = "resVio"
    drawers(k, -0.98)
    drawers(k, 0.98)
    middle_bay(k)
    T = Table(k, *T1)
    T.build()
    _insect(T)
    pu, pv = 0.7, -0.88                                                              # the camera boom
    k.cyl(pu, pv, 0.66, 0.06, 0.9, "steelD", top="steel", sides=10)
    bar(k, (pu, pv, 1.5), (0.1, -0.5, 1.5), 0.05, "steelL")
    k.box(0.1, -0.5, 1.36, 0.14, 0.14, 0.14, "gm", top="steelL", bevel=0.02)
    k.cyl(0.1, -0.5, 1.32, 0.11, 0.04, "steelD", sides=16)
    k.cyl(0.1, -0.5, 1.315, 0.08, 0.012, "resLamp", sides=16)
    for i, (u, v) in enumerate(((-1.22, -0.72), (-0.96, -0.74), (-0.74, -0.7), (-1.1, -0.46))):
        jar(k, u, v, 0.66, ("resSpec", "resFrond", "resSpecL", "resWing")[i])
    tool_tray(k, 1.0, -0.48, 0.66)
    slate(k, 1.05, -0.78, 0.66, V, rz=-0.1)
    chair(k, "lvW2", "pcb")
    return k.build()


def l1_holo():
    k = K("research_l1_holo", (3, 2), 0)
    V, F = "resVio", "resVioF"
    T = Table(k, *T1)
    for a, b, pu in ((0.0, 0.18, -0.42), (0.27, 0.14, 0.56)):
        u, v, z = T.at(a, b, 0.06)
        k.box(u, v, z - 0.02, 0.04, 0.04, 0.04, V)
        bar(k, (u, v, z), (u, v, z + 0.34), 0.015, V)
        bar(k, (u, v, z + 0.34), (pu, v, z + 0.34), 0.015, V)
        _pane(k, pu + (-0.13 if pu < 0 else 0.13), v, z + 0.28, 0.26, 0.12, 0.0, V, F,
              ((0, 1, 0.16), (0, 0.0, 0.1)))
    return k


# ---- l2: the archivist ----------------------------------------------------------------------------------------------

T2 = ((0.0, -0.3, 0.82), 0.45)


def _tablet(T, glow):
    """A broken stone tablet: the surviving part (its right edge jagged), lit glyph rows across it."""
    T.put(-0.12, 0.0, 0.02, 0.5, 0.5, 0.06, "resRelic", top="resRelicL", bevel=0.02)
    T.put(0.16, 0.12, 0.02, 0.14, 0.24, 0.06, "resRelic", top="resRelicL", rz=0.2, bevel=0.02)
    T.put(0.16, -0.14, 0.02, 0.12, 0.16, 0.06, "resRelicD", top="resRelic", rz=-0.3, bevel=0.02)
    for i in range(4):                                                                # glyph rows, in marks
        for j, w in enumerate((0.08, 0.05, 0.1, 0.06)[: 4 - i % 2]):
            T.put(-0.3 + j * 0.11 + w / 2 + 0.02 * (i % 2), 0.17 - i * 0.1, 0.08, w, 0.03, 0.01,
                  glow if (i + j) % 3 else "resGoldF")


def l2(layer, finish=True, name="l2", right=True, open_top=False):
    """The archivist's bench; finish=False returns the builder unbuilt (round 7 adds to it); right=False leaves the
    lamp and slate off the right cabinet, open_top=True leaves the right bank's top drawer front for an open one."""
    k = Bench(f"research_{name}_{layer}")
    G = "resGold"
    drawers(k, -0.98, n=3)
    drawers(k, 0.98, n=3, skip=(2,) if open_top else ())
    middle_bay(k)
    # the hutch: three uprights, two shelves along the back over the cabinet
    for u in (-1.44, -0.52, 0.52, 1.44):
        k.box(u, -0.86, 0.66, 0.06, 0.24, 1.0, "lvW2", top="lvW")
    for z in (1.1, 1.46):
        for su in (-1, 1):
            k.box(su * 0.98, -0.86, z, 0.92, 0.26, 0.04, "lvW2", top="lvW")
    k.box(0.0, -0.86, 1.46, 1.04, 0.26, 0.04, "lvW2", top="lvW")
    k.box(0.0, -0.96, 0.66, 2.9, 0.04, 0.84, "lvWS")                                    # its back panel
    # on the shelves: jars (left), labelled specimen boxes (right), slates stacked flat (top middle)
    for i, u in enumerate((-1.26, -1.04, -0.82)):
        jar(k, u, -0.86, 1.14, ("resSpec", "resFrond", "resSpecL")[i], r=0.07, h=0.18)
    for i, u in enumerate((0.74, 0.98, 1.22)):
        k.box(u, -0.86, 1.14, 0.2, 0.2, 0.14, "ochM", top="ochL", bevel=0.01)
        k.box(u, -0.755, 1.18, 0.1, 0.012, 0.05, "lvW")
    for i in range(4):
        k.box(0.0 + 0.01 * i, -0.86, 1.5 + i * 0.03, 0.4, 0.2, 0.025, "gm" if i % 2 else "dark", top="steelD")
    for i, u in enumerate((-1.1, 1.1)):
        jar(k, u, -0.86, 1.5, ("resRelicL", "resSpec")[i], r=0.06, h=0.16)
    T = Table(k, *T2)
    T.build()
    _tablet(T, G)
    if right:
        lamp(k, 0.82, -0.36, 0.66, "resLamp")
    # on the cabinet: a brush and picks (left), notes and a rubbing (right)
    k.box(-1.0, -0.46, 0.66, 0.5, 0.24, 0.03, "steelD", top="dark")
    for i, (w, col) in enumerate(((0.3, "ochM"), (0.26, "steelL"), (0.22, "steelL"))):
        k.box(-1.0, -0.54 + i * 0.08, 0.69, w, 0.025, 0.02, col)
    if right:
        slate(k, 1.12, -0.48, 0.66, G, rz=-0.12)
    chair(k, "lvW2", "rust")
    return k.build() if finish else k


def l2_holo():
    """The missing part of the tablet, rebuilt: a film slab off its broken edge with bright outline and glyph rows."""
    k = K("research_l2_holo", (3, 2), 0)
    G, F = "resGold", "resGoldF"
    T = Table(k, *T2)
    T.put(0.3, 0.0, 0.03, 0.34, 0.5, 0.05, F)
    for b in (-0.25, 0.25):
        T.put(0.3, b, 0.09, 0.34, 0.02, 0.02, G)
    T.put(0.47, 0.0, 0.09, 0.02, 0.52, 0.02, G)
    for i in range(4):
        for j, w in enumerate((0.07, 0.1)):
            T.put(0.2 + j * 0.13 + w / 2, 0.17 - i * 0.1, 0.09, w, 0.025, 0.012, G)
    return k


# ---- l3: dissection -------------------------------------------------------------------------------------------------

T3 = ((0.12, -0.42, 0.72), 0.25)


def _creature(T):
    """A creature opened out on the tray: an oval body, its flaps pinned back, tentacles splayed, the organs inside."""
    T.put(0.0, 0.0, 0.02, 0.3, 0.42, 0.07, "resSpec", top="resSpecL", bevel=0.04)
    for s in (-1, 1):
        T.put(s * 0.22, 0.02, 0.02, 0.16, 0.3, 0.02, "resSpecL", top="resSpecL", rz=s * 0.15)   # flaps
        T.put(s * 0.3, 0.12, 0.03, 0.03, 0.03, 0.05, "steelL", top="medRed")
        T.put(s * 0.3, -0.08, 0.03, 0.03, 0.03, 0.05, "steelL", top="medRed")
        for j, rz in enumerate((0.5, 0.2)):
            T.put(s * (0.1 + j * 0.06), -0.3, 0.02, 0.04, 0.22, 0.03, "resSpec", rz=s * rz)    # tentacles
    T.put(0.0, 0.06, 0.09, 0.1, 0.1, 0.03, "medRed")                                      # organs
    T.put(-0.03, -0.08, 0.09, 0.08, 0.08, 0.03, "resBio")
    T.put(0.04, -0.06, 0.09, 0.05, 0.05, 0.03, "hivis")


def l3(layer):
    k = Bench(f"research_l3_{layer}")
    B = "resBio"
    # the fridge on the left: a tall cabinet with a glass door, lit inside, jars on three shelves
    fu = -1.02
    k.box(fu, -0.56, 0.0, 0.84, 0.76, 0.06, "dark")
    fv0, fv1, fz0, fz1 = -0.96, -0.16, 0.06, 1.44                                     # a hollow shell:
    k.box(fu, fv0 + 0.03, fz0, 0.88, 0.06, fz1 - fz0, "lvW2", top="lvW")               # back,
    for su in (-1, 1):                                                                # sides,
        k.box(fu + su * 0.41, (fv0 + fv1) / 2, fz0, 0.06, fv1 - fv0, fz1 - fz0, "lvW2", top="lvW")
    k.box(fu, (fv0 + fv1) / 2, fz1 - 0.12, 0.88, fv1 - fv0, 0.12, "lvW2", top="lvW", bevel=0.02)   # top,
    k.box(fu, (fv0 + fv1) / 2, fz0, 0.88, fv1 - fv0, 0.08, "lvW2", top="lvW")             # floor
    k.box(fu, fv0 + 0.065, fz0 + 0.08, 0.76, 0.02, fz1 - fz0 - 0.2, "lvW")                 # lit back wall
    k.box(fu, -0.5, fz1 - 0.14, 0.7, 0.4, 0.02, "resLamp")                                 # light in the roof
    k.box(fu, -0.14, 1.36, 0.6, 0.02, 0.04, B)
    for z in (0.16, 0.56, 0.96):
        k.box(fu, -0.56, z, 0.76, 0.7, 0.03, "steelL", top="steelL")
        for j, du in enumerate((-0.2, 0.02, 0.22)):
            k.cyl(fu + du, -0.4, z + 0.03, 0.065, 0.24, "resFluid", sides=10)
            k.cyl(fu + du, -0.4, z + 0.08, 0.03, 0.1, ("resSpec", "resFrond", "resSpecL")[(j + int(z * 3)) % 3],
                  sides=8)
            k.cyl(fu + du, -0.4, z + 0.27, 0.068, 0.04, "lvWS", sides=10)
    k.part("glass").box(fu, -0.15, 0.14, 0.8, 0.02, 1.18, "glassL")
    for z in (0.08, 1.32):
        k.box(fu, -0.14, z, 0.88, 0.04, 0.06, "lvW2", top="lvW")                           # the door's frame
    k.box(fu + 0.36, -0.13, 0.5, 0.04, 0.04, 0.5, "steelL")                              # its handle
    # the middle and right: a counter, the tray on its stand, a microscope and tools at the right
    k.box(0.3, -0.75, 0.0, 1.0, 0.4, 0.66, "lvW2", top="lvW", bevel=0.02)
    drawers(k, 1.06, n=4)
    T = Table(k, *T3)
    T.build(w=1.0, d=0.8)
    _creature(T)
    k.box(0.12, -0.9, 0.66, 0.06, 0.06, 0.8, "steelD")                                  # camera hood on a mast
    bar(k, (0.12, -0.9, 1.46), (0.12, -0.5, 1.46), 0.05, "steelL")
    k.box(0.12, -0.46, 1.3, 0.36, 0.3, 0.12, "lvW2", top="lvW", bevel=0.03)
    k.box(0.12, -0.46, 1.29, 0.28, 0.22, 0.012, "resLamp")
    mu, mv = 1.1, -0.62                                                              # microscope
    k.box(mu, mv, 0.66, 0.3, 0.24, 0.05, "lvW2", top="lvW", bevel=0.01)
    k.box(mu, mv - 0.08, 0.71, 0.08, 0.08, 0.4, "lvW2", top="lvW")
    k.box(mu, mv + 0.03, 0.84, 0.22, 0.18, 0.04, "dark")
    k.box(mu, mv - 0.02, 1.04, 0.12, 0.24, 0.1, "lvW2", top="lvW", rx=-0.4, bevel=0.01)
    k.box(mu, mv + 0.1, 1.12, 0.06, 0.1, 0.06, "dark", rx=-0.6)
    tool_tray(k, 1.0, -0.3, 0.66)
    slate(k, 0.7, -0.62, 0.66, B, rz=0.15)
    chair(k, "lvW2", "pcb")
    return k.build()


def l3_holo():
    """An anatomy layer over the creature: organ outlines lifted off it on thin stems, a scan line across."""
    k = K("research_l3_holo", (3, 2), 0)
    B, F = "resBio", "resBioF"
    T = Table(k, *T3)
    for a, b, r in ((0.0, 0.06, 0.08), (-0.03, -0.08, 0.06), (0.04, -0.06, 0.04)):
        u, v, z = T.at(a, b, 0.12)
        ring(k, "z", u, v, z + 0.2, r, 14, 0.02, 0.02, B)
        bar(k, (u, v, z), (u, v, z + 0.18), 0.012, B)
    u, v, z = T.at(0.0, 0.0, 0.14)
    k.box(u, v, z, 0.46, 0.02, 0.02, B)
    return k


BUILD = {"l1": (l1, l1_holo), "l2": (l2, l2_holo), "l3": (l3, l3_holo)}
