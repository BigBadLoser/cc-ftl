"""Recovery pod parts (family `recovery_pod`, recovery.py): the approved look study u3 (recovery_study10.py, the spine
lantern) for any rotation, lit or unpowered.

The pod is round, so only two parts turn with the module: the spine (a white swept column from a lobe of the plinth,
bending over to hang the hat above the tank) and the console fascia on the plinth. Everything that depends on where
the camera is (the glass's lit edges, the near and far bubbles, the scanner's halves, the far meniscus) stays put.
The spine must never stand in front of the patient, so it keeps to the tank's left or right side: the four rotations
are two pairs of mirror images (see LAYOUT), not one layout turned four times.

Parts are built in the grid's own frame (K at rot 0: u = +x, v = +y): a 2x2 footprint is the same every rotation."""
import math

from .modkit import K
from .recovery_study2 import lathe
from .recovery_study4 import base, quad
from .recovery_study5 import R
from .recovery_study6 import UP, add, rect
from .recovery_study8 import FP8, HAT_R, HAT_Z
from .recovery_study10 import ARM_Z, BEND, LOBE_R, RS, lathe_at, path, tank
from .medbay import trace

# The module's front turns clockwise with the rotation (modkit: r0 +y, r1 -x, r2 -y, r3 +x). Per rotation: the
# spine's angle and the fascia's, about the axis in the grid frame (0 = +x; 45 deg faces the camera). The spine stays
# at the side (146 deg left, 124 left a little nearer, 326 right a little nearer, 304 right), the fascia faces the
# camera when the front does (45) and the back otherwise (225).
LAYOUT = {0: (146, 45), 1: (124, 225), 2: (326, 225), 3: (304, 45)}

# Unpowered: every light dark (the screens blank, the floor light off so the fluid's lit foot is plain).
OFF = {"cyan": "recCyanOff", "recGlow": "recGlowOff", "green": "dark", "recGlowO": "dark", "recClL": "recCl"}


class Dark:
    """A Mesh that draws every lit colour (OFF) dark: K's mesh swapped for this when unpowered."""

    def __init__(self, m):
        self.m = m

    def __getattr__(self, name):
        f = getattr(self.m, name)
        if not callable(f):
            return f

        def call(*a, **kw):
            a = [OFF.get(x, x) if isinstance(x, str) else x for x in a]
            kw = {k: OFF.get(x, x) if isinstance(x, str) else x for k, x in kw.items()}
            return f(*a, **kw)
        return call


def kit(name, off=False):
    k = K(name, FP8)
    if off:
        k.m = Dark(k.m)
    return k


