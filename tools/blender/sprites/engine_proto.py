"""STYLE PROTOTYPE v6: single-bell 4x5 engine that IS part of the outer hull (4 along the hull, 5 deep). Not wired in.

Local frame: u -2.5..2.5 is the footprint (+u = hull side), v -2..2. The hull row (u 1.5..2.5) is the real hull wall
tiles (walls.py) plus an engine bulkhead on top; the ends butt into neighbouring walls with the wall profile and the one
big bell protrudes from the face into space."""
import math
from . import core, detail as D, greeble as G, walls
from . import cmbkit
from .cmbkit import Frame


def _g(name):
    """Tag the following primitives with a group for overlap.py (no-op unless recording)."""
    if cmbkit.REC is not None:
        cmbkit.REC.group = name


CENTRE = {0: (-1.5, -2.0), 1: (-2.0, -1.5)}     # footprint centre relative to the front-most tile centre
BZ = 1.4                                         # bell axis height
UH = 2.0                                         # hull row centre (u)


def bulkhead(g, full=True):
    """Engine bulkhead on the hull row, wrapping ONE big bell: a heavy slab across the whole hull side, armoured pylons
    at the ends (clear of the bell's mount collar), ribbed plating, the bell-mount collar with bolts and a flush end
    cheek. Full mode rises above wall height (3.0); cut mode stays low but keeps the layout. Real wall tiles run
    underneath, so the ends (v = +-2) butt into neighbouring walls with the wall profile."""
    hs, hp = (3.25, 3.85) if full else (0.58, 0.9)
    _g("bulkhead")
    g.box(2.02, 0, 0, 0.96, 3.9, hs, "steel", top="plate")
    D.trim(g, 2.02, 0, hs, 0.96, 3.9, "plate")
    _g("pylon")
    for vv in (-1.7, 1.7):                                                      # armoured pylons beside the collar
        g.box(2.0, vv, hs, 0.74, 0.3, hp - hs, "steelL", top="plate")
        D.trim(g, 2.0, vv, hp, 0.74, 0.3, "plate", w=0.05)
    _g("bulkhead")
    for vv in (-1.9, -1.45, 1.45, 1.9):                                         # ribbed seams on the outer face
        g.box(2.53, vv, 0.05, 0.07, 0.1, hs - 0.1, "plate")
    for sv in (-1, 1):
        for zz in ((0.45, 0.95, 1.45, 1.95, 2.45, 2.95) if full else (0.3,)):
            g.box(2.53, sv * 1.68, zz, 0.07, 0.62, 0.08, "steelD")
        for vv in (1.45, 1.9):                                                  # ribs across the slab top, outside the neck
            g.box(2.02, sv * vv, hs, 0.8, 0.07, 0.05, "plate")
    _g("collar")
    D.annulus(g, 2.5, 2.64, 0, BZ, 1.3, 0.75, "steelL", "plate", sides=20)       # bell-mount plate
    for k in range(12):
        ang = k * math.tau / 12 + 0.1
        c, s_ = math.cos(ang), math.sin(ang)
        D.seg(g, (2.64, 1.12 * c, BZ + 1.12 * s_), (2.71, 1.12 * c, BZ + 1.12 * s_), 0.05, "plate", 6)
    _g("greeble")
    D.panel(g, 1.85, 1.95, 0.45 if full else 0.28, 0.55, 0.38 if full else 0.3, "blueGrey", face="+v")
    if full:                                                                    # greebles only where nothing covers them
        G.scatter(g, "z", hs, [("junction", 2.0, 1.0), ("bolts", 2.15, -1.0)])
        for vv in (-1.7, 1.7):
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


def bell(f, hot, glow):
    """ONE big solid segmented nozzle (mouth ~2.6 tiles across): chamber throat cone, neck through the bulkhead, mount
    flange, closed shell of chunky ring segments with deep grooves and longitudinal ribs, thick lip, dark open interior
    (idle) or glowing core and plume (active)."""
    f.hcyl(1.05, 1.5, 0, BZ, 0.7, "gm", r1=0.62, sides=16)                                  # throat cone
    f.hcyl(1.5, 2.45, 0, BZ, 0.62, "gm", r1=0.72, sides=16)                                 # neck through the bulkhead
    D.ribs(f, 1.65, 2.35, 0, BZ, 0.62, 0.72, 2, thick=0.14, grow=0.08, mat="plate", sides=16)
    f.hcyl(2.45, 2.8, 0, BZ, 1.05, "steelL", sides=16, cap="plate")                         # mount flange, inside the collar
    ro = lambda u: 0.98 + (u - 2.8) / 1.5 * 0.38                                            # noqa: E731
    f.hcyl(2.8, 4.3, 0, BZ, 0.5, "dark", r1=0.9, sides=16)                                  # dark liner seen through the mouth
    f.hcyl(2.8, 4.3, 0, BZ, ro(2.8) - 0.05, "steelD", r1=ro(4.3) - 0.05, sides=20)           # continuous under-shell: grooves are recesses, never gaps
    n = 5
    for k in range(n):                                                                       # five clean segments, deep grooves
        u0, u1 = 2.8 + 1.5 * k / n, 2.8 + 1.5 * (k + 1) / n
        f.hcyl(u0, u1 - 0.1, 0, BZ, ro(u0) + 0.03, "gm", r1=ro(u1 - 0.1) + 0.03, sides=20)
        f.hcyl(u1 - 0.1, u1, 0, BZ, ro(u1) - 0.08, "steelD", sides=20)
    for k in range(8):                                                                       # longitudinal ribs on the shell
        ang = k * math.tau / 8 + 0.2
        c, s_ = math.cos(ang), math.sin(ang)
        r0_, r1_ = ro(2.9) + 0.06, ro(4.25) + 0.06
        D.rail(f, (2.9, r0_ * c, BZ + r0_ * s_), (4.25, r1_ * c, BZ + r1_ * s_), 0.05, "steelL")
    D.annulus(f, 4.2, 4.42, 0, BZ, ro(4.3) + 0.1, ro(4.3) - 0.22, "plate", "steelL", sides=20)   # thick lip
    f.hcyl(3.4, 3.42, 0, BZ, 0.7, glow, sides=16, cap="arc" if hot else "dark")             # core (dark when idle)
    if hot:
        f.hcyl(4.3, 5.7, 0, BZ, 0.9, "cyan", r1=0.15, sides=14, cap="arc")


