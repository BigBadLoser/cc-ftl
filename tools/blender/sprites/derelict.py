"""Derelict dressing: floor and roof decals, debris props, dead lights, alien infestation and the AI shipyard's scrap
(grid frame, origin = centre of the front-most footprint tile at floor level, as props.py). Wall pieces and wall decals
live in derelict_walls.py.

Decals (kind block: transparent round the shape) are drawn on top of the tile they sit on:
- decay.breach.floor.v0..v2: a hole torn through the deck (the plate's section on the far rim, joists, bent flaps);
- decay.scorch.floor.v0..v2, decay.burnt.{1x1|2x1|1x2|2x2}: soot, and the char ring round a burnt-out module (the
  renderer also darkens the module itself);
- decay.growth.floor.v0..v2: alien membrane with glowing nodules (the accent colour of the aliens, xn*);
- decay.breach.roof, decay.scorch.roof.v0 / .v1: the same on the roof plating, for the roofed view.
Props (kind prop, one-tile, no footprint): decay.debris.*, decay.eggs, decay.ai.*, module.light.off (the flicker's dark
frame) and module.light.broken; module.fabricator[.rN].dormant is the fabricator with only a dim red standby light."""
import math

from . import core
from . import logistics
from . import walls as W
from .derelict_walls import SPRITES as WALL_SPRITES

GN = 32


def blob(x, y, cx, cy, r, parts, sx=1.0, sy=1.0):
    """Distance from (cx, cy) as a fraction of a lobed radius (r * (1 + sum a cos(k th + p)))."""
    dx, dy = (x - cx) / sx, (y - cy) / sy
    th = math.atan2(dy, dx)
    rr = r * (1 + sum(a * math.cos(k * th + p) for k, a, p in parts))
    return math.hypot(dx, dy) / rr


def bd(x, y, b):
    """blob() of a ((cx, cy), r, parts, (sx, sy)) tuple."""
    return blob(x, y, *b[0], b[1], b[2], *b[3])


def decal(name, fn, z=0.003, x0=-0.5, y0=-0.5, w=1, h=1, flat=False):
    """Cell-grid decal (fn(x, y) -> palette name or None) on the plane z over [x0, x0 + w] x [y0, y0 + h]."""
    m = core.Mesh(name, flat=flat)
    m.pattern((x0, y0, z), (w, 0, 0), (0, h, 0), GN * w, GN * h,
              lambda i, j: fn(x0 + (i + 0.5) / GN, y0 + (j + 0.5) / GN))
    return m


# ---- floor: breach, scorch, burnt module ------------------------------------------------------------------------

HOLES = [((0.0, 0.0), 0.34, [(3, 0.14, 0.5), (5, 0.06, 2.0)], (1.0, 1.0)),
         ((0.03, -0.03), 0.3, [(2, 0.12, 1.2), (4, 0.07, 0.3)], (1.35, 0.85)),
         ((0.0, 0.02), 0.4, [(3, 0.1, 2.4), (4, 0.08, 0.9)], (1.0, 1.0))]


def breach_floor(v):
    (cx, cy), r, parts, (sx, sy) = HOLES[v]
    inside = lambda x, y: blob(x, y, cx, cy, r, parts, sx, sy) < 1  # noqa: E731
    e = 3.5 / GN

    def fn(x, y):
        d = blob(x, y, cx, cy, r, parts, sx, sy)
        if d >= 1:
            return "dark" if d < 1.1 else None                                                           # torn rim
        if not inside(x, y - e):
            return "steelL"                     # the deck plate's section on the far rim (faces +y: lit)
        if not inside(x - e, y):
            return "steelD"                     # ... facing +x: shade
        if abs(y - cy - 0.04) < 2 / GN:
            return "gm" if abs(y - cy - 0.04 + 1 / GN) < 1 / GN else "gmD"                             # a joist below
        return "void"
    m = decal(f"breach_floor_{v}", fn)
    for (fx, fy, a, rz, s) in ((0.22, 0.12, -0.55, 0.5, 0.17), (-0.05, 0.27, -0.45, -0.3, 0.14), (0.18, -0.2, 0.5, 1.1, 0.12)):
        k = r / 0.3
        m.box((cx + fx * k, cy + fy * k, 0.015), (s, s * 0.7, 0.022), "steel", top="plate", rz=rz, rx=a)    # bent flaps
    return [m.build()]


