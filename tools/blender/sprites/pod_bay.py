"""POD BAY (module.pod_bay, 3x3): a compact launch cradle for one mining pod (mining_pod.py). The shuttle bay's little
sibling (shuttle_bay.py: its frame, polygon helpers and hazard bands).

Local frame (shuttle_bay.BayFrame, footprint (3, 3)): u = grid x, v = grid y at rotation 0, origin at the footprint centre.
Layout: an octagonal pit filling the footprint, PIT deep, under a hazard-striped coaming. Its floor is an IRIS of eight
blades that turn open into a launch shaft. Two clamp arms rise from the side lips (+-v), arch over the parked pod and grip
its top; they fold back against the lips to let it go. A work light stands on each chamfered corner, aimed into the
pit. Crew reach the pod from the access tile beside the middle of the +u side (module access [3, 1]): a gate on the lip
and a short tongue out over the pit to the pod's side hatch, which faces it (the pod parks nose -v at r0)."""
import math

from . import core
from .shuttle_bay import BayFrame, _dedup, _g, _wall, grow, hazard_band, inside, lbox, octagon, prism

FOOT = (3, 3)
PAD_T = 0.06
OPEN = (-1.4, 1.4, -1.4, 1.4)          # pit opening (the footprint less a seat)
CH = (0.42, 0.42, 0.42, 0.42)
PIT = 0.8                              # pit floor below the deck, where the parked pod's thruster bell rests
LIP, LIP_W = 0.08, 0.12
SHAFT = 0.8
IRIS_R, IRIS_N = 1.18, 8               # iris radius and blade count
IRIS_T = 0.04
ARM_V = -0.42                          # the clamps reach over the pod's top aft of its yellow band (u)
ARM = ((1.5, 0.12), (1.5, 1.18), (1.3, 1.4), (0.9, 1.36), (0.62, 1.22))   # (|v|, z): lip pivot, up, over, onto the
                                                                           # top of the pod's drum
ARM_W, ARM_TH = 0.3, 0.11
FOLD = (0.45, 0.85)                    # arm fold per .fold.f<i>
OPENS = (0.3, 0.65, 1.0)               # iris open fraction per .open.f<i>


def pad(f):
    _g("deck")
    outer = octagon(-1.5, 1.5, -1.5, 1.5, (0, 0, 0, 0))
    hole = octagon(*OPEN, CH)
    for i in range(8):
        j = (i + 1) % 8
        prism(f, [outer[i], outer[j], hole[j], hole[i]], 0.0, PAD_T, "steelD", top="blueGrey")


def coaming(f):
    _g("coaming")
    hole = octagon(*OPEN, CH)
    rect, ch = grow(OPEN, CH, LIP_W)
    out = octagon(*rect, ch)
    for i in range(8):
        j = (i + 1) % 8
        prism(f, [out[i], out[j], hole[j], hole[i]], PAD_T, PAD_T + LIP, "steelD", top="hazK")
    hazard_band(f, hole, LIP_W, PAD_T + LIP, w=0.1, period=0.2, slant=0.08)


def pit(f, t):
    """Pit walls in two courses (a lit upper band with light bars, a dark lower one), pilasters at the panel joints, warning
    lamps that turn orange while the iris cycles; open, the shaft runs on to black space."""
    _g("pit")
    hole = _dedup(octagon(*OPEN, CH))
    zb = -(PIT + (SHAFT if t > 0 else IRIS_T))
    n = len(hole)
    for i in range(n):
        p, q = hole[i], hole[(i + 1) % n]
        L = math.dist(p, q)
        e = ((q[0] - p[0]) / L, (q[1] - p[1]) / L)
        nin = (-e[1], e[0])
        if nin[0] * -p[0] + nin[1] * -p[1] < 0:
            nin = (-nin[0], -nin[1])
        _wall(f, p, q, nin, 0.0, 1.0, -0.03, 0.0, zb, PAD_T + LIP - 0.01, "steelD")
        k = max(1, int(round(L / 0.55)))
        for j in range(k):
            a0, a1 = (j + 0.06) / k, (j + 0.94) / k
            _wall(f, p, q, nin, a0, a1, 0.0, 0.015, -0.4, -0.06, "blueGrey")
            _wall(f, p, q, nin, a0, a1, 0.0, 0.015, -PIT + 0.04, -0.46, "steel")
            if L > 0.9:
                _wall(f, p, q, nin, a0 + 0.12 / k, a1 - 0.12 / k, 0.015, 0.025, -0.2, -0.14, "arc")
                if j % 2 == 0:
                    _wall(f, p, q, nin, a0 + 0.3 / k, a1 - 0.3 / k, 0.02, 0.03, -0.62, -0.56, "orange" if t > 0 else "steelD")
        for j in range(k + 1):
            tt = min(max(j / k, 0.04 / L), 1 - 0.04 / L)
            _wall(f, p, q, nin, tt - 0.04 / L, tt + 0.04 / L, 0.0, 0.035, -PIT, -0.02, "steelL")
        _wall(f, p, q, nin, 0.0, 1.0, 0.0, 0.03, -0.46, -0.4, "steelL")                   # rail between the courses
        if t > 0:
            _wall(f, p, q, nin, 0.0, 1.0, 0.0, 0.012, -PIT - 0.3, -PIT - 0.25, "cyan")
    if t > 0:
        f.poly([f.pt(u, v, zb) for u, v in hole], "void", flip=True)


