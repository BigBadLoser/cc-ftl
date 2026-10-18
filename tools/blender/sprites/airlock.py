"""Airlock (module.airlock): 3 wide along the hull, on the hull row plus 2 rows inboard (hullEdge n, rotates with the
module like the engine), with a docking collar on the tile beyond the hull.

Module frame (cmbkit.Frame, footprint centre at u = v = 0): u points outward through the hull (r0 north, r1 east,
r2 south, r3 west), v along the hull. Tile roles:
  u = 1   (hull row)  v = 0: the armoured pass-through block, set into the hull wall; v = +-1: plain hull (not ours)
  u = 0               v = 0: the door pod (tall inner door, keypads, cycle light strip); v = +-1: cargo unloaders
  u = -1  (keep-out)  v = -1..1: hazard-edged deck marking, walkable
  u = 2   (outside)   the docking collar, its round iris hatch (the outer door) at its mouth

Proportions follow the Space Haven reference (measured on its 46 px tile): a rounded capsule pod filling its tile,
about 1.7 tall, the door frame taking most of its face; a lower faceted armour block through the hull; a collar of
two big ring flanges about 1.7 across; unloaders low at the front rising to a cowl at the back. White-grey armour,
orange on the angled plates. The pod and block are never cut in any wall view level; the hull wall either side of
the block (production profile, walls.py) and over it follows the level like any hull.

Sprites, per rotation r (each anchored at its own tile so the renderer sorts it by that tile; footprint [1, 1]):
  module.airlock.housing.r<r>.<closed|f1|f2|open>     the door pod and inner door (opening frames f1, f2)
  module.airlock.hull.r<r>.<up|cut|low>               hull row: the armour block, with the hull wall beside and over it
                                                      at the wall view level
  module.airlock.light.r<r>.<red|green>               the cycle light: lit strip on top and the keypad lamps
  module.airlock.collar.r<r>.<closed|f1|f2|open>[.docked]
                                                      collar and iris hatch (sort by the tile beyond the hull row);
                                                      docked: clamps swung onto the shuttle hatch, seal light green
  module.airlock.unloader.r<r>                        a cargo unloader (the same sprite on both side tiles)
  module.airlock.keepout.r<r>.<l|m|r>                 keep-out deck marking on the tiles at v = -1, 0, 1
The collar runs from the block's outer end (the hull row's outer edge) to its mating face (where a shuttle's hatch
meets it) at COLLAR_END, the far edge of the tile beyond the hull: 1 tile long in every rotation."""
import math

from . import core, env_build, post
from . import walls as W
from .cmbkit import Frame
from .console_proto import centre

ID = "module.airlock"
DOORS = (("closed", 0.0), ("f1", 0.35), ("f2", 0.7), ("open", 1.0))
HULL_U, COLLAR_END = 1.0, 2.5
UI, UB = -0.42, 0.5                # pod: inboard face, back (against the armour)
PW, PH, RC, RT = 0.47, 1.55, 0.17, 0.09   # pod half width, height, corner radius, top edge round-off
DW, DH = 0.3, 1.42                 # inner door half width, height
# the outer armour, stepping down from over the pod to the hatch housing: (u0, u1, half width, height, chamfer)
TIERS = ((0.5, 1.2, 0.44, 1.7, 0.3), (1.2, 1.9, 0.48, 1.42, 0.3), (1.9, 2.5, 0.53, 1.18, 0.34))
ZC, RH, RR = 0.6, 0.4, 0.52        # hatch axis height, hatch radius, hatch ring outer radius
POD, POD_T, POD_K, TRIM = "hbD", "hbM", "hbK", "drK"
ARM, ARM_T, ARM_D = "plate", "gW1", "gW2"
ORANGE, LUG = "hivis", "drD"
HULL, HULL_T = "bM", "bL"
TINY = 0.004


def frame(m, rot):
    return Frame(m, rot, centre=centre(rot, 3, 3))


def strip(rot):
    """(inner, outer) u of the production hull strip on the hull row (walls.Strip puts it at the tile's -x / -y edge:
    the outer edge for a north / west hull, the inner edge for an east / south one)."""
    t = (math.floor(W.hull_thick() * W.GN - 0.5) + 1) / W.GN
    return (HULL_U - 0.5, HULL_U - 0.5 + t) if rot in (1, 2) else (HULL_U + 0.5 - t, HULL_U + 0.5)


