"""WEAPON BAY CONCEPTS (round 2): the 3x3 mass driver bay for each turret direction, and the roof-hatch deploy frames.

Bay frame: cmbkit.Frame(rot=1, square=True), u = grid +x, v = grid +y, origin = footprint centre at floor level, footprint
u, v in -1.5..1.5. No slab: the lift trunk, capacitor cans, fin stack, console and feeder each stand on their own feet.
Shared layout: the turret lift trunk in the middle (the turret stows into it, under the roof hatch), capacitor bank at the
right corner, fin stack at the back, crew service console at the front, and a direction-specific ammo feeder on the left
(H: slug loader through coil hoops, S: twin magazine drums, R: revolving slug magazine). Idle: accents dark."""
import math
from . import core, cmbkit, detail as D
from .cmbkit import Frame, prim
from . import turret_concepts as TC

_g = TC._g
RADIUS = {"H": 0.92, "S": 0.86, "R": 0.9}      # turret race radius (rig units) = hatch radius - 0.06


def _trunk(f, r=0.74, top=TC.ZR, ribs=12):
    """The turret's mount column, FULL HEIGHT from the floor to the roof plane: it carries the turret through the roof
    (the turret stows down into it). Foot flange, armour bands, ribs, dark status lamps, collar flush with the roof."""
    _g("trunk")
    f.vcyl(0, 0, 0, r + 0.1, 0.07, "steelD", top="steel", sides=32)
    f.vcyl(0, 0, 0.07, r, top - 0.19, "steelD", sides=32)
    for z in (0.42, 0.98, 1.54):
        f.vcyl(0, 0, z, r + 0.025, 0.1, "steel", top="steelL", sides=32)
    for k in range(ribs):
        a = (k + 0.5) * math.tau / ribs
        f.box((r - 0.005) * math.cos(a), (r - 0.005) * math.sin(a), 0.07, 0.08, 0.08, top - 0.19, "steel", top="steelL")
    f.vcyl(0, 0, top - 0.12, r + 0.08, 0.12, "steelL", top="steel", sides=32)       # collar under the roof ring
    f.vcyl(0, 0, top, r - 0.12, 0.012, "dark", sides=32)
    for k in range(4):                                                               # status lamps (idle: dark)
        a = k * math.tau / 4 + math.pi / 4
        f.box((r + 0.02) * math.cos(a), (r + 0.02) * math.sin(a), 1.25, 0.08, 0.08, 0.1, "dark", base=False)


CAPS = ((1.2, -0.62), (0.95, -1.12), (0.42, -1.24))


def _caps(f, caps=CAPS, r=0.2, h=1.0, rt=0.72):
    _g("caps")
    for u, v in caps:
        f.vcyl(u, v, 0, r + 0.05, 0.06, "steelD", top="steel", sides=16)
        f.vcyl(u, v, 0.06, r, h, "gm", sides=16, top="steelL")
        for z in (0.3 * h, 0.7 * h):
            f.vcyl(u, v, z, r + 0.015, 0.07, "steelD", sides=16)
        f.vcyl(u, v, h + 0.06, r * 0.6, 0.08, "steelD", top="plate", sides=12)
        f.vcyl(u, v, h + 0.06, r + 0.005, 0.03, "dark", sides=16)
    _g("bus")
    for u, v in caps:                                                                # bus straps into the trunk
        d = math.hypot(u, v)
        D.rail(f, (u - u / d * (r - 0.02), v - v / d * (r - 0.02), h * 0.86), (u * rt / d, v * rt / d, h * 0.86), 0.045, "steelL")


def _fins(f, u0=-1.4, u1=-0.54, v=-1.12, h=0.95, n=7):
    _g("fins")
    um, su = (u0 + u1) / 2, u1 - u0
    for u in (u0 + 0.08, u1 - 0.08):
        f.box(u, v, 0, 0.12, 0.62, 0.08, "steelD", top="steel")
    f.box(um, v, 0.08, su + 0.06, 0.5, 0.1, "steel", top="steelL")
    D.fins(f, u0, u1, v, 0.18, 0.46, h, n, thick=0.06, mat="steelL", top="plate")
    f.box(um, v, h + 0.18, su + 0.06, 0.5, 0.06, "steelD", top="steel")


def _console(f, u=1.12, v=1.12, k=1.0):
    _g("console")
    f.box(u, v, 0, 0.42 * k, 0.42 * k, 0.06, "steelD", top="steel")
    f.box(u, v, 0.06, 0.26 * k, 0.26 * k, 0.62, "steel", top="steelL")
    f.box(u, v, 0.68, 0.5 * k, 0.5 * k, 0.1, "steelD", top="steel")
    f.box(u, v, 0.78, 0.42 * k, 0.42 * k, 0.05, "dark", top="cyan", taper=0.9)


