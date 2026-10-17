"""STYLE PROTOTYPE: two-part weapons (floor bay + roof turret). Not wired into the game.

Local frame (cmbkit.Frame, rot=1, square): u = +x = the turret aim direction at yaw 0, v = +y, origin = footprint centre at
floor level. The bay (deck, breech, ammo/power feed, crew service pad) fills the footprint (2x2 light, 3x3 heavy) and ends
in a mount/elevator column that tops out at the roof plane ZR. The turret is built on that plane (z0 = ZR) and is then
yawed in 45 degree steps (`rotate`). ZR is the roof plating height of roofs.py, which is the full-height wall top
(walls.HF): the turret base ring sits flush on the roof plane, measured from wall-top height, not from a guess."""
import math
from . import core, cmbkit, detail as D, greeble as G, roofs, walls
from .cmbkit import Frame

ZR = roofs.ZR
assert abs(ZR - walls.HF) < 1e-6, "roof plane must equal the full wall top"


def _g(name):
    if cmbkit.REC is not None:
        cmbkit.REC.group = name


def _frame(name):
    m = core.Mesh(name)
    return m, Frame(m, 1, square=True)


def rotate(ob, k):
    """Aim index k (0..7): yaw k*45 degrees in the grid, +x -> +y (blender space flips y)."""
    import bpy
    ob.rotation_euler.z = -k * math.pi / 4
    bpy.context.view_layer.update()
    return ob


def _bolt_ring(f, n, r, s, br=0.05, mat="plate"):
    for k in range(n):
        a = k * math.tau / n + math.pi / n
        G.disc(f, "z", r * math.cos(a), r * math.sin(a), s, br, 0, 0.05, mat, sides=6)


def _column(f, z0, rs, rc, segs):
    """Mount/elevator column from z0 up to ZR: collar, ribbed shaft with ring bands, top flange flush at the roof plane.
    segs: [(height, radius_key, mat)] bands bottom to top; 'ring' bands are wider."""
    _g("column")
    f.vcyl(0, 0, z0, rc, 0.08, "steelL", top="plate", sides=12)
    z = z0 + 0.08
    for h, kind, mat in segs:
        f.vcyl(0, 0, z, rs + (0.05 if kind == "ring" else 0), h, mat, top="plate" if kind == "ring" else None, sides=12)
        z += h
    top = ZR - 0.08
    f.vcyl(0, 0, top, rc + 0.04, 0.08, "steelL", top="plate", sides=12)              # flange, top face exactly at ZR
    for k in range(4):                                                                 # cable risers
        a = k * math.tau / 4 + math.pi / 4
        D.rail(f, (rs * 1.12 * math.cos(a), rs * 1.12 * math.sin(a), z0 + 0.08), (rs * 1.12 * math.cos(a), rs * 1.12 * math.sin(a), top), 0.045, "plate")
    return z


def _hazard_pad(f, u, v0, v1, z, step=0.14, w=0.14):
    _g("deck")
    n = int(round((v1 - v0) / step))
    for k in range(n):
        f.box(u, v0 + (k + 0.5) * step, z, w, step, 0.02, "hazY" if k % 2 == 0 else "hazK")


# ---- burst laser (light, 2x2) ------------------------------------------------------------------------------------------

