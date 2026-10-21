"""More derelict dressing (family `decay`), in the style of derelict.py (grid frame, origin = the tile centre at floor
level).

Props (kind prop, one tile, no footprint):
- decay.debris.ceiling: a fallen ceiling panel propped on its bent T-bar, a broken piece, the dead strip light;
- decay.debris.glass: a shattered screen or viewport pane, its frame on the deck, shards scattered round it;
- decay.debris.parts: spilled parts: a gear, nuts and bolts, a circuit board, a servo, a spanner, a spring.
Floor decals (kind block, drawn on top of the tile; flat, so tones are exactly the palette's):
- decay.frost.floor.v0 / .v1: an ice sheet with crystal spikes and a rime edge;
- decay.blood.floor.v0 .. v2: a pool, a splatter, a drag trail (dried dark at the rims);
- decay.oil.floor.v0 / .v1: a black slick with a thin sheen;
- decay.scratch.floor.v0 / .v1: claw gouges; scrapes where something heavy was dragged."""
import math
import random

from . import core
from .derelict import _path, bd, decal

# ---- props ---------------------------------------------------------------------------------------------------------


def debris_ceiling():
    m = core.Mesh("debris_ceiling")
    m.box((0.18, 0.12, 0.0), (0.04, 0.6, 0.03), "steelL", rz=0.3, rx=0.5, base=True)                   # bent T-bar
    m.box((-0.05, 0.0, 0.12), (0.62, 0.62, 0.03), "c3W4", top="c3W2", rz=0.3, ry=0.35, bevel=0.006)     # panel on it
    m.box((-0.3, 0.3, 0.0), (0.3, 0.22, 0.025), "c3W4", top="c3W3", rz=-0.6, base=True)                 # broken piece
    m.box((0.12, -0.32, 0.0), (0.5, 0.09, 0.06), "gmD", top="gm", rz=0.15, base=True)                   # strip light
    m.box((0.12, -0.32, 0.06), (0.44, 0.05, 0.012), "glassD", rz=0.15, base=True)
    _path(m, [(0.36, -0.3), (0.42, -0.18), (0.38, -0.05)], 0.0, 0.03, "strap")                          # its cable
    rnd = random.Random(4)
    for _ in range(9):                                                                                # crumbs of tile
        s = rnd.uniform(0.025, 0.05)
        x, y = rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4)
        m.box((x, y, 0.0), (s, s, s * 0.6), "c3W3", rz=rnd.random(), base=True)
    return [m.build()]


def debris_glass():
    m = core.Mesh("debris_glass")
    rz = -0.25
    c, s = math.cos(rz), math.sin(rz)
    for (dx, dy, sx, sy) in ((0, -0.22, 0.6, 0.05), (0, 0.22, 0.6, 0.05), (-0.28, 0, 0.05, 0.44),
                             (0.28, 0, 0.05, 0.44)):
        m.box((dx * c - dy * s, dx * s + dy * c, 0.0), (sx, sy, 0.05), "gmD", top="gm", rz=rz, base=True)   # frame
    rnd = random.Random(7)
    for i in range(14):                                                                               # shards left in
        dx, dy = rnd.uniform(-0.24, 0.24), rnd.uniform(-0.18, 0.18)                                     # it and thrown
        if i > 6:                                                                                     # round it
            a, r = rnd.uniform(0, math.tau), rnd.uniform(0.32, 0.46)
            dx, dy = r * math.cos(a), r * math.sin(a) * 0.9
        x, y = dx * c - dy * s, dx * s + dy * c
        w = rnd.uniform(0.05, 0.13) if i <= 6 else rnd.uniform(0.03, 0.07)
        m.box((x, y, 0.0 if i > 6 else 0.02), (w, w * rnd.uniform(0.3, 0.7), 0.01), "glassL",
              top=rnd.choice(("lens", "iceB", "glassL", "c3W1")), rz=rnd.uniform(0, math.pi), base=True,
              rx=rnd.uniform(-0.3, 0.3))
    for (x, y, a) in ((-0.12, 0.05, 0.9), (0.15, -0.04, -0.7)):                                       # two standing up
        m.box((x, y, 0.02), (0.1, 0.012, 0.1), "glassL", top="iceB", rz=0.4, rx=a * 0.3, base=True)
    return [m.build()]


