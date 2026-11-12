"""Recovery pod look study, round 10 (family `recovery`, preview only): the spine lantern (u2) reworked after review.

  u3  the spine is one swept piece with flat faces (sweep): a straight column rising from a flared foot, one even bend,
      a level arm out to a hub that the hat hangs from; its foot stands in a lobe of the plinth (the same stepped
      profile and cyan ring, so the spine grows out of the base), the pump folded into the foot's wider section with
      its gauge flush on the side face, the vitals screen flush on the column's side face. The tank: bubbles from many
      vents at scattered places, sizes and speeds; a surface with ripple rings and a bright meniscus on the far side;
      the glass shown where there is no fluid (its edges lit down both sides, a streak on the dome, a steel collar
      under the hat). FRAMES frames, the scanner sweep as round 9's."""
import math
import random

from .modkit import K
from .recovery_study2 import lathe
from .recovery_study4 import FRONT, base, quad, seam
from .recovery_study5 import N, R, at
from .recovery_study6 import UP, add, rect
from .recovery_study8 import FP8, HAT_R, HAT_Z, RING_R, STILL, front_of
from .recovery_study9 import FRAMES, GLASS, SURF, SWEEP, scan, surface_film
from .medbay import trace

SPINE_A = math.radians(146)                         # its side face turned toward the camera
E = (math.cos(SPINE_A), math.sin(SPINE_A), 0.0)     # out from the axis toward the spine
T = (-math.sin(SPINE_A), math.cos(SPINE_A), 0.0)    # across the spine (its side faces look along -T and +T)
SIDE = -1                                           # the side face the camera sees: -T
RS = 0.84                                           # the column's distance from the axis
BEND, BEND_R = 2.22, 0.3                            # where it bends, the bend's radius
ARM_Z = BEND + BEND_R                               # the level arm
LOBE_R = 0.3                                        # the plinth's lobe round the spine's foot


def path():
    """The spine's centre line in (r, z) with its width (across, T) and depth (in its plane) at each point."""
    pts = []
    for z, w, d in ((0.14, 0.4, 0.34), (0.3, 0.38, 0.3), (0.62, 0.34, 0.26), (0.82, 0.27, 0.21), (1.2, 0.26, 0.2),
                    (BEND, 0.26, 0.2)):
        pts.append((RS, z, w, d))
    for i in range(1, 7):                                                    # the bend
        th = math.pi / 2 * i / 6
        pts.append((RS - BEND_R + BEND_R * math.cos(th), BEND + BEND_R * math.sin(th), 0.26, 0.2))
    pts.append((0.12, ARM_Z, 0.26, 0.2))                                     # the arm, out to the hub
    return pts


def P(r, z):
    return (r * E[0], r * E[1], z)


def sweep(k, pts, side_col="medWhite", face_col="plate"):
    """A rectangular section swept along pts [(r, z, w, d)] in the spine's plane: flat side faces (+-T), the outer and
    inner faces in face_col, end caps."""
    secs = []
    for i, (r, z, w, d) in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        dr, dz = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dr, dz)
        nr, nz = dz / L, -dr / L                                             # the in-plane normal (outward)
        c = P(r, z)
        n = (nr * E[0], nr * E[1], nz)
        secs.append([add(c, (s * w / 2, T), (q * d / 2, n)) for s, q in ((1, 1), (-1, 1), (-1, -1), (1, -1))] + [n])
    for s0, s1 in zip(secs, secs[1:]):
        n = s0[4]
        quad(k, [s0[0], s1[0], s1[3], s0[3]], side_col, T)                    # +T side
        quad(k, [s0[1], s1[1], s1[2], s0[2]], side_col, tuple(-c for c in T))  # -T side
        quad(k, [s0[0], s1[0], s1[1], s0[1]], face_col, n)                    # outer
        quad(k, [s0[3], s1[3], s1[2], s0[2]], face_col, tuple(-c for c in n))  # inner
    for s, sgn in ((secs[0], -1), (secs[-1], 1)):
        r0, z0, *_ = pts[0] if sgn < 0 else pts[-1]
        r1, z1, *_ = pts[1] if sgn < 0 else pts[-2]
        out = add(P(r0, z0), (-1, P(r1, z1)))
        quad(k, s[:4], face_col, out)


def side_face(r, z, w):
    """A point on the camera's side face of the spine at (r, z), where it is w wide."""
    return add(P(r, z), (SIDE * (w / 2 + 0.003), T))


def lobe(k):
    """A lobe of the plinth round the spine's foot: the base's stepped profile and its cyan ring."""
    u, v, _ = P(RS, 0)
    k.cyl(u, v, 0.0, LOBE_R - 0.04, 0.04, "dark", sides=20)
    lathe_at(k, u, v, ((0.04, LOBE_R), (0.1, LOBE_R - 0.02), (0.14, LOBE_R - 0.06)), "medWhite", "plate")
    k.cyl(u, v, 0.07, LOBE_R + 0.004, 0.02, "cyan", sides=20)
    mid = (RS + 0.55) / 2                                                    # the web between lobe and plinth
    k.box(*P(mid, 0)[:2], 0.04, 0.3, 0.42, 0.1, "medWhite", top="plate", rz=SPINE_A)


