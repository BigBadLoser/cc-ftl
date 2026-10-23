"""REFINERY, second build (module.refinery, 3x4): the hull is one surface. A single cross-section (a battered wall, an
armoured shoulder chamfer, a sloped shoulder, a cap, the ridge) is swept along the length through stations; at the
ends it steps in for the corner chamfers and its end faces lean, so the whole housing, corners and roof included, is
one skin with no pieces laid on pieces. Bays, the terminal's niche and the machine's pit are cut out of that skin, real
recesses behind. Orange is painted on the skin by zone (shoulders, corners, pilasters), not stacked on as plates.

The machine comes up out of the ridge or sits sunk in it, an armour collar where it meets the hull, pipes running down
the shoulder into ports. Three machines:

  crucible  sunk in a square pit in the ridge, molten; a flue to a stack rising from the ridge; a pipe down the shoulder
  stacks    three stacks rising out of the ridge, windows lit, bores glowing; a header and a downcomer
  kiln      a rotary drum lying half sunk in a trough along the ridge, riding rings and hot seams; a stack at its end

Crew side +u (access tile at its middle): the terminal in a full-height niche, the input hatch (-v) and the output
(+v) either side; the far side has three vent bays. Local frame: modkit.K, u across the 3-tile width, v along the 4."""
import math

from mathutils import Vector

from .modkit import K
from .steelkit import face, slab, tube

FP = (3, 4)
U, V = 1.46, 1.96
BODY, TOP, REC, DARK = "steel", "blueGrey", "steelD", "dark"
ARM, ARM_L, ARM_D = "c1T3", "c1T2", "c1T4"
GLOW, HOT, SCREEN = "orange", "flameY", "lampY"
WALL_TOP, BAT = 0.7, 0.2                   # the battered wall's top and lean
BZ = (0.1, 0.6)                            # the bays' floor and ceiling
CH, BE = 0.36, 0.22                        # the corner chamfer; how far the end faces lean in at the ridge
RIDGE = 1.2
# the half cross-section, bottom to ridge: (u, z, zone of the segment above it)
HALF = [(U, 0.0, "wall"), (None, BZ[0], "bay"), (None, BZ[1], "wall"), (U - BAT, WALL_TOP, "chamfer"),
        (U - 0.34, 0.84, "shoulder"), (0.72, 1.1, "cap"), (0.64, RIDGE, "ridge")]
D = 0.24                                   # bay depth
BAYS = {1: [(-1.45, -0.62, "input"), (-0.42, 0.42, "terminal"), (0.62, 1.45, "output")],
        -1: [(-1.45, -0.55, "vent"), (-0.45, 0.45, "vent"), (0.55, 1.45, "vent")]}


def wall_u(z):
    return U - BAT * z / WALL_TOP


def half():
    out = []
    for u, z, zone in HALF:
        out.append((wall_u(z) if u is None else u, z, zone))
    return out


def profile(pit=None):
    """The full cross-section over the top, +u bottom to -u bottom, as (u, z) and the zone of each segment."""
    h = half()
    pts, zones = [(u, z) for u, z, _ in h], [zn for _, _, zn in h][:-1]
    if pit:
        pts += [(pit, RIDGE), (-pit, RIDGE)]
        zones += ["ridge", "pit", "ridge"]
    else:
        zones += ["ridge"]
    mirror = [(-u, z) for u, z, _ in reversed(h)]
    pts += mirror
    zones += [zn for _, _, zn in reversed(h)][1:]
    return pts, zones


def colour(zone, side_v, corner, pilaster):
    if zone in ("chamfer", "shoulder"):
        return ARM
    if zone == "cap":
        return ARM_D
    if zone in ("ridge", "pit"):
        return TOP
    return ARM if (corner or pilaster) else BODY


def station_pts(prof, v, end):
    """The cross-section placed at v; at an end station it steps in by CH and leans back with height."""
    out = []
    for u, z in prof:
        if end:
            uu = math.copysign(max(abs(u) - CH, 0.12 if abs(u) > 1e-6 else 0.0), u)
            vv = end * (V - BE * z / RIDGE)
            out.append(Vector((uu, vv, z)))
        else:
            out.append(Vector((u, v, z)))
    return out


