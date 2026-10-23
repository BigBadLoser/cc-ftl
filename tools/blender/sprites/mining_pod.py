"""The MINING POD (vehicle.mining_pod): a one-seat capsule of a miner that sits in a 3x3 bay. Ore rides inside it.

Local frame as shuttle_craft (u = nose, v across, z up, origin at the footprint centre on the pad; `Spin(heading)`).
The body is a capsule swept along the pod's v axis (built in its own frame turned a quarter turn, `Spin(heading + 90)`):
a ball cut in half with the halves pushed a little apart, a drum round its middle (a cylinder proud of the
domes, with flat dark sides) carrying the armour plates, and
the big round HATCH (a heavy ring round a red-lit door with lamps) closing each end. The nose (+u) carries a boxy
WINDSHIELD that juts out of the hull, a big raked pane over a smaller lower one in dark glass. Underneath: one
big thruster bell in a housing, which it rests on when parked; a big mining laser in a gimbal hung from the
windshield's flat underside, two grab arms behind hatch panels either side of it, and two work lamps on the windshield's
top corners. The rear thruster sits in a bore cut into the drum's back, its cone running out past the hull.
The ship's blue-grey steel, industrial yellow accents (c4T).

States: parked / docked (laser stowed, thruster dark), fly (thruster lit), mine (laser lowered, emitter lit; `bob` lifts
it for the hover loop)."""
import math

from . import core
from .shuttle_bay import lbox
from .shuttle_craft import Spin, _g, profile, smooth, station

C = 1.18                      # the body's axis height above the pad (parked, on the bell)
R = 0.86                      # the hull's radius: the band's, and each half-dome's
BAND = (-0.47, 0.47)          # the drum's flat sides (along the pod's v); everything mirrors about v = 0
DRUM_R = 0.95                 # the drum's radius: it stands this much proud of the domes (R) all round
BORE = 0.45                   # the bore cut into the drum's back for the rear thruster (the drum is +-0.47 wide)
BORE_FLOOR = 0.6              # the bore's floor, this far behind the centre
REAR = (C, 0.32, 0.4)         # the rear thruster, sunk in the bore: centre z, throat and mouth radius
ARM_AT = (0.62, C - 0.02)     # the grab arms' panels: |v| and z on the front of each dome, either side of the windshield
DOME_C = 0.235                # each half-dome's centre, out from the middle (0: the whole ball; the ribs: split wide)
HATCH_END = 0.6               # the domes end where the hull's radius is this, under the hatch rings


def _dome(c, sign, r_end, n=6):
    """Stations of a half-dome centred at c, going outward (sign) to where its radius is r_end."""
    p0 = math.asin(r_end / R)
    out = []
    for k in range(n + 1):
        p = math.pi / 2 - (math.pi / 2 - p0) * k / n
        out.append((c + sign * R * math.cos(p), R * math.sin(p)))
    return out


BALL = _dome(-DOME_C, -1, HATCH_END)[::-1] + _dome(DOME_C, 1, HATCH_END)   # half-dome, drum, half-dome
SECTION = profile(n=24, p=2.0)          # a true circle: a pressure hull
HATCH_R = 0.5                 # the round hatch's door radius
BELL = (0.0, 0.42, 0.28)      # the main thruster: mouth z, mouth radius, throat radius
WIND = (0.5, 1.22, 0.4)       # windshield box: back u (inside the hull), front u at its foot, half width
WIND_ZB = C - 0.44            # the windshield box's flat underside
LASER_U, LASER_Z = 0.98, WIND_ZB - 0.2    # the laser's pivot, in the gimbal hung under the windshield
HULL, HULL_D, HULL_L = "steelL", "steel", "plate"   # the ship's own blue-grey steel
YEL, YEL_D = "c4T2", "c4T4"
GLOW = "cyan"
BEAM = "orange"


def _halfplane(poly, a, b, c):
    """The part of a convex 2D polygon where a*x + b*y <= c."""
    out = []
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        dp, dq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if dp <= 0:
            out.append(p)
        if (dp < 0) != (dq < 0) and abs(dp - dq) > 1e-12:
            t = dp / (dp - dq)
            out.append((p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t))
    return out


