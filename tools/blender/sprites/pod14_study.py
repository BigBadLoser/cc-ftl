"""Recovery pod look study, round 14 (family `pod`, preview only): three new 2x2 upright pods, each held a different way.

  f1 saturn: a glass pill (its ends stepped in, small pole caps) clamped at the waist by one broad white collar that
     stands on three splayed fin legs; nothing under the pill, so it floats above the deck
  f2 diving bell: an opaque round pressure hull from the deck up, a tall rounded viewport cut into its front in a
     raised brass bezel, a stepped lid with a brass lifting eye; the patient is seen only through the viewport
  f3 double helix: a bare glass column wound by two broad amber straps, each one full turn from a toe on the deck up
     into a dark crown ring; a small drain dish under the fluid rides on the straps

Layers (see pod_preview.py): `module.pod.X` the whole pod with the fluid opaque; `.glass` the fluid alone; `.front` the
parts in front of the patient. A layer renders the whole pod with every other part as a holdout, so what stands behind
a shown part hides it as in the full sprite. Local frame: modkit.K, origin at the footprint centre, z up, 1 = a tile;
FRONT (toward the viewer) is the angle +pi/4, screen-left 3pi/4, screen-right -pi/4."""
import math

from .core import G as GV
from .modkit import K

FP = (2, 2)
TAU = math.tau
FRONT = math.pi / 4
N = 48                                            # facets round a ring: the FRONT +- pi/2 split falls on them
SHELL = ("arcShellL", "arcShell", "arcShellD")
NAVY = ("arcBodyL", "arcBody", "arcBodyD")
BRASS = ("arcGoldL", "arcGold", "arcGoldD")
AMBER = ("arcOrgL", "arcOrg", "arcOrgD")
GROUPS = ("back", "base", "fluid", "front")
SHOW = {"": None, ".glass": "fluid", ".front": "front"}


class Pod:
    """One K per group; build(layer) shows the layer's group and holds out the rest (all of them for the pod)."""
    def __init__(self, name):
        self.g = {n: K(f"{name}_{n}", FP) for n in GROUPS}

    def __getitem__(self, n):
        return self.g[n]

    def build(self, layer):
        """The pod: every object. A layer: (its group's objects, every object), for the "over" kind (env_build: its
        px only where it is in front of the rest, no outline, so a part cut in two leaves no seam)."""
        show, own, out = SHOW[layer], [], []
        for n, k in self.g.items():
            if not k.m.f:
                continue
            objs = k.build()
            out += objs
            own += objs if n == show else []
        return out if show is None else (own, out)


def side(a):
    """The group of a part at angle a round the axis: in front of the patient or behind."""
    return "front" if math.cos(a - FRONT) > 1e-6 else "back"


def face(k, pts, col, out):
    """A polygon of local (u, v, z) points, wound to face `out`."""
    nx = ny = nz = 0.0
    for (x0, y0, z0), (x1, y1, z1) in zip(pts, pts[1:] + pts[:1]):
        nx += (y0 - y1) * (z0 + z1)
        ny += (z0 - z1) * (x0 + x1)
        nz += (x0 - x1) * (y0 + y1)
    if nx * out[0] + ny * out[1] + nz * out[2] < 0:
        pts = pts[::-1]
    k.m.poly([GV(*k.p(p[0], p[1]), p[2]) for p in pts], col, flip=True)


def pt(a, r, z):
    return (r * math.cos(a), r * math.sin(a), z)


def strip(k, st, ramp, caps=(True, True), inner=True):
    """A band swept round the axis through stations (a, rin, rout, zb, zt): outer and inner skins, top, bottom, end
    caps. Ramp (top, side, dark)."""
    top, sd, dk = ramp
    for s0, s1 in zip(st, st[1:]):
        (a0, i0, o0, b0, t0), (a1, i1, o1, b1, t1) = s0, s1
        am = (a0 + a1) / 2
        rad, tan = (math.cos(am), math.sin(am), 0), (-math.sin(am), math.cos(am), 0)
        face(k, [pt(a0, o0, b0), pt(a1, o1, b1), pt(a1, o1, t1), pt(a0, o0, t0)], sd, rad)
        if inner:
            face(k, [pt(a0, i0, b0), pt(a1, i1, b1), pt(a1, i1, t1), pt(a0, i0, t0)], dk, (-rad[0], -rad[1], 0))
        face(k, [pt(a0, i0, t0), pt(a0, o0, t0), pt(a1, o1, t1), pt(a1, i1, t1)], top, (0, 0, 1))
        face(k, [pt(a0, i0, b0), pt(a0, o0, b0), pt(a1, o1, b1), pt(a1, i1, b1)], dk, (0, 0, -1))
    for (a, i, o, b, t), on, sg in ((st[0], caps[0], -1), (st[-1], caps[1], 1)):
        if on:
            face(k, [pt(a, i, b), pt(a, o, b), pt(a, o, t), pt(a, i, t)], dk,
                 (-sg * math.sin(a), sg * math.cos(a), 0))


