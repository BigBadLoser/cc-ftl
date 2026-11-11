"""Recovery pod look study round 4 (family `pod`, preview only): 2x2, upright, more finish. The fluid is lit from
below and darkens upward, a bright meniscus under an air gap; bubbles; glints on the glass; shells are curved, built
of panels on the tank's profile. Layers as round 1 (pod_study.py): the pod whole, `.glass` (the fluid, drawn
translucent over the patient), `.front` (the parts in front of the patient: those facing the viewer, +u +v).

  s1 shell egg: a rounded egg of amber fluid half held in a curved white shell that wraps its back, a seam of light
     along the shell's edge, a little crown on top, a rounded pedestal
  s2 med column: a glass column of green fluid between a vented base housing and a domed top housing, chrome rods, a
     monitor on an arm showing a heartbeat, spare fluid canisters racked behind
  s3 capsule: a white capsule with a tall oval window facing the viewer, blue fluid behind it, a lit rim round the
     window, panel lines, a step at its foot

Units: world (1 = a tile), z in world units. Local u, v in [-1, 1]; the tank stands at the centre."""
import math

from .research_kit import Bench, bar

FP2 = (2, 2)
FRONT = math.pi / 4                         # the direction facing the viewer (+u +v)


def faces_front(a, half=math.pi / 2):
    d = (a - FRONT + math.pi) % math.tau - math.pi
    return abs(d) < half


def lathe(k, u, v, prof, col, top=None, sides=24):
    for (z0, r0), (z1, r1) in zip(prof, prof[1:]):
        k.cyl(u, v, z0, r0, z1 - z0, col, top=top or col, sides=sides, rtop=r1)


def fluid(k, prof, cols, sides=24):
    """The fluid as a lathe, lit at the bottom and darker up (cols = lit, mid, dark), a lit meniscus on top."""
    z0, z1 = prof[0][0], prof[-1][0]
    for (za, ra), (zb, rb) in zip(prof, prof[1:]):
        f = ((za + zb) / 2 - z0) / (z1 - z0)
        col = cols[0] if f < 0.14 else cols[1] if f < 0.62 else cols[2]
        k.cyl(0.0, 0.0, za, ra, zb - za, col, top=col, sides=sides, rtop=rb)
    k.cyl(0.0, 0.0, z1, prof[-1][1], 0.012, cols[0], top=cols[0], sides=sides)


def bubbles(k, R, z0, z1, col, front):
    """Small bubbles in the fluid: the ones nearer the viewer than the patient when front, else the far ones."""
    for i in range(9):
        a = i * 2.4
        r = R * (0.55 + 0.35 * ((i * 7) % 5) / 5)
        if faces_front(a, math.pi / 2.5) != front:
            continue
        z = z0 + (z1 - z0) * ((i * 0.37) % 1.0)
        k.box(r * math.cos(a), r * math.sin(a), z, 0.035, 0.035, 0.035, col)


def panels(k, prof, a0, a1, n, col, keep, dr=0.04, t=0.05):
    """A curved shell on a profile: n columns of panels between angles a0..a1 (rad), dr outside it; keep(a, z)
    selects the panels to build."""
    for (za, ra), (zb, rb) in zip(prof, prof[1:]):
        r = (ra + rb) / 2 + dr
        w = 2 * r * math.sin((a1 - a0) / n / 2) * 1.12
        for i in range(n):
            a = a0 + (i + 0.5) * (a1 - a0) / n
            if keep(a, (za + zb) / 2):
                k.box(r * math.cos(a), r * math.sin(a), za, w, t, zb - za + 0.01, col, top=col, rz=a + math.pi / 2)


def glints(k, R, z0, z1):
    for da, w in ((-0.55, 0.03), (-0.42, 0.015)):
        a = FRONT + da
        k.box((R + 0.008) * math.cos(a), (R + 0.008) * math.sin(a), z0, w, 0.004, z1 - z0, "arcShellL",
              rz=a + math.pi / 2)


def egg_prof(z0, z1, R, n=16):
    return [(z0 + (z1 - z0) * t, max(0.06, R * math.sin(math.pi * (0.04 + 0.92 * t)) ** 0.55 * (1.04 - 0.1 * t)))
            for t in [i / n for i in range(n + 1)]]


