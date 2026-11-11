"""Recovery pod look study round 10 (family `pod`, preview only): round 9 sized up and cleaned up.

  - the bases fill the 2x2 (a rounded square, a square with the spine on it, an octagon to the footprint's edges); the
    tank is wider (R 0.62) and the housings with it
  - the heartbeat readout is a curved band set into the base housing, following its curve, not a flat screen on it
  - the console blocks on the left are gone; the machinery sits in the right corner, merged into the housings
  - the spine's arm runs over the top housing to a hub the housing hangs from; it and all the machinery beside the
    tank are in `.front` too (the top housing is, as it overlaps the patient's head, and was drawing over them)

  y1 plinth   y2 spine   y3 octagon

Layers as round 1 (pod_study.py). Units: world (1 = a tile), z in world units."""
import math

from .pod4_study import FRONT, faces_front, lathe
from .pod8_study import at, lamp, run, vpipe
from .research_kit import Bench, bar

FP2 = (2, 2)
R, Z0, ZM, Z1 = 0.62, 0.5, 2.8, 2.9
RH = 0.82                                                   # the housings' radius
RIGHT = -math.pi / 4
GREEN = ("podGL", "podGM", "podG", "podGD")
BLUE = ("podBL", "podB", "podB", "podBD")


def tank(k, layer, cols=GREEN):
    lit, mid, top, dark = cols
    if layer in ("all", "glass"):
        for za, zb, c in ((Z0, Z0 + 0.12, lit), (Z0 + 0.12, 1.95, mid), (1.95, ZM - 0.1, top), (ZM - 0.1, ZM, dark)):
            k.cyl(0.0, 0.0, za, R, zb - za, c, top=c, sides=32)
        k.cyl(0.0, 0.0, ZM, R, 0.014, lit, top=lit, sides=32)
        for i in range(8):
            a = FRONT + (i - 3.5) * 0.45
            if faces_front(a, math.pi / 3) == (layer == "glass"):
                r = R * (0.62 + 0.08 * (i % 3))
                k.box(r * math.cos(a), r * math.sin(a), Z0 + 0.3 + ((i * 0.41) % 1.0) * (ZM - Z0 - 0.5), 0.055,
                      0.055, 0.055, "arcShellL")
    if layer == "all":
        k.box(*at(FRONT + math.pi, R - 0.06), Z0 + 0.2, 0.6, 0.03, ZM - Z0 - 0.5, lit, rz=-FRONT)   # backlight core
        k.cyl(0.0, 0.0, ZM, R, Z1 - ZM, "arcGlass", top="arcGlass", sides=32)               # the air gap
    if layer == "front":                                                                      # the mask, the hose
        mu, mv, mz = -0.02, 0.14, 2.24
        k.box(mu, mv, mz, 0.1, 0.06, 0.08, dark, top=top)
        bar(k, (mu, mv, mz + 0.06), (0.1, 0.14, 2.6), 0.035, dark)
        bar(k, (0.1, 0.14, 2.6), (0.16, 0.0, ZM), 0.035, dark)


def ekg(k, r, z, glow, a0=FRONT - 0.55, a1=FRONT + 0.55, n=22):
    """The heartbeat readout set into a round housing: a dark band on its curve, the trace running round it."""
    trace = [0.5] * n
    for i, h in ((7, 0.62), (8, 0.95), (9, 0.08), (10, 0.5), (11, 0.6), (17, 0.95), (18, 0.08), (19, 0.6)):
        if i < n:
            trace[i] = h
    da = (a1 - a0) / n
    w = 2 * (r + 0.006) * math.sin(da / 2) * 1.15
    H = 0.18
    for i in range(n):
        a = a0 + (i + 0.5) * da
        u, v = at(a, r + 0.004)
        k.box(u, v, z, w, 0.012, H, "arcBodyK", rz=a + math.pi / 2)                         # the band,
        h0, h1 = trace[i], trace[i - 1] if i else trace[0]
        lo, hi = min(h0, h1), max(h0, h1)
        u, v = at(a, r + 0.012)
        k.box(u, v, z + 0.02 + lo * (H - 0.06), w * 0.9, 0.006, max(0.022, (hi - lo) * (H - 0.06)) + 0.006, glow,
              rz=a + math.pi / 2)                                                             # its trace
    for a in (a0 - 0.02, a1 + 0.02):                                                          # its bezel ends
        k.box(*at(a, r + 0.008), z - 0.01, 0.03, 0.02, H + 0.02, "arcChrD", rz=a + math.pi / 2)


