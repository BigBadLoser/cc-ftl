"""Recovery pod look study round 8 (family `pod`, preview only): round 7's three med columns reworked after review.

  - the patient fits: the tank is taller (fluid to 2.5) so the whole figure floats inside with fluid over the head,
    and a lit strip on the tank's back wall rims them so they read as a figure, not a smudge
  - each design has its own top housing (dome with a vent ring, finned crown, octagonal cap)
  - asymmetric: one heavy side (the camera's right, +u -v) carries the pump, filter and riser; the light side (left,
    -u +v) only a readout
  - plumbing that plugs in: round flanges and knuckles, risers ending in an inlet block on the top housing; the chrome
    rods are gone
  - fewer, bigger details (lights, readouts, the heartbeat screen) that hold at 1x; the floor glow toned down; no
    glints (at this size they read as marks on the glass)

  w1 plinth   w2 ribbed   w3 octagon

Layers as round 1 (pod_study.py): the pod whole, `.glass`, `.front`. Units: world (1 = a tile), z in world units."""
import math

from .pod4_study import FRONT, faces_front, fluid, lathe
from .research_kit import Bench, bar

FP2 = (2, 2)
R, Z0, ZM, Z1 = 0.48, 0.44, 2.5, 2.6
D = 1 / math.sqrt(2)
RIGHT, LEFT = -math.pi / 4, 3 * math.pi / 4                  # the flank angles the camera sees


def at(a, r):
    return r * math.cos(a), r * math.sin(a)


def tank(k, layer, z0=Z0):
    C = [(z0 + (ZM - z0) * i / 8, R) for i in range(9)]
    if layer in ("all", "glass"):
        fluid(k, C, ("podGL", "podGM", "podG"), sides=28)
        for i in range(7):                                                                   # bubbles
            a = FRONT + (i - 3) * 0.5
            if faces_front(a, math.pi / 3) == (layer == "glass"):
                r = R * (0.6 + 0.08 * (i % 3))
                k.box(r * math.cos(a), r * math.sin(a), z0 + 0.3 + ((i * 0.41) % 1.0) * (ZM - z0 - 0.5), 0.05, 0.05,
                      0.05, "arcShellL")
    if layer == "all":
        u, v = at(FRONT + math.pi, R - 0.05)                                                 # the backlight strip
        k.box(u, v, z0 + 0.1, 0.34, 0.03, ZM - z0 - 0.3, "podGL", rz=-FRONT)
        k.cyl(0.0, 0.0, ZM, R, Z1 - ZM, "arcGlass", top="arcGlass", sides=28)               # the air gap


def vpipe(k, u, v, z0, z1, r=0.06, col="arcChrD", fl="arcChr"):
    """A vertical pipe with round flanges at its ends."""
    k.cyl(u, v, z0, r, z1 - z0, col, top=col, sides=12)
    for z in (z0, z1 - 0.05):
        k.cyl(u, v, z, r + 0.03, 0.05, fl, top=fl, sides=12)


def run(k, pts, r=0.055, col="arcChrD", fl="arcChr"):
    """A pipe through pts, a round knuckle at each bend."""
    for p0, p1 in zip(pts, pts[1:]):
        bar(k, p0, p1, r * 2, col)
    for p in pts[1:-1]:
        k.cyl(p[0], p[1], p[2] - r * 1.4, r * 1.5, r * 2.8, fl, top=fl, sides=12)


def inlet(k, a, r, z, col="arcBodyD"):
    """An inlet block on a housing's side at angle a: a fitting the riser plugs into, a lit tell-tale."""
    u, v = at(a, r)
    k.box(u, v, z, 0.22, 0.22, 0.2, col, top="arcBody", rz=a)
    nu, nv = at(a, r + 0.112)
    k.box(nu, nv, z + 0.12, 0.05, 0.004, 0.05, "podGL", rz=a + math.pi / 2)


def lamp(k, u, v, z, col, s=0.055):
    k.box(u, v, z, s, s, s, col, top=col)