def sweep(pod, a0, a1, fn, ramp, grp=None, n=N, inner=True):
    """strip() from angle a0 to a1 (stations every TAU/n, fn(a) -> (rin, rout, zb, zt)), cut where it passes behind or
    in front of the patient into the 'back' / 'front' groups (or all into `grp`). A whole turn has no end caps."""
    whole = a1 - a0 >= TAU - 1e-9
    m = max(1, round((a1 - a0) / (TAU / n)))
    angs = [a0 + (a1 - a0) * i / m for i in range(m + 1)]
    runs = []
    for x0, x1 in zip(angs, angs[1:]):
        g = grp or side((x0 + x1) / 2)
        if runs and runs[-1][0] == g:
            runs[-1][1].append(x1)
        else:
            runs.append((g, [x0, x1]))
    for j, (g, xs) in enumerate(runs):
        caps = (not whole and j == 0, not whole and j == len(runs) - 1)
        strip(pod[g], [(x, *fn(x)) for x in xs], ramp, caps, inner)


def ring(pod, rin, rout, z0, z1, ramp, grp=None, inner=True):
    sweep(pod, FRONT - math.pi / 2, FRONT + 1.5 * math.pi, lambda a: (rin, rout, z0, z1), ramp, grp, inner=inner)


def fin(k, ang, prof, t, ramp):
    """A flat plate in the radial plane at angle ang: the (r, z) profile `prof` (convex), t thick across."""
    top, sd, dk = ramp
    tx, ty = -math.sin(ang), math.cos(ang)
    cr = sum(p[0] for p in prof) / len(prof)
    cz = sum(p[1] for p in prof) / len(prof)

    def q(r, z, s):
        return (r * math.cos(ang) + s * tx * t / 2, r * math.sin(ang) + s * ty * t / 2, z)
    for s in (-1, 1):
        face(k, [q(r, z, s) for r, z in prof], sd, (s * tx, s * ty, 0))
    for (r0, z0), (r1, z1) in zip(prof, prof[1:] + prof[:1]):
        er, ez = z1 - z0, -(r1 - r0)                              # the edge's normal in (r, z), away from the centroid
        if er * ((r0 + r1) / 2 - cr) + ez * ((z0 + z1) / 2 - cz) < 0:
            er, ez = -er, -ez
        L = math.hypot(er, ez)
        col = top if ez / L > 0.7 else (sd if ez / L > -0.3 else dk)
        face(k, [q(r0, z0, -1), q(r1, z1, -1), q(r1, z1, 1), q(r0, z0, 1)], col,
             (er * math.cos(ang), er * math.sin(ang), ez))


def patch(k, a, r, w, z0, z1, col):
    """A flat patch on the tangent plane at angle a, radius r: w wide, z0..z1 (a lamp, a glint)."""
    tx, ty = -math.sin(a) * w / 2, math.cos(a) * w / 2
    cx, cy = r * math.cos(a), r * math.sin(a)
    face(k, [(cx - tx, cy - ty, z0), (cx + tx, cy + ty, z0), (cx + tx, cy + ty, z1), (cx - tx, cy - ty, z1)], col,
         (math.cos(a), math.sin(a), 0))


def fluid(pod, tiers, col, glint="arcChr", sides=32, glint_a=0.62):
    """The fluid as stacked cylinders (z0, z1, r), a glass glint down its screen-left front."""
    k = pod["fluid"]
    for z0, z1, r in tiers:
        k.cyl(0, 0, z0, r, z1 - z0, col, top=col, sides=sides)
    z0, z1, r = max(tiers, key=lambda t: t[1] - t[0])
    patch(k, FRONT + glint_a, r * math.cos(TAU / sides / 2) + 0.004, 0.09, z0 + 0.12, z1 - 0.12, glint)


