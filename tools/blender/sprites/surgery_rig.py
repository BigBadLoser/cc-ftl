"""Surgical rig (family `medbay`, #311): a 1x1 robot standing beside a med bed, facing the bed's foot tile (its front,
+v; the bed runs along u). Local frame and placement: modkit.K (front = +v).

An armoured column with a hazard foot; a riser and a high boom carry a stem down to a halo: a smooth ring with five
arms. Each arm's look carries its job (white shells; one accent each): laser (red band, heavy emitter, a red beam
when cutting), cutter (bare steel forearm, blade), clamp (thickest, gunmetal forearm, jaws), camera (slim, cyan band,
sensor pod), suture (slim, green band, spool and needle). Arms are two equal segments placed by IK, so the elbow sets
the reach. Idle the halo hangs by the column with every arm folded like a jackknife, elbow up; in surgery it hangs over the patient's
torso and the arms of the stage's tools reach down, the rest stay folded.

Shapes are smooth (tubes, spheres, a torus), never stacked cubes; no two faces share a plane."""
import math

import bmesh
from mathutils import Vector

from . import core
from .modkit import K

TOP = 0.22                                                       # the med bed's mattress top (medbay.MATTRESS)
STAGES = {"cut": ("laser", "cutter", "clamp", "camera"), "open": ("cutter", "clamp", "camera"),
          "close": ("clamp", "suture", "camera")}
ARMS = ("laser", "cutter", "camera", "clamp", "suture")          # round the ring
SPEC = {"laser": dict(r=0.04, fore="medWhite", band="medRed", L=0.5),
        "cutter": dict(r=0.034, fore="steelL", band=None, L=0.5),
        "clamp": dict(r=0.05, fore="gm", band=None, L=0.48),
        "camera": dict(r=0.028, fore="medWhite", band="cyan", L=0.52),
        "suture": dict(r=0.028, fore="medWhite", band="green", L=0.5)}
REACH = {"laser": (0.36, TOP + 0.36), "cutter": (0.2, TOP + 0.14), "clamp": (0.27, TOP + 0.1),
         "camera": (0.3, TOP + 0.48), "suture": (0.22, TOP + 0.14)}
RING_R, TUBE_R = 0.3, 0.05


class Rig:
    """Smooth primitives in the module's local frame (u, v, z), mapped to the grid through K."""

    def __init__(self, name, rot):
        self.k = K(name, (1, 1), rot)
        self.m = self.k.m

    def g(self, p):
        x, y = self.k.p(p[0], p[1])
        return Vector((x, y, p[2]))

    def _emit(self, bm, col):
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for f in bm.faces:
            c = col(f) if callable(col) else col
            self.m.poly([core.G(*v.co) for v in f.verts], c, flip=True)
        bm.free()

    def tube(self, a, b, r, col, r1=None, sides=8, ends=True):
        a, b = self.g(a), self.g(b)
        ax = (b - a).normalized()
        u = ax.cross(Vector((0, 0, 1)) if abs(ax.z) < 0.95 else Vector((1, 0, 0))).normalized()
        v = ax.cross(u)
        r1 = r if r1 is None else r1
        bm = bmesh.new()
        rings = [[bm.verts.new(p + (u * math.cos(t) + v * math.sin(t)) * rr)
                  for t in (i * math.tau / sides for i in range(sides))] for p, rr in ((a, r), (b, r1))]
        for i in range(sides):
            j = (i + 1) % sides
            bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))
        if ends:
            bm.faces.new(rings[0][::-1])
            if r1 > 1e-4:
                bm.faces.new(rings[1])
        self._emit(bm, col)

    def ball(self, c, r, col, seg=8):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2), radius=r)
        c = self.g(c)
        for v in bm.verts:
            v.co += c
        self._emit(bm, col)

    def torus(self, c, z, R, r, col, n=20, m=6):
        bm = bmesh.new()
        cu, cv = c
        rings = [[bm.verts.new(self.g((cu + (R + r * math.cos(b)) * math.cos(a), cv + (R + r * math.cos(b)) * math.sin(a),
                                        z + r * math.sin(b)))) for b in (j * math.tau / m for j in range(m))]
                 for a in (i * math.tau / n for i in range(n))]
        for i in range(n):
            for j in range(m):
                i1, j1 = (i + 1) % n, (j + 1) % m
                bm.faces.new((rings[i][j], rings[i1][j], rings[i1][j1], rings[i][j1]))
        self._emit(bm, col)


