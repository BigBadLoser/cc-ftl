"""Stasis slab look study (family `slab`, preview only; issue #116): a prisoner sealed in a two-tile slab held by a
stasis field, an item crew cart about and keep in a storage module. Our own take on a person sealed in a block: the
slab art is blank where the body goes, and the game presses the prisoner's own crew sprite into that face with a
shader (the preview fakes it: review/slab_preview.py).

Settled so far (rounds 1-5, culled): the cassette slab below; storage as a rotary flap wheel (twelve slabs round a core
on a 3x3, turned 40 deg off radial so the near faces fan open to the room), its current variants in slab_wheel.py;
the hover cart as a floating cradle (cradle() below; its angle is still to fix).

Items: `slab.study.<v>` (the scene) and `slab.study.<v>.face<i>` (where each slab's face shows: the press's mask);
translucent layers (light, beams) are `slab.study.<v>.ov<j>`, drawn over the scene. Each face's corners in screen px
go to the JSON file named by SLAB_FACES (head left, head right, foot right, foot left, as the prisoner's own left and
right). SLAB_ONLY=v1,v2 renders just those designs."""
import json
import math
import os

from . import core, post
from . import env_build as E
from .core import G as GV
from .modkit import K
from .recovery_study import layer
from .recovery_study4 import quad

PAL = "slab"
L, W, T = 1.6, 0.8, 0.22                            # the slab: length (head to foot; 1.6 so a wheel of them stands under the
#                                                     roof: walls 1.85, crew 1.5), width, thickness


def add(a, *vs):
    return tuple(a[i] + sum(s * v[i] for s, v in vs) for i in range(3))


def neg(a):
    return tuple(-c for c in a)


class Slab:
    """A slab from its own axes: foot point O (the middle of the face's bottom edge), U foot to head, N out of the
    face, Wd = U x N (the viewer's right). Points are p(l, w, n) along U, Wd, N; the face is n = 0, the body behind."""
    mask_n = 0.003

    def __init__(self, O, U, N):
        self.O, self.U, self.N = O, U, N
        self.Wd = (U[1] * N[2] - U[2] * N[1], U[2] * N[0] - U[0] * N[2], U[0] * N[1] - U[1] * N[0])

    def p(self, l, w, n=0.0):
        return add(self.O, (l, self.U), (w, self.Wd), (n, self.N))

    def box(self, k, l0, l1, w0, w1, n0, n1, col, face=None):
        c = lambda l, w, n: self.p(l, w, n)
        quad(k, [c(l0, w0, n1), c(l0, w1, n1), c(l1, w1, n1), c(l1, w0, n1)], face or col, self.N)
        if face == "slbFace":                       # the face is a screen: unlit, its palette tone exact (a lit face
            idx, alb, _, glow = k.m.f[-1]           # sits on a shade step and breaks up into ragged specks)
            k.m.f[-1] = (idx, (0, 0, 0), alb, glow)
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


def cassette(k, s, body="slbGr", caps="dark"):
    """The slab: its face (unlit, a screen) framed in a flush steel lip (a proud lip's 1-px inner wall broke up),
    cyan field lines in grip channels down its sides, heavy end caps with
    docking sockets, a status strip on the head cap."""
    s.box(k, 0.12, L - 0.12, -W / 2, W / 2, -T, 0.0, body, face="slbFace")
    for w in (-1, 1):                                                        # the steel lip round the face
        s.box(k, 0.12, L - 0.12, w * (W / 2 - 0.1), w * W / 2, 0.0, 0.004, "steel", face="steelL")   # (0.1: lying
                                                                             # face up, 0.07 foreshortened to 1.5 px)
        s.box(k, 0.3, L - 0.3, w * (W / 2 + 0.001) - 0.012, w * (W / 2 + 0.001) + 0.012, -T / 2 - 0.02, -T / 2 + 0.02,
              "slbCy")                                                       # field line in the grip channel
    for l0, l1 in ((0.0, 0.16), (L - 0.16, L)):                              # the heavy end caps
        s.box(k, l0, l1, -W / 2 - 0.04, W / 2 + 0.04, -T - 0.04, 0.06, caps, face="steelD" if caps == "dark" else "steel")
        e = l0 - 0.015 if l0 == 0.0 else l1
        s.box(k, e, e + 0.015, -0.12, 0.12, -0.16, -0.04, "slbCy")           # docking socket
    s.box(k, L - 0.12, L - 0.04, -0.22, 0.22, 0.06, 0.072, "slbCy")           # status strip on the head cap
    for w in (-0.2, 0.0, 0.2):
        s.box(k, 0.05, 0.11, w - 0.03, w + 0.03, 0.06, 0.072, "green" if w else "slbCy")
    return s