def prism(f, shape, a, b, mat, top):
    """Extrude a u/z outline (clockwise) across v in [a, b] (both end faces)."""
    n = len(shape)
    A = [f.pt(u, a, z) for u, z in shape]
    B = [f.pt(u, b, z) for u, z in shape]
    f.poly(A, mat, flip=True)
    f.poly(B[::-1], mat, flip=True)
    for i in range(n):
        j = (i + 1) % n
        f.poly([A[i], B[i], B[j], A[j]], top if shape[j][0] > shape[i][0] else mat, flip=True)


def _face(f, pts, ref, color):
    """A polygon of (u, v, z) points wound to face away from the point ref."""
    from mathutils import Vector
    P = [Vector(f.pt(*q)) for q in pts]
    n = (P[1] - P[0]).cross(P[2] - P[0])
    c = sum(P, Vector()) / len(P)
    if n.dot(c - Vector(f.pt(*ref))) < 0:
        P = P[::-1]
    f.poly(P, color, flip=False)


def _tube(f, u0, u1, sec, col, top=None, cap=None, start=True):
    """Extrude a convex (v, z) section along u from u0 to u1. cap colours the end at u1 (None: open); start closes the
    end at u0 too."""
    vc = sum(v for v, _ in sec) / len(sec)
    zc = sum(z for _, z in sec) / len(sec)
    mid = ((u0 + u1) / 2, vc, zc)
    n = len(sec)
    for i in range(n):
        (va, za), (vb, zb) = sec[i], sec[(i + 1) % n]
        up = (zb + za) / 2 > zc and abs(zb - za) < 0.5 * abs(vb - va) + 1e-6
        _face(f, [(u0, va, za), (u1, va, za), (u1, vb, zb), (u0, vb, zb)], mid, (top or col) if up else col)
    if cap:
        _face(f, [(u1, v, z) for v, z in sec], (u0, vc, zc), cap)
    if start:
        _face(f, [(u0, v, z) for v, z in sec], (u1, vc, zc), col)


def _loft(f, rings, col, top, edge=None, trim=(), trim_col=None):
    """A convex solid through horizontal (u, v) rings [(points, z), ...] of equal length: sides in col (the last band,
    the round-off at the top, in edge; the side faces after the points listed in trim in trim_col), the top cap in
    top."""
    pts = [(u, v, z) for ring, z in rings for u, v in ring]
    ref = tuple(sum(p[i] for p in pts) / len(pts) for i in range(3))
    for k in range(len(rings) - 1):
        (ra, za), (rb, zb) = rings[k], rings[k + 1]
        for i in range(len(ra)):
            j = (i + 1) % len(ra)
            c = trim_col if i in trim else (edge or col) if k == len(rings) - 2 else col
            _face(f, [(*ra[i], za), (*ra[j], za), (*rb[j], zb), (*rb[i], zb)], ref, c)
    _face(f, [(u, v, rings[0][1]) for u, v in rings[0][0]], ref, col)
    _face(f, [(u, v, rings[-1][1]) for u, v in rings[-1][0]], ref, top)


def _rrect(u0, u1, v0, v1, r, n=3):
    """Counter-clockwise (u, v) rectangle with corner radii r = (r00, r10, r11, r01) at (u0,v0), (u1,v0), (u1,v1),
    (u0,v1); each corner gets n + 1 points so rings of different radii loft together."""
    out = []
    for (cu, cv, su, sv, a0), rad in zip(((u0, v0, -1, -1, 180), (u1, v0, 1, -1, 270), (u1, v1, 1, 1, 0),
                                          (u0, v1, -1, 1, 90)), r):
        rad = max(rad, TINY)
        ou, ov = cu - su * rad, cv - sv * rad
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            out.append((ou + rad * math.cos(a), ov + rad * math.sin(a)))
    return out


# ---- the door pod -------------------------------------------------------------------------------------------------

