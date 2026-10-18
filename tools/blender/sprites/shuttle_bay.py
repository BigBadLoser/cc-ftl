"""SHUTTLE BAY (module.vehicle_bay, 4x5). v9 BLOCKOUT: the WHOLE footprint is the pit. Not wired in.

Local frame (BayFrame): u = grid x, v = grid y at rotation 0, origin = footprint centre, z up. The footprint is u -2..2,
v -2.5..2.5. The sprite origin is the centre of the front-most footprint tile, as for every module. Rotations follow the
sim: clockwise, (x, y) -> (h-1-y, x).

Layout: an octagonal HANGAR PIT filling the footprint (all four corners chamfered alike), PIT = 1.8 deep, with a hazard-
striped coaming lip, three rows of panelled walls with pilasters and light bars, and a floor of two launch doors. There is
no walkway inside the footprint: crew board from the normal floor beside the LONG +u side (access tile outside the
footprint, at r0 the one east of the pit at the hatch row) over a GANGWAY: a gate on the lip, a plate on the outside
floor, a short ramp down over the lip and a landing at the parked shuttle's side hatch (the hatch sill is
HATCH_Z - 0.8 above the pit floor). The shuttle (art/shuttle, transport_shuttle) parks with its nose to +v so its hatch
faces +u, the side that faces the camera at r0."""
import math
from . import core, cmbkit, walls, roofs
from .cmbkit import Frame, prim

PAD_T = 0.06                          # deck plate thickness
LEAF_T = 0.04                         # launch door thickness
OPEN = (-1.96, 1.96, -2.46, 2.46)     # pit opening u0, u1, v0, v1: the footprint less a 0.04 seat (the shuttle is 3.82 x 4.90)
UC = 0.0                              # pit centre line (u); the doors split here
CH = (0.5, 0.5, 0.5, 0.5)             # opening chamfer per corner (all four alike)
PIT = 1.8                             # PIT DEPTH below the deck = where the parked shuttle's feet stand
LIP, LIP_W = 0.09, 0.14               # raised coaming lip round the opening: height, width (it overhangs the footprint by 0.1)
SHAFT = 1.0                           # launch shaft below the doors when open
# parked shuttle (art/shuttle transport_shuttle), centred on the pit, nose +v at r0 (heading +90 deg), feet on the doors
LIFT = 0.85                           # the shuttle hangs LIFT above the pit floor in its cradle arms (PIT stays 1.8)
FEET_Z = -PIT + LIFT                  # -0.95: z of the shuttle's feet / leg pads
TOP_Z = FEET_Z + 2.7643               # +1.814: highest point (folded wing tips); the roof slab underside is walls.HF = 1.85
HATCH = (0.817, 1.40, FEET_Z + 1.30)  # hatch centre (hull surface): u, v, z. Round, 1.6 across: sill z = -0.45, top z = +1.15
HATCH_SILL = HATCH[2] - 0.8
FEET = ((1.28, -1.45), (1.28, 1.24))  # landing-leg pads on the doors: |u - UC|, v
GANG_W = 0.8                          # gangway width (across v), centred on the hatch row
GANG_TOP = 2.45                       # outer end of the plate on the outside floor (footprint edge is u = 2.0)
GANG_FOOT = 1.45                      # inner end of the stair-ramp / start of the landing
GANG_END = 0.99                       # landing's inner end, just off the hull flange


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
    """Deck plate: the four corner triangles between the footprint corners and the chamfered opening, plus the thin seat."""
    _g("deck")
    outer = octagon(-2.0, 2.0, -2.5, 2.5, (0, 0, 0, 0))
    hole = octagon(*OPEN, CH)
    for i in range(8):
        j = (i + 1) % 8
        prism(f, [outer[i], outer[j], hole[j], hole[i]], 0.0, PAD_T, "steelD", top="blueGrey")


