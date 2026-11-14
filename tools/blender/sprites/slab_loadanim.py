"""Stasis wheel loading animation, prototype (family `stasisload`, preview only; issue #116).

A slab stowed at the hatch is a short strip of PATCHES drawn over the wheel's base, not a re-render of the whole wheel:
every frame renders the whole wheel in that pose once and keeps only the pixels that differ from the shut, empty
base (the same poses as slab_load.py: the leaves part, the cradle rises with the slab flat on it, tips it up,
sinks, the shuttle runs it in and turns it to the ring's angle, the leaves shut). So a patch is the part of the picture
that moved, anchored on the wheel's origin like the slot layers (`module.stasis_wheel.slot<i>`), and the game draws it
between the slabs and the rim lamps.

  stasisload.base       the shut, empty wheel (as slab_game's base, the reference the patches are cut from)
  stasisload.slot0      slot 0's slab alone (as slab_game's slot layer), where the run-in ends
  stasisload.h<n>       the hatch frame n: leaves, platform, cradle, slab on its way in
  stasisload.s<n>       the Geneva star's index frame n (the crank swings round once, the star steps 36 deg)

The star's art is `geneva` of slab_wheel.py with a crank phase added here (`geneva_phase`), so the stasis family's
cached sprites stay untouched."""
import math

import numpy as np

from . import core, post
from . import env_build as E
from . import slab_load as LD
from . import slab_wheel as W
from .modkit import K
from .slab_bay import fittings
from .slab_kit import angles, at, cassette, floor_fill, frame, prism, tube
from .slab_study import PAL, Slab, beam
from .recovery_study import SAMPLES, layer

FP = (3, 3)
A = "stasisload"
ALL = tuple(range(10))
TOL = 14                                            # a pixel counts as changed when a channel moves by more than this

# Hatch frames: (cradle tilt deg, platform z, leaves shut 0..1, slab). slab: None | "home" | ("cradle",) | ("slide", t, f)
HATCH = [
    (0, LD.DEEP, 0.5, None),                        # h0  the leaves part
    (90, -0.55, 0.0, None),                         # h1  the cradle rises out of the shaft, folded flat
    (90, 0.0, 0.0, ("cradle",)),                    # h2  flush: the slab is on it (the cart's slab is gone: stowSlab)
    (60, 0.0, 0.0, ("cradle",)),                    # h3  the cradle tips it up
    (30, 0.0, 0.0, ("cradle",)),                    # h4
    (0, 0.0, 0.0, ("cradle",)),                     # h5  upright
    (0, -0.3, 0.0, ("cradle",)),                    # h6  the platform sinks
    (0, LD.SINK, 0.0, ("cradle",)),                 # h7  the slab's foot at the ring's
] + [(0, LD.SINK + (LD.DEEP - LD.SINK) * min(1.0, (j / 8) / 0.4), 0.0, ("slide", j / 8, max(0.0, (j / 8 - 0.4) / 0.6)))
     for j in (2, 4, 6, 8)] + [                     # h8-h11 the shuttle runs it in and turns it
    (0, LD.DEEP, 0.5, "home"),                      # h12 the leaves close over it (then the base and slot 0's layer)
]
# Star frames: the crank's angle (deg) from mid-step. The pin is in the star's slot for |phi| < 72, where the star turns
# (up to 18 deg either way); out of it the star stands locked while the crank swings on round to the next slot.
STAR = [36, 72, 144, 216, -72, -36]


def star_turn(phi, c, cr):
    """The star's angle (rad) from mid-step when the crank is `phi` (rad) round, held once the pin has left the slot."""
    lim = math.radians(72)
    p = max(-lim, min(lim, math.remainder(phi, math.tau)))
    return -math.atan2(cr * math.sin(p), c - cr * math.cos(p))


