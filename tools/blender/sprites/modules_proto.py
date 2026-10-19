"""Module prototypes (draft): hypersleep chamber (2x1), ore refinery (2x3), hydroponics bed (1x2) and bay (2x3).

Grid frame, origin = centre of the front-most footprint tile at floor level (as props.py). Each module is modelled in
a local frame centred on its footprint at rotation 0: a along x, b along y, the access side +b. Rotation r turns the
whole module clockwise on screen like the sim (r1: access side -x, r2: -y, r3: +x); odd rotations swap the footprint.
Glow only where something lights up: the sleeper's status strip, the smelter mouth, the grow lights."""
import math

from . import core


class Mod:
    def __init__(self, name, fp, rot):
        self.m = core.Mesh(name)
        w, h = fp if rot % 2 == 0 else (fp[1], fp[0])
        self.c = (-(w - 1) / 2, -(h - 1) / 2)
        self.th = rot * math.pi / 2

    def P(self, a, b):
        c, s = math.cos(self.th), math.sin(self.th)
        return self.c[0] + a * c - b * s, self.c[1] + a * s + b * c

    def box(self, a, b, z, size, col, top=None, rz=0.0, rx=0.0, ry=0.0, bevel=0.0, base=True, taper=1.0):
        self.m.box((*self.P(a, b), z), size, col, top=top, rz=rz + self.th, rx=rx, ry=ry, bevel=bevel, base=base,
                   taper=taper)

    def cyl(self, a, b, z, r, h, col, sides=8, top=None, rtop=None, rz=0.0):
        self.m.cyl((*self.P(a, b), z), r, h, col, sides=sides, top=top, rtop=rtop, rz=rz + self.th)

    def build(self):
        return [self.m.build()]


# ---- hypersleep chamber: a white pod on a pedestal, glass canopy (a rim and glints), a head-end control unit ---------

def hypersleep(rot, occupied):
    M = Mod(f"hypersleep_{rot}_{int(occupied)}", (2, 1), rot)
    for a in (-0.5, 0.45):
        M.box(a, 0, 0, (0.3, 0.46, 0.2), "gmD", top="gm", bevel=0.02)                        # feet
    M.box(-0.02, 0, 0.12, (1.3, 0.28, 0.12), "steelD", top="steel")                          # spine
    M.box(0.08, 0, 0.2, (1.62, 0.74, 0.3), "medWhite", top="medWhite", bevel=0.07)           # lower shell
    M.box(0.08, 0.372, 0.28, (1.3, 0.012, 0.05), "navy")                                     # side stripe
    M.box(0.08, 0, 0.46, (1.44, 0.58, 0.04), "navy", top="navy")                             # bed liner
    if occupied:
        M.box(0.3, 0, 0.5, (0.9, 0.34, 0.14), "steelL", top="medWhite", bevel=0.05)          # sleeper under a sheet
        M.box(-0.22, 0, 0.5, (0.12, 0.4, 0.12), "steelL", top="medWhite", bevel=0.04)        # shoulders
        M.cyl(-0.4, 0, 0.5, 0.1, 0.13, "skinD", sides=8, top="skin")                          # head
        M.cyl(-0.4, 0, 0.63, 0.1, 0.02, "hair", sides=8)
        for a in (-0.56, 0.7):
            M.box(a, 0, 0.5, (0.16, 0.5, 0.02), "iceB")                                      # frost at the ends
    for (a, b, sa, sb) in ((0.08, 0.3, 1.5, 0.05), (0.08, -0.3, 1.5, 0.05), (0.81, 0, 0.05, 0.64), (-0.65, 0, 0.05, 0.64)):
        M.box(a, b, 0.5, (sa, sb, 0.3), "medWhite", top="steelL", bevel=0.015)               # canopy rim
    for a, w in ((-0.2, 0.08), (0.0, 0.04), (0.45, 0.08)):
        M.box(a, 0, 0.79, (w, 0.56, 0.012), "glassL", rz=0.6)                                # glass glints
    M.box(0.08, -0.3, 0.8, (1.42, 0.05, 0.03), "steelL")                                     # canopy hinge rail
    M.box(-0.86, 0, 0, (0.26, 0.66, 0.92), "steel", top="steelL", bevel=0.02)                # head-end unit
    M.box(-0.86, 0.335, 0.5, (0.16, 0.012, 0.22), "dark")                                    # its display
    M.box(-0.86, 0.342, 0.6, (0.1, 0.012, 0.04), "cyan" if occupied else "steelD")
    M.box(-0.86, 0.342, 0.53, (0.1, 0.012, 0.025), "cyan" if occupied else "steelD")
    M.box(-0.86, 0.342, 0.4, (0.05, 0.012, 0.04), "cyan" if occupied else "orange")          # status
    for b in (-0.18, 0.18):
        M.cyl(-0.7, b, 0.0, 0.04, 0.42, "gm", sides=6, top="steelL")                         # coolant lines
    return M.build()