def lathe_at(k, u, v, prof, col, top, sides=20):
    for (z0, r0), (z1, r1) in zip(prof, prof[1:]):
        k.cyl(u, v, z0, r0, z1 - z0, col, top=top, sides=sides, rtop=r1)


def spine_back(k):
    pts = path()
    lower = [p for p in pts if p[1] <= BEND + 1e-6]
    sweep(k, lower)
    X = E                                                                    # the side face's plane: (E, up)
    g = side_face(RS, 0, 0.38)                                               # the pump's gauge on the foot
    rect(k, g, X, UP, -0.1, 0.1, 0.22, 0.5, "dark", 0.0)
    rect(k, g, X, UP, -0.085, 0.085, 0.24, 0.38, "recCl", 0.003)
    for i in range(3):
        rect(k, g, X, UP, -0.085, -0.06, 0.4 + i * 0.03, 0.41 + i * 0.03, "steelL", 0.003)
    s = side_face(RS, 0, 0.26)                                               # the vitals screen on the column
    rect(k, s, X, UP, -0.085, 0.085, 1.06, 1.44, "dark", 0.0)
    trace(lambda a, b: rect(k, s, X, UP, a - 0.006, a + 0.006, 1.33 + b - 0.006, 1.33 + b + 0.006, "green", 0.003),
          [(-0.055, 0.0), (-0.02, 0.0), (-0.005, 0.04), (0.01, -0.03), (0.025, 0.0), (0.055, 0.0)], d=0.01)
    for i, (w, col) in enumerate(((0.1, "cyan"), (0.06, "recGlowO"), (0.035, "cyan"))):
        rect(k, s, X, UP, -0.05, -0.05 + w, 1.13 + i * 0.05, 1.16 + i * 0.05, col, 0.003)
    rect(k, s, X, UP, -0.012, 0.012, 1.55, BEND - 0.08, "cyan", 0.0)          # a conduit line up the column


def fascia(k):
    O = (0.975 * N[0], 0.975 * N[1], 0.0)
    k.box(*at(FRONT, 0.84)[:2], 0.0, 0.66, 0.26, 0.24, "medWhite", top="plate", rz=FRONT + math.pi / 2, bevel=0.015)
    rect(k, O, (math.cos(-math.pi / 4), math.sin(-math.pi / 4), 0), UP, -0.3, 0.3, 0.025, 0.04, "cyan", 0.004)
    XS = (math.cos(-math.pi / 4), math.sin(-math.pi / 4), 0.0)
    rect(k, O, XS, UP, -0.24, 0.1, 0.08, 0.2, "dark", 0.004)
    trace(lambda a, b: rect(k, O, XS, UP, -0.07 + a - 0.006, -0.07 + a + 0.006, 0.14 + b - 0.006, 0.14 + b + 0.006,
                            "green", 0.008), [(-0.15, 0.0), (-0.05, 0.0), (-0.02, 0.04), (0.01, -0.035), (0.04, 0.0),
                                              (0.15, 0.0)], d=0.012)
    for i, col in enumerate(("green", "cyan", "recGlowO")):
        rect(k, O, XS, UP, 0.14 + i * 0.05, 0.17 + i * 0.05, 0.12, 0.15, col, 0.008)


def tank(k):
    k.cyl(0, 0, 0.18, R, 0.32, "recClL", top="recClL", sides=40)            # lit by the floor light
    k.cyl(0, 0, 0.5, R, SURF - 0.5, "recCl", top="recCl", sides=40)
    k.cyl(0, 0, 0.18, R + 0.005, 0.05, "recGlow", top="recGlow", sides=40)
    for r, col in ((0.2, "recClL"), (0.4, "recClL")):                       # ripple rings on the surface
        n = 28
        for i in range(n):
            a = (i + 0.5) * math.tau / n
            if (i + int(r * 10)) % 3:
                k.box(r * math.cos(a), r * math.sin(a), SURF, math.tau * r / n * 1.05, 0.02, 0.004, col,
                      rz=a + math.pi / 2)
    n = 40                                                                   # the meniscus, far side (bright)
    for i in range(n):
        a = (i + 0.5) * math.tau / n
        if not front_of(a):
            k.box((R - 0.02) * math.cos(a), (R - 0.02) * math.sin(a), SURF - 0.01, math.tau * R / n * 1.1, 0.04,
                  0.02, "recShine", rz=a + math.pi / 2)


def u3_back(fluid=True):
    k = K("rec_u3", FP8)
    base(k, 0.96)
    k.cyl(0, 0, 0.14, 0.7, 0.04, "steel", top="steelL", sides=40)
    lobe(k)
    spine_back(k)
    fascia(k)
    if fluid:
        tank(k)
    return k.build()


u3_back.mask = lambda: u3_back(fluid=False)


