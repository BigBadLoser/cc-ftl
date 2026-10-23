"""The refinery hull kit, from the calibration study against the main reference refinery (3x5): a low leaning body
(long walls about 0.5 tall, deck about 0.65) with roller bays and orange buttresses on the long sides, a sloped band up
to a deck packed with rim blocks, a dark trench down the middle tile for the machine to rise out of, and orange end
armour leaning hard, every corner the same: a flat diagonal panel narrowing to the top with a raised panel up each
edge and a post at its foot. The terminal housing juts out of the crew side (+u) with a vertical face, a flat top and
the screen box on it. Local frame: modkit.K, u across, v along."""
import math

from mathutils import Vector

from . import refinery3 as R3
from . import refinery4 as R4
from .steelkit import face, slab, tube

BU, BV = 1.2, 1.72             # the body's half extents (3x4)
WZ, DZ = 0.5, 0.66             # the long walls' top, the deck
SLW, SLE = 0.32, 0.42          # the lean of the long walls, of the end armour
EV = 1.02                      # where the end armour starts (|v|)
COR = 0.4                      # its cut corners
TR = 0.45                      # the trench's half width
BODY, MID, DK, BLK = "blueGrey", "steel", "steelD", "dark"
LT, LT2 = "gm", "plate"
OR, OR_L = "c1T3", "c1T2"
AMBER, GLOW, HOT = "flameY", "orange", "flameY"
TERM = 0.36                    # the terminal housing's half width (v)


class M(R4.Mass):
    """A Mass with its own lean and corner taper; corners up to 0.62 of its short side."""

    def __init__(self, rect, h, outer, sl=0.2, hip=0.41, corner=0.3, **kw):
        super().__init__(rect, h, outer, corner=corner, **kw)
        self.sl, self.hip = sl, hip
        u0, u1, v0, v1 = rect
        cmax = 0.62 * min(u1 - u0, v1 - v0)
        pairs = (("-v", "-u"), ("-v", "+u"), ("+v", "+u"), ("+v", "-u"))
        self.c = [min(corner, cmax) if a in self.outer and b in self.outer else 0.0 for a, b in pairs]

    def inset(self, side, z):
        return self.sl * z if side in self.outer else 0.0

    def oct_at(self, z, extra=0.0):
        sh = (self.sl * z + extra) * self.hip
        return R3._oct(self.rect_at(z, extra), [max(0.0, c - sh) for c in self.c])

    def wall_with_openings(self, k, side, zm, col):
        u0, u1, v0, v1 = self.r
        mid = self.point(side, (u0 + u1) / 2 if side in ("+v", "-v") else (v0 + v1) / 2, 0)
        super().wall_with_openings(k, side, self.top_z(mid) - (R4.CT if self.bev else 0.0), col)


def ramp(rect, h0, h1, outer, **kw):
    """A block whose top runs from h0 at its -v end to h1 at its +v end."""
    v0, v1 = rect[2], rect[3]
    return M(rect, (h0 + h1) / 2, outer, slope=(0.0, (h1 - h0) / (v1 - v0)), **kw)


def bx(k, u, v, z, su, sv, sz, col, top=None, bev=0.015):
    k.box(u, v, z, su, sv, sz, col, top=top or col, bevel=bev)


def on_face(k, blk, side, s0, s1, z0, z1, t, col, lift=0.0):
    """A plate on a block's (leaning) face."""
    n = blk.normal(side)
    nn = (n + Vector((0, 0, blk.sl if side in blk.outer else 0.0))).normalized()
    pts = [blk.point(side, s, z) + nn * (t / 2 + lift) for s, z in ((s0, z0), (s1, z0), (s1, z1), (s0, z1))]
    slab(k, pts, nn, t, col)


def _grow(q, d):
    c = sum(q, Vector()) / len(q)
    return [p + (p - c).normalized() * d for p in q]


