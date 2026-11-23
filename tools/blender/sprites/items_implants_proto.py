"""Scratch: three looks for the implant items (A flat and big, B upright on a stand, C a case with a lit symbol), for
the arm, heart and eye. Rendered only with IMPLANT_PROTO=1; not for commits."""
import math

from .items_implants import Tray
from .items_kit import jobs, tube

LIT, LIT_D = "imCyan", "imCyanD"
BODY, BODY_D, JOINT, DARK = "gm", "steelD", "c3W2", "xnK"
HEART, HEART_D = "medRed", "red"
TO_CAM = (0.62, 0.62, 0.48)          # grid frame: toward the viewer


class P:
    """Parts at an origin c (grid x, y, z) scaled by k: every helper takes local coordinates."""

    def __init__(self, m, k=1.0, c=(0.0, 0.0, 0.0)):
        self.m, self.k, self.c = m, k, c

    def p(self, x, y, z):
        return (self.c[0] + x * self.k, self.c[1] + y * self.k, self.c[2] + z * self.k)

    def box(self, x, y, z, s, col, top=None, rz=0.0, bevel=0.006):
        self.m.box(self.p(x, y, z), tuple(v * self.k for v in s), col, top=top, rz=rz, base=True, bevel=bevel * self.k)

    def tube(self, a, b, r, col, cap=None, r1=None):
        tube(self.m, self.p(*a), self.p(*b), r * self.k, col, cap=cap or col, r1=None if r1 is None else r1 * self.k, sides=12)

    def ball(self, x, y, z, r, col, sx=1.0, sy=1.0, sz=1.0):
        t = Tray.__new__(Tray)
        t.m, t.c, t.z, t.rz, t.k, t.top = self.m, (self.c[0] + x * self.k, self.c[1] + y * self.k), 0.0, 0.0, self.k, self.c[2] + z * self.k
        Tray.ball(t, 0, 0, 0.0, r, col, sz=sz, sx=sx)

    def disc(self, x, y, z, r, h, col, top=None):
        self.m.cyl(self.p(x, y, z), r * self.k, h * self.k, col, sides=14, top=top or col)


# ---- A: big and flat, coloured --------------------------------------------------------------------------------------

def a_arm(m):
    q = P(m, 1.0)
    q.tube((-0.26, -0.1, 0.05), (-0.04, 0.0, 0.05), 0.05, BODY)
    q.ball(-0.04, 0.0, 0.05, 0.055, JOINT)
    q.tube((-0.04, 0.0, 0.05), (0.14, 0.1, 0.04), 0.04, BODY, r1=0.034)
    q.ball(0.14, 0.1, 0.04, 0.038, JOINT)
    q.box(0.2, 0.14, 0.0, (0.1, 0.09, 0.05), BODY_D, top=BODY, rz=0.5)
    for i, a in enumerate((-0.5, -0.15, 0.15, 0.45)):
        r = 0.27 + a
        q.tube((0.24, 0.17 + i * 0.02 - 0.03, 0.03), (0.24 + 0.1 * math.cos(r), 0.17 + i * 0.02 - 0.03 + 0.1 * math.sin(r) + 0.06 * a, 0.03), 0.014, JOINT)
    q.tube((0.17, 0.2, 0.03), (0.15, 0.28, 0.03), 0.015, JOINT)                                  # thumb
    q.box(-0.04, 0.0, 0.1, (0.05, 0.03, 0.012), LIT, bevel=0)


def a_heart(m):
    q = P(m, 1.0)
    q.ball(-0.04, 0.03, 0.0, 0.12, HEART, sz=0.8)
    q.ball(0.07, -0.03, 0.0, 0.1, HEART_D, sz=0.8)
    q.tube((-0.18, 0.06, 0.09), (0.16, -0.06, 0.09), 0.016, LIT)
    for x, y, h in ((-0.06, 0.08, 0.3), (0.0, 0.04, 0.32), (0.05, 0.0, 0.27)):
        q.tube((x, y, 0.14), (x, y, h), 0.026, JOINT)


def a_eye(m):
    q = P(m, 1.0)
    q.ball(0.0, 0.0, 0.0, 0.14, "medWhite")
    d = TO_CAM
    q.tube((d[0] * 0.1, d[1] * 0.1, 0.14 + d[2] * 0.1), (d[0] * 0.135, d[1] * 0.135, 0.14 + d[2] * 0.135), 0.075, LIT_D, cap=LIT)
    q.tube((d[0] * 0.13, d[1] * 0.13, 0.14 + d[2] * 0.13), (d[0] * 0.15, d[1] * 0.15, 0.14 + d[2] * 0.15), 0.032, "black")
    q.tube((-0.1, -0.1, 0.08), (-0.26, -0.18, 0.02), 0.024, BODY)


# ---- B: upright on a stand ------------------------------------------------------------------------------------------

