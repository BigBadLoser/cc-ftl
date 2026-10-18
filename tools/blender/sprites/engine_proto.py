"""STYLE PROTOTYPE v2: 4x5 engine that IS part of the outer hull (4 along the hull, 5 deep). Not wired into the game.

Local frame: u -2.5..2.5 is the footprint (+u = hull side), v -2..2. x built with the SAME profile as tile.hull walls (walls.py: H, WT, CH, palette), so the hull wall butts into
its ends; the bells protrude from that face into space."""
import math
from . import core, detail as D, greeble as G, walls
from . import cmbkit
from .cmbkit import Frame


def _g(name):
    """Tag the following primitives with a group for overlap.py (no-op unless recording)."""
    if cmbkit.REC is not None:
        cmbkit.REC.group = name


CENTRE = {0: (-1.5, -2.0), 1: (-2.0, -1.5)}     # footprint centre relative to the front-most tile centre
BZ = 0.95                                        # bell axis height
BV = 1.05                                        # bell offset from centre
UH = 2.0                                         # hull row centre (u)


def bulkhead(g, full):
    """Engine bulkhead on the hull row: a heavy slab across the whole hull side with taller armoured pylons between and
    at the ends of the bells, ribbed plating, bell-mount collars and a greebled end cheek. Full mode rises above wall
    height (1.2); cut mode stays low (cutaway intent) but keeps the same layout. Real wall tiles run underneath, so the
    outer ends (v = +-2) butt into neighbouring walls with the wall profile."""
    hs, hp = (1.45, 2.05) if full else (0.58, 0.9)
    _g("bulkhead")
    g.box(2.02, 0, 0, 0.96, 3.9, hs, "steel", top="plate")
    D.trim(g, 2.02, 0, hs, 0.96, 3.9, "plate")
    _g("pylon")
    for vv in (-1.85, 0.0, 1.85):                                               # armoured pylons clear of the bell shells
        sv = 0.42 if vv == 0 else 0.3
        g.box(2.0, vv, hs, 0.74, sv, hp - hs, "steelL", top="plate")
        D.trim(g, 2.0, vv, hp, 0.74, sv, "plate", w=0.05)
    _g("bulkhead")
    for k in range(13):                                                         # ribbed seams on the outer face
        vv = -1.92 + k * 0.32
        g.box(2.53, vv, 0.05, 0.07, 0.1, hs - 0.1, "plate")
    for zz in ((0.45, 0.95) if full else (0.3,)):
        g.box(2.53, 0, zz, 0.07, 3.8, 0.08, "steelD")
    for k in range(10):                                                         # ribs across the slab top (between the greebles)
        if full and any(abs(-1.8 + k * 0.4 - gv) < 0.32 for gv in (0.62, -0.62)):
            continue
        g.box(2.02, -1.8 + k * 0.4, hs, 0.8, 0.07, 0.05, "plate")
    _g("collar")
    for sv in (-1, 1):                                                          # bell-mount collars with bolts
        v = sv * BV
        D.annulus(g, 2.5, 2.64, v, BZ, 0.98, 0.72, "steelL", "plate", sides=16)
        for k in range(8):
            ang = k * math.tau / 8 + 0.2
            c, s_ = math.cos(ang), math.sin(ang)
            D.seg(g, (2.64, v + 0.86 * c, BZ + 0.86 * s_), (2.71, v + 0.86 * c, BZ + 0.86 * s_), 0.05, "plate", 6)
    _g("greeble")
    D.panel(g, 1.85, 1.95, 0.45 if full else 0.28, 0.55, 0.38 if full else 0.3, "blueGrey", face="+v")
    if full:                                                                    # greebles only where nothing covers them
        G.scatter(g, "z", hs, [("junction", 2.0, 0.62), ("bolts", 2.2, -0.62)])
        for vv in (-1.85, 0.0, 1.85):
            G.hex_cluster(g, "+u", vv, hs + 0.3, 2.37, n=2, cols=1, pitch=0.2)


