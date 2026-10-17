"""Hull-mounted combat modules: five weapons and the engine (1x2 footprint, four rotations, idle/charged glow).

Local frame (cmbkit): +u is the hull side (muzzle / nozzle), so the barrel always points at the wall it is mounted on.
Sim rotation r: r0 muzzle -y, r1 +x, r2 +y, r3 -x. `hot` = charged (weapons) or burning (engine): the neon switches from
a dim indicator to full glow. Emissive colours are only used where something should glow."""
import math
from . import core, cmbkit
from .cmbkit import Frame, platform, hazard_strip


def _mesh(name):
    return core.Mesh(name)


def burst_laser(rot, hot):
    m = _mesh(f"burst_laser_{rot}_{int(hot)}")
    f = Frame(m, rot)
    platform(f)
    f.box(-0.5, 0, 0.1, 0.85, 0.8, 0.3, "steel", top="steelL")                         # lower housing
    f.box(-0.52, 0, 0.4, 0.7, 0.58, 0.14, "gm", top="plate", taper=0.82)               # cap
    f.box(0.02, 0, 0.1, 0.36, 0.56, 0.52, "gmD", top="gm")                             # barrel block
    f.box(0.02, 0, 0.62, 0.24, 0.5, 0.05, "steelL")                                    # block top plate
    for v, ln in ((-0.2, 0.85), (0.0, 1.0), (0.2, 0.85)):                              # triple short barrels
        f.hcyl(0.18, 0.18 + ln, v, 0.45, 0.075, "plate")
        f.hcyl(0.18 + ln * 0.5, 0.18 + ln * 0.5 + 0.08, v, 0.45, 0.105, "steelD")      # collar
        f.hcyl(0.18 + ln, 0.18 + ln + 0.08, v, 0.45, 0.1, "gmD", cap="cyan" if hot else "dark")  # emitter cup
        f.box(0.18 + ln + 0.1, v, 0.45, 0.07, 0.1, 0.1, "arc" if hot else "steelD", base=False)
    for sv in (-1, 1):                                                                 # side power strips
        f.box(-0.5, sv * 0.405, 0.18, 0.6, 0.02, 0.06, "cyan" if hot else "dark")
    f.vcyl(-0.82, 0.22, 0.4, 0.12, 0.22, "gm", top="plate")                            # capacitors
    f.vcyl(-0.82, 0.22, 0.58, 0.13, 0.04, "cyan" if hot else "gmD")
    f.vcyl(-0.82, -0.22, 0.4, 0.12, 0.22, "gm", top="plate")
    f.vcyl(-0.82, -0.22, 0.58, 0.13, 0.04, "cyan" if hot else "gmD")
    return [m.build()]


def mass_driver(rot, hot):
    m = _mesh(f"mass_driver_{rot}_{int(hot)}")
    f = Frame(m, rot)
    platform(f)
    f.box(-0.5, 0, 0.1, 0.95, 0.9, 0.42, "steel", top="steelL")                       # heavy housing
    hazard_strip(f, -0.95, -0.05, 0.47, 0.1, 0.1, 0.04, 0.04)
    hazard_strip(f, -0.95, -0.05, -0.47, 0.1, 0.1, 0.04, 0.04)
    f.box(-0.62, 0, 0.52, 0.6, 0.66, 0.28, "gmD", top="gm")                            # breech
    f.box(-0.3, 0, 0.8, 0.22, 0.34, 0.1, "steelL", top="plate")
    f.box(0.45, 0, 0.1, 0.9, 0.34, 0.34, "gmD", top="gm")                             # rail support
    for sv in (-1, 1):                                                                 # the two rails
        f.box(0.55, sv * 0.14, 0.44, 1.7, 0.12, 0.16, "gm", top="steelL")
        f.box(0.55, sv * 0.14, 0.595, 1.5, 0.045, 0.012, "orange" if hot else "dark")  # rail glow strip
    for u in (0.0, 0.4, 0.8, 1.15):                                                    # clamps
        f.box(u, 0, 0.4, 0.1, 0.5, 0.28, "steelL", top="plate")
        f.box(u, 0, 0.62, 0.11, 0.1, 0.02, "brass")
    f.box(0.55, 0, 0.5, 1.5, 0.1, 0.04, "dark")                                        # bore
    if hot:
        f.box(1.38, 0, 0.5, 0.05, 0.12, 0.06, "flameW")
        f.box(-0.14, 0, 0.5, 0.04, 0.28, 0.14, "orange")
    else:
        f.box(-0.14, 0, 0.5, 0.04, 0.28, 0.14, "rust")
    return [m.build()]