def debris_parts():
    m = core.Mesh("debris_parts")
    m.cyl((-0.2, -0.15, 0.0), 0.12, 0.04, "steel", top="steelL", sides=14)                              # a gear
    for k in range(10):
        a = k * math.tau / 10
        m.box((-0.2 + 0.13 * math.cos(a), -0.15 + 0.13 * math.sin(a), 0.0), (0.04, 0.04, 0.04), "steel", top="steelL",
              rz=a, base=True)
    m.cyl((-0.2, -0.15, 0.04), 0.035, 0.005, "dark", sides=8)
    m.box((0.18, -0.12, 0.0), (0.24, 0.17, 0.02), "pcb", top="pcb", rz=0.5, base=True)                  # circuit board
    for (x, y) in ((0.15, -0.1), (0.22, -0.16), (0.2, -0.05)):
        m.box((x, y, 0.02), (0.05, 0.04, 0.02), "dark", rz=0.5, base=True)
    m.box((0.05, 0.22, 0.0), (0.16, 0.12, 0.1), "medRed", top="drM", rz=-0.3, base=True, bevel=0.01)    # a servo
    m.cyl((0.14, 0.2, 0.03), 0.04, 0.05, "steelL", sides=10)
    m.box((-0.25, 0.22, 0.0), (0.3, 0.05, 0.02), "steelL", top="sole", rz=0.6, base=True)               # a spanner
    m.box((-0.37, 0.14, 0.0), (0.08, 0.08, 0.02), "steelL", top="sole", rz=0.6, base=True)
    for k in range(5):                                                                                # a spring
        m.cyl((0.32 + k * 0.025, 0.15, 0.03), 0.03, 0.012, "brass", sides=8)
    rnd = random.Random(11)
    for _ in range(9):                                                                                # nuts and bolts
        x, y = rnd.uniform(-0.42, 0.42), rnd.uniform(-0.42, 0.42)
        if rnd.random() < 0.5:
            m.cyl((x, y, 0.0), 0.022, 0.02, "steelD", top="steelL", sides=6)
        else:
            m.box((x, y, 0.0), (0.09, 0.025, 0.025), "steelL", rz=rnd.uniform(0, math.pi), base=True)
    return [m.build()]


# ---- floor decals --------------------------------------------------------------------------------------------------

FROST = [[((0.0, 0.0), 0.36, [(3, 0.12, 0.4), (5, 0.07, 1.3)], (1.2, 0.9))],
         [((-0.12, 0.05), 0.26, [(2, 0.14, 0.9)], (1, 1)), ((0.18, -0.1), 0.18, [(4, 0.1, 0.2)], (1, 1))]]


def frost(v):
    def fn(x, y):
        d = min(bd(x, y, b) for b in FROST[v])
        if d > 1.12:
            return None
        th = math.atan2(y, x)
        spike = abs(math.sin(th * 7 + 0.5)) > 0.94 and d > 0.35                      # crystal spikes running out
        if d > 1.0:
            return "iceB" if spike or (int(x * 97 + y * 61) % 3 == 0) else None      # the rime: ragged
        if spike:
            return "medWhite"
        return "c3W1" if d > 0.75 else ("iceB" if d > 0.4 else "lens")
    return [decal(f"frost_floor_{v}", fn, flat=True).build()]


BLOOD = [[((0.02, -0.02), 0.27, [(3, 0.12, 0.7), (5, 0.06, 0.2)], (1.15, 0.85))],
         [((-0.05, 0.0), 0.17, [(4, 0.22, 0.3), (7, 0.1, 1.1)], (1, 1))] +
         [((0.3 * math.cos(a), 0.28 * math.sin(a)), 0.03 + 0.015 * (k % 3), [], (1, 1))
          for k, a in enumerate((0.3, 1.2, 2.0, 2.9, 3.7, 4.4, 5.3, 5.9))],
         [((-0.3, 0.12), 0.14, [(3, 0.12, 0.4)], (1, 1))]]
