"""STYLE PROTOTYPE v2 (clean military sci-fi, no brass/pipes/greebles; those are engine-only): two-part weapons (floor bay + roof turret). Not wired into the game.

Local frame (cmbkit.Frame, rot=1, square): u = +x = the turret aim direction at yaw 0, v = +y, origin = footprint centre at
floor level. The bay (deck, breech, ammo/power feed, crew service pad) fills the footprint (2x2 light, 3x3 heavy) and ends
in a mount/elevator column that tops out at the roof plane ZR. The turret is built on that plane (z0 = ZR) and is then
yawed in 45 degree steps (`rotate`). ZR is the roof plating height of roofs.py, which is the full-height wall top
(walls.HF): the turret base ring sits flush on the roof plane, measured from wall-top height, not from a guess."""
import math
from . import core, cmbkit, roofs, walls
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


def _glow(f, u, v, z, su, sv, sz, hot, col):
    """Emissive strip: lit in the weapon colour when charged, dark slot when idle."""
    f.box(u, v, z, su, sv, sz, col if hot else "dark")


def _seam(f, u, v, z, su, sv):
    """Panel seam: a thin dark groove laid on a top face at height z."""
    f.box(u, v, z, su, sv, 0.015, "dark")


def _column(f, z0, rs, rc, rings, col, hot):
    """Smooth mount/elevator column from z0 up to ZR: collar, shaft with emissive ring bands, flange flush at ZR."""
    _g("column")
    f.vcyl(0, 0, z0, rc, 0.06, "steelL", top="steel", sides=16)
    top = ZR - 0.08
    f.vcyl(0, 0, z0 + 0.06, rs, top - z0 - 0.06, "gm", sides=16)
    for z in rings:
        f.vcyl(0, 0, z, rs + 0.03, 0.05, col if hot else "gmD", sides=16)
    f.vcyl(0, 0, top, rc + 0.02, 0.08, "steelL", top="steel", sides=16)


def _hazard_pad(f, u, v0, v1, z, step=0.14, w=0.14):
    _g("deck")
    n = int(round((v1 - v0) / step))
    for k in range(n):
        f.box(u, v0 + (k + 0.5) * step, z, w, step, 0.02, "hazY" if k % 2 == 0 else "hazK")


# ---- burst laser (light, 2x2): cyan -------------------------------------------------------------------------------------

def bay_laser(f, hot=False):
    cy = "cyan"
    _g("deck")
    f.box(0, 0, 0, 2.0, 2.0, 0.08, "steelD", top="plateA")
    _hazard_pad(f, 0.85, -0.42, 0.42, 0.08)
    _g("plinth")
    f.box(0, 0, 0.08, 1.3, 1.7, 0.2, "steelD", top="steel")
    _glow(f, 0.66, 0, 0.14, 0.03, 0.7, 0.05, hot, cy)                                  # autoloader slot on the front
    for sv in (-1, 1):
        _glow(f, 0, sv * 0.86, 0.15, 0.9, 0.03, 0.05, hot, cy)
    _g("body")
    f.box(0, 0, 0.28, 1.2, 1.4, 0.3, "gm", top="steelL", taper=0.86)
    for sv in (-1, 1):
        _seam(f, 0, sv * 0.3, 0.58, 0.9, 0.04)
    _g("column")
    _column(f, 0.58, 0.27, 0.34, (0.8, 0.95), cy, hot)
    _g("cap")
    for sv in (-1, 1):                                                                 # capacitor cylinders, smooth
        f.vcyl(-0.82, sv * 0.45, 0.08, 0.17, 0.55, "gm", top="steelL", sides=16)
        f.vcyl(-0.82, sv * 0.45, 0.4, 0.2, 0.05, cy if hot else "gmD", sides=16)
        f.vcyl(-0.82, sv * 0.45, 0.63, 0.12, 0.03, cy if hot else "dark", sides=16)
    _g("pod")
    for sv in (-1, 1):                                                                 # side loader pods
        f.box(0.1, sv * 0.9, 0.08, 0.9, 0.2, 0.4, "steelL", top="steel", taper=0.85)
        _glow(f, 0.1, sv * 0.9, 0.3, 0.6, 0.12, 0.03, hot, cy)


def turret_laser(f, hot=False):
    z0 = ZR
    cy = "cyan"
    _g("base")
    f.vcyl(0, 0, z0, 0.85, 0.07, "steelD", top="steel", sides=20)
    f.vcyl(0, 0, z0 + 0.07, 0.8, 0.03, cy if hot else "dark", sides=20)
    f.vcyl(0, 0, z0 + 0.1, 0.7, 0.1, "gm", top="steelL", sides=20)
    _g("head")
    f.box(0.05, 0, z0 + 0.2, 1.2, 1.3, 0.34, "gm", top="steelL", taper=0.8)
    f.box(0.0, 0, z0 + 0.54, 0.9, 0.9, 0.09, "steelL", top="steel", taper=0.78)
    for sv in (-1, 1):
        _seam(f, 0.0, sv * 0.2, z0 + 0.63, 0.6, 0.04)
    f.box(-0.55, 0, z0 + 0.2, 0.5, 1.1, 0.3, "gmD", top="gm", taper=0.84)
    for sv in (-1, 1):                                                                 # armoured side cheeks
        f.box(0.1, sv * 0.68, z0 + 0.2, 0.8, 0.14, 0.3, "steelD", top="gm", taper=0.9, tv=0.7)
        _glow(f, 0.1, sv * 0.755, z0 + 0.33, 0.55, 0.03, 0.05, hot, cy)
    _g("yoke")
    f.box(0.88, 0, z0 + 0.2, 0.1, 1.0, 0.3, "steelD", top="gm")
    _g("barrel")
    for v in (-0.34, 0.0, 0.34):
        zc = z0 + 0.35
        f.hcyl(0.6, 1.5, v, zc, 0.12, "gmD", sides=10)
        f.hcyl(0.7, 1.0, v, zc, 0.16, "steel", sides=10, cap="steel", capstart="steel")
        f.hcyl(1.25, 1.36, v, zc, 0.15, "steelL", sides=10, cap="steelL", capstart="steelL")
        f.hcyl(1.5, 1.56, v, zc, 0.1, "dark", sides=10, cap=cy if hot else "dark")
        _glow(f, 1.08, v, zc + 0.125, 0.3, 0.04, 0.03, hot, cy)
    f.box(1.62, 0, z0 + 0.35, 0.04, 0.9, 0.1, "arc", base=False) if hot else None