# ---- f1: saturn -----------------------------------------------------------------------------------------------------

def f1(layer):
    pod = Pod(f"pod_f1{layer}")
    fluid(pod, [(0.50, 0.62, 0.42), (0.62, 0.74, 0.54), (0.74, 2.56, 0.62), (2.56, 2.68, 0.54), (2.68, 2.80, 0.42)],
          "podB")
    ring(pod, 0.58, 0.88, 1.34, 1.48, SHELL)                                  # the collar,
    ring(pod, 0.58, 0.74, 1.48, 1.56, SHELL)                                  # its clamp lip on the glass
    patch(pod["front"], FRONT, 0.88 * math.cos(math.pi / N) + 0.004, 0.14, 1.39, 1.43, "podBL")
    for a in (FRONT + math.pi / 3, FRONT - math.pi / 3, FRONT + math.pi):     # three fin legs under the collar
        fin(pod[side(a)], a, [(0.68, 1.34), (0.86, 1.34), (0.98, 0.0), (0.86, 0.0)], 0.08, SHELL)
    k = pod["front"]                                                          # pole caps
    k.cyl(0, 0, 2.80, 0.34, 0.10, SHELL[1], top=SHELL[0], sides=24)
    k.cyl(0, 0, 2.90, 0.20, 0.08, SHELL[2], top=SHELL[1], sides=16)
    k.cyl(0, 0, 2.98, 0.08, 0.04, "podBL", top="podBL", sides=12)
    b = pod["base"]
    b.cyl(0, 0, 0.40, 0.34, 0.10, SHELL[1], top=SHELL[0], sides=24)
    b.cyl(0, 0, 0.32, 0.20, 0.08, SHELL[2], top=SHELL[1], sides=16)
    return pod.build(layer)


# ---- f2: diving bell ------------------------------------------------------------------------------------------------

def hull(pod, rin, zs, rof, rampf):
    """A round wall of cells (facet i of N, band j between zs[j], zs[j+1]), cell (i, j) out to radius rof(i, j) (0: a
    hole) in the ramp rampf(i, j). Faces are drawn where a cell stands proud of its neighbour, as voxels."""
    nb = len(zs) - 1
    da = TAU / N
    a0 = FRONT - math.pi / 2

    def R(i, j):
        return rof(i % N, j) if 0 <= j < nb else 0.0
    for i in range(N):
        aa, ab = a0 + i * da, a0 + (i + 1) * da
        am = (aa + ab) / 2
        k = pod[side(am)]
        for j in range(nb):
            r = R(i, j)
            if not r:
                continue
            za, zb = zs[j], zs[j + 1]
            top, sd, dk = rampf(i, j)
            face(k, [pt(aa, r, za), pt(ab, r, za), pt(ab, r, zb), pt(aa, r, zb)], sd, (math.cos(am), math.sin(am), 0))
            for di, a in ((-1, aa), (1, ab)):
                rn = R(i + di, j)
                if rn < r:
                    face(k, [pt(a, max(rn, rin), za), pt(a, r, za), pt(a, r, zb), pt(a, max(rn, rin), zb)], dk,
                         (-di * math.sin(a), di * math.cos(a), 0))
            for dj, z, col in ((1, zb, top), (-1, za, dk)):
                rn = R(i, j + dj)
                if rn < r and (dj > 0 or j > 0):
                    rr = max(rn, rin)
                    face(k, [pt(aa, rr, z), pt(ab, rr, z), pt(ab, r, z), pt(aa, r, z)], col, (0, 0, dj))


