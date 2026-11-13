"""Vending machine look study, round 13 (family `vending13`, palette set vending, preview only): a 90s paper-cup
livery (user, 2026-11-13, from a reference: loose teal brush strokes with a dark purple scribble and a magenta
shadow on white). On round 10's body, with round 11's side gradient.

The pattern is painted on the body's own faces in a wrap coordinate s (px along the outside of the section, from
the middle of the front round the +u corner, down the side and onto the back; the -u half mirrors it), so the
strokes run round the corners without a seam. Brush strokes are tapered bands along a centreline with a ragged
edge and a forked dry tail; the scribble is a thin zigzag line with its shadow offset down and back.

  vm1c13a cup: white, three teal strokes climbing from the back of the side up to the front corner, a purple
          scribble across them
  vm1c13b swoosh: white with a purple top, one big teal swoosh from the foot of the back corner sweeping up and
          round the front corner, the scribble riding its edge
  vm1c13c night: indigo, teal strokes falling to the back like the reference, a magenta scribble with a lilac
          shadow, a deeper gradient

All in px of the tile (u, v -16..16, z up); the front (+v) faces the camera. On the side s runs 17.3 (front
corner) to 35.5 (back corner); the back corner ends at 41.

Render note: the pale tops (white, purple) mottle at low sample counts (the world light's sampling noise lands
near a band edge); previews use SPRITE_SAMPLES=64, and a final render of this look needs as many."""
import math

from mathutils import Vector

from . import vending_r10 as R
from .exercise_r4 import spline
from .research_kit import Bench
from .vending_r11 import ramp
from .vending_study import FP

FVF, FVB = R.VF - R.RC, R.VB + R.RC                    # where the straight side starts and ends (v)
ARC = R.RC * math.pi / 2


def wrap(u, v):
    """The wrap coordinate s of a point on the outside (mirrored for -u)."""
    sg, u = (1 if u >= 0 else -1), abs(u)
    if v >= FVF and u <= R.FU:
        s = u
    elif v >= FVF:
        s = R.FU + R.RC * (math.pi / 2 - math.atan2(v - FVF, u - R.FU))
    elif v > FVB:
        s = R.FU + ARC + (FVF - v)
    elif u > R.FU:
        s = R.FU + ARC + (FVF - FVB) + R.RC * math.atan2(FVB - v, u - R.FU)
    else:
        s = R.FU + 2 * ARC + (FVF - FVB) + (R.FU - u)
    return sg * s


def hash2(a, b):
    h = (a * 73856093) ^ (b * 19349663)
    return ((h * 2654435761) & 0xFFFFFF) / 0xFFFFFF


def along(line, s, z):
    """Closest point on a polyline: (t along it 0..1, signed distance to the side)."""
    lens = [math.dist(a, b) for a, b in zip(line, line[1:])]
    total, run, best = sum(lens), 0.0, (1e9, 0.0, 0.0)
    for (a, b), L in zip(zip(line, line[1:]), lens):
        ds, dz = b[0] - a[0], b[1] - a[1]
        f = max(0.0, min(1.0, ((s - a[0]) * ds + (z - a[1]) * dz) / (L * L)))
        ps, pz = a[0] + ds * f, a[1] + dz * f
        d = math.hypot(s - ps, z - pz)
        if d < best[0]:
            best = (d, (run + f * L) / total, math.copysign(d, ds * (z - a[1]) - dz * (s - a[0])))
        run += L
    return best[1], best[2]


def stroke(line, w0, w1, seed):
    """A brush stroke: w0 wide at the start, w1 at the end (pointed), its edge a little ragged in 2px steps."""
    line = spline(line, 6)

    def hit(s, z):
        t, d = along(line, s, z)
        if t <= 0.001 or t >= 0.999:
            return False
        w = (w0 + (w1 - w0) * t) / 2 * (1 + 0.08 * math.sin(t * 19 + seed))
        w *= min(1.0, (1 - t) / 0.12, t / 0.05)                                  # rounded start, pointed tip
        return abs(d) <= w * (0.88 + 0.16 * hash2(round(s / 1.5) + seed, round(z / 2)))
    return hit


def scribble(line, half=0.7):
    line = line if len(line) > 40 else spline(line, 8)                     # (dense lines are already smooth)
    lo_s, hi_s = min(p[0] for p in line) - half, max(p[0] for p in line) + half

    def hit(s, z):
        if not lo_s <= s <= hi_s:
            return False
        t, d = along(line, s, z)
        return abs(d) <= half and 0.0 < t < 1.0 or math.dist((s, z), line[0]) <= half or \
            math.dist((s, z), line[-1]) <= half
    return hit


