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
from .surgery_rig_base import body, holo

TOP = 0.22                                                       # the med bed's mattress top (medbay.MATTRESS)
ARMS = ("camera", "laser", "cutter", "clamp", "suture")          # round the ring; the slim camera (always in use) faces
# the viewer in surgery, where it hides least
# Sizes read at the game's 64x32 art (about 45 art px a unit): nothing that should show is under 1.5 px across.
SPEC = {"laser": dict(r=0.058, fore="medWhite", band="medRed", L=0.36),
        "cutter": dict(r=0.052, fore="steelL", band=None, L=0.36),
        "clamp": dict(r=0.068, fore="gm", band=None, L=0.34),
        "camera": dict(r=0.046, fore="medWhite", band="cyan", L=0.37),
        "suture": dict(r=0.046, fore="medWhite", band="green", L=0.36)}
RING_R, TUBE_R = 0.3, 0.068


class MK(K):
    """K with its local u mirrored (hand -1): the rig built for the bed's other long side, its halo reaching the other way
    along the bed (toward the head either way). Only axis-aligned boxes go through it (a turned box's rz would need
    negating)."""

    def __init__(self, name, fp, rot=0, hand=1):
        super().__init__(name, fp, rot)
        self.hand = hand

    def p(self, u, v):
        return super().p(self.hand * u, v)


class Rig:
    """Smooth primitives in the module's local frame (u, v, z), mapped to the grid through K; hand -1 mirrors u (MK)."""

    def __init__(self, name, rot, hand=1):
        self.k = MK(name, (1, 1), rot, hand)
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


def hinge(R, c, tan, r, w, col="steel", cap="rgChrome"):
    """A hinge drum at c: a short cylinder along the unit tangent tan (the joint's axis), end caps lighter."""
    a = tuple(c[i] - tan[i] * w / 2 for i in range(3))
    b = tuple(c[i] + tan[i] * w / 2 for i in range(3))
    R.tube(a, b, r, col)
    for e, s_ in ((a, -1), (b, 1)):
        R.tube(e, tuple(e[i] + tan[i] * s_ * 0.012 for i in range(3)), r * 0.6, cap)


LINK = 0.12                                                       # the shoulder link: short, up and out
BEAM = 0.24                                                       # the laser's stand-off over the patient
HEAD = {"laser": 0.125, "cutter": 0.1, "clamp": 0.17, "camera": 0.095, "suture": 0.15}   # tool lengths along their aim
WR, WZ = 0.66, -0.06                                                # the wrist (instrument carriage): out from the hub, up from the ring


def unit(a, b):
    d = [b[i] - a[i] for i in range(3)]
    n = math.sqrt(sum(x * x for x in d)) or 1e-6
    return tuple(x / n for x in d), n


def link(sh, out, f):
    """The first drum: a short link up and out from the shoulder, pivoting back as the arm folds (f)."""
    lo, lz = 0.4 + 0.45 * f, 1.0 - 0.45 * f
    return (sh[0] + out[0] * LINK * lo, sh[1] + out[1] * LINK * lo, sh[2] + LINK * lz)


def joints(sh, out, kind, work, folded, f):
    """(first drum, elbow, wrist, aim) of an arm f of the way from working (0; work = (wrist, aim)) to folded (1). The arm
    bends in its own plane (out, up), so the move is made in joint angles, not by sliding the wrist: the upper arm swings,
    the elbow straightens and bends the other way (out working, in over the ring folded, never folding flat through
    itself), and the tool turns with the forearm."""
    L = SPEC[kind]["L"]
    tang = (-out[1], out[0])

    def plane(v):
        return (v[0] * out[0] + v[1] * out[1], v[2])
    ends = []
    for g, (wt, at), pole in ((0.0, work, (out[0], out[1], 1.3)), (1.0, folded, (-out[0], -out[1], 1.0))):
        j = link(sh, out, g)
        el, w = ik(j, wt, L, pole)
        th = math.atan2(*plane(unit(j, el)[0])[::-1])
        ph = math.atan2(*plane(unit(el, w)[0])[::-1])
        d, n = unit(w, at)
        side = d[0] * tang[0] + d[1] * tang[1]
        ends.append((th, (ph - th + math.pi) % math.tau - math.pi, math.atan2(*plane(d)[::-1]) - ph, side, n))
    (t0, b0, p0, s0, n0), (t1, b1, p1, s1, n1) = ends
    wrap = lambda a: (a + math.pi) % math.tau - math.pi  # noqa: E731
    th = t0 + wrap(t1 - t0) * f
    bend = b0 + (b1 - b0) * f                                                        # through straight, never flat
    psi = p0 + wrap(p1 - p0) * f
    side, n = s0 + (s1 - s0) * f, n0 + (n1 - n0) * f
    j = link(sh, out, f)
    el = (j[0] + L * math.cos(th) * out[0], j[1] + L * math.cos(th) * out[1], j[2] + L * math.sin(th))
    ph = th + bend
    w = (el[0] + L * math.cos(ph) * out[0], el[1] + L * math.cos(ph) * out[1], el[2] + L * math.sin(ph))
    a, c = ph + psi, math.sqrt(max(0.0, 1 - side * side))
    d = (c * math.cos(a) * out[0] + side * tang[0], c * math.cos(a) * out[1] + side * tang[1], c * math.sin(a))
    return j, el, w, tuple(w[i] + d[i] * n for i in range(3))


