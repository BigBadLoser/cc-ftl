"""Surgical rig (family `medbay`, #311): a 1x1 robot standing beside a med bed, facing the bed's foot tile (its front,
+v; the bed runs along u). Local frame and placement: modkit.K (front = +v).

An armoured column with a hazard foot; a riser and a high boom carry a stem down to a halo: a smooth ring with five
arms. Each arm's look carries its job (white shells; one accent each): laser (red band, heavy emitter, a red beam
when cutting), cutter (bare steel forearm, blade), clamp (thickest, gunmetal forearm, jaws), camera (slim, cyan band,
sensor pod), suture (slim, green band, spool and needle). Arms are two equal segments placed by IK, so the elbow sets
the reach; each hangs from a clamp on the ring by a shoulder drum, and bends at an elbow drum on the same axis. Idle the halo hangs by the column with every arm folded into a raised Z, elbow out and tool up; in surgery it hangs over the patient's
torso and the arms of the stage's tools reach down, the rest stay folded.

Shapes are smooth (tubes, spheres, a torus), never stacked cubes; no two faces share a plane."""
import math

import bmesh
from mathutils import Vector

from . import core
from .modkit import K

TOP = 0.22                                                       # the med bed's mattress top (medbay.MATTRESS)
STAGES = {"cut": ("laser", "cutter", "camera"), "open": ("cutter", "clamp", "camera"),
          "close": ("clamp", "suture", "camera")}                # three at a time; animated, tools swap in and out
ARMS = ("camera", "laser", "cutter", "clamp", "suture")          # round the ring; the slim camera (always in use) faces
# the viewer in surgery, where it hides least
SPEC = {"laser": dict(r=0.04, fore="medWhite", band="medRed", L=0.36),
        "cutter": dict(r=0.034, fore="steelL", band=None, L=0.36),
        "clamp": dict(r=0.05, fore="gm", band=None, L=0.34),
        "camera": dict(r=0.028, fore="medWhite", band="cyan", L=0.37),
        "suture": dict(r=0.028, fore="medWhite", band="green", L=0.36)}
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


def hinge(R, c, tan, r, w, col="steel", cap="steelL"):
    """A hinge drum at c: a short cylinder along the unit tangent tan (the joint's axis), end caps lighter."""
    a = tuple(c[i] - tan[i] * w / 2 for i in range(3))
    b = tuple(c[i] + tan[i] * w / 2 for i in range(3))
    R.tube(a, b, r, col)
    for e, s_ in ((a, -1), (b, 1)):
        R.tube(e, tuple(e[i] + tan[i] * s_ * 0.012 for i in range(3)), r * 0.6, cap)


LINK = 0.12                                                       # the shoulder link: short, up and out
HEAD = {"laser": 0.125, "cutter": 0.1, "clamp": 0.17, "camera": 0.095, "suture": 0.15}   # tool lengths along their aim
WR, WZ = 0.66, -0.06                                                # the wrist (instrument carriage): out from the hub, up from the ring


def unit(a, b):
    d = [b[i] - a[i] for i in range(3)]
    n = math.sqrt(sum(x * x for x in d)) or 1e-6
    return tuple(x / n for x in d), n


def arm(R, sh, out, tan, kind, wrist, aim, working):
    """Shoulder drum sh, a short link up and out to the first drum, two equal segments (IK) up to a high knee and down
    to the wrist, an instrument carriage there, then (working) a thin shaft down to the tool, which ends at aim; folded,
    the tool sits on the carriage, pointing at aim. out: the arm's outward unit (u, v)."""
    sp = SPEC[kind]
    r = sp["r"]
    j1 = (sh[0] + out[0] * LINK * 0.4, sh[1] + out[1] * LINK * 0.4, sh[2] + LINK)
    R.tube(sh, j1, r * 1.2, "medWhite", r1=r * 1.1)
    hinge(R, j1, tan, r * 1.35, r * 2.7)
    el, wrist = ik(j1, wrist, sp["L"], (out[0], out[1], 1.3))
    R.tube(j1, el, r * 1.05, "medWhite", r1=r)
    hinge(R, el, tan, r * 1.25, r * 2.5)
    if sp["band"]:
        p1, p2 = lerp(el, wrist, 0.45), lerp(el, wrist, 0.7)
        R.tube(el, p1, r * 0.95, sp["fore"], ends=False)
        R.tube(p1, p2, r * 1.0, sp["band"], ends=False)
        R.tube(p2, wrist, r * 0.95, sp["fore"])
    else:
        R.tube(el, wrist, r * 0.95, sp["fore"])
    R.ball(wrist, r * 0.95, "steel", seg=8)
    if working:
        R.ball((el[0], el[1], el[2] + r * 1.5), r * 0.45, "cyan", seg=8)
    d, n = unit(wrist, aim)
    ce = tuple(wrist[i] + d[i] * 0.06 for i in range(3))
    R.tube(wrist, ce, r * 1.05, "gm")                                                  # instrument carriage
    hs = tuple(aim[i] - d[i] * HEAD[kind] for i in range(3)) if working else ce
    if working and n > HEAD[kind] + 0.07:
        R.tube(ce, hs, 0.014, "steelL", sides=6)                                     # instrument shaft
    head(R, hs, d, kind, working, aim)