BORE_N = 64                   # the bore is this many-sided: the hull is cut along exactly the polygon its wall follows


def _bore_corner(i, r, zc):
    a = i * math.tau / BORE_N
    return r * math.cos(a), zc + r * math.sin(a)


def _minus_bore(poly, r, zc):
    """A convex (u, z) polygon less the bore's (BORE_N-gon) disc about (0, zc): convex pieces, peeled off edge by edge."""
    pieces, rest = [], poly
    h = r * math.cos(math.pi / BORE_N)                                      # each edge's distance from the axis
    for i in range(BORE_N):
        a = (i + 0.5) * math.tau / BORE_N
        nx, nz = math.cos(a), math.sin(a)
        piece = _halfplane(rest, -nx, -nz, -nz * zc - h)                     # outside this edge
        if len(piece) >= 3:
            pieces.append(piece)
        rest = _halfplane(rest, nx, nz, nz * zc + h)                         # inside it: carry on round
        if len(rest) < 3:
            break
    return pieces


def _on_face(q, u, z):
    """The point of the hull face q (corners: station a at profile i, a at j, b at j, b at i) at (u, z), on the face
    itself (bilinear), so cut pieces sit flush with their uncut neighbours."""
    s = 0.0 if abs(q[3][0] - q[0][0]) < 1e-9 else (u - q[0][0]) / (q[3][0] - q[0][0])
    lo = q[0][2] + (q[3][2] - q[0][2]) * s                                  # z of the face's i edge at u
    hi = q[1][2] + (q[2][2] - q[1][2]) * s                                  # and of its j edge
    t = 0.0 if abs(hi - lo) < 1e-9 else (z - lo) / (hi - lo)
    a = [q[0][x] + (q[3][x] - q[0][x]) * s for x in range(3)]
    b = [q[1][x] + (q[2][x] - q[1][x]) * s for x in range(3)]
    return (u, a[1] + (b[1] - a[1]) * t, z)


def loft(f, stations, prof, mat, cap0=None, cap1=None, closed=True, hole=None):
    """shuttle_craft.sweep, optionally cut by the rear thruster's bore: a cylinder of radius `hole` along the pod's u
    (the body frame's v) through the back. Faces on the back that reach the bore are cut along it exactly: in the
    (u, z) plane each is a quad less the bore's disc, and the pieces go back onto the hull's round surface."""
    local = [[(u, v0 + pv * sv, z0 + pz * sz) for pv, pz in prof] for u, sv, sz, v0, z0 in stations]
    rings = [[f.pt(*p) for p in ring_] for ring_ in local]
    n = len(prof)
    zc = REAR[0]
    for k, (A, B) in enumerate(zip(rings, rings[1:])):
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            q = [local[k][i], local[k][j], local[k + 1][j], local[k + 1][i]]
            if hole and all(p[1] > 1e-6 for p in q) and min(abs(p[2] - zc) for p in q) < hole + 0.05 and \
                    min(abs(p[0]) for p in q) < hole + 0.05:
                uz = [(p[0], p[2]) for p in q]
                cw = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(uz, uz[1:] + uz[:1])) < 0
                for piece in _minus_bore(uz[::-1] if cw else uz, hole, zc):      # cut counter-clockwise,
                    pts = [f.pt(*_on_face(q, u, z)) for u, z in piece]
                    f.poly(pts[::-1] if cw else pts, mat, flip=True)            # drawn in the face's own winding
                continue
            f.poly([A[i], A[j], B[j], B[i]], mat, flip=True)
    if cap0:
        f.poly(rings[0], cap0, flip=True)
    if cap1:
        f.poly(rings[-1][::-1], cap1, flip=True)


def patch(f, body, u0, u1, t0, t1, k, mat, n=9, steps=4):
    """A panel lying on the hull: the arc t0..t1 (degrees) of its round section, scaled by k, over u0..u1 (as
    shuttle_craft.patch, but on the hull's own circle, not the shuttle's rounded square)."""
    us = [u0 + (u1 - u0) * i / steps for i in range(steps + 1)]
    loft(f, [station(body, u, k) for u in us], profile(t0, t1, n, p=2.0), mat, closed=False, hole=BORE)


