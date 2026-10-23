"""REFINERY, third build (module.refinery, 3x4): the machine first, the armour grown round it. The machine (a crucible,
a row of stacks, a kiln drum) stands on the floor; blocks tile the rest of the footprint round it at different heights,
hugging it, so the housing takes the machine's shape and the silhouette steps.

Blocks: only their outer faces (on the footprint's edge) lean in, all at one slope so neighbours' walls lie in one
plane; where blocks meet the faces are vertical and flush; outer corners are cut and orange; outer top edges carry an
orange bevel. A change of height is a clean vertical step. Openings (the terminal's niche, the hatches, vents) are cut
into block faces with real recesses behind. Crew side +u, access at its middle. Local frame: modkit.K, u across the
3-tile width, v along the 4."""
import math

from mathutils import Vector

from .modkit import K
from .steelkit import face, slab, tube

FP = (3, 4)
U, V = 1.46, 1.96
BODY, TOP, REC, DARK = "steel", "blueGrey", "steelD", "dark"
ARM, ARM_L, ARM_D = "c1T3", "c1T2", "c1T4"
GLOW, HOT, SCREEN = "orange", "flameY", "lampY"
SL = 0.26                                  # the lean of outer faces, per unit of height
CT = 0.08                                  # the bevel on outer top edges
SIDES = ("-v", "+u", "+v", "-u")           # the octagon's even edges, in order


def _oct(r, c):
    u0, u1, v0, v1 = r
    a, b, d, e = c
    return [(u0 + a, v0), (u1 - b, v0), (u1, v0 + b), (u1, v1 - d), (u1 - d, v1), (u0 + e, v1), (u0, v1 - e), (u0, v0 + a)]