def machine(f, rot, hot):
    """Single drive train: horizontal fuel tanks in cradles, a turbopump with propellant manifold, thick feed lines
    into the combustion chamber, all feeding the one bell. Horizontal plumbing, no upright cans."""
    glow = "cyan" if hot else "dark"
    f.m.dz = -0.08                                                                              # no floor slab: sit on the ship floor
    for sv in (-1, 1):
        vt = sv * 1.15
        _g("tank")                                                                              # horizontal tank + cradle
        f.box(-1.5, vt, 0.08, 1.6, 1.1, 0.05, "steelD", top="steel")
        f.hcyl(-2.3, -0.7, vt, 0.62, 0.5, "gm", sides=16, cap="steelL", capstart="steelL")
        for u in (-2.05, -1.5, -0.95):
            D.annulus(f, u - 0.06, u + 0.06, vt, 0.62, 0.57, 0.3, "plate", "plate", sides=16)
        _g("greeble")
        for u in (-1.775, -1.225):                                                               # standing valve wheels on posts
            D.seg(f, (u, vt, 1.14), (u, vt, 1.36), 0.05, "steelL", 8)
            G.valve_wheel(f, "+v", u, 1.36, vt - 0.02, r=0.2)
        _g("pipe")                                                                              # feed line: tank -> manifold
        D.pipe(f, [(-0.55, vt, 0.62), (-0.55, vt, BZ), (-0.55, sv * 0.98, BZ)], 0.12, "gm")
        vo = sv * 1.85                                                                          # coolant run, on brackets
        D.pipe(f, [(-1.9, vo, 0.2), (1.3, vo, 0.2)], 0.1, "gm")
        D.flange(f, (1.32, vo, 0.2), "u", 0.15, "steelL", t=0.08)
        D.flange(f, (-1.88, vo, 0.2), "u", 0.15, "steelL", t=0.08)
        for u in (-1.0, 0.2):
            D.bracket(f, u, vo, 0.08, 0.12)
    _g("pipe")                                                                                  # rear cross-feed between tanks
    D.pipe(f, [(-2.4, -1.15, 0.62), (-2.4, 1.15, 0.62)], 0.1, "gm", flange_every=5)
    _g("housing")                                                                               # chamber cradle + pump gearbox
    f.box(0.525, 0, 0.08, 1.85, 2.0, 0.5, "steelL", top="plate")
    D.trim(f, 0.525, 0, 0.58, 1.85, 2.0, "plate")
    f.box(-1.475, 0, 0.08, 1.45, 1.0, 0.62, "steel", top="plate")
    _g("greeble")
    G.scatter(f, "+v", 1.0, [("valve", 0.0, 0.3), ("hatch", 0.6, 0.3), ("junction", 1.2, 0.3)])
    f.box(-0.3, 1.02, 0.52, 0.1, 0.05, 0.05, "orange" if hot else "gmD", base=False)
    _g("chamber")
    f.hcyl(-2.25, -1.8, 0, BZ, 0.35, "gm", sides=16, cap="steelL", capstart="steelL")             # turbine
    D.drum(f, -1.75, -0.65, 0, BZ, 0.5, n=4, body="steel", rib="plate", sides=16)                # pump casing
    f.hcyl(-0.62, -0.47, 0, BZ, 0.88, "steelL", sides=20, cap="plate", capstart="plate")         # propellant manifold
    for k in range(10):
        ang = k * math.tau / 10 + 0.15
        c, s_ = math.cos(ang), math.sin(ang)
        D.seg(f, (-0.62, 0.8 * c, BZ + 0.8 * s_), (-0.69, 0.8 * c, BZ + 0.8 * s_), 0.045, "plate", 6)
    D.drum(f, -0.45, 1.0, 0, BZ, 0.75, n=6, body="steel", rib="plate", sides=20, rib_t=0.12, grow=0.07)   # combustion chamber
    _g("bell")
    bell(f, hot, glow)


def engine4x5(rot, hot, part="machine"):
    """The engine has ONE hull section, full height in every view mode (neighbouring walls may be cut down beside it).
    part: hull (hull section: wall tiles + bulkhead), machine (everything else, rendered with the hull as a Cycles
    holdout so it is cut away behind the wall; same in every mode), or cell (hull + whole machine, Blender review)."""
    if part == "hull":
        return hull_section(Frame(core.Mesh("tmp"), rot, centre=CENTRE[rot]), rot, True)
    m = core.Mesh(f"engine45_{rot}_{int(hot)}_{part}")
    f = Frame(m, rot, centre=CENTRE[rot])
    if part == "machine":
        hull_section(f, rot, True, holdout=True)
    machine(f, rot, hot)
    ob = m.build()
    if part == "cell":
        return hull_section(f, rot, True) + [ob]
    return [ob]