def _circle(r, n=24, a0=0.0):
    return [(r * math.cos(a0 + i * math.tau / n), r * math.sin(a0 + i * math.tau / n)) for i in range(n)]


def iris(f, t):
    """The pit floor: a plate ring round an iris of eight blades. t: 0 shut (the blades meet at the centre) .. 1 open (drawn
    back under the ring). Each blade is turned a little as it opens, so the opening stays round and the seams spiral."""
    _g("iris")
    z = -PIT
    hole = _dedup(octagon(*OPEN, CH))
    ring = _circle(IRIS_R)
    for i in range(len(ring)):                                             # floor ring: the pit floor outside the iris
        p, q = ring[i], ring[(i + 1) % len(ring)]
        far = [(a * 3, b * 3) for a, b in (q, p)]
        poly = inside([p, q] + far, hole)
        if len(poly) >= 3:
            prism(f, poly, z - IRIS_T, z, "steelD", top="plateC")
    hazard_band(f, ring[::-1], 0.12, z, w=0.09, period=0.19, slant=0.07)
    if t >= 0.999:
        return
    r_in = max(0.02, t * IRIS_R)
    sw = math.tau / IRIS_N
    bend = 0.9                                                             # how far a seam turns from rim to tip
    f.poly([f.pt(u, v, z - 0.002) for u, v in _circle(IRIS_R, 24)][::-1], "dark", flip=True)   # under the seams
    rings, arcs = 4, 3
    for b in range(IRIS_N):
        a = b * sw + 0.6 * t                                               # the blades turn as they draw back
        col = "steelL" if b % 2 else "plate"
        for i in range(rings):
            ra, rb = (IRIS_R + (r_in - IRIS_R) * k / rings for k in (i, i + 1))
            ta, tb = (a + bend * (IRIS_R - r) / IRIS_R for r in (ra, rb))
            g = 0.022 / max(ra, 0.1), 0.022 / max(rb, 0.1)                  # the seam, a constant width
            for j in range(arcs):
                pa = [ta + g[0] + (sw - 2 * g[0]) * jj / arcs for jj in (j, j + 1)]
                pb = [tb + g[1] + (sw - 2 * g[1]) * jj / arcs for jj in (j, j + 1)]
                if sw - 2 * g[1] <= 0:
                    continue
                f.poly([f.pt(ra * math.cos(pa[0]), ra * math.sin(pa[0]), z), f.pt(ra * math.cos(pa[1]), ra * math.sin(pa[1]), z),
                        f.pt(rb * math.cos(pb[1]), rb * math.sin(pb[1]), z), f.pt(rb * math.cos(pb[0]), rb * math.sin(pb[0]), z)],
                       col, flip=True)
        rr = (IRIS_R + r_in) * 0.55
        tr = a + bend * (IRIS_R - rr) / IRIS_R + sw / 2
        f.box(rr * math.cos(tr), rr * math.sin(tr), z, 0.07, 0.07, 0.014, "steelL")      # a rivet per blade
    if r_in < 0.05:                                                        # the hub where the blades meet
        f.vcyl(0, 0, z, 0.14, 0.02, "steelD", top="steelD", sides=12)
        f.vcyl(0, 0, z + 0.02, 0.07, 0.012, "hazY", top="hazY", sides=12)


def _seg(f, sv, p0, p1, w, th, mat, top):
    ex, ez = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(ex, ez)
    nx, nz = ez / n, -ex / n

    def corner(a, b, d):
        q = p0 if b < 0 else p1
        return (ARM_V + a * w / 2, sv * (q[0] + nx * d * th / 2), q[1] + nz * d * th / 2)
    lbox(f, corner, {"side": mat, "top": top})