def bay_laser(f, hot=False):
    cy = "cyan" if hot else "gmD"
    _g("deck")
    f.box(0, 0, 0, 2.0, 2.0, 0.08, "steelD", top="plateA")
    _hazard_pad(f, 0.8, -0.42, 0.42, 0.08)
    _g("core")
    f.box(0, 0, 0.08, 0.95, 0.9, 0.5, "steelL", top="plate")
    D.trim(f, 0, 0, 0.58, 0.95, 0.9, "plate")
    for sv in (-1, 1):
        f.box(0.1, sv * 0.47, 0.12, 0.5, 0.05, 0.4, "steelD", base=True)               # ribbed side plates
        for k in range(3):
            f.box(-0.12 + k * 0.22, sv * 0.47, 0.13, 0.07, 0.07, 0.38, "plate")
    _g("greeble")
    G.hatch(f, "+u", 0.0, 0.34, 0.475)
    _g("column")
    _column(f, 0.58 + 0.035, 0.25, 0.34, [(0.14, "seg", "gm"), (0.06, "ring", "brass"), (0.12, "seg", "gm"), (0.05, "ring", "steelL"), (0.07, "seg", "gm")])
    _g("cap")
    for sv in (-1, 1):                                                                 # capacitor tanks with glowing bands
        D.tank(f, -0.72, sv * 0.33, 0.08, 0.24, 0.55, mat="gm", cap="plate", bands=2)
        f.vcyl(-0.72, sv * 0.33, 0.5, 0.275, 0.05, cy, sides=10)
        f.vcyl(-0.72, sv * 0.33, 0.62, 0.255, 0.05, "brass", sides=10)
    _g("cap")
    f.vcyl(-0.76, 0.76, 0.08, 0.17, 0.4, "gm", top="plate", sides=10)
    f.vcyl(-0.76, 0.76, 0.3, 0.2, 0.05, "brass", sides=10)
    f.vcyl(-0.76, -0.76, 0.08, 0.17, 0.4, "gm", top="plate", sides=10)
    f.vcyl(-0.76, -0.76, 0.3, 0.2, 0.05, "brass", sides=10)
    _g("pipe")
    for sv in (-1, 1):
        D.pipe(f, [(-0.72, sv * 0.33, 0.25), (-0.43, sv * 0.33, 0.25)], 0.07, "gm")
        D.pipe(f, [(-0.76, sv * 0.76, 0.2), (-0.76, sv * 0.45, 0.2)], 0.07, "gm")
    _g("drum")                                                                         # cell magazine (autoloader), brass bands
    D.drum(f, -0.3, 0.75, 0.72, 0.52, 0.18, n=5, body="gm", rib="brass", sides=12, grow=0.05)
    _g("support")
    for u in (-0.15, 0.5):
        D.bracket(f, u, 0.72, 0.08, 0.36, w=0.22, d=0.12)
    _g("loader")                                                                       # loader housing
    f.box(0.2, -0.65, 0.08, 1.0, 0.42, 0.6, "steelL", top="plate")
    D.trim(f, 0.2, -0.65, 0.68, 1.0, 0.42, "plate")
    _g("greeble")
    G.scatter(f, "-v", -0.86, [("valve", 0.46, 0.36), ("junction", -0.02, 0.38)])
    _g("pipe")
    D.pipe(f, [(0.35, -0.65, 0.3), (0.35, -0.4, 0.3)], 0.06, "gm")
    D.pipe(f, [(-0.1, -0.65, 0.5), (-0.1, -0.4, 0.5)], 0.06, "plate")


def turret_laser(f, hot=False):
    z0 = ZR
    cy = "cyan" if hot else "dark"
    _g("base")
    f.vcyl(0, 0, z0, 0.62, 0.07, "steelD", top="steelL", sides=12)
    _bolt_ring(f, 8, 0.54, z0 + 0.07)
    f.vcyl(0, 0, z0 + 0.07, 0.46, 0.1, "gm", top="plate", sides=12)
    f.vcyl(0, 0, z0 + 0.12, 0.49, 0.04, "brass", sides=12)
    _g("head")
    f.box(0.15, 0, z0 + 0.17, 0.7, 0.72, 0.3, "steelL", top="plate", taper=0.9)
    D.trim(f, 0.15, 0, z0 + 0.47, 0.7 * 0.9, 0.72 * 0.9, "plate", w=0.04)
    f.box(-0.3, 0, z0 + 0.17, 0.36, 0.6, 0.26, "gm", top="plate")                      # rear power pack
    D.fins(f, -0.62, -0.46, 0, z0 + 0.19, 0.5, 0.2, 3, thick=0.06, mat="steelL", top="plate")
    for sv in (-1, 1):                                                                 # side power cheeks with glow strip
        f.box(0.05, sv * 0.4, z0 + 0.19, 0.5, 0.08, 0.22, "gmD", top="gm")
        f.box(0.05, sv * 0.445, z0 + 0.3, 0.4, 0.02, 0.05, cy)
    D.tank(f, -0.3, 0, z0 + 0.43, 0.12, 0.08, mat="gm", cap="plate", bands=0)
    _g("greeble")
    G.valve_wheel(f, "z", 0.28, 0, z0 + 0.47, r=0.11)
    _g("yoke")
    f.box(0.8, 0, z0 + 0.2, 0.08, 0.66, 0.26, "plate", top="steelL")
    _g("barrel")
    for v in (-0.24, 0.0, 0.24):
        zc = z0 + 0.33
        f.hcyl(0.5, 1.12, v, zc, 0.07, "plate", sides=8)
        f.hcyl(0.62, 0.7, v, zc, 0.105, "steelL", sides=8, cap="steelL", capstart="steelL")
        f.hcyl(0.9, 0.98, v, zc, 0.105, "brass", sides=8, cap="brass", capstart="brass")
        f.hcyl(1.1, 1.2, v, zc, 0.1, "gmD", sides=8, cap=cy, capstart="gmD")
        f.box(1.22, v, zc, 0.04, 0.1, 0.1, "arc" if hot else "steelD", base=False)


