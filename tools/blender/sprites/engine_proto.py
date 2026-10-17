"""STYLE PROTOTYPE: 4x5 engine (4 along the hull, 5 deep) built from the detail helpers. Not wired into the game.

Local frame: u -2.5..2.5 is the footprint (+u = hull side), v -2..2, nozzles overhang past u = 2.5 into space."""
from . import core, detail as D
from .cmbkit import Frame

CENTRE = {0: (-1.5, -2.0), 1: (-2.0, -1.5)}     # footprint centre relative to the front-most tile centre
BZ = 0.9                                         # bell axis height
BV = 1.05                                        # bell offset from centre


def engine4x5(rot, hot):
    m = core.Mesh(f"engine45_{rot}_{int(hot)}")
    f = Frame(m, rot, centre=CENTRE[rot])
    glow = "cyan" if hot else "steelD"
    amber = "orange" if hot else "gmD"
    # deck plate and base skirt
    f.box(0, 0, 0, 4.9, 3.9, 0.08, "steelD", top="plateA")
    for sv in (-1, 1):
        # --- rear tank stack ------------------------------------------------------------------------------
        f.box(-1.95, sv * BV, 0.08, 1.0, 1.7, 0.7, "steel", top="steelL")
        D.panel(f, -1.95, sv * BV, 0.78, 0.8, 1.4, "gm")
        D.tank(f, -2.0, sv * (BV - 0.4), 0.8, 0.3, 0.6, bands=2)
        D.tank(f, -2.0, sv * (BV + 0.4), 0.8, 0.3, 0.6, bands=2)
        # --- main engine housing, stacked --------------------------------------------------------------
        f.box(-0.45, sv * BV, 0.08, 2.1, 1.7, 0.95, "steel", top="steelL")
        D.trim(f, -0.45, sv * BV, 1.03, 2.1, 1.7)
        f.box(-1.2, sv * BV, 1.03, 1.0, 1.4, 0.3, "gmD", top="gm")
        D.trim(f, -1.2, sv * BV, 1.33, 1.0, 1.4, "steelL")
        D.fins(f, -1.55, -0.85, sv * BV, 1.4, 1.1, 0.22, 5, thick=0.07)
        D.drum(f, -0.35, 1.0, sv * BV, 1.43, 0.4, n=5)
        f.box(-0.55, sv * BV, 1.03, 0.3, 0.9, 0.12, "steelL", top="plate")
        D.panel(f, -0.45, sv * (BV + 0.86), 0.55, 1.5, 0.6, "gm", face="+v" if sv > 0 else "-v")
        D.slats(f, -1.1, 0.1, sv * (BV + 0.86), 0.12, 0.4, 3, sv)
        D.panel(f, 0.62, sv * BV, 0.55, 1.3, 0.55, "gm", face="+u")
        for k in range(4):                                      # status lamps on the side face
            f.box(-1.2 + k * 0.28, sv * (BV + 0.9), 0.84, 0.13, 0.05, 0.1, amber, base=False)
        f.box(0.5, sv * (BV + 0.9), 0.3, 0.9, 0.05, 0.1, glow, base=False)              # lit coolant strip
        D.rail(f, (-1.3, sv * (BV + 0.93), 0.1), (-1.3, sv * (BV + 0.93), 0.98), 0.06, "plate")   # cable riser
        D.rail(f, (0.2, sv * (BV + 0.93), 0.1), (0.2, sv * (BV + 0.93), 0.98), 0.06, "plate")
        # --- bell ------------------------------------------------------------------------------------------
        v = sv * BV
        f.hcyl(1.45, 1.8, v, BZ, 0.8, "steelL", sides=12, cap="plate")                  # root flange
        f.hcyl(1.8, 2.6, v, BZ, 0.52, "gmD", r1=0.56, sides=12)
        D.ribs(f, 1.85, 2.55, v, BZ, 0.52, 0.56, 3, thick=0.12, grow=0.08, mat="gm")
        f.hcyl(2.6, 2.8, v, BZ, 0.72, "steelL", sides=12, cap="plate")                  # mid collar
        f.hcyl(2.8, 3.95, v, BZ, 0.58, "gmD", r1=0.88, sides=12, cap="dark")            # flared bell
        D.ribs(f, 2.85, 3.9, v, BZ, 0.58, 0.88, 11, thick=0.05, grow=0.04, mat="gm")
        D.ribs(f, 2.85, 3.9, v, BZ, 0.58, 0.88, 4, thick=0.13, grow=0.09, mat="plate")
        for ang in (0.15, 0.9):                                                          # long rails along the bell
            import math
            ca, sa = math.cos(ang), math.sin(ang)
            D.rail(f, (1.85, v + sv * 0.62 * ca, BZ + 0.62 * sa), (3.9, v + sv * 0.98 * ca, BZ + 0.98 * sa), 0.05, "steelL")
        f.hcyl(3.9, 4.05, v, BZ, 0.96, "steelL", sides=12, cap="dark")                  # lip
        f.hcyl(3.98, 4.0, v, BZ, 0.62, glow, sides=12, cap="arc" if hot else "steelD")  # throat glow
        if hot:
            f.hcyl(4.0, 4.7, v, BZ, 0.55, "cyan", r1=0.12, sides=10, cap="arc")
        # --- pipes along the outer side, into the hull ------------------------------------------------------
        vo = sv * 1.9
        D.pipe(f, [(-2.2, vo, 0.3), (0.9, vo, 0.3), (0.9, vo, 0.62), (2.5, vo, 0.62)], 0.09, "gm")
        D.pipe(f, [(-2.3, vo, 0.5), (-1.55, vo, 0.5), (-1.55, vo, 1.15), (-0.4, vo, 1.15)], 0.06, "plate")
    # --- central spine: conduit bundle between the bells, going into the wall ---------------------------------
    f.box(0.7, 0, 0.08, 3.6, 0.3, 0.18, "steelD", top="steel")
    D.conduit_bundle(f, (-2.3, 0, 0.5), (2.9, 0, 0.5), n=3, pitch=0.14, r=0.06, across="z", clamps=5)
    D.pipe(f, [(-2.3, 0, 0.9), (-1.6, 0, 0.9), (-1.6, 0, 1.55), (1.0, 0, 1.55)], 0.07, "gm")
    for u in (-1.9, -0.9, 0.1, 1.1):
        D.bracket(f, u, 0, 0.08, 0.5)
    return [m.build()]


def engine4x5_variants():
    return [(f"proto.engine45.r{r}" + (".active" if hot else ""), r, hot) for r in (1, 0) for hot in (False, True)]