def geneva_phase(phi):
    """slab_wheel.geneva with the crank `phi` degrees round from its resting (mid-step) place."""
    def geneva(k, ang, body, trim, z=W.ZT, rs=0.78, h=0.05, bridge=None, pad=True, star=("steelD", "steelL"), motor=True):
        n = W.NS
        c = rs / math.cos(math.pi / n)
        cr = c * math.sin(math.pi / n)
        rl = 0.256 * rs
        ph = math.radians(phi)
        th = star_turn(ph, c, cr)
        if pad:
            k.cyl(0, 0, z, rs - 0.1, 0.012, "dark", sides=32)
        for i in range(n):
            m = ang + th + (i + 0.5) * math.tau / n

            def ro(b, m=m):
                p = math.remainder(b - m, math.tau)
                s = c * math.sin(p)
                return min(rs, c * math.cos(p) - math.sqrt(rl * rl - s * s)) if abs(s) < rl else rs
            sl = 0.045 / rs
            a0, a1 = m - math.pi / n + sl, m + math.pi / n - sl
            for j in range(8):
                b0, b1 = a0 + (a1 - a0) * j / 8, a0 + (a1 - a0) * (j + 1) / 8
                prism(k, [at(0.64 * rs, b0)[:2], at(ro(b0), b0)[:2], at(ro(b1), b1)[:2], at(0.64 * rs, b1)[:2]], z, z + h,
                      star[0], top=star[1])
        k.cyl(0, 0, z, 0.667 * rs, h, star[0], top=star[1], sides=30)
        for i in range(10):
            k.cyl(*at(0.49 * rs, (i + 0.5) * math.tau / 10 + ang + th)[:2], z + h, 0.03, 0.015, "steelD", sides=6)
        k.cyl(0, 0, z + h, 0.31 * rs, 0.03, "steelD", top="steel", sides=16)
        k.cyl(0, 0, z + h + 0.03, 0.1, 0.02, trim, sides=12)
        d = at(c, ang)
        k.cyl(d[0], d[1], z, 0.07, h + 0.05, "steel", sides=10)
        hp = [at(rl - 0.02, ang + ph + math.pi / 2 + j * math.pi / 10) for j in range(11)]
        prism(k, [(d[0] + u, d[1] + v) for u, v, _ in hp], z, z + h, "steelL", top="steel")
        po = at(cr, ang + ph + math.pi)                                      # the pin: round the driver's shaft
        pin = (d[0] + po[0], d[1] + po[1])
        beam(k, (d[0], d[1], z + h + 0.035), (pin[0], pin[1]), 0.08, 0.03, trim, top=trim)
        k.cyl(pin[0], pin[1], z + 0.005, 0.032, h + 0.05, "steelL", sides=8)
        g = at(c + 0.3, ang)
        k.box(g[0], g[1], z, 0.26, 0.4, 0.11, trim, top=trim, rz=ang)
        t = ang + math.pi / 2
        if motor:
            e0 = (g[0] + 0.17 * math.cos(t), g[1] + 0.17 * math.sin(t), z + 0.06)
            e1 = (g[0] + 0.5 * math.cos(t), g[1] + 0.5 * math.sin(t), z + 0.06)
            tube(k, e0, e1, 0.065, "steelD", sides=12)
            for j in range(2):
                f = 0.27 + j * 0.12
                tube(k, (g[0] + f * math.cos(t), g[1] + f * math.sin(t), z + 0.06),
                     (g[0] + (f + 0.05) * math.cos(t), g[1] + (f + 0.05) * math.sin(t), z + 0.06), 0.085, "steelD", sides=12)
        beam(k, (d[0], d[1], z + h + 0.02), (g[0], g[1]), 0.06, 0.02, "steelD")
        if bridge:
            beam(k, at(c - 0.1, ang, z - 0.03), at(bridge, ang)[:2], 0.4, 0.06, "steelD", top="steel")
    return geneva


def wheel(hatch=None, phi=0.0):
    """The wheel (every socket empty, as slab_game's base) with the hatch in pose `hatch`, the star's crank at `phi`."""
    tilt, pz, leaves, sl = hatch or (0, LD.DEEP, 1.0, None)
    t = math.radians(tilt)
    k = K("stasis_load", FP, 0)
    old = W.geneva
    W.geneva = geneva_phase(phi) if phi else old
    try:
        W.geneva_over_tyres(k, LD.P, lights=LD.LAMP, empty=ALL, gap=LD.GAP, windows=2, lamps=True)
    finally:
        W.geneva = old
    fittings(k, ALL)
    LD.hatch(k, pz, leaves)
    if leaves < 1:
        bed = LD.pose(pz + 0.12 + (LD.BED - 0.12) * math.sin(t), t)
        LD.cradle(k, bed, pz)
        if sl == "home":
            cassette(k, frame(angles()[0], W.Z0))
        elif sl and sl[0] == "cradle":
            cassette(k, bed)
        elif sl:
            o = at(LD.HC + (W.R0 - LD.HC) * sl[1], LD.ST, W.Z0)
            s = Slab(o, LD.UP, LD.rot(LD.ET, LD.UP, math.radians(-40) * sl[2]))
            s.box(k, -0.12, 0.0, -0.42, 0.42, -LD.T - 0.06, 0.06, "steelD", face="hazY")
            cassette(k, s)
    objs = k.build()
    f = K("stasis_load_floor", FP, 0)
    floor_fill(f, LD.r_hole, -0.04, 0.0, "dark", half=4.0)
    for o in f.build():
        o.is_holdout = True
        objs.append(o)
    return objs