def stand(q, h):
    q.disc(0, 0, 0, 0.12, 0.03, DARK, top="steelD")
    q.box(0.0, 0.0, 0.03, (0.012, 0.012, 0.006), LIT, bevel=0) if False else None
    q.tube((0, 0, 0.03), (0, 0, h), 0.016, BODY_D)


def b_arm(m):
    q = P(m, 1.0)
    stand(q, 0.06)
    q.tube((0, 0, 0.06), (0.0, 0.0, 0.17), 0.045, BODY)
    q.ball(0.0, 0.0, 0.17, 0.048, JOINT)
    q.tube((0.0, 0.0, 0.17), (0.04, 0.04, 0.28), 0.037, BODY, r1=0.03)
    q.ball(0.04, 0.04, 0.28, 0.033, JOINT)
    q.box(0.045, 0.045, 0.29, (0.07, 0.03, 0.06), BODY_D, top=BODY, rz=-0.8)
    for i in range(4):
        q.tube((0.07 - i * 0.016, 0.02 + i * 0.016, 0.34), (0.09 - i * 0.03, 0.0 + i * 0.03, 0.4), 0.012, JOINT)
    q.tube((0.02, 0.07, 0.31), (-0.02, 0.11, 0.35), 0.013, JOINT)
    q.box(0.0, 0.0, 0.16, (0.06, 0.06, 0.015), LIT, bevel=0)


def b_heart(m):
    q = P(m, 1.0)
    stand(q, 0.1)
    q.ball(-0.035, 0.035, 0.1, 0.1, HEART)
    q.ball(0.05, -0.04, 0.12, 0.085, HEART_D)
    q.tube((-0.14, 0.1, 0.22), (0.12, -0.1, 0.22), 0.014, LIT)
    for x, y, h in ((-0.05, 0.05, 0.42), (0.0, 0.0, 0.44), (0.05, -0.02, 0.4)):
        q.tube((x, y, 0.28), (x, y, h), 0.022, JOINT)


def b_eye(m):
    q = P(m, 1.0)
    stand(q, 0.12)
    q.ball(0.0, 0.0, 0.12, 0.12, "medWhite")
    d, c = TO_CAM, 0.24
    q.tube((d[0] * 0.085, d[1] * 0.085, c + d[2] * 0.085), (d[0] * 0.118, d[1] * 0.118, c + d[2] * 0.118), 0.065, LIT_D, cap=LIT)
    q.tube((d[0] * 0.115, d[1] * 0.115, c + d[2] * 0.115), (d[0] * 0.13, d[1] * 0.13, c + d[2] * 0.13), 0.028, "black")


# ---- C: a case with a lit symbol on its lid -------------------------------------------------------------------------

def case(q):
    q.box(0, 0, 0, (0.46, 0.34, 0.08), "steelD", top="medWhite", bevel=0.012)
    q.box(0, 0.172, 0.04, (0.4, 0.01, 0.02), LIT, bevel=0)
    return 0.081


def c_arm(m):
    q = P(m, 1.0)
    z = case(q)
    for a, b, w in (((-0.16, -0.06), (-0.02, 0.0), 0.05), ((-0.02, 0.0), (0.1, 0.07), 0.04)):
        dx, dy = b[0] - a[0], b[1] - a[1]
        q.box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z, (math.hypot(dx, dy), w, 0.004), LIT, rz=math.atan2(dy, dx), bevel=0)
    q.box(0.14, 0.1, z, (0.07, 0.07, 0.004), LIT, rz=0.6, bevel=0)


def c_heart(m):
    q = P(m, 1.0)
    z = case(q)
    q.disc(0.02, 0.09, z, 0.065, 0.004, HEART)
    q.disc(0.09, 0.02, z, 0.065, 0.004, HEART)
    q.box(0.0, 0.0, z, (0.13, 0.13, 0.004), HEART, rz=0.0, bevel=0)


def c_eye(m):
    q = P(m, 1.0)
    z = case(q)
    q.m.cyl(q.p(0, 0, z), 0.13, 0.004, LIT, sides=16, top=LIT)
    q.disc(0, 0, z + 0.004, 0.06, 0.004, "black")


PROTOS = {"proto_a_arm": a_arm, "proto_a_heart": a_heart, "proto_a_eye": a_eye,
          "proto_b_arm": b_arm, "proto_b_heart": b_heart, "proto_b_eye": b_eye,
          "proto_c_arm": c_arm, "proto_c_heart": c_heart, "proto_c_eye": c_eye}


def sprite_jobs():
    return [j for k, fn in PROTOS.items() for j in jobs(k, lambda m, size, fn=fn: fn(m))]


def axes(m):
    q = P(m, 1.0)
    q.ball(0.2, 0, 0, 0.05, "imRed")
    q.ball(0, 0.2, 0, 0.05, "imGreen")
    q.ball(-0.2, 0, 0, 0.05, "imBlue")
    q.ball(0, -0.2, 0, 0.05, "imWhite")
    q.ball(0, 0, 0.25, 0.05, "imOrange")


PROTOS["proto_axes"] = axes