SCORCH = [[((0.02, -0.03), 0.4, [(3, 0.16, 0.4), (5, 0.1, 1.1)], (1, 1))],
          [((-0.14, -0.1), 0.26, [(2, 0.15, 0.2)], (1, 1)), ((0.17, 0.16), 0.2, [(3, 0.14, 1.4)], (1, 1))],
          [((0.0, 0.05), 0.24, [(2, 0.1, 0.8), (3, 0.08, 0.1)], (1.8, 0.75))]]


def _soot(d):
    if d < 0.4:
        return "dark"
    if d < 0.72:
        return "grime"
    return "steelD" if d < 1 else None


def scorch_floor(v):
    def fn(x, y):
        d = min(bd(x, y, b) for b in SCORCH[v])
        return _soot(d)
    return [decal(f"scorch_floor_{v}", fn, flat=True).build()]


def burnt(w, h):
    """Char ring round a w x h module footprint (x -(w-1)-0.5 .. 0.5, y -(h-1)-0.5 .. 0.5), with a few soot lobes."""
    x0, x1, y0, y1 = -(w - 1) - 0.5, 0.5, -(h - 1) - 0.5, 0.5
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2

    def fn(x, y):
        d = max(x0 - x, x - x1, y0 - y, y - y1)
        th = math.atan2(y - cy, x - cx)
        reach = 0.2 + 0.07 * math.cos(3 * th + 0.5) + 0.05 * math.cos(5 * th + 2.0)
        if d < -0.12:
            return None                          # under the module
        f = (d + 0.12) / (reach + 0.12)
        if f > 1:
            return None
        return "dark" if f < 0.45 else ("grime" if f < 0.75 else "steelD")
    m = decal(f"burnt_{w}{h}", fn, x0=x0 - 0.3, y0=y0 - 0.3, w=w + 1, h=h + 1, flat=True)
    for k, (bx, by) in enumerate(((x1 + 0.12, cy + 0.2), (cx - 0.15, y1 + 0.14), (x1 + 0.05, y1 + 0.05))):
        m.box((bx, by, 0), (0.08, 0.06, 0.04), "rustD" if k % 2 else "dark", rz=0.6 * k, base=True)
    return [m.build()]


# ---- infestation -------------------------------------------------------------------------------------------------

GROWTH = [[((0.0, 0.0), 0.4, [(3, 0.14, 0.6), (5, 0.08, 2.0)], (1, 1))],
          [((-0.16, -0.08), 0.28, [(2, 0.12, 0.3)], (1, 1)), ((0.18, 0.12), 0.24, [(3, 0.12, 1.1)], (1, 1))],
          [((-0.05, 0.0), 0.26, [(2, 0.2, 0.4), (3, 0.1, 1.0)], (1.5, 0.8))]]
NODES = [[(-0.1, 0.06), (0.14, -0.12)], [(-0.18, -0.06), (0.2, 0.16)], [(0.12, 0.02)]]


def growth_floor(v):
    """Membrane patch: a dark crease round the edge, banded ridges, a few glowing nodules (one ring of the accent)."""
    def fn(x, y):
        for nx, ny in NODES[v]:
            dn = math.hypot(x - nx, y - ny)
            if dn < 0.04:
                return "xnG"
            if dn < 0.065:
                return "xnA"
        d = min(bd(x, y, b) for b in GROWTH[v])
        if d >= 1:
            return None
        if d > 0.84:
            return "xnK"
        return "xnM" if (d * 3.2) % 1 < 0.28 else "xnD"
    m = decal(f"growth_floor_{v}", fn, z=0.004)
    for k, (lx, ly) in enumerate(((0.12, 0.14), (-0.2, 0.15), (0.2, -0.02))[:3 - v]):
        m.cyl((lx, ly, 0), 0.07 - 0.01 * k, 0.05, "xnM", sides=8, rtop=0.04, top="xnL")      # raised lumps
    return [m.build()]


def _egg(m, x, y, s, open_):
    """One egg: stacked frusta, a lit cap, a glowing slit; open_ = split, the slit wide."""
    rings = [(0.0, 0.07), (0.06, 0.11), (0.16, 0.12), (0.26, 0.1), (0.33, 0.06)]
    for (z0, r0), (z1, r1) in zip(rings, rings[1:]):
        m.cyl((x, y, z0 * s), r0 * s, (z1 - z0) * s, "xnM" if z0 < 0.2 else "xnL", sides=8, rtop=r1 * s)
    m.cyl((x, y, 0.33 * s), 0.06 * s, 0.02 * s, "xnL", sides=8, rtop=0.03 * s, top="xnG" if open_ else "xnA")
    m.box((x + 0.07 * s, y + 0.07 * s, 0.14 * s), (0.02, 0.02, 0.14 * s), "xnG", rz=0.78, base=True)     # glowing seam


