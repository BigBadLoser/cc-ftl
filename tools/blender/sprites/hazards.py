"""Hazard props (family `hazards`): looping hazards in four frames each, `<id>.f0` .. `.f3` (the renderer cycles them,
like the robot bay's assembly frames). Wall pieces mount on a run's face as wallprops.py (walls up only); the floor
piece is a one-tile prop.

  wallprop.cable.spark.<wall|hull>.<x|y>.f<n>   a burst wall panel, torn cables hanging out, sparks at their ends
                                                 (f3 dark: the sparks stutter)
  wallprop.pipes.leak.<wall|hull>.<x|y>.f<n>    the wall pipes (they join wallprop.pipes) with a split section venting
                                                 steam in puffs
  wallprop.beacon.<wall|hull>.<x|y>[.f<n>]      a red emergency beacon on a bracket, its lamp sweeping round; no
                                                 frame suffix: switched off
  prop.cable.spark.f<n>                          a severed cable bundle on the deck, its ends sparking"""
import math
import random

from .modkit import K
from .wallprops import _Face, pipes

FRAMES = 4


class _HFace(_Face):
    def cyl(self, s, d, z, r, h, col, top=None, sides=12):
        c = (s, self.yf + d, z) if self.ax == "x" else (self.yf + d, -s, z)
        self.m.cyl(c, r, h, col, sides=sides, top=top)


def _sparks(put, rnd, n, reach):
    """A burst from a point: a bright core, then sparks thrown out and falling in arcs, each with a fading trail.
    put(dx, dz, dd, size, col) places one blob (dx along the face or deck, dz up, dd out)."""
    for _ in range(4):
        put(rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02), 0.02, 0.035, rnd.choice(("arc", "flameW")))
    for _ in range(n):
        a = rnd.uniform(-0.4, math.pi + 0.4)                                          # thrown out and mostly up
        sp = rnd.uniform(0.5, 1.0) * reach * 3
        vx, vz, vd = sp * math.cos(a), sp * math.sin(a) * 0.8, rnd.uniform(0.1, 0.5) * reach * 3
        t = rnd.uniform(0.12, 0.33)
        for k, col in enumerate(("flameW", "flameY", "orange")):                    # head, then its trail
            tt = t - k * 0.04
            if tt <= 0:
                break
            put(vx * tt, vz * tt - 2.2 * tt * tt, vd * tt, 0.026 - k * 0.006, col)


def cable_spark(f, frame):
    z = 1.0
    rs = random.Random(9)
    f.box(0.0, 0.004, z, 0.6, 0.01, 0.64, "grime")                                      # scorched round the burst
    for _ in range(10):
        f.box(rs.choice((-1, 1)) * rs.uniform(0.25, 0.34), 0.005, z + rs.uniform(-0.3, 0.3), rs.uniform(0.04, 0.09),
              0.01, rs.uniform(0.04, 0.1), rs.choice(("grime", "dark")))
    f.box(0.0, 0.01, z, 0.46, 0.02, 0.5, "gmD")                                        # the panel's recess, torn open
    f.box(0.0, 0.015, z, 0.4, 0.02, 0.44, "dark")
    f.box(0.24, 0.12, z + 0.05, 0.02, 0.22, 0.36, "plate", tilt=0.5)                    # the cover hanging off a hinge
    ends = []
    for i, (s, col, ln) in enumerate(((-0.12, "dark", 0.42), (-0.04, "medRed", 0.55), (0.05, "dark", 0.36),
                                      (0.12, "polyB", 0.48))):
        f.box(s, 0.04 + 0.02 * i, z + 0.1 - ln / 2, 0.028, 0.028, ln, col)              # torn cables hanging
        hot = frame < FRAMES - 1 and i % 2 == 0
        f.box(s + 0.01, 0.05 + 0.02 * i, z + 0.1 - ln, 0.04, 0.03, 0.03, "orange" if hot else "brass")  # bare ends
        ends.append((s, 0.05 + 0.02 * i, z + 0.1 - ln))
    if frame < FRAMES - 1:
        rnd = random.Random(frame * 13 + 5)
        for s, d, ze in rnd.sample(ends, 2):
            _sparks(lambda dx, dz, dd, sz, col: f.box(s + dx, d + 0.04 + dd, ze + dz, sz, sz, sz, col), rnd, 12, 0.14)