# ---- mass driver (heavy, 3x3) --------------------------------------------------------------------------------------------

def bay_driver(f, hot=False):
    cy = "orange" if hot else "gmD"
    _g("deck")
    f.box(0, 0, 0, 3.0, 3.0, 0.08, "steelD", top="plateA")
    _hazard_pad(f, 1.2, -0.7, 0.7, 0.08)
    _g("core")
    f.box(0, 0, 0.08, 1.5, 1.4, 0.6, "steelL", top="plate")
    D.trim(f, 0, 0, 0.68, 1.5, 1.4, "plate", w=0.06)
    for sv in (-1, 1):
        for k in range(5):
            f.box(-0.5 + k * 0.25, sv * 0.73, 0.12, 0.09, 0.06, 0.5, "plate")
    _g("greeble")
    G.scatter(f, "+u", 0.75, [("hatch", -0.3, 0.38), ("junction", 0.35, 0.42)])
    _g("column")
    _column(f, 0.68 + 0.035, 0.42, 0.55, [(0.12, "seg", "gm"), (0.06, "ring", "brass"), (0.08, "seg", "gm"), (0.05, "ring", "steelL"), (0.05, "seg", "gm")])
    _g("cap")
    for sv in (-1, 1):
        D.tank(f, -1.15, sv * 0.4, 0.08, 0.27, 0.8, mat="gm", cap="plate", bands=3)
        f.vcyl(-1.15, sv * 0.4, 0.5, 0.31, 0.05, cy, sides=10)
        f.vcyl(-1.15, sv * 0.4, 0.88, 0.285, 0.05, "brass", sides=10)
        f.vcyl(-1.15, sv * 1.1, 0.08, 0.2, 0.55, "gm", top="plate", sides=10)
        f.vcyl(-1.15, sv * 1.1, 0.3, 0.24, 0.05, "brass", sides=10)
    _g("pipe")
    for sv in (-1, 1):
        D.pipe(f, [(-1.15, sv * 0.4, 0.3), (-0.72, sv * 0.4, 0.3)], 0.09, "gm")
        D.pipe(f, [(-1.15, sv * 1.1, 0.2), (-1.15, sv * 0.65, 0.2)], 0.08, "gm")
    _g("drum")                                                                         # slug magazine
    D.drum(f, -0.6, 0.9, -1.05, 0.5, 0.25, n=7, body="gm", rib="brass", sides=12, grow=0.05)
    _g("support")
    for u in (-0.4, 0.15, 0.7):
        D.bracket(f, u, -1.05, 0.08, 0.28, w=0.3, d=0.14)
    _g("loader")
    f.box(0.0, 1.0, 0.08, 1.7, 0.6, 0.72, "steelL", top="plate")
    D.trim(f, 0, 1.0, 0.8, 1.7, 0.6, "plate", w=0.05)
    _g("greeble")
    G.scatter(f, "+v", 1.3, [("valve", -0.45, 0.45), ("junction", 0.3, 0.45)])
    G.hex_cluster(f, "z", 0.55, 1.0, 0.8, n=2, cols=1, pitch=0.2)
    _g("pipe")
    for z in (0.28, 0.55):
        D.pipe(f, [(0.5, 1.0, z), (0.5, 0.65, z)], 0.07, "gm")