def shot(build):
    core.clear_scene_meshes()
    post.select(PAL)
    c, op, g, ox, oy, _ = E.render_sprite("x", "prop", build())
    return c, op, g, ox, oy


_BASE = []


def base_shot():
    if not _BASE:
        _BASE.append(shot(wheel))
    return _BASE[0]


def onto(b, ox, oy, left, top, w, h):
    """Array b (rows, cols, ...) placed on a zero canvas of w x h with its origin (ox, oy) at (left, top)."""
    out = np.zeros((h, w) + b.shape[2:], b.dtype)
    y, x = top - oy, left - ox
    out[y:y + b.shape[0], x:x + b.shape[1]] = b
    return out


def box(m, r):
    """Count of True in the (2r+1)^2 window round each pixel."""
    p = np.pad(m.astype(np.int32), r)
    out = np.zeros(m.shape, np.int32)
    for dy in range(2 * r + 1):
        for dx in range(2 * r + 1):
            out += p[dy:dy + m.shape[0], dx:dx + m.shape[1]]
    return out


def real(d):
    """Changed pixels that are a moved object, not the render's grain: dense (5x5 window), then grown 2 px to keep its edge."""
    dense = d & (box(d, 2) >= 9)
    return d & (box(dense, 2) > 0)


def patch(aid, build):
    """The pixels of `objs`' wheel that differ from the base, as an item anchored on the wheel's origin, with a report."""
    bc, bop, bg, bx, by = base_shot()
    c, op, g, ox, oy = shot(build)
    left, top = max(bx, ox), max(by, oy)
    w = left + max(bop.shape[1] - bx, op.shape[1] - ox)
    h = top + max(bop.shape[0] - by, op.shape[0] - oy)
    B = [onto(a, bx, by, left, top, w, h) for a in (bc, bop, bg)]
    F = [onto(a, ox, oy, left, top, w, h) for a in (c, op, g)]
    d = np.abs(B[0].astype(int) - F[0].astype(int)).max(-1) > TOL
    d |= B[1] != F[1]
    d |= np.abs(B[2].astype(int) - F[2].astype(int)).max(-1) > TOL
    d = real(d)
    holes = int((d & B[1] & ~F[1]).sum())            # opaque in the base, empty now (a patch cannot erase)
    keep = d & F[1]
    gl = np.where(keep[..., None], F[2], 0).astype(F[2].dtype)
    it = E.crop_item(aid, FP, F[0], keep, gl, left, top)
    return it, {"changed": int(keep.sum()), "holes": holes}


def named(it, aid):
    it = dict(it) if it else {"rgba": np.zeros((1, 1, 4), np.uint8), "g": np.zeros((1, 1, 4), np.uint8), "ax": 0, "ay": 0}
    it["id"], it["fp"] = aid, FP
    return it


def job(kind, n):
    def run(kind=kind, n=n):
        import bpy
        bpy.context.scene.cycles.samples = core.SAMPLES if core.PREVIEW else SAMPLES
        try:
            return render(kind, n)
        finally:
            W.VIEW[0] = 0
            bpy.context.scene.cycles.samples = core.SAMPLES
    return run


def render(kind, n):
    if kind == "base":
        c, op, g, ox, oy = base_shot()
        return [named(E.crop_item("x", FP, c, op, g, ox, oy), f"{A}.base")]
    if kind == "slot0":
        core.clear_scene_meshes()
        post.select(PAL)
        k = K("stasis_load_slot0", FP, 0)
        cassette(k, frame(angles()[0], W.Z0))
        return [named(layer(wheel(), k.build(), 255), f"{A}.slot0")]
    if kind == "lamp0":
        core.clear_scene_meshes()
        post.select(PAL)
        k = K("stasis_load_lamp0", FP, 0)
        W.rim_lamp(k, angles()[0], "slbLmp")
        return [named(layer(wheel(), k.build(), 255), f"{A}.lamp0")]
    it, rep = patch(f"{A}.{kind}{n}", (lambda: wheel(HATCH[n])) if kind == "h" else (lambda: wheel(phi=STAR[n])))
    print("PATCH", kind, n, rep, it["rgba"].shape if it else None, flush=True)
    return [named(it, f"{A}.{kind}{n}")]


def jobs():
    return [job("base", 0), job("slot0", 0), job("lamp0", 0)] + [job("h", n) for n in range(len(HATCH))] + [job("s", n) for n in range(len(STAR))]