def leaves(f, t):
    """The well floor: two launch-door leaves, open fraction t (0 closed .. 1 open), split along v at u = UC and sliding
    out into the side walls. Each leaf carries its hazard seam on the inner edge, a launch rail under the shuttle's feet and
    two foot clamps (the parts that slid into the walls are dropped)."""
    _g("hatch")
    hole = octagon(*OPEN, CH)
    hw = (OPEN[1] - OPEN[0]) / 2
    v0, v1 = OPEN[2] + 0.55, OPEN[3] - 0.55
    z = -PIT
    for s in (-1, 1):
        k = t * hw                                      # how far the inner edge has moved out
        poly = _dedup(clip(hole, -s, 0, -k - s * UC))   # keep s * (u - UC) >= k
        if len(poly) < 3 or t >= 0.999:
            continue
        prism(f, poly, z - LEAF_T, z, "steelD", top="plateC")
        e = UC + s * k                                  # inner edge u
        band = inside([(e, v0), (e + s * 0.18, v0), (e + s * 0.18, v1), (e, v1)][:: 1 if s > 0 else -1], hole)
        prism(f, band, z, z + 0.004, "hazK")
        v = v0 + 0.05
        while v + 0.27 <= v1 - 0.05:
            q = [(e, v), (e, v + 0.14), (e + s * 0.18, v + 0.27), (e + s * 0.18, v + 0.13)]
            prism(f, inside(q if s > 0 else q[::-1], hole), z + 0.004, z + 0.008, "hazY")
            v += 0.29
        du = FEET[0][0]
        uu = e + s * du
        if abs(uu - UC) + 0.1 < hw - 0.05:                                            # launch rail under the feet
            f.box(uu, (FEET[0][1] + FEET[1][1]) / 2, z, 0.16, FEET[1][1] - FEET[0][1] + 0.7, 0.05, "steelD", top="steelL")


# GANTRY (v12): overhead bridges latching onto the shuttle's TOP. Measured top of the parked shuttle (z above deck, feet -0.95):
# folded wings cover the whole aft half (1.57 .. 1.81, nothing fits over them); the cabin spine is 1.45 over v 0.6..1.5 and
# 1.33 mid-spine between the wing roots (v -0.3 .. 0.0); the nose drops to ~1.0 at v 2.1. The roof slab underside is 1.85.
# A bridge beam BEAM_T thick fits at BEAM_Z0 .. 1.80 over the nose half, with latch arms down to hardpoint pads on the spine.
BRIDGE_V = 0.36                       # the bridge, over the cabin just forward of the folded wings, aft of the gangway (v 0.83..1.95)
BEAM_Z0, BEAM_T, BEAM_W = 1.55, 0.25, 0.36
TOWER_TOP = 1.82
# claw arm centreline in (u, z), half section: top bar, corner chamfer, flank (hull here: top ~1.33..1.45, |u| ~ 0.95, hatch
# flange starts at v 0.48 and is at its widest at z 0.35, so the flank tips stop at z 0.75)
ARM = ((0.0, 1.48), (0.70, 1.48), (1.08, 1.18), (1.08, 0.62))
ARM_TH, ARM_W = 0.15, 0.34


def _seg(f, sx, p0, p1, o, dz, mat, top):
    """One thick arm segment from p0 to p1 (u, z) mirrored to side sx, pushed out by o and lifted by dz."""
    ex, ez = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(ex, ez)
    nx, nz = ez / n, -ex / n

    def corner(a, b, d):
        q = p0 if b < 0 else p1
        return (sx * (q[0] + o + nx * d * ARM_TH / 2), BRIDGE_V + sx * a * ARM_W / 2, q[1] + dz + nz * d * ARM_TH / 2)
    lbox(f, corner, {"side": mat, "top": top})