def s1(layer="all"):
    k = Bench(f"pod_s1_{layer}", FP2)
    E = egg_prof(0.4, 2.3, 0.52)
    if layer in ("all", "glass"):
        fluid(k, E, ("podAL", "podA", "podAD"))
        bubbles(k, 0.4, 0.6, 2.0, "podAL", front=layer == "glass")
    if layer == "glass":
        return k.build()
    back = lambda a, z: not faces_front(a, math.pi * 0.42)               # noqa: E731
    if layer == "all":
        lathe(k, 0.0, 0.0, [(0.0, 0.66), (0.1, 0.68), (0.2, 0.6), (0.3, 0.42), (0.42, 0.3)], "arcShell",
              top="arcShellL", sides=28)                                                    # the pedestal,
        k.cyl(0.0, 0.0, 0.1, 0.685, 0.025, "podAL", top="podAL", sides=28)                 # its lit band,
        panels(k, E[1:-1], 0, math.tau, 24, "arcShellL", back)                            # the shell,
        panels(k, E[2:-2], 0, math.tau, 48, "podAL",
               lambda a, z: back(a, z) and faces_front(a, math.pi * 0.47), dr=0.05, t=0.012)   # its lit edge
        bar(k, (0.0, -0.3, 2.36), (0.0, -0.7, 2.0), 0.08, "arcShellD")                     # a hose to the back
    else:
        k.box(0.42, 0.42, 0.0, 0.3, 0.2, 0.12, "arcShellD", top="arcShellL", rz=-FRONT)   # the step
    lathe(k, 0.0, 0.0, [(2.26, 0.16), (2.36, 0.2), (2.44, 0.14), (2.5, 0.06)], "arcShell", top="arcShellL")   # crown
    k.cyl(0.0, 0.0, 2.34, 0.205, 0.02, "podAL", top="podAL", sides=20)
    if layer == "front":
        glints(k, 0.5, 0.9, 1.7)
    return k.build()


def s2(layer="all"):
    k = Bench(f"pod_s2_{layer}", FP2)
    R, z0, zm, z1 = 0.48, 0.44, 1.96, 2.1
    C = [(z0 + (zm - z0) * i / 6, R) for i in range(7)]
    if layer in ("all", "glass"):
        fluid(k, C, ("podGL", "podG", "podGD"), sides=28)
        bubbles(k, R, z0 + 0.1, zm - 0.1, "podGL", front=layer == "glass")
    if layer == "glass":
        return k.build()
    if layer == "all":
        k.cyl(0.0, 0.0, zm, R, z1 - zm, "arcGlass", top="arcGlass", sides=28)              # the air gap,
        k.cyl(0.0, 0.0, 0.0, 0.64, 0.32, "arcBodyD", top="arcBody", sides=28)              # the base housing,
        k.cyl(0.0, 0.0, 0.32, 0.6, 0.06, "arcChrD", top="arcChr", sides=28)
        k.cyl(0.0, 0.0, 0.38, 0.52, 0.06, "podGL", top="podGL", sides=28)                  # its lit ring,
        for i in range(12):                                                                 # its vents
            a = i * math.tau / 12
            k.box(0.645 * math.cos(a), 0.645 * math.sin(a), 0.1, 0.12, 0.01, 0.12, "arcBodyK", rz=a + math.pi / 2)
        for i in range(3):                                                                  # the canisters behind
            u = -0.35 + i * 0.35
            k.cyl(u, -0.8, 0.0, 0.11, 0.7, "arcChrD", top="arcChr", sides=12)
            k.cyl(u, -0.8, 0.12, 0.09, 0.46, "podGL" if i != 1 else "podG", top="podGL", sides=12)
        k.box(0.0, -0.8, 0.0, 1.0, 0.24, 0.06, "arcBodyD", top="arcBody")
    for a in (FRONT - 1.2, FRONT + 1.2, FRONT + math.pi):                                   # the rods
        if faces_front(a) == (layer == "front") or layer == "all":
            bar(k, (0.53 * math.cos(a), 0.53 * math.sin(a), 0.38), (0.53 * math.cos(a), 0.53 * math.sin(a), z1),
                0.04, "arcChr")
    k.cyl(0.0, 0.0, z1, 0.6, 0.16, "arcBodyD", top="arcBody", sides=28)                    # the top housing,
    k.cyl(0.0, 0.0, z1 + 0.16, 0.6, 0.2, "arcShell", top="arcShellL", sides=28, rtop=0.34)
    k.cyl(0.0, 0.0, z1 + 0.04, 0.605, 0.025, "podGL", top="podGL", sides=28)
    k.cyl(0.0, 0.0, z1 + 0.36, 0.14, 0.08, "arcChrD", top="arcChr", sides=14)
    if layer == "front":
        glints(k, R, z0 + 0.2, zm - 0.1)
        mu, mv = 0.86, 0.1                                                                   # the monitor on its arm
        bar(k, (0.56, -0.1, 0.3), (mu, mv, 0.8), 0.05, "arcChrD")
        k.box(mu, mv, 0.78, 0.06, 0.34, 0.24, "arcBodyD", top="arcBody", rz=-0.5)
        for i, (dz, h) in enumerate(((0.0, 0.02), (0.0, 0.02), (0.06, 0.1), (-0.04, 0.06), (0.0, 0.02), (0.0, 0.02))):
            vv = mv - 0.12 + i * 0.048
            k.box(mu + 0.032 + (vv - mv) * 0.55, vv, 0.88 + dz, 0.004, 0.05, h, "podGL", rz=-0.5)
    return k.build()