def arm(R, sh, out, tan, kind, work, folded, fold=0.0, beam=True, jaw=1.0):
    """Shoulder drum sh, a short link up and out to the first drum, two equal segments up to a high knee and down to the
    wrist, an instrument carriage there, then (working) a thin shaft down to the tool, which ends at the aim; folded, the
    tool sits on the carriage, pointing at it. out: the arm's outward unit (u, v); work, folded: (wrist, aim) at either end
    and fold how far between (joints); beam: the laser fires (working); jaw: the clamp's opening, 1 its rest."""
    sp = SPEC[kind]
    r = sp["r"]
    j1, el, wrist, aim = joints(sh, out, kind, work, folded, fold)
    R.tube(sh, j1, r * 1.2, "medWhite", r1=r * 1.1)
    hinge(R, j1, tan, r * 1.35, r * 2.7)
    R.tube(j1, el, r * 1.05, "medWhite", r1=r)
    hinge(R, el, tan, r * 1.25, r * 2.5)
    if sp["band"]:
        p1, p2 = lerp(el, wrist, 0.45), lerp(el, wrist, 0.7)
        R.tube(el, p1, r * 0.95, sp["fore"], ends=False)
        R.tube(p1, p2, r * 1.0, sp["band"], ends=False)
        R.tube(p2, wrist, r * 0.95, sp["fore"])
    else:
        R.tube(el, wrist, r * 0.95, sp["fore"])
    R.ball(wrist, r * 0.95, "rgChromeD", seg=8)
    working = fold < 0.5
    if working:
        R.ball((el[0], el[1], el[2] + r * 1.5), r * 0.45, "cyan", seg=8)
    d, n = unit(wrist, aim)
    ce = tuple(wrist[i] + d[i] * 0.06 for i in range(3))
    R.tube(wrist, ce, r * 1.05, "gm")                                                  # instrument carriage
    stand = HEAD[kind] + (BEAM if kind == "laser" else 0.0)                          # the laser stands off, its beam
    hs = lerp(tuple(aim[i] - d[i] * stand for i in range(3)), ce, min(1.0, fold / 0.35))   # spanning the gap (the shaft
    # runs out only as the arm settles)
    if unit(ce, hs)[1] > 0.06:
        R.tube(ce, hs, 0.024, "rgChrome", sides=6)                                   # instrument shaft
    head(R, hs, d, kind, working, aim, jaw, fire=fold == 0.0 and beam)


def head(R, tp, d, kind, working, aim, jaw=1.0, fire=False):
    """The tool from tp pointing along unit d (working: its lights lit); fire: the laser's beam, a short glow to aim."""
    at = lambda s: tuple(tp[i] + d[i] * s for i in range(3))  # noqa: E731
    if kind == "laser":
        R.tube(at(0.0), at(0.04), 0.06, "medWhite")
        R.tube(at(0.04), at(0.06), 0.062, "medRed")
        R.tube(at(0.06), at(0.09), 0.052, "medWhite", r1=0.036)
        R.tube(at(0.09), at(0.1), 0.03, "red" if working else "gmD")
        if fire:
            R.tube(at(0.1), aim, 0.013, "red", sides=5)
            R.ball(aim, 0.035, "red", seg=6)
    elif kind == "cutter":
        R.tube(at(0.0), at(0.03), 0.04, "steel")
        R.tube(at(0.03), at(0.1), 0.026, "rgChrome", r1=0.01, sides=6)
    elif kind == "clamp":
        R.tube(at(0.0), at(0.05), 0.058, "gmD")
        side = (-d[1], d[0], 0.0)
        sn = math.hypot(side[0], side[1]) or 1
        side = (side[0] / sn, side[1] / sn, 0.0)
        for o in (-1, 1):
            b = at(0.05)
            R.tube(tuple(b[i] + side[i] * o * 0.02 for i in range(3)),
                   tuple(b[i] + d[i] * 0.12 + side[i] * o * 0.035 * jaw for i in range(3)), 0.022, "rgChromeD", sides=6)
    elif kind == "camera":
        R.tube(at(0.0), at(0.08), 0.052, "gmD")
        R.tube(at(0.08), at(0.095), 0.04, "cyan" if working else "steelD")
    else:
        R.tube(at(0.0), at(0.02), 0.05, "medWhite")
        R.tube(at(0.02), at(0.045), 0.052, "green")
        R.tube(at(0.045), at(0.065), 0.05, "medWhite")
        R.tube(at(0.065), at(0.15), 0.016, "rgChrome", r1=0.008, sides=5)