def shifted(line, ds, dz):
    return [(s + ds, z + dz) for s, z in line]


LOOKS = {
    "vm1c13a": dict(
        base="jzWhite", top="jzWhite", low="jzGrey", ramp=(-0.12, 0.35, 0.40),
        strokes=[([(43, 1), (30, 10), (14, 21)], 12.0, 4.0, "jzTeal"),
                 ([(44, 23), (30, 33), (13, 46)], 13.0, 4.0, "jzTeal"),
                 ([(41, 46), (30, 54), (17, 63)], 9.0, 3.0, "jzTeal")],
        line=[(40, 7), (31, 15), (27, 20), (31, 23), (35, 21), (31, 27), (22, 36), (18, 41), (22, 44),
              (27, 42), (24, 48), (15, 58)],
        ink=("jzPurple", "jzMagenta")),
    "vm1c13b": dict(
        base="jzWhite", top="jzPurple", low="jzGrey", ramp=(-0.12, 0.35, 0.40),
        strokes=[([(43, 1), (38, 10), (32, 22), (26, 36), (20, 48), (14, 58), (8, 64)], 16.0, 4.0, "jzTeal")],
        line=[(41, 14), (36, 20), (33, 26), (36, 29), (39, 27), (35, 33), (30, 42), (27, 47), (30, 50),
              (33, 48), (29, 55), (24, 62)],
        ink=("jzPurple", "jzMagenta")),
    "vm1c13c": dict(
        base="jzIndigo", top="jzIndigo", low="jzIndigoD", ramp=(-0.30, 0.50, 0.40),
        strokes=[([(9, 62), (24, 55), (42, 44)], 12.0, 4.0, "jzTeal"),
                 ([(10, 40), (25, 32), (43, 21)], 12.0, 4.0, "jzTeal"),
                 ([(15, 17), (28, 10), (42, 2)], 9.0, 3.0, "jzTeal")],
        line=[(12, 53), (22, 47), (27, 44), (24, 41), (20, 43), (24, 46), (33, 38), (38, 33), (35, 30),
              (31, 33), (36, 34), (41, 24)],
        ink=("jzMagenta", "jzLilac"), half=0.85),
}


def painter(look):
    strokes = [(stroke(line, w0, w1, i * 7), col) for i, (line, w0, w1, col) in enumerate(look["strokes"])]
    half = look.get("half", 0.7)
    ink, shadow = scribble(look["line"], half), scribble(shifted(look["line"], 1.0, -1.0), half)

    def paint(side, u, v, z):
        if side == "F" and R.SIGN[0] < u < R.SIGN[1] and R.SIGN[2] < z < R.SIGN[3]:
            return "vmSign"
        if side == "F" and R.DIVIDER[0] < u < R.DIVIDER[1] and R.DIVIDER[2] < z < R.DIVIDER[3]:
            return look["ink"][0]
        if z > R.CREAM_TOP:
            return look["top"]
        if u < 0 and v >= FVF:
            return look["base"]                                                    # the front stays clean
        s = abs(wrap(u, v))
        if ink(s, z):
            return look["ink"][0]
        if shadow(s, z):
            return look["ink"][1]
        for hit, col in strokes:
            if hit(s, z):
                return col
        return look["base"]
    return paint


def flat_top(ob):
    """Light the flat top as one face: its rim's normals otherwise lean towards the roundover, and on these pale
    colours that shows as a ring."""
    me = ob.data
    normals = [Vector(c.vector) for c in me.corner_normals]
    for p in me.polygons:
        if p.normal.z > 0.999:
            for li in p.loop_indices:
                normals[li] = Vector((0, 0, 1))
    me.normals_split_custom_set(normals)


def make(name):
    look = LOOKS[name]

    def f():
        k = Bench(f"vending_{name}", FP)
        remap = {"vmWine": look["top"], "vmWineD": look["low"], "vmCreamD": look["low"], "vmCream": look["base"]}
        poly = k.m.poly
        k.m.poly = lambda pts, color, flip=False: poly(pts, remap.get(color, color), flip=flip)
        R.body(k, R.WAVES["vm1c10b"], paint=painter(look))
        R.contents(k)
        R.back(k)
        out = R.build(k)
        ramp(k, out[0], *look["ramp"], pick=lambda r, g, b: True)
        flat_top(out[0])
        return out
    return f


DESIGNS = {n: make(n) for n in LOOKS}


def jobs():
    return [(f"module.vending13.{v}", FP, "prop", f) for v, f in DESIGNS.items()]