def strut(f, p0, p1, w, mat):
    """A square bar from p0 to p1 (u, v, z), w thick."""
    d = [b - a for a, b in zip(p0, p1)]
    n = math.sqrt(sum(x * x for x in d))
    d = [x / n for x in d]
    side = [-d[1], d[0], 0.0]
    sl = math.hypot(side[0], side[1]) or 1.0
    side = [x / sl for x in side]
    up = [d[1] * side[2] - d[2] * side[1], d[2] * side[0] - d[0] * side[2], d[0] * side[1] - d[1] * side[0]]
    lbox(f, lambda a, b, c: tuple((p0 if b < 0 else p1)[i] + side[i] * a * w / 2 + up[i] * c * w / 2 for i in range(3)),
         {"side": mat})


def body(fb):
    """The hull, in the body frame (u along the pod's +v): the two half-domes, and round their middle the DRUM, a cylinder
    a little bigger than them with flat dark sides, so it stands out of the domes by DRUM_R - R all round."""
    _g("hull")
    B = [(u, r, r, 0, C) for u, r in BALL]
    loft(fb, B, SECTION, HULL, cap0=HULL_D, hole=BORE)                      # (they run on through the drum)
    _g("panels")
    for (a, b), (t0, t1) in PANELS:
        for sg in (1, -1):
            panel(fb, B, *sorted((sg * a, sg * b)), t0, t1)
    _g("drum")
    D = [(BAND[0] + (BAND[1] - BAND[0]) * i / 24, DRUM_R, DRUM_R, 0, C) for i in range(25)]   # fine, for the bore
    loft(fb, D, profile(n=72, p=2.0), HULL, cap0="steelD", cap1="steelD", hole=BORE)   # the drum and its flat sides
    patch(fb, D, BAND[0], BAND[1], 200, 340, 1.006, HULL_D, n=41, steps=24)  # its shaded underside
    patch(fb, D, -0.28, 0.28, 235, 305, 1.012, "grime", n=5, steps=2)
    _g("plates")
    # One armour plate wraps the drum from the windshield's brow over the top and down the back (profile 0 = pod -u,
    # 90 = top, 180 = the nose), its stripes the whole way with it.
    t0, t1 = -55, 150
    patch(fb, D, BAND[0] + 0.04, BAND[1] - 0.04, t0, t1, 1.012, HULL_L, n=61, steps=22)
    patch(fb, D, -0.1, 0.1, t0, t1, 1.022, YEL, n=61, steps=5)
    for u0 in (BAND[0] + 0.05, BAND[1] - 0.15):
        patch(fb, D, u0, u0 + 0.1, t0, t1, 1.022, YEL_D, n=61, steps=3)


def panel(fb, body, u0, u1, t0, t1):
    """A maintenance panel: a curved plate lying on the hull over u0..u1 and the arc t0..t1 (degrees), a hair proud of
    it, with a dark seam round it and a fastener in each corner."""
    n = max(3, int((t1 - t0) / 5) + 2)
    patch(fb, body, u0 - 0.018, u1 + 0.018, t0 - 2.5, t1 + 2.5, 1.008, "steelD", n=n, steps=4)   # the seam
    patch(fb, body, u0, u1, t0, t1, 1.016, HULL, n=n, steps=4)                                     # the plate
    du, dt = 0.03, 4.0
    for uu in (u0 + du, u1 - du):                                            # its fasteners
        for tt in (t0 + dt, t1 - dt):
            patch(fb, body, uu - 0.013, uu + 0.013, tt - 1.6, tt + 1.6, 1.022, "steelL", n=2, steps=1)


# the domes' maintenance panels, (|u| range, arc), mirrored onto both domes: upper front, top, back and lower front,
# clear of the hatches, the arms' panels and the drum
PANELS = (((0.53, 0.72), (112, 152)), ((0.53, 0.72), (42, 96)), ((0.53, 0.72), (-42, 12)), ((0.53, 0.72), (206, 244)))


