"""Wall props (family `wallprops`): pieces mounted on a straight wall run's camera-facing face, drawn on the wall tile
after the wall, as the derelict wall decals (derelict_walls.face_plane: x = the run along x, face toward +y; y = the run
along y, face toward +x). Walls up only. Grid frame, origin = the wall tile centre at floor level.

  wallprop.<name>.<wall|hull>.<x|y>
    pipes, pipe.hot    two pipes along the run (.hot: one with an orange heat band); they run edge to edge, so
                       neighbouring tiles join
    tray               a cable tray along the run near the top, bundled cables in it; joins like the pipes
    conduit            a vertical conduit from the skirt to the top with a junction box
    vent, grille       a louvred vent chest high; a floor grille low on the face
    panel, panel.open  an access panel (bolts, a hazard corner); open: the cover hinged out, wiring inside
    sign.hazard, sign.exit, sign.deck
    terminal, terminal.active   a wall terminal: screen and keypad (.active: the screen lit)"""
from . import core
from . import walls as W
from .derelict_walls import face_plane


class _Face:
    """Builds on a run's face: s along the run (screen left to right), d out of the face, z up."""

    def __init__(self, name, ax, fam):
        self.m, self.ax = core.Mesh(name), ax
        self.yf, _ = face_plane(fam)
        self.zs = W.skirt_top()

    def box(self, s, d, z, ss, sd, sz, col, top=None, bevel=0.0, tilt=0.0):
        """Box centred at (s, face + d, z): ss along the run, sd out of the face, sz up; tilt leans its top out."""
        c = (s, self.yf + d, z) if self.ax == "x" else (self.yf + d, -s, z)
        size = (ss, sd, sz) if self.ax == "x" else (sd, ss, sz)
        rx, ry = (tilt, 0.0) if self.ax == "x" else (0.0, -tilt)
        self.m.box(c, size, col, top=top, bevel=bevel, rx=rx, ry=ry)

    def pipe(self, z, r, d, col, s0=-0.5, s1=0.5):
        self.box((s0 + s1) / 2, d, z, s1 - s0, 2 * r, 2 * r, col, bevel=r * 0.7)

    def build(self):
        return [self.m.build()]


def pipes(f, hot):
    for s in (-0.3, 0.3):                                                             # brackets
        f.box(s, 0.03, 1.32, 0.05, 0.06, 0.26, "gmD")
    f.pipe(1.4, 0.05, 0.08, "steel")
    f.pipe(1.25, 0.04, 0.07, "steelL")
    for s in (-0.3, 0.3):
        f.box(s, 0.09, 1.4, 0.04, 0.11, 0.12, "steelD")                                # clamps
        f.box(s, 0.075, 1.25, 0.04, 0.09, 0.1, "steelD")
    if hot:
        f.box(0.0, 0.08, 1.4, 0.16, 0.105, 0.105, "orange", bevel=0.035)              # heat band (warning glow)
        f.box(0.1, 0.08, 1.4, 0.03, 0.106, 0.106, "hazK", bevel=0.03)
    else:
        f.box(-0.05, 0.075, 1.25, 0.12, 0.085, 0.085, "pcb", bevel=0.03)              # a green coolant band


def tray(f):
    for s in (-0.3, 0.3):
        f.box(s, 0.1, 1.58, 0.04, 0.2, 0.04, "gmD")                                    # brackets
    f.box(0.0, 0.12, 1.53, 1.0, 0.22, 0.025, "steelD", top="steel")                    # tray floor and lips
    f.box(0.0, 0.225, 1.57, 1.0, 0.015, 0.09, "steel", top="steelL")
    f.box(0.0, 0.015, 1.57, 1.0, 0.015, 0.09, "steelD")
    for d, z, col in ((0.05, 1.565, "dark"), (0.1, 1.565, "gmD"), (0.15, 1.565, "dark"), (0.2, 1.565, "medRed"),
                      (0.075, 1.6, "polyB"), (0.125, 1.6, "dark"), (0.175, 1.6, "hazY")):   # a bundle of cables
        f.pipe(z, 0.026, d, col)
    for s in (-0.12, 0.2):
        f.box(s, 0.125, 1.6, 0.03, 0.2, 0.09, "dark")                                   # ties round the bundle


def conduit(f):
    z0, z1 = f.zs, 1.8
    f.box(0.25, 0.04, (z0 + z1) / 2, 0.06, 0.06, z1 - z0, "steel", bevel=0.02)
    f.box(0.25, 0.06, 0.95, 0.2, 0.08, 0.24, "gm", top="steelL", bevel=0.015)          # junction box
    f.box(0.25, 0.104, 0.95, 0.14, 0.01, 0.16, "steelD")
    f.box(0.25, 0.11, 1.02, 0.07, 0.01, 0.025, "hazY")
    for z in (0.6, 1.4):
        f.box(0.25, 0.05, z, 0.1, 0.07, 0.03, "gmD")                                   # clips


def vent(f, low):
    z, w, h = (f.zs + 0.14, 0.5, 0.18) if low else (1.15, 0.42, 0.32)
    f.box(0.0, 0.02, z, w + 0.06, 0.04, h + 0.06, "gmD", top="gm")                       # frame
    f.box(0.0, 0.03, z, w, 0.04, h, "dark")
    for i in range(4 if not low else 3):                                               # louvres
        zz = z - h / 2 + (i + 0.5) * h / (4 if not low else 3)
        f.box(0.0, 0.05, zz, w - 0.04, 0.03, 0.03, "steelD", tilt=0.5)
    for s in (-1, 1):
        f.box(s * (w / 2 + 0.01), 0.045, z + h / 2 + 0.01, 0.03, 0.01, 0.03, "steelL")   # screws


