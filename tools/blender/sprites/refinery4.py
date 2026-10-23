"""REFINERY, fourth build (module.refinery, 3x4): the machine's casing is the mass. A tall armoured casing takes most of
the footprint, its battered walls running down to the floor; lower parts lean on it only where they have a job (the
crew annex with the terminal, a feed housing, a hot block with the output hatch). No ring round the edge: the outline
goes tall / mid / low and changes from every side.

  crucible  a tall furnace tower with the melt sunk in its top and the flue stack rising from its back corner; a
            sloped feed chute climbing from a hopper into its mouth; the crew annex and a hot output block in front
  stacks    three casings in a row (low, tall, mid), each carrying its stack; the end casings full width with the
            hatches, the terminal in a low nook between them
  kiln      a drum lying half-sunk in a cradle between a tall firing hood (output, burner stack) and a sloped intake
            hood rising to meet it; the crew annex along the front

Blocks from refinery3 (their outer faces lean, corners cut and orange, top edges bevelled), here with their own lean,
a sloped top and a pit cut in the top. Local frame: modkit.K, crew side +u, access at its middle."""
import math

from mathutils import Vector

from . import refinery3 as R3
from .modkit import K
from .steelkit import face, tube

FP, U, V = R3.FP, R3.U, R3.V
BODY, TOP, REC, DARK = R3.BODY, R3.TOP, R3.REC, R3.DARK
ARM, ARM_L, ARM_D = R3.ARM, R3.ARM_L, R3.ARM_D
GLOW, HOT = R3.GLOW, R3.HOT
SL, CT = 0.2, R3.CT
ALL = ("-v", "+u", "+v", "-u")