def beam(k, a, b, w, h, col, top=None):
    """A level bar from point a to b (local u, v, z; z of a), w wide and h tall, centred on the line."""
    du, dv = b[0] - a[0], b[1] - a[1]
    k.box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2] - h / 2, math.hypot(du, dv), w, h, col, top=top,
          rz=math.atan2(dv, du))


# ---- the cart (hover B: a floating cradle) --------------------------------------------------------------------------
# Settled in rounds 35-44: level, the clamps on the slab's end caps, the lift field as two rings per emitter that leave
# it, run down and dim out before the floor (fading in the same palette steps), a twelve-frame loop. Built round any
# slab frame lying face up, so the cart's own sprite (c11, its loop c11w<n>) and the loading frames share it.
CV = L / 2 + 0.02                                   # a clamp's centre from the slab's middle: on its end cap
HOVER_N, RINGS = 12, 2                              # the loop's frames, its rings


def ring_fs(n):
    """The rings' places down their run (0: leaving the emitter, 1: gone) in loop frame n."""
    return [((i + (n % HOVER_N) / HOVER_N) / RINGS) for i in range(RINGS)]


def ring_col(f):
    return "slbCyD" if f < 0.09 or f >= 0.75 else "slbCyM" if f < 0.18 or f >= 0.45 else "slbCy"


def hover_cart(k, s, n=0, bar=-1):
    """The hover cart under slab s (face up): an emitter clamp on each end cap, the push bar past the end `bar` (-1:
    the foot, 1: the head), and loop frame n's rings under the emitters, down toward the floor (z = 0)."""
    from .slab_wheel import annulus
    for e in (-1, 1):
        lc = L / 2 + e * CV
        s.box(k, lc - 0.1, lc + 0.1, -0.49, 0.49, -0.22, 0.12, "dark", face="steelD")    # the clamp
        s.box(k, *sorted((lc + e * 0.1, lc + e * 0.112)), -0.3, 0.3, -0.06, -0.01, "slbCy")  # its strip
        c = s.p(lc, 0.0, -0.26)
        k.cyl(c[0], c[1], c[2], 0.16, 0.04, "steelD", top="steel", sides=14)              # its emitter
        k.cyl(c[0], c[1], c[2] - 0.01, 0.13, 0.012, "slbCy", sides=14)
        top = c[2] - 0.03
        for f in ring_fs(n):
            annulus(_Shift(k, c[0], c[1]), 0.155 + 0.07 * f, 0.2 + 0.07 * f, top - 0.04 - (top - 0.06) * 0.85 * f,
                    top - 0.015 - (top - 0.06) * 0.85 * f, ring_col(f), n=28)
    lb = L / 2 + bar * (CV + 0.16)
    for w in (-0.4, 0.4):                                                    # the push bar
        s.box(k, lb - 0.025, lb + 0.025, w - 0.025, w + 0.025, -0.1, 0.5, "steel", face="steelL")
    s.box(k, lb - 0.03, lb + 0.03, -0.43, 0.43, 0.48, 0.54, "steelL")


class _Shift:
    """k seen from (u, v): annulus() draws round the origin, so shift it under an emitter."""

    def __init__(self, k, u, v):
        self.k, self.u, self.v, self.m = k, u, v, k.m

    def p(self, u, v):
        return self.k.p(u + self.u, v + self.v)


def level(z=0.62):
    """The cart's slab on its own sprite: face up at height z along the footprint's long axis."""
    return Slab((0.0, -L / 2, z), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0))


def cradle(n=0):
    def go(k):
        s = level()
        hover_cart(k, s, n)
        return [cassette(k, s)]
    return go


