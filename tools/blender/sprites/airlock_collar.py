"""Airlock (module.airlock), the docking collar beyond the hull row: its tube, the clamp ring (airlock_insert), the
recessed iris hatch (the outer door) and its status lights. Built in the module frame of airlock.py, which renders it
(items)."""
import math

from . import airlock_insert as INS
from . import core
from .airlock import (COLLAR_END, GREY, GREY_T, HULL_U, NEAR, RED, RH, RR, ZC, _ext_tiles, _tube, frame)

def _sector(r0, r1, a0, a1, tw=0.0):
    """(v, z) quad of an annular sector about the collar axis; tw rotates the inner edge (iris blades)."""
    if r0 <= 1e-4:
        return [(0.0, ZC), (r1 * math.cos(a0), ZC + r1 * math.sin(a0)), (r1 * math.cos(a1), ZC + r1 * math.sin(a1))]
    return [(r1 * math.cos(a0), ZC + r1 * math.sin(a0)), (r1 * math.cos(a1), ZC + r1 * math.sin(a1)),
            (r0 * math.cos(a1 + tw), ZC + r0 * math.sin(a1 + tw)), (r0 * math.cos(a0 + tw), ZC + r0 * math.sin(a0 + tw))]


REC, TW0, R_TIP = 0.07, 0.9, 0.07  # the iris: set back in the mouth; its blades' twist when shut; their tips' radius
LIGHTS = (0.0, math.pi, 1.5 * math.pi)  # status lights round the mouth (clear of the clamps on the diagonals)


def _blade(r0, r1, a0, a1, tw, n=5):
    """(v, z) outline of an iris blade: its rim arc a0..a1 at r1, its tip edge at r0 turned tw (the seams spiral in)."""
    rim = [(r1 * math.cos(a0 + (a1 - a0) * j / (n - 1)), ZC + r1 * math.sin(a0 + (a1 - a0) * j / (n - 1))) for j in range(n)]
    return rim + [(r0 * math.cos(a1 + tw), ZC + r0 * math.sin(a1 + tw)), (r0 * math.cos(a0 + tw), ZC + r0 * math.sin(a0 + tw))]


def collar(rot, p, docked):
    """The docking collar: a flange on the hull, a grey tube with two red bands in the clamp ring (airlock_insert), and
    a mouth ring holding the iris hatch (the outer door; p = how far open) set back behind a light lip, a red marker
    on top. Status lights round the mouth: red, green when docked. Four clamps lie back round the ring, or swing
    forward onto a docked shuttle's hatch over a dark seal ring; the seal light on the flange is green when docked."""
    m = core.Mesh(f"airlock_collar_{rot}_{int(docked)}")
    f = frame(m, rot)
    u0, ue = HULL_U + 0.5, COLLAR_END
    um = ue - 0.16
    f.hcyl(u0 - 0.02, u0 + 0.07, 0, ZC, RR + 0.04, GREY, sides=16, cap=GREY_T)                     # flange
    f.hcyl(u0 + 0.07, um, 0, ZC, RR - 0.06, GREY_T, sides=16, cap="dark")                         # tube
    for uk in (u0 + 0.18, u0 + 0.36):
        f.hcyl(uk - 0.03, uk + 0.03, 0, ZC, RR - 0.04, RED, sides=16, cap=RED)                    # red bands
    ring16 = [(k * math.tau / 16, (k + 1) * math.tau / 16) for k in range(16)]
    for a0, a1 in ring16:                                                                        # mouth ring
        _tube(f, um, ue, _sector(RH, RR, a0, a1), GREY, GREY_T, cap=GREY_T)
    uh = ue - REC                                                                                # the iris's plane
    f.hcyl(uh - 0.1, uh - 0.095, 0, ZC, RH + 0.01, "dark", sides=16, cap="dark")                  # behind the hatch
    f.hcyl(uh - 0.05, ue - 0.02, 0, ZC, RH + 0.003, "steelD", sides=16)                          # the bore's wall
    for a0, a1 in ring16:                                                                        # light lip
        _tube(f, ue - 0.025, ue + 0.006, _sector(RH - 0.025, RH + 0.03, a0, a1), "steelL", "plate", cap="plate")
    if p >= 1.0:                                                                                 # open: a dark bore the tube's mouth reads through
        f.hcyl(ue, u0 + 0.07, 0, ZC, RH - 0.01, "dark", sides=16)
        f.hcyl(uh - 0.14, uh - 0.135, 0, ZC, RH - 0.01, "dark", sides=16, cap="dark")
    f.box(um + 0.08, 0, ZC + RR - 0.03, 0.12, 0.14, 0.07, RED, top=RED)                             # red marker
    if p < 1.0:                                                                                  # iris blades
        r0, tw = max(R_TIP, RH * p), TW0 + 0.55 * p
        for k in range(6):
            a0, a1 = k * math.tau / 6 + 0.03, (k + 1) * math.tau / 6 - 0.03
            col = "plate" if k % 2 else "steelL"
            _tube(f, uh - 0.09, uh - 0.05, _blade(r0, RH + 0.01, a0, a1, tw), col, col, cap=col)
        if p == 0.0:
            f.hcyl(uh - 0.06, uh - 0.03, 0, ZC, 0.08, "steelD", sides=8, cap=RED)                  # hub
    if docked:                                                                                   # the dark seal ring (the shuttle covers it)
        for a0, a1 in ring16:
            _tube(f, ue, ue + 0.05, _sector(RH, RR + 0.03, a0, a1), "steelD", "steelD", cap="steelD")
    sl, ul = ("green", ue + 0.05) if docked else ("red", ue)
    for a in LIGHTS:                                                                             # status lights
        r = (RH + RR) / 2 + 0.01
        f.box(ul, r * math.cos(a), ZC + r * math.sin(a), 0.03, 0.05, 0.05, sl, top=sl, base=False)
    lamp = "green" if docked else "steelD"
    f.box(u0 + 0.03, 0, ZC + RR + 0.02, 0.06, 0.1, 0.04, lamp, top=lamp)                            # seal light
    for k in range(4):                                                                           # clamps
        a = math.pi / 4 + k * math.pi / 2
        cv, cz = math.cos(a), math.sin(a)
        if docked:
            r = RR - 0.06
            f.box(ue + 0.05, cv * r, ZC + cz * r, 0.1, 0.09, 0.09, "steelD", top="steelD", base=False)
            f.box(ue + 0.11, cv * (r - 0.06), ZC + cz * (r - 0.06), 0.04, 0.08, 0.08, RED, top=RED, base=False)
        else:
            r = RR + 0.02
            f.box(ue - 0.06, cv * r, ZC + cz * r, 0.12, 0.07, 0.07, "steelD", top="steelD", base=False)
    own = [m.build()] + INS.ring(rot)
    if rot not in NEAR:
        return own
    return own, own + _ext_tiles(rot, (-1, 0, 1)) + INS.brace(rot)                               # ("over": in front of the hull)