# ---- mass driver (heavy, 3x3): orange rails -------------------------------------------------------------------------------

def bay_driver(f, hot=False):
    cy = "orange"
    _g("deck")
    f.box(0, 0, 0, 3.0, 3.0, 0.08, "steelD", top="plateA")
    _hazard_pad(f, 1.2, -0.7, 0.7, 0.08)
    _g("plinth")
    f.box(0, 0, 0.08, 1.8, 2.4, 0.25, "steelD", top="steel")
    _glow(f, 0.91, 0, 0.17, 0.03, 1.2, 0.06, hot, cy)
    for sv in (-1, 1):
        _glow(f, 0, sv * 1.21, 0.2, 1.3, 0.03, 0.06, hot, cy)
    _g("body")
    f.box(0, 0, 0.33, 1.6, 2.0, 0.4, "gm", top="steelL", taper=0.88)
    for u in (-0.45, 0.0, 0.45):
        _seam(f, u, 0, 0.73, 0.04, 1.5)
    _g("column")
    _column(f, 0.73, 0.46, 0.6, (0.9, 1.0), cy, hot)
    _g("cap")
    for sv in (-1, 1):
        f.vcyl(-1.17, sv * 0.6, 0.08, 0.27, 0.8, "gm", top="steelL", sides=16)
        f.vcyl(-1.17, sv * 0.6, 0.45, 0.3, 0.06, cy if hot else "gmD", sides=16)
        f.vcyl(-1.17, sv * 0.6, 0.88, 0.17, 0.03, cy if hot else "dark", sides=16)
    _g("pod")
    for sv in (-1, 1):
        f.box(0.1, sv * 1.33, 0.08, 1.4, 0.3, 0.5, "steelL", top="steel", taper=0.88)
        _glow(f, 0.1, sv * 1.33, 0.3, 1.0, 0.2, 0.04, hot, cy)


def turret_driver(f, hot=False):
    z0 = ZR
    cy = "orange"
    _g("base")
    f.vcyl(0, 0, z0, 1.25, 0.08, "dark", top="steelD", sides=24)
    f.vcyl(0, 0, z0 + 0.08, 1.17, 0.03, cy if hot else "dark", sides=24)
    f.vcyl(0, 0, z0 + 0.11, 1.05, 0.12, "gmD", top="steelD", sides=24)
    _g("head")
    f.box(-0.1, 0, z0 + 0.23, 1.9, 1.9, 0.42, "gmD", top="gm", taper=0.86)
    f.box(-0.15, 0, z0 + 0.65, 1.4, 1.4, 0.14, "steelD", top="gm", taper=0.8)
    for sv in (-1, 1):
        _seam(f, -0.15, sv * 0.2, z0 + 0.79, 1.0, 0.04)
    for sv in (-1, 1):
        _glow(f, 0.3, sv * 0.35, z0 + 0.79, 0.5, 0.06, 0.02, hot, cy)
        f.box(0.0, sv * 1.0, z0 + 0.23, 1.5, 0.14, 0.38, "dark", top="steelD", taper=0.92, tv=0.7)     # armoured skirts
        _glow(f, 0.0, sv * 1.075, z0 + 0.4, 1.0, 0.03, 0.06, hot, cy)
    f.box(-1.15, 0, z0 + 0.23, 0.5, 1.5, 0.36, "dark", top="steelD", taper=0.86)
    _g("cradle")
    f.box(1.0, 0, z0 + 0.25, 0.7, 1.3, 0.42, "steelD", top="gm")
    _g("rail")
    for sv in (-1, 1):
        f.box(1.65, sv * 0.38, z0 + 0.3, 1.9, 0.34, 0.4, "gmD", top="steel")
        _glow(f, 1.7, sv * 0.38, z0 + 0.7, 1.7, 0.1, 0.02, hot, cy)
        _glow(f, 1.7, sv * 0.2, z0 + 0.5, 1.7, 0.03, 0.08, hot, cy)
        for u in (1.15, 1.55, 1.95):
            _seam(f, u, sv * 0.38, z0 + 0.7 + 0.02, 0.05, 0.34)
        f.box(2.5, sv * 0.38, z0 + 0.27, 0.3, 0.44, 0.5, "dark", top="steelD", taper=0.85)
        f.box(2.66, sv * 0.38, z0 + 0.5, 0.02, 0.26, 0.2, "flameW" if hot else "dark")
    f.box(1.7, 0, z0 + 0.42, 0.3, 0.42, 0.2, "steelD", top="gm")


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