def cradle_sheet(k):
    k.box(0, 0.0, 0.42, 0.7, 2 * CV - 0.1, 0.01, "slbFilm")


def cradle_floor(k):
    k.box(0, 0.0, 0.003, 0.7, 2 * CV - 0.2, 0.003, "dark")
    for v in (-CV, CV):
        k.cyl(0, v, 0.0, 0.26, 0.004, "slbFilm", sides=16)


def single(build, fp, name):
    def go():
        k = K(name, fp)
        build(k)
        return k.build()
    return go


CARTS = {"c11": (cradle(0), (1, 2)), **{f"c11w{n}": (cradle(n), (1, 2)) for n in range(HOVER_N)}}
CART_OVERLAYS = {v: [(single(cradle_floor, (1, 2), "fl"), 120), (single(cradle_sheet, (1, 2), "st"), 60)]
                 for v in CARTS}


# ---- rendering ------------------------------------------------------------------------------------------------------
def tables():
    from . import slab_fill, slab_load, slab_wheel
    return ({**slab_wheel.DESIGNS, **slab_load.DESIGNS, **slab_fill.DESIGNS, **CARTS},
            {**slab_wheel.OVERLAYS, **slab_fill.OVERLAYS, **CART_OVERLAYS})


def build(v):
    fn, fp = tables()[0][v]
    k = K(f"slab_{v}", fp)
    slabs = fn(k)
    objs = k.build()
    from . import slab_fill, slab_load, slab_wheel
    pit = {**slab_wheel.PIT, **slab_load.PIT, **slab_fill.PIT}.get(v)
    if pit:                                         # sunk in the floor: a holdout floor round the pit's mouth hides
        from .slab_kit import (  # what is under the floor outside it (the game's floor shows;
            corner_fill,
            floor_fill,
        )
        #                                             wide: the iso camera sees under-floor parts past the footprint)
        f = K(f"slab_{v}_floor", fp)
        if callable(pit):                           # a mouth that isn't round (radius by angle)
            floor_fill(f, pit, -0.04, 0.0, "dark", half=4.0)
        else:
            for i in range(4):
                c = math.pi / 4 + i * math.pi / 2
                corner_fill(f, c - math.pi / 4, c + math.pi / 4, pit, -0.04, 0.0, "dark", half=4.0)
        for o in f.build():
            o.is_holdout = True
            objs.append(o)
    return k, objs, slabs


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
    out = [E.crop_item(f"slab.study.{v}", tables()[0][v][1], c, op, g, ox, oy)]
    corners = []
    if os.environ.get("SLAB_NOMASK"):               # a quick still: no face masks (the preview leaves faces blank)
        slabs = []
    import bpy
    full = bpy.context.scene.cycles.samples
    bpy.context.scene.cycles.samples = 1            # a face mask is only its alpha: one sample is plenty
    for i, s in enumerate(slabs):
        px = []
        for u, vv, z in s.corners():
            x, y = core.screen_xy(GV(*k.p(u, vv), z))
            px.append((round(x, 2), round(-y, 2)))
        corners.append(px)
        if sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(px, px[1:] + px[:1])) >= 0:
            continue                                # the face looks away: a mask would show it through an empty slot
        core.clear_scene_meshes()
        post.select(PAL)
        _, holdout, _ = build(v)
        it = layer(holdout, face_quad_objs(v, i), 255)
        if it is not None:
            it["id"] = f"slab.study.{v}.face{i}"
            out.append(it)
    bpy.context.scene.cycles.samples = full
    for j, (ov, alpha) in enumerate(tables()[1].get(v, [])):
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
    fn, fp = tables()[0][v]
    s = fn(K(f"slab_{v}_tmp", fp))[i]
    f = K(f"slab_{v}_face{i}", fp)
    l0, l1, hw = s.window()
    n = s.mask_n
    quad(f, [s.p(l1, -hw, n), s.p(l1, hw, n), s.p(l0, hw, n), s.p(l0, -hw, n)], "slbFace", s.N)
    return f.build()


def jobs():
    only = os.environ.get("SLAB_ONLY", "").split(",")
    return [job(v) for v in tables()[0] if only == [""] or v in only]
