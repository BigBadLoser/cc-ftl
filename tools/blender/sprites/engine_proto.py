"""STYLE PROTOTYPE v2: 4x5 engine that IS part of the outer hull (4 along the hull, 5 deep). Not wired into the game.

Local frame: u -2.5..2.5 is the footprint (+u = hull side), v -2..2. The outermost footprint row (u 1.5..2.5) is armoured
hull plating built with the SAME profile as tile.hull walls (walls.py: H, WT, CH, palette), so the hull wall butts into
its ends; the bells protrude from that face into space."""
from . import core, detail as D, greeble as G, walls
from .cmbkit import Frame

CENTRE = {0: (-1.5, -2.0), 1: (-2.0, -1.5)}     # footprint centre relative to the front-most tile centre
BZ = 0.95                                        # bell axis height
BV = 1.05                                        # bell offset from centre
UH = 2.0                                         # hull row centre (u)


def hull_plating(f, v0, v1):
    """Wall-profile ridge along v across the hull row: flat top (steelD, dark channel), outer slope with foot crease,
    seam and crest, exactly as walls.py draws a `hull` wall arm."""
    c, H, WT, CH = walls.PAL["hull"], walls.H, walls.WT, walls.CH
    ua, ub = UH + WT, UH + 0.5
    f.poly([f.pt(UH - WT, v0, H), f.pt(UH - CH, v0, H), f.pt(UH - CH, v1, H), f.pt(UH - WT, v1, H)], c["top"], flip=True)
    f.poly([f.pt(UH - CH, v0, H), f.pt(UH + CH, v0, H), f.pt(UH + CH, v1, H), f.pt(UH - CH, v1, H)], c["chan"], flip=True)
    f.poly([f.pt(UH + CH, v0, H), f.pt(UH + WT, v0, H), f.pt(UH + WT, v1, H), f.pt(UH + CH, v1, H)], c["top"], flip=True)
    n = walls.NT
    for j in range(n):                                   # outer (+u) slope, bands bottom -> top
        t0, t1 = j / n, (j + 1) / n
        col = c["el"] if j in (0, n // 2) else c["crest"] if j == n - 1 else c["eb"]
        f.poly([f.pt(ub + (ua - ub) * t0, v0, H * t0), f.pt(ub + (ua - ub) * t1, v0, H * t1),
                f.pt(ub + (ua - ub) * t1, v1, H * t1), f.pt(ub + (ua - ub) * t0, v1, H * t0)][::-1], col, flip=True)


def bell(f, v, hot, glow):
    D.drum(f, 1.2, 1.5, v, BZ, 0.72, n=1, body="steelL", rib="plate", sides=12)              # armoured port collar
    f.hcyl(1.5, 2.45, v, BZ, 0.55, "gm", r1=0.58, sides=12)                                   # neck through the plating
    D.ribs(f, 1.6, 2.4, v, BZ, 0.55, 0.58, 3, thick=0.12, grow=0.08, mat="plate")
    f.hcyl(2.45, 2.7, v, BZ, 0.8, "steelL", sides=12, cap="plate")                            # mid flange
    f.hcyl(2.7, 4.0, v, BZ, 0.36, "dark", r1=0.58, sides=12)                                  # inner liner (seen between vanes)
    ri = lambda u: 0.36 + (u - 2.7) / 1.3 * 0.22                                            # noqa: E731
    ro = lambda u: 0.62 + (u - 2.7) / 1.3 * 0.36                                            # noqa: E731
    D.vanes(f, 2.7, 4.0, v, BZ, ri, ro, 10, thick=0.1, mat="gm", phase=0.2)
    for u in (3.2, 3.62):                                                                    # outer retaining rings
        D.drum(f, u - 0.05, u + 0.05, v, BZ, ro(u) - 0.02, n=1, body="steelL", rib="plate", sides=12, rib_t=0.08, grow=0.08)
    f.hcyl(3.96, 4.1, v, BZ, ro(4.0) + 0.07, "plate", sides=12)                              # lip ring
    f.hcyl(3.1, 3.12, v, BZ, 0.5, glow, sides=12, cap="arc" if hot else "steelD")          # throat glow disc
    if hot:
        f.hcyl(4.0, 4.8, v, BZ, 0.5, "cyan", r1=0.1, sides=10, cap="arc")


def engine4x5(rot, hot):
    m = core.Mesh(f"engine45_{rot}_{int(hot)}")
    f = Frame(m, rot, centre=CENTRE[rot])
    glow = "cyan" if hot else "steelD"
    amber = "orange" if hot else "gmD"
    f.box(0, 0, 0, 4.9, 3.9, 0.08, "steel", top="plateB")
    hull_plating(f, -2.0, 2.0)
    f.box(0.2, 0, 0.0, 0.5, 3.9, 0.1, "steelD", top="steel")                                 # grime-free deck seam
    for sv in (-1, 1):
        v = sv * BV
        vf = sv * (BV + 0.86)                                                                  # outer face of the housing
        # --- rear tank stack -------------------------------------------------------------------------------
        f.box(-1.95, v, 0.08, 1.0, 1.7, 0.7, "steelL", top="plate")
        D.trim(f, -1.95, v, 0.78, 1.0, 1.7, "plate")
        D.tank(f, -2.0, v - 0.4, 0.82, 0.3, 0.7, mat="steelL", cap="plate", bands=2)
        D.tank(f, -2.0, v + 0.4, 0.82, 0.3, 0.45, mat="steelL", cap="plate", bands=1)
        # --- stacked housing: base, stepped second tier, fin pack, drum -------------------------------------
        f.box(-0.45, v, 0.08, 2.1, 1.7, 0.95, "steelL", top="plate")
        D.trim(f, -0.45, v, 1.03, 2.1, 1.7, "plate")
        f.box(-1.2, v, 1.06, 1.0, 1.3, 0.28, "steel", top="plate")                              # stepped tier (inset = shadow line)
        D.trim(f, -1.2, v, 1.34, 1.0, 1.3, "plate")
        D.fins(f, -1.55, -0.85, v, 1.38, 1.0, 0.24, 5, thick=0.07, mat="steelL", top="plate")
        D.drum(f, -0.3, 1.0, v, 1.45, 0.4, n=5, body="steel", rib="plate")
        f.box(-0.55, v, 1.06, 0.3, 0.9, 0.1, "steelL", top="plate")
        # --- outer face: panels, slats, greebles ---------------------------------------------------------------
        D.panel(f, -0.9, vf, 0.62, 1.0, 0.55, "gm", face="+v" if sv > 0 else "-v")
        D.slats(f, 0.1, 0.9, vf, 0.2, 0.52, 3, sv, depth=0.04, w=0.06)
        G.scatter(f, "+v" if sv > 0 else "-v", vf, [("hatch", -0.85, 0.6), ("junction", 0.45, 0.72), ("valve", -1.5, 0.66),
                                                     ("bolts", 0.7, 0.78)])
        for k in range(4):                                                                     # status lamps
            f.box(-1.45 + k * 0.28, vf + sv * 0.02, 0.92, 0.13, 0.05, 0.1, amber, base=False)
        f.box(0.5, vf + sv * 0.02, 0.3, 0.9, 0.05, 0.1, glow, base=False)
        for u in (-1.3, 0.25):                                                                 # thick cable risers
            D.rail(f, (u, vf + sv * 0.1, 0.1), (u, vf + sv * 0.1, 0.98), 0.085, "plate")
        # housing top and front greebles
        G.scatter(f, "z", 1.03, [("junction", -0.45, v + sv * 0.55), ("bolts", 0.7, v - sv * 0.5)])
        G.scatter(f, "z", 0.78, [("bolts", -1.95, v)])
        G.scatter(f, "+u", 0.6, [("junction", v - 0.5, 0.5), ("valve", v + 0.35, 0.55)])
        bell(f, v, hot, glow)
        # --- pipes along the outer side, into the hull ---------------------------------------------------------
        vo = sv * 1.93
        D.pipe(f, [(-2.2, vo, 0.3), (0.9, vo, 0.3), (0.9, vo, 0.62), (1.45, vo, 0.62)], 0.12, "gm")
        D.pipe(f, [(-2.3, vo, 0.55), (-1.55, vo, 0.55), (-1.55, vo, 1.15), (-0.4, vo, 1.15)], 0.09, "plate")
    # --- central spine ---------------------------------------------------------------------------------------
    f.box(-0.2, 0, 0.08, 3.4, 0.3, 0.18, "steelD", top="steel")
    D.conduit_bundle(f, (-2.3, 0, 0.5), (1.5, 0, 0.5), n=3, pitch=0.16, r=0.07, across="z", clamps=4)
    D.pipe(f, [(-2.3, 0, 0.95), (-1.6, 0, 0.95), (-1.6, 0, 1.6), (0.9, 0, 1.6)], 0.09, "gm")
    for u in (-1.9, -0.9, 0.1, 1.0):
        D.bracket(f, u, 0, 0.08, 0.5)
    return [m.build()]