def eggs():
    m = core.Mesh("eggs")
    m.cyl((0, 0, 0), 0.4, 0.03, "xnD", sides=10, rtop=0.36, top="xnD")
    for x, y, s, o in ((-0.12, -0.12, 1.0, False), (0.14, -0.06, 0.85, False), (-0.08, 0.16, 0.8, True),
                       (0.17, 0.18, 0.65, False)):
        _egg(m, x, y, s, o)
    m.cyl((0.27, -0.24, 0), 0.06, 0.04, "xnM", sides=8, rtop=0.03, top="xnL")
    return [m.build()]


# Egg sacs: thin, wet membrane over sickly fluid. A slumped teardrop (widest near the deck, a soft tip), pale violet skin
# above a fluid line, the green fluid below it with a dark embryo pressed against the skin, a few veins, a gloss spot.
SAC = [(0.0, 0.8), (0.1, 0.98), (0.28, 1.0), (0.48, 0.9), (0.66, 0.72), (0.82, 0.48), (0.93, 0.26), (1.0, 0.08)]


def _prof(t):
    return _prof_at(SAC, t)


def _prof_at(pts, t):
    for (t0, a), (t1, b) in zip(pts, pts[1:]):
        if t0 <= t <= t1:
            return a + (b - a) * (t - t0) / (t1 - t0)
    return pts[-1][1]


def _surf(x, y, r, h, lean, t, az, out=1.0):
    """A point on a sac's skin at height fraction t and azimuth az (degrees)."""
    a = math.radians(az)
    rr = r * _prof(t) * out
    return x + lean[0] * t * t + rr * math.cos(a), y + lean[1] * t * t + rr * math.sin(a), h * t


def _sac(m, x, y, r, h, fluid=0.55, lean=(0.0, 0.0), cut=None):
    """The sac's skin as stacked frusta, split at the fluid line (a lit meniscus band), drooping by `lean` toward the
    top; cut: torn open at this height fraction (the inside shows dark)."""
    top = 1.0 if cut is None else cut
    ts = sorted({t for t, _ in SAC if t < top} | {fluid, top} if fluid < top else {t for t, _ in SAC if t < top} | {top})
    for t0, t1 in zip(ts, ts[1:]):
        col = "xnF" if t1 <= fluid + 1e-6 else ("xnL" if t0 >= 0.82 else "xnS")
        if t1 <= 0.1 + 1e-6:
            col = "xnFD" if fluid > 0.1 else "xnD"
        ox, oy = lean[0] * t0 * t0, lean[1] * t0 * t0
        m.cyl((x + ox, y + oy, h * t0), r * _prof(t0), h * (t1 - t0) + 0.002, col, sides=14, rtop=r * _prof(t1))
    if fluid < top:
        ox, oy = lean[0] * fluid * fluid, lean[1] * fluid * fluid
        m.cyl((x + ox, y + oy, h * fluid - 0.012), r * _prof(fluid) * 1.015, 0.024, "xnFL", sides=14)
    if cut is not None:
        ox, oy = lean[0] * cut * cut, lean[1] * cut * cut
        m.cyl((x + ox, y + oy, h * cut - 0.01), r * _prof(cut) * 0.9, 0.012, "xnFD" if fluid >= cut else "xnK", sides=14)


def _embryo(m, x, y, r, h, lean, t, az, size=1.0):
    """A dark curled shape pressed against the skin inside the fluid, one glowing eye."""
    a = math.radians(az)
    for k, (dt, da, s) in enumerate(((0.0, 0, 0.36), (-0.08, 30, 0.24), (-0.13, 54, 0.15))):
        px, py, pz = _surf(x, y, r, h, lean, t + dt, az + da)
        rr = r * s * size
        cx, cy = px - math.cos(a) * rr * 0.5, py - math.sin(a) * rr * 0.5
        m.cyl((cx, cy, pz - rr * 0.8), rr, rr * 1.6, "xnK", sides=8, rtop=rr * 0.7)
    px, py, pz = _surf(x, y, r, h, lean, t + 0.04, az - 12, 1.01)
    m.box((px, py, pz), (0.03, 0.03, 0.03), "xnG")


def _veins(m, x, y, r, h, lean, azs, t1=0.85):
    for az in azs:
        for k in range(8):
            t = 0.12 + (t1 - 0.12) * k / 7
            px, py, pz = _surf(x, y, r, h, lean, t, az + 14 * math.sin(k * 1.3 + az), 1.006)
            m.box((px, py, pz), (0.026, 0.026, h * 0.11), "xnD" if t > 0.55 else "xnFD", rz=math.radians(az))