def hatch(fb):
    """An airlock door closing the body's +u end (in fb, the pod's +v or -v side), all in rings: a heavy frame ring, a
    thin yellow ring inside it, the red door with a seam ring, a hand wheel at its centre and a porthole above."""
    _g("hatch")
    u = BALL[-1][0]
    rf = HATCH_R + 0.12
    fb.hcyl(u - 0.04, u + 0.06, 0, C, rf, "steelD", sides=32, cap="steelD")              # the frame ring
    fb.hcyl(u + 0.06, u + 0.066, 0, C, HATCH_R + 0.04, "hazY", sides=32, cap="hazY")   # the yellow ring
    du = u + 0.086
    fb.hcyl(u + 0.066, du, 0, C, HATCH_R, "drK", sides=32, cap="drD")         # the door
    fb.hcyl(du, du + 0.006, 0, C, HATCH_R * 0.74, "drK", sides=32, cap="drD")  # its seam ring
    fb.hcyl(du + 0.006, du + 0.008, 0, C, HATCH_R * 0.74 - 0.03, "drD", sides=32, cap="drD")
    wz = C - 0.04                                                            # the hand wheel: a steel rim
    fb.hcyl(du, du + 0.03, 0, wz, 0.17, "steelD", sides=20, cap="steelL")      # (a disc, the door showing through)
    fb.hcyl(du + 0.03, du + 0.032, 0, wz, 0.13, "drD", sides=20, cap="drD")
    fb.box(du + 0.04, 0, wz, 0.02, 0.28, 0.035, "steelL", base=False)          # two spokes
    fb.box(du + 0.04, 0, wz, 0.02, 0.035, 0.28, "steelL", base=False)
    fb.hcyl(du + 0.03, du + 0.06, 0, wz, 0.045, "steelD", sides=12, cap="steelL")    # a hub
    fb.hcyl(du, du + 0.012, 0, C + 0.27, 0.075, "steelD", sides=16, cap="glassD")   # porthole


def windshield(f):
    """The reference's windshield: a chunky box jutting out of the nose, its raked face a thick frame round a big upper pane
    over a smaller lower one, dark glass with a lit bezel and one reflection, a yellow brow on top."""
    _g("windshield")
    u0, u1, hw = WIND
    zb, zt, rake = WIND_ZB, C + 0.4, 0.3

    def frame(a, b, d):
        return (u0 if b < 0 else (u1 - (rake if d > 0 else 0.0)), a * hw, zt if d > 0 else zb)
    lbox(f, frame, {"side": HULL_D, "top": HULL})

    def p(a, z, eps):                                                        # a point on the raked face
        return f.pt(u1 - rake * (z - zb) / (zt - zb) + eps, a, z)

    def pane(z0, z1, inset, col, eps):
        f.poly([p(-hw + inset, z0, eps), p(hw - inset, z0, eps), p(hw - inset, z1, eps), p(-hw + inset, z1, eps)], col,
               flip=True)
    zm = C - 0.08                                                            # the bar between the panes
    for z0, z1 in ((zm + 0.04, zt - 0.07), (zb + 0.07, zm - 0.04)):
        pane(z0 - 0.025, z1 + 0.025, 0.045, HULL_L, 0.003)                   # the lit bezel
        pane(z0, z1, 0.07, "glassD", 0.006)
    pane(zt - 0.2, zt - 0.16, 0.07, "lens", 0.009)                           # a reflection across the upper pane
    pane(zt - 0.26, zt - 0.245, 0.07, "lens", 0.009)
    ub = u1 - rake + 0.03                                                    # the yellow brow, just past the glass
    f.box((u0 + ub) / 2, 0, zt, ub - u0, 2 * hw + 0.04, 0.035, YEL)


def ring(f, u, z, r0, r1, mat, sides=24):
    """A flat annulus across u (facing -u) between radii r0 and r1, centred on the axis at height z."""
    for i in range(sides):
        a, b = i * math.tau / sides, (i + 1) * math.tau / sides
        f.poly([f.pt(u, r0 * math.cos(a), z + r0 * math.sin(a)), f.pt(u, r1 * math.cos(a), z + r1 * math.sin(a)),
                f.pt(u, r1 * math.cos(b), z + r1 * math.sin(b)), f.pt(u, r0 * math.cos(b), z + r0 * math.sin(b))],
               mat, flip=True)