def u3_top():
    """The spine's bend and arm, the hub, the hat hung from it, the steel collar where the dome meets the hat."""
    k = K("rec_u3_top", FP8)
    pts = path()
    sweep(k, [p for p in pts if p[1] >= BEND - 1e-6])
    k.cyl(0, 0, HAT_Z + 0.14, 0.13, ARM_Z + 0.1 - HAT_Z - 0.14, "steel", top="steelL", sides=16)   # the hub
    lathe(k, ((HAT_Z, HAT_R), (HAT_Z + 0.05, HAT_R + 0.02), (HAT_Z + 0.1, HAT_R - 0.02), (HAT_Z + 0.16, 0.3),
              (HAT_Z + 0.2, 0.14)), "medWhite", "plate", 32)
    k.cyl(0, 0, HAT_Z + 0.03, HAT_R + 0.022, 0.018, "cyan", sides=32)
    k.cyl(0, 0, HAT_Z - 0.03, HAT_R - 0.03, 0.035, "recGlow", top="steel", sides=32)
    k.cyl(0, 0, 2.15, 0.3, 0.04, "steelD", top="steel", sides=24)            # the collar on the dome's crown
    return k.build()


def glass_edges():
    """The glass where light catches it: both edges lit top to bottom, a streak curving over the dome."""
    k = K("rec_u3_glass", FP8)
    prof = ((0.2, R + 0.014), (SURF, R + 0.014)) + GLASS[1:-1]
    for a in (FRONT + math.radians(88), FRONT - math.radians(88)):
        seam(k, prof, a, "recShine", w=0.025, out=0.0)
    seam(k, GLASS[1:-1], FRONT + math.radians(35), "recShine", w=0.05, out=0.004)
    seam(k, GLASS[1:-1], FRONT + math.radians(22), "recShine", w=0.02, out=0.004)
    return k.build()


def dome():
    k = K("rec_u3_dome", FP8)
    lathe(k, GLASS, "recClFilm", "recClFilm", 40)
    return k.build()


rng = random.Random(319)
VENTS = [(rng.uniform(0, math.tau), rng.uniform(0.12, 0.52), rng.random(), rng.choice((1, 1, 2)),
          rng.uniform(0.035, 0.08)) for _ in range(16)]                       # angle, radius, phase, loops, size
LO_Z, HI_Z = 0.24, SURF - 0.06


def bubbles(f, front, n=FRAMES):
    """Bubbles from VENTS: each rises `loops` times a loop of FRAMES frames from its vent, drifting a little. A loop of n
    frames (n < FRAMES: shorter, same pace for the slow vents) has every vent rise once in it."""
    def build():
        k = K("rec_u3_bubbles", FP8)
        for i, (a, r, ph, loops, s) in enumerate(VENTS):
            for j in range(2):
                t = (ph + j * 0.5 + (loops if n == FRAMES else 1) * f / n) % 1.0
                z = LO_Z + (HI_Z - LO_Z) * t
                aa = a + 0.25 * math.sin(t * math.tau + i)
                u, v = r * math.cos(aa), r * math.sin(aa)
                near = (u * N[0] + v * N[1]) > 0.0
                if near != front:
                    continue
                sz = s * (0.6 + 0.6 * t)                                     # they grow as they rise
                k.cyl(u, v, z, sz / 2, sz * 0.8, "recShine", top="recShine", sides=8)
        return k.build()
    return build


def design(h, f):
    return (u3_back,
            ((surface_film, 110), (dome, 38), (glass_edges, 170), (bubbles(f, True), 220), (u3_top, 255),
             (scan(h, True), "holo")),
            ((bubbles(f, False), 220), (scan(h, False), "holo")))


def bubbles_only(f, n=FRAMES):
    """A frame of the always-on loop (n frames): the pod and its bubbles, no scanner (its own layer, played now and
    then)."""
    return (u3_back,
            ((surface_film, 110), (dome, 38), (glass_edges, 170), (bubbles(f, True, n), 220), (u3_top, 255)),
            ((bubbles(f, False, n), 220),))


def scan_job(f, h):
    """The scanner on its own, frame f of a sweep: `module.recovery.u3.scan.back.fN` (drawn under the patient) and
    `.scan.front.fN` (over them), the pod's solid parts as holdout."""
    def run(f=f, h=h):
        from . import core, post
        from .research_kit import holo_item
        out = []
        for name, front in (("back", False), ("front", True)):
            core.clear_scene_meshes()
            post.select("recovery")
            it = holo_item(f"module.recovery.u3.scan.{name}.f{f}", FP8, u3_back.mask(), scan(h, front)())
            if it:
                it["id"] = f"module.recovery.u3.scan.{name}.f{f}"
                out.append(it)
        return out
    return run


DESIGNS = {"u3": design(STILL, 0), **{f"u3.f{i}": design(h, i) for i, h in enumerate(SWEEP)},
           **{f"u3b.f{i}": bubbles_only(i) for i in range(FRAMES)},
           **{f"u3c.f{i}": bubbles_only(i, 8) for i in range(8)}}              # the loop at 8 frames
SCAN_JOBS = [scan_job(f, h) for f, h in enumerate(SWEEP)]