def _arcs(corners, n=3):
    """Side-face indices of a _rrect ring lying on its rounded corners (each corner's n arc segments)."""
    return {c * (n + 1) + k for c in corners for k in range(n)}


def _pod(f):
    """Two rounded columns and a lintel: a slate capsule with the door opening through it, its rounded vertical edges
    and top round-off in the maroon trim."""
    for s in (-1, 1):
        v0, v1 = (DW, PW) if s > 0 else (-PW, -DW)
        r = (TINY, TINY, RC, RC) if s > 0 else (RC, RC, TINY, TINY)
        ri = tuple(max(x - RT, TINY) for x in r)
        lo = _rrect(UI, UB, v0, v1, r)
        hi = _rrect(UI + RT, UB - RT, v0 if s > 0 else v0 + RT, v1 - RT if s > 0 else v1, ri)
        _loft(f, [(lo, 0.0), (lo, PH - RT), (hi, PH)], POD, POD_T, TRIM,
              trim=_arcs((2, 3) if s > 0 else (0, 1)), trim_col=TRIM)
    lo = _rrect(UI, UB, -DW, DW, (TINY,) * 4)
    hi = _rrect(UI + RT, UB - RT, -DW, DW, (TINY,) * 4)
    _loft(f, [(lo, DH), (lo, PH - RT), (hi, PH)], POD, POD_T, TRIM)
    for s in (-1, 1):
        f.box((UI + UB) / 2 + 0.02, s * (DW - 0.01), 0, UB - UI - 0.04, 0.02, DH, "dark", top="dark")   # liner
    f.box((UI + UB) / 2 + 0.02, 0, DH - 0.02, UB - UI - 0.04, 2 * DW, 0.02, "dark", top="dark")


def _arch(vh, zt, r, n=4):
    """(v, z) path up the left side, over a round-cornered top, down the right: an arch of half width vh, top zt."""
    p = [(-vh, 0.0)]
    for k in range(n + 1):
        a = math.radians(180 - 90 * k / n)
        p.append((-vh + r + r * math.cos(a), zt - r + r * math.sin(a)))
    for k in range(n + 1):
        a = math.radians(90 - 90 * k / n)
        p.append((vh - r + r * math.cos(a), zt - r + r * math.sin(a)))
    p.append((vh, 0.0))
    return p


def _door_frame(f):
    """The thick round-cornered frame filling most of the pod face (a dark outline, then a pod-colour band), with
    gussets filling the opening's top corners."""
    for (vo, zo, ro), (vi, zi, ri), col in (((DW + 0.13, DH + 0.09, 0.2), (DW + 0.1, DH + 0.06, 0.18), POD_K),
                                            ((DW + 0.1, DH + 0.06, 0.18), (DW, DH, 0.12), POD_T)):
        outer, inner = _arch(vo, zo, ro), _arch(vi, zi, ri)
        for i in range(len(outer) - 1):
            _tube(f, UI - 0.03, UI + 0.01, [outer[i], outer[i + 1], inner[i + 1], inner[i]], col, col, cap=col)
    inner = _arch(DW, DH, 0.12)
    for s, arc in ((-1, inner[1:6]), (1, inner[6:11])):
        for a, b in zip(arc, arc[1:]):
            _tube(f, UI - 0.01, UI + 0.08, [(s * DW, DH), a, b], POD_T, POD_T, cap=POD_T)


def _leaves(f, uc, p):
    """Two leaves meeting in the middle, a curved seam and rivets on each; p = how far open (0..1), sliding into the
    columns."""
    if p >= 1.0:
        return
    w = DW * (1 - p)
    for s in (-1, 1):
        vc = s * (DW - w / 2)
        f.box(uc, vc, 0, 0.06, w, DH, POD, top=POD)
        if w > 0.1:
            f.box(uc - 0.032, vc, 0.62, 0.006, w * 0.8, 0.035, POD_K, top=POD_K)                     # seam
            f.box(uc - 0.032, vc - s * w * 0.15, 0.62, 0.006, 0.035, 0.36, POD_K, top=POD_K)
            f.box(uc - 0.034, vc, 1.08, 0.006, w * 0.5, 0.12, POD_K, top=POD_K)                      # slot
            for z in (0.2, 1.28):                                                                # rivets
                f.box(uc - 0.034, vc + s * w * 0.2, z, 0.006, 0.035, 0.035, POD_T, top=POD_T)
        f.box(uc - 0.02, s * (DW - w) + s * 0.012, 0.03, 0.045, 0.024, DH - 0.06, POD_K, top=POD_K)   # edge