class Pod:
    def __init__(self, rot, off=False):
        sa, fa = LAYOUT[rot]
        self.rot, self.off = rot, off
        self.A = math.radians(sa)
        self.E = (math.cos(self.A), math.sin(self.A), 0.0)          # out from the axis toward the spine
        self.T = (-math.sin(self.A), math.cos(self.A), 0.0)         # across the spine
        self.side = 1 if self.T[0] + self.T[1] > 0 else -1          # the side face the camera sees (+T or -T)
        self.F = math.radians(fa)

    def P(self, r, z):
        return (r * self.E[0], r * self.E[1], z)

    def sweep(self, k, pts, side_col="medWhite", face_col="plate"):
        """A rectangular section swept along pts [(r, z, w, d)] in the spine's plane: flat side faces (+-T), the outer
        and inner faces in face_col, end caps."""
        E, T = self.E, self.T
        secs = []
        for i, (r, z, w, d) in enumerate(pts):
            a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
            dr, dz = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dr, dz)
            nr, nz = dz / L, -dr / L                                         # the in-plane normal (outward)
            n = (nr * E[0], nr * E[1], nz)
            secs.append([add(self.P(r, z), (s * w / 2, T), (q * d / 2, n)) for s, q in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
                        + [n])
        for s0, s1 in zip(secs, secs[1:]):
            n = s0[4]
            quad(k, [s0[0], s1[0], s1[3], s0[3]], side_col, T)
            quad(k, [s0[1], s1[1], s1[2], s0[2]], side_col, tuple(-c for c in T))
            quad(k, [s0[0], s1[0], s1[1], s0[1]], face_col, n)
            quad(k, [s0[3], s1[3], s1[2], s0[2]], face_col, tuple(-c for c in n))
        for s, sgn in ((secs[0], -1), (secs[-1], 1)):
            r0, z0, *_ = pts[0] if sgn < 0 else pts[-1]
            r1, z1, *_ = pts[1] if sgn < 0 else pts[-2]
            quad(k, s[:4], face_col, add(self.P(r0, z0), (-1, self.P(r1, z1))))

    def side_face(self, r, z, w):
        """A point on the camera's side face of the spine at (r, z), where it is w wide."""
        return add(self.P(r, z), (self.side * (w / 2 + 0.003), self.T))

    def lobe(self, k):
        """A lobe of the plinth round the spine's foot: the base's stepped profile and its cyan ring."""
        u, v, _ = self.P(RS, 0)
        k.cyl(u, v, 0.0, LOBE_R - 0.04, 0.04, "dark", sides=20)
        lathe_at(k, u, v, ((0.04, LOBE_R), (0.1, LOBE_R - 0.02), (0.14, LOBE_R - 0.06)), "medWhite", "plate")
        k.cyl(u, v, 0.07, LOBE_R + 0.004, 0.02, "cyan", sides=20)
        k.box(*self.P((RS + 0.55) / 2, 0)[:2], 0.04, 0.3, 0.42, 0.1, "medWhite", top="plate", rz=self.A)

    def spine(self, k):
        """The column up to the bend: the vitals screen and a conduit line on the side face the camera sees."""
        self.sweep(k, [p for p in path() if p[1] <= BEND + 1e-6])
        X = self.E                                                           # across the face, inner (-) to outer (+)
        s = self.side_face(RS, 0, 0.26)
        rect(k, s, X, UP, -0.085, 0.06, 1.06, 1.44, "dark", 0.0)              # the outer bezel wide enough to hold a px
        trace(lambda a, b: rect(k, s, X, UP, a - 0.006, a + 0.006, 1.33 + b - 0.006, 1.33 + b + 0.006, "green", 0.003),
              [(-0.06, 0.0), (-0.03, 0.0), (-0.015, 0.04), (0.0, -0.03), (0.015, 0.0), (0.035, 0.0)], d=0.01)
        for i, (w, col) in enumerate(((0.1, "cyan"), (0.06, "recGlowO"), (0.035, "cyan"))):
            rect(k, s, X, UP, -0.06, -0.06 + w, 1.13 + i * 0.05, 1.16 + i * 0.05, col, 0.003)
        f = self.side_face(RS, 0, 0.38)
        rect(k, f, X, UP, -0.012, 0.012, 0.18, 0.56, "cyan", 0.0)
        for z0, z1 in ((0.82, 1.0), (1.5, BEND - 0.08)):
            rect(k, s, X, UP, -0.012, 0.012, z0, z1, "cyan", 0.0)

    def fascia(self, k):
        """The console on the plinth's rim: a readout with a heartbeat trace and three lights."""
        a = self.F
        O = (0.975 * math.cos(a), 0.975 * math.sin(a), 0.0)
        XS = (math.cos(a - math.pi / 2), math.sin(a - math.pi / 2), 0.0)
        k.box(0.84 * math.cos(a), 0.84 * math.sin(a), 0.0, 0.66, 0.26, 0.24, "medWhite", top="plate", rz=a + math.pi / 2,
              bevel=0.015)
        rect(k, O, XS, UP, -0.3, 0.3, 0.025, 0.04, "cyan", 0.004)
        rect(k, O, XS, UP, -0.24, 0.1, 0.08, 0.2, "dark", 0.004)
        trace(lambda x, y: rect(k, O, XS, UP, -0.07 + x - 0.006, -0.07 + x + 0.006, 0.14 + y - 0.006, 0.14 + y + 0.006,
                                "green", 0.008),
              [(-0.15, 0.0), (-0.05, 0.0), (-0.02, 0.04), (0.01, -0.035), (0.04, 0.0), (0.15, 0.0)], d=0.012)
        for i, col in enumerate(("green", "cyan", "recGlowO")):
            rect(k, O, XS, UP, 0.14 + i * 0.05, 0.17 + i * 0.05, 0.12, 0.15, col, 0.008)

    def back(self, fluid=True):
        """The pod under the patient: plinth, lobe, the spine's column, fascia and (unless `fluid` is False: the
        holdout for layers seen through the fluid) the fluid."""
        k = kit("rec_pod", self.off)
        base(k, 0.96)
        k.cyl(0, 0, 0.14, 0.7, 0.04, "steel", top="steelL", sides=40)
        self.lobe(k)
        self.spine(k)
        self.fascia(k)
        if fluid:
            tank(k)
        return k.build()

    def mask(self):
        return self.back(fluid=False)

    def top(self):
        """Over the patient: the spine's bend and arm, the hub, the hat hung from it."""
        k = kit("rec_pod_top", self.off)
        self.sweep(k, [p for p in path() if p[1] >= BEND - 1e-6])
        k.cyl(0, 0, HAT_Z + 0.14, 0.13, ARM_Z + 0.1 - HAT_Z - 0.14, "medWhite", top="plate", sides=16)
        lathe(k, ((HAT_Z, HAT_R), (HAT_Z + 0.05, HAT_R + 0.02), (HAT_Z + 0.1, HAT_R - 0.02), (HAT_Z + 0.16, 0.3),
                  (HAT_Z + 0.2, 0.14)), "medWhite", "plate", 32)
        k.cyl(0, 0, HAT_Z + 0.03, HAT_R + 0.022, 0.018, "cyan", sides=32)
        k.cyl(0, 0, HAT_Z - 0.03, HAT_R - 0.03, 0.035, "recGlow", top="steel", sides=32)
        return k.build()


assert R < RS - 0.1                                 # the spine's inner face stays clear of the tank