def pipes_leak(f, frame):
    pipes(f, False)
    f.box(0.12, 0.085, 1.4, 0.07, 0.11, 0.11, "dark", bevel=0.03)                       # the split, its torn lips
    f.box(0.09, 0.13, 1.43, 0.03, 0.03, 0.03, "steelL")
    f.box(0.15, 0.13, 1.37, 0.03, 0.03, 0.03, "steelL")
    for ds, dz in ((-0.07, 0.05), (0.06, -0.05), (0.18, 0.04), (-0.02, -0.06)):     # frost round it
        f.box(0.12 + ds, 0.13, 1.4 + dz, 0.04, 0.02, 0.03, "iceB")
    rj = random.Random(frame)
    for i in range(4):                                                                # the hard jet out of it
        f.box(0.12 + rj.uniform(-0.01, 0.01), 0.16 + i * 0.05, 1.42 + i * 0.01, 0.04 + i * 0.012, 0.05,
              0.04 + i * 0.012, "medWhite", bevel=0.012)
    n = 7                                                                             # the plume: puffs a step apart,
    for k in range(n):                                                                # each moving a quarter step per
        t = (k + frame / FRAMES) / n                                                  # frame, so after four frames each
        d = 0.25 + t * 0.5                                                            # stands where the next one was:
        z = 1.44 + t ** 1.3 * 0.6                                                     # a seamless flow out and up,
        s = 0.12 - t * 0.45 + 0.05 * math.sin(t * 6.0)                                # drifting back along the run
        r = 0.07 + t * 0.22                                                           # (the next tile's wall would
        #                                                                               cover it the other way). Shape
        #                                                                               and colour: functions of t
        col = "medWhite" if t < 0.3 else ("c3W3" if t < 0.65 else "nvW2")
        subs = 3 if t < 0.85 else 2                                                   # billowing; breaking up late
        for m in range(subs):
            a = t * 9.0 + m * 2.1
            rr = r * (0.75 if m else 1.0) * (0.7 if t >= 0.85 else 1.0)
            f.box(s + 0.5 * r * math.cos(a) * (m > 0), d + 0.3 * r * math.sin(a) * (m > 0),
                  z + 0.4 * r * math.sin(a + 1) * (m > 0), rr * 1.3, rr, rr * 0.9, col, bevel=rr * 0.45)