def rsquare(k, s, z, h, c, col, top):
    """A rounded square slab, side s, corner radius c."""
    k.box(0.0, 0.0, z, s - 2 * c, s, h, col, top=top)
    k.box(0.0, 0.0, z, s, s - 2 * c, h, col, top=top)
    for su in (-1, 1):
        for sv in (-1, 1):
            k.cyl(su * (s / 2 - c), sv * (s / 2 - c), z, c, h, col, top=top, sides=12)


def base_housing(k, z0, body, top, glow, cols):
    lathe(k, 0.0, 0.0, [(z0, RH), (Z0 - 0.08, RH), (Z0, RH - 0.1)], body, top=top, sides=32)
    k.cyl(0.0, 0.0, Z0 - 0.02, R + 0.04, 0.03, cols[0], top=cols[0], sides=32)              # the tank's lit foot
    ekg(k, RH, z0 + (Z0 - 0.08 - z0) / 2 - 0.09, glow)


def riser_to_top(k, u, v, z0, a=RIGHT):
    """A riser at (u, v) from z0 up beside the top housing, a clamp to it, an elbow into a round inlet."""
    vpipe(k, u, v, z0, Z1 + 0.16, r=0.08)
    bar(k, (*at(a, RH - 0.02), Z1 - 0.12), (u, v, Z1 - 0.12), 0.08, "arcChrD")
    k.cyl(u, v, Z1 - 0.18, 0.11, 0.12, "arcChr", top="arcChrL", sides=12)
    run(k, [(u, v, Z1 + 0.12), (u, v, Z1 + 0.26), (*at(a, RH + 0.02), Z1 + 0.26)], r=0.075)
    k.cyl(*at(a, RH), Z1 + 0.16, 0.12, 0.18, "arcBodyD", top="arcBody", sides=12)          # the inlet,
    lamp(k, *at(a + 0.16, RH + 0.06), Z1 + 0.3, "podGL", 0.05)