def clamps(f, t):
    """GANTRY (v14): one bridge over the cabin (towers on both side lips just aft of the gangway, a beam under the roof slab)
    with a pair of curved CLAW ARMS hanging from it, hugging the hull top and flanks with a small gap and ending above the
    hatch. Opening: the arms swing out (t 0 .. 0.06), lift into the beam (.06 .. .12), the half-beams slide into the towers
    (.12 .. .25). Everything is at or below 1.82."""
    _g("clamps")
    ko = min(1.0, t / 0.06)
    kl = min(1.0, max(0.0, (t - 0.06) / 0.06))
    k2 = min(1.0, max(0.0, (t - 0.12) / 0.13))
    vv = BRIDGE_V
    for sx in (-1, 1):
        ut = sx * (OPEN[1] + 0.08)
        f.box(ut, vv, PAD_T, 0.34, 0.5, 0.05, "steelD", top="hazK")
        f.box(ut, vv, PAD_T + 0.05, 0.24, 0.38, TOWER_TOP - PAD_T - 0.11, "steelL", top="steel")
        f.box(ut, vv, TOWER_TOP - 0.06, 0.3, 0.44, 0.06, "steelD", top="steel")
        f.box(ut - sx * 0.121, vv, 0.4, 0.02, 0.14, 1.1, "arc", base=True)
        L = (abs(ut) - 0.12) * (1.0 - k2)
        if L > 0.05:
            ub = ut - sx * (0.12 + L / 2)
            f.box(ub, vv, BEAM_Z0, L, BEAM_W, BEAM_T, "steel", top="steelL")
            f.box(ub, vv, BEAM_Z0 + BEAM_T, L, 0.08, 0.01, "hazY")
            f.box(ub, vv - BEAM_W / 2 - 0.001, BEAM_Z0 + 0.08, L - 0.1, 0.01, 0.09, "arc", base=True)
    if t > 0.14:
        return
    o, dz = 0.34 * ko, 0.2 * kl
    f.box(0.0, vv, 1.47 + dz, 0.5, 0.3, 0.08, "steel", top="steelL")                                    # hub under the beam
    f.box(0.0, vv - 0.151, 1.49 + dz, 0.4, 0.01, 0.04, "cyan", base=True)
    for sx in (-1, 1):
        for i in range(len(ARM) - 1):
            _seg(f, sx, ARM[i], ARM[i + 1], o, dz, "steel", "steelL")
        tip = ARM[-1]
        f.box(sx * (tip[0] + o), vv, tip[1] + dz - 0.06, 0.22, ARM_W + 0.04, 0.16, "orange", top="hazY")   # tip shoe
        f.box(sx * (ARM[2][0] + o), vv, ARM[2][1] + dz - 0.07, 0.15, ARM_W + 0.02, 0.14, "steelD", top="hazY")   # knuckle


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
    rows = ((-0.08, -0.62, "blueGrey"), (-0.68, -1.18, "steel"), (-1.24, -PIT + 0.06, "steelD"))
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
                _wall(f, p, q, nin, a0, a1, 0.0, 0.015, z0, z1, col)
            m = (a0 + a1) / 2                                                          # inset sub-panels, upper two rows
            for b0, b1 in ((a0 + 0.06 / L, m - 0.03 / L), (m + 0.03 / L, a1 - 0.06 / L)):
                if b1 - b0 > 0.08 / L:
                    _wall(f, p, q, nin, b0, b1, 0.015, 0.025, -0.55, -0.35, "steelD")
                    _wall(f, p, q, nin, b0, b1, 0.02, 0.03, -1.08, -0.84, "steelD")
            if L > 1.0 and not (tw and a0 < tw[1] and a1 > tw[0]):
                _wall(f, p, q, nin, a0 + 0.1 / k, a1 - 0.1 / k, 0.015, 0.025, -0.24, -0.16, "arc")     # light bar
            if L > 1.0 and j % 2 == 1:
                _wall(f, p, q, nin, a0 + 0.3 / k, a1 - 0.3 / k, 0.025, 0.035, -1.0, -0.94, "orange" if t > 0 else "cyan")  # launch warning
        for j in range(k + 1):                                                        # pilasters
            tt = min(max(j / k, 0.045 / L), 1 - 0.045 / L)
            _wall(f, p, q, nin, tt - 0.045 / L, tt + 0.045 / L, 0.0, 0.04, -PIT, -0.02, "steelL")
        for zr in (-0.65, -1.21):                                                     # rails between the rows
            _wall(f, p, q, nin, 0.0, 1.0, 0.0, 0.03, zr - 0.035, zr + 0.035, "steelL")
        if t > 0:
            _wall(f, p, q, nin, 0.0, 1.0, 0.0, 0.012, -PIT - 0.36, -PIT - 0.3, "cyan")
    p, q = hole[0], hole[1]                                                           # twin vertical lamps, back wall
    for tt in (0.62, 0.68):
        _wall(f, p, q, (0, 1), tt, tt + 0.03, 0.025, 0.04, -1.0, -0.12, "arc")
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
    """Boarding gate on the long +u lip at the hatch row: two posts with lamp caps (green while a shuttle is home), a plate on
    the outside floor, a steep stair-ramp over the pit wall down to a landing at the hatch sill, with hazard-yellow rails.
    It retracts while the doors open."""
    _g("gate")
    v = HATCH[1]
    u1 = OPEN[1] + LIP_W
    for sv in (-1, 1):
        f.box(u1 + 0.05, v + sv * (GANG_W / 2 + 0.12), PAD_T, 0.1, 0.1, 0.62, "steel", top="steelL")
        f.box(u1 + 0.05, v + sv * (GANG_W / 2 + 0.12), PAD_T + 0.62, 0.12, 0.12, 0.06, "steelD", top="green" if home else "pcb")
    _g("bridge")
    if t > 0.33:
        return
    zt = PAD_T + 0.02
    f.box((GANG_TOP + u1) / 2, v, PAD_T, GANG_TOP - u1, GANG_W, 0.02, "steelD", top="steelL")        # plate on the outside floor
    ut, ub = u1, GANG_FOOT                                                                                 # stair-ramp, top .. foot
    zb = HATCH_SILL + 0.04
    def ramp(a, b, mats):
        lbox(f, lambda a_, b_, d: (ut if b_ < 0 else ub, v + a_ * a, (zt if b_ < 0 else zb) - (0.05 if d < 0 else 0.0)), mats)
    ramp(GANG_W / 2, 0, {"side": "steelD", "top": "steelL"})
    for k in range(1, 4):                                                                                  # tread bars
        u = ut + (ub - ut) * k / 4
        z = zt + (zb - zt) * k / 4
        f.box(u, v, z, 0.05, GANG_W - 0.1, 0.012, "steelD")
    f.box((ub + GANG_END) / 2, v, zb - 0.05, ub - GANG_END, GANG_W, 0.05, "steelD", top="steelL")           # landing at the hatch
    for sv in (-1, 1):                                                                                     # rails
        vr = v + sv * (GANG_W / 2 - 0.03)
        lbox(f, lambda a_, b_, d, vr=vr: (ut if b_ < 0 else ub, vr + a_ * 0.03, (zt if b_ < 0 else zb) + (0.0 if d < 0 else 0.1)), {"side": "hazY", "top": "hazY"})
        f.box((ub + GANG_END) / 2, vr, zb, ub - GANG_END, 0.06, 0.1, "hazY", top="hazY")


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
    pit(f, t)
    coaming(f)
    leaves(f, t)
    clamps(f, t)
    gate(f, t, home)


def bay(rot=0, t=0.0, home=True):
    """Objects for the bay sprite at hatch open fraction t; the last object is the floor holdout (exclude it from extents)."""
    m = core.Mesh(f"vehicle_bay_r{rot}_{int(t * 100)}")
    build(BayFrame(m, rot), t, home)
    return [m.build(), floor_holdout(rot)]
