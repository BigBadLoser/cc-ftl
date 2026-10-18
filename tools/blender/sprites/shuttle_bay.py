"""SHUTTLE BAY prototype (module.vehicle_bay, 4x5 interior pad). Not wired in.

Local frame (BayFrame): u = grid x, v = grid y at rotation 0, origin = footprint centre, z up. The footprint is u -2..2,
v -2.5..2.5; the sim's boarding tile (1, 4) is the front-row tile centred at (-0.5, 2.0). The sprite origin is the centre
of the front-most footprint tile, as for every module. Rotations follow the sim: clockwise, (x, y) -> (h-1-y, x).

Layout (after the Space Haven hangar well): a flush deck pad round a deep recessed HANGAR WELL that fills rows 0..3.
The well is an octagonal opening (all four corners chamfered alike) with a raised hazard-striped coaming lip, panelled
walls in three rows with pilasters and light bars, and a floor of two launch doors (hazard seam, launch rails, clamps) at
PIT below the deck. The well is deep so a shuttle taller than the walls still fits under the roof slab: the craft stands
on the doors and is rendered with the bay as a holdout, so the coaming cuts it. Opening the doors shows the shaft to
space. Row 4 is the walkable boarding apron: the boarding plate on the access tile, a boarding gate on the coaming with
a gangway out over the well, light strips, and a service pedestal in the back corner. A 3x3 pod bay is the same kit
with a smaller OPEN."""
import math
from . import core, cmbkit, walls, roofs
from .cmbkit import Frame, prim

PAD_T = 0.06                          # pad plate thickness (the pad itself)
LEAF_T = 0.04                         # launch door thickness
OPEN = (-1.55, 1.55, -2.05, 1.5)      # well opening u0, u1, v0, v1 (rows 0..3)
CH = (0.5, 0.5, 0.5, 0.5)             # opening chamfer per corner (all four alike)
BAND = 0.22                           # dark deck band round the opening (the lip sits on its inner part)
PIT = 1.6                             # WELL DEPTH: the launch doors' top (where a parked shuttle stands) is PIT below the deck
LIP, LIP_W = 0.09, 0.15                # raised coaming lip round the opening: height, width
SHAFT = 1.0                           # launch shaft below the doors when open
CLEAR_ROOF = PIT + walls.HF           # 3.45: tallest shuttle that fits under the roof slab's underside
CLEAR_TOP = PIT + roofs.ZR            # 3.65: ... up to the roof slab's top (2.05 above the deck)
BOARD = (-0.5, 2.0)                   # boarding tile centre (sim access (1, 4))
GANG = 0.6                            # gangway reach from the coaming's outer edge out over the well
FEET = ((0.8, -1.3), (0.8, 0.6))      # foot clamps on the doors (|u|, v): where a parked shuttle's feet go


def _g(name):
    if cmbkit.REC is not None:
        cmbkit.REC.group = name


class BayFrame(Frame):
    """Frame for a [w, h] footprint at a sim rotation, plus an optional yaw/offset for a body placed on it (the shuttle)."""

    def __init__(self, m, rot=0, foot=(4, 5), off=(0.0, 0.0), yaw=0.0, anchor=True):
        self.m, self.r = m, rot % 4
        self.rot = self.r + 1                       # cmbkit's cylinder-axis convention: u runs along grid x for even rot
        w, h = foot if self.r % 2 == 0 else foot[::-1]
        self.fx, self.fy = (w / 2 - 0.5, h / 2 - 0.5) if anchor else (0.0, 0.0)
        self.off, self.yaw = off, yaw
        self.cx = self.cy = 0.0

    def xy(self, u, v):
        if self.yaw:
            c, s = math.cos(self.yaw), math.sin(self.yaw)
            u, v = u * c - v * s, u * s + v * c
        u, v = u + self.off[0], v + self.off[1]
        for _ in range(self.r):
            u, v = -v, u
        return u - self.fx, v - self.fy


