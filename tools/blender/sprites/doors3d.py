"""Doors in relief after Space Haven's interior doors (doorway1 / doorway2 / doubleDoorway1): the door tile's wall is
the door frame, flush with the wall's face and up to its top under the black cap, with a large round-cornered opening;
under the frame's sides stand feet with the wall skirt's own profile, so the ramps either side run on into them
instead of over the door; hazard stripes run through the doorway.

Designs (DESIGNS): navy (doorway1: a navy frame, a single rounded leaf with a window and a badge), rose (doorway2: a
rose frame, a leaf with a red light bar) and split (the walls' teal, two leaves meeting in the middle, as the double
doorway). The open door has no leaf: the doorway shows through to the floor behind."""
import math

from mathutils import Vector

from . import doors as D
from . import wall3d as T
from . import walls as W
from .wall3d import LINE, PAINT, PX, Relief, cap, paint, slab

DESIGNS = ("navy", "rose", "split")
FAM = {"navy": "blue", "rose": "rose", "split": "wall"}
HW = 0.36                            # the opening's half-width (Space Haven: about 0.7 of the tile)
RC = 0.14                            # its top corners' radius
LEAF = 0.05                          # the closed leaf this far in from the frame's face


def heights():
    """(opening height, frame top): the frame runs to the wall's top; the opening leaves a header of about 0.3."""
    return max(1.55, W.HF - 0.3), W.HF


def open_top(u, zo):
    a = abs(u) - (HW - RC)
    return zo if a <= 0 else zo - RC + math.sqrt(max(0.0, RC * RC - a * a))


class DoorShell(T.Shell):
    """The wall's shell over the door tile: its cap and back, no face (the frame is the face), no skirt (the feet)."""
    def __init__(self, axis):
        super().__init__(10 if axis == "x" else 5, "wall", "up")
        self.axis = axis

    def skip_skirt(self, i, j):
        return True

    def face_lo(self, x, y):
        return W.HF + 1.0