def screen(k, u, v, z, w, h, face_a, glow="podGL", beat=True, levels=None):
    """A flat screen facing angle face_a: a dark bezel, a heartbeat line or a bar graph, big enough to read at 1x."""
    k.box(u, v, z, w, 0.05, h, "arcBodyK", top="arcBodyD", rz=face_a - math.pi / 2)
    nu, nv = math.cos(face_a) * 0.03, math.sin(face_a) * 0.03
    tu, tv = -math.sin(face_a), math.cos(face_a)
    if beat:
        pts = ((0.0, 0.45), (0.28, 0.45), (0.36, 0.9), (0.45, 0.08), (0.54, 0.45), (1.0, 0.45))
        for (a0, b0), (a1, b1) in zip(pts, pts[1:]):
            s0, s1 = (a0 - 0.5) * (w - 0.08), (a1 - 0.5) * (w - 0.08)
            bar(k, (u + nu + s0 * tu, v + nv + s0 * tv, z + 0.04 + b0 * (h - 0.08)),
                (u + nu + s1 * tu, v + nv + s1 * tv, z + 0.04 + b1 * (h - 0.08)), 0.024, glow)
    for i, lv in enumerate(levels or ()):
        s = (i - (len(levels) - 1) / 2) * (w - 0.08) / len(levels)
        k.box(u + nu + s * tu, v + nv + s * tv, z + 0.04, (w - 0.1) / len(levels) * 0.7, 0.004, (h - 0.08) * lv, glow,
              rz=face_a - math.pi / 2)


def pump(k, u, v, z, h=0.6, r=0.24):
    k.cyl(u, v, z, r, h, "arcBodyD", top="arcBody", sides=18)
    for i in range(4):
        k.cyl(u, v, z + 0.1 + i * 0.09, r + 0.025, 0.04, "arcChrD", top="arcChr", sides=18)   # its fins,
    k.cyl(u, v, z + h, r * 0.8, 0.1, "arcShell", top="arcShellL", sides=16)                   # its head
    lu, lv = at(RIGHT, r + 0.02)
    lamp(k, u + lu, v + lv, z + h - 0.12, "podGL")
    lamp(k, u + lu * 0.8 + 0.06, v + lv * 0.8 + 0.06, z + h - 0.12, "arcAmb")


def filt(k, u, v, z, h=0.7, r=0.16):
    k.cyl(u, v, z, r + 0.03, 0.07, "arcChrD", top="arcChr", sides=16)
    k.cyl(u, v, z + 0.07, r, 0.12, "podG", top="podG", sides=16)                               # sediment,
    k.cyl(u, v, z + 0.19, r, h * 0.6, "podGL", top="podGL", sides=16)                          # clean fluid,
    k.cyl(u, v, z + 0.19 + h * 0.6, r, h * 0.2, "arcGlass", top="arcGlass", sides=16)
    k.cyl(u, v, z + 0.17 + h * 0.8, r + 0.03, 0.08, "arcChrD", top="arcChr", sides=16)