def turret_driver(f, hot=False):
    z0 = ZR
    cy = "orange" if hot else "dark"
    _g("base")
    f.vcyl(0, 0, z0, 1.05, 0.08, "steelD", top="steelL", sides=16)
    _bolt_ring(f, 12, 0.93, z0 + 0.08, br=0.06)
    f.vcyl(0, 0, z0 + 0.08, 0.82, 0.12, "gm", top="plate", sides=16)
    f.vcyl(0, 0, z0 + 0.15, 0.86, 0.05, "brass", sides=16)
    _g("head")
    f.box(-0.05, 0, z0 + 0.2, 1.5, 1.5, 0.4, "gm", top="plate")
    f.box(-0.05, 0, z0 + 0.6, 1.5, 1.5, 0.14, "steelL", top="plate", taper=0.72)
    D.trim(f, -0.05, 0, z0 + 0.74, 1.08, 1.08, "plate", w=0.05)
    _g("greeble")
    for s, face in ((0.75, "+v"), (-0.75, "-v")):
        G.scatter(f, face, s, [("valve", -0.4, z0 + 0.4), ("junction", 0.3, z0 + 0.4)])
    G.hatch(f, "-u", 0.0, z0 + 0.4, -0.8)
    D.tank(f, -0.4, 0.3, z0 + 0.74 + 0.035, 0.15, 0.15, mat="gm", cap="plate", bands=1)
    D.tank(f, -0.4, -0.3, z0 + 0.74 + 0.035, 0.15, 0.15, mat="gm", cap="plate", bands=1)
    G.hex_cluster(f, "z", 0.25, 0, z0 + 0.74 + 0.035, n=4, cols=2, pitch=0.2)
    _g("cradle")
    f.box(0.9, 0, z0 + 0.22, 0.6, 1.0, 0.4, "gmD", top="gm")
    _g("rail")
    for sv in (-1, 1):
        f.box(1.55, sv * 0.3, z0 + 0.3, 1.9, 0.26, 0.3, "gm", top="steelL")
        f.box(1.6, sv * 0.3, z0 + 0.6, 1.7, 0.08, 0.03, cy)                            # conductor strip on top
        f.box(1.6, sv * 0.17, z0 + 0.46, 1.7, 0.02, 0.07, cy)                          # inner glow
        for k, u in enumerate((0.95, 1.3, 1.65, 2.0)):                                 # clamps / ribs round the rails
            f.box(u, sv * 0.3, z0 + 0.28, 0.1, 0.34, 0.34, "brass" if k % 2 == 0 else "plate", top="plate")
        f.box(2.5, sv * 0.3, z0 + 0.27, 0.18, 0.36, 0.38, "steelL", top="plate")      # muzzle block
        f.box(2.6, sv * 0.3, z0 + 0.46, 0.02, 0.2, 0.18, "flameW" if hot else "dark")
    for u in (1.15, 1.8):                                                              # braces between the rails
        f.box(u, 0, z0 + 0.34, 0.1, 0.34, 0.14, "steelD", top="gm")


def _wrap(name, fn, hot=False, k=None):
    m, f = _frame(name)
    fn(f, hot)
    ob = m.build()
    return [rotate(ob, k)] if k is not None else [ob]


def build(kind, hot=False, k=0):
    """kind: bay_laser | turret_laser | bay_driver | turret_driver | cell_laser | cell_driver (bay + turret, for the review cell)."""
    fns = {"bay_laser": bay_laser, "turret_laser": turret_laser, "bay_driver": bay_driver, "turret_driver": turret_driver}
    if kind.startswith("cell_"):
        w = kind[5:]
        return _wrap(f"{kind}_b", fns["bay_" + w], hot) + _wrap(f"{kind}_t", fns["turret_" + w], hot, k)
    return _wrap(f"{kind}_{int(hot)}_{k}", fns[kind], hot, k if kind.startswith("turret") else None)