def hull_section(f, rot, full, holdout=False):
    """The engine's own hull section: the real hull wall pieces (walls.block 'hull', full height or low cutaway) laid
    along the 4-tile hull row, so neighbouring wall tiles butt into it exactly. Full mode adds armour plates and bolts on
    the outer face (the bells pass through)."""
    import bpy
    from mathutils import Vector
    mask = 5 if rot % 2 else 10
    objs = []
    for k, vv in enumerate((-1.5, -0.5, 0.5, 1.5)):
        ob = walls.block(mask, "hull", None, f"engine_hull_{rot}_{k}", full)[0]
        gx, gy = f.xy(UH, vv)
        ob.location = Vector(core.G(gx, gy, 0.0))
        objs.append(ob)
    if holdout:
        for ob in objs:
            ob.is_holdout = True
    m = core.Mesh(f"engine_bulkhead_{rot}_{int(full)}")
    bulkhead(Frame(m, rot, centre=CENTRE[rot]), full)
    ar = m.build()
    if holdout:
        ar.is_holdout = True
    objs.append(ar)
    return objs


def bell(f, v, hot, glow):
    """Solid segmented nozzle: closed flared shell of chunky ring segments separated by deep dark grooves, longitudinal
    ribs, thick lip, dark liner and a glowing core."""
    D.drum(f, 1.2, 1.5, v, BZ, 0.66, n=1, body="steelL", rib="plate", sides=16)             # mount flange (inside the bulkhead)
    f.hcyl(1.5, 2.45, v, BZ, 0.55, "gm", r1=0.58, sides=16)
    f.hcyl(2.45, 2.75, v, BZ, 0.8, "steelL", sides=16, cap="plate")                          # mount flange (in front of it)
    ro = lambda u: 0.62 + (u - 2.75) / 1.25 * 0.34                                          # noqa: E731
    f.hcyl(2.75, 4.0, v, BZ, 0.4, "dark", r1=0.62, sides=16)                                 # liner seen through the mouth
    n = 6
    for k in range(n):                                                                       # segments + grooves
        u0 = 2.75 + 1.25 * k / n
        u1 = 2.75 + 1.25 * (k + 1) / n
        f.hcyl(u0, u1 - 0.07, v, BZ, ro(u0) + 0.02, "gm", r1=ro(u1 - 0.07) + 0.02, sides=16, cap="gm")
        f.hcyl(u1 - 0.07, u1, v, BZ, ro(u1) - 0.08, "dark", sides=16)                       # deep groove
        D.annulus(f, u0 + 0.01, u0 + 0.08, v, BZ, ro(u0) + 0.09, ro(u0) - 0.02, "plate", "plate", sides=16)   # raised rib
    for k in range(8):                                                                       # longitudinal ribs on the shell
        ang = k * math.tau / 8 + 0.2
        c, s_ = math.cos(ang), math.sin(ang)
        D.rail(f, (2.85, v + 0.68 * c, BZ + 0.68 * s_), (3.98, v + 1.0 * c, BZ + 1.0 * s_), 0.045, "steelL")
    D.annulus(f, 3.9, 4.12, v, BZ, ro(4.0) + 0.1, ro(4.0) - 0.2, "plate", "steelL", sides=16)   # thick lip
    f.hcyl(3.15, 3.17, v, BZ, 0.45, glow, sides=16, cap="arc" if hot else "steelD")        # glowing core
    if hot:
        f.hcyl(4.0, 4.8, v, BZ, 0.5, "cyan", r1=0.1, sides=12, cap="arc")