def _gloss(m, x, y, r, h, lean, top=1.0):
    """The wet highlight, up on the lit (+y, screen left) shoulder."""
    for t, az, sz in ((0.66, 115, 0.055), (0.75, 105, 0.035)):
        if t < top:
            px, py, pz = _surf(x, y, r, h, lean, t, az, 1.012)
            m.box((px, py, pz), (sz, sz, sz * 0.8), "xnH", rz=math.radians(az))


def _flaps(m, x, y, r, h, lean, cut, droop, n=5):
    """Limp torn skin round the tear, hanging outward by `droop` radians (past pi/2 they drape down the side)."""
    ox, oy = lean[0] * cut * cut, lean[1] * cut * cut
    zc, rc = h * cut, r * _prof(cut)
    for k in range(n):
        az = k * 2 * math.pi / n + 0.5
        ca, sa = math.cos(az), math.sin(az)
        L = h * (1 - cut) * (1.0 + 0.25 * math.sin(k * 2.1))
        if math.cos(droop) < 0:
            L = min(L, zc / -math.cos(droop) * 0.95)
        bx, by = x + ox + rc * ca, y + oy + rc * sa
        c = (bx + ca * math.sin(droop) * L / 2, by + sa * math.sin(droop) * L / 2, zc + math.cos(droop) * L / 2)
        m.box(c, (2 * math.pi * rc / n * 0.85, 0.016, L), "xnS", rz=az - math.pi / 2, rx=-droop, taper=0.35)


def _drip(m, x, y, r, h, lean, az, t0):
    """Fluid leaking from a split: a dark slit, a drip trail down the skin."""
    px, py, pz = _surf(x, y, r, h, lean, t0, az, 1.01)
    m.box((px, py, pz), (0.03, 0.03, 0.08), "xnK", rz=math.radians(az))
    for k in range(6):
        t = t0 - (t0 * k / 6)
        px, py, pz = _surf(x, y, r, h, lean, t, az + 4, 1.014)
        m.box((px, py, pz), (0.032, 0.032, h * t0 / 6 + 0.01), "xnFL", rz=math.radians(az))


def _base(name, cx, cy, r, w, puddle=0.0, pc=(0.0, 0.0)):
    """The resin pad the sac grows from (a lobed membrane, dark crease), and a pool of spilled fluid of size `puddle`."""
    parts = [(3, 0.18, 0.4), (5, 0.12, 1.3), (7, 0.06, 2.2)]
    pparts = [(2, 0.2, 0.7), (3, 0.14, 2.0), (5, 0.08, 0.3)]

    def fn(x, y):
        if puddle > 0:
            dp = blob(x, y, cx + pc[0], cy + pc[1], r * 0.95 * puddle + 0.12, pparts)
            if dp < 1:
                if dp > 0.84:
                    return "xnFD"
                return "xnFL" if (abs((x - y) * 6 % 1 - 0.5) < 0.08 and dp < 0.6) else "xnF"
        d = blob(x, y, cx, cy, r, parts)
        if d >= 1:
            return None
        if d > 0.86:
            return "xnK"
        return "xnM" if (d * 3.5) % 1 < 0.25 else "xnD"
    x0, y0 = cx - w / 2 - 0.5, cy - w / 2 - 0.5
    return decal(name, fn, z=0.004, x0=x0, y0=y0, w=w + 1, h=w + 1)


STATES = ("intact", "cracked", "hatch0", "hatch1", "hatch2", "burst")
PUDDLE = {"intact": 0.0, "cracked": 0.25, "hatch0": 0.35, "hatch1": 0.6, "hatch2": 0.85, "burst": 1.0}


def _spawn_sac(m, x, y, r, h, lean, state):
    """The sac the alien hatches from, in a damage / hatch state."""
    if state in ("intact", "cracked", "hatch0"):
        sw = 1.06 if state == "hatch0" else 1.0                      # it swells just before it splits
        r, h = r * sw, h * sw
        _sac(m, x, y, r, h, 0.58, lean)
        _embryo(m, x, y, r, h, lean, 0.3, 50, 1.25 if state == "hatch0" else 1.0)
        _veins(m, x, y, r, h, lean, (0, 150, 250))
        _gloss(m, x, y, r, h, lean)
        if state != "intact":
            _drip(m, x, y, r, h, lean, 75, 0.62)
        if state == "hatch0":
            _drip(m, x, y, r, h, lean, 20, 0.7)
        return
    if state == "burst":                                             # deflated: a crumpled skin in its puddle
        _sac(m, x, y, r * 1.1, h * 0.4, 0.12, lean, cut=0.8)
        _flaps(m, x, y, r * 1.1, h * 0.4, lean, 0.8, 2.3)
        return
    cut, fl, droop = (0.66, 0.42, 0.9) if state == "hatch1" else (0.52, 0.26, 2.0)
    _sac(m, x, y, r, h, fl, lean, cut=cut)
    _veins(m, x, y, r, h, lean, (0, 150, 250), t1=cut - 0.05)
    _gloss(m, x, y, r, h, lean, top=cut)
    _flaps(m, x, y, r, h, lean, cut, droop)


