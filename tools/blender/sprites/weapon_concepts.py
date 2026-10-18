"""WEAPON CONCEPTS v3: three different directions, all with ROUND barrels, clean military sci-fi (no brass, bolts, valves, exposed
pipes; those are engine-only). Not wired into the game.

  A  naval gun-house: armoured stacked-profile dome on a barbette ring, long barrels with cooling sleeves and slotted muzzle brakes.
  B  open gimbal (PDC-like): exposed rounded yoke pillars, a cylindrical cannon body, recoil sleeve, barrel cluster / coil shroud.
  C  sleek pod: a capsule (teardrop) turret on a swivel ring, round barrels recessed in a nose collar, glow stripes.

Frame: cmbkit.Frame(rot=1, square=True): u = +x = aim at yaw 0, v = +y, origin = footprint centre at floor level. Bays sit directly on
the floor (no slab/plinth) and end in a mount column to the roof plane ZR; turrets are built from z0 = ZR and yawed by `rotate`.
`build(kind, hot, k)`: kind = "<A|B|C>:<turret_laser|turret_driver|bay_driver|cell_driver>"."""
import math
from . import core, cmbkit, roofs, walls
from .cmbkit import Frame

ZR = roofs.ZR
assert abs(ZR - walls.HF) < 1e-6


def _g(name):
    if cmbkit.REC is not None:
        cmbkit.REC.group = name


def rotate(ob, k):
    import bpy
    ob.rotation_euler.z = -k * math.pi / 4
    bpy.context.view_layer.update()
    return ob


def glow(hot, col):
    return col if hot else "dark"


def dome(f, u, v, z, r, h, col, top, steps=4, sides=20):
    """Rounded dome from stacked frusta following a quarter-ellipse profile (r wide, h tall)."""
    for i in range(steps):
        a0, a1 = i / steps * math.pi / 2, (i + 1) / steps * math.pi / 2
        f.vcyl(u, v, z + h * math.sin(a0), r * math.cos(a0), h * (math.sin(a1) - math.sin(a0)), col, top=top if i == steps - 1 else col,
               rtop=r * math.cos(a1) if i < steps - 1 else r * math.cos(a1) + 0.001, sides=sides)


def capsule(f, u0, u1, v, zc, r, col, nose, tail, r_nose, r_tail, steps=4, cap="steelL", sides=16):
    """Teardrop pod along u: tail cone, cylinder, ogive nose built from frusta (nose and tail are lengths)."""
    um0, um1 = u0 + tail, u1 - nose
    for i in range(steps):
        a, b = i / steps, (i + 1) / steps
        ra, rb = r_tail + (r - r_tail) * math.sin(a * math.pi / 2), r_tail + (r - r_tail) * math.sin(b * math.pi / 2)
        f.hcyl(u0 + tail * a, u0 + tail * b, v, zc, ra, col, r1=rb, sides=sides, capstart=cap if i == 0 else None)
    f.hcyl(um0, um1, v, zc, r, col, sides=sides)
    for i in range(steps):
        a, b = i / steps, (i + 1) / steps
        ra, rb = r_nose + (r - r_nose) * math.cos(a * math.pi / 2), r_nose + (r - r_nose) * math.cos(b * math.pi / 2)
        f.hcyl(um1 + nose * a, um1 + nose * b, v, zc, ra, col, r1=rb, sides=sides, cap=cap if i == steps - 1 else None)


def ring(f, u0, u1, v, z, r, col, sides=16, cap=None):
    f.hcyl(u0, u1, v, z, r, col, sides=sides, cap=cap, capstart=cap)