def housing(rot, p):
    m = core.Mesh(f"airlock_housing_{rot}")
    f = frame(m, rot)
    _pod(f)
    _door_frame(f)
    for s in (-1, 1):                                                                            # keypads
        f.box(UI + 0.4, s * (PW + 0.006), 0.82, 0.26, 0.012, 0.36, POD_K, top=POD_K)
        f.box(UI + 0.4, s * (PW + 0.01), 0.86, 0.18, 0.008, 0.26, "dark", top="dark")
        f.box(UI + 0.4, s * (PW + 0.012), 0.66, 0.2, 0.006, 0.05, POD_K, top=POD_K)                 # slot below
    f.box(UI + 0.22, 0, PH, 0.1, 0.5, 0.012, POD_K, top=POD_K)                                     # light channel
    uc = UI + 0.1
    for k in range(6):                                                                           # hazard threshold
        c = "hazY" if k % 2 else "hazK"
        f.box(uc - 0.06, -DW + (k + 0.5) * (2 * DW / 6), 0, 0.12, 2 * DW / 6, 0.012, c, top=c)
    _leaves(f, uc, p)
    return [m.build()]


def lights(rot, color):
    m = core.Mesh(f"airlock_light_{rot}")
    f = frame(m, rot)
    f.box(UI + 0.22, 0, PH + 0.01, 0.07, 0.44, 0.02, color, top=color)                            # lit strip
    for s in (-1, 1):                                                                            # keypad bars
        for k in range(4):
            c = "orange" if k else color
            f.box(UI + 0.34 + (k % 2) * 0.1, s * (PW + 0.016), 0.9 + (k // 2) * 0.1, 0.07, 0.004, 0.035, c, top=c)
    return [m.build()]


# ---- the outer armour: hull row and collar ------------------------------------------------------------------------

def _tsec(w, h, c):
    return [(-w, 0), (w, 0), (w, h - c), (w - c * 0.75, h), (-w + c * 0.75, h), (-w, h - c)]


def _facet(f, w, h, c, s, u0, u1, a, b, col):
    """A plate on the s side's top chamfer of a tier, between fractions a..b of the facet."""
    p, q = (s * w, h - c), (s * (w - c * 0.75), h)
    dv, dz = q[0] - p[0], q[1] - p[1]
    ln = math.hypot(dv, dz)
    nv, nz = s * dz / ln * 0.016, abs(dv) / ln * 0.016
    p0, p1 = (p[0] + dv * a, p[1] + dz * a), (p[0] + dv * b, p[1] + dz * b)
    _tube(f, u0, u1, [p0, p1, (p1[0] + nv, p1[1] + nz), (p0[0] + nv, p0[1] + nz)], col, col, cap=col)


def _armour(f, lo, hi):
    """The stepped tiers of outer armour clipped to lo <= u <= hi: faceted grey, orange plates on the angled facets,
    a top plate, rib bands at the steps, and (on the top tier's sides) the dark chamber machinery behind a recess."""
    for k, (u0, u1, w, h, c) in enumerate(TIERS):
        a, b = max(u0, lo), min(u1, hi)
        if a >= b:
            continue
        _tube(f, a, b, _tsec(w, h, c), ARM, ARM_T, cap=ARM)
        if lo <= u0 + 0.04 <= hi and k:
            _tube(f, u0, u0 + 0.06, [(v * 1.03, z * 1.015) for v, z in _tsec(w, h, c)], ARM_D, ARM_T, cap=ARM_D)
        for s in (-1, 1):
            for fa, fb, ua, ub, col in ((0.1, 0.55, u0 + 0.12, u0 + 0.3, ORANGE), (0.1, 0.9, u0 + 0.38, u1 - 0.12, ARM_T)):
                ua, ub = max(ua, a), min(ub, b)
                if ua < ub:
                    _facet(f, w, h, c, s, ua, ub, fa, fb, col)
            if k == 0:                                                                           # machinery recess
                ua, ub = max(u0 + 0.08, a), min(u1 - 0.08, b)
                if ua < ub:
                    f.box((ua + ub) / 2, s * (w + 0.004), 0.12, ub - ua, 0.01, 1.0, "dark", top="dark")
                    for z, hgt in ((0.3, 0.07), (0.62, 0.05), (0.85, 0.09)):
                        f.box((ua + ub) / 2, s * (w + 0.012), z, ub - ua - 0.06, 0.012, hgt, "steel", top="steelL")
                    f.box(ua + 0.12, s * (w + 0.014), 0.2, 0.06, 0.014, 0.8, "steel", top="steelL")
            else:
                f.box((a + b) / 2, s * (w + 0.005), 0.5, b - a - 0.04, 0.01, 0.04, ARM_D, top=ARM_D)   # seam
        tp = (max(u0 + 0.12, a), min(u1 - 0.12, b))
        if tp[0] < tp[1]:
            f.box(sum(tp) / 2, 0, h, tp[1] - tp[0], 2 * (w - c * 0.75) - 0.16, 0.015, ARM_T, top=ARM_T)   # top plate


def hull(rot, level):
    """The hull row: the outer armour's inboard tiers through the hull. Beside and over them, the hull wall on the
    production profile (strip, sloped skirt, 2.05 top) as the level shows the plain hull either side: full on a far
    (north / west) hull in up and cut, else the ghost rim."""
    m = core.Mesh(f"airlock_hull_{rot}_{level}")
    f = frame(m, rot)
    _armour(f, HULL_U - 0.5, HULL_U + 0.5)
    inner, outer = strip(rot)
    w = max(t[2] for t in TIERS[:2])
    if rot in (0, 3) and level != "low":
        zs, run, top = W.skirt_top(), W.skirt_run(), W.hull_top()
        edge = HULL_U - 0.5
        ze = max(0.0, zs * (1 - (inner - edge) / run))
        shape = [(edge, 0), (edge, ze), (inner, zs), (inner, top), (outer, top), (outer, 0)]
        zw = next(t[3] - t[4] for t in TIERS if t[0] <= inner < t[1]) - 0.02
        prism(f, [(inner, zw), (inner, top), (outer, top), (outer, zw)], -w, w, HULL, HULL_T)          # wall over it
    else:
        shape = [(inner, 0), (inner, W.ZG), (outer, W.ZG), (outer, 0)]
    for a, b in ((-0.5, -w), (w, 0.5)):
        prism(f, shape, a, b, HULL, HULL_T)
    return [m.build()]


def _sector(r0, r1, a0, a1, tw=0.0):
    """(v, z) quad of an annular sector about the hatch axis; tw rotates the inner edge (iris blades)."""
    if r0 <= 1e-4:
        return [(0.0, ZC), (r1 * math.cos(a0), ZC + r1 * math.sin(a0)), (r1 * math.cos(a1), ZC + r1 * math.sin(a1))]
    return [(r1 * math.cos(a0), ZC + r1 * math.sin(a0)), (r1 * math.cos(a1), ZC + r1 * math.sin(a1)),
            (r0 * math.cos(a1 + tw), ZC + r0 * math.sin(a1 + tw)), (r0 * math.cos(a0 + tw), ZC + r0 * math.sin(a0 + tw))]


def _ray(sec, a):
    """Distance from the hatch axis to the convex section's boundary at angle a."""
    dv, dz = math.cos(a), math.sin(a)
    best = 9.0
    for (v0, z0), (v1, z1) in zip(sec, sec[1:] + sec[:1]):
        ev, ez = v1 - v0, z1 - z0
        den = dv * ez - dz * ev
        if abs(den) < 1e-9:
            continue
        t = ((v0) * ez - (z0 - ZC) * ev) / den
        s = ((v0) * dz - (z0 - ZC) * dv) / den
        if t > 0 and -1e-6 <= s <= 1 + 1e-6:
            best = min(best, t)
    return best


def collar(rot, p, docked):
    """The tiers beyond the hull and the hatch housing: a squarish chamfered block whose outer face holds the round
    hatch (the outer door; an iris, p = how far open) in a thick ring with four red locking lugs. Four clamps lie
    back round the ring, or swing forward onto a docked shuttle's hatch; the seal light on top of the housing is green
    when docked."""
    m = core.Mesh(f"airlock_collar_{rot}_{int(docked)}")
    f = frame(m, rot)
    ue = COLLAR_END
    u0, u1, w, h, c = TIERS[-1]
    _armour(f, HULL_U + 0.5, ue - 0.08)
    sec, n = _tsec(w, h, c), 24
    f.hcyl(ue - 0.079, ue - 0.074, 0, ZC, RH + 0.01, "dark", sides=16, cap="dark")                # behind the hatch
    for k in range(n):                                                                           # face plate
        a0, a1 = k * math.tau / n, (k + 1) * math.tau / n
        q = [(RR * math.cos(a0), ZC + RR * math.sin(a0)), (_ray(sec, a0) * math.cos(a0), ZC + _ray(sec, a0) * math.sin(a0)),
             (_ray(sec, a1) * math.cos(a1), ZC + _ray(sec, a1) * math.sin(a1)), (RR * math.cos(a1), ZC + RR * math.sin(a1))]
        _tube(f, ue - 0.08, ue - 0.03, q, ARM, ARM_T, cap=ARM)
    for k in range(16):                                                                          # hatch ring
        a0, a1 = k * math.tau / 16, (k + 1) * math.tau / 16
        _tube(f, ue - 0.08, ue + 0.02, _sector(RH, RR, a0, a1), ARM_D, ARM_T, cap="steelL")
    for k in range(4):                                                                           # locking lugs
        a = math.pi / 4 + k * math.pi / 2
        f.box(ue + 0.03, math.cos(a) * (RR - 0.06), ZC + math.sin(a) * (RR - 0.06), 0.03, 0.09, 0.09, LUG, top=LUG,
              base=False)
    if p < 1.0:                                                                                  # iris blades
        r0, tw = RH * p, 0.55 * p
        for k in range(6):
            a0, a1 = k * math.tau / 6 + 0.04, (k + 1) * math.tau / 6 - 0.04
            col = "gW2" if k % 2 else "steel"
            _tube(f, ue - 0.07, ue - 0.035, _sector(r0, RH + 0.01, a0, a1, tw), col, col, cap=col)
        if p == 0.0:
            f.hcyl(ue - 0.05, ue - 0.02, 0, ZC, 0.08, "steelD", sides=8, cap=LUG)                  # hub
    lamp = "green" if docked else "steelD"
    f.box(ue - 0.2, 0, h, 0.12, 0.14, 0.04, lamp, top=lamp)                                        # seal light
    for k in range(4):                                                                           # clamps
        a = k * math.pi / 2
        cv, cz = math.cos(a), math.sin(a)
        if docked:
            r = RR - 0.02
            f.box(ue + 0.06, cv * r, ZC + cz * r, 0.1, 0.09, 0.09, "steelD", top="steelD", base=False)
            f.box(ue + 0.12, cv * (r - 0.06), ZC + cz * (r - 0.06), 0.04, 0.08, 0.08, ORANGE, top=ORANGE, base=False)
        else:
            r = RR + 0.03
            f.box(ue - 0.02, cv * r, ZC + cz * r, 0.08, 0.07, 0.07, "steelD", top="steelD", base=False)
    return [m.build()]


# ---- inboard: unloaders and the keep-out deck ---------------------------------------------------------------------

def unloader(rot):
    """A cargo unloader at (u 0, v 1), laid along the hull: at its -v end a grille tower (dark grille facing the
    keep-out zone, a sloped visor with a hazard emblem), a low body with side vents, and at the +v end a lid box with
    a sloped top over a dark base strip. Both side tiles use the same sprite, the same way round."""
    m = core.Mesh(f"airlock_unloader_{rot}")
    f = frame(m, rot)
    vc = 1.0
    prism(f, [(-0.4, 0), (-0.4, 0.5), (-0.22, 0.78), (0.36, 0.78), (0.36, 0)], vc - 0.44, vc - 0.1, ARM, ARM_T)   # tower
    f.box(-0.405, vc - 0.27, 0.06, 0.012, 0.28, 0.4, "bD", top="bD")                                # grille
    for k in range(4):
        f.box(-0.412, vc - 0.27, 0.1 + k * 0.08, 0.006, 0.24, 0.03, "bK", top="bK")
    f.box(-0.31, vc - 0.27, 0.62, 0.1, 0.1, 0.03, "hazY", top="hazY", pitch=math.radians(-57), pu=-0.31, pz=0.64)
    prism(f, [(-0.32, 0), (-0.32, 0.4), (0.3, 0.46), (0.3, 0)], vc - 0.1, vc + 0.2, ARM, ARM_T)      # body
    for k in range(3):                                                                           # side vents
        f.box(-0.32 - 0.004, vc - 0.02 + k * 0.08, 0.14, 0.008, 0.04, 0.16, POD_K, top=POD_K)
    prism(f, [(-0.38, 0), (-0.38, 0.46), (0.38, 0.6), (0.38, 0)], vc + 0.2, vc + 0.44, ARM, ARM_T)   # lid box
    f.box(-0.385, vc + 0.32, 0.03, 0.012, 0.22, 0.08, "dark", top="dark")                           # base strip
    for k in range(2):
        f.box(-0.39, vc + 0.27 + k * 0.1, 0.25, 0.006, 0.05, 0.05, ARM_D, top=ARM_D)               # marks
    return [m.build()]


def keepout(rot, v):
    """The keep-out tile at (u -1, v): a dashed hazard border round the tile, inset from its edges. Paint on the deck
    (no plate)."""
    m = core.Mesh(f"airlock_keepout_{rot}_{v}")
    f = frame(m, rot)
    bw, z, n, ins = 0.07, 0.004, 6, 0.06
    lo, hi = -0.5 + ins, 0.5 - ins
    for side in range(4):
        for k in range(n):
            t = lo + (k + 0.5) * (hi - lo) / n
            c = "hazY" if k % 2 == 0 else "hazK"
            if side < 2:
                uu, vv = -1.0 + (lo + bw / 2 if side == 0 else hi - bw / 2), v + t
                f.box(uu, vv, 0, bw, (hi - lo) / n, z, c, top=c)
            else:
                uu, vv = -1.0 + t, v + (lo + bw / 2 if side == 2 else hi - bw / 2)
                f.box(uu, vv, 0, (hi - lo) / n, bw, z, c, top=c)
    return [m.build()]


# ---- sprites ------------------------------------------------------------------------------------------------------

def _item(sid, kind, objs, u, v, rot):
    """Render objs with the tile at (u, v) as the sprite origin."""
    x, y = frame(None, rot).xy(u, v)
    for o in objs:
        o.location = (o.location.x - x, o.location.y + y, o.location.z)
    it = env_build.crop_item(sid, (1, 1), *env_build.render_sprite(sid, kind, objs))
    return [it] if it else []


def items(rot):
    post.select(True)
    out = []

    def add(sid, kind, build, u, v=0.0):
        core.clear_scene_meshes()
        out.extend(_item(sid, kind, build(), u, v, rot))
    for name, p in DOORS:
        add(f"{ID}.housing.r{rot}.{name}", "block", lambda p=p: housing(rot, p), 0)
        for docked in (False, True):
            add(f"{ID}.collar.r{rot}.{name}" + (".docked" if docked else ""), "prop",
                lambda p=p, d=docked: collar(rot, p, d), HULL_U + 1)
    for lv in W.LEVELS:
        add(f"{ID}.hull.r{rot}.{lv}", "block", lambda lv=lv: hull(rot, lv), HULL_U)
    for col in ("red", "green"):
        add(f"{ID}.light.r{rot}.{col}", "fx", lambda c=col: lights(rot, c), 0)
    add(f"{ID}.unloader.r{rot}", "prop", lambda: unloader(rot), 0, 1)
    for name, v in (("l", -1), ("m", 0), ("r", 1)):
        add(f"{ID}.keepout.r{rot}.{name}", "block", lambda v=v: keepout(rot, v), -1, v)
    return out


def jobs():
    return [lambda r=r: items(r) for r in range(4)]