def eggsac(n, state="intact"):
    """An alien egg sac: thin wet membrane over sickly fluid, an embryo curled inside, grown out of a resin pad (1x1,
    or a 2x2 cluster of slumped sacs). Breaking it hatches an alien: cracked (it leaks), hatch0..2 (it swells, rips,
    the skin falls open and the fluid floods out), burst (the deflated skin in its puddle)."""
    pud = PUDDLE[state]
    if n == 1:
        m = _base(f"eggsac_1_{state}", 0.0, 0.0, 0.44, 1, pud, (0.14, 0.14))
        _sac(m, 0.25, 0.17, 0.13, 0.24, 0.5, (0.02, 0.0))
        _gloss(m, 0.25, 0.17, 0.13, 0.24, (0.02, 0.0))
        _spawn_sac(m, -0.03, -0.03, 0.3, 0.6, (0.04, 0.02), state)
        return [m.build()]
    cx, cy = -0.5, -0.5
    m = _base(f"eggsac_2_{state}", cx, cy, 0.95, 2, pud, (0.3, 0.3))
    for (x, y, r, h, fl, lean, emb) in ((cx + 0.32, cy - 0.44, 0.2, 0.36, 0.5, (0.03, 0.03), False),
                                        (cx + 0.44, cy + 0.12, 0.28, 0.5, 0.6, (0.05, 0.02), True),
                                        (cx - 0.04, cy + 0.46, 0.24, 0.42, 0.55, (0.02, 0.05), False)):
        _sac(m, x, y, r, h, fl, lean)
        if emb:
            _embryo(m, x, y, r, h, lean, 0.3, 45, 0.9)
            _veins(m, x, y, r, h, lean, (10, 200))
        _gloss(m, x, y, r, h, lean)
        _seg(m, (cx - 0.1, cy - 0.1), (x, y), 0.0, 0.07, "xnD")                  # resin strands between them
    _spawn_sac(m, cx - 0.12, cy - 0.12, 0.5, 0.92, (0.06, 0.03), state)
    return [m.build()]


# ---- debris ------------------------------------------------------------------------------------------------------