# ---- ore refinery: hopper and smelter at the back, a conveyor to the front, an ingot rack, a control post ---------

def refinery(rot, active):
    M = Mod(f"refinery_{rot}_{int(active)}", (2, 3), rot)
    M.box(0.0, -0.95, 0, (1.8, 1.05, 1.0), "steel", top="steelL", bevel=0.03)                # smelter body
    for a in (-0.7, 0.1, 0.7):
        M.box(a, -0.415, 0.12, (0.08, 0.03, 0.78), "gm", top="steelL")                       # ribs
    M.box(0.4, -0.41, 0.5, (0.4, 0.02, 0.28), "steelD")                                      # access hatch
    M.box(0.4, -0.4, 0.62, (0.1, 0.02, 0.04), "hazY")
    for k in range(9):
        M.box(-0.8 + k * 0.2, -0.41, 0.0, (0.1, 0.02, 0.12), "hazY" if k % 2 == 0 else "hazK")
    M.box(0.0, -0.42, 0.86, (1.7, 0.03, 0.06), "gmD")                                        # top band
    M.box(-0.3, -0.42, 0.24, (0.56, 0.03, 0.36), "gmD")                                      # smelter mouth frame
    M.box(-0.3, -0.405, 0.28, (0.44, 0.02, 0.26), "orange" if active else "dark")            # mouth
    if active:
        M.box(-0.3, -0.39, 0.3, (0.3, 0.02, 0.08), "flameY")
    M.cyl(-0.45, -1.0, 1.0, 0.3, 0.42, "steelL", sides=4, rtop=0.46, rz=math.pi / 4, top="rustD")  # hopper
    for (a, b) in ((-0.5, -1.05), (-0.38, -0.92), (-0.55, -0.88)):
        M.box(a, b, 1.36, (0.14, 0.14, 0.1), "rust", top="rust", rz=a * 3)                  # ore heaped in it
    M.cyl(0.55, -1.15, 1.0, 0.15, 0.66, "gm", sides=8, top="dark")                           # exhaust stack
    M.cyl(0.55, -1.15, 1.5, 0.18, 0.06, "gmD", sides=8, top="gm")
    M.box(0.55, -0.62, 1.0, (0.5, 0.3, 0.14), "gm", top="plate", bevel=0.02)                 # heat exchanger
    for b in (-0.3, 0.2, 0.75, 1.25):                                                        # conveyor legs
        M.box(-0.3, b, 0, (0.46, 0.06, 0.3), "gmD")
    M.box(-0.3, 0.45, 0.3, (0.5, 1.75, 0.1), "gm", top="dark")                              # conveyor bed and belt
    for b in (-0.4, 1.3):
        M.cyl(-0.3, b, 0.3, 0.07, 0.1, "steelL", sides=8, top="gm")                         # end rollers
    for k in range(4):
        M.box(-0.04, -0.2 + k * 0.45, 0.4, (0.02, 0.2, 0.05), "hazY")                        # belt edge marks
    if active:
        for (b, col) in ((0.0, "rust"), (0.35, "steelL"), (0.8, "rust"), (1.15, "rustD")):
            M.box(-0.3 + 0.05 * math.sin(b * 9), b, 0.4, (0.12, 0.12, 0.08), col, rz=b * 4)
    M.box(0.5, 0.6, 0, (0.6, 0.7, 0.32), "steel", top="steelL", bevel=0.02)                  # ingot rack
    for k in range(3 if active else 1):
        for j in range(2):
            M.box(0.36 + j * 0.28, 0.4 + k * 0.2, 0.32, (0.22, 0.12, 0.07), "brass", bevel=0.01)
    M.box(0.75, 1.3, 0, (0.16, 0.16, 0.7), "gmD", top="gm")                                  # control post
    M.box(0.75, 1.3, 0.7, (0.3, 0.2, 0.2), "steelD", top="steel", rx=-0.4, bevel=0.01)
    M.box(0.75, 1.37, 0.78, (0.22, 0.02, 0.1), "cyan" if active else "dark", rx=-0.4)
    return M.build()


# ---- hydroponics: soil troughs with leafy plants under magenta grow lights ----------------------------------------