def column(f, z0, rs, hot, col, rings=(0.45, 0.62), u=0.0):
    """Mount column from z0 up to the roof plane."""
    _g("column")
    f.vcyl(u, 0, z0, rs + 0.07, 0.06, "steelL", top="steel", sides=16)
    top = ZR - 0.08
    f.vcyl(u, 0, z0 + 0.06, rs, top - z0 - 0.06, "gm", sides=16)
    for z in rings:
        f.vcyl(u, 0, z, rs + 0.03, 0.05, glow(hot, col) if hot else "gmD", sides=16)
    f.vcyl(u, 0, top, rs + 0.1, 0.08, "steelL", top="steel", sides=16)


def muzzle(f, u0, u1, v, z, r, hot, col, slots=3):
    """Round muzzle brake: fat cylinder with dark slot rings and an emissive tip."""
    ring(f, u0, u1, v, z, r, "steelL", cap="dark")
    ring(f, u1, u1 + 0.03, v, z, r * 0.55, glow(hot, col), cap=glow(hot, col))
    for i in range(slots):
        us = u0 + (i + 0.7) * (u1 - u0) / (slots + 0.4)
        ring(f, us, us + 0.05, v, z, r + 0.012, "dark")


# ================================ A: naval gun-house =================================================================

def tur_A_laser(f, hot):
    z0, cy = ZR, "cyan"
    _g("base")
    f.vcyl(0, 0, z0, 0.95, 0.08, "steelD", top="steel", sides=24)
    f.vcyl(0, 0, z0 + 0.08, 0.9, 0.04, glow(hot, cy), sides=24)
    _g("dome")
    dome(f, -0.12, 0, z0 + 0.12, 0.84, 0.62, "gm", "steelL", steps=4, sides=24)
    f.vcyl(-0.12, 0, z0 + 0.12, 0.87, 0.07, "steel", sides=24)
    _g("cupola")
    f.vcyl(-0.35, 0, z0 + 0.7, 0.24, 0.1, "steelL", top="plate", rtop=0.2, sides=16)
    f.vcyl(-0.35, 0, z0 + 0.8, 0.12, 0.03, glow(hot, cy), sides=12)
    _g("mantlet")
    ring(f, 0.35, 0.95, 0, z0 + 0.54, 0.38, "steel", cap="steelL")
    _g("barrel")
    for v, dz in ((-0.19, -0.1), (0.19, -0.1), (0.0, 0.14)):
        zc = z0 + 0.54 + dz
        ring(f, 0.9, 1.7, v, zc, 0.1, "gmD")
        ring(f, 0.9, 1.3, v, zc, 0.15, "plate", cap="steelL")
        ring(f, 1.2, 1.26, v, zc, 0.162, glow(hot, cy))
        muzzle(f, 1.5, 1.78, v, zc, 0.14, hot, cy, 2)


def tur_A_driver(f, hot):
    z0, cy = ZR, "orange"
    _g("base")
    f.vcyl(0, 0, z0, 1.4, 0.1, "steelD", top="steel", sides=28)
    f.vcyl(0, 0, z0 + 0.1, 1.33, 0.05, glow(hot, cy), sides=28)
    _g("dome")
    dome(f, -0.2, 0, z0 + 0.15, 1.25, 0.85, "gm", "steelL", steps=5, sides=28)
    f.vcyl(-0.2, 0, z0 + 0.15, 1.28, 0.08, "steel", sides=28)
    _g("cupola")
    for sv in (-1, 1):
        f.vcyl(-0.65, sv * 0.5, z0 + 0.95, 0.28, 0.1, "steelL", top="plate", rtop=0.23, sides=16)
        f.vcyl(-0.65, sv * 0.5, z0 + 1.05, 0.14, 0.03, glow(hot, cy), sides=12)
    _g("mantlet")
    ring(f, 0.55, 1.4, 0, z0 + 0.82, 0.56, "steel", cap="steelL")
    _g("barrel")
    zc = z0 + 0.82
    ring(f, 1.3, 3.5, 0, zc, 0.2, "gmD")
    ring(f, 1.3, 2.7, 0, zc, 0.3, "plate", cap="steelL")
    for u in (1.7, 2.05, 2.4):
        ring(f, u, u + 0.07, 0, zc, 0.33, "steelL")
    ring(f, 2.25, 2.35, 0, zc, 0.315, glow(hot, cy))
    ring(f, 2.7, 3.0, 0, zc, 0.25, "steel")
    muzzle(f, 3.0, 3.6, 0, zc, 0.32, hot, cy, 3)