def f2(layer):
    pod = Pod(f"pod_f2{layer}")
    zs = [round(0.1 * j, 3) for j in range(31)]                               # 30 bands of 0.1 up to 3.0
    fc = round((FRONT - (FRONT - math.pi / 2)) / (TAU / N))                   # facet index at FRONT's left edge
    cut = {-3: 3, -2: 1, -1: 0, 0: 0, 1: 1, 2: 3}                             # the viewport: rows trimmed per column

    def win(i, j):
        c = i - fc
        return c in cut and 6 + cut[c] <= j < 27 - cut[c]                    # z 0.6 .. 2.7, rounded ends

    def rof(i, j):
        if win(i, j):
            return 0.0
        if any(win((i + di) % N, j + dj) for di in (-1, 0, 1) for dj in (-1, 0, 1)):
            return 0.88                                                       # the bezel round the viewport
        if j < 2:
            return 0.92                                                       # the foot flange
        if j >= 28:
            return 0.86                                                       # the top rim
        return 0.84
    fluid(pod, [(0.5, 2.8, 0.78)], "podG", sides=48, glint_a=0.22)
    hull(pod, 0.74, zs, rof, lambda i, j: BRASS if rof(i, j) == 0.88 else NAVY)
    for z0, h, r, ramp in ((3.0, 0.1, 0.78, NAVY), (3.1, 0.1, 0.6, NAVY), (3.2, 0.06, 0.34, BRASS)):
        pod["back"].cyl(0, 0, z0, r, h, ramp[1], top=ramp[0], sides=48 if r > 0.5 else 24)
    eye = (FRONT + math.pi / 2, FRONT - math.pi / 2)                          # the lifting eye, face on: a hoop
    k = pod["back"]                                                           # in the screen plane
    ex, ey = math.cos(eye[0]), math.sin(eye[0])
    n, R0, R1, t = 12, 0.1, 0.17, 0.08
    for i in range(n):
        p0, p1 = i * TAU / n, (i + 1) * TAU / n
        c0 = [(r * math.cos(p) * ex, r * math.cos(p) * ey, 3.43 + r * math.sin(p)) for p in (p0, p1) for r in (R0, R1)]
        fx, fy = math.cos(FRONT) * t / 2, math.sin(FRONT) * t / 2
        f = [(x + fx, y + fy, z) for x, y, z in c0]
        b = [(x - fx, y - fy, z) for x, y, z in c0]
        pm = (p0 + p1) / 2
        o = (math.cos(pm) * ex, math.cos(pm) * ey, math.sin(pm))
        face(k, [f[0], f[1], f[3], f[2]], BRASS[1], (math.cos(FRONT), math.sin(FRONT), 0))
        face(k, [f[1], f[3], b[3], b[1]], BRASS[0] if o[2] > 0.3 else BRASS[1], o)
        face(k, [f[0], f[2], b[2], b[0]], BRASS[2], (-o[0], -o[1], -o[2]))
    patch(pod["front"], FRONT, 0.88 * math.cos(math.pi / N) + 0.004, 0.1, 2.76, 2.8, "podGL")
    return pod.build(layer)


# ---- f3: double helix -----------------------------------------------------------------------------------------------

def strap(pod, a0, h=0.24, top=3.04):
    """One amber strap: a full turn from a toe on the deck at angle a0 (it runs flat, thinning to its tip) up into the
    crown."""
    flat = math.radians(40)

    def fn(a):
        s = a - a0
        zb = 0.0 if s < flat else (s - flat) / (TAU - flat) * (top - h)
        return 0.56, 0.70, zb, zb + h * min(1.0, 0.35 + 0.65 * s / flat)
    sweep(pod, a0, a0 + TAU, fn, AMBER, n=72)


def f3(layer):
    pod = Pod(f"pod_f3{layer}")
    fluid(pod, [(0.5, 2.84, 0.6)], "podG")
    for a in (FRONT + math.pi / 2, FRONT - math.pi / 2):                      # toes at screen-left and -right
        strap(pod, a)
    ring(pod, 0.44, 0.72, 2.80, 3.06, NAVY)                                   # the crown ring
    k = pod["front"]
    k.cyl(0, 0, 2.80, 0.46, 0.18, NAVY[2], top=NAVY[1], sides=24)
    k.cyl(0, 0, 2.98, 0.1, 0.05, "podPL", top="podPL", sides=12)
    b = pod["base"]                                                           # the drain dish on the straps
    b.cyl(0, 0, 0.38, 0.6, 0.12, NAVY[1], top=NAVY[0], sides=32)
    b.cyl(0, 0, 0.24, 0.4, 0.14, NAVY[2], top=NAVY[1], sides=24)
    return pod.build(layer)


def jobs():
    return [(f"module.pod.{v}{layer}", FP, "over" if layer else "prop", lambda f=f, layer=layer: f(layer))
            for v, f in (("f1", f1), ("f2", f2), ("f3", f3)) for layer in SHOW]