def _plant(M, a, b, z, s, ripe, k):
    M.cyl(a, b, z, 0.11 * s, 0.1 * s, "lfD", sides=6, rtop=0.13 * s, rz=k)
    M.cyl(a, b, z + 0.1 * s, 0.13 * s, 0.09 * s, "lfM", sides=6, rtop=0.07 * s, rz=k + 0.5)
    M.cyl(a, b, z + 0.19 * s, 0.07 * s, 0.05 * s, "lfL", sides=6, rtop=0.02 * s, rz=k)
    if ripe:
        M.box(a + 0.08 * s, b + 0.06 * s, z + 0.08 * s, (0.06, 0.06, 0.06), "medRed", bevel=0.01)


def _trough(M, a, b, la, lb):
    M.box(a, b, 0, (la, lb, 0.34), "steel", top="steelL", bevel=0.02)
    M.box(a, b, 0.34, (la - 0.1, lb - 0.1, 0.005), "soil")
    M.box(a, b + lb / 2 + 0.002, 0.16, (la - 0.12, 0.012, 0.04), "navy")                    # drip line


def _lamp(M, a, b, la, lb, z):
    """Two slim grow-light bars on a cross frame (the bars' sides glow)."""
    for da in (-la / 2 + 0.05, la / 2 - 0.05):
        M.box(a + da, b, z, (0.06, lb, 0.05), "magenta", top="gmD")
        M.box(a + da, b, z + 0.05, (0.09, lb + 0.02, 0.03), "gmD", top="gm")
    for db in (-lb / 2 + 0.06, lb / 2 - 0.06):
        M.box(a, b + db, z + 0.05, (la, 0.05, 0.03), "gm")


def hydro_bed(rot, ripe):
    M = Mod(f"hydro_bed_{rot}_{int(ripe)}", (1, 2), rot)
    _trough(M, 0, 0, 0.82, 1.84)
    for i in range(4):
        for j, a in enumerate((-0.17, 0.17)):
            _plant(M, a, -0.66 + i * 0.44, 0.34, (1.15 if ripe else 0.8) + 0.12 * ((i + j) % 2), ripe and (i + j) % 2 == 0,
                   i + j)
    for b in (-0.86, 0.86):
        M.box(-0.36, b, 0, (0.06, 0.06, 1.25), "gm", top="steelL")                            # lamp posts
    _lamp(M, 0.0, 0, 0.5, 1.7, 1.2)
    for b in (-0.86, 0.86):
        M.box(-0.2, b, 1.22, (0.34, 0.06, 0.05), "gm")                                       # arms to the lamp
    return M.build()


def hydro_bay(rot, ripe):
    M = Mod(f"hydro_bay_{rot}_{int(ripe)}", (2, 3), rot)
    for a in (-0.5, 0.5):
        _trough(M, a, 0.22, 0.8, 2.4)
        for i in range(5):
            for j, da in enumerate((-0.17, 0.17)):
                _plant(M, a + da, -0.78 + i * 0.5, 0.34, (1.25 if ripe else 0.85) + 0.15 * ((i + j) % 2),
                       ripe and (i + j) % 2 == 1, i * 2 + j)
    M.cyl(-0.5, -1.22, 0, 0.26, 1.0, "navy", sides=8, top="steelL")                          # water tank
    M.box(-0.5, -0.97, 0.3, (0.08, 0.02, 0.5), "lens")                                        # level window
    M.box(0.45, -1.22, 0, (0.5, 0.42, 0.5), "steelD", top="steel", bevel=0.02)                # pump
    M.cyl(0.45, -1.22, 0.5, 0.1, 0.12, "gm", sides=8, top="steelL")
    M.box(0.0, -1.02, 0.12, (1.1, 0.06, 0.06), "gm")                                          # feed pipe
    for (a, b) in ((-0.98, -1.0), (0.98, -1.0), (-0.98, 1.42), (0.98, 1.42)):
        M.box(a, b, 0, (0.06, 0.06, 1.5), "gm", top="steelL")                                 # gantry posts
    for a in (-0.98, 0.98):
        M.box(a, 0.21, 1.46, (0.06, 2.48, 0.06), "gm", top="steelL")                          # gantry rails
    for a in (-0.5, 0.5):
        _lamp(M, a, 0.21, 0.42, 2.2, 1.38)
    return M.build()


SPRITES = []
for _r in range(4):
    for _stem, _fp, _fn, _st in (("hypersleep", (2, 1), hypersleep, "occupied"), ("refinery", (2, 3), refinery, "active"),
                                 ("hydro_bed", (1, 2), hydro_bed, "ripe"), ("hydro_bay", (2, 3), hydro_bay, "ripe")):
        fp = _fp if _r % 2 == 0 else (_fp[1], _fp[0])
        SPRITES.append((f"module.{_stem}.r{_r}", fp, "prop", lambda f=_fn, r=_r: f(r, False)))
        SPRITES.append((f"module.{_stem}.r{_r}.{_st}", fp, "prop", lambda f=_fn, r=_r: f(r, True)))