def raised_edges(k, blk, i, w=0.09, t=0.05):
    """A cut corner's armour: a raised light-orange panel up each edge where the flat diagonal meets a face (both
    sides of the edge, a dark seam under it), a post at the foot of each."""
    cen = Vector(((blk.r[0] + blk.r[1]) / 2, (blk.r[2] + blk.r[3]) / 2, 0))
    lo = blk.oct_at(0.0)

    def at(a, z):
        return Vector((*blk.oct_at(z)[a % 8], z))

    for a, b, e in ((i, i + 1, i - 1), (i + 1, i, i + 2)):
        z1 = blk.top_z(lo[a % 8]) - R4.CT - 0.01
        for other in (b, e):
            p0, p1 = at(a, 0.0), at(a, z1)
            d0, d1 = (at(other, 0.0) - p0).normalized(), (at(other, z1) - p1).normalized()
            q = [p0, p1, p1 + d1 * w, p0 + d0 * w]
            n = (q[1] - q[0]).cross(q[3] - q[0]).normalized()
            if n.dot(Vector((q[0].x, q[0].y, 0)) - cen) < 0:
                n = -n
            slab(k, [p + n * 0.012 for p in _grow(q, 0.02)], n, 0.024, DK)
            slab(k, [p + n * (t / 2 + 0.01) for p in q], n, t, OR_L)
        p = at(a, 0.0)
        c = p + (Vector((p.x, p.y, 0)) - cen).normalized() * 0.1
        k.cyl(c.x, c.y, 0.0, 0.07, 0.18, MID, top=LT, sides=8)


def ribs(k, blk, side, s0, s1, z0, z1, n=6):
    """A dark ribbed band on a face."""
    on_face(k, blk, side, s0, s1, z0, z1, 0.03, DK)
    for j in range(n):
        za = z0 + (j + 0.25) * (z1 - z0) / n
        on_face(k, blk, side, s0 + 0.015, s1 - 0.015, za, za + 0.45 * (z1 - z0) / n, 0.025, BODY, lift=0.03)


# ---- the body ------------------------------------------------------------------------------------------------------

def rollers(k, core, side, s0, s1, depth):
    """Two rows of ribbed drums lying along a bay."""
    sg = 1 if side == "+u" else -1
    for z in (0.15, 0.34):
        u = core.point(side, 0, z).x - sg * (depth - 0.13)
        tube(k, (u, s0 + 0.03, z), (u, s1 - 0.03, z), 0.085, DK, sides=12, cap=DK)
        n = max(2, int((s1 - s0) / 0.13))
        for i in range(n):
            v = s0 + 0.09 + i * (s1 - s0 - 0.18) / (n - 1)
            tube(k, (u, v - 0.03, z), (u, v + 0.03, z), 0.112, LT2 if i % 2 else LT, sides=12, cap=LT2)


def body(k, bays):
    """The long body: leaning walls with roller bays (bays: {side: [(v0, v1)]}) and orange buttresses either side of
    each, a sloped band up to the deck on each side."""
    ops = [(side, a, b, 0.05, 0.44, 0.2) for side, bs in bays.items() for a, b in bs]
    core = M((-BU, BU, -EV - 0.05, EV + 0.05), WZ, {"+u", "-u"}, sl=SLW, top=DK, openings=ops)
    core.build(k)
    for s in (1, -1):
        ue, ui = s * (BU - SLW * WZ), s * 0.8
        face(k, [(ue, -EV, WZ), (ue, EV, WZ), (ui, EV, DZ), (ui, -EV, DZ)], (s, 0, 1.2), BODY)
    face(k, [(-0.8, -EV, DZ), (0.8, -EV, DZ), (0.8, EV, DZ), (-0.8, EV, DZ)], (0, 0, 1), DK)
    for side, bs in bays.items():
        sg = 1 if side == "+u" else -1
        s0, s1 = Vector((sg * (BU - SLW * WZ), 0, WZ)), Vector((sg * 0.8, 0, DZ))
        n = Vector((sg * (DZ - WZ), 0, abs(s0.x - s1.x))).normalized()
        for a, b in bs:
            rollers(k, core, side, a, b, 0.2)
            for v in (a - 0.04, b + 0.04):                                     # the buttresses
                on_face(k, core, side, v - 0.08, v + 0.08, 0.0, WZ, 0.08, OR)
                on_face(k, core, side, v - 0.025, v + 0.025, 0.0, WZ, 0.04, DK, lift=0.08)
                p = s0 + (s1 - s0) * 0.5 + Vector((0, v, 0))
                bx(k, p.x, v, p.z - 0.05, 0.18, 0.14, 0.1, DK, MID)
            pts = [s0 + (s1 - s0) * t + Vector((0, v, 0)) for t, v in ((0.3, a + 0.1), (0.3, b - 0.1), (0.72, b - 0.1),
                                                                         (0.72, a + 0.1))]
            slab(k, [p + n * 0.025 for p in pts], n, 0.05, OR)                  # the bar over the bay
    return core


