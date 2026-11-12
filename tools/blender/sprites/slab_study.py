"""Stasis slab look study, round 1 (family `slab`, preview only; issue #116): a prisoner sealed in a two-tile slab held
by a stasis field, an item crew cart about and store tilted back. Our own take on a person sealed in a block: the slab
art is blank where the body goes, and the game presses the prisoner's own crew sprite into that face with a shader
(the preview fakes it: review/slab_preview.py).

Three sets, each a slab style with its storage and its cart (r0 only):
  s1 / c1  graphite tablet: dark slab, light grey face, cyan field rails down both long edges, steel end caps with
           emitter nodes; a straight rack (3x1) of three leaning on a backboard with an emitter beam over them; a low
           hover sled carrying one lying face up
  s2 / c2  prison block: pale concrete slab, dark end caps striped in hazard yellow, amber field bars across head and
           foot; a tiered stand (2x2): two rows of two, the back row raised so its faces show over the front; a
           wheeled trolley holding one tilted up
  s3 / c3  medical stasis: white slab, light face ringed by a cyan field frame; an echelon rack (3x1): three slabs
           each turned toward the room's corner so every face shows; an anti-grav tray with emitter arms
Items: `slab.study.<v>` (the scene) and `slab.study.<v>.face<i>` (where each slab's face shows: the press's mask).
Each face's corners in screen px go to the JSON file named by SLAB_FACES (head left, head right, foot right, foot
left, as the prisoner's own left and right)."""
import json
import math
import os

from . import core, env_build as E, post
from .core import G as GV
from .modkit import K
from .recovery_study import layer
from .recovery_study4 import quad

PAL = "slab"
L, W, T = 2.0, 0.8, 0.22                            # the slab: length (head to foot), width, thickness
LEAN = math.radians(25)                             # stored: leaning back from upright


def add(a, *vs):
    return tuple(a[i] + sum(s * v[i] for s, v in vs) for i in range(3))


def neg(a):
    return tuple(-c for c in a)


class Slab:
    """A slab whose foot (the middle of its face's bottom edge) is at `foot`, its face looking toward horizontal
    angle `a` (local u, v), leaning back `t` from upright (t = 90 deg: lying face up, head toward -a)."""

    def __init__(self, foot, a, t):
        ca, sa, ct, st = math.cos(a), math.sin(a), math.cos(t), math.sin(t)
        self.O = foot
        self.U = (-ca * st, -sa * st, ct)                                    # foot to head
        self.Wd = (-sa, ca, 0.0)                                             # the prisoner's left to right
        self.N = (ca * ct, sa * ct, st)                                      # out of the face

    def p(self, l, w, n=0.0):
        return add(self.O, (l, self.U), (w, self.Wd), (n, self.N))

    def box(self, k, l0, l1, w0, w1, n0, n1, col, face=None):
        c = lambda l, w, n: self.p(l, w, n)                                  # noqa: E731
        quad(k, [c(l0, w0, n1), c(l0, w1, n1), c(l1, w1, n1), c(l1, w0, n1)], face or col, self.N)
        quad(k, [c(l0, w0, n0), c(l0, w1, n0), c(l1, w1, n0), c(l1, w0, n0)], col, neg(self.N))
        quad(k, [c(l1, w0, n0), c(l1, w1, n0), c(l1, w1, n1), c(l1, w0, n1)], col, self.U)
        quad(k, [c(l0, w0, n0), c(l0, w1, n0), c(l0, w1, n1), c(l0, w0, n1)], col, neg(self.U))
        quad(k, [c(l0, w1, n0), c(l1, w1, n0), c(l1, w1, n1), c(l0, w1, n1)], col, self.Wd)
        quad(k, [c(l0, w0, n0), c(l1, w0, n0), c(l1, w0, n1), c(l0, w0, n1)], col, neg(self.Wd))

    def window(self):
        """The face's bare window, where the prisoner is pressed in: (l0, l1, w half)."""
        return 0.14, L - 0.14, W / 2 - 0.08

    def corners(self):
        l0, l1, hw = self.window()
        return [self.p(l1, -hw, 0.006), self.p(l1, hw, 0.006), self.p(l0, hw, 0.006), self.p(l0, -hw, 0.006)]