def mount(R, hu, hv, hz, ca, sa):
    """An arm's socket on the ring: a rounded pod grown out of the ring's outer face, a dark seam and a cyan dot, the
    shoulder drum at its tip; returns the drum's centre and axis (tangent to the ring)."""
    tan = (-sa, ca, 0.0)
    po = (hu + (RING_R + 0.03) * ca, hv + (RING_R + 0.03) * sa, hz)
    R.ball(po, 0.085, "medWhite")
    R.tube((hu + (RING_R + 0.07) * ca, hv + (RING_R + 0.07) * sa, hz), (hu + (RING_R + 0.085) * ca, hv + (RING_R + 0.085) * sa, hz), 0.06, "gmD")
    R.ball((po[0], po[1], hz + 0.08), 0.028, "cyan", seg=6)
    sh = (hu + (RING_R + 0.11) * ca, hv + (RING_R + 0.11) * sa, hz)
    hinge(R, sh, tan, 0.055, 0.12)
    return sh, tan


SITE = 0.12                                                       # the incision, this far over the mattress
SPREAD = (0.15, 0.1)                                              # the tools' spots round it (along the bed, across)
BZ, SLEEVE = 1.96, 0.38                                          # the boom's height; the piston sleeve under its end
# Over the patient's belly, the piston out. The sleeper sprite reads about 0.35 tile nearer the foot when its head points toward the
# camera (bed r1, r2: +x or +y) than away from it (r0, r3), so the hub sits per view (`face`), each over the belly as drawn.
HUB_AWAY, HUB_TOWARD = (0.75, 0.78, 0.92), (0.4, 0.78, 0.92)
HUB_ON = HUB_AWAY


def face(rot, hand):
    """Set HUB_ON for a rig turned `rot` with handedness `hand`: the bed's head lies along its local +u (MK), which K turns to
    +x, +y, -x, -y by rotation; toward the camera when that is +x or +y."""
    global HUB_ON
    HUB_ON = HUB_TOWARD if (rot in (0, 1)) == (hand == 1) else HUB_AWAY
HUB_IDLE = (1.0, 0.0, BZ - 0.06 - SLEEVE - 0.05)                  # swung over the tile beside the bed's head, piston in


def rig(state, rot, hand=1):
    """state: 'idle' or a stage (surgery_rig_anim.STAGES: three tools at a time), at rest (the first frame of its loop)."""
    from .surgery_rig_anim import still
    return build(still(state), rot, f"surgery_rig_{state}_{rot}", hand=hand)


# The first arm's heading round the ring as the camera sees it: set on the view of bed r0 (the rig turned 3, not mirrored), where
# no arm hides behind the stem; every view keeps it, so each tool sits at the same place round the ring on screen.
ARM_WORLD = 3 * math.pi / 2 + math.pi / 2 + math.pi / 5


def arm_angle(rot, hand):
    """The first arm's heading in the rig's local frame for a rig turned `rot` with handedness `hand`, so that on screen it
    lies at ARM_WORLD: K turns local headings by rot quarter turns, MK mirrors u (a heading a becomes pi - a)."""
    a = ARM_WORLD - rot * math.pi / 2
    return a if hand == 1 else math.pi - a