def _feet(f, u0, u1, v, z, r, w=0.2):
    for u in (u0, u1):
        f.box(u, v, 0, 0.16, w + 2 * r * 0.6, z - r * 0.8, "steelD", top="steel")


def feeder_H(f):
    _g("feeder")
    v, z = 1.05, 0.6
    _feet(f, -1.15, -0.43, v, z, 0.3)
    f.hcyl(-1.42, 0.05, v, z, 0.16, "gm", sides=16, cap="steelL", capstart="steelL")
    for u in (-0.98, -0.6, -0.22):
        TC.hoop(f, u, z, 0.1, 0.3, 0.2, False, "orange", v=v)
        _g("hoopfoot")
        f.box(u, v, 0, 0.1, 0.18, z - 0.29, "steelD", top="steel")
        _g("feeder")
    f.hcyl(-1.46, -1.36, v, z, 0.24, "steel", sides=16, capstart="steelL", cap="steelL")
    _g("arm")
    D.seg(f, (-0.02, v, z), (-0.02, 0.7, z), 0.12, "steelL", 12, cap="steel")


def feeder_S(f):
    _g("feeder")
    for u, v in ((-0.95, 1.05), (0.2, 1.18)):
        f.vcyl(u, v, 0, 0.36, 0.06, "steelD", top="steel", sides=20)
        f.vcyl(u, v, 0.06, 0.3, 0.86, "steelD", sides=20, top="steel")
        for z in (0.2, 0.62):
            f.vcyl(u, v, z, 0.315, 0.08, "steel", sides=20)
        f.vcyl(u, v, 0.92, 0.2, 0.06, "steelL", top="plate", sides=16)
        f.vcyl(u, v, 0.45, 0.31, 0.06, "dark", sides=20)
    _g("arm")
    D.seg(f, (-0.75, 0.83, 0.75), (-0.45, 0.6, 0.75), 0.1, "steelL", 12, cap="steel", capstart="steel")
    D.seg(f, (0.17, 0.9, 0.75), (0.12, 0.7, 0.75), 0.1, "steelL", 12, cap="steel", capstart="steel")


def feeder_R(f):
    _g("feeder")
    v, z = 1.05, 0.62
    _feet(f, -1.0, -0.4, v, z, 0.42, w=0.3)
    f.hcyl(-1.36, -0.08, v, z, 0.16, "dark", sides=16)
    for k in range(6):
        a = k * math.tau / 6 + math.pi / 6
        f.hcyl(-1.3, -0.14, v + 0.28 * math.cos(a), z + 0.28 * math.sin(a), 0.115, "gm", sides=12, cap="steelL", capstart="steelL")
    for u0 in (-1.4, -0.74, -0.12):
        f.hcyl(u0, u0 + 0.08, v, z, 0.42, "steelD", sides=24, cap="steel", capstart="steel")
    _g("arm")
    D.seg(f, (-0.04, v - 0.1, z), (0.1, 0.72, z), 0.11, "steelL", 12, cap="steel", capstart="steel")


def bay(d_):
    m = core.Mesh(f"bay_{d_}")
    f = Frame(m, 1, square=True)
    if cmbkit.REC is not None:
        cmbkit.REC.group = "deck"
        cmbkit.REC.add({"kind": "box", "lo": [-1.5, -1.5, -0.05], "hi": [1.5, 1.5, 0.0], "src": "floor"})
    _trunk(f)
    _caps(f)
    _fins(f)
    _console(f)
    {"H": feeder_H, "S": feeder_S, "R": feeder_R}[d_](f)
    return [m.build()] if cmbkit.REC is None else []


BAYS = {k: (lambda k=k: bay(k)) for k in "HSR"}


def emitter(f, u, v):
    """Laser bay: upright lasing cell, a tall round canister with a dark crystal window (idle) between armour rings."""
    _g("feeder")
    f.vcyl(u, v, 0, 0.3, 0.06, "steelD", top="steel", sides=20)
    f.vcyl(u, v, 0.06, 0.24, 1.1, "steelD", sides=20, top="steel")
    for z in (0.12, 0.62, 0.98):
        f.vcyl(u, v, z, 0.26, 0.08, "steel", top="steelL", sides=20)
    f.vcyl(u, v, 0.28, 0.25, 0.26, "dark", sides=20)
    f.vcyl(u, v, 1.16, 0.12, 0.1, "steelL", top="plate", sides=14)


def pd_drum(f, v):
    """Point-defence bay: horizontal power/cooling drum on two feet, ribbed, feeding the column."""
    _g("feeder")
    z = 0.42
    _feet(f, -0.85, -0.5, v, z, 0.3)
    D.drum(f, -0.98, -0.36, v, z, 0.28, n=3, body="steelD", rib="steel", cap="steelL", sides=20)
    _g("arm")
    D.seg(f, (-0.33, v - 0.08, z), (-0.2, 0.36, z), 0.09, "steelL", 12, cap="steel", capstart="steel")