def arms(f, fold):
    """Two clamp arms from the +-v lips: a pivot block on the lip, a pale arm with a lamp strip rising and arching over
    the pod, an orange shoe gripping the top of its drum. fold 0 gripping .. 1 folded flat against the lip."""
    _g("arms")
    for sv in (-1, 1):
        f.box(ARM_V, sv * 1.5, PAD_T, ARM_W + 0.16, 0.24, 0.16, "steelD", top="steel")
        f.box(ARM_V, sv * 1.5, PAD_T + 0.16, ARM_W + 0.04, 0.16, 0.08, "hazK", top="hazY")
        if fold >= 0.97:
            continue
        piv = ARM[0]
        k = fold
        p = [(piv[0] + (a - piv[0]) * (1 - k), piv[1] + (z - piv[1]) * (1 - k) + k * 0.05) for a, z in ARM]
        for i in range(len(p) - 1):
            _seg(f, sv, p[i], p[i + 1], ARM_W, ARM_TH, "steelL", "steelL")
            _seg(f, sv, p[i], p[i + 1], 0.1, ARM_TH + 0.03, "arc", "arc")
        a, z = p[-1]
        f.box(ARM_V, sv * a, z - 0.12, ARM_W + 0.04, 0.12, 0.12, "orange" if k < 0.01 else "steelD", top="hazY")


def lights(f, on):
    """A work light on each chamfered corner of the deck, its head turned in over the pit."""
    _g("lights")
    for su in (-1, 1):
        for sv in (-1, 1):
            u, v = su * 1.3, sv * 1.3
            f.box(u, v, PAD_T, 0.16, 0.16, 0.04, "steelD", top="hazK")
            f.vcyl(u, v, PAD_T + 0.04, 0.035, 0.5, "steelL", sides=6)
            yaw = math.atan2(-v, -u)
            hu, hv = u + 0.08 * math.cos(yaw), v + 0.08 * math.sin(yaw)
            f.box(hu, hv, PAD_T + 0.48, 0.16, 0.16, 0.12, "steelD", top="steel")
            f.box(hu + 0.08 * math.cos(yaw), hv + 0.08 * math.sin(yaw), PAD_T + 0.5, 0.05, 0.05, 0.08,
                  "arc" if on else "dark")


def gate(f, t, home):
    """The boarding gate on the +u lip: two posts with status lamps and a tongue out over the pit to the pod's canopy;
    it draws back while the iris cycles."""
    _g("gate")
    u1 = OPEN[1] + LIP_W
    for sv in (-1, 1):
        f.box(u1 + 0.04, sv * 0.34, PAD_T, 0.08, 0.08, 0.5, "steel", top="steelL")
        f.box(u1 + 0.04, sv * 0.34, PAD_T + 0.5, 0.1, 0.1, 0.05, "steelD", top="green" if home else "pcb")
    f.box(u1 + 0.25, 0, PAD_T, 0.42, 0.6, 0.02, "steelD", top="steelL")                  # plate on the access tile
    if t > 0:
        return
    f.box(u1 - 0.2, 0, PAD_T + LIP - 0.03, 0.4, 0.56, 0.04, "steelD", top="steelL")       # the tongue over the lip
    for sv in (-1, 1):
        f.box(u1 - 0.2, sv * 0.27, PAD_T + LIP + 0.01, 0.4, 0.03, 0.2, "hazY")


def build(f, t=0.0, home=True, fold=None):
    pad(f)
    pit(f, t)
    iris(f, t)
    coaming(f)
    arms(f, (1.0 if t > 0 or not home else 0.0) if fold is None else fold)
    lights(f, home or t > 0)
    gate(f, t, home)


def floor_holdout(rot):
    m = core.Mesh("pod_bay_holdout")
    f = BayFrame(m, rot, FOOT)
    hole = _dedup(octagon(*OPEN, CH))
    big = 9.0
    for i in range(len(hole)):
        p, q = hole[i], hole[(i + 1) % len(hole)]
        dp = (p[0] / math.hypot(*p) * big, p[1] / math.hypot(*p) * big)
        dq = (q[0] / math.hypot(*q) * big, q[1] / math.hypot(*q) * big)
        f.poly([f.pt(*p, -0.002), f.pt(*q, -0.002), f.pt(*dq, -0.002), f.pt(*dp, -0.002)], "dark", flip=True)
    ob = m.build()
    ob.is_holdout = True
    return ob


def bay(rot=0, t=0.0, home=True, fold=None):
    """Objects for the bay sprite; the last is the floor holdout (keep it out of the extents)."""
    m = core.Mesh(f"pod_bay_r{rot}_{int(t * 100)}")
    build(BayFrame(m, rot, FOOT), t, home, fold)
    return [m.build(), floor_holdout(rot)]