def _seg(m, a, b, z, w, col):
    """A horizontal bar from a to b (floor plane), w thick."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    m.box(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z), (math.hypot(dx, dy) + w * 0.6, w, w), col,
          rz=math.atan2(dy, dx), base=True)


def _path(m, pts, z, w, col):
    for a, b in zip(pts, pts[1:]):
        _seg(m, a, b, z, w, col)


def debris_plates():
    m = core.Mesh("debris_plates")
    m.box((-0.08, -0.05, 0.0), (0.42, 0.3, 0.03), "steel", top="plate", rz=0.35, base=True, bevel=0.006)
    m.box((0.2, 0.06, 0.07), (0.24, 0.3, 0.03), "steel", top="steelL", rz=0.35, ry=-0.55, bevel=0.006)   # bent up
    m.box((-0.1, 0.24, 0.0), (0.3, 0.16, 0.025), "rust", top="rust", rz=-0.5, base=True)
    m.box((0.05, -0.28, 0.0), (0.06, 0.06, 0.04), "steelD", base=True)
    return [m.build()]


def debris_cables():
    m = core.Mesh("debris_cables")
    for k, (col, ph, y0) in enumerate((("strap", 0.0, -0.18), ("hivis", 1.6, 0.0), ("navy", 3.1, 0.16))):
        pts = [(-0.4 + i * 0.08, y0 + 0.09 * math.sin(i * 0.9 + ph)) for i in range(11)]
        _path(m, pts, 0.0 if k != 1 else 0.035, 0.045, col)
        m.box((pts[-1][0] + 0.03, pts[-1][1], 0), (0.05, 0.05, 0.05), "brass", base=True)
    return [m.build()]


def junction(spark):
    """A junction box torn off the wall: open front, a circuit board, loose wires; spark = the arc frame (glow)."""
    m = core.Mesh(f"junction_{int(spark)}")
    m.box((0.0, -0.05, 0), (0.34, 0.26, 0.3), "steelD", top="steel", base=True, bevel=0.012, rz=0.3)
    c, s = math.cos(0.3), math.sin(0.3)
    fx, fy = -s * 0.135, -0.05 + c * 0.135
    m.box((fx, fy, 0.04), (0.26, 0.02, 0.22), "dark", rz=0.3, base=True)
    m.box((fx - s * 0.006, fy + c * 0.006, 0.1), (0.14, 0.012, 0.1), "pcb", rz=0.3, base=True)
    m.box((fx + 0.18, fy + 0.2, 0.0), (0.24, 0.2, 0.02), "steel", top="plate", rz=0.9, base=True)     # its lid
    _path(m, [(fx - 0.06, fy + 0.02), (fx - 0.1, fy + 0.12), (fx - 0.04, fy + 0.22)], 0.0, 0.035, "hivis")
    _path(m, [(fx + 0.05, fy + 0.02), (fx + 0.1, fy + 0.14)], 0.0, 0.035, "navy")
    if spark:
        for (dx, dy, z, q) in ((-0.04, 0.24, 0.05, 0.045), (0.0, 0.3, 0.11, 0.03), (-0.1, 0.28, 0.16, 0.025),
                               (0.04, 0.22, 0.2, 0.025)):
            m.box((fx + dx, fy + dy, z), (q, q, q), "arc" if q > 0.03 else "flameW")
    return [m.build()]


def debris_pipe():
    m = core.Mesh("debris_pipe")
    rz = -0.4
    c, s = math.cos(rz), math.sin(rz)
    m.box((0, 0, 0), (0.62, 0.12, 0.12), "gm", top="steelL", rz=rz, base=True, bevel=0.035)
    for u in (-0.24, 0.12):
        m.box((u * c, u * s, 0), (0.035, 0.16, 0.16), "steelD", top="gm", rz=rz, base=True, bevel=0.02)
    m.box((0.31 * c, 0.31 * s, 0.0), (0.04, 0.1, 0.09), "dark", rz=rz + 0.3, base=True)                  # torn end
    m.box((0.1, 0.24, 0), (0.08, 0.05, 0.03), "steelD", rz=0.4, base=True)
    return [m.build()]


def debris_chunks():
    """Hull fragments drifting in the dead ship's zero g, each with a small shadow on the deck."""
    m = core.Mesh("debris_chunks")
    for (x, y, z, s, col, top, r) in ((-0.1, -0.08, 0.42, 0.3, "steel", "plate", (0.5, 0.3, 0.4)),
                                      (0.18, 0.08, 0.7, 0.22, "rust", "rust", (0.2, -0.6, 1.0)),
                                      (-0.06, 0.22, 0.95, 0.16, "steelD", "steelL", (-0.4, 0.2, 2.0))):
        m.box((x, y, z), (s, s * 0.8, s * 0.35), col, top=top, rx=r[0], ry=r[1], rz=r[2], bevel=0.01)
        m.cyl((x, y, 0), s * 0.5, 0.004, "grime", sides=8)
    return [m.build()]


def debris_crate():
    m = core.Mesh("debris_crate")
    m.box((-0.1, -0.1, 0), (0.56, 0.56, 0.06), "rustD", top="dark", base=True)                        # gutted: floor
    for (x, y, sx, sy, h) in ((-0.1, -0.36, 0.56, 0.05, 0.36), (-0.36, -0.1, 0.05, 0.56, 0.32),
                              (-0.1, 0.16, 0.3, 0.05, 0.16)):
        m.box((x, y, 0), (sx, sy, h), "rust", top="steel", base=True)                                  # what is left
    m.box((0.3, 0.02, 0.06), (0.04, 0.48, 0.36), "rust", top="rustD", rz=0.2, ry=1.0)                  # side panel, fallen
    m.box((-0.12, 0.3, 0), (0.6, 0.18, 0.025), "steel", top="plate", rz=-0.2, base=True)               # the lid
    for k, (x, y) in enumerate(((0.12, 0.3), (0.28, -0.24))):
        m.box((x, y, 0), (0.12, 0.12, 0.1), ("pcb", "steelL")[k], top="plate", rz=0.5 * k, base=True)
    return [m.build()]


# ---- lights ------------------------------------------------------------------------------------------------------