def machine(f, rot, hot):
    glow = "cyan" if hot else "steelD"
    amber = "orange" if hot else "gmD"
    _g("deck")
    f.box(0, 0, 0, 4.9, 3.9, 0.08, "steel", top="plateB")
    f.box(0.2, 0, 0.0, 0.5, 3.9, 0.1, "steelD", top="steel")                                 # grime-free deck seam
    for sv in (-1, 1):
        v = sv * BV
        vf = sv * (BV + 0.75)                                                                  # outer face of the housing
        _g("housing")
        # --- rear tank stack -------------------------------------------------------------------------------
        f.box(-1.95, v, 0.08, 1.0, 1.5, 0.7, "steelL", top="plate")
        D.trim(f, -1.95, v, 0.78, 1.0, 1.5, "plate")
        D.tank(f, -2.0, v - 0.4, 0.82, 0.3, 0.7, mat="steelL", cap="plate", bands=2)
        D.tank(f, -2.0, v + 0.4, 0.82, 0.3, 0.45, mat="steelL", cap="plate", bands=1)
        # --- stacked housing: base, stepped second tier, fin pack, drum -------------------------------------
        f.box(-0.45, v, 0.08, 2.1, 1.5, 0.95, "steelL", top="plate")
        D.trim(f, -0.45, v, 1.03, 2.1, 1.5, "plate")
        f.box(-1.2, v, 1.06, 1.0, 1.15, 0.28, "blueGrey", top="plate")                              # stepped tier (inset = shadow line)
        D.trim(f, -1.2, v, 1.34, 1.0, 1.15, "plate")
        D.fins(f, -1.55, -0.85, v, 1.38, 1.0, 0.24, 5, thick=0.07, mat="steelL", top="plate")
        D.drum(f, -0.3, 1.0, v, 1.45, 0.4, n=5, body="steel", rib="plate")
        f.box(-0.55, v, 1.06, 0.3, 0.8, 0.1, "steelL", top="plate")
        _g("greeble")
        # --- outer face: panels, slats, greebles ---------------------------------------------------------------
        D.panel(f, -0.7, vf, 0.62, 1.4, 0.55, "blueGrey", face="+v" if sv > 0 else "-v")
        D.slats(f, 0.15, 0.55, vf, 0.2, 0.52, 3, sv, depth=0.04, w=0.06)
        fc = "+v" if sv > 0 else "-v"
        G.scatter(f, fc, vf, [("valve", -1.05, 0.62), ("hatch", -0.45, 0.6), ("junction", 0.3, 0.72)])
        for k in range(4):                                                                     # status lamps
            f.box(-1.4 + k * 0.28, vf + sv * 0.02, 0.95, 0.13, 0.05, 0.1, amber, base=False)
        f.box(0.3, vf + sv * 0.02, 0.38, 0.5, 0.05, 0.08, glow, base=False)
        _g("pipe")
        for u in (-1.45, 0.0):                                                                 # thick cable risers, between the pipes
            D.rail(f, (u, vf + sv * 0.1, 0.34), (u, vf + sv * 0.1, 1.0), 0.085, "plate")
        _g("greeble")
        # housing top
        G.scatter(f, "z", 1.03, [("bolts", 0.3, v + sv * 0.58), ("bolts", -0.6, v - sv * 0.58)])
        G.scatter(f, "z", 0.78, [("bolts", -1.95, v)])
        G.scatter(f, "+u", 0.6, [("junction", v - 0.35, 0.5), ("valve", v + 0.3, 0.55)])
        _g("bell")
        bell(f, v, hot, glow)
        _g("pipe")
        # --- pipes along the outer side, into the hull ---------------------------------------------------------
        vo = sv * 1.93                                       # standoff: touches the housing face, ends in flanges
        D.pipe(f, [(-2.2, vo, 0.2), (1.3, vo, 0.2)], 0.1, "gm")
        D.flange(f, (1.32, vo, 0.2), "u", 0.15, "steelL", t=0.08)
        D.pipe(f, [(-2.3, vo, 1.15), (-0.4, vo, 1.15)], 0.09, "plate")
        D.flange(f, (-0.38, vo, 1.15), "u", 0.14, "steelL", t=0.08)
    # --- central spine ---------------------------------------------------------------------------------------
    _g("deck")
    f.box(-0.2, 0, 0.08, 3.4, 0.3, 0.18, "steelD", top="steel")
    _g("pipe")
    D.conduit_bundle(f, (-2.3, 0, 0.5), (1.5, 0, 0.5), n=3, pitch=0.16, r=0.07, across="z", clamps=4)
    D.pipe(f, [(-2.3, 0, 0.95), (-1.6, 0, 0.95), (-1.6, 0, 1.6), (0.9, 0, 1.6)], 0.09, "gm")
    for u in (-1.9, -0.9, 0.1, 1.0):
        D.bracket(f, u, 0, 0.08, 0.5)


def engine4x5(rot, hot, part="machine_cut"):
    """part: machine_cut (whole machine, for the low cutaway hull), machine_full (machine with the full-height hull
    section as a Cycles holdout, so the bells and housing are cut away behind the wall), hull_full, hull_cut, or
    cell (hull_full + whole machine, for the Blender review render)."""
    if part.startswith("hull"):
        f = Frame(core.Mesh("tmp"), rot, centre=CENTRE[rot])
        return hull_section(f, rot, part == "hull_full")
    m = core.Mesh(f"engine45_{rot}_{int(hot)}_{part}")
    f = Frame(m, rot, centre=CENTRE[rot])
    hold = hull_section(f, rot, True, holdout=True) if part == "machine_full" else []
    machine(f, rot, hot)
    ob = m.build()
    if part == "cell":
        return hull_section(f, rot, True) + [ob]
    return [ob]