def bay_A_driver(f, hot):
    cy = "orange"
    _g("saddle")
    for u in (0.1, 0.95):
        f.vcyl(u, 0, 0, 0.3, 0.4, "gmD", top="steel", sides=20)
    _g("breech")
    ring(f, -0.15, 1.35, 0, 0.62, 0.42, "gm", cap="steelL", sides=20)
    ring(f, 0.6, 0.68, 0, 0.62, 0.47, glow(hot, cy), sides=20)
    ring(f, 0.0, 0.1, 0, 0.62, 0.47, "steelL", sides=20)
    ring(f, 1.2, 1.26, 0, 0.62, 0.47, "steelL", sides=20)
    _g("ammo")
    for sv in (-1, 1):
        f.vcyl(-1.15, sv * 0.88, 0, 0.33, 0.78, "gm", top="steelL", sides=20)
        f.vcyl(-1.15, sv * 0.88, 0.45, 0.36, 0.05, glow(hot, cy), sides=20)
    column(f, 0.0, 0.4, hot, cy, rings=(0.9, 1.0), u=-0.65)


# ================================ B: open gimbal =====================================================================

def _yoke(f, z0, rpil, hpil, vpil, u, col="gm"):
    _g("yoke")
    for sv in (-1, 1):
        f.vcyl(u, sv * vpil, z0, rpil, hpil, col, top="steelL", sides=20)
        f.vcyl(u, sv * vpil, z0 + hpil - 0.12, rpil + 0.03, 0.04, "steel", sides=20)


def tur_B_laser(f, hot):
    z0, cy = ZR, "cyan"
    _g("base")
    f.vcyl(0, 0, z0, 0.62, 0.14, "steelD", top="steel", sides=20)
    f.vcyl(0, 0, z0 + 0.14, 0.66, 0.04, glow(hot, cy), sides=20)
    f.vcyl(0, 0, z0 + 0.18, 0.5, 0.1, "gmD", top="steel", sides=20)
    _yoke(f, z0 + 0.18, 0.3, 0.72, 0.62, 0.0)
    zc = z0 + 0.62
    _g("body")
    ring(f, -0.85, 0.55, 0, zc, 0.31, "gm", cap="steelL")
    ring(f, -0.2, -0.12, 0, zc, 0.34, glow(hot, cy))
    f.vcyl(-0.55, 0, zc + 0.25, 0.22, 0.16, "steelL", top="plate", sides=16)
    f.vcyl(-0.55, 0, zc + 0.41, 0.13, 0.03, glow(hot, cy), sides=12)
    _g("barrel")
    ring(f, 0.5, 1.15, 0, zc, 0.23, "plate", cap="steel")
    for v, dz in ((-0.14, -0.08), (0.14, -0.08), (0.0, 0.12)):
        ring(f, 1.0, 1.9, v, zc + dz, 0.075, "gmD")
        ring(f, 1.0, 1.3, v, zc + dz, 0.1, "steelL")
        ring(f, 1.75, 1.95, v, zc + dz, 0.11, "steel", cap=glow(hot, cy))
    ring(f, 1.45, 1.55, 0, zc, 0.24, "steelL")