def build(P, rot, name, split=False, hand=1):
    """The rig in pose P (surgery_rig_anim.Pose): the hub where it hangs, each arm's fold and its aim's offset, the clamp's
    jaw, the laser firing, the lights on. split: (the body: the column; the front: boom, piston, halo and arms, what
    reaches over the bed and is drawn over it in game) as two object lists. hand -1: mirrored (Rig)."""
    B = Rig(name + "_body", rot, hand)
    body(B, P.on)
    R = Rig(name, rot, hand) if split else B
    k = R.k
    hu, hv, hz = P.hub
    bz = BZ
    R.ball((0, -0.04, bz), 0.12, "steel")
    R.tube((0, -0.04, bz), (hu, hv, bz), 0.085, "medWhite")                             # boom (it swings about the column)
    R.ball((hu, hv, bz), 0.095, "steel")
    bu, bv = hu, hv + 0.04
    bn = math.hypot(bu, bv)
    tail = lambda d: (-d * bu / bn, -0.04 - d * bv / bn, bz)  # noqa: E731                # the boom's tail past the pivot
    R.tube((0, -0.04, bz), tail(0.2), 0.06, "gm", sides=10)
    R.tube(tail(0.18), tail(0.21), 0.1, "gmD", sides=12)                                # counterweight on the tail:
    R.tube(tail(0.21), tail(0.4), 0.13, "gm", sides=12)                                 # a collar, the weight, a cap
    R.tube(tail(0.4), tail(0.42), 0.09, "rgChromeD", sides=12)
    R.tube((hu, hv, bz - 0.06), (hu, hv, bz - 0.06 - SLEEVE), 0.05, "medWhite")         # piston: the sleeve, and the
    if hz + 0.04 < bz - 0.06 - SLEEVE:                                                 # rod run out of it
        R.tube((hu, hv, bz - 0.06 - SLEEVE), (hu, hv, hz + 0.04), 0.032, "rgChromeD")    # (darker than the sleeve)
    # the halo
    R.torus((hu, hv), hz, RING_R, TUBE_R, "medWhite")
    R.torus((hu, hv), hz - 0.06, RING_R, 0.016, "cyan" if P.on else "steelD", m=6)      # underglow
    k.cyl(hu, hv, hz - 0.04, 0.1, 0.08, "medWhite", top="plate", sides=10, rtop=0.08)   # core pod
    k.cyl(hu, hv, hz - 0.055, 0.06, 0.015, "red" if P.on else "gmD", sides=10)          # sensor
    site = (HUB_ON[0], HUB_ON[1], TOP + SITE)                                          # the incision stays put
    a0 = arm_angle(rot, hand)
    for i, kind in enumerate(ARMS):
        a = a0 + hand * i * math.tau / 5                                               # the same round the ring in every view
        ca, sa = math.cos(a), math.sin(a)
        sp = a + hand * math.pi / 5                                                    # spokes between the arms
        R.tube((hu + 0.09 * math.cos(sp), hv + 0.09 * math.sin(sp), hz),
               (hu + (RING_R - 0.04) * math.cos(sp), hv + (RING_R - 0.04) * math.sin(sp), hz - 0.01), 0.022, "steel", sides=8)
        sh, tan = mount(R, hu, hv, hz, ca, sa)
        f = P.fold.get(kind, 1.0)
        off = P.aim.get(kind, (0.0, 0.0, 0.0))
        up = 0.16 if kind == "camera" else 0.0                                         # the tools converge on the incision,
        w_aim = (site[0] + SPREAD[0] * ca + off[0], site[1] + SPREAD[1] * sa + off[1], site[2] + up + off[2])   # each its own spot
        w_wr = (hu + WR * ca, hv + WR * sa, hz + WZ)
        f_wr = (hu + 0.22 * ca, hv + 0.22 * sa, hz + 0.16)                             # folded: curled in over the ring, knee
        f_aim = (hu + 0.15 * ca, hv + 0.15 * sa, hz - 0.1)                             # leaning back, the tool down into its middle
        arm(R, sh, (ca, sa), tan, kind, (w_wr, w_aim), (f_wr, f_aim), f, P.beam, P.jaw)
    return (B.k.build(), k.build()) if split else k.build()


def rig_holo(state, rot, hand=1):
    """The console hologram layer: (the rig as holdout, the hologram); empty when idle."""
    if state == "idle":
        return None
    from .surgery_rig_anim import still
    return holo_layer(still(state), rot, f"{state}_{rot}", hand)


def holo_layer(P, rot, name, hand=1):
    """The hologram of pose P with the rig in that pose as its holdout; None while it is off. hand -1: mirrored (Rig)."""
    if P.holo is None:
        return None
    mask = build(P, rot, f"surgery_rig_{name}", hand=hand)
    R = Rig(f"surgery_rig_holo_{name}", rot, hand)
    holo(R, P.holo)
    return mask, R.k.build()