def ik(sh, tp, L, pole):
    """Elbow of two equal segments L from sh to tp, bent toward pole; tp pulled in when out of reach."""
    d = [tp[i] - sh[i] for i in range(3)]
    n = math.sqrt(sum(x * x for x in d)) or 1e-6
    reach = min(n, 2 * L * 0.995)
    f = [x / n for x in d]
    tp = tuple(sh[i] + f[i] * reach for i in range(3))
    h = math.sqrt(max(0.0, L * L - (reach / 2) ** 2))
    pd = sum(pole[i] * f[i] for i in range(3))
    b = [pole[i] - pd * f[i] for i in range(3)]
    bn = math.sqrt(sum(x * x for x in b)) or 1e-6
    return tuple(sh[i] + f[i] * reach / 2 + b[i] / bn * h for i in range(3)), tp


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def head(R, tp, d, kind, working, site):
    """The tool at the wrist tp, pointing along unit d (along the forearm)."""
    at = lambda s: tuple(tp[i] + d[i] * s for i in range(3))  # noqa: E731
    if kind == "laser":
        R.tube(at(0.0), at(0.05), 0.05, "medWhite")
        R.tube(at(0.05), at(0.075), 0.052, "medRed")
        R.tube(at(0.075), at(0.11), 0.044, "medWhite", r1=0.03)
        R.tube(at(0.11), at(0.125), 0.022, "red" if working else "gmD")
        if working:
            R.tube(at(0.125), (site[0], site[1], TOP + 0.03), 0.013, "red", sides=6)
    elif kind == "cutter":
        R.tube(at(0.0), at(0.04), 0.03, "steel")
        R.tube(at(0.04), at(0.16), 0.016, "steelL", r1=0.002, sides=6)
    elif kind == "clamp":
        R.tube(at(0.0), at(0.05), 0.05, "gmD")
        for o in (-1, 1):
            base = at(0.05)
            tipp = (base[0] + d[0] * 0.12 + o * 0.045, base[1] + d[1] * 0.12, base[2] + d[2] * 0.12)
            R.tube((base[0] + o * 0.025, base[1], base[2]), tipp, 0.014, "gm", sides=6)
    elif kind == "camera":
        R.tube(at(0.0), at(0.08), 0.042, "gmD")
        R.tube(at(0.08), at(0.095), 0.03, "cyan" if working else "steelD")
    else:
        R.tube(at(0.0), at(0.02), 0.04, "medWhite")
        R.tube(at(0.02), at(0.045), 0.042, "green")
        R.tube(at(0.045), at(0.065), 0.04, "medWhite")
        R.tube(at(0.065), at(0.15), 0.006, "steelL", r1=0.002, sides=5)


def arm(R, sh, tp, pole, kind, working, site):
    sp = SPEC[kind]
    el, tp = ik(sh, tp, sp["L"], pole)
    r = sp["r"]
    R.ball(sh, r * 1.5, "steel")
    R.tube(sh, el, r * 1.1, "medWhite", r1=r)
    R.ball(el, r * 1.35, "steel")
    if sp["band"]:
        p1, p2 = lerp(el, tp, 0.55), lerp(el, tp, 0.8)
        R.tube(el, p1, r * 0.95, sp["fore"], ends=False)
        R.tube(p1, p2, r * 1.0, sp["band"], ends=False)
        R.tube(p2, tp, r * 0.95, sp["fore"])
    else:
        R.tube(el, tp, r * 0.95, sp["fore"])
    if working:
        R.ball((el[0], el[1], el[2] + r * 1.4), r * 0.45, "cyan", seg=8)
    d = [tp[i] - el[i] for i in range(3)]
    n = math.sqrt(sum(x * x for x in d)) or 1
    head(R, tp, tuple(x / n for x in d), kind, working, site)


