"""REFINERY (module.refinery, 3x4, family `refinery`): raw ore in, metal and electronics out. Local frame and placement:
modkit.K, u across the 3-tile width, v along the 4-tile length. The access tile is beside the +u long side at v -0.5
(sim access [3, 1]), so the control panel stands there, facing +u.

Flow along v: an intake hopper raised on a frame at the +v end, ore heaped in it, a feed chute into the furnace; the
furnace in the middle, a drum banded in hazard yellow with a ring of viewport slots and an exhaust stack; its pour spout
over a casting bench at the -v end, moulds of ingots on it and a rack of finished boards beside the panel.

States: idle (glow off, panels dark) and .active.f0..f2, a loop: the molten core through the slots, the pour stream, the
fresh ingot glowing in its mould, sparks off the pour, the panel lit. Wear is ore_cage's palette staining."""
import math

import numpy as np

from .modkit import K
from .ore_cage import ORES, Wear, _lump, _poly

FP = (3, 4)
ACCESS = (2.0, -0.5)
CORE = (0.0, 0.25, 0.72)                  # furnace centre (u, v) and radius
CORE_H = 1.5
SLOTS = (0.62, 0.86)                     # the viewport ring
HOP = (0.0, 1.5)                        # hopper centre
HOP_Z = (0.95, 1.75)                     # hopper bottom and top
HOP_R = (0.2, 0.48)                      # its half widths there
BENCH = (-1.98, -0.62, 0.55)             # casting bench v0, v1 and height
YEL, YEL_D = "c4T2", "c4T4"
MOLTEN = (("flameY", "orange", "orange"), ("orange", "flameY", "orange"), ("orange", "orange", "flameY"))   # per frame


def _box(k, w, u, v, z, su, sv, sz, col, top=None, **kw):
    k.box(u, v, z, su, sv, sz, w(col, u, v, z), top=w(top, u, v, z + sz) if top else None, **kw)


def base(k, w):
    """A plinth of girders under the whole machine (intentional: it is bolted down on a skid)."""
    for u in (-1.32, 1.32):
        _box(k, w, u, 0.0, 0.0, 0.16, 3.84, 0.12, "steelD", top="steel")
    for v in (-1.84, -0.6, 0.6, 1.84):
        _box(k, w, 0.0, v, 0.0, 2.5, 0.16, 0.12, "steelD", top="steel")
    k.box(0.0, 0.0, 0.0, 2.5, 3.6, 0.1, "plateC")


def funnel(k, w, cu, cv, z0, z1, r0, r1, col, t=0.04):
    """A square hopper: four sloped sides, open at the top, a rim; the inner faces inset by t."""
    corners = ((-1, -1), (1, -1), (1, 1), (-1, 1))

    def ring(r, z):
        return [(cu + a * r, cv + b * r, z) for a, b in corners]
    ob, ot, ib, it = ring(r0, z0), ring(r1, z1), ring(r0 - t, z0 + t), ring(r1 - t, z1)
    for i in range(4):
        j = (i + 1) % 4
        mid = ((ob[i][0] + ob[j][0]) / 2, (ob[i][1] + ob[j][1]) / 2)
        _poly(k, [ob[i], ob[j], ot[j], ot[i]], w(col, mid[0], mid[1], (z0 + z1) / 2))
        _poly(k, [it[i], it[j], ib[j], ib[i]], "steelD")
        _poly(k, [ot[i], ot[j], it[j], it[i]], ("hazY", "hazK")[i % 2])
    _poly(k, ib, "dark")


def hopper(k, w, fill=True):
    cu, cv = HOP
    for a in (-1, 1):                                                          # the frame it stands on
        for b in (-1, 1):
            _box(k, w, cu + a * 0.42, cv + b * 0.42, 0.1, 0.1, 0.1, HOP_Z[0] + 0.22, "steel", top="steelD")
    for z in (0.45, HOP_Z[0] + 0.12):
        _box(k, w, cu, cv - 0.42, z, 0.94, 0.08, 0.08, "steelD", top="steel")
        _box(k, w, cu, cv + 0.42, z, 0.94, 0.08, 0.08, "steelD", top="steel")
        _box(k, w, cu - 0.42, cv, z, 0.08, 0.94, 0.08, "steelD", top="steel")
        _box(k, w, cu + 0.42, cv, z, 0.08, 0.94, 0.08, "steelD", top="steel")
    funnel(k, w, cu, cv, HOP_Z[0], HOP_Z[1], HOP_R[0], HOP_R[1], YEL)
    if fill:                                                                   # ore heaped in it
        rng, o = np.random.default_rng(5), ORES["iron"]
        r = HOP_R[1] - 0.08
        _poly(k, [(cu - r, cv - r, HOP_Z[1] - 0.1), (cu + r, cv - r, HOP_Z[1] - 0.1), (cu + r, cv + r, HOP_Z[1] - 0.1),
                  (cu - r, cv + r, HOP_Z[1] - 0.1)], "orD")
        for _ in range(16):
            s = rng.uniform(0.04, 0.08)
            _lump(k, (cu + rng.uniform(-r, r) * 0.9, cv + rng.uniform(-r, r) * 0.9, HOP_Z[1] - 0.1), (0, 0, 1), s, s,
                  o["chunk"][rng.integers(3)], rng)
    # the feed chute: from the hopper's neck, sloping down into the furnace's upper side
    _box(k, w, cu, cv - 0.25, HOP_Z[0] - 0.08, 0.3, 0.42, 0.14, "steelD", top=YEL_D, rx=0.45)