def rear_thruster(f, lit):
    """A wide thruster in a bore cut into the drum's back, its cone running out past the hull: the bore's wall (the hull
    is cut along the same polygon, so the two meet exactly) and floor, a collar, a flared bell with a lip ring, its inner
    wall running in to a throat plate with the injector at its centre. Lit, the inner wall and the injector burn."""
    _g("rear")
    z, rt, rm = REAR
    rim = [(_bore_corner(i, BORE, z), math.sqrt(max((DRUM_R * 1.012) ** 2 - (_bore_corner(i, BORE, z)[1] - z) ** 2, 0.0)))
           for i in range(BORE_N)]
    for i in range(BORE_N):                                                  # the bore's wall, floor to hull
        (pa, va), (pb, vb) = rim[i], rim[(i + 1) % BORE_N]
        f.poly([f.pt(-BORE_FLOOR, pa[0], pa[1]), f.pt(-BORE_FLOOR, pb[0], pb[1]), f.pt(-vb, pb[0], pb[1]),
                f.pt(-va, pa[0], pa[1])], "steelD", flip=True)
    ring(f, -BORE_FLOOR, z, 0.0, BORE, "dark", sides=BORE_N)                 # its floor
    ub = -BORE_FLOOR
    ut, um = ub - 0.14, ub - 0.52                                            # throat, mouth (out past the hull)
    f.hcyl(ub, ut, 0, z, rt + 0.04, "steelD", sides=24)                       # collar
    f.hcyl(ut, um, 0, z, rt, HULL_D, r1=rm, sides=24)                         # the bell, outside
    ring(f, um, z, rm - 0.035, rm, "steelL")                                 # its lip
    f.hcyl(um, ut, 0, z, rm - 0.035, GLOW if lit else "dark", r1=rt - 0.04, sides=24)   # the inner wall (facing in)
    ring(f, ut, z, 0.0, rt - 0.04, "steelD")                                 # the throat plate
    f.hcyl(ut, ut - 0.03, 0, z, 0.12, "steelD", sides=12, cap="arc" if lit else "dark")   # the injector


def pin(f, c, r, w, mat, sides=12):
    """A round pivot: a short cylinder across v (the pod's side to side), centred at c."""
    pts = [[f.pt(c[0] + r * math.cos(i * math.tau / sides), c[1] + s * w / 2, c[2] + r * math.sin(i * math.tau / sides))
            for i in range(sides)] for s in (-1, 1)]
    for i in range(sides):
        j = (i + 1) % sides
        f.poly([pts[0][i], pts[0][j], pts[1][j], pts[1][i]], mat, flip=True)
    f.poly(pts[0][::-1], mat, flip=True)
    f.poly(pts[1], mat, flip=True)


def obox(f, c, n, a, w, h, th, mat):
    """A box centred at c (u, v, z) square to the unit normal n: w across a (a unit vector square to n), h along n x a,
    th thick along n."""
    b = (n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0])
    lbox(f, lambda i, j, k: tuple(c[q] + a[q] * i * w / 2 + b[q] * j * h / 2 + n[q] * k * th / 2 for q in range(3)),
         {"side": mat, "top": mat})


def _add(p, *terms):
    """p plus the sums of (scale, vector) terms."""
    return tuple(p[q] + sum(k * v[q] for k, v in terms) for q in range(3))