def small_bay(kind):
    """2x2 bay (laser / point defence): u, v in -1..1, full-height mount column in the middle."""
    m = core.Mesh(f"bay_{kind}")
    f = Frame(m, 1, square=True)
    if cmbkit.REC is not None:
        cmbkit.REC.group = "deck"
        cmbkit.REC.add({"kind": "box", "lo": [-1.0, -1.0, -0.05], "hi": [1.0, 1.0, 0.0], "src": "floor"})
    _trunk(f, r=0.44, ribs=10)
    _caps(f, ((0.72, -0.36), (0.42, -0.74)), r=0.15, h=0.8, rt=0.42)
    _fins(f, -0.92, -0.42, -0.66, h=0.7, n=5)
    _console(f, 0.72, 0.72, k=0.75)
    if kind == "laser":
        emitter(f, -0.62, 0.62)
    else:
        pd_drum(f, 0.68)
    return [m.build()] if cmbkit.REC is None else []


BAYS.update({"driver": lambda: bay("H"), "laser": lambda: small_bay("laser"), "pd": lambda: small_bay("pd")})


# ---- roof hatch + deploy frames ---------------------------------------------------------------------------------

@prim
def prism(f, pts, z0, z1, mat, top=None):
    """Vertical prism over a local (u, v) polygon, from z0 to z1 (side walls + top)."""
    n = len(pts)
    for i in range(n):
        (u0, v0), (u1, v1) = pts[i], pts[(i + 1) % n]
        f.poly([f.pt(u0, v0, z0), f.pt(u1, v1, z0), f.pt(u1, v1, z1), f.pt(u0, v0, z1)], mat, flip=True)
    f.poly([f.pt(u, v, z1) for u, v in pts], top or mat, flip=True)


def hatch(rh, opening, z0=TC.ZR, s=1.0):
    """Roof hatch of radius rh (rig units): two half-disc leaves sliding apart along v under the roof plating (opening
    0..1), the dark well liner below, and a holdout disc-with-hole at the roof plane so nothing below the roof shows
    outside the opening."""
    from mathutils import Matrix
    m = core.Mesh("hatch")
    f = Frame(m, 1, square=True)
    n = 20
    for sv in (-1, 1):
        o = sv * opening * rh * 1.02
        half = lambda r: [(r * math.cos(math.pi * k / n), sv * r * math.sin(math.pi * k / n) + o) for k in range(n + 1)]  # noqa: E731
        prism(f, half(rh - 0.005), -0.08, -0.025, "steelD", top="steelD")
        prism(f, half(rh * 0.74), -0.025, -0.01, "steel", top="steel")
        f.box(0, o + sv * 0.03, -0.025, rh * 1.6, 0.06, 0.02, "dark")                       # seam lip
    ring = lambda r, z: [f.pt(r * math.cos(k * math.tau / 32), r * math.sin(k * math.tau / 32), z) for k in range(32)]  # noqa: E731
    A, B = ring(rh, -DEPTH), ring(rh, -0.02)
    for k in range(32):
        j = (k + 1) % 32
        f.poly([A[k], A[j], B[j], B[k]], "dark")
    obs = [m.build()]
    h = core.Mesh("holdout")                     # closed holdout box under the roof, open only at the hatch
    fh = Frame(h, 1, square=True)
    A, B, C = ring(rh, 0), ring(2.3, 0), ring(2.3, -DEPTH)
    for k in range(32):
        j = (k + 1) % 32
        fh.poly([A[k], A[j], B[j], B[k]], "dark")
        fh.poly([B[k], B[j], C[j], C[k]], "dark")
    fh.poly(C, "dark")
    ho = h.build()
    ho.is_holdout = True
    obs.append(ho)
    for ob in obs:
        ob.matrix_world = Matrix.Translation((0, 0, z0)) @ Matrix.Scale(s, 4)
    return obs


DEPTH = 3.8   # well depth (rig units) the stowed turret sits in

# deploy timeline at aim d0: (leaf opening, lift of head + gun in rig units, gun pitch in degrees)
DEPLOY = [(0.45, -3.0, 90), (1.0, -2.1, 90), (1.0, -1.0, 90), (1.0, 0.0, 45), (1.0, 0.0, 0)]


def deploy(d_, k):
    """k = -1: stowed (closed hatch + the fixed coaming); 0..4: deploy frames (aim d0)."""
    rig = TC.TURRETS[(d_, "driver")](False)
    s, rh = rig.scale, RADIUS.get(d_, 0.92) + 0.06
    if k < 0:
        return hatch(rh, 0.0, s=s) + TC.place(rig, 0, parts=("fixed",))
    op, lift, pitch = DEPLOY[k]
    return hatch(rh, op, s=s) + TC.place(rig, 0, pitch=math.radians(pitch), lift=lift * s)