class Mass(R3.Block):
    """A Block with its own lean, a top sloping by (gu, gv) per unit, and an optional round pit (u, v, r, depth) cut
    into a flat top."""

    def __init__(self, rect, h, outer, slope=(0.0, 0.0), pit=None, **kw):
        super().__init__(rect, h, outer, **kw)
        self.g, self.pit = slope, pit

    def inset(self, side, z):
        return SL * z if side in self.outer else 0.0

    def oct_at(self, z, extra=0.0):
        sh = (SL * z + extra) * 0.41
        return R3._oct(self.rect_at(z, extra), [max(0.0, c - sh) for c in self.c])

    def top_z(self, p):
        u0, u1, v0, v1 = self.r
        return self.h + self.g[0] * (p[0] - (u0 + u1) / 2) + self.g[1] * (p[1] - (v0 + v1) / 2)

    def build(self, k):
        ct = CT if self.bev else 0.0
        lo = self.oct_at(0)
        mid, hi = [], []
        for i in range(8):
            z = self.top_z(lo[i])
            for _ in range(3):
                ph = self.oct_at(z - ct, ct)[i]
                z = self.top_z(ph)
            mid.append((*self.oct_at(z - ct)[i], z - ct))
            hi.append((*ph, z))
        cen = Vector(((self.r[0] + self.r[1]) / 2, (self.r[2] + self.r[3]) / 2, 0))
        wall = ARM if self.armour else BODY
        for i in range(8):
            j = (i + 1) % 8
            side = ALL[i // 2] if i % 2 == 0 else None
            out = Vector(((lo[i][0] + lo[j][0]) / 2, (lo[i][1] + lo[j][1]) / 2, 0)) - cen
            if math.dist(lo[i], lo[j]) > 1e-6:
                if side and any(o[0] == side for o in self.openings):
                    self.wall_with_openings(k, side, self.h - ct, wall)
                else:
                    face(k, [(*lo[i], 0), (*lo[j], 0), mid[j], mid[i]], out, ARM if side is None else wall)
            if ct and (math.dist(mid[i][:2], mid[j][:2]) > 1e-6 or math.dist(hi[i][:2], hi[j][:2]) > 1e-6):
                bevel = side is None or side in self.bev
                face(k, [mid[i], mid[j], hi[j], hi[i]], out + Vector((0, 0, 1)), ARM_L if bevel else wall)
        if self.pit:
            self.top_with_pit(k, hi)
        else:
            face(k, hi, Vector((-self.g[0], -self.g[1], 1)), self.top)
        for o in self.openings:
            self.recess(k, *o)

    def top_with_pit(self, k, hi):
        cu, cv, r, depth = self.pit
        z = self.h
        ang = [math.atan2(p[1] - cv, p[0] - cu) for p in hi]
        arc = lambda a: (cu + r * math.cos(a), cv + r * math.sin(a), z)       # noqa: E731
        for i in range(8):
            j = (i + 1) % 8
            if math.dist(hi[i][:2], hi[j][:2]) < 1e-6:
                continue
            a0, a1 = ang[i], ang[j]
            while a1 <= a0:
                a1 += math.tau
            m = max(1, int((a1 - a0) / (math.tau / 40)) + 1)
            ring = [arc(a0 + (a1 - a0) * t / m) for t in range(m + 1)]
            face(k, [hi[i], hi[j]] + ring[::-1], (0, 0, 1), self.top)
        n = 32
        for i in range(n):
            a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
            p0, p1 = arc(a0), arc(a1)
            q = [p0, p1, (p1[0], p1[1], z - depth), (p0[0], p0[1], z - depth)]
            face(k, q, Vector((cu, cv, 0)) - Vector((p0[0], p0[1], 0)), REC)


def ramp(rect, h0, h1, outer, **kw):
    """A Mass whose top runs from h0 at the -v end to h1 at the +v end."""
    v0, v1 = rect[2], rect[3]
    return Mass(rect, (h0 + h1) / 2, outer, slope=(0.0, (h1 - h0) / (v1 - v0)), **kw)


def coping(k, u0, u1, v0, v1, z, w=0.07):
    """An orange frame round an opening on a flat top, its middle dark."""
    k.box((u0 + u1) / 2, (v0 + v1) / 2, z, u1 - u0 - 2 * w, v1 - v0 - 2 * w, 0.015, DARK)
    for u, v, su, sv in (((u0 + u1) / 2, v0 + w / 2, u1 - u0, w), ((u0 + u1) / 2, v1 - w / 2, u1 - u0, w),
                         (u0 + w / 2, (v0 + v1) / 2, w, v1 - v0 - 2 * w), (u1 - w / 2, (v0 + v1) / 2, w, v1 - v0 - 2 * w)):
        k.box(u, v, z, su, sv, 0.05, ARM, top=ARM_L)


def annex(k, on, v0, v1, h=0.72, outer=("+u",)):
    """The crew annex on the +u side, the terminal's niche at the access tile."""
    u0 = 0.38 - SL * h - 0.03
    a = Mass((u0, U, v0, v1), h, set(outer), openings=[("+u", -0.36, 0.36, 0.0, 0.55, 0.38)])
    a.build(k)
    R3.console(k, U - 0.38, U - 0.04, -0.3, 0.3, on)
    return a


def hatch(side, s0, s1):
    return (side, s0, s1, 0.1, 0.56, 0.22)


def crucible(k, on):
    cu, cv, r = -0.54, -0.5, 0.38
    tower = Mass((-U, 0.38, -V, 0.7), 1.6, set(ALL), corner=0.42, pit=(cu, cv, r, 0.16),
                 openings=[("+v", -0.78, -0.26, 1.25, 1.5, 0.14)])
    tower.build(k)
    R3.annulus(k, cu, cv, 1.6, 1.66, r + 0.06, r, ARM)                         # the melt, sunk in the top
    k.cyl(cu, cv, 1.44, r, 0.02, GLOW if on else DARK, sides=28)
    k.cyl(cu, cv, 1.445, r * 0.55, 0.02, HOT if on else DARK, sides=20)
    R3.stack(k, -0.62, -1.25, 1.6, 2.3, 0.2, on, collar_z=1.6, windows=False)
    ramp((-U, 0.38, 0.42, 1.25), 1.25, 0.78, {"-u", "+u"}, armour=True, top=ARM).build(k)    # the feed chute
    Mass((-U, 0.38, 1.2, V), 0.7, {"-u", "+v"}, cap=True).build(k)        # its hopper
    coping(k, -1.0, 0.0, 1.32, 1.72, 0.69)
    annex(k, on, -1.1, V, outer=("+u", "+v"))
    hot = Mass((0.2, U, -V, -1.05), 1.05, {"+u", "-v"}, cap=True, openings=[hatch("+u", -1.6, -1.12)])
    hot.build(k)
    R3.mouth(k, hot, "+u", -1.6, -1.12, 0.1, 0.22, True, on)


def stacks(k, on):
    t1 = Mass((-U, U, -V, -0.6), 1.2, {"-u", "+u", "-v"}, cap=True, openings=[hatch("+u", -1.62, -0.9)])
    t1.build(k)
    R3.mouth(k, t1, "+u", -1.62, -0.9, 0.1, 0.22, True, on)
    vent = ("+v", -0.95, 0.35, 0.15, 0.95, 0.18)
    t3 = Mass((-U, U, 0.6, V), 1.38, {"-u", "+u", "+v"}, cap=True,
              openings=[hatch("+u", 0.9, 1.62), vent])
    t3.build(k)
    R3.mouth(k, t3, "+u", 0.9, 1.62, 0.1, 0.22, False, on)
    R3.louvres(k, t3, "+v", *vent[1:5], vent[5], on)
    Mass((-U, 0.2, -0.65, 0.65), 1.62, {"-u", "+u"}, cap=True).build(k)
    annex(k, on, -0.62, 0.62, h=0.72)
    R3.stack(k, -0.45, -1.22, 1.2, 1.95, 0.3, on, collar_z=1.2)
    R3.stack(k, -0.66, 0.0, 1.62, 2.4, 0.34, on, collar_z=1.62)
    R3.stack(k, -0.45, 1.28, 1.38, 2.1, 0.28, on, collar_z=1.38)


def kiln(k, on):
    hood = Mass((-U, U, -V, -0.7), 1.55, set(ALL), corner=0.36, cap=True, openings=[hatch("+u", -1.62, -1.08)])
    hood.build(k)
    R3.mouth(k, hood, "+u", -1.62, -1.08, 0.1, 0.22, True, on)
    R3.stack(k, -0.62, -1.33, 1.55, 2.25, 0.2, on, collar_z=1.55, windows=False)
    Mass((-U, 0.42, -0.8, 1.12), 0.42, {"-u"}, cap=True).build(k)              # the cradle
    cu, cz, r = -0.25, 0.7, 0.55
    tube(k, (cu, -1.0, cz), (cu, 1.2, cz), r, BODY, sides=28, cap=DARK)
    for v in (-0.35, 0.65):
        tube(k, (cu, v - 0.08, cz), (cu, v + 0.08, cz), r + 0.06, ARM, sides=28, cap=ARM_D)
    for v in (0.05, 0.3):
        tube(k, (cu, v - 0.025, cz), (cu, v + 0.025, cz), r + 0.01, GLOW if on else REC, sides=28)
    for v in (-0.92, 1.04):                                                  # collars where it enters the hoods
        tube(k, (cu, v - 0.05, cz), (cu, v + 0.05, cz), r + 0.08, ARM, sides=28, cap=ARM_D)
    ramp((-U, 0.42, 1.08, V), 1.4, 0.7, {"-u", "+u", "+v"}, armour=True, top=ARM).build(k)   # the intake hood
    annex(k, on, -1.0, V, outer=("+u", "+v"))


MACHINES = {"crucible": crucible, "stacks": stacks, "kiln": kiln}


def refinery(machine, rot=0, on=True):
    k = K(f"refinery4_{machine}_{rot}_{int(on)}", FP, rot)
    MACHINES[machine](k, on)
    return k.build()