def beacon(f, frame):
    """The lamp turns a quarter per frame: f0 its beam swept onto the wall to the left, f1 facing the camera (the dome
    blazes), f2 the beam on the right, f3 facing the wall (dim)."""
    z = 1.56
    f.box(0.0, 0.03, z - 0.03, 0.2, 0.06, 0.18, "gmD", top="gm")                        # wall plate, bracket
    f.box(0.0, 0.11, z - 0.04, 0.08, 0.14, 0.06, "steelD")
    f.cyl(0.0, 0.2, z - 0.06, 0.1, 0.05, "gmD", top="gm")                               # base
    lit = frame is not None
    face = lit and frame == 1
    dome = "red" if face else ("emR" if lit else "rustD")
    f.cyl(0.0, 0.2, z - 0.01, 0.085, 0.15, dome, top=dome)                              # the dome
    for a in range(4):                                                                # its cage
        aa = a * math.pi / 2 + math.pi / 4
        f.box(0.09 * math.cos(aa), 0.2 + 0.09 * math.sin(aa), z + 0.065, 0.02, 0.02, 0.16, "steelD")
    f.cyl(0.0, 0.2, z + 0.14, 0.095, 0.025, "steelD", top="gm")
    if lit and frame in (0, 2):                                                       # the beam fanned across the
        sg = -1 if frame == 0 else 1                                                  # wall, brightest by the lamp
        rf = random.Random(frame)
        for i in range(10):                                                          # within its own wall tile
            x = 0.12 + i * 0.04
            half = 0.03 + 0.22 * (x - 0.1)
            for j in range(-int(half / 0.035), int(half / 0.035) + 1):
                if rf.random() < (x - 0.3) * 2.5:                                    # solid, thinning at its far end
                    continue
                f.box(sg * x, 0.006, z + 0.05 + j * 0.035, 0.04, 0.008, 0.035, "red" if x < 0.3 else "emR")
        f.box(sg * 0.07, 0.2, z + 0.06, 0.06, 0.06, 0.07, "red")
    elif face:                                                                        # facing out: a halo round it
        for a in range(16):
            aa = a * math.tau / 16
            f.box(0.17 * math.cos(aa), 0.006, z + 0.06 + 0.14 * math.sin(aa), 0.05, 0.008, 0.05, "emR")
    elif lit:                                                                         # facing the wall: a hot spot
        for a in range(10):                                                           # on it behind the lamp
            aa = a * math.tau / 10
            f.box(0.09 * math.cos(aa), 0.006, z + 0.06 + 0.08 * math.sin(aa), 0.06, 0.008, 0.06, "red")

def floor_spark(frame):
    k = K(f"floor_spark_{frame}", (1, 1))
    rnd = random.Random(3)
    ends = []
    for i, col in enumerate(("dark", "medRed", "dark", "polyB", "gmD")):              # a severed bundle across the deck
        a = 0.5 + rnd.uniform(-0.25, 0.25)
        ln = rnd.uniform(0.35, 0.55)
        u0, v0 = -0.3 + i * 0.02, -0.2 + i * 0.05
        k.box(u0 + math.cos(a) * ln / 2, v0 + math.sin(a) * ln / 2, 0.0, ln, 0.035, 0.035, col, rz=a)
        e = (u0 + math.cos(a) * ln, v0 + math.sin(a) * ln)
        k.box(e[0], e[1], 0.0, 0.05, 0.04, 0.04, "brass", rz=a)
        ends.append(e)
    k.box(-0.32, -0.22, 0.0, 0.14, 0.14, 0.05, "gmD", top="steelD", rz=0.5)             # the torn clamp
    if frame < FRAMES - 1:
        r2 = random.Random(frame * 11 + 2)
        for u, v in r2.sample(ends, 2):
            _sparks(lambda dx, dz, dd, sz, col: k.box(u + dx, v + dd, max(0.01, 0.04 + dz), sz, sz, sz, col),
                    r2, 10, 0.16)
    return k.build()


def _wall(fn, fam, ax, frame):
    f = _HFace(f"haz_{fn.__name__}_{fam}_{ax}_{frame}", ax, fam)
    fn(f, frame)
    return f.build()


SPRITES = []
for _fam in ("wall", "hull"):
    for _ax in ("x", "y"):
        for _name, _fn in (("cable.spark", cable_spark), ("pipes.leak", pipes_leak), ("beacon", beacon)):
            for _i in range(FRAMES):
                SPRITES.append((f"wallprop.{_name}.{_fam}.{_ax}.f{_i}", (1, 1), "block",
                                lambda fn=_fn, fam=_fam, ax=_ax, i=_i: _wall(fn, fam, ax, i)))
        SPRITES.append((f"wallprop.beacon.{_fam}.{_ax}", (1, 1), "block",
                        lambda fam=_fam, ax=_ax: _wall(beacon, fam, ax, None)))
for _i in range(FRAMES):
    SPRITES.append((f"prop.cable.spark.f{_i}", (1, 1), "prop", lambda i=_i: floor_spark(i)))