def head(R, tp, d, kind, working, aim):
    """The tool from tp pointing along unit d; the laser's beam is a short glow to aim."""
    at = lambda s: tuple(tp[i] + d[i] * s for i in range(3))  # noqa: E731
    if kind == "laser":
        R.tube(at(0.0), at(0.04), 0.04, "medWhite")
        R.tube(at(0.04), at(0.06), 0.042, "medRed")
        R.tube(at(0.06), at(0.09), 0.036, "medWhite", r1=0.024)
        R.tube(at(0.09), at(0.1), 0.018, "red" if working else "gmD")
        if working:
            R.tube(at(0.1), aim, 0.008, "red", sides=6)
            R.ball(aim, 0.02, "red", seg=6)
    elif kind == "cutter":
        R.tube(at(0.0), at(0.03), 0.024, "steel")
        R.tube(at(0.03), at(0.1), 0.014, "steelL", r1=0.002, sides=6)
    elif kind == "clamp":
        R.tube(at(0.0), at(0.05), 0.04, "gmD")
        side = (-d[1], d[0], 0.0)
        sn = math.hypot(side[0], side[1]) or 1
        side = (side[0] / sn, side[1] / sn, 0.0)
        for o in (-1, 1):
            b = at(0.05)
            R.tube(tuple(b[i] + side[i] * o * 0.02 for i in range(3)),
                   tuple(b[i] + d[i] * 0.12 + side[i] * o * 0.035 for i in range(3)), 0.012, "gm", sides=6)
    elif kind == "camera":
        R.tube(at(0.0), at(0.08), 0.036, "gmD")
        R.tube(at(0.08), at(0.095), 0.026, "cyan" if working else "steelD")
    else:
        R.tube(at(0.0), at(0.02), 0.034, "medWhite")
        R.tube(at(0.02), at(0.045), 0.036, "green")
        R.tube(at(0.045), at(0.065), 0.034, "medWhite")
        R.tube(at(0.065), at(0.15), 0.006, "steelL", r1=0.002, sides=5)


def mount(R, hu, hv, hz, ca, sa):
    """An arm's socket on the ring: a rounded pod grown out of the ring's outer face, a dark seam and a cyan dot, the
    shoulder drum at its tip; returns the drum's centre and axis (tangent to the ring)."""
    tan = (-sa, ca, 0.0)
    po = (hu + (RING_R + 0.03) * ca, hv + (RING_R + 0.03) * sa, hz)
    R.ball(po, 0.085, "medWhite")
    R.tube((hu + (RING_R + 0.07) * ca, hv + (RING_R + 0.07) * sa, hz), (hu + (RING_R + 0.085) * ca, hv + (RING_R + 0.085) * sa, hz), 0.06, "gmD")
    R.ball((po[0], po[1], hz + 0.08), 0.018, "cyan", seg=6)
    sh = (hu + (RING_R + 0.11) * ca, hv + (RING_R + 0.11) * sa, hz)
    hinge(R, sh, tan, 0.055, 0.12)
    return sh, tan


SITE = 0.12                                                       # the incision, this far over the mattress
SPREAD = (0.15, 0.1)                                              # the tools' spots round it (along the bed, across)
HUB_ON, HUB_IDLE = (0.42, 0.98, 0.92), (0.3, 0.86, 1.45)    # idle: raised, poised over the bed's foot


def rig(state, rot, *_):
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
    hu, hv, hz = HUB_ON if on else HUB_IDLE
    bz = 1.96
    R.ball((0, -0.04, bz), 0.12, "steel")
    R.tube((0, -0.04, bz), (hu, hv, bz), 0.085, "medWhite")                             # boom
    R.ball((hu, hv, bz), 0.095, "steel")
    k.box(-0.02, -0.34, bz - 0.11, 0.24, 0.2, 0.22, "gm", top="gmD", bevel=0.05)        # counterweight
    R.tube((hu, hv, bz - 0.06), (hu, hv, max(hz + 0.5, bz - 0.4)), 0.05, "medWhite")    # stem: a sleeve and the rod
    R.tube((hu, hv, max(hz + 0.5, bz - 0.4)), (hu, hv, hz + 0.04), 0.032, "steel")
    # the halo
    R.torus((hu, hv), hz, RING_R, TUBE_R, "medWhite")
    R.torus((hu, hv), hz - 0.06, RING_R, 0.016, "cyan" if on else "steelD", m=6)        # underglow
    k.cyl(hu, hv, hz - 0.04, 0.1, 0.08, "medWhite", top="plate", sides=10, rtop=0.08)   # core pod
    k.cyl(hu, hv, hz - 0.055, 0.06, 0.015, "red" if on else "gmD", sides=10)            # sensor
    site = (hu, hv, TOP + SITE)
    for i, kind in enumerate(ARMS):
        a = math.pi / 2 + math.pi / 5 + i * math.tau / 5                               # no arm hides behind the stem
        ca, sa = math.cos(a), math.sin(a)
        sp = a + math.pi / 5                                                           # spokes between the arms
        R.tube((hu + 0.09 * math.cos(sp), hv + 0.09 * math.sin(sp), hz),
               (hu + (RING_R - 0.04) * math.cos(sp), hv + (RING_R - 0.04) * math.sin(sp), hz - 0.01), 0.022, "steel", sides=8)
        sh, tan = mount(R, hu, hv, hz, ca, sa)
        wrist = (hu + WR * ca, hv + WR * sa, hz + WZ)
        if kind in use:                                                                # the tools converge on the incision
            up = 0.16 if kind == "camera" else 0.07 if kind == "laser" else 0.0
            aim = (site[0] + SPREAD[0] * ca, site[1] + SPREAD[1] * sa, site[2] + up)       # each its own spot
            arm(R, sh, (ca, sa), tan, kind, wrist, aim, True)
        else:                                                                          # folded: tool tucked up by the forearm
            w = (hu + (WR - 0.04) * ca, hv + (WR - 0.04) * sa, hz + 0.02)
            arm(R, sh, (ca, sa), tan, kind, w, (w[0] + 0.1 * ca + 0.2 * tan[0], w[1] + 0.1 * sa + 0.2 * tan[1], w[2] + 0.6), False)
    return k.build()