def recess(k, s, v0, v1, z0, z1, depth, back_col=REC):
    """The recess behind an opening in the battered wall on side s."""
    fr = lambda v, z: Vector((s * wall_u(z), v, z))                          # noqa: E731
    bk = lambda v, z: Vector((s * (wall_u(z) - depth), v, z))                # noqa: E731
    face(k, [bk(v0, z0), bk(v1, z0), bk(v1, z1), bk(v0, z1)], (s, 0, 0), back_col)
    if z0 > 0:
        face(k, [fr(v0, z0), fr(v1, z0), bk(v1, z0), bk(v0, z0)], (0, 0, 1), BODY)
    face(k, [fr(v0, z1), fr(v1, z1), bk(v1, z1), bk(v0, z1)], (0, 0, -1), REC)
    face(k, [fr(v0, z0), bk(v0, z0), bk(v0, z1), fr(v0, z1)], (0, 1, 0), BODY)
    face(k, [fr(v1, z0), bk(v1, z0), bk(v1, z1), fr(v1, z1)], (0, -1, 0), BODY)


def hull(k, pit=None, pit_v=None, pit_depth=0.5):
    """The swept skin, its openings, their recesses; pit = the half width of a pit in the ridge over pit_v (v0, v1)."""
    prof, zones = profile(pit)
    cuts = {s: [(a, b, kind) for a, b, kind in BAYS[s]] for s in (1, -1)}
    stops = {-V, V, -V + CH, V - CH}
    for s in (1, -1):
        for a, b, _ in cuts[s]:
            stops |= {a, b}
    if pit_v:
        stops |= set(pit_v)
    stops = sorted(stops)
    st = [(v, station_pts(prof, v, (1 if v == V else -1) if abs(v) == V else 0)) for v in stops]
    cen = lambda p: Vector((0, p.y, 0.35))                                   # noqa: E731
    for (va, pa), (vb, pb) in zip(st, st[1:]):
        vm = (va + vb) / 2
        corner = abs(vm) > V - CH
        for i, zone in enumerate(zones):
            side = 1 if (prof[i][0] + prof[i + 1][0]) > 0 else -1
            bay = next((kd for a, b, kd in cuts[side] if a <= vm <= b), None) if not corner else None
            if zone == "bay" and bay:
                continue
            if bay == "terminal" and zone == "wall" and prof[i][1] < WALL_TOP - 1e-6:
                continue
            if zone == "pit" and pit_v and pit_v[0] <= vm <= pit_v[1]:
                continue
            pil = zone in ("wall", "bay") and not bay and not corner
            q = [pa[i], pb[i], pb[i + 1], pa[i + 1]]
            m = sum(q, Vector()) / 4
            face(k, q, m - cen(m), colour(zone, vm, corner, pil))
    for end in (-1, 1):                                                      # the end faces: body, armour above
        pts = station_pts(prof, 0, end)
        lower = [p for p in pts if p.z <= WALL_TOP + 1e-6]
        upper = [p for p in pts if p.z >= WALL_TOP - 1e-6]
        face(k, lower, (0, end, 0.3), BODY)
        face(k, upper, (0, end, 0.6), ARM)
        end_grille(k, end)
    for s in (1, -1):
        for a, b, kind in cuts[s]:
            if kind == "terminal":
                recess(k, s, a, b, 0.0, WALL_TOP, 0.36)
            else:
                recess(k, s, a, b, BZ[0], BZ[1], D)
    if pit_v:
        z0, (v0, v1) = RIDGE - pit_depth, pit_v
        sq = [(-pit, v0), (pit, v0), (pit, v1), (-pit, v1)]
        for i in range(4):
            a, b = sq[i], sq[(i + 1) % 4]
            m = Vector(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - (v0 + v1) / 2, 0))
            face(k, [(*a, z0), (*b, z0), (*b, RIDGE), (*a, RIDGE)], -m, REC)
        face(k, [(*p, z0) for p in sq], (0, 0, 1), DARK)


def end_grille(k, end, on=True):
    """A grille in an end face, dark slots under bars, two amber slits above it."""
    for i in range(4):
        z = 0.14 + i * 0.12
        v = end * (V - BE * z / RIDGE)
        k.box(0, v, z, 0.7, 0.03, 0.08, DARK)
        k.box(0, v + end * 0.014, z + 0.08, 0.76, 0.02, 0.03, BODY, top=TOP)
    for e in (-1, 1):
        z = 0.62
        k.box(e * 0.5, end * (V - BE * z / RIDGE) + end * 0.012, z, 0.18, 0.02, 0.05, GLOW)


def shoulder_z(u):
    """The roof's height over |u| on the shoulder (for pipes laid down it)."""
    h = half()
    pts = [(u_, z) for u_, z, _ in h][3:]
    au = abs(u)
    for (u0, z0), (u1, z1) in zip(pts, pts[1:]):
        if u1 <= au <= u0:
            return z0 + (z1 - z0) * (u0 - au) / (u0 - u1)
    return RIDGE if au < pts[-1][0] else WALL_TOP


# ---- the crew side and the bays -----------------------------------------------------------------------------------