def furnace(k, w, frame):
    cu, cv, R = CORE
    k.cyl(cu, cv, 0.1, R + 0.06, 0.18, w("steelD", cu, cv, 0.1), top="steel", sides=20)            # foot ring
    k.cyl(cu, cv, 0.28, R, SLOTS[0] - 0.28, w("steel", cu, cv, 0.3), top="steel", sides=20)         # lower body
    k.cyl(cu, cv, 0.4, R + 0.02, 0.1, YEL_D, sides=20)                                              # hazard band
    k.cyl(cu, cv, SLOTS[0], R - 0.04, SLOTS[1] - SLOTS[0], "dark", sides=20)                        # behind the slots
    n = 10
    for i in range(n):                                                         # the viewport ring: posts between slots
        a = (i + 0.5) * math.tau / n
        k.box(cu + R * math.cos(a), cv + R * math.sin(a), SLOTS[0], 0.12, 0.26, SLOTS[1] - SLOTS[0], "steelD",
              rz=a)
    if frame is not None:                                                     # molten, seen through the slots
        cols = MOLTEN[frame]
        for i in range(n):
            a = i * math.tau / n
            k.box(cu + (R - 0.05) * math.cos(a), cv + (R - 0.05) * math.sin(a), SLOTS[0] + 0.02, 0.06, 0.3,
                  SLOTS[1] - SLOTS[0] - 0.04, cols[i % 3], rz=a)
    k.cyl(cu, cv, SLOTS[1], R, CORE_H - SLOTS[1], w("steel", cu, cv, 1.1), top="steelD", sides=20)  # upper body
    for z in (1.02, 1.22):                                                     # cooling fins
        k.cyl(cu, cv, z, R + 0.07, 0.05, "steelD", top="steelL", sides=20)
    k.cyl(cu, cv, CORE_H, R, 0.22, "steelD", top="steel", sides=20, rtop=R * 0.55)                 # domed cap
    su, sv = cu - 0.28, cv - 0.18                                              # exhaust stack
    k.cyl(su, sv, CORE_H + 0.1, 0.13, 0.7, w("steel", su, sv, 1.9), top="dark", sides=10)
    k.cyl(su, sv, CORE_H + 0.62, 0.16, 0.08, YEL_D, top="dark", sides=10)
    for a in (0.6, 2.2, 4.0):                                                  # bolted access hatches round the body
        k.box(cu + (R + 0.01) * math.cos(a), cv + (R + 0.01) * math.sin(a), 0.32, 0.03, 0.3, 0.22, "steelL", rz=a)
    # pour spout toward the bench (-v), with its glow lamp
    k.box(cu, cv - R - 0.12, 0.66, 0.16, 0.36, 0.1, "steelD", top="steel")
    k.box(cu, cv - R - 0.28, 0.6, 0.12, 0.08, 0.08, "dark")