def lamp_off():
    """module.light with its lens dead: alternated with module.light, it flickers."""
    m = core.Mesh("lamp_off")
    m.cyl((0, 0, 0), 0.14, 0.06, "steelD", sides=8, top="plate")
    m.cyl((0, 0, 0.06), 0.035, 0.7, "gm", sides=6)
    m.box((0, 0, 0.74), (0.2, 0.2, 0.05), "gmD", base=True, bevel=0.01)
    m.box((0, 0, 0.79), (0.15, 0.15, 0.11), "glassD", base=True)
    m.box((0, 0, 0.9), (0.2, 0.2, 0.03), "gmD", base=True, bevel=0.01)
    return [m.build()]


def lamp_broken():
    """A lamp knocked askew: the pole leans, the head hangs, the lens is shattered (no light)."""
    m = core.Mesh("lamp_broken")
    a = 0.42
    m.cyl((0, 0, 0), 0.14, 0.06, "steelD", sides=8, top="plate")
    L = 0.66
    m.box((math.sin(a) * L / 2, 0, 0.06 + math.cos(a) * L / 2), (0.06, 0.06, L), "gm", ry=a)
    hx, hz = math.sin(a) * L, 0.06 + math.cos(a) * L
    b = 1.2
    m.box((hx + 0.05, 0, hz - 0.04), (0.2, 0.2, 0.05), "gmD", ry=b, bevel=0.01)
    m.box((hx + 0.11, 0, hz - 0.1), (0.15, 0.15, 0.08), "glassD", ry=b)
    m.box((hx + 0.15, 0.02, hz - 0.13), (0.05, 0.08, 0.04), "glassL", ry=b)
    for (x, y) in ((0.3, 0.16), (0.2, 0.24), (0.4, 0.05)):
        m.box((x, y, 0), (0.04, 0.05, 0.015), "glassL", rz=x * 7, base=True)                        # shards
    return [m.build()]


# ---- AI shipyard -------------------------------------------------------------------------------------------------

def ai_cables(ax):
    """A thick bundle of power and data cables along the deck, strapped twice a tile; runs tile to tile."""
    m = core.Mesh(f"ai_cables_{ax}")
    T = (lambda u, v: (u, v)) if ax == "x" else (lambda u, v: (v, -u))
    rz = 0.0 if ax == "x" else math.pi / 2
    for v, z, col in ((-0.12, 0, "dark"), (-0.04, 0, "steelD"), (0.04, 0, "dark"), (0.12, 0, "navy"),
                      (-0.06, 0.07, "hivis"), (0.06, 0.07, "steelD")):
        m.box((*T(0, v), z), (1.0, 0.075, 0.075), col, rz=rz, base=True)
    for u in (-0.25, 0.25):
        m.box((*T(u, 0), 0), (0.06, 0.34, 0.16), "gm", top="steelL", rz=rz, base=True)
    return [m.build()]


def ai_scrap():
    """A heap of stripped robot parts: shells in the robots' cream, joints, two dead visor heads, an arm and a leg."""
    m = core.Mesh("ai_scrap")
    m.cyl((0, 0, 0), 0.44, 0.1, "steelD", sides=8, rtop=0.36, top="dark")
    m.box((-0.08, -0.08, 0.08), (0.4, 0.32, 0.28), "lvW2", top="lvW", rz=0.4, ry=0.25, bevel=0.03)   # torso shell
    m.box((-0.08, -0.08, 0.3), (0.2, 0.18, 0.08), "gm", top="steelL", rz=0.4, ry=0.25)
    for (x, y, z, rz, rx) in ((0.2, 0.14, 0.12, -0.5, 0.3), (-0.26, 0.12, 0.1, 0.9, -0.2)):               # heads
        c, s_ = math.cos(rz), math.sin(rz)
        m.box((x, y, z), (0.2, 0.18, 0.17), "lvW2", top="lvW", rz=rz, rx=rx, bevel=0.025)
        m.box((x + 0.1 * -s_ + 0.0, y + 0.1 * c, z + 0.01), (0.14, 0.03, 0.05), "lens", rz=rz, rx=rx)      # dead visor
    _path(m, [(-0.36, -0.2), (-0.2, -0.3), (-0.02, -0.34)], 0.08, 0.07, "gm")                           # arm
    m.box((0.02, -0.34, 0.05), (0.1, 0.1, 0.08), "lvWS", rz=0.4, base=True)
    _path(m, [(0.26, -0.24), (0.36, 0.02)], 0.08, 0.09, "lvWS")                                         # leg
    m.box((0.38, 0.06, 0.05), (0.14, 0.1, 0.07), "gmD", rz=1.2, base=True)
    _path(m, [(-0.1, 0.32), (0.06, 0.36), (0.16, 0.3)], 0.06, 0.035, "hivis")
    m.cyl((0.0, 0.08, 0.32), 0.045, 0.07, "gm", sides=6, top="steelL")
    return [m.build()]