DRAG = ((-0.3, 0.12), (0.42, -0.16))                                                 # v2: the smear dragged from it


def _seg(x, y, a, b):
    """(distance to segment ab, position along it 0..1)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - a[0] - t * dx, y - a[1] - t * dy), t


def blood(v):
    def fn(x, y):
        d = min(bd(x, y, b) for b in BLOOD[v])
        if v == 2 and d >= 1:                                                        # the drag: tapering, streaked
            dist, t = _seg(x, y, *DRAG)                                              # along its length, breaking up
            w = 0.1 * (1 - t) + 0.02
            if dist < w and not (t > 0.7 and int(t * 30) % 3 == 0):
                across = int((dist / w) * 4 + (1 if (y - x * 0.38) > 0 else 0))
                return "drK" if across % 2 else "drD"
            return None
        if d < 0.55:
            return "drD"
        if d < 0.85:
            return "medRed" if v != 2 else "drD"
        return "drK" if d < 1 else None
    return [decal(f"blood_floor_{v}", fn, flat=True).build()]


OIL = [[((0.0, 0.03), 0.33, [(2, 0.16, 0.6), (3, 0.08, 2.0)], (1.25, 0.8))],
       [((-0.15, -0.1), 0.2, [(3, 0.1, 0.2)], (1, 1)), ((0.16, 0.12), 0.22, [(2, 0.2, 1.4)], (1, 1))]]


def oil(v):
    def fn(x, y):
        d = min(bd(x, y, b) for b in OIL[v])
        if d >= 1:
            return None
        sw = math.sin(x * 23 + 2.2 * math.sin(y * 17)) + 0.6 * math.sin(y * 29 - x * 7)
        if d < 0.88 and sw > 0.45:                                                   # the sheen: thin-film bands,
            return ("xnM", "bM", "oXD")[min(2, int((sw - 0.45) / 0.35))]             # swirling through it
        return "gK" if d < 0.9 else "dark"
    return [decal(f"oil_floor_{v}", fn, flat=True).build()]


def scratch(v):
    """v0: three claw gouges, raking (dark in the cut, bright torn metal along it); v1: long scrapes where something
    heavy was dragged."""
    if v == 0:
        lines = [((-0.4 + k * 0.14, 0.4 - k * 0.03), (0.24 + k * 0.14, -0.42 - k * 0.03), 0.085) for k in range(3)]
    else:
        rs = random.Random(5)
        lines = [((-0.46, -0.24 + k * 0.08), (rs.uniform(0.1, 0.46), -0.12 + k * 0.08), 0.03) for k in range(6)]

    def fn(x, y):
        for a, b, w in lines:
            dist, t = _seg(x, y, a, b)
            wt = w * (math.sin(math.pi * t) ** 0.5 if v == 0 else (1 - 0.5 * t))
            if v == 0 and dist < wt * 0.35:
                return "dark"                                                        # the cut
            if dist < wt * 0.6:
                return "sole"                                                        # bright bare metal
            if dist < wt:
                return "steelD"                                                      # its torn edge
        return None
    return [decal(f"scratch_floor_{v}", fn, flat=True).build()]


SPRITES = [("decay.debris.ceiling", (1, 1), "prop", debris_ceiling),
           ("decay.debris.glass", (1, 1), "prop", debris_glass),
           ("decay.debris.parts", (1, 1), "prop", debris_parts)]
SPRITES += [(f"decay.frost.floor.v{v}", (1, 1), "block", lambda v=v: frost(v)) for v in range(2)]
SPRITES += [(f"decay.blood.floor.v{v}", (1, 1), "block", lambda v=v: blood(v)) for v in range(3)]
SPRITES += [(f"decay.oil.floor.v{v}", (1, 1), "block", lambda v=v: oil(v)) for v in range(2)]
SPRITES += [(f"decay.scratch.floor.v{v}", (1, 1), "block", lambda v=v: scratch(v)) for v in range(2)]