class Block:
    """A housing block on rect (u0, u1, v0, v1), h tall; `outer` its sides on the footprint's edge (leaning, bevelled).
    armour: orange walls, else body walls with orange corners and trim. openings: [(side, s0, s1, z0, z1, depth)]."""

    def __init__(self, rect, h, outer, armour=False, top=TOP, openings=(), corner=0.3):
        self.r, self.h, self.outer, self.armour, self.top = rect, h, set(outer), armour, top
        self.openings = list(openings)
        u0, u1, v0, v1 = rect
        cmax = 0.4 * min(u1 - u0, v1 - v0)
        pairs = (("-v", "-u"), ("-v", "+u"), ("+v", "+u"), ("+v", "-u"))
        self.c = [min(corner, cmax) if a in self.outer and b in self.outer else 0.0 for a, b in pairs]

    def inset(self, side, z):
        return SL * z if side in self.outer else 0.0

    def rect_at(self, z, extra=0.0):
        u0, u1, v0, v1 = self.r
        e = lambda s: (self.inset(s, z) + extra) if s in self.outer else 0.0   # noqa: E731
        return (u0 + e("-u"), u1 - e("+u"), v0 + e("-v"), v1 - e("+v"))

    def oct_at(self, z, extra=0.0):
        sh = (SL * z + extra) * 0.41
        return _oct(self.rect_at(z, extra), [max(0.0, c - sh) for c in self.c])

    def point(self, side, s, z):
        r = self.rect_at(z)
        return {"+u": Vector((r[1], s, z)), "-u": Vector((r[0], s, z)), "+v": Vector((s, r[3], z)),
                "-v": Vector((s, r[2], z))}[side]

    def normal(self, side):
        return {"+u": Vector((1, 0, 0)), "-u": Vector((-1, 0, 0)), "+v": Vector((0, 1, 0)), "-v": Vector((0, -1, 0))}[side]

    def build(self, k):
        zm = self.h - (CT if self.outer else 0.0)
        lo, mid, hi = self.oct_at(0), self.oct_at(zm), self.oct_at(zm, CT if self.outer else 0.0)
        cen = Vector(((self.r[0] + self.r[1]) / 2, (self.r[2] + self.r[3]) / 2, 0))
        wall = ARM if self.armour else BODY
        for i in range(8):
            j = (i + 1) % 8
            side = SIDES[i // 2] if i % 2 == 0 else None
            out = Vector(((lo[i][0] + lo[j][0]) / 2, (lo[i][1] + lo[j][1]) / 2, 0)) - cen
            if math.dist(lo[i], lo[j]) > 1e-6:
                if side and any(o[0] == side for o in self.openings):
                    self.wall_with_openings(k, side, zm, wall)
                else:
                    face(k, [(*lo[i], 0), (*lo[j], 0), (*mid[j], zm), (*mid[i], zm)], out, ARM if side is None else wall)
            if zm < self.h and (math.dist(mid[i], mid[j]) > 1e-6 or math.dist(hi[i], hi[j]) > 1e-6):
                bevel = side is None or side in self.outer
                face(k, [(*mid[i], zm), (*mid[j], zm), (*hi[j], self.h), (*hi[i], self.h)], out + Vector((0, 0, 1)),
                     ARM_L if bevel else wall)
        face(k, [(*p, self.h) for p in hi], (0, 0, 1), self.top)
        for o in self.openings:
            self.recess(k, *o)

    def wall_with_openings(self, k, side, zm, col):
        ops = sorted((o for o in self.openings if o[0] == side), key=lambda o: o[1])
        along_u = side in ("+v", "-v")

        def ends(z):
            idx = SIDES.index(side) * 2
            oc = self.oct_at(z)
            p, q = oc[idx], oc[(idx + 1) % 8]
            sp, sq = (p[0], q[0]) if along_u else (p[1], q[1])
            return min(sp, sq), max(sp, sq)
        zs = sorted({0.0, zm} | {z for o in ops for z in (o[3], o[4])})
        for za, zb in zip(zs, zs[1:]):
            cols = [None] + [x for o in ops if o[3] <= za and zb <= o[4] for x in (o[1], o[2])] + [None]
            for c in range(len(cols) - 1):
                if c % 2 == 1:
                    continue
                pa = lambda x, z, end: self.point(side, (ends(z)[end] if x is None else x), z)   # noqa: E731
                q = [pa(cols[c], za, 0), pa(cols[c + 1], za, 1), pa(cols[c + 1], zb, 1), pa(cols[c], zb, 0)]
                face(k, q, self.normal(side), col)

    def recess(self, k, side, s0, s1, z0, z1, depth):
        n = self.normal(side)
        fr = lambda s, z: self.point(side, s, z)                              # noqa: E731
        bk = lambda s, z: self.point(side, s, z) - n * depth                  # noqa: E731
        face(k, [bk(s0, z0), bk(s1, z0), bk(s1, z1), bk(s0, z1)], n, REC)
        if z0 > 0:
            face(k, [fr(s0, z0), fr(s1, z0), bk(s1, z0), bk(s0, z0)], (0, 0, 1), BODY)
        face(k, [fr(s0, z1), fr(s1, z1), bk(s1, z1), bk(s0, z1)], (0, 0, -1), REC)
        along = Vector((1, 0, 0)) if side in ("+v", "-v") else Vector((0, 1, 0))
        face(k, [fr(s0, z0), bk(s0, z0), bk(s0, z1), fr(s0, z1)], along, BODY)
        face(k, [fr(s1, z0), bk(s1, z0), bk(s1, z1), fr(s1, z1)], -along, BODY)


# ---- fittings in the openings --------------------------------------------------------------------------------------

def console(k, u_back, u_front, v0, v1, on):
    """A console in the terminal's niche: its top slopes up to the back, the screen on a gimbal over it."""
    zb, zf = 0.6, 0.42
    z = lambda u: zb + (zf - zb) * (u - u_back) / (u_front - u_back)          # noqa: E731
    plan = [(u_back, v0), (u_front - 0.08, v0), (u_front, v0 + 0.08), (u_front, v1 - 0.08), (u_front - 0.08, v1),
            (u_back, v1)]
    face(k, [(u, v, z(u)) for u, v in plan], (zb - zf, 0, u_front - u_back), ARM)
    for i in range(len(plan) - 1):
        (ua, va), (ub, vb) = plan[i], plan[i + 1]
        face(k, [(ua, va, 0), (ub, vb, 0), (ub, vb, z(ub)), (ua, va, z(ua))],
             Vector(((ua + ub) / 2 - u_back, (va + vb) / 2 - (v0 + v1) / 2, 0)), BODY)
    uc, vc = (u_back + u_front) / 2, (v0 + v1) / 2
    k.cyl(uc, vc, z(uc) - 0.02, 0.045, 0.14, REC, top=BODY, sides=10)
    t = math.radians(28)
    n, up = Vector((math.cos(t), 0, math.sin(t))), Vector((-math.sin(t), 0, math.cos(t)))
    c, sd = Vector((uc + 0.02, vc, z(uc) + 0.22)), Vector((0, 1, 0))
    quad = lambda w, hh, d=0.0: [c + n * d + sd * a * w / 2 + up * b * hh / 2 for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]  # noqa: E731
    slab(k, quad(0.46, 0.3), n, 0.05, BODY, side=REC)
    face(k, quad(0.38, 0.22, 0.027), n, SCREEN if on else DARK)


def mouth(k, blk, side, s0, s1, z0, depth, hot, on):
    """A hatch: a dark mouth in the recess's back wall, a chute sloping into it; the output glows inside."""
    n = blk.normal(side)
    c = (s0 + s1) / 2
    back = blk.point(side, c, z0) - n * depth
    along = Vector((1, 0, 0)) if side in ("+v", "-v") else Vector((0, 1, 0))
    w = s1 - s0
    p = back + n * 0.005 + Vector((0, 0, 0.14))
    k.box(p.x, p.y, p.z, 0.01 if along.y else w - 0.16, w - 0.16 if along.y else 0.01, 0.26, DARK)
    a, b = back + Vector((0, 0, 0.14)), back + n * depth * 0.75 + Vector((0, 0, 0.02))
    face(k, [a - along * (w / 2 - 0.05), a + along * (w / 2 - 0.05), b + along * (w / 2 - 0.05), b - along * (w / 2 - 0.05)],
         n + Vector((0, 0, 1.5)), REC)
    if hot:
        q = back + n * 0.012 + Vector((0, 0, 0.17))
        k.box(q.x, q.y, q.z, 0.01 if along.y else w - 0.3, w - 0.3 if along.y else 0.01, 0.05, GLOW if on else REC)


def louvres(k, blk, side, s0, s1, z0, z1, depth, on):
    n = blk.normal(side)
    c = (s0 + s1) / 2
    along_y = side in ("+u", "-u")
    back = blk.point(side, c, z0) - n * depth + n * 0.006
    k.box(back.x, back.y, z0 + 0.04, 0.01 if along_y else s1 - s0 - 0.08, s1 - s0 - 0.08 if along_y else 0.01,
          z1 - z0 - 0.08, GLOW if on else DARK)
    m = max(2, int((z1 - z0) / 0.1))
    for i in range(m):
        z = z0 + 0.03 + i * (z1 - z0 - 0.06) / m
        p = blk.point(side, c, z) - n * depth * 0.5
        k.box(p.x, p.y, z, 0.12 if along_y else s1 - s0 - 0.02, s1 - s0 - 0.02 if along_y else 0.12, 0.03, BODY, top=TOP)


# ---- machines ------------------------------------------------------------------------------------------------------

def annulus(k, u, v, z0, z1, ro, ri, col, n=24):
    ring = lambda r, z: [Vector((u + r * math.cos(i * math.tau / n), v + r * math.sin(i * math.tau / n), z))  # noqa: E731
                         for i in range(n)]
    o0, o1, i1 = ring(ro, z0), ring(ro, z1), ring(ri, z1)
    for i in range(n):
        j = (i + 1) % n
        face(k, [o0[i], o0[j], o1[j], o1[i]], (o0[i] + o0[j]) / 2 - Vector((u, v, z0)), col)
        face(k, [o1[i], o1[j], i1[j], i1[i]], (0, 0, 1), col)


def stack(k, u, v, z0, z1, r, on, collar_z=None, windows=True):
    k.cyl(u, v, z0, r, z1 - z0, BODY, top=DARK, sides=20)
    if collar_z is not None:
        k.cyl(u, v, collar_z - 0.02, r + 0.07, 0.14, ARM, top=ARM_L, sides=20)
    annulus(k, u, v, z1 - 0.1, z1 + 0.01, r + 0.03, r - 0.08, ARM)
    k.cyl(u, v, z1 - 0.14, r - 0.08, 0.02, GLOW if on else DARK, sides=18)
    k.cyl(u, v, z1 - 0.135, r * 0.45, 0.02, HOT if on else DARK, sides=14)
    if windows:
        for a in (-0.45, 0.45):
            k.box(u + (r + 0.005) * math.cos(a), v + (r + 0.005) * math.sin(a), z1 - 0.5, 0.03, 0.08, 0.2,
                  GLOW if on else DARK, rz=a)


def pipe(k, pts, r=0.065):
    pts = [Vector(p) for p in pts]
    for a, b in zip(pts, pts[1:]):
        tube(k, a, b, r, BODY, sides=10)
    for p in pts[1:-1]:
        k.cyl(p.x, p.y, p.z - r - 0.01, r + 0.02, 2 * r + 0.02, BODY, top=BODY, sides=10)


def flange(k, p, axis, r):
    a = Vector(axis).normalized()
    tube(k, Vector(p) - a * 0.025, Vector(p) + a * 0.025, r, ARM, sides=12)


def crew_blocks(k, on, v_split, h_in, h_term, h_out):
    """The crew side (+u), from u 0.32: the input hatch's block (-v end), the terminal's block (the middle, its niche at
    the access tile) and the output's block (+v end), each its own height."""
    u0 = 0.32
    a, b = v_split
    term = Block((u0, U, a, b), h_term, {"+u"}, openings=[("+u", -0.36, 0.36, 0.0, 0.55, 0.38)])
    term.build(k)
    console(k, U - SL * 0.0 - 0.38, U - 0.04, -0.3, 0.3, on)
    inp = Block((u0, U, -V, a), h_in, {"+u", "-v"}, openings=[("+u", -1.5, -0.68, 0.1, 0.56, 0.24)])
    inp.build(k)
    mouth(k, inp, "+u", -1.5, -0.68, 0.1, 0.24, False, on)
    out = Block((u0, U, b, V), h_out, {"+u", "+v"}, openings=[("+u", 0.68, 1.5, 0.1, 0.56, 0.24)])
    out.build(k)
    mouth(k, out, "+u", 0.68, 1.5, 0.1, 0.24, True, on)


def wing(k, on, u1, h, vents=((-1.4, -0.5), (-0.4, 0.4), (0.5, 1.4))):
    """The far side (-u): one long armour wing with vent bays."""
    blk = Block((-U, u1, -V, V), h, {"-u", "-v", "+v"}, armour=True,
                openings=[("-u", a, b, 0.12, h - 0.2, 0.2) for a, b in vents])
    blk.build(k)
    for a, b in vents:
        louvres(k, blk, "-u", a, b, 0.12, h - 0.2, 0.2, on)


def crucible(k, on):
    """A tall crucible pot in the middle, the armour stepping up round it: a long wing behind, the crew blocks in
    front, a feed block with its hopper at the +v end, a flue block at the -v end with the stack rising out of it."""
    cu, cv, r = -0.32, 0.12, 0.6
    k.cyl(cu, cv, 0, r, 1.28, BODY, top=REC, sides=28)                        # the pot
    for z in (0.5, 0.95):
        k.cyl(cu, cv, z, r + 0.03, 0.09, ARM, top=ARM_L, sides=28)
    annulus(k, cu, cv, 1.22, 1.34, r + 0.05, r - 0.12, ARM)
    k.cyl(cu, cv, 1.27, r - 0.12, 0.04, GLOW if on else DARK, sides=26)
    k.cyl(cu, cv, 1.28, r - 0.28, 0.04, HOT if on else DARK, sides=22)
    wing(k, on, -0.92, 0.82)
    crew_blocks(k, on, (-1.0, 0.0), 0.78, 0.66, 0.92)
    Block((-0.92, 0.32, 0.72, V), 1.08, {"+v"}, top=DARK).build(k)             # the feed block, its hopper open
    for (u, v, su, sv) in ((-0.3, 0.91, 0.94, 0.08), (-0.3, 1.73, 0.94, 0.08), (-0.73, 1.32, 0.08, 0.9),
                           (0.13, 1.32, 0.08, 0.9)):                       # the hopper's coping
        k.box(u, v, 1.08, su, sv, 0.05, ARM, top=ARM_L)
    Block((-0.92, 0.32, -0.48, 0.72), 0.5, set()).build(k)                    # the well the pot stands in
    Block((-0.92, 0.32, -V, -0.48), 0.96, {"-v"}, armour=True).build(k)        # the flue block
    stack(k, -0.3, -1.25, 0.96, 1.95, 0.24, on, collar_z=0.96, windows=False)
    pipe(k, [(cu, cv - r + 0.05, 1.08), (-0.3, -0.62, 1.08), (-0.3, -0.98, 1.08)], r=0.08)
    flange(k, (-0.3, -0.62, 1.08), (0, 1, 0), 0.11)


def stacks(k, on):
    """Three stacks rising from the floor in a row, each wrapped by its own collar block at a different height, a
    low wing behind, the crew blocks in front, a header pipe tying the stacks together."""
    su = -0.3
    heights = (0.98, 1.2, 0.86)
    for (v, hb) in zip((-1.1, 0.0, 1.1), heights):
        Block((-0.92, 0.32, v - 0.55, v + 0.55), hb, {"-v"} if v < 0 else ({"+v"} if v > 0 else set()),
              armour=(v == 0.0)).build(k)
        stack(k, su, v, hb, hb + 0.78, 0.32, on, collar_z=hb)
    wing(k, on, -0.92, 0.7)
    crew_blocks(k, on, (-0.55, 0.55), 0.74, 0.62, 0.82)
    hz = 1.62
    pipe(k, [(su - 0.34, -1.1, hz), (su - 0.42, -1.1, hz), (su - 0.42, 1.1, hz), (su - 0.34, 1.1, hz)], r=0.06)
    pipe(k, [(su - 0.42, 0.0, hz), (su - 0.34, 0.0, hz)], r=0.05)
    pipe(k, [(su - 0.42, 1.3, hz), (su - 0.42, 1.3, 0.92), (-0.98, 1.3, 0.7)], r=0.06)


def kiln(k, on):
    """A kiln drum lying along the middle on rollers, half its height between a tall armour cheek behind and the
    crew blocks in front, an intake hood rising at the +v end and a discharge hood with a stack at the -v end."""
    a, b = Vector((-0.3, -1.25, 0.6)), Vector((-0.3, 1.2, 0.6))
    for v in (-0.7, 0.7):                                                     # rollers on the floor
        k.box(-0.3, v, 0, 0.9, 0.3, 0.14, REC, top=BODY)
    tube(k, a, b, 0.5, BODY, sides=26, cap=DARK)
    for v in (-0.7, 0.7):
        tube(k, (-0.3, v - 0.08, 0.6), (-0.3, v + 0.08, 0.6), 0.57, ARM, sides=26, cap=ARM_D)
    for v in (-0.25, 0.25):
        tube(k, (-0.3, v - 0.025, 0.6), (-0.3, v + 0.025, 0.6), 0.51, GLOW if on else REC, sides=26)
    wing(k, on, -0.85, 0.86, vents=((-1.0, -0.2), (0.2, 1.0)))
    crew_blocks(k, on, (-0.75, 0.75), 0.7, 0.6, 0.7)
    Block((-0.85, 0.32, 1.2, V), 1.3, {"+v"}, armour=True).build(k)            # the intake hood
    k.box(-0.27, 1.6, 1.29, 0.8, 0.5, 0.03, DARK)
    Block((-0.85, 0.32, -V, -1.25), 1.18, {"-v"}).build(k)                     # the discharge hood
    stack(k, -0.27, -1.6, 1.18, 1.9, 0.2, on, collar_z=1.18, windows=False)


MACHINES = {"crucible": crucible, "stacks": stacks, "kiln": kiln}


def refinery(machine, rot=0, on=True):
    k = K(f"refinery3_{machine}_{rot}_{int(on)}", FP, rot)
    MACHINES[machine](k, on)
    return k.build()