def y1(layer="all"):
    """Plinth: a rounded-square plinth to the footprint's edges; the pump in the right corner, its riser carrying the
    filter inline up into the dome."""
    k = Bench(f"pod_y1_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        rsquare(k, 1.96, 0.0, 0.08, 0.3, "arcBodyD", "arcBody")                              # the plinth,
        rsquare(k, 1.8, 0.08, 0.07, 0.24, "arcBodyD", "arcBody")
        rsquare(k, 1.97, 0.075, 0.01, 0.3, "arcChrD", "arcChr")                              # its lip,
        k.cyl(0.0, 0.0, 0.15, 0.9, 0.01, "podG", top="podG", sides=32)                       # the tank's light on it
        base_housing(k, 0.15, "arcBodyD", "arcBody", "podGL", GREEN)
    pu, pv = at(RIGHT, 1.06)                                                              # the pump (corner),
    k.cyl(pu, pv, 0.15, 0.24, 0.62, "arcBodyD", top="arcBody", sides=18)
    for i in range(4):
        k.cyl(pu, pv, 0.25 + i * 0.1, 0.265, 0.045, "arcChrD", top="arcChr", sides=18)
    k.cyl(pu, pv, 0.77, 0.2, 0.1, "arcShell", top="arcShellL", sides=16)
    run(k, [(*at(RIGHT, 0.95), 0.32), (*at(RIGHT, RH), 0.32)], r=0.06)                    # into the base,
    lamp(k, *at(RIGHT + 0.22, 1.08), 0.7, "podGL")
    lamp(k, *at(RIGHT + 0.3, 1.04), 0.7, "arcAmb")
    k.cyl(pu, pv, 1.1, 0.19, 0.07, "arcChrD", top="arcChr", sides=16)                    # the inline filter,
    k.cyl(pu, pv, 1.17, 0.16, 0.36, "podGM", top="podGM", sides=16)
    k.cyl(pu, pv, 1.53, 0.16, 0.03, "podGL", top="podGL", sides=16)
    k.cyl(pu, pv, 1.56, 0.16, 0.14, "arcGlass", top="arcGlass", sides=16)
    k.cyl(pu, pv, 1.7, 0.19, 0.07, "arcChrD", top="arcChr", sides=16)
    vpipe(k, pu, pv, 0.87, 1.1, r=0.08)
    riser_to_top(k, pu, pv, 1.77)
    lathe(k, 0.0, 0.0, [(Z1, RH - 0.06), (Z1 + 0.06, RH), (Z1 + 0.22, RH), (Z1 + 0.32, RH - 0.12),
                        (Z1 + 0.4, 0.36)], "arcShellD", top="arcShell", sides=32)              # the dome,
    k.cyl(0.0, 0.0, Z1 + 0.09, RH + 0.005, 0.1, "arcBodyD", top="arcBodyD", sides=32)       # its vent band,
    for i in range(7):
        a = FRONT + (i - 3) * 0.3
        k.box(*at(a, RH + 0.008), Z1 + 0.12, 0.15, 0.008, 0.04, "podGL", rz=a + math.pi / 2)
    k.cyl(0.0, 0.0, Z1 + 0.4, 0.18, 0.08, "arcChrD", top="arcChr", sides=14)
    return k.build()


def y2(layer="all"):
    """Spine: a square base; a heavy frame up its right corner whose arm runs over the top housing to a hub the
    housing hangs from; hoses, a level gauge and status lights on its face; blue fluid."""
    k = Bench(f"pod_y2_{layer}", FP2)
    tank(k, layer, BLUE)
    if layer == "glass":
        return k.build()
    su, sv = at(RIGHT, 1.02)
    tu, tv = math.cos(RIGHT), math.sin(RIGHT)
    TOP = Z1 + 0.42                                                                          # the housing's top
    if layer == "all":
        rsquare(k, 1.96, 0.0, 0.12, 0.12, "arcBodyD", "arcBody")                             # the base,
        rsquare(k, 1.97, 0.115, 0.01, 0.12, "arcChrD", "arcChr")
        k.cyl(0.0, 0.0, 0.13, 0.9, 0.01, "podB", top="podB", sides=32)
        base_housing(k, 0.13, "arcShellD", "arcShell", "podBL", BLUE)
    k.box(su, sv, 0.0, 0.36, 0.56, TOP + 0.2, "arcShell", top="arcShell", rz=RIGHT)      # the spine,
    k.box(su, sv, 0.0, 0.42, 0.62, 0.2, "arcBodyD", top="arcBody", rz=RIGHT)            # its foot,
    au, av = at(RIGHT, 0.5)                                                              # its arm, over the top,
    k.box(au, av, TOP + 0.04, 1.02, 0.4, 0.16, "arcShellD", top="arcShellD", rz=RIGHT)
    for d in (-0.21, 0.21):                                                                # its lit edges
        k.box(au + d * math.cos(FRONT), av + d * math.sin(FRONT), TOP + 0.14, 0.9, 0.012, 0.02, "podBL", rz=RIGHT)
    k.cyl(0.0, 0.0, TOP - 0.04, 0.26, 0.24, "arcShellD", top="arcShell", sides=20)       # the hub it holds
    k.cyl(0.0, 0.0, TOP + 0.04, 0.27, 0.03, "podBL", top="podBL", sides=20)
    fu, fv = su + 0.282 * math.cos(FRONT), sv + 0.282 * math.sin(FRONT)                  # its face (the camera's):
    k.box(fu, fv, 0.3, 0.3, 0.02, 2.5, "arcBodyD", rz=RIGHT)                             # a dark channel,
    for i in range(2):                                                                     # two hoses in it,
        d = (i - 0.5) * 0.12
        bar(k, (fu + d * tu + 0.03, fv + d * tv + 0.03, 0.34), (fu + d * tu + 0.03, fv + d * tv + 0.03, 2.75),
            0.07, "arcChr")
    for z in (0.7, 1.6, 2.5):                                                              # clamps over them,
        k.box(fu + 0.05, fv + 0.05, z, 0.32, 0.04, 0.08, "arcBodyD", top="arcBody", rz=RIGHT)
    gu, gv = fu + 0.06, fv + 0.06                                                          # a level gauge,
    k.box(gu, gv, 1.05, 0.26, 0.03, 0.42, "arcBodyK", top="arcBodyD", rz=RIGHT)
    for i in range(6):
        k.box(gu + 0.018, gv + 0.018, 1.09 + i * 0.058, 0.18, 0.004, 0.036, "podBL" if i < 4 else "arcBodyD",
              rz=RIGHT)
    for i, c in enumerate(("podBL", "podBL", "arcAmb")):                                  # status lights
        lamp(k, fu + (i - 1) * 0.09 * tu + 0.05, fv + (i - 1) * 0.09 * tv + 0.05, 2.9, c, 0.06)
    for z0, z1 in ((0.3, 0.3), (2.2, Z1 - 0.06)):                                           # hoses into the housings
        run(k, [(su - 0.16 * tu, sv - 0.16 * tv, z0), (*at(RIGHT, RH - 0.04), z1)], r=0.055)
    for i in range(6):                                                                     # vents on its side
        k.box(su + 0.182 * tu, sv + 0.182 * tv, 0.8 + i * 0.12, 0.006, 0.3, 0.04, "arcBodyK", rz=RIGHT)
    lathe(k, 0.0, 0.0, [(Z1, RH - 0.04), (Z1 + 0.05, RH), (Z1 + 0.32, RH), (TOP, RH - 0.16)], "arcShellD",
          top="arcShell", sides=32)                                                           # the top housing
    k.cyl(0.0, 0.0, Z1 + 0.12, RH + 0.005, 0.04, "podBL", top="podBL", sides=32)
    return k.build()


def y3(layer="all"):
    """Octagon: the platform to the footprint's edges; the machinery block in the right corner grown out of the base
    housing (the filter cartridges in its face, a fan on top), its riser into the octagonal cap."""
    k = Bench(f"pod_y3_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        oc = 0.98 / math.cos(math.pi / 8)
        k.cyl(0.0, 0.0, 0.0, oc, 0.16, "arcBodyD", top="arcBody", sides=8)                   # the platform,
        k.cyl(0.0, 0.0, 0.16, oc - 0.1, 0.03, "arcChrD", top="arcChr", sides=8)
        k.cyl(0.0, 0.0, 0.19, 0.84, 0.01, "podG", top="podG", sides=32)
        for i in range(8):                                                                     # studs at its corners
            a = i * math.tau / 8
            if abs(math.cos(a - RIGHT)) < 0.9:
                k.cyl(*at(a, oc - 0.08), 0.16, 0.05, 0.03, "podG", top="podG", sides=8)
        base_housing(k, 0.19, "arcShell", "arcShellL", "podGL", GREEN)
    bu, bv = at(RIGHT, 0.98)                                                              # the machinery block,
    k.box(bu, bv, 0.19, 0.5, 0.6, 1.0, "arcShell", top="arcShellL", rz=RIGHT)
    nu, nv = at(FRONT, 0.302)
    tu, tv = math.cos(RIGHT), math.sin(RIGHT)
    k.box(bu + nu, bv + nv, 0.3, 0.42, 0.012, 0.66, "arcBodyK", rz=RIGHT)
    for j in (-1, 0, 1):
        cu, cv = bu + nu * 1.1 + j * 0.13 * tu, bv + nv * 1.1 + j * 0.13 * tv
        k.cyl(cu, cv, 0.36, 0.055, 0.34, "podGM", top="podGM", sides=10)
        k.cyl(cu, cv, 0.7, 0.055, 0.025, "podGL", top="podGL", sides=10)
        k.cyl(cu, cv, 0.725, 0.055, 0.1, "arcGlass", top="arcGlass", sides=10)
        k.cyl(cu, cv, 0.32, 0.065, 0.05, "arcChrD", top="arcChr", sides=10)
        k.cyl(cu, cv, 0.82, 0.065, 0.05, "arcChrD", top="arcChr", sides=10)
    lamp(k, bu + nu * 1.08 - tu * 0.11, bv + nv * 1.08 - tv * 0.11, 1.04, "podGL", 0.06)
    lamp(k, bu + nu * 1.08 + tu * 0.11, bv + nv * 1.08 + tv * 0.11, 1.04, "arcAmb", 0.06)
    k.cyl(bu, bv, 1.19, 0.18, 0.02, "arcBodyK", top="arcBodyK", sides=16)               # the fan on top,
    for j in range(3):
        k.box(bu, bv, 1.21, 0.32, 0.03, 0.012, "arcChrD", top="arcChr", rz=j * math.pi / 3)
    k.cyl(bu, bv, 1.21, 0.05, 0.03, "podGL", top="podGL", sides=10)
    ru, rv = at(RIGHT - 0.24, 1.0)
    riser_to_top(k, ru, rv, 1.19, a=RIGHT - 0.12)
    k.cyl(0.0, 0.0, Z1, RH + 0.04, 0.22, "arcShell", top="arcShellL", sides=8)              # the octagonal cap,
    k.cyl(0.0, 0.0, Z1 + 0.22, RH - 0.16, 0.12, "arcBodyD", top="arcBody", sides=8)
    k.cyl(0.0, 0.0, Z1 + 0.07, RH + 0.045, 0.03, "podGL", top="podGL", sides=8)
    k.box(*at(FRONT, 0.6), Z1 + 0.34, 0.34, 0.34, 0.02, "arcChrD", top="arcChr", rz=FRONT)
    for i, c in enumerate(("podGL", "arcAmb", "podGL")):
        lamp(k, *at(FRONT + (i - 1) * 0.28, RH + 0.05), Z1 + 0.12, c, 0.05)
    return k.build()


def jobs():
    out = []
    for v, f in (("y1", y1), ("y2", y2), ("y3", y3)):
        out.append((f"module.pod.{v}", FP2, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "prop", lambda f=f, layer=layer: f(layer)))
    return out