def terminal(k, on):
    """In its niche: a console whose top slopes up to the back, the screen on a gimbal over it, a status lamp."""
    u_b, u_f = wall_u(0) - 0.36, U - 0.04
    zb, zf, w = 0.62, 0.42, 0.34
    z = lambda u: zb + (zf - zb) * (u - u_b) / (u_f - u_b)                    # noqa: E731
    plan = [(u_b, -w), (u_f - 0.1, -w), (u_f, -w + 0.1), (u_f, w - 0.1), (u_f - 0.1, w), (u_b, w)]
    face(k, [(u, v, z(u)) for u, v in plan], (zb - zf, 0, u_f - u_b), ARM)
    for i in range(len(plan) - 1):
        (ua, va), (ub, vb) = plan[i], plan[i + 1]
        face(k, [(ua, va, 0), (ub, vb, 0), (ub, vb, z(ub)), (ua, va, z(ua))],
             Vector(((ua + ub) / 2 - u_b, (va + vb) / 2, 0)), BODY)
    uc = (u_b + u_f) / 2
    k.cyl(uc, 0, z(uc) - 0.02, 0.045, 0.14, REC, top=BODY, sides=10)
    tilt = math.radians(28)
    n, up = Vector((math.cos(tilt), 0, math.sin(tilt))), Vector((-math.sin(tilt), 0, math.cos(tilt)))
    c, sd = Vector((uc + 0.02, 0, z(uc) + 0.22)), Vector((0, 1, 0))
    quad = lambda ww, hh, d=0.0: [c + n * d + sd * a * ww / 2 + up * b * hh / 2            # noqa: E731
                                  for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    slab(k, quad(0.48, 0.3), n, 0.05, BODY, side=REC)
    face(k, quad(0.4, 0.22, 0.027), n, SCREEN if on else DARK)
    k.box(U - 0.05, 0.3, 0.12, 0.02, 0.05, 0.05, GLOW if on else REC)


def hatches(k, on):
    """The input and output: a dark mouth in each recess's back wall, a chute sloping into it, the output hot inside."""
    for a, b, kind in BAYS[1]:
        if kind == "terminal":
            continue
        c, w = (a + b) / 2, b - a
        ub = wall_u(BZ[0]) - D
        k.box(ub + 0.005, c, BZ[0] + 0.18, 0.01, w - 0.2, 0.28, DARK)
        face(k, [(ub, c - w / 2 + 0.05, BZ[0] + 0.18), (ub, c + w / 2 - 0.05, BZ[0] + 0.18),
                 (ub + D * 0.75, c + w / 2 - 0.05, BZ[0] + 0.02), (ub + D * 0.75, c - w / 2 + 0.05, BZ[0] + 0.02)],
             (0.6, 0, 1), REC)
        if kind == "output":
            k.box(ub + 0.012, c, BZ[0] + 0.2, 0.01, w - 0.32, 0.05, GLOW if on else REC)


def vents(k, on):
    """The far side's bays: louvres across a glowing back."""
    for a, b, _ in BAYS[-1]:
        ub = -(wall_u(BZ[0]) - D)
        k.box(ub - 0.005, (a + b) / 2, BZ[0] + 0.05, 0.01, b - a - 0.08, 0.3, GLOW if on else DARK)
        for i in range(5):
            z = BZ[0] + 0.04 + i * 0.1
            u = -(wall_u(z) - D * 0.55)
            k.box(u, (a + b) / 2, z, 0.12, b - a - 0.02, 0.03, BODY, top=TOP)


# ---- machines ------------------------------------------------------------------------------------------------------

def annulus(k, u, v, z0, z1, ro, ri, col, n=22):
    ring = lambda r, z: [Vector((u + r * math.cos(i * math.tau / n), v + r * math.sin(i * math.tau / n), z))  # noqa: E731
                         for i in range(n)]
    o0, o1, i1 = ring(ro, z0), ring(ro, z1), ring(ri, z1)
    for i in range(n):
        j = (i + 1) % n
        face(k, [o0[i], o0[j], o1[j], o1[i]], (o0[i] + o0[j]) / 2 - Vector((u, v, z0)), col)
        face(k, [o1[i], o1[j], i1[j], i1[i]], (0, 0, 1), col)


def stack(k, u, v, z0, h, r, on, windows=True):
    """A stack rising out of the hull: a collar where it leaves the skin, a lip, a glowing bore, lit windows."""
    k.cyl(u, v, z0 - 0.04, r, h, BODY, top=DARK, sides=20)
    k.cyl(u, v, z0 - 0.02, r + 0.07, 0.14, ARM, top=ARM_L, sides=20)
    annulus(k, u, v, z0 + h - 0.12, z0 + h - 0.03, r + 0.03, r - 0.08, ARM)
    k.cyl(u, v, z0 + h - 0.16, r - 0.08, 0.02, GLOW if on else DARK, sides=18)
    k.cyl(u, v, z0 + h - 0.155, r * 0.45, 0.02, HOT if on else DARK, sides=14)
    if windows:
        for a in (-0.45, 0.45):
            k.box(u + (r + 0.005) * math.cos(a), v + (r + 0.005) * math.sin(a), z0 + 0.16, 0.03, 0.08, 0.2,
                  GLOW if on else DARK, rz=a)


def pipe_down(k, start, v, side=-1, r=0.065):
    """A pipe from `start` out to the shoulder on `side`, down it, into a flanged port at the wall's top."""
    start = Vector(start)
    u_cap = 0.68
    p1 = Vector((side * u_cap, v, max(start.z, shoulder_z(u_cap) + r + 0.03)))
    p2 = Vector((side * (U - BAT - 0.06), v, WALL_TOP + 0.09))
    for a, b in ((start, p1), (p1, p2)):
        tube(k, a, b, r, BODY, sides=10)
    tube(k, p2, p2 - Vector((0, 0, 0.08)), r, BODY, sides=10)
    tube(k, p2 - Vector((0, 0, 0.1)), p2 - Vector((0, 0, 0.05)), r + 0.04, ARM, sides=12)


def crucible(k, on):
    hull(k, pit=0.52, pit_v=(-0.52, 0.52), pit_depth=0.4)
    r = 0.48
    k.cyl(0, 0, RIDGE - 0.4, r, 0.5, BODY, top=REC, sides=26)                 # sunk in its pit
    annulus(k, 0, 0, RIDGE - 0.02, RIDGE + 0.12, r + 0.06, r - 0.1, ARM)      # its collar and lip
    k.cyl(0, 0, RIDGE + 0.06, r - 0.1, 0.04, GLOW if on else DARK, sides=24)  # the melt
    k.cyl(0, 0, RIDGE + 0.07, r - 0.24, 0.04, HOT if on else DARK, sides=20)
    stack(k, 0, -1.12, RIDGE, 0.7, 0.2, on, windows=False)
    tube(k, (0, -0.5, RIDGE + 0.28), (0, -0.94, RIDGE + 0.28), 0.08, BODY, sides=10)
    for v in (-0.58, -0.9):
        tube(k, (0, v - 0.025, RIDGE + 0.28), (0, v + 0.025, RIDGE + 0.28), 0.11, ARM, sides=12)
    pipe_down(k, (-0.4, 0.3, RIDGE + 0.12), 0.3)
    pipe_down(k, (-0.4, -0.3, RIDGE + 0.12), -0.3)


def stacks(k, on):
    hull(k)
    for v in (-1.0, 0.0, 1.0):
        stack(k, 0, v, RIDGE, 0.72, 0.3, on)
    hz, hu = RIDGE + 0.42, -0.42
    tube(k, (hu, -1.0, hz), (hu, 1.0, hz), 0.06, BODY, sides=10, cap=ARM)
    for v in (-1.0, 0.0, 1.0):
        tube(k, (hu, v, hz), (-0.28, v, hz), 0.05, BODY, sides=10)
        tube(k, (hu + 0.04, v, hz), (hu + 0.09, v, hz), 0.085, ARM, sides=12)
    pipe_down(k, (hu, 1.0, hz), 1.0)
    pipe_down(k, (hu, -1.0, hz), -1.0)


def kiln(k, on):
    hull(k, pit=0.44, pit_v=(-1.2, 1.2), pit_depth=0.42)
    a, b = Vector((0, -1.2, RIDGE - 0.04)), Vector((0, 1.2, RIDGE - 0.04))
    tube(k, a, b, 0.4, BODY, sides=24, cap=DARK)                              # the drum, half sunk
    for v in (-0.7, 0.7):                                                     # riding rings
        tube(k, (0, v - 0.07, a.z), (0, v + 0.07, a.z), 0.47, ARM, sides=24, cap=ARM_D)
    for v in (-0.25, 0.25):                                                   # hot seams
        tube(k, (0, v - 0.025, a.z), (0, v + 0.025, a.z), 0.41, GLOW if on else REC, sides=24)
    stack(k, 0, -1.55, RIDGE - 0.08, 0.66, 0.18, on, windows=False)
    pipe_down(k, (-0.3, 1.45, RIDGE + 0.05), 1.45)


MACHINES = {"crucible": crucible, "stacks": stacks, "kiln": kiln}


def refinery(machine, rot=0, on=True):
    k = K(f"refinery2_{machine}_{rot}_{int(on)}", FP, rot)
    MACHINES[machine](k, on)
    terminal(k, on)
    hatches(k, on)
    vents(k, on)
    return k.build()