def arms(f, out):
    """Two grab arms either side of the windshield, each behind a hatch panel set square into the front of its dome.
    Stowed, the panels are shut; mining, the doors stand open on their top hinges and the arms reach forward, down and
    in toward the laser's mark: a shoulder, an upper arm with its piston, a forearm and a four-fingered claw."""
    _g("arms")
    av, az = ARM_AT
    for sv in (-1, 1):
        dv, dz = av - DOME_C, az - C
        du = math.sqrt(R * R - dv * dv - dz * dz)
        P = (du, sv * av, az)                                                # on the dome's surface
        n = (du / R, sv * dv / R, dz / R)                                    # its outward normal
        al = math.hypot(n[0], n[1])
        a = (-n[1] / al, n[0] / al, 0.0)                                     # across the panel, level
        up = (n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0])
        if up[2] < 0:
            up = tuple(-x for x in up)
        obox(f, _add(P, (0.01, n)), n, a, 0.3, 0.34, 0.05, HULL_D)            # the panel's frame
        if not out:
            obox(f, _add(P, (0.035, n)), n, a, 0.24, 0.28, 0.02, HULL_L)        # the door, shut
            obox(f, _add(P, (0.05, n), (0.1, up)), n, a, 0.24, 0.04, 0.01, YEL)
            continue
        obox(f, _add(P, (0.035, n)), n, a, 0.24, 0.28, 0.02, "dark")            # the opening
        h = _add(P, (0.04, n), (0.14, up))                                   # the door on its top hinge, swung out
        d = _add(h, (0.24, n), (0.08, up))
        lbox(f, lambda i, j, k, h=h, d=d, a=a: tuple((h if j < 0 else d)[q] + a[q] * i * 0.12 + (0, 0, 1)[q] * k * 0.012
                                                        for q in range(3)), {"side": HULL_L, "top": HULL_L})
        S = _add(P, (0.06, n))                                               # shoulder; the upper arm angles down,
        E = _add(S, (0.12, (1, 0, 0)), (-sv * 0.03, (0, 1, 0)), (-0.32, (0, 0, 1)))   # the forearm runs level
        W = _add(E, (0.32, (1, 0, 0)), (-sv * 0.05, (0, 1, 0)))
        strut(f, S, E, 0.09, HULL_D)
        strut(f, E, W, 0.08, HULL_D)
        strut(f, _add(S, (0.06, (1, 0, 0)), (0.02, (0, 0, 1))), _add(E, (0.1, (1, 0, 0)), (0.03, (0, 0, 1))), 0.035, YEL)   # piston
        for p_, r in ((S, 0.075), (E, 0.065), (W, 0.055)):
            pin(f, p_, r, 0.13, "steelL")                                    # round pivots
        pin(f, _add(W, (0.04, (1, 0, 0))), 0.07, 0.15, "steelD")             # the claw's palm
        for k in range(4):                                                   # four fingers round the wrist, open wide:
            a = k * math.tau / 4 + math.pi / 4                               # splayed out, the tips turned forward
            ca, sa = math.cos(a), math.sin(a)
            base = _add(W, (0.06, (1, 0, 0)), (0.05 * ca, (0, 1, 0)), (0.05 * sa, (0, 0, 1)))
            knuckle = _add(W, (0.17, (1, 0, 0)), (0.17 * ca, (0, 1, 0)), (0.17 * sa, (0, 0, 1)))
            tip = _add(W, (0.3, (1, 0, 0)), (0.19 * ca, (0, 1, 0)), (0.19 * sa, (0, 0, 1)))
            strut(f, base, knuckle, 0.05, "steelD")
            strut(f, knuckle, tip, 0.042, "steelL")


def lights(f, on):
    """Two round spotlights on the windshield's top corners, aimed forward, their lenses glowing warm white."""
    _g("lights")
    u0, u1, hw = WIND
    zt, rake = C + 0.4, 0.3
    ub = u1 - rake
    for sv in (-1, 1):
        v = sv * (hw - 0.06)
        f.box(ub - 0.1, v, zt + 0.035, 0.14, 0.12, 0.05, "steelD")              # its bracket on the brow
        f.hcyl(ub - 0.2, ub + 0.04, v, zt + 0.15, 0.085, "steelD", sides=12)    # the can
        f.hcyl(ub + 0.04, ub + 0.06, v, zt + 0.15, 0.1, YEL, sides=12, cap="flameW" if on else "steelL")   # bezel, lens


