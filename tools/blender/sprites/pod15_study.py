"""Recovery pod look study round 15 (family `pod`, preview only): three concepts drawn from scratch (no earlier pod
study code or parts).

  g1 meridian  the tank hangs on its vertical axis inside a tall chrome hoop, as a globe in its stand: a pivot at the
               top and one at the bottom, the hoop's foot sunk in a round foot plate
  g2 crystal   one hexagonal glass prism from the foot plate to the top: flat panes (a flat toward the viewer), flush
               dark frames at the corners, a frosted band at the bottom (a display in its front pane) and at the top
  g3 chalice   a tapered vessel on a round foot: one stem flares into the cup the glass sits in; a rolled rim and a
               lid with a knob on top

Layers as the pod contract: `module.pod.X` whole (fluid opaque), `.glass` the fluid alone, `.front` what must draw over
the patient (the top, and what stands beside or in front of the tank; never what is behind it, never the base).
Units: world (1 = a tile), z in world units; FRONT (toward the viewer) is the angle pi/4."""
import math

from .core import G
from .modkit import K
from .research_kit import bar

FP2 = (2, 2)
FRONT = math.pi / 4
ACROSS = -math.pi / 4                     # the screen's horizontal (toward screen-right)


def pt(a, r):
    return r * math.cos(a), r * math.sin(a)


def facing(a):
    """How far round from the viewer a direction is (0 toward the viewer, pi away)."""
    return abs((a - FRONT + math.pi) % math.tau - math.pi)


class Pod:
    """Three groups: the fluid, the body, and the front (what draws over the patient). The pod renders them all; a layer
    renders its group "over" the rest (its px only where it is in front of them, no outline of its own)."""
    def __init__(self, name):
        self.fluid, self.body, self.front = (K(f"{name}_{n}", FP2) for n in ("fluid", "body", "front"))

    def build(self, layer):
        groups = {"fluid": self.fluid, "body": self.body, "front": self.front}
        out, own = [], []
        for n, k in groups.items():
            if k.m.f:
                objs = k.build()
                out += objs
                own += objs if n == {"glass": "fluid", "front": "front"}.get(layer) else []
        return out if layer == "all" else (own, out)


def ngon(k, n, r, z, h, col, top=None, a0=0.0, rtop=None):
    """An upright n-sided prism (or frustum to rtop) on the footprint's centre, its first corner at angle a0."""
    rt = r if rtop is None else rtop
    lo = [k.p(*pt(a0 + i * math.tau / n, r)) for i in range(n)]
    hi = [k.p(*pt(a0 + i * math.tau / n, rt)) for i in range(n)]
    for i in range(n):
        j = (i + 1) % n
        k.m.poly([G(*lo[i], z), G(*lo[j], z), G(*hi[j], z + h), G(*hi[i], z + h)], col, flip=True)
    k.m.poly([G(*p, z + h) for p in hi][::-1], top or col, flip=True)


# ---- g1 meridian ------------------------------------------------------------------------------------------------------
HZ, HRX, HRZ = 1.64, 1.06, 1.56           # the hoop: centre height, half-width across, half-height


def hoop_pt(t):
    eu, ev = math.cos(ACROSS), math.sin(ACROSS)
    x, z = HRX * math.cos(t), HZ + HRZ * math.sin(t)
    return x * eu, x * ev, z


def g1(layer="all"):
    P = Pod(f"pod_g1_{layer}")
    f, b, t = P.fluid, P.body, P.front
    R, ZA, ZB = 0.56, 0.62, 2.62
    for za, zb, c in ((ZA, ZA + 0.1, "arcTealL"), (ZA + 0.1, 2.3, "arcTeal"), (2.3, ZB, "arcTealD")):
        f.cyl(0.0, 0.0, za, R, zb - za, c, top=c, sides=28)
    b.cyl(0.0, 0.0, 0.0, 0.98, 0.08, "arcBodyD", top="arcBody", sides=40)                    # the foot plate,
    b.cyl(0.0, 0.0, 0.08, 0.34, 0.06, "arcBodyD", top="arcBody", sides=24)                   # the hoop's socket,
    b.cyl(0.0, 0.0, 0.14, 0.07, ZA - 0.34, "arcChrD", top="arcChr", sides=12)                # the lower spindle,
    b.cyl(0.0, 0.0, ZA - 0.2, 0.15, 0.08, "arcChr", top="arcChrL", sides=16)                 # its pivot boss,
    b.cyl(0.0, 0.0, ZA - 0.12, R + 0.04, 0.12, "arcBodyD", top="arcBody", sides=28)          # the lower cap
    for i, c in enumerate(("arcTealL", "arcTealL", "arcAmb")):
        a = FRONT + (i - 1) * 0.25
        b.box(*pt(a, R + 0.045), ZA - 0.08, 0.06, 0.02, 0.04, c, rz=a + math.pi / 2)
    t.cyl(0.0, 0.0, ZB, R + 0.04, 0.12, "arcBodyD", top="arcBody", sides=28)                 # the upper cap,
    t.cyl(0.0, 0.0, ZB + 0.12, 0.15, 0.08, "arcChr", top="arcChrL", sides=16)                # its pivot boss,
    zt = HZ + HRZ
    t.cyl(0.0, 0.0, ZB + 0.2, 0.07, zt - ZB - 0.2, "arcChrD", top="arcChr", sides=12)       # the upper spindle
    t.cyl(0.0, 0.0, zt - 0.02, 0.09, 0.08, "arcTealL", top="arcTealL", sides=12)            # (a lit pivot)
    n = 56
    for i in range(n):                                                                        # the hoop
        p0, p1 = hoop_pt(i * math.tau / n), hoop_pt((i + 1) * math.tau / n)
        d = [(p1[j] - p0[j]) * 0.012 for j in range(3)]
        bar(t, [p0[j] - d[j] for j in range(3)], [p1[j] + d[j] for j in range(3)], 0.12, "arcChr")
    return P.build(layer)


