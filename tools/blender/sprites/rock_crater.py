"""Asteroid rock: impact craters for rock tops and levelled ground (rock_base.py has the frame)."""
import math

from mathutils import Vector

from .rock_base import TAU, per2, window


KINDS = ("bowl", "bowl", "peak", "oval", "rubble", "fresh")


class Crater:
    """One impact: a bowl with a raised rim. Kinds: bowl, peak (central peak), oval (oblique hit), rubble (flat floor
    strewn with blocks), fresh (deep, sharp rim, bright ejecta rays). The outline wobbles so no two read alike."""
    def __init__(self, r, cx, cy, rr, depth, kind):
        self.cx, self.cy, self.rr, self.kind = cx, cy, rr, kind
        self.depth = depth * rr * r.uniform(0.75, 1.25) * (1.35 if kind == "fresh" else 1.0)
        self.rim = (0.5 if kind == "fresh" else 0.28) * self.depth * r.uniform(0.7, 1.2)
        self.ax = r.uniform(1.4, 1.8) if kind == "oval" else r.uniform(1.0, 1.12)
        self.ang = r.uniform(0, math.pi)
        self.rays = list(r.uniform(0, TAU, int(r.integers(5, 9)))) if kind == "fresh" else []
        self.seed = int(r.integers(0, 999))
        self.wob = [(r.uniform(0, TAU), r.uniform(0.03, 0.09)) for _ in range(3)]

    def q(self, x, y):
        dx, dy = x - self.cx, y - self.cy
        if abs(dx) > self.rr * self.ax * 2.8 or abs(dy) > self.rr * self.ax * 2.8:
            return 9.0
        c, s = math.cos(self.ang), math.sin(self.ang)
        u, v = (dx * c + dy * s) / self.ax, -dx * s + dy * c
        a = math.atan2(v, u)
        wob = 1 + sum(m * math.sin((k + 2) * a + ph) for k, (ph, m) in enumerate(self.wob))
        return math.hypot(u, v) / (self.rr * wob)

    def h(self, x, y):
        q = self.q(x, y)
        if q >= 1.6:
            return 0.0
        if q >= 1.0:
            return self.rim * (1 - (q - 1) / 0.6) ** (3 if self.kind == "fresh" else 2)
        z = -self.depth * (1 - q * q) + self.rim * q ** 6
        if self.kind == "peak":
            z += self.depth * 0.75 * max(0.0, 1 - q / 0.3) ** 1.5
        elif self.kind == "rubble":
            z = max(z, -self.depth * 0.5) + (self.depth * 0.4 * max(0.0, per2(x * 4, y * 4, self.seed, n=4) - 0.5)
                                             * max(0.0, 1 - q / 0.85))
        return z

    def col(self, x, y, pal):
        L, B, M, D = pal
        q = self.q(x, y)
        if q < 1.0:
            if self.kind == "peak" and q < 0.3:
                return L
            if self.kind == "rubble" and q < 0.8 and per2(x * 4, y * 4, self.seed, n=4) > 0.5:
                return D
            return M if q < 0.75 else B
        if q < 1.22:
            return L if self.kind == "fresh" else B
        if self.rays and q < 2.7 and window(x, y) > 0.2:
            a = math.atan2(y - self.cy, x - self.cx)
            if any(abs((a - ra + math.pi) % TAU - math.pi) < 0.16 / q for ra in self.rays):
                return L
        return None


def crater_set(r, big=(0.07, 0.22), n_big=(0, 0, 1, 1, 1, 2), pocks=(0, 5), spread=0.24, depth=0.5):
    out = []
    for _ in range(int(r.choice(n_big))):
        cx, cy, rr = r.uniform(-spread, spread), r.uniform(-spread, spread), r.uniform(*big)
        out.append(Crater(r, cx, cy, rr, depth, str(r.choice(KINDS))))
        if r.uniform() < 0.25:                                                            # a later, overlapping hit
            a, d = r.uniform(0, TAU), rr * r.uniform(0.8, 1.15)
            out.append(Crater(r, cx + math.cos(a) * d, cy + math.sin(a) * d, rr * r.uniform(0.45, 0.7), depth, "bowl"))
    for _ in range(int(r.integers(*pocks))):
        out.append(Crater(r, r.uniform(-0.32, 0.32), r.uniform(-0.32, 0.32), r.uniform(0.022, 0.05), depth * 0.8, "bowl"))
    if r.uniform() < 0.2:                                                                 # a secondary-impact chain
        p, a = Vector((r.uniform(-0.2, 0.2), r.uniform(-0.2, 0.2))), r.uniform(0, TAU)
        for i in range(int(r.integers(3, 5))):
            q = p + Vector((math.cos(a), math.sin(a))) * (i * 0.06)
            out.append(Crater(r, q.x, q.y, r.uniform(0.02, 0.032), depth * 0.7, "bowl"))
    return out


def crater_col(craters, x, y, pal):
    for c in craters:
        col = c.col(x, y, pal)
        if col:
            return col
    return None


# Inner corners a 4-bit mask can't see: both sides toward a diagonal are solid but the diagonal is open. bit: (corner
# point, direction into the open quadrant, the cliff continued along the y = corner line, the one along x = corner).