# ---- polygon helpers ----------------------------------------------------------------------------------------

def octagon(u0, u1, v0, v1, ch):
    """8 corners (some may coincide) going round; ch = chamfer per corner (u0v0, u1v0, u1v1, u0v1)."""
    a, b, c, d = ch
    return [(u0 + a, v0), (u1 - b, v0), (u1, v0 + b), (u1, v1 - c), (u1 - c, v1), (u0 + d, v1), (u0, v1 - d), (u0, v0 + a)]


def grow(rect, ch, d):
    u0, u1, v0, v1 = rect
    return (u0 - d, u1 + d, v0 - d, v1 + d), tuple(c + d * (2 - math.sqrt(2)) if c else 0.0 for c in ch)


def clip(pts, nx, ny, c):
    """Convex polygon clipped to the half-plane nx*u + ny*v <= c (Sutherland-Hodgman, one plane)."""
    out = []
    for i, p in enumerate(pts):
        q = pts[(i + 1) % len(pts)]
        dp, dq = nx * p[0] + ny * p[1] - c, nx * q[0] + ny * q[1] - c
        if dp <= 0:
            out.append(p)
        if (dp < 0) != (dq < 0) and abs(dp - dq) > 1e-9:
            t = dp / (dp - dq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


def _dedup(pts):
    out = []
    for p in pts:
        if not out or math.dist(p, out[-1]) > 1e-6:
            out.append(p)
    if len(out) > 1 and math.dist(out[0], out[-1]) < 1e-6:
        out.pop()
    return out


def inside(poly, hole):
    """Convex polygon intersected with the convex opening (clip by each opening edge)."""
    hole = _dedup(hole)
    n = len(hole)
    cx = sum(a[0] for a in hole) / n
    cy = sum(a[1] for a in hole) / n
    for i in range(n):
        p, q = hole[i], hole[(i + 1) % n]
        nx, ny = q[1] - p[1], -(q[0] - p[0])
        if nx * (cx - p[0]) + ny * (cy - p[1]) > 0:
            nx, ny = -nx, -ny
        poly = clip(poly, nx, ny, nx * p[0] + ny * p[1])
        if len(poly) < 3:
            return []
    return poly


@prim
def prism(f, pts, z0, z1, side, top=None, bottom=None):
    """Upright prism on a convex (u, v) polygon from z0 to z1: top face, side faces, optional bottom."""
    pts = _dedup(pts)
    if len(pts) < 3:
        return
    f.poly([f.pt(u, v, z1) for u, v in pts], top or side, flip=True)
    if bottom:
        f.poly([f.pt(u, v, z0) for u, v in pts[::-1]], bottom, flip=True)
    for i, (u, v) in enumerate(pts):
        p, q = (u, v), pts[(i + 1) % len(pts)]
        f.poly([f.pt(*p, z0), f.pt(*q, z0), f.pt(*q, z1), f.pt(*p, z1)], side, flip=True)


@prim
def lbox(f, corner, mats):
    """Box lofted between arbitrary corners: corner(a, b, d) -> (u, v, z) for a (across), b (along), d (up) in +-1.
    mats: colour per face 'top', 'bot', '+a', '-a', '+b', '-b' (missing faces fall back to 'side')."""
    P = {(a, b, d): f.pt(*corner(a, b, d)) for a in (-1, 1) for b in (-1, 1) for d in (-1, 1)}
    faces = {"top": ((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)), "bot": ((-1, -1, -1), (-1, 1, -1), (1, 1, -1), (1, -1, -1)),
             "+a": ((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)), "-a": ((-1, -1, -1), (-1, -1, 1), (-1, 1, 1), (-1, 1, -1)),
             "+b": ((-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1)), "-b": ((-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1))}
    for k, ks in faces.items():
        f.poly([P[q] for q in ks], mats.get(k, mats.get("side")), flip=True)


def hazard_band(f, inner, width, z, w=0.13, period=0.27, slant=0.12, base="hazK", stripe="hazY", h=0.006):
    """Diagonal hazard ring just outside a convex polygon `inner` (going round): a dark base strip per edge, yellow
    parallelogram stripes on top, corners left dark."""
    n = len(inner)
    cx = sum(p[0] for p in inner) / n
    cy = sum(p[1] for p in inner) / n
    for i in range(n):
        p, q = inner[i], inner[(i + 1) % n]
        L = math.dist(p, q)
        if L < 1e-6:
            continue
        e = ((q[0] - p[0]) / L, (q[1] - p[1]) / L)
        nrm = (e[1], -e[0])
        if nrm[0] * (p[0] - cx) + nrm[1] * (p[1] - cy) < 0:
            nrm = (-nrm[0], -nrm[1])
        at = lambda t, s: (p[0] + e[0] * t + nrm[0] * s, p[1] + e[1] * t + nrm[1] * s)  # noqa: E731
        t = 0.03
        while t + w + slant <= L - 0.03:
            prism(f, [at(t, 0.012), at(t + w, 0.012), at(t + w + slant, width - 0.012), at(t + slant, width - 0.012)], z, z + h, stripe)
            t += period


# ---- the bay ------------------------------------------------------------------------------------------------

def pad(f):
    """Deck pad: steel plating from the footprint edge to the hazard ring, the ring, then the opening lip."""
    _g("deck")
    outer = octagon(-2.0, 2.0, -2.5, 2.5, (0, 0, 0, 0))
    rect, ch = grow(OPEN, CH, BAND)
    ring = octagon(*rect, ch)
    hole = octagon(*OPEN, CH)
    lip = octagon(-1.94, 1.94, -2.44, 2.44, (0, 0, 0, 0))
    for i in range(8):
        j = (i + 1) % 8
        prism(f, [outer[i], outer[j], lip[j], lip[i]], 0.0, PAD_T, "steelD", top="steelL")      # lit edge lip: the pad's outline
        prism(f, [lip[i], lip[j], ring[j], ring[i]], 0.0, PAD_T, "steelD", top="blueGrey")
        prism(f, [ring[i], ring[j], hole[j], hole[i]], 0.0, PAD_T, "steelD", top="hazK")      # dark band under / outside the lip
    for u in (-1.0, 0.0, 1.0):                                                       # deck plate seams on the apron
        prism(f, [(u - 0.035, 1.75), (u + 0.035, 1.75), (u + 0.035, 2.44), (u - 0.035, 2.44)], PAD_T, PAD_T + 0.004, "steelD")


def lights(f, on=True):
    """Flush light strips: the side borders, the back border and the front apron (pale white-cyan like the walls' lamps)."""
    _g("lights")
    lit = "arc" if on else "glassL"
    z = PAD_T
    for su in (-1, 1):
        for v0, v1 in ((-1.75, -1.15), (-0.7, -0.1), (0.35, 0.95)):
            u = su * 1.875
            prism(f, [(u - 0.045, v0), (u + 0.045, v0), (u + 0.045, v1), (u - 0.045, v1)], z, z + 0.012, "steelD", top=lit)
    for u0, u1 in ((-1.55, -0.85), (-0.35, 0.35)):
        prism(f, [(u0, -2.42), (u1, -2.42), (u1, -2.33), (u0, -2.33)], z, z + 0.012, "steelD", top=lit)
    for u in (0.75, 0.95):                                                           # twin "||" bars on the apron
        prism(f, [(u - 0.045, 1.85), (u + 0.045, 1.85), (u + 0.045, 2.35), (u - 0.045, 2.35)], z, z + 0.012, "steelD", top=lit)
    prism(f, [(1.2, 2.31), (1.85, 2.31), (1.85, 2.4), (1.2, 2.4)], z, z + 0.012, "steelD", top=lit)


def boarding(f, home=True):
    """Boarding plate on the access tile: a lighter plate with two chevrons pointing at the shuttle's ramp and a lamp
    strip on its front edge (green while a shuttle is home)."""
    _g("lights")
    u, v = BOARD
    z = PAD_T
    prism(f, [(u - 0.42, v - 0.24), (u + 0.42, v - 0.24), (u + 0.42, v + 0.4), (u - 0.42, v + 0.4)], z, z + 0.01, "steelD", top="steelL")
    for dv in (-0.08, 0.17):                                                         # chevrons point -v (into the bay)
        for s in (-1, 1):
            prism(f, _chev(u, v + dv, s), z + 0.01, z + 0.016, "hazY")
    prism(f, [(u - 0.34, v + 0.29), (u + 0.34, v + 0.29), (u + 0.34, v + 0.36), (u - 0.34, v + 0.36)], z + 0.01, z + 0.02, "steelD",
          top="green" if home else "pcb")


def _chev(u, c, s):
    """One arm of a chevron (s = -1 left, +1 right), a convex quad from the tip (u, c - 0.1) out and back."""
    w = 0.08
    pts = [(u, c - 0.11), (u + s * 0.3, c + 0.06), (u + s * 0.3, c + 0.06 + w), (u, c - 0.11 + w)]
    return pts if s > 0 else pts[::-1]


def pedestal(f):
    """Service pedestal (power / fuel umbilical) in the back-right corner beside the hatch chamfer."""
    _g("pedestal")
    u, v = 1.78, -2.28
    f.box(u, v, PAD_T, 0.36, 0.36, 0.06, "steelD", top="steel")
    f.box(u, v, PAD_T + 0.06, 0.26, 0.26, 0.5, "steel", top="steelL")
    f.box(u, v, PAD_T + 0.56, 0.32, 0.32, 0.08, "steelD", top="steel")
    f.box(u - 0.15, v + 0.04, PAD_T + 0.2, 0.04, 0.16, 0.24, "dark", base=True)        # umbilical socket on the -u face
    f.box(u - 0.15, v + 0.04, PAD_T + 0.46, 0.04, 0.12, 0.06, "cyan", base=True)


def leaves(f, t):
    """The pit floor: two launch-door leaves, open fraction t (0 closed .. 1 open), split along v at u = 0 and sliding out
    into the pit walls. Each leaf carries its hazard seam on the inner edge, a launch rail under the shuttle's feet and two
    foot clamps (the parts that slid into the walls are dropped)."""
    _g("hatch")
    hole = octagon(*OPEN, CH)
    half = OPEN[1]
    z = -PIT
    for s in (-1, 1):
        k = t * half                                    # how far the inner edge has moved out
        poly = _dedup(clip(hole, -s, 0, -k))
        if len(poly) < 3 or t >= 0.999:
            continue
        prism(f, poly, z - LEAF_T, z, "steelD", top="plateC")
        e = s * k                                        # inner edge u
        band = inside([(e, -1.95), (e + s * 0.18, -1.95), (e + s * 0.18, 1.4), (e, 1.4)][:: 1 if s > 0 else -1], hole)
        prism(f, band, z, z + 0.004, "hazK")
        v = -1.85
        while v + 0.14 + 0.13 <= 1.35:
            q = [(e, v), (e, v + 0.14), (e + s * 0.18, v + 0.27), (e + s * 0.18, v + 0.13)]
            prism(f, inside(q if s > 0 else q[::-1], hole), z + 0.004, z + 0.008, "hazY")
            v += 0.29
        for du, vv in FEET[:1]:                                                       # launch rail under the feet
            uu = e + s * du
            if abs(uu) + 0.1 < half - 0.05:
                f.box(uu, (FEET[0][1] + FEET[1][1]) / 2, z, 0.16, 2.6, 0.05, "steelD", top="steelL")
        for du, vv in FEET:                                                           # foot clamps: jaws either side of the pad
            uu = e + s * du
            if abs(uu) + 0.22 > half - 0.02:
                continue
            for sv in (-1, 1):
                f.box(uu, vv + sv * 0.2, z + 0.05, 0.3, 0.08, 0.08, "steel", top="hazY")


def _wall(f, p, q, nin, t0, t1, d0, d1, z0, z1, mat, top=None):
    """Box on a pit wall from edge p->q: t0..t1 along it (fractions), d0..d1 out from the wall into the pit, z0..z1."""
    def corner(a, b, d):
        t = t0 if a < 0 else t1
        o = d0 if b < 0 else d1
        return (p[0] + (q[0] - p[0]) * t + nin[0] * o, p[1] + (q[1] - p[1]) * t + nin[1] * o, z0 if d < 0 else z1)
    lbox(f, corner, {"side": mat, "top": top or mat})


def pit(f, t):
    """The hangar well: panelled walls down to the launch doors (PIT deep) in three rows, lit top row with light bars,
    darker middle and bottom rows, pilasters and row rails, twin vertical lamps on the back wall. Open (t > 0): the shaft
    carries on under the doors (cyan band) to black space."""
    _g("pit")
    hole = _dedup(octagon(*OPEN, CH))
    zb = -(PIT + (SHAFT if t > 0 else LEAF_T))
    rows = ((-0.08, -0.56, "blueGrey"), (-0.62, -1.06, "steel"), (-1.12, -PIT + 0.06, "steelD"))
    n = len(hole)
    cx = sum(a[0] for a in hole) / n
    cy = sum(a[1] for a in hole) / n
    for i in range(n):
        p, q = hole[i], hole[(i + 1) % n]
        L = math.dist(p, q)
        e = ((q[0] - p[0]) / L, (q[1] - p[1]) / L)
        nin = (-e[1], e[0])
        if nin[0] * (cx - p[0]) + nin[1] * (cy - p[1]) < 0:
            nin = (-nin[0], -nin[1])
        _wall(f, p, q, nin, 0.0, 1.0, -0.03, 0.0, zb, PAD_T + LIP - 0.01, "steelD")     # the well wall itself
        k = max(1, int(round(L / 0.62)))
        tw = (0.58, 0.74) if i == 0 else None                                         # back wall: twin lamps live here
        for j in range(k):                                                            # wall panels between pilasters
            a0, a1 = (j + 0.08) / k, (j + 0.92) / k
            for z1, z0, col in rows:
                _wall(f, p, q, nin, a0, a1, 0.0, 0.02, z0, z1, col)
            m = (a0 + a1) / 2                                                          # inset sub-panels, upper two rows
            for b0, b1 in ((a0 + 0.06 / L, m - 0.03 / L), (m + 0.03 / L, a1 - 0.06 / L)):
                if b1 - b0 > 0.08 / L:
                    _wall(f, p, q, nin, b0, b1, 0.02, 0.03, -0.5, -0.3, "steelD")
                    _wall(f, p, q, nin, b0, b1, 0.02, 0.03, -1.0, -0.7, "steelD")
            if L > 1.0 and not (tw and a0 < tw[1] and a1 > tw[0]):
                _wall(f, p, q, nin, a0 + 0.1 / k, a1 - 0.1 / k, 0.02, 0.03, -0.24, -0.16, "arc")     # light bar
            if L > 1.0 and j % 2 == 1:
                _wall(f, p, q, nin, a0 + 0.3 / k, a1 - 0.3 / k, 0.03, 0.04, -0.9, -0.84, "orange" if t > 0 else "cyan")  # launch warning
        for j in range(k + 1):                                                        # pilasters
            tt = min(max(j / k, 0.045 / L), 1 - 0.045 / L)
            _wall(f, p, q, nin, tt - 0.045 / L, tt + 0.045 / L, 0.0, 0.06, -PIT, -0.02, "steelL")
        for zr in (-0.59, -1.09):                                                     # rails between the rows
            _wall(f, p, q, nin, 0.0, 1.0, 0.0, 0.03, zr - 0.035, zr + 0.035, "steelL")
        if t > 0:
            _wall(f, p, q, nin, 0.0, 1.0, 0.0, 0.012, -PIT - 0.36, -PIT - 0.3, "cyan")
    p, q = hole[0], hole[1]                                                           # twin vertical lamps, back wall
    for tt in (0.62, 0.68):
        _wall(f, p, q, (0, 1), tt, tt + 0.03, 0.03, 0.045, -1.0, -0.12, "arc")
    if t > 0:
        f.poly([f.pt(u, v, zb) for u, v in hole], "void", flip=True)


def coaming(f):
    """Raised lip round the opening: hazard stripes on top, a dark inner face (the pit walls run up to its top)."""
    _g("coaming")
    hole = octagon(*OPEN, CH)
    rect, ch = grow(OPEN, CH, LIP_W)
    out = octagon(*rect, ch)
    for i in range(8):
        j = (i + 1) % 8
        prism(f, [out[i], out[j], hole[j], hole[i]], PAD_T, PAD_T + LIP, "steelD", top="hazK")
    hazard_band(f, hole, LIP_W, PAD_T + LIP, w=0.12, period=0.24, slant=0.1)


def gate(f, t, home=True):
    """Boarding gate on the coaming at the access tile: two posts with lamp caps (green while a shuttle is home) and a
    gangway that reaches GANG out over the well to the parked shuttle's hatch; it retracts while the doors open."""
    _g("gate")
    u, v1 = BOARD[0], OPEN[3] + LIP_W
    z1 = PAD_T + LIP
    for su in (-1, 1):
        f.box(u + su * 0.36, v1 + 0.06, PAD_T, 0.1, 0.1, 0.62, "steel", top="steelL")
        f.box(u + su * 0.36, v1 + 0.06, PAD_T + 0.62, 0.12, 0.12, 0.06, "steelD", top="green" if home else "pcb")
    _g("bridge")
    ln = GANG * (1.0 - min(1.0, t * 3))
    if ln < 0.05:
        return
    f.box(u, v1 - ln / 2, z1 - 0.05, 0.6, ln, 0.05, "steelD", top="steelL")
    for su in (-1, 1):
        f.box(u + su * 0.27, v1 - ln / 2, z1, 0.06, ln, 0.025, "hazY", top="hazY")


def floor_holdout(rot, holdout=True, colour="dark"):
    """A big holdout sheet at floor level with the opening cut out, so the well only shows through the opening (or, with
    holdout False, a plain deck with the hole for the Blender review render)."""
    m = core.Mesh("bay_holdout")
    f = BayFrame(m, rot)
    hole = _dedup(octagon(*OPEN, CH))
    big = 9.0
    for i in range(len(hole)):                                  # radial quads from each opening edge out to `big`
        p, q = hole[i], hole[(i + 1) % len(hole)]
        dp = (p[0] / math.hypot(*p) * big, p[1] / math.hypot(*p) * big)
        dq = (q[0] / math.hypot(*q) * big, q[1] / math.hypot(*q) * big)
        f.poly([f.pt(*p, -0.002), f.pt(*q, -0.002), f.pt(*dq, -0.002), f.pt(*dp, -0.002)], colour, flip=True)
    ob = m.build()
    ob.is_holdout = holdout
    return ob


def build(f, t=0.0, home=True):
    pad(f)
    lights(f)
    boarding(f, home)
    pedestal(f)
    pit(f, t)
    coaming(f)
    leaves(f, t)
    gate(f, t, home)


def bay(rot=0, t=0.0, home=True):
    """Objects for the bay sprite at hatch open fraction t; the last object is the floor holdout (exclude it from extents)."""
    m = core.Mesh(f"vehicle_bay_r{rot}_{int(t * 100)}")
    build(BayFrame(m, rot), t, home)
    return [m.build(), floor_holdout(rot)]