# ---- g2 crystal -------------------------------------------------------------------------------------------------------
def g2(layer="all"):
    P = Pod(f"pod_g2_{layer}")
    f, b, t = P.fluid, P.body, P.front
    RC, ZA, ZB, ZT = 0.66, 0.5, 2.74, 3.0          # the prism's corner radius; clear from ZA to ZB; its top
    a0 = FRONT + math.pi / 6                         # corners at FRONT +- 30 deg: a flat faces the viewer
    ap = RC * math.cos(math.pi / 6)
    for za, zb, c in ((ZA, 2.4, "arcVioF"), (2.4, ZB, "podBD")):
        ngon(f, 6, RC - 0.01, za, zb - za, c, top=c, a0=a0)
    ngon(b, 6, 1.0, 0.0, 0.08, "arcBodyD", "arcBody", a0=a0)                                  # the foot plate,
    ngon(b, 6, RC, 0.08, ZA - 0.08, "arcPanel", "arcPanel", a0=a0)                            # the frosted foot band,
    fu, fv = pt(FRONT, ap + 0.006)                                                            # its display
    b.box(fu, fv, 0.18, 0.4, 0.012, 0.2, "arcBodyK", rz=FRONT + math.pi / 2)
    for i, h in enumerate((0.3, 0.3, 0.7, 0.1, 0.5, 0.3, 0.3)):
        du, dv = pt(ACROSS, (i - 3) * 0.05)
        b.box(fu + du + 0.008 * math.cos(FRONT), fv + dv + 0.008 * math.sin(FRONT), 0.22 + h * 0.1, 0.04, 0.006,
              0.025, "arcVio", rz=FRONT + math.pi / 2)
    ngon(t, 6, RC, ZB, ZT - ZB, "arcPanel", "arcPanelD", a0=a0)                              # the frosted top band,
    ngon(t, 6, RC - 0.14, ZT, 0.05, "arcBodyD", "arcBody", a0=a0)                            # a lid inset in it,
    t.cyl(0.0, 0.0, ZT + 0.05, 0.1, 0.02, "arcVio", top="arcVio", sides=12)
    for i in range(6):                                                                         # the corner frames
        a = a0 + i * math.pi / 3
        t.box(*pt(a, RC - 0.005), 0.08, 0.07, 0.07, ZT - 0.08, "arcBodyK", top="arcBodyD", rz=a)
    return P.build(layer)


# ---- g3 chalice -------------------------------------------------------------------------------------------------------
def g3(layer="all"):
    P = Pod(f"pod_g3_{layer}")
    f, b, t = P.fluid, P.body, P.front
    ZA, ZB, R0, R1 = 0.78, 2.72, 0.44, 0.66        # the vessel: bottom, top, radius at each

    def rad(z):
        return R0 + (R1 - R0) * (z - ZA) / (ZB - ZA)
    for za, zb, c in ((ZA, 2.3, "podB"), (2.3, ZB, "podBD")):
        f.cyl(0.0, 0.0, za, rad(za), zb - za, c, top=c, sides=20, rtop=rad(zb))
    b.cyl(0.0, 0.0, 0.0, 0.92, 0.06, "arcBodyD", top="arcBody", sides=40)                     # the foot,
    b.cyl(0.0, 0.0, 0.06, 0.62, 0.06, "arcBodyD", top="arcBody", sides=36)
    zc = ZA + 0.2                                                                               # one stem, flaring
    b.cyl(0.0, 0.0, 0.12, 0.14, 0.5, "arcChrD", top="arcChr", sides=20, rtop=0.2)             # into the cup the
    b.cyl(0.0, 0.0, 0.62, 0.2, zc - 0.62, "arcBodyD", top="arcBody", sides=24, rtop=rad(zc) + 0.04)   # glass sits in
    for i, c in enumerate(("podBL", "podBL", "arcGrn")):
        a = FRONT + (i - 1) * 0.3
        b.box(*pt(a, 0.62), 0.07, 0.06, 0.02, 0.035, c, rz=a + math.pi / 2)
    t.cyl(0.0, 0.0, ZB, R1 + 0.06, 0.07, "arcChrD", top="arcChr", sides=24)                  # the rolled rim,
    t.cyl(0.0, 0.0, ZB + 0.07, R1 - 0.04, 0.08, "arcBodyD", top="arcBody", sides=24)        # the lid,
    t.cyl(0.0, 0.0, ZB + 0.15, 0.12, 0.08, "arcChr", top="arcChrL", sides=14)               # its knob
    t.cyl(0.0, 0.0, ZB + 0.23, 0.06, 0.02, "podBL", top="podBL", sides=10)
    return P.build(layer)


def jobs():
    out = []
    for v, fn in (("g1", g1), ("g2", g2), ("g3", g3)):
        out.append((f"module.pod.{v}", FP2, "prop", fn))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "over", lambda fn=fn, layer=layer: fn(layer)))
    return out