def thruster(f, lit):
    """The big main thruster under the body: a housing, a flared bell with gimbal struts, a lip lit in flight."""
    _g("thruster")
    zm, rm, rt = BELL
    zh = C - 0.72
    f.vcyl(0, 0, zm + 0.2, rt + 0.1, zh - zm - 0.2, HULL_D, top=HULL_D, sides=20)
    f.vcyl(0, 0, zm + 0.17, rt + 0.13, 0.05, "steelD", top="steelD", sides=20)
    f.vcyl(0, 0, zm, rm, 0.2, "steelD", top="steelD", rtop=rt, sides=20)
    f.vcyl(0, 0, zm, rm + 0.01, 0.03, GLOW if lit else "steel", top=GLOW if lit else "steel", sides=20)
    for k in range(4):
        a = k * math.tau / 4 + math.pi / 4
        strut(f, ((rt + 0.12) * math.cos(a), (rt + 0.12) * math.sin(a), zm + 0.22),
              ((rt - 0.02) * math.cos(a), (rt - 0.02) * math.sin(a), zm + 0.1), 0.04, "steelL")


def laser(f, down, lit):
    """The mining laser in a gimbal hung from the windshield's flat underside: a turntable, a yoke of two arms and the
    laser between them on a trunnion, angled down when stowed, further down when mining. A big gun: a yellow breech,
    a ribbed barrel and a flared emitter."""
    _g("laser")
    f.vcyl(LASER_U, 0, WIND_ZB - 0.06, 0.17, 0.06, HULL_D, top=HULL_D, sides=16)      # turntable
    f.vcyl(LASER_U, 0, WIND_ZB - 0.09, 0.12, 0.03, "steelD", top="steelD", sides=16)
    for sv in (-1, 1):                                                       # the yoke's arms
        f.box(LASER_U, sv * 0.165, LASER_Z - 0.08, 0.2, 0.05, WIND_ZB - 0.09 - LASER_Z + 0.08, HULL_D, top=HULL)
        f.hcyl(LASER_U - 0.07, LASER_U + 0.07, sv * 0.195, LASER_Z, 0.06, YEL_D, sides=10, cap="steelL", capstart="steelL")
    kw = dict(pitch=math.radians(-60 if down else -38), pu=LASER_U, pz=LASER_Z)     # stowed: angled down, clear
    f.box(LASER_U - 0.05, 0, LASER_Z, 0.3, 0.26, 0.24, YEL, top=YEL, base=False, **kw)        # breech
    f.box(LASER_U - 0.05, 0, LASER_Z + 0.125, 0.22, 0.14, 0.012, "hazK", base=False, **kw)
    f.hcyl(LASER_U + 0.1, LASER_U + 0.62, 0, LASER_Z, 0.1, "steel", r1=0.085, sides=12, **kw)   # barrel
    for k in range(4):                                                       # cooling rings
        uk = LASER_U + 0.18 + k * 0.08
        f.hcyl(uk, uk + 0.035, 0, LASER_Z, 0.125, "steelD", sides=12, cap="steelD", capstart="steelD", **kw)
    f.hcyl(LASER_U + 0.62, LASER_U + 0.72, 0, LASER_Z, 0.09, "steelD", r1=0.13, sides=12, **kw)   # flared emitter
    f.hcyl(LASER_U + 0.7, LASER_U + 0.71, 0, LASER_Z, 0.1, "dark", sides=12, cap=BEAM if lit else "dark", **kw)


def greeble(f):
    _g("greeble")
    f.vcyl(-0.45, 0, C + 0.8, 0.022, 0.3, "steelL", sides=6)               # antenna, on the centre line aft
    f.box(-0.45, 0, C + 1.1, 0.05, 0.05, 0.04, "red")


def pod(heading, state="parked", bob=0.0, dz=0.0):
    """state: parked / docked, fly or mine."""
    m = core.Mesh(f"mining_pod_{state}")
    m.dz = dz + (0.0 if state in ("parked", "docked") else 0.35 + bob)
    f, fb = Spin(m, heading), Spin(m, heading + math.pi / 2)
    body(fb)
    hatch(fb)
    hatch(Spin(m, heading - math.pi / 2))                                    # the same hatch on the other end
    windshield(f)
    thruster(f, state in ("fly", "mine"))
    rear_thruster(f, state in ("fly", "mine"))
    laser(f, state == "mine", state == "mine")
    arms(f, state == "mine")
    lights(f, state in ("fly", "mine"))
    greeble(f)
    return [smooth(m.build())]