def tur_B_driver(f, hot):
    z0, cy = ZR, "orange"
    _g("base")
    f.vcyl(0, 0, z0, 0.95, 0.16, "steelD", top="steel", sides=24)
    f.vcyl(0, 0, z0 + 0.16, 1.0, 0.05, glow(hot, cy), sides=24)
    f.vcyl(0, 0, z0 + 0.21, 0.78, 0.12, "gmD", top="steel", sides=24)
    _yoke(f, z0 + 0.21, 0.42, 0.9, 0.95, 0.0)
    zc = z0 + 0.8
    _g("body")
    ring(f, -1.2, 0.8, 0, zc, 0.46, "gm", cap="steelL", sides=20)
    ring(f, -0.4, -0.3, 0, zc, 0.5, glow(hot, cy), sides=20)
    ring(f, -1.0, -0.9, 0, zc, 0.5, "steelL", sides=20)
    f.vcyl(-0.85, 0, zc + 0.35, 0.3, 0.2, "steelL", top="plate", sides=20)
    f.vcyl(-0.85, 0, zc + 0.55, 0.17, 0.03, glow(hot, cy), sides=16)
    _g("barrel")
    ring(f, 0.8, 1.9, 0, zc, 0.54, "plate", cap="steel", sides=20)
    ring(f, 1.85, 3.5, 0, zc, 0.4, "gmD", sides=20)
    for i, u in enumerate((2.0, 2.4, 2.8)):
        ring(f, u, u + 0.14, 0, zc, 0.47, "steelL", sides=20)
        ring(f, u + 0.19, u + 0.24, 0, zc, 0.43, glow(hot, cy), sides=20)
    for sv in (-1, 1):
        ring(f, 3.2, 3.9, sv * 0.17, zc, 0.12, "steelL", cap=glow(hot, cy))
    ring(f, 3.15, 3.35, 0, zc, 0.44, "steel", sides=20)


def bay_B_driver(f, hot):
    cy = "orange"
    _g("cradle")
    for sv in (-1, 1):
        f.box(0.2, sv * 0.5, 0, 1.0, 0.18, 0.55, "gmD", top="steel")
    _g("breech")
    ring(f, -1.2, 1.1, 0, 0.62, 0.42, "gm", cap="steelL", sides=20)
    ring(f, 0.4, 0.5, 0, 0.62, 0.46, glow(hot, cy), sides=20)
    ring(f, 1.1, 1.4, 0, 0.62, 0.25, "plate", cap=glow(hot, cy), sides=16)
    _g("ammo")
    f.vcyl(-0.85, 1.0, 0, 0.5, 0.55, "gm", top="steelL", sides=20)
    f.vcyl(-0.85, 1.0, 0.45, 0.53, 0.05, glow(hot, cy), sides=20)
    f.vcyl(-0.85, -1.0, 0, 0.5, 0.55, "gm", top="steelL", sides=20)
    f.vcyl(-0.85, -1.0, 0.45, 0.53, 0.05, glow(hot, cy), sides=20)
    column(f, 1.04, 0.38, hot, cy, rings=(1.15,))


# ================================ C: sleek pod =======================================================================

def _skirt(f, z0, su, sv, hot, col):
    _g("base")
    f.vcyl(0, 0, z0, su, 0.1, "steelD", top="steel", sides=24)
    f.vcyl(0, 0, z0 + 0.1, su - 0.02, 0.03, glow(hot, col), sides=24)
    f.vcyl(0, 0, z0 + 0.1, su - 0.1, 0.04, "steel", top="steelL", sides=24)


def tur_C_laser(f, hot):
    z0, cy = ZR, "cyan"
    _skirt(f, z0, 0.78, 0.78, hot, cy)
    zc, r = z0 + 0.7, 0.58
    _g("pod")
    capsule(f, -1.05, 1.0, 0, zc, r, "gm", 0.75, 0.45, 0.36, 0.34)
    for sv in (-1, 1):
        f.box(0.0, sv * (r - 0.02), zc - 0.06, 1.2, 0.07, 0.1, glow(hot, cy), base=False)
        f.box(0.0, sv * (r - 0.1), zc - 0.35, 0.9, 0.06, 0.1, "steelL", base=False)
    ring(f, -0.35, -0.25, 0, zc, r + 0.015, "steelL")
    ring(f, 0.2, 0.26, 0, zc, r + 0.015, "steelL")
    _g("nose")
    ring(f, 0.95, 1.12, 0, zc, 0.36, "steel", cap="dark")
    ring(f, 1.08, 1.13, 0, zc, 0.38, glow(hot, cy))
    _g("barrel")
    for v, dz in ((-0.17, -0.1), (0.17, -0.1), (0.0, 0.14)):
        ring(f, 1.0, 1.55, v, zc + dz, 0.085, "gmD")
        ring(f, 1.35, 1.6, v, zc + dz, 0.115, "steelL", cap=glow(hot, cy))