def bench(k, w, frame):
    """The casting bench: a line of moulds under the spout (the first one being poured), cooled ingots stacked at the
    end, and a rack of finished boards beside the panel."""
    v0, v1, h = BENCH
    _box(k, w, -0.1, (v0 + v1) / 2, 0.1, 1.5, v1 - v0, h - 0.1, "steel", top="steelD")
    k.box(-0.1, (v0 + v1) / 2, h, 1.6, v1 - v0 + 0.06, 0.04, YEL_D, top="steelD")
    for i, v in enumerate((-0.86, -1.18, -1.5, -1.82)):                         # moulds; the first under the spout
        k.box(0.0, v, h + 0.04, 0.4, 0.26, 0.08, "dark", top="steelD")
        hot = frame is not None and i == 0
        if i < 3:
            k.box(0.0, v, h + 0.09, 0.3, 0.16, 0.05, MOLTEN[frame][1] if hot else ("brass", "steelL", "steelL")[i])
    for j in range(3):                                                         # ingots stacked at the end
        k.box(-0.62, -1.7 + 0.02 * j, h + j * 0.07, 0.3 if j % 2 else 0.14, 0.14 if j % 2 else 0.3, 0.06, "steelL",
              top="plate")
    rack = (0.95, -1.45)                                                       # boards rack, beside the panel
    _box(k, w, rack[0], rack[1], 0.1, 0.4, 0.7, 0.06, "steelD")
    for s in (-1, 1):
        _box(k, w, rack[0], rack[1] + s * 0.33, 0.1, 0.4, 0.04, 0.9, "steel", top="steelL")
    for j in range(4):
        z = 0.24 + j * 0.2
        k.box(rack[0], rack[1], z, 0.38, 0.62, 0.025, "steelD")
        if j < 3:
            k.box(rack[0], rack[1] + 0.04 * (j - 1), z + 0.025, 0.26, 0.42, 0.02, "pcb")
    if frame is not None:                                                     # the pour stream and its sparks
        cu, cv, R = CORE
        k.cyl(cu, cv - R - 0.28, h + 0.05, 0.03, 0.6 - h - 0.05, MOLTEN[frame][0], sides=6)
        rng = np.random.default_rng(70 + frame)
        for _ in range(7):
            a = rng.uniform(0, math.tau)
            r = rng.uniform(0.12, 0.34)
            z = h + 0.08 + rng.uniform(0.0, 0.3)
            k.box(cu + r * math.cos(a), -0.86 + r * math.sin(a) * 0.6, z, 0.03, 0.03, 0.03, ("flameW", "flameY")[_ % 2])


def panel(k, w, on):
    """The control panel at the access tile: a pedestal, its screen sloped toward the operator (+u), buttons, a lamp."""
    u, v = 1.24, ACCESS[1]
    k.box(u, v, 0.1, 0.3, 0.6, 0.72, "steel", top="steelD")
    k.box(u - 0.04, v, 0.1, 0.38, 0.66, 0.1, "steelD")
    a, b = (u - 0.13, u + 0.17), (0.98, 0.8)                                   # the sloped face: back high, front low
    _poly(k, [(a[0], v + 0.3, b[0]), (a[0], v - 0.3, b[0]), (a[1], v - 0.3, b[1]), (a[1], v + 0.3, b[1])], "steelD")
    _poly(k, [(a[0], v - 0.3, b[0]), (a[0], v - 0.3, 0.82), (a[1], v - 0.3, 0.82), (a[1], v - 0.3, b[1])], "steel")
    _poly(k, [(a[1], v + 0.3, b[1]), (a[1], v + 0.3, 0.82), (a[0], v + 0.3, 0.82), (a[0], v + 0.3, b[0])], "steel")
    _poly(k, [(a[1], v - 0.3, b[1]), (a[1], v - 0.3, 0.82), (a[1], v + 0.3, 0.82), (a[1], v + 0.3, b[1])], "steel")

    def on_face(t, s, d=0.012):                                                # a point on the sloped face
        return (a[0] + (a[1] - a[0]) * t + d * 0.6, v + s, b[0] + (b[1] - b[0]) * t + d)
    scr = "cyan" if on else "dark"
    _poly(k, [on_face(0.12, 0.24), on_face(0.12, -0.12), on_face(0.62, -0.12), on_face(0.62, 0.24)], scr)
    for i, c in enumerate(("red", "flameY", "cyan")):                          # buttons
        p = on_face(0.82, 0.18 - i * 0.14, 0.02)
        k.box(p[0], p[1], p[2] - 0.015, 0.05, 0.06, 0.03, c if on else "steelD")
    k.cyl(u - 0.1, v - 0.26, 0.98, 0.035, 0.08, "orange" if on else "rustD", sides=6)                # status lamp


def pipes(k, w):
    """Two pipes from the furnace's shoulder over to the bench end, on short stands."""
    cu, cv, R = CORE
    for s, col in ((-1, "steelL"), (1, YEL_D)):
        u = cu + s * 0.5
        k.box(u, -0.66, 1.12, 0.1, 0.78, 0.1, col)
        k.box(u, -1.0, 0.55, 0.1, 0.1, 0.67, col)


def refinery(rot, frame=None):
    """frame None: idle; 0..2: the active loop."""
    k = K(f"refinery_{rot}_{frame}", FP, rot)
    w = Wear(91, amount=0.8, dust=False)
    base(k, w)
    furnace(k, w, frame)
    hopper(k, w)
    bench(k, w, frame)
    pipes(k, w)
    panel(k, w, frame is not None)
    return k.build()


ID = "module.refinery"


def jobs():
    out = []
    for r in range(4):
        fp = FP if r % 2 == 0 else FP[::-1]
        sfx = "" if r == 0 else f".r{r}"
        out.append((f"{ID}{sfx}", fp, "prop", lambda r=r: refinery(r)))
        out += [(f"{ID}{sfx}.active.f{i}", fp, "prop", lambda r=r, i=i: refinery(r, i)) for i in range(3)]
    return out