def slab(k, s, style):
    """One slab of `style` (1 graphite, 2 prison, 3 medical)."""
    l0, l1, hw = s.window()
    body, face = {1: ("slbGr", "slbFace"), 2: ("slbCon", "slbConL"), 3: ("medWhite", "slbFaceL")}[style]
    s.box(k, 0.0, L, -W / 2, W / 2, -T, 0.0, body, face=body)
    s.box(k, l0, l1, -hw, hw, -0.01, 0.004, face)                            # the window, a hair proud
    if style == 1:
        for w in (-1, 1):                                                    # field rails down the long edges
            s.box(k, 0.1, L - 0.1, w * (W / 2 - 0.05) - 0.014, w * (W / 2 - 0.05) + 0.014, -0.01, 0.012, "slbCy")
        for l0c, l1c in ((0.0, 0.1), (L - 0.1, L)):                          # steel end caps, emitter nodes
            s.box(k, l0c, l1c, -W / 2 - 0.02, W / 2 + 0.02, -T - 0.03, 0.035, "steelD", face="steel")
            for w in (-0.25, 0.0, 0.25):
                s.box(k, l0c + 0.03, l1c - 0.03, w - 0.03, w + 0.03, 0.03, 0.045, "slbCy")
    elif style == 2:
        for l0c, l1c in ((0.0, 0.13), (L - 0.13, L)):                        # dark caps, hazard stripes
            s.box(k, l0c, l1c, -W / 2 - 0.03, W / 2 + 0.03, -T - 0.04, 0.04, "dark")
            for i in range(6):
                w = -W / 2 + 0.05 + i * 0.14
                s.box(k, l0c + 0.02, l1c - 0.02, w, w + 0.07, 0.04, 0.05, "slbHaz")
        for l in (0.15, L - 0.19):                                           # amber bars across head and foot
            s.box(k, l, l + 0.04, -hw, hw, 0.0, 0.014, "slbAmb")
    else:
        for w in (-1, 1):                                                    # a cyan field frame round the window
            s.box(k, l0 - 0.03, l1 + 0.03, w * (hw + 0.03) - 0.012, w * (hw + 0.03) + 0.012, -0.01, 0.01, "slbCy")
        for l in (l0 - 0.03, l1 + 0.03):
            s.box(k, l - 0.012, l + 0.012, -hw - 0.03, hw + 0.03, -0.01, 0.01, "slbCy")
        for l0c, l1c in ((0.0, 0.06), (L - 0.06, L)):
            s.box(k, l0c, l1c, -W / 2 - 0.01, W / 2 + 0.01, -T - 0.01, 0.01, "plate")
    return s


# ---- storage --------------------------------------------------------------------------------------------------------
def rack_row(k):
    """s1: three slabs side by side on a trough, leaning on a backboard; an emitter beam over their heads."""
    k.box(0, 0.05, 0.0, 2.9, 0.75, 0.12, "dark", top="steelD")
    out = []
    for u in (-1.0, 0.0, 1.0):
        out.append(slab(k, Slab((u, 0.36, 0.12), math.pi / 2, LEAN), 1))
    for u in (-1.5, -0.5, 0.5, 1.5):                                         # posts leaning with them
        s = Slab((u, 0.3, 0.12), math.pi / 2, LEAN)
        s.box(k, 0.0, L + 0.15, -0.05, 0.05, -T - 0.05, -T + 0.02, "steel", face="steelL")
    b = Slab((0.0, 0.3, 0.12), math.pi / 2, LEAN)
    b.box(k, L + 0.05, L + 0.2, -1.55, 1.55, -T - 0.05, 0.12, "steelD", face="steel")
    b.box(k, L + 0.06, L + 0.09, -1.45, 1.45, 0.12, 0.13, "slbCy")
    return out