def missile_launcher(rot, hot):
    m = _mesh(f"missile_launcher_{rot}_{int(hot)}")
    f = Frame(m, rot)
    platform(f)
    f.box(-0.45, 0, 0.1, 0.95, 0.86, 0.3, "steelD", top="steel")                       # cradle base
    f.box(0.1, 0, 0.1, 0.5, 0.42, 0.34, "gmD", top="gm")                               # pivot block
    pu, pz, pt = -0.55, 0.42, math.radians(14)
    kw = dict(pitch=pt, pu=pu, pz=pz)
    f.box(0.2, 0, 0.42, 1.5, 0.84, 0.36, "steel", top="steelL", **kw)                  # launcher box
    for k in range(7):                                                                 # red / orange warning stripes
        col = "medRed" if k % 2 == 0 else "hivis"
        f.box(-0.4 + k * 0.2, 0.425, 0.46, 0.1, 0.012, 0.3, col, **kw)
        f.box(-0.4 + k * 0.2, -0.425, 0.46, 0.1, 0.012, 0.3, col, **kw)
    for j in range(3):                                                                 # tube grid on top
        for i in range(2):
            u, v = 0.18 + j * 0.34, -0.2 + i * 0.4
            f.box(u, v, 0.78, 0.26, 0.3, 0.02, "steelL", **kw)                         # rim
            f.box(u, v, 0.795, 0.2, 0.24, 0.015, "dark", **kw)                         # tube
            f.box(u, v, 0.81, 0.07, 0.08, 0.01, "orange" if hot else "rust", **kw)     # primer
    for j in range(2):                                                                 # open tubes on the muzzle face
        for i in range(2):
            f.box(0.955, -0.2 + i * 0.4, 0.5 + j * 0.2, 0.012, 0.26, 0.15, "dark", **kw)
    for sv in (-1, 1):                                                                 # beacons
        f.box(-0.4, sv * 0.3, 0.8, 0.1, 0.1, 0.1, "red" if hot else "medRed", **kw)
    return [m.build()]


def ion_cannon(rot, hot):
    m = _mesh(f"ion_cannon_{rot}_{int(hot)}")
    f = Frame(m, rot)
    platform(f)
    f.box(-0.72, 0, 0.1, 0.4, 0.7, 0.3, "steelD", top="steel")
    f.hcyl(-0.9, -0.15, 0, 0.5, 0.3, "gm", capstart="gmD")                             # breech drum
    f.hcyl(-0.7, -0.62, 0, 0.5, 0.315, "polyB")
    f.hcyl(-0.42, -0.34, 0, 0.5, 0.315, "polyB")
    f.box(0.02, 0, 0.1, 0.3, 0.3, 0.32, "gmD", top="gm")                               # barrel mount
    f.hcyl(-0.15, 1.3, 0, 0.5, 0.075, "gmD")                                           # barrel core
    rings = ((0.0, 0.2), (0.3, 0.19), (0.6, 0.18), (0.9, 0.16))
    for u, r in rings:
        f.hcyl(u, u + 0.12, 0, 0.5, r, "steelL")                                       # coil rings
        f.hcyl(u + 0.12, u + 0.2, 0, 0.5, r * 0.82, "magenta" if hot else "plate")      # glowing inner band
    f.hcyl(1.2, 1.32, 0, 0.5, 0.11, "gm", r1=0.15, cap="blueN" if hot else "dark")      # emitter horn
    if hot:
        f.box(1.36, 0, 0.5, 0.05, 0.1, 0.1, "arc", base=False)
    for sv in (-1, 1):
        f.box(-0.5, sv * 0.2, 0.1, 0.08, 0.08, 0.36, "gmD", top="gm")                  # coil feed pylons
        f.box(-0.5, sv * 0.2, 0.46, 0.1, 0.1, 0.05, "blueN" if hot else "polyB")
    f.box(-0.72, 0, 0.4, 0.3, 0.5, 0.02, "magenta" if hot else "plate")
    return [m.build()]


