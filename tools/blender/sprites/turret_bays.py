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


def _trunk(f):
    _g("trunk")
    f.vcyl(0, 0, 0, 0.84, 0.07, "steelD", top="steel", sides=32)
    f.vcyl(0, 0, 0.07, 0.74, 1.45, "steelD", sides=32)
    for z in (0.42, 0.98):
        f.vcyl(0, 0, z, 0.765, 0.1, "steel", top="steelL", sides=32)
    for k in range(12):
        a = (k + 0.5) * math.tau / 12
        f.box(0.735 * math.cos(a), 0.735 * math.sin(a), 0.07, 0.08, 0.08, 1.45, "steel", top="steelL")
    f.vcyl(0, 0, 1.52, 0.82, 0.1, "steelL", top="steel", sides=32)                    # well collar
    f.vcyl(0, 0, 1.62, 0.62, 0.012, "dark", sides=32)
    f.vcyl(0, 0, 1.5, 0.78, 0.02, "dark", sides=32)
    for k in range(4):                                                               # status lamps (idle: dark)
        a = k * math.tau / 4 + math.pi / 4
        f.box(0.79 * math.cos(a), 0.79 * math.sin(a), 1.56, 0.08, 0.08, 0.05, "dark", base=False)


CAPS = ((1.2, -0.62), (0.95, -1.12), (0.42, -1.24))


def _caps(f):
    _g("caps")
    for u, v in CAPS:
        f.vcyl(u, v, 0, 0.25, 0.06, "steelD", top="steel", sides=16)
        f.vcyl(u, v, 0.06, 0.2, 1.0, "gm", sides=16, top="steelL")
        for z in (0.3, 0.7):
            f.vcyl(u, v, z, 0.215, 0.07, "steelD", sides=16)
        f.vcyl(u, v, 1.06, 0.12, 0.08, "steelD", top="plate", sides=12)
        f.vcyl(u, v, 1.06, 0.205, 0.03, "dark", sides=16)
    _g("bus")
    for u, v in CAPS:                                                                # bus straps into the trunk
        r = math.hypot(u, v)
        D.rail(f, (u - u / r * 0.18, v - v / r * 0.18, 0.86), (u * 0.72 / r, v * 0.72 / r, 0.86), 0.045, "steelL")


def _fins(f):
    _g("fins")
    for u in (-1.32, -0.62):
        f.box(u, -1.12, 0, 0.12, 0.62, 0.08, "steelD", top="steel")
    f.box(-0.97, -1.12, 0.08, 0.92, 0.5, 0.1, "steel", top="steelL")
    D.fins(f, -1.4, -0.54, -1.12, 0.18, 0.46, 0.95, 7, thick=0.06, mat="steelL", top="plate")
    f.box(-0.97, -1.12, 1.13, 0.92, 0.5, 0.06, "steelD", top="steel")


def _console(f):
    _g("console")
    f.box(1.12, 1.12, 0, 0.42, 0.42, 0.06, "steelD", top="steel")
    f.box(1.12, 1.12, 0.06, 0.26, 0.26, 0.62, "steel", top="steelL")
    f.box(1.12, 1.12, 0.68, 0.5, 0.5, 0.1, "steelD", top="steel")
    f.box(1.12, 1.12, 0.78, 0.42, 0.42, 0.05, "dark", top="cyan", taper=0.9)


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
    A, B = ring(rh, -3.6), ring(rh, -0.02)
    for k in range(32):
        j = (k + 1) % 32
        f.poly([A[k], A[j], B[j], B[k]], "dark")
    obs = [m.build()]
    h = core.Mesh("holdout")
    fh = Frame(h, 1, square=True)
    A, B = ring(rh, 0), ring(2.3, 0)
    for k in range(32):
        j = (k + 1) % 32
        fh.poly([A[k], A[j], B[j], B[k]], "dark")
    ho = h.build()
    ho.is_holdout = True
    obs.append(ho)
    for ob in obs:
        ob.matrix_world = Matrix.Translation((0, 0, z0)) @ Matrix.Scale(s, 4)
    return obs


# deploy timeline at aim d0: (leaf opening, lift of head + gun in rig units, gun pitch in degrees)
DEPLOY = [(0.45, -3.0, 90), (1.0, -2.1, 90), (1.0, -1.0, 90), (1.0, 0.0, 45), (1.0, 0.0, 0)]


def deploy(d_, k):
    """k = -1: stowed (closed hatch + the fixed coaming); 0..4: deploy frames (aim d0)."""
    rig = TC.TURRETS[(d_, "driver")](False)
    s, rh = rig.scale, RADIUS[d_] + 0.06
    if k < 0:
        return hatch(rh, 0.0, s=s) + TC.place(rig, 0, parts=("fixed",))
    op, lift, pitch = DEPLOY[k]
    return hatch(rh, op, s=s) + TC.place(rig, 0, pitch=math.radians(pitch), lift=lift * s)