def tur_C_driver(f, hot):
    z0, cy = ZR, "orange"
    _skirt(f, z0, 1.15, 1.15, hot, cy)
    zc, r = z0 + 0.95, 0.82
    _g("pod")
    capsule(f, -1.55, 1.35, 0, zc, r, "gm", 1.0, 0.7, 0.5, 0.45)
    for sv in (-1, 1):
        f.box(0.1, sv * (r - 0.02), zc - 0.08, 1.8, 0.08, 0.14, glow(hot, cy), base=False)
        f.box(0.1, sv * (r - 0.12), zc - 0.5, 1.4, 0.07, 0.14, "steelL", base=False)
    ring(f, -0.6, -0.5, 0, zc, r + 0.015, "steelL")
    ring(f, 0.2, 0.28, 0, zc, r + 0.015, "steelL")
    _g("nose")
    ring(f, 1.3, 2.3, 0, zc, 0.5, "gmD", cap="dark")
    ring(f, 1.45, 1.53, 0, zc, 0.53, glow(hot, cy))
    ring(f, 1.9, 1.98, 0, zc, 0.53, glow(hot, cy))
    ring(f, 2.2, 2.33, 0, zc, 0.54, "steelL")
    _g("barrel")
    for sv in (-1, 1):
        ring(f, 1.4, 3.2, sv * 0.2, zc, 0.15, "plate")
        ring(f, 2.6, 3.3, sv * 0.2, zc, 0.17, "steelL", cap=glow(hot, cy))


def bay_C_driver(f, hot):
    cy = "orange"
    _g("pod")
    capsule(f, -1.3, 1.3, 0, 0.62, 0.55, "gm", 0.7, 0.5, 0.35, 0.3)
    for sv in (-1, 1):
        f.box(0.0, sv * 0.53, 0.58, 1.3, 0.07, 0.1, glow(hot, cy), base=False)
    ring(f, -0.2, -0.12, 0, 0.62, 0.57, "steelL")
    _g("ammo")
    for sv in (-1, 1):
        capsule(f, -1.2, 0.4, sv * 1.05, 0.34, 0.3, "steelL", 0.35, 0.25, 0.2, 0.2, steps=3, cap="steel")
        f.box(-0.4, sv * 1.05, 0.52, 0.9, 0.06, 0.06, glow(hot, cy), base=False)
    column(f, 1.17, 0.36, hot, cy, rings=(1.3,))


FNS = {"A": (tur_A_laser, tur_A_driver, bay_A_driver), "B": (tur_B_laser, tur_B_driver, bay_B_driver),
       "C": (tur_C_laser, tur_C_driver, bay_C_driver)}
PARTS = {"turret_laser": 0, "turret_driver": 1, "bay_driver": 2}


def _wrap(name, fn, hot, k=None):
    m = core.Mesh(name)
    fn(Frame(m, 1, square=True), hot)
    ob = m.build()
    return [rotate(ob, k)] if k is not None else [ob]


def build(kind, hot=False, k=0):
    d, part = kind.split(":")
    if part == "cell_driver":
        return _wrap(f"{d}_cb", FNS[d][2], hot) + _wrap(f"{d}_ct", FNS[d][1], hot, k)
    return _wrap(f"{d}_{part}_{k}", FNS[d][PARTS[part]], hot, k if part.startswith("turret") else None)