def incendiary(rot, hot):
    m = _mesh(f"incendiary_{rot}_{int(hot)}")
    f = Frame(m, rot)
    platform(f)
    f.vcyl(0.25, 0, 0.1, 0.42, 0.14, "steelD", top="steel")                            # turntable
    f.box(0.25, 0, 0.24, 0.5, 0.5, 0.12, "gmD", top="gm")
    pu, pz, pt = 0.25, 0.46, math.radians(38)
    f.hcyl(0.25, 0.95, 0, 0.46, 0.2, "gm", r1=0.24, pitch=pt, pu=pu, pz=pz, cap="dark")   # stubby mortar
    f.hcyl(0.82, 0.94, 0, 0.46, 0.26, "steelL", r1=0.27, pitch=pt, pu=pu, pz=pz)           # muzzle lip
    f.hcyl(0.93, 0.945, 0, 0.46, 0.2, "orange" if hot else "rust", pitch=pt, pu=pu, pz=pz, cap="orange" if hot else "rust")
    f.hcyl(0.45, 0.5, 0, 0.46, 0.22, "hivis", pitch=pt, pu=pu, pz=pz)                    # stripes
    f.hcyl(0.6, 0.65, 0, 0.46, 0.225, "hazK", pitch=pt, pu=pu, pz=pz)
    f.box(-0.55, 0, 0.1, 0.8, 0.84, 0.3, "rust", top="rustD")                          # ammo / fuel bay
    hazard_strip(f, -0.9, -0.2, 0.43, 0.14, 0.1, 0.02, 0.2)
    hazard_strip(f, -0.9, -0.2, -0.43, 0.14, 0.1, 0.02, 0.2)
    f.vcyl(-0.7, 0.18, 0.4, 0.14, 0.3, "hivis", top="steelL")                          # fuel tanks
    f.vcyl(-0.7, -0.18, 0.4, 0.14, 0.3, "hivis", top="steelL")
    f.vcyl(-0.7, 0.18, 0.7, 0.1, 0.04, "orange" if hot else "gmD")
    f.vcyl(-0.7, -0.18, 0.7, 0.1, 0.04, "orange" if hot else "gmD")
    for k in range(3):                                                                 # heat vents
        f.box(-0.3 - k * 0.08, 0.435, 0.2, 0.04, 0.012, 0.12, "orange" if hot else "dark")
        f.box(-0.3 - k * 0.08, -0.435, 0.2, 0.04, 0.012, 0.12, "orange" if hot else "dark")
    return [m.build()]


def engine(rot, hot):
    m = _mesh(f"engine_{rot}_{int(hot)}")
    f = Frame(m, rot)
    platform(f)
    f.box(-0.4, 0, 0.1, 1.0, 0.82, 0.5, "steel", top="steelL")                         # thruster housing
    f.box(-0.5, 0, 0.6, 0.7, 0.62, 0.1, "gmD", top="gm")
    for k in range(5):                                                                 # cooling fins
        f.box(-0.75 + k * 0.13, 0, 0.7, 0.05, 0.54, 0.1, "steelD", top="gm")
    hazard_strip(f, -0.9, 0.1, 0.43, 0.1, 0.1, 0.04, 0.04)
    hazard_strip(f, -0.9, 0.1, -0.43, 0.1, 0.1, 0.04, 0.04)
    f.hcyl(0.1, 0.32, 0, 0.42, 0.34, "gmD", r1=0.3)                                    # nozzle root
    f.hcyl(0.32, 0.82, 0, 0.42, 0.3, "gm", r1=0.36)                                    # bell
    f.hcyl(0.5, 0.58, 0, 0.42, 0.335, "steelL", r1=0.345)
    f.hcyl(0.82, 0.9, 0, 0.42, 0.385, "steelL", r1=0.385, cap="dark")                  # lip, dark throat
    f.hcyl(0.88, 0.9, 0, 0.42, 0.28, "cyan", cap="arc" if hot else "cyan")             # exhaust glow disc
    if hot:
        f.hcyl(0.9, 1.5, 0, 0.42, 0.26, "cyan", r1=0.08, cap="arc")                    # plume
        f.hcyl(0.9, 1.15, 0, 0.42, 0.14, "arc", r1=0.05)
    for sv in (-1, 1):
        f.box(-0.4, sv * 0.415, 0.3, 0.7, 0.02, 0.05, "cyan" if hot else "steelD")
        f.vcyl(-0.2, sv * 0.18, 0.8, 0.08, 0.1, "orange" if hot else "gmD", top="steelL")
    return [m.build()]


def _variants(name, fn, hot_suffix):
    out = []
    for r in range(4):
        sfx = "" if r == 0 else f".r{r}"
        fp = (1, 2) if r in (0, 2) else (2, 1)
        out.append((f"module.{name}{sfx}", fp, "prop", lambda r=r: fn(r, False)))
        out.append((f"module.{name}{sfx}.{hot_suffix}", fp, "prop", lambda r=r: fn(r, True)))
    return out


SPRITES = []
for _n, _fn in (("burst_laser", burst_laser), ("mass_driver", mass_driver), ("missile_launcher", missile_launcher),
                ("ion_cannon", ion_cannon), ("incendiary_launcher", incendiary)):
    SPRITES += _variants(_n, _fn, "charged")
SPRITES += _variants("engine", engine, "active")