def tiered(k):
    """s2: a 2x2 stand, two rows of two, the back row up a step."""
    k.box(0, -0.5, 0.0, 1.9, 0.95, 0.55, "dark", top="steelD")               # the step
    k.box(0, 0.45, 0.0, 1.9, 1.05, 0.08, "steelD", top="steel")              # the front sill
    out = []
    for row, (v, z) in enumerate(((0.62, 0.08), (-0.2, 0.55))):
        for u in (-0.48, 0.48):
            out.append(slab(k, Slab((u, v, z), math.pi / 2, LEAN), 2))
        bar = Slab((0.0, v, z), math.pi / 2, LEAN)
        bar.box(k, L + 0.02, L + 0.14, -0.98, 0.98, -T - 0.06, 0.06, "dark")
        for i in range(10):
            w = -0.92 + i * 0.19
            bar.box(k, L + 0.04, L + 0.12, w, w + 0.09, 0.06, 0.07, "slbHaz")
    return out


def echelon(k):
    """s3: three slabs on a white plinth, each turned toward the room's corner (the camera) so every face shows."""
    k.box(0, 0.0, 0.0, 2.95, 0.95, 0.1, "plate", top="medWhite")
    k.box(0, 0.42, 0.1, 2.9, 0.04, 0.012, "slbCy")
    out = []
    a = math.pi / 4
    for u in (-0.95, 0.05, 1.05):
        s = Slab((u - 0.1, 0.2, 0.1), a, math.radians(18))
        out.append(slab(k, s, 3))
        s.box(k, L - 0.3, L + 0.08, -0.06, 0.06, -T - 0.2, -T, "plate", face="medWhite")   # a strut to its back
    return out


# ---- carts ----------------------------------------------------------------------------------------------------------
def sled(k):
    """c1: a low hover sled, the slab lying face up on it, a push bar at its foot."""
    k.box(0, 0.0, 0.12, 0.9, 1.9, 0.12, "steelD", top="steel")
    k.box(0, 0.0, 0.08, 0.7, 1.7, 0.04, "slbCy")                              # the lift field under it
    for v in (-0.95, 0.95):
        k.box(0, v, 0.12, 0.95, 0.06, 0.16, "dark", top="steelD")
    k.box(0, -1.0, 0.24, 0.06, 0.06, 0.7, "steel", top="steelL")              # the push bar's upright
    k.box(0, -1.0, 0.9, 0.8, 0.06, 0.06, "steelL")
    return [slab(k, Slab((0.0, -0.98, 0.24 + T), -math.pi / 2, math.pi / 2), 1)]


def trolley(k):
    """c2: a wheeled trolley, its cradle tilting the slab up at its head."""
    for u in (-0.38, 0.38):
        for v in (-0.75, 0.75):
            k.cyl(u, v, 0.0, 0.1, 0.06, "dark", top="steelD", sides=10)
    k.box(0, 0.0, 0.1, 0.9, 1.8, 0.08, "dark", top="steelD")
    k.box(0, 0.6, 0.18, 0.7, 0.12, 0.45, "slbHaz", top="dark")                # the cradle's raised head end
    k.box(0, -0.95, 0.18, 0.06, 0.06, 0.8, "steel", top="steelL")
    return [slab(k, Slab((0.0, -0.85, 0.18 + T), -math.pi / 2, math.radians(76)), 2)]


def tray(k):
    """c3: an anti-grav tray, white, emitter arms holding the slab over it."""
    k.box(0, 0.0, 0.3, 0.85, 1.85, 0.06, "plate", top="medWhite")
    k.box(0, 0.0, 0.26, 0.6, 1.5, 0.04, "slbCy")
    for v in (-0.7, 0.7):
        for u in (-0.44, 0.44):
            k.box(u, v, 0.36, 0.05, 0.05, 0.28, "plate", top="medWhite")
            k.box(u, v, 0.62, 0.06, 0.06, 0.03, "slbCy")
    return [slab(k, Slab((0.0, -0.98, 0.46 + T), -math.pi / 2, math.pi / 2), 3)]