def rim(k, skip=()):
    """The rim of blocks round the deck, over the end armour too; none where `skip` ((u, v, r)) has something."""
    def free(u, v):
        return all(abs(u - su) > r or abs(v - sv) > r for su, sv, r in skip)
    for s in (1, -1):
        for i in range(7):
            v = -0.93 + i * 0.31
            if free(s * 0.72, v):
                bx(k, s * 0.72, v, DZ, 0.2, 0.26, 0.1, DK, MID)
    for u in (-0.75, -0.25, 0.25, 0.75):
        for v in (EV + 0.1, -EV - 0.1):
            if free(u, v):
                bx(k, u, v, DZ, 0.3, 0.2, 0.1, DK, MID)


def trench(k, v0=-EV, v1=EV):
    k.box(0.0, (v0 + v1) / 2, DZ - 0.12, 2 * TR, v1 - v0, 0.125, BLK, top=BLK)


def hopper(k, u, v):
    k.cyl(u, v, DZ, 0.24, 0.16, LT, top=LT2, sides=8)
    k.cyl(u, v, DZ + 0.161, 0.17, 0.005, BLK, top=BLK, sides=8)
    bx(k, u + 0.04, v + 0.27, DZ, 0.05, 0.1, 0.2, OR, OR_L, bev=0.008)        # the lever plate


def ends(k, ribbed=True):
    """The end armour: one block across each end, every corner the same."""
    kw = dict(sl=SLE, armour=True, top=OR, corner=COR, cap=True, hip=0.6)
    far = ramp((-BU, BU, EV, BV), DZ + 0.02, 0.56, {"+v", "+u", "-u"}, **kw)
    near = ramp((-BU, BU, -BV, -EV), 0.56, DZ + 0.02, {"-v", "+u", "-u"}, **kw)
    for b in (far, near):
        b.build(k)
    for blk, i in ((near, 1), (near, 7), (far, 3), (far, 5)):
        raised_edges(k, blk, i)
    for blk, side in ((near, "-v"), (far, "+v")):
        on_face(k, blk, side, -BU + COR, BU - COR, 0.0, 0.05, 0.03, DK)          # the dark base band
        if ribbed:
            for a in (-0.42, 0.28):
                ribs(k, blk, side, a, a + 0.14, 0.05, 0.46)
    for blk, a, b in ((near, -BV + COR, -EV), (far, EV, BV - COR)):
        for side in ("+u", "-u"):
            on_face(k, blk, side, a, b, 0.0, 0.05, 0.03, DK)
    return near, far


def terminal(k, on):
    """The terminal housing jutting from the crew side at the access tile: vertical faces, a flat top, the output
    tunnel in its face, the screen box on top."""
    u0 = BU - SLW * WZ - 0.1
    door = M((u0, BU + 0.26, -TERM, TERM), 0.5, set(), top=MID, cap=True,
             openings=[("+u", -0.17, 0.17, 0.0, 0.3, 0.3)])
    door.build(k)
    for a, b, c, d in ((-0.23, -0.17, 0.0, 0.36), (0.17, 0.23, 0.0, 0.36), (-0.23, 0.23, 0.3, 0.36)):
        on_face(k, door, "+u", a, b, c, d, 0.04, LT)
    if on:
        p = door.point("+u", 0, 0) - Vector((0.29, 0, 0))
        k.box(p.x, 0, 0.12, 0.01, 0.26, 0.05, GLOW)                            # the hot output, deep in the tunnel
    ub = BU - 0.02
    bx(k, ub - 0.2, 0, 0.5, 0.44, 0.6, 0.32, BODY, MID, bev=0.025)
    bx(k, ub - 0.2, 0, 0.82, 0.34, 0.5, 0.03, MID, LT)
    k.box(ub + 0.005, 0, 0.56, 0.02, 0.46, 0.21, BLK)                             # the screen
    for dv in (-0.09, 0.09):
        k.box(ub + 0.016, dv, 0.67, 0.01, 0.09, 0.035, "lampY" if on else DK)
    k.box(ub + 0.016, 0, 0.61, 0.01, 0.18, 0.03, "lampY" if on else DK)


def stack(k, u, v, z, h=0.6, r=0.31, on=True, faces=((1, 0), (0, 1), (-1, 0), (0, -1))):
    """An octagonal stack, its light rim and dark bore, lit slits on its faces."""
    k.cyl(u, v, z, r, h, DK, top=DK, sides=8)
    k.cyl(u, v, z + h, r + 0.03, 0.07, LT, top=LT2, sides=8)
    k.cyl(u, v, z + h + 0.071, r - 0.08, 0.005, BLK, top=BLK, sides=8)
    f = r * math.cos(math.pi / 8)
    for du, dv in faces:
        k.box(u + du * (f + 0.005), v + dv * (f + 0.005), z + h - 0.18, 0.03 if du else 0.16, 0.16 if du else 0.03,
              0.07, AMBER if on else DK)