def s3(layer="all"):
    k = Bench(f"pod_s3_{layer}", FP2)
    P = [(0.12, 0.42), (0.24, 0.56), (0.4, 0.62)] + [(0.4 + 1.6 * i / 8, 0.62) for i in range(1, 9)] + \
        [(2.14, 0.58), (2.28, 0.48), (2.38, 0.3), (2.42, 0.1)]                               # the capsule's profile
    F = [(0.3, 0.5)] + [(0.3 + 1.86 * i / 10, 0.55) for i in range(1, 11)]                    # the fluid inside
    if layer in ("all", "glass"):
        fluid(k, F, ("podBL", "podB", "podBD"), sides=24)
        bubbles(k, 0.45, 0.5, 2.0, "podBL", front=layer == "glass")
    if layer == "glass":
        return k.build()
    zc, zh, aw = 1.3, 0.82, 0.78                                                            # the window: centre, half
    win = lambda a, z: faces_front(a, aw * math.sqrt(max(0.0, 1 - ((z - zc) / zh) ** 2)))   # noqa: E731
    near = lambda a: faces_front(a, math.pi / 2)                                              # noqa: E731
    keep = (lambda a, z: near(a) and not win(a, z)) if layer == "front" else (lambda a, z: not win(a, z))
    panels(k, P, 0, math.tau, 28, "arcShellL", keep, dr=0.0, t=0.08)                          # the shell,
    rim = lambda a, z: near(a) == (layer == "front") or layer == "all"                        # noqa: E731
    for i in range(32):                                                                       # the window's lit rim
        t = i * math.tau / 32
        a, z = FRONT + aw * math.sin(t), zc + zh * math.cos(t)
        if rim(a, z):
            k.box(0.63 * math.cos(a), 0.63 * math.sin(a), z - 0.03, 0.06, 0.03, 0.06, "podBL", rz=a + math.pi / 2)
    for z in (0.34, 2.18):                                                                    # panel lines
        for i in range(28):
            a = i * math.tau / 28
            if keep(a, z) and (near(a) == (layer == "front") or layer == "all"):
                r = 0.56 if z < 1 else 0.59
                k.box((r + 0.07) * math.cos(a), (r + 0.07) * math.sin(a), z, 0.14, 0.006, 0.012, "arcShellD",
                      rz=a + math.pi / 2)
    if layer == "all":
        k.cyl(0.0, 0.0, 0.0, 0.5, 0.14, "arcBodyD", top="arcBody", sides=24)                 # the foot,
        bar(k, (-0.2, -0.5, 2.3), (-0.4, -0.86, 1.6), 0.08, "arcBodyK")                       # hoses behind
        bar(k, (0.2, -0.5, 2.3), (0.3, -0.88, 1.4), 0.08, "arcBodyK")
    else:
        k.box(0.5, 0.5, 0.0, 0.42, 0.26, 0.12, "arcShellD", top="arcShellL", rz=-FRONT)       # the step
        k.box(0.5 + 0.13 * 0.707, 0.5 + 0.13 * 0.707, 0.04, 0.3, 0.004, 0.02, "podBL", rz=-FRONT)
        glints(k, 0.56, zc - 0.5, zc + 0.5)
    return k.build()


def jobs():
    out = []
    for v, f in (("s1", s1), ("s2", s2), ("s3", s3)):
        out.append((f"module.pod.{v}", FP2, "prop", f))
        for layer in ("glass", "front"):
            out.append((f"module.pod.{v}.{layer}", FP2, "prop", lambda f=f, layer=layer: f(layer)))
    return out