DESIGNS = {"s1": (rack_row, (3, 1)), "s2": (tiered, (2, 2)), "s3": (echelon, (3, 1)),
           "c1": (sled, (1, 2)), "c2": (trolley, (1, 2)), "c3": (tray, (1, 2))}


def designs(v):
    """The design table holding v (this round's or a later one's)."""
    return study(v).DESIGNS


def study(v):
    """The round's module holding design v."""
    import sys
    from . import slab_study2, slab_study3
    for m in (sys.modules[__name__], slab_study2, slab_study3):
        if v in m.DESIGNS:
            return m


def build(v):
    fn, fp = designs(v)[v]
    k = K(f"slab_{v}", fp)
    slabs = fn(k)
    return k, k.build(), slabs


def job(v):
    def run(v=v):
        import bpy
        from .recovery_study import SAMPLES
        bpy.context.scene.cycles.samples = SAMPLES
        try:
            return scene_items(v)
        finally:
            bpy.context.scene.cycles.samples = core.SAMPLES
    return run


def scene_items(v):
    core.clear_scene_meshes()
    post.select(PAL)
    k, objs, slabs = build(v)
    c, op, g, ox, oy, _ = E.render_sprite("x", "prop", objs)
    scene = E.crop_item(f"slab.study.{v}", designs(v)[v][1], c, op, g, ox, oy)
    out = [scene]
    corners = []
    for i, s in enumerate(slabs):
        px = []
        for u, vv, z in s.corners():
            x, y = core.screen_xy(GV(*k.p(u, vv), z))
            px.append((round(x, 2), round(-y, 2)))
        corners.append(px)
        core.clear_scene_meshes()
        post.select(PAL)
        _, holdout, _ = build(v)
        mask = face_quad_objs(v, i)
        it = layer(holdout, mask, 255)
        if it is not None:
            it["id"] = f"slab.study.{v}.face{i}"
            out.append(it)
    for j, (ov, alpha) in enumerate(getattr(study(v), "OVERLAYS", {}).get(v, [])):
        core.clear_scene_meshes()
        post.select(PAL)
        _, holdout, _ = build(v)
        it = layer(holdout, ov(), alpha)
        if it is not None:
            it["id"] = f"slab.study.{v}.ov{j}"
            out.append(it)
    path = os.environ.get("SLAB_FACES")
    if path:
        data = json.loads(open(path).read()) if os.path.exists(path) else {}
        data[v] = {"faces": corners, "kinds": [getattr(s, "kind", "body") for s in slabs]}
        open(path, "w").write(json.dumps(data))
    return out


def face_quad_objs(v, i):
    """Slab i's face window alone, a hair in front of the face (the mask the press fills). The scene is built into a
    mesh that is never linked, only to place slab i the same way."""
    fn, fp = designs(v)[v]
    s = fn(K(f"slab_{v}_tmp", fp))[i]
    f = K(f"slab_{v}_face{i}", fp)
    if hasattr(s, "mask_outline"):                  # a shaped face (round 2's coffin): its own outline
        from .slab_study2 import poly
        poly(f, [s.p(l, w, 0.003) for l, w in s.mask_outline], "slbFace", s.N)
    else:
        l0, l1, hw = s.window()
        n = getattr(s, "mask_n", 0.006)
        quad(f, [s.p(l1, -hw, n), s.p(l1, hw, n), s.p(l0, hw, n), s.p(l0, -hw, n)], "slbFace", s.N)
    return f.build()


def jobs():
    from . import slab_study2, slab_study3
    return [job(v) for m in (DESIGNS, slab_study2.DESIGNS, slab_study3.DESIGNS) for v in m]