def rig(state, rot):
    """state: 'idle' or a stage of STAGES."""
    on = state != "idle"
    use = STAGES.get(state, ())
    R = Rig(f"surgery_rig_{state}_{rot}", rot)
    k = R.k
    k.box(0, 0, 0.0, 0.64, 0.64, 0.06, "gmD", top="hazY", bevel=0.02)                  # hazard foot
    k.cyl(0, -0.04, 0.06, 0.24, 0.1, "gm", top="gmD", sides=10)
    k.cyl(0, -0.04, 0.16, 0.13, 1.28, "gm", sides=8)                                   # core
    for z0 in (0.24, 0.82):
        k.cyl(0, -0.04, z0, 0.175, 0.5, "medWhite", top="plate", sides=10, rtop=0.165)  # armour shells
    k.box(0, 0.127, 0.32, 0.03, 0.03, 0.36, "cyan" if on else "steelD")                 # status strip
    k.cyl(0, -0.04, 1.44, 0.2, 0.12, "steel", top="steelL", sides=10)                  # shoulder housing
    k.cyl(0, -0.04, 1.56, 0.09, 0.32, "medWhite", top="plate", sides=8)               # riser
    hu, hv, hz = (0.42, 0.98, 1.3) if on else (0.0, 0.4, 1.56)
    bz = 1.96
    R.ball((0, -0.04, bz), 0.12, "steel")
    R.tube((0, -0.04, bz), (hu, hv, bz), 0.085, "medWhite")                             # boom
    R.ball((hu, hv, bz), 0.095, "steel")
    k.box(-0.02, -0.34, bz - 0.11, 0.24, 0.2, 0.22, "gm", top="gmD", bevel=0.05)        # counterweight
    R.tube((hu, hv, bz - 0.06), (hu, hv, hz + 0.04), 0.035, "steel")                   # stem
    # the halo
    R.torus((hu, hv), hz, RING_R, TUBE_R, "medWhite")
    R.torus((hu, hv), hz - 0.06, RING_R, 0.016, "cyan" if on else "steelD", m=6)        # underglow
    k.cyl(hu, hv, hz - 0.1, 0.15, 0.14, "medWhite", top="plate", sides=10, rtop=0.12)   # core disc
    k.cyl(hu, hv, hz - 0.118, 0.09, 0.018, "red" if on else "gmD", sides=10)            # sensor
    for i in range(5):                                                                 # spokes
        a = (i + 0.5) * math.tau / 5 + 0.3 + math.pi / 5
        R.tube((hu + 0.14 * math.cos(a), hv + 0.14 * math.sin(a), hz - 0.02),
               (hu + (RING_R - 0.04) * math.cos(a), hv + (RING_R - 0.04) * math.sin(a), hz - 0.01), 0.022, "steel", sides=8)
    for i, kind in enumerate(ARMS):
        a = (i + 0.5) * math.tau / 5 + 0.3
        ca, sa = math.cos(a), math.sin(a)
        sh = (hu + RING_R * ca, hv + RING_R * sa, hz - 0.05)
        if kind in use:
            r, tz = REACH[kind]
            arm(R, sh, (hu + r * ca, hv + r * sa * 0.62, tz), (ca, sa, 0.7), kind, True, (hu, hv))
        else:
            arm(R, sh, (sh[0] + 0.16 * ca, sh[1] + 0.16 * sa, sh[2] + 0.04), (ca * 0.35, sa * 0.35, 1.0), kind, False, None)
    return k.build()