def fab_dormant(r):
    return logistics.fabricator(False, r, dormant=True)


# ---- roof --------------------------------------------------------------------------------------------------------

ZR = W.hull_top()


def breach_roof():
    """A hole torn through the roof plating: the slab's section on the far rim, a frame rib across, a torn lip."""
    cx, cy, r, parts = 0.02, 0.0, 0.37, [(3, 0.16, 0.9), (5, 0.07, 0.2)]
    inside = lambda x, y: blob(x, y, cx, cy, r, parts) < 1  # noqa: E731
    e = 3.5 / GN

    def fn(x, y):
        d = blob(x, y, cx, cy, r, parts)
        if d >= 1:
            return "cBK" if d < 1.1 else ("cBL" if d < 1.17 and math.cos(math.atan2(y - cy, x - cx) * 5) > 0 else None)
        if not inside(x, y - e):
            return "cBS"                         # slab section facing +y (lit)
        if not inside(x - e, y):
            return "cBE"
        if abs(x - cx - 0.04) < 1.5 / GN:
            return "cBR"                         # a frame rib below the plating
        return "void"
    m = decal("breach_roof", fn, z=ZR + 0.003, flat=True)
    m.box((cx + 0.3, cy + 0.2, ZR + 0.04), (0.24, 0.16, 0.025), "cB2", top="cBL", rz=0.4, rx=0.6)         # peeled plates
    m.box((cx - 0.3, cy + 0.12, ZR + 0.03), (0.14, 0.2, 0.025), "cB2", top="cBL", rz=-0.3, ry=-0.5)
    return [m.build()]


def scorch_roof(v):
    blobs = SCORCH[v]

    def fn(x, y):
        d = min(bd(x, y, b) for b in blobs)
        return "dark" if d < 0.4 else ("cBK" if d < 0.72 else ("cBE" if d < 1 else None))
    return [decal(f"scorch_roof_{v}", fn, z=ZR + 0.003, flat=True).build()]


SPRITES = list(WALL_SPRITES)
SPRITES += [(f"decay.breach.floor.v{_v}", (1, 1), "block", lambda v=_v: breach_floor(v)) for _v in range(3)]
SPRITES += [(f"decay.scorch.floor.v{_v}", (1, 1), "block", lambda v=_v: scorch_floor(v)) for _v in range(3)]
SPRITES += [(f"decay.burnt.{_w}x{_h}", (_w, _h), "block", lambda w=_w, h=_h: burnt(w, h))
            for _w, _h in ((1, 1), (2, 1), (1, 2), (2, 2))]
SPRITES += [(f"decay.growth.floor.v{_v}", (1, 1), "block", lambda v=_v: growth_floor(v)) for _v in range(3)]
for _n in (1, 2):
    for _st in STATES:
        SPRITES.append((f"decay.eggsac.{_n}x{_n}{'' if _st == 'intact' else '.' + _st}", (_n, _n), "prop",
                        lambda n=_n, st=_st: eggsac(n, st)))
SPRITES += [("decay.eggs", (1, 1), "prop", eggs),
            ("decay.debris.plates", (1, 1), "prop", debris_plates),
            ("decay.debris.cables", (1, 1), "prop", debris_cables),
            ("decay.debris.junction", (1, 1), "prop", lambda: junction(False)),
            ("decay.debris.junction.spark", (1, 1), "prop", lambda: junction(True)),
            ("decay.debris.pipe", (1, 1), "prop", debris_pipe),
            ("decay.debris.chunks", (1, 1), "prop", debris_chunks),
            ("decay.debris.crate", (1, 1), "prop", debris_crate),
            ("module.light.off", (1, 1), "prop", lamp_off),
            ("module.light.broken", (1, 1), "prop", lamp_broken),
            ("decay.ai.cables.x", (1, 1), "block", lambda: ai_cables("x")),
            ("decay.ai.cables.y", (1, 1), "block", lambda: ai_cables("y")),
            ("decay.ai.scrap", (1, 1), "prop", ai_scrap),
            ("decay.breach.roof", (1, 1), "block", breach_roof),
            ("decay.scorch.roof.v0", (1, 1), "block", lambda: scorch_roof(0)),
            ("decay.scorch.roof.v1", (1, 1), "block", lambda: scorch_roof(1))]
for _r in range(4):
    _sfx = "" if _r == 0 else f".r{_r}"
    SPRITES.append((f"module.fabricator{_sfx}.dormant", (2, 1) if _r in (0, 2) else (1, 2), "prop",
                    lambda r=_r: fab_dormant(r)))