def w1(layer="all"):
    """Plinth: a domed top with a vent ring; the pump behind the filter on the right, plumbed through the base and up
    a riser into the dome's inlet; a readout post on the left."""
    k = Bench(f"pod_w1_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.96, 0.07, "arcBodyD", top="arcBody", sides=32)              # the plinth,
        k.cyl(0.0, 0.0, 0.07, 0.86, 0.06, "arcBodyD", top="arcBody", sides=32)
        k.cyl(0.0, 0.0, 0.06, 0.965, 0.012, "podG", top="podG", sides=32)                  # its edge (unlit),
        lathe(k, 0.0, 0.0, [(0.13, 0.64), (0.36, 0.64), (0.44, 0.54)], "arcBodyD", top="arcBody", sides=28)
        k.cyl(0.0, 0.0, 0.42, 0.52, 0.03, "podGL", top="podGL", sides=28)
        fu, fv = at(RIGHT - 0.3, 0.76)                                                       # the filter (behind),
        k.cyl(fu, fv, 0.13, 0.2, 0.3, "arcBodyD", top="arcBody", sides=16)
        filt(k, fu, fv, 0.43, h=0.8)
        pu, pv = at(RIGHT + 0.3, 0.74)                                                       # the pump (in front),
        pump(k, pu, pv, 0.13, h=0.56, r=0.22)
        run(k, [(pu, pv, 0.6), (pu, pv, 0.82), (fu, fv, 0.82)], r=0.05)                       # pump -> filter,
        run(k, [(pu * 0.75, pv * 0.75, 0.3), (*at(RIGHT + 0.3, 0.6), 0.3)], r=0.05)            # base -> pump,
        vpipe(k, fu, fv, 1.4, Z1 + 0.08, r=0.07)                                             # filter -> the riser,
        run(k, [(fu, fv, Z1 + 0.02), (*at(RIGHT - 0.1, 0.66), Z1 + 0.14)], r=0.07)
        lu, lv = at(LEFT, 0.76)                                                              # the readout console
        k.box(lu, lv, 0.13, 0.3, 0.3, 0.7, "arcShell", top="arcShellL", rz=-math.pi / 4)
        k.box(lu, lv, 0.83, 0.32, 0.32, 0.06, "arcBodyD", top="arcBody", rz=-math.pi / 4)
        screen(k, *[c + d for c, d in zip((lu, lv), at(FRONT, 0.16))], 0.36, 0.26, 0.34, FRONT, beat=False,
               levels=(0.5, 0.85, 0.6, 0.95))
        lamp(k, lu, lv, 0.89, "podGL", 0.07)
    lathe(k, 0.0, 0.0, [(Z1, 0.56), (Z1 + 0.06, 0.64), (Z1 + 0.2, 0.64), (Z1 + 0.32, 0.52), (Z1 + 0.42, 0.28)],
          "arcShell", top="arcShellL", sides=28)                                              # the dome,
    k.cyl(0.0, 0.0, Z1 + 0.1, 0.645, 0.06, "arcBodyD", top="arcBodyD", sides=28)            # its vent ring,
    for i in range(10):
        a = FRONT + (i - 4.5) * 0.24
        u, v = at(a, 0.648)
        k.box(u, v, Z1 + 0.115, 0.07, 0.006, 0.03, "podGL", rz=a + math.pi / 2)
    k.cyl(0.0, 0.0, Z1 + 0.42, 0.14, 0.07, "arcChrD", top="arcChr", sides=14)
    inlet(k, RIGHT - 0.1, 0.62, Z1 + 0.06)
    screen(k, *at(FRONT, 0.66), 0.13, 0.44, 0.22, FRONT)                                     # the heartbeat screen
    for i, c in enumerate(("podGL", "podGL", "arcAmb")):                                     # lights on the step
        lamp(k, *at(FRONT + (i - 1) * 0.3, 0.9), 0.13, c)
    return k.build()


def w2(layer="all"):
    """Ribbed: a finned crown; supply and return risers side by side up the right, a pump on one, a glass filter on
    the other, into an inlet block; a status strip and screen set into the base on the left."""
    k = Bench(f"pod_w2_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.78, 0.06, "arcBodyD", top="arcBody", sides=32)
        lathe(k, 0.0, 0.0, [(0.06, 0.62), (0.36, 0.62), (0.44, 0.52)], "arcShell", top="arcShellL", sides=28)
        k.cyl(0.0, 0.0, 0.42, 0.5, 0.03, "podGL", top="podGL", sides=28)
        for i in range(16):
            a = i * math.tau / 16
            u, v = at(a, 0.64)
            k.box(u, v, 0.06, 0.05, 0.1, 0.3, "arcBodyD", top="arcBody", rz=a + math.pi / 2)
        for j, dz in ((-0.17, 0), (0.17, 0)):                                                 # the risers,
            ru, rv = at(RIGHT + j, 0.74)
            k.box(ru, rv, 0.06, 0.2, 0.2, 0.16, "arcShell", top="arcShellL", rz=RIGHT + j)   # their feet,
            vpipe(k, ru, rv, 0.22, Z1 + 0.08, r=0.07)
            run(k, [(ru, rv, Z1 + 0.02), (*at(RIGHT + j * 0.6, 0.66), Z1 + 0.14)], r=0.065)
        pu, pv = at(RIGHT - 0.17, 0.74)                                                      # a pump on one,
        k.cyl(pu, pv, 0.7, 0.18, 0.5, "arcBodyD", top="arcBody", sides=16)
        for i in range(4):
            k.cyl(pu, pv, 0.74 + i * 0.12, 0.2, 0.04, "arcChrD", top="arcChr", sides=16)
        lamp(k, *[c + d for c, d in zip((pu, pv), at(RIGHT, 0.19))], 1.1, "arcAmb")
        fu, fv = at(RIGHT + 0.17, 0.74)                                                      # a filter on the other
        filt(k, fu, fv, 1.1, h=0.6, r=0.15)
    for i, c in enumerate(("podGL", "podGL", "podGL", "arcAmb", "podGL")):                   # the status strip (left)
        a = LEFT - 0.55 + i * 0.13
        u, v = at(a, 0.635)
        k.box(u, v, 0.22, 0.06, 0.012, 0.1, c, rz=a + math.pi / 2)
    screen(k, *at(FRONT, 0.66), 0.1, 0.4, 0.22, FRONT)
    lathe(k, 0.0, 0.0, [(Z1, 0.56), (Z1 + 0.08, 0.62), (Z1 + 0.18, 0.62), (Z1 + 0.22, 0.48), (Z1 + 0.34, 0.48),
                        (Z1 + 0.38, 0.3)], "arcShell", top="arcShellL", sides=28)            # the crown,
    for i in range(12):                                                                       # its fins
        a = i * math.tau / 12
        u, v = at(a, 0.48)
        k.box(u, v, Z1 + 0.22, 0.08, 0.04, 0.1, "arcShellD", top="arcShell", rz=a)
    k.cyl(0.0, 0.0, Z1 + 0.12, 0.625, 0.03, "podGL", top="podGL", sides=28)
    inlet(k, RIGHT, 0.6, Z1 + 0.04)
    for z in (1.0, 1.7):                                                                      # a band on the glass
        if layer == "all":
            k.cyl(0.0, 0.0, z, R + 0.012, 0.03, "arcChrD", top="arcChr", sides=28)
        for i in range(12):
            a = FRONT + (i - 5.5) * 0.24
            u, v = at(a, R + 0.02)
            k.box(u, v, z + 0.006, 0.12, 0.012, 0.018, "arcChr", rz=a + math.pi / 2)
    return k.build()


def w3(layer="all"):
    """Octagon: a machinery block built into the platform's right corner (a recess of three lit filter cartridges in
    its face, a fan on top, a riser into the octagonal cap's inlet); a console sloped into the platform's left edge."""
    k = Bench(f"pod_w3_{layer}", FP2)
    tank(k, layer)
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.98, 0.16, "arcBodyD", top="arcBody", sides=8)
        k.cyl(0.0, 0.0, 0.16, 0.86, 0.03, "arcChrD", top="arcChr", sides=8)
        lathe(k, 0.0, 0.0, [(0.19, 0.62), (0.36, 0.62), (0.44, 0.52)], "arcShell", top="arcShellL", sides=8)
        k.cyl(0.0, 0.0, 0.42, 0.5, 0.03, "podGL", top="podGL", sides=28)
        bu, bv = at(RIGHT, 0.66)                                                             # the machinery block,
        k.box(bu, bv, 0.19, 0.5, 0.56, 0.86, "arcShell", top="arcShellL", rz=RIGHT)
        nu, nv = at(FRONT, 0.282)                                                            # its recess (the face
        k.box(bu + nu, bv + nv, 0.28, 0.4, 0.012, 0.6, "arcBodyK", rz=RIGHT)                # toward the camera),
        tu, tv = math.cos(RIGHT), math.sin(RIGHT)
        for j in (-1, 0, 1):                                                                 # three cartridges in it
            cu, cv = bu + nu * 1.12 + j * 0.12 * tu, bv + nv * 1.12 + j * 0.12 * tv
            k.cyl(cu, cv, 0.34, 0.05, 0.42, "podGL", top="podGL", sides=10)
            k.cyl(cu, cv, 0.3, 0.06, 0.05, "arcChrD", top="arcChr", sides=10)
            k.cyl(cu, cv, 0.76, 0.06, 0.05, "arcChrD", top="arcChr", sides=10)
        lamp(k, bu + nu * 1.1 - tu * 0.1, bv + nv * 1.1 - tv * 0.1, 0.94, "podGL", 0.06)
        lamp(k, bu + nu * 1.1 + tu * 0.1, bv + nv * 1.1 + tv * 0.1, 0.94, "arcAmb", 0.06)
        k.cyl(bu, bv, 1.05, 0.17, 0.02, "arcBodyK", top="arcBodyK", sides=16)               # the fan on top,
        for j in range(3):
            k.box(bu, bv, 1.07, 0.3, 0.03, 0.012, "arcChrD", top="arcChr", rz=j * math.pi / 3)
        k.cyl(bu, bv, 1.07, 0.05, 0.03, "podGL", top="podGL", sides=10)
        ru, rv = at(RIGHT - 0.3, 0.78)                                                       # the riser
        vpipe(k, ru, rv, 1.05, Z1 + 0.08, r=0.075)
        k.box(ru, rv, 0.9, 0.2, 0.2, 0.15, "arcChrD", top="arcChr", rz=RIGHT)
        run(k, [(ru, rv, Z1 + 0.02), (*at(RIGHT - 0.1, 0.66), Z1 + 0.14)], r=0.07)
        for i in range(8):
            a = i * math.tau / 8
            if abs(math.cos(a - RIGHT)) < 0.9:
                k.cyl(*at(a, 0.9), 0.16, 0.045, 0.03, "podG", top="podG", sides=8)            # studs (unlit)
    if layer == "all":                                                                        # the console (left)
        cu, cv = at(LEFT, 0.72)
        k.box(cu, cv, 0.19, 0.34, 0.34, 0.5, "arcShell", top="arcShellL", rz=-math.pi / 4)
        k.box(cu, cv, 0.69, 0.36, 0.36, 0.05, "arcBodyD", top="arcBody", rz=-math.pi / 4)
        screen(k, *[c + d for c, d in zip((cu, cv), at(FRONT, 0.18))], 0.3, 0.28, 0.3, FRONT, beat=False,
               levels=(0.4, 0.8, 0.55, 0.9))
        lamp(k, cu, cv, 0.74, "arcAmb", 0.07)
    screen(k, *at(FRONT, 0.7), 0.04, 0.42, 0.13, FRONT)
    k.cyl(0.0, 0.0, Z1, 0.66, 0.2, "arcShell", top="arcShellL", sides=8)                    # the octagonal cap,
    k.cyl(0.0, 0.0, Z1 + 0.2, 0.5, 0.12, "arcBodyD", top="arcBody", sides=8)
    k.cyl(0.0, 0.0, Z1 + 0.06, 0.665, 0.03, "podGL", top="podGL", sides=8)
    hu, hv = at(FRONT, 0.6)                                                                  # its hatch, lit tell-tales
    k.box(hu, hv, Z1 + 0.32, 0.3, 0.3, 0.02, "arcChrD", top="arcChr", rz=FRONT)
    for i, c in enumerate(("podGL", "arcAmb", "podGL")):
        lamp(k, *at(FRONT + (i - 1) * 0.3, 0.668), Z1 + 0.11, c, 0.05)
    inlet(k, RIGHT, 0.64, Z1 + 0.06)
    return k.build()


def jobs():
    out = []
    for v, f in (("w1", w1), ("w2", w2), ("w3", w3)):
        out.append((f"module.pod.{v}", FP2, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "prop", lambda f=f, layer=layer: f(layer)))
    return out