def panel(f, open_):
    z, w, h = 1.0, 0.44, 0.52
    f.box(0.0, 0.01, z, w + 0.04, 0.02, h + 0.04, "gmD")                                # its recess
    if open_:
        f.box(0.0, 0.015, z, w - 0.02, 0.02, h - 0.02, "dark")
        for i, col in enumerate(("medRed", "polyB", "hazY", "pcb")):                   # wiring, a board
            f.box(-0.14 + i * 0.09, 0.03, z - 0.04, 0.025, 0.02, h - 0.14, col)
        f.box(0.1, 0.03, z + 0.12, 0.14, 0.015, 0.12, "pcb")
        f.box(-w / 2 - 0.02, 0.13, z, 0.02, 0.24, h, "plate", top="steelL")             # cover swung out
    else:
        f.box(0.0, 0.025, z, w, 0.02, h, "plate", top="steelL")
        for s in (-1, 1):
            for t in (-1, 1):
                f.box(s * (w / 2 - 0.04), 0.038, z + t * (h / 2 - 0.04), 0.03, 0.01, 0.03, "steelD")
        f.box(w / 2 - 0.07, 0.037, z - h / 2 + 0.07, 0.09, 0.01, 0.09, "hazY")          # hazard corner
        f.box(w / 2 - 0.07, 0.04, z - h / 2 + 0.07, 0.025, 0.01, 0.1, "hazK")


def sign(f, kind):
    z = 1.45
    if kind == "hazard":
        f.box(0.0, 0.015, z, 0.44, 0.02, 0.34, "hazK")
        f.box(0.0, 0.026, z, 0.38, 0.01, 0.28, "hazY")
        for i in range(3):                                                            # a stripe band, an exclamation
            f.box(-0.12 + i * 0.12, 0.032, z - 0.1, 0.05, 0.01, 0.06, "hazK")
        f.box(0.0, 0.032, z + 0.05, 0.05, 0.01, 0.13, "hazK")
    elif kind == "exit":
        f.box(0.0, 0.015, z, 0.48, 0.03, 0.22, "gmD")
        f.box(0.0, 0.032, z, 0.42, 0.01, 0.16, "green")                                 # lit
        f.box(-0.08, 0.04, z, 0.18, 0.01, 0.04, "medWhite")                              # an arrow
        f.box(-0.14, 0.04, z, 0.05, 0.01, 0.11, "medWhite")
    else:
        f.box(0.0, 0.015, z, 0.4, 0.02, 0.4, "navy")
        f.box(0.0, 0.026, z + 0.12, 0.34, 0.01, 0.06, "hazY")                            # a stripe and a numeral
        for dz, ww in ((0.02, 0.14), (-0.05, 0.05), (-0.12, 0.14)):
            f.box(0.0, 0.026, z + dz - 0.02, ww, 0.01, 0.035, "medWhite")


def terminal(f, on):
    z = 1.15
    f.box(0.0, 0.04, z, 0.36, 0.08, 0.42, "gm", top="steelL", bevel=0.015)              # housing
    f.box(0.0, 0.07, z + 0.07, 0.26, 0.04, 0.16, "steelD", tilt=0.12)                  # hood over the screen
    f.box(0.0, 0.083, z + 0.06, 0.22, 0.01, 0.13, "dark")
    if on:
        f.box(-0.04, 0.09, z + 0.08, 0.12, 0.01, 0.025, "cyan")
        f.box(-0.02, 0.09, z + 0.04, 0.16, 0.01, 0.02, "green")
        f.box(0.06, 0.09, z + 0.1, 0.05, 0.01, 0.05, "cyan")
    for i in range(3):                                                                # keypad
        for j in range(2):
            f.box(-0.06 + i * 0.06, 0.085, z - 0.08 - j * 0.05, 0.04, 0.01, 0.035, "steelL")
    f.box(0.12, 0.085, z - 0.1, 0.04, 0.01, 0.04, "green" if on else "rustD")         # status lamp


BUILD = {"pipes": lambda f: pipes(f, False), "pipe.hot": lambda f: pipes(f, True), "tray": tray, "conduit": conduit,
         "vent": lambda f: vent(f, False), "grille": lambda f: vent(f, True),
         "panel": lambda f: panel(f, False), "panel.open": lambda f: panel(f, True),
         "sign.hazard": lambda f: sign(f, "hazard"), "sign.exit": lambda f: sign(f, "exit"),
         "sign.deck": lambda f: sign(f, "deck"),
         "terminal": lambda f: terminal(f, False), "terminal.active": lambda f: terminal(f, True)}


def _job(name, fam, ax):
    f = _Face(f"wallprop_{name}_{fam}_{ax}", ax, fam)
    BUILD[name](f)
    return f.build()


SPRITES = [(f"wallprop.{n}.{fam}.{ax}", (1, 1), "block", lambda n=n, fam=fam, ax=ax: _job(n, fam, ax))
           for n in BUILD for fam in ("wall", "hull") for ax in ("x", "y")]