def door(axis="x", is_open=False, design="navy"):
    sp = DoorShell(axis)
    k = Relief(f"door3d_{design}_{axis}{'_open' if is_open else ''}")
    W.emit(k.m, sp)
    cap(k, sp)
    ax = "y" if axis == "x" else "x"
    VB, VW, _, _ = D.planes()
    plane = T.snap(VW)
    k.side = ax
    o = T.OUT(ax)
    zo, zf = heights()
    fam = FAM[design]
    zs, run = W.skirt_top(), W.skirt_run()
    side = Vector((1, 0, 0)) if ax == "y" else Vector((0, 1, 0))
    up, down = Vector((0, 0, 1)), Vector((0, 0, -1))

    def P(u, z, at=plane):
        return T.P(ax, at, u, z, 0.0)

    # the frame: the face round the opening, column by column under its rounded corners
    n = 64
    for i in range(n):
        u0, u1 = -0.5 + i / n, -0.5 + (i + 1) / n
        um = (u0 + u1) / 2
        lo = open_top(um, zo) if abs(um) < HW else 0.0
        k.poly([P(u0, lo), P(u1, lo), P(u1, zf), P(u0, zf)], fam, 2, o)
        if abs(um) < HW and i + 1 < n:                          # the opening's head: its soffit, stepped
            k.poly([P(u0, lo, VB), P(u1, lo, VB), P(u1, lo), P(u0, lo)], fam, 1, down)
    for s in (-1, 1):                                           # the jambs' inner sides (the screen-left one shows)
        k.poly([P(s * HW, 0, VB), P(s * HW, 0), P(s * HW, zo - RC), P(s * HW, zo - RC, VB)], fam, 1, -s * side)
    # the frame's trim: a raised rim round the opening, a lit band under the cap, the jambs' grooves and lamps
    for i in range(n):
        u0, u1 = -0.5 + i / n, -0.5 + (i + 1) / n
        um = (u0 + u1) / 2
        if abs(um) < HW + 0.07:
            lo = open_top(um, zo) if abs(um) < HW else 0.0
            hi = open_top(um, zo + 0.07)
            if abs(um) >= HW:
                lo, hi = 0.0, zo - RC + math.sqrt(max(0.0, (RC + 0.07) ** 2 - (abs(um) - (HW - RC)) ** 2))
            slab(k, ax, plane, u0, u1, lo, hi, PX, fam, 3, ends=(False, False))
    slab(k, ax, plane, -0.5, 0.5, zf - 0.1, zf - 0.03, PX / 2, fam, 4, ends=(False, False))
    for s in (-1, 1):
        g = s * (HW + 0.5 + 0.07) / 2
        paint(k, ax, plane, g - LINE / 2, g + LINE / 2, zs + 0.05, zo - 0.1, 0.0, fam, 0)
        T.slab(k, ax, plane, g - 0.035, g + 0.035, zo - 0.05, zo + 0.03, PX, "wall", 2)
        _fixed(k, ax, plane, g - 0.02, g + 0.02, zo - 0.035, zo + 0.015, PX + PAINT,
               "lampY" if is_open else ("red" if design != "split" else "lampY"))
    # the feet: the skirt's profile under each side of the frame, so the neighbours' ramps run on into them
    for a, b in ((-0.5, -HW - 0.07), (HW + 0.07, 0.5)):
        top = [P(a, zs), P(b, zs), P(b, 0, plane + run), P(a, 0, plane + run)]
        k.poly(top, fam, 2, (o * zs / run + up).normalized())
        for u, sgn in ((a, -1), (b, 1)):
            if abs(abs(u) - 0.5) > 1e-6:                        # (its inner end: the outer one meets the neighbour)
                k.poly([P(u, 0), P(u, zs), P(u, 0, plane + run)], fam, 1, sgn * side)
        # a groove across each foot
        q = [P(a + 0.02, zs * 0.5, plane + run * 0.5), P(b - 0.02, zs * 0.5, plane + run * 0.5),
             P(b - 0.02, zs * 0.45, plane + run * 0.55), P(a + 0.02, zs * 0.45, plane + run * 0.55)]
        k.poly([p + (o * zs / run + up).normalized() * PAINT for p in q], fam, 0, (o * zs / run + up).normalized())
    # the floor through the doorway: hazard stripes from the wall's back to the feet's toe
    c = 1 / W.GN
    nu, nv = int(round(2 * HW * W.GN)), int(round((plane + run - VB) * W.GN))
    for i in range(nu):
        for r in range(nv):
            u0, v0 = -HW + i * c, VB + r * c
            col = "hazY" if ((i + r // 2) // 3) % 2 == 0 else "hazK"        # (slanted bands: a 45 degree plan
                                                                            # diagonal turns to noise on screen)
            k.poly([P(u0, 0.012, v0), P(u0 + c, 0.012, v0), P(u0 + c, 0.012, v0 + c), P(u0, 0.012, v0 + c)],
                   fam, 2, up, fixed=col)
    if not is_open:
        {"navy": _navy, "rose": _rose, "split": _split}[design](k, ax, plane - LEAF, zo, fam, o)
    return k.build()


def _fixed(k, ax, plane, u0, u1, z0, z1, d, col):
    k.poly([T.P(ax, plane, u, z, d) for u, z in ((u0, z0), (u1, z0), (u1, z1), (u0, z1))], "wall", 2, T.OUT(ax),
           fixed=col)


def _leaf(k, ax, at, zo, fam, lvl, u0=-HW, u1=HW, n=48):
    """A leaf filling the opening (its rounded head) in the plane `at`."""
    for i in range(n):
        a, b = u0 + (u1 - u0) * i / n, u0 + (u1 - u0) * (i + 1) / n
        z = open_top((a + b) / 2, zo)
        k.poly([T.P(ax, at, a, 0.0, 0.0), T.P(ax, at, b, 0.0, 0.0), T.P(ax, at, b, z, 0.0), T.P(ax, at, a, z, 0.0)],
               fam, lvl, T.OUT(ax))


def _navy(k, ax, at, zo, fam, o):
    """doorway1: a rounded leaf, a raised inner panel, a window band, a pink badge, a dark kick plate."""
    _leaf(k, ax, at, zo, fam, 2)
    slab(k, ax, at, -HW + 0.06, HW - 0.06, 0.12, zo - 0.12, PX / 2, fam, 3)
    paint(k, ax, at, -HW + 0.1, HW - 0.1, zo * 0.55, zo * 0.7, PX / 2, fam, 0)
    _fixed(k, ax, at, -HW + 0.11, HW - 0.11, zo * 0.56, zo * 0.69, PX / 2 + 2 * PAINT, "glassD")
    _fixed(k, ax, at, 0.08, 0.2, zo * 0.75, zo * 0.84, PX / 2 + 2 * PAINT, "rL")
    paint(k, ax, at, -HW + 0.08, HW - 0.08, 0.14, 0.3, PX / 2, fam, 1)


def _rose(k, ax, at, zo, fam, o):
    """doorway2: a rounded leaf in a dark rim, a red light bar across it, a lower hatch."""
    _leaf(k, ax, at, zo, fam, 2)
    slab(k, ax, at, -HW + 0.05, HW - 0.05, 0.1, zo - 0.1, PX / 2, fam, 3)
    slab(k, ax, at, -HW + 0.09, HW - 0.09, zo * 0.6, zo * 0.7, PX, "blue", 1)
    _fixed(k, ax, at, -0.08, 0.08, zo * 0.625, zo * 0.675, PX + PAINT, "red")
    paint(k, ax, at, -HW + 0.12, HW - 0.12, 0.2, zo * 0.42, PX / 2, fam, 1)
    paint(k, ax, at, -HW + 0.12 + LINE, HW - 0.12 - LINE, 0.2 + LINE, zo * 0.42 - LINE, PX / 2 + PAINT, fam, 4)


def _split(k, ax, at, zo, fam, o):
    """The double doorway's look: two leaves meeting in the middle, ochre bars across them at mid height."""
    _leaf(k, ax, at, zo, fam, 2)
    paint(k, ax, at, -LINE / 2, LINE / 2, 0.0, zo, 0.001, fam, 0)
    for s in (-1, 1):
        a, b = (-HW + 0.06, -0.05) if s < 0 else (0.05, HW - 0.06)
        slab(k, ax, at, a, b, 0.12, zo - 0.14, PX / 2, fam, 3)
        slab(k, ax, at, a + 0.03, b - 0.03, zo * 0.47, zo * 0.53, PX / 2 + PX / 2, "ochre", 3)
        paint(k, ax, at, a + 0.03, b - 0.03, zo * 0.75, zo * 0.75 + LINE, PX / 2, fam, 1)
        paint(k, ax, at, a + 0.03, b - 0.03, zo * 0.25, zo * 0.25 + LINE, PX / 2, fam, 1)
