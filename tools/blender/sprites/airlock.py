"""Airlock (module.airlock), built 1:1 to the Space Haven reference: 3 wide along the hull, the hull row plus 3 rows
inboard (hullEdge n, rotates with the module like the engine), and a docking collar beyond the hull.

Module frame (cmbkit.Frame, footprint centre at u = v = 0 on the pod's tile): u points outward through the hull
(r0 north, r1 east, r2 south, r3 west), v along the hull. Tile roles:
  u = 2               the docking collar: short ringed tube, the round iris hatch (the outer door) at its mouth
  u = 1   (hull row)  v = 0: the slate pass-through block with its cap slab, set into the hull; v = +-1: plain hull
  u = 0               v = 0: the pod (inner door facing inboard, windows on its sides); v = +-1: unloaders, back half
  u = -1              v = 0: walk zone (green corner marks); v = +-1: unloaders, front half (chute facing inboard)
  u = -2              v = 0: walk zone; v = +-1: keep-out (orange dashed square) in front of each chute

Measured on the reference (its tile about 165 px wide, the same 2:1 projection): the pod about 0.9 deep, a tile
wide, 1.45 tall, strongly rounded; the block a tile wide and about the pod's height under a 0.2 cap; the collar about
1.2 across on an axis about 0.95 up, its mouth 0.7 past the block; the unloaders about 1.9 long and 0.6 wide. Cream
bodies with red trim, slate block, grey collar with red bands. The pod and block are never cut in any wall view
level; the plain hull beside the block and over it follows the level like any hull.

Sprites, per rotation r (each anchored at its own tile so the renderer sorts it by that tile; footprint [1, 1]):
  module.airlock.housing.r<r>.<closed|f1|f2|open>     the pod and its inner door (opening frames f1, f2)
  module.airlock.hull.r<r>.<up|cut|low>               hull row: the block and cap, with the hull wall beside and over it
  module.airlock.light.r<r>.<red|green>               the cycle light in the slot on the pod's top
  module.airlock.collar.r<r>.<closed|f1|f2|open>[.docked]
                                                      collar and iris hatch (sort by the tile beyond the hull row);
                                                      docked: clamps on the shuttle hatch, seal light green
  module.airlock.unloader.r<r>.<back|front>           an unloader's two tiles (the same sprites on both sides)
  module.airlock.keepout.r<r>                         the dashed keep-out square in front of a chute
  module.airlock.walk.r<r>                            the walk zone's corner marks (both tiles in front of the pod)
The collar's mating face (where a shuttle's hatch meets it) is COLLAR_END, 0.7 past the hull row's outer edge."""
import math

from . import core, env_build, post
from . import walls as W
from .cmbkit import Frame
from .console_proto import centre

ID = "module.airlock"
DOORS = (("closed", 0.0), ("f1", 0.35), ("f2", 0.7), ("open", 1.0))
HULL_U, COLLAR_END = 1.0, 2.2
UI, UB = -0.42, 0.5                # pod: inboard face, back (against the block)
PW, PH, RC, RT = 0.46, 1.45, 0.2, 0.12    # pod half width, height, corner radius, top edge round-off
DW, DH = 0.25, 1.3                 # inner door half width, height
BW, BH, CAP = 0.46, 1.35, 0.2      # block half width, height, cap slab thickness
ZC, RH, RR = 0.95, 0.44, 0.62      # collar axis height, hatch radius, mouth ring outer radius
CREAM, CREAM_T, CREAM_D, CREAM_S = "lvW", "lvWL", "lvW2", "lvWS"
RED = "medRed"
SLATE, SLATE_T, SLATE_K, SLATE_L = "hbD", "hbM", "hbK", "hbL"
GREY, GREY_T = "plate", "gW1"
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


def _clip(shape, lo, hi):
    """Clip a convex u/z outline to lo <= u <= hi (order kept)."""
    for keep, edge in ((lambda u: u >= lo, lo), (lambda u: u <= hi, hi)):
        out = []
        for i, (u0, z0) in enumerate(shape):
            u1, z1 = shape[(i + 1) % len(shape)]
            if keep(u0):
                out.append((u0, z0))
            if keep(u0) != keep(u1):
                t = (edge - u0) / (u1 - u0)
                out.append((edge, z0 + t * (z1 - z0)))
        shape = out
        if not shape:
            break
    return shape


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


def _loft(f, rings, col, top, edge, red_all=(), red_top=()):
    """A convex solid through horizontal (u, v) rings [(points, z), ...] of equal length: sides in col, the last band
    (the round-off at the top) in edge, the top cap in top; side faces after the points in red_all are red in every
    band, those in red_top in the top band only."""
    pts = [(u, v, z) for ring, z in rings for u, v in ring]
    ref = tuple(sum(p[i] for p in pts) / len(pts) for i in range(3))
    for k in range(len(rings) - 1):
        (ra, za), (rb, zb) = rings[k], rings[k + 1]
        last = k == len(rings) - 2
        for i in range(len(ra)):
            j = (i + 1) % len(ra)
            c = RED if i in red_all or (last and i in red_top) else edge if last else col
            _face(f, [(*ra[i], za), (*ra[j], za), (*rb[j], zb), (*rb[i], zb)], ref, c)
    _face(f, [(u, v, rings[0][1]) for u, v in rings[0][0]], ref, col)
    _face(f, [(u, v, rings[-1][1]) for u, v in rings[-1][0]], ref, top)


def _rrect(u0, u1, v0, v1, r, n=3):
    """Counter-clockwise (u, v) rectangle with corner radii r = (r00, r10, r11, r01) at (u0,v0), (u1,v0), (u1,v1),
    (u0,v1); each corner gets n + 1 points (side faces 4c..4c+2 are corner c's arc, 4c+3 the straight side after it:
    3 at v0, 7 at u1, 11 at v1, 15 at u0)."""
    out = []
    for (cu, cv, su, sv, a0), rad in zip(((u0, v0, -1, -1, 180), (u1, v0, 1, -1, 270), (u1, v1, 1, 1, 0),
                                          (u0, v1, -1, 1, 90)), r):
        rad = max(rad, TINY)
        ou, ov = cu - su * rad, cv - sv * rad
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            out.append((ou + rad * math.cos(a), ov + rad * math.sin(a)))
    return out


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


def _arch_band(f, u0, u1, outer, inner, col):
    for i in range(len(outer) - 1):
        _tube(f, u0, u1, [outer[i], outer[i + 1], inner[i + 1], inner[i]], col, col, cap=col)


# ---- the pod ------------------------------------------------------------------------------------------------------

def _pod(f):
    """Two rounded columns and a lintel: a cream capsule with the door through it. Red on all four rounded vertical
    edges and over the front and back top edges; the sides' top edges stay cream."""
    for s in (-1, 1):
        v0, v1 = (DW, PW) if s > 0 else (-PW, -DW)
        r = (TINY, TINY, RC, RC) if s > 0 else (RC, RC, TINY, TINY)
        ri = tuple(max(x - RT, TINY) for x in r)
        lo = _rrect(UI, UB, v0, v1, r)
        hi = _rrect(UI + RT, UB - RT, v0 if s > 0 else v0 + RT, v1 - RT if s > 0 else v1, ri)
        arcs = {8, 9, 10, 12, 13, 14} if s > 0 else {0, 1, 2, 4, 5, 6}
        _loft(f, [(lo, 0.0), (lo, PH - RT), (hi, PH)], CREAM, CREAM_T, CREAM_T, red_all=arcs, red_top={7, 15})
    lo = _rrect(UI, UB, -DW, DW, (TINY,) * 4)
    hi = _rrect(UI + RT, UB - RT, -DW, DW, (TINY,) * 4)
    _loft(f, [(lo, DH), (lo, PH - RT), (hi, PH)], CREAM, CREAM_T, CREAM_T, red_top={7, 15})
    for s in (-1, 1):
        f.box((UI + UB) / 2 + 0.02, s * (DW - 0.01), 0, UB - UI - 0.04, 0.02, DH, "dark", top="dark")   # liner
        f.box((UI + UB) / 2, s * (PW + 0.006), 0.04, UB - UI - 2 * RC, 0.012, 0.07, RED, top=RED)     # red base
    f.box((UI + UB) / 2 + 0.02, 0, DH - 0.02, UB - UI - 0.04, 2 * DW, 0.02, "dark", top="dark")


def _door_frame(f):
    """The thick round-cornered frame round the door, proud of the face, a darker groove inside it, and gussets
    filling the opening's top corners."""
    _arch_band(f, UI - 0.03, UI + 0.01, _arch(DW + 0.1, DH + 0.09, 0.2), _arch(DW + 0.025, DH + 0.02, 0.14), CREAM_T)
    _arch_band(f, UI - 0.02, UI + 0.01, _arch(DW + 0.025, DH + 0.02, 0.14), _arch(DW, DH, 0.12), CREAM_S)
    inner = _arch(DW, DH, 0.12)
    for s, arc in ((-1, inner[1:6]), (1, inner[6:11])):
        for a, b in zip(arc, arc[1:]):
            _tube(f, UI - 0.01, UI + 0.08, [(s * DW, DH), a, b], CREAM_T, CREAM_T, cap=CREAM_T)


def _leaves(f, uc, p):
    """Two leaves meeting in the middle, sliding into the columns (p = how far open, 0..1): red status dots and a
    red slot on the left leaf, a small window low on the right one."""
    if p >= 1.0:
        return
    w = DW * (1 - p)
    for s in (-1, 1):
        vc = s * (DW - w / 2)
        f.box(uc, vc, 0, 0.06, w, DH, CREAM_D, top=CREAM_D)
        f.box(uc - 0.02, s * (DW - w) + s * 0.01, 0.02, 0.045, 0.02, DH - 0.04, CREAM_S, top=CREAM_S)   # edge
        if w < 0.12:
            continue
        e = s * (DW - w)                                                                         # meeting edge
        if s < 0:
            for dv, dz in ((0.05, 0), (0.1, 0.05), (0.05, 0.1), (0.1, 0.15)):
                f.box(uc - 0.033, e - dv, 1.0 + dz, 0.006, 0.04, 0.04, RED, top=RED)            # status dots
            f.box(uc - 0.033, e - 0.09, 0.74, 0.006, 0.12, 0.06, RED, top=RED)                  # slot
        else:
            f.box(uc - 0.033, e + 0.1, 0.18, 0.006, 0.13, 0.28, "dark", top="dark")             # window
            f.box(uc - 0.036, e + 0.12, 0.24, 0.004, 0.05, 0.12, CREAM_T, top=CREAM_T)


def housing(rot, p):
    m = core.Mesh(f"airlock_housing_{rot}")
    f = frame(m, rot)
    _pod(f)
    _door_frame(f)
    for s in (-1, 1):                                                                            # side faces
        f.box(0.08, s * (PW + 0.006), 0.6, 0.36, 0.012, 0.52, CREAM_S, top=CREAM_S)              # window frame
        f.box(0.08, s * (PW + 0.01), 0.64, 0.3, 0.008, 0.44, "dark", top="dark")                 # window
        f.box(0.06, s * (PW + 0.008), 0.48, 0.3, 0.008, 0.035, "dark", top="dark")              # slot under
        for k in range(3):                                                                       # vents
            f.box(-0.18, s * (PW + 0.008), 0.78 + k * 0.08, 0.08, 0.008, 0.03, CREAM_S, top=CREAM_S)
    for du, dv, su, sv in ((-0.28, 0, 0.02, 0.26), (-0.04, 0, 0.02, 0.26), (-0.16, -0.12, 0.26, 0.02),
                           (-0.16, 0.12, 0.26, 0.02)):                                           # hatch outline on top
        f.box(du, dv, PH, su, sv, 0.012, CREAM_S, top=CREAM_S)
    f.box(0.2, 0, PH, 0.1, 0.38, 0.012, "dark", top="dark")                                         # light slot
    uc = UI + 0.1
    for k in range(6):                                                                           # threshold
        c = "hazY" if k % 2 else "hazK"
        f.box(uc - 0.06, -DW + (k + 0.5) * (2 * DW / 6), 0, 0.12, 2 * DW / 6, 0.012, c, top=c)
    _leaves(f, uc, p)
    return [m.build()]


def lights(rot, color):
    m = core.Mesh(f"airlock_light_{rot}")
    f = frame(m, rot)
    f.box(0.2, 0, PH + 0.008, 0.07, 0.34, 0.012, color, top=color)                                 # lit slot
    return [m.build()]


# ---- the hull row -------------------------------------------------------------------------------------------------

def hull(rot, level):
    """The slate pass-through block under a cap slab (dark faces, a pale top with a light stripe). Beside and over it,
    the hull wall on the production profile (strip, sloped skirt, 2.05 top) as the level shows the plain hull either
    side: full on a far (north / west) hull in up and cut, else the ghost rim."""
    m = core.Mesh(f"airlock_hull_{rot}_{level}")
    f = frame(m, rot)
    u0, u1 = HULL_U - 0.5, HULL_U + 0.5
    f.box((u0 + u1) / 2, 0, 0, u1 - u0, 2 * BW, BH, SLATE, top=SLATE_T)                            # block
    for s in (-1, 1):
        f.box((u0 + u1) / 2, s * (BW + 0.005), 0.22, u1 - u0 - 0.1, 0.01, 0.03, SLATE_K, top=SLATE_K)   # grooves
        f.box((u0 + u1) / 2, s * (BW + 0.005), 0, u1 - u0, 0.01, 0.08, SLATE_K, top=SLATE_K)
    f.box((u0 + u1) / 2 - 0.04, 0, BH, u1 - u0 - 0.08, 2 * BW + 0.24, CAP, SLATE_K, top=SLATE_L)    # cap slab
    f.box((u0 + u1) / 2 - 0.04, 0, BH + CAP, u1 - u0 - 0.2, 0.06, 0.006, "glassL", top="glassL")  # cap stripe
    f.box(u1 - 0.1, BW + 0.08, BH + CAP, 0.06, 0.06, 0.012, "cyan", top="cyan")                    # cap lamp
    inner, outer = strip(rot)
    if rot in (0, 3) and level != "low":
        zs, run, top = W.skirt_top(), W.skirt_run(), W.hull_top()
        edge = HULL_U - 0.5
        ze = max(0.0, zs * (1 - (inner - edge) / run))
        shape = [(edge, 0), (edge, ze), (inner, zs), (inner, top), (outer, top), (outer, 0)]
        prism(f, [(inner, BH + CAP), (inner, top), (outer, top), (outer, BH + CAP)], -BW, BW, HULL, HULL_T)
    else:
        shape = [(inner, 0), (inner, W.ZG), (outer, W.ZG), (outer, 0)]
    for a, b in ((-0.5, -BW), (BW, 0.5)):
        prism(f, shape, a, b, HULL, HULL_T)
    return [m.build()]


# ---- the docking collar -------------------------------------------------------------------------------------------

def _sector(r0, r1, a0, a1, tw=0.0):
    """(v, z) quad of an annular sector about the collar axis; tw rotates the inner edge (iris blades)."""
    if r0 <= 1e-4:
        return [(0.0, ZC), (r1 * math.cos(a0), ZC + r1 * math.sin(a0)), (r1 * math.cos(a1), ZC + r1 * math.sin(a1))]
    return [(r1 * math.cos(a0), ZC + r1 * math.sin(a0)), (r1 * math.cos(a1), ZC + r1 * math.sin(a1)),
            (r0 * math.cos(a1 + tw), ZC + r0 * math.sin(a1 + tw)), (r0 * math.cos(a0 + tw), ZC + r0 * math.sin(a0 + tw))]


def collar(rot, p, docked):
    """The docking collar: a flange on the block, a grey tube with two red bands, and a mouth ring holding the iris
    hatch (the outer door; p = how far open), a red marker on top of it. Four clamps lie back round the ring, or swing
    forward onto a docked shuttle's hatch; the seal light on the flange is green when docked."""
    m = core.Mesh(f"airlock_collar_{rot}_{int(docked)}")
    f = frame(m, rot)
    u0, ue = HULL_U + 0.5, COLLAR_END
    um = ue - 0.16
    f.hcyl(u0 - 0.02, u0 + 0.07, 0, ZC, RR + 0.04, GREY, sides=16, cap=GREY_T)                     # flange
    f.hcyl(u0 + 0.07, um, 0, ZC, RR - 0.06, GREY_T, sides=16, cap="dark")                         # tube
    for uk in (u0 + 0.18, u0 + 0.36):
        f.hcyl(uk - 0.03, uk + 0.03, 0, ZC, RR - 0.04, RED, sides=16, cap=RED)                    # red bands
    for k in range(16):                                                                          # mouth ring
        a0, a1 = k * math.tau / 16, (k + 1) * math.tau / 16
        _tube(f, um, ue, _sector(RH, RR, a0, a1), GREY, GREY_T, cap=GREY_T)
    f.hcyl(ue - 0.1, ue - 0.095, 0, ZC, RH + 0.01, "dark", sides=16, cap="dark")                  # behind the hatch
    f.box(um + 0.08, 0, ZC + RR - 0.03, 0.12, 0.14, 0.07, RED, top=RED)                             # red marker
    if p < 1.0:                                                                                  # iris blades
        r0, tw = RH * p, 0.55 * p
        for k in range(6):
            a0, a1 = k * math.tau / 6 + 0.04, (k + 1) * math.tau / 6 - 0.04
            col = "gW2" if k % 2 else "steel"
            _tube(f, ue - 0.09, ue - 0.05, _sector(r0, RH + 0.01, a0, a1, tw), col, col, cap=col)
        if p == 0.0:
            f.hcyl(ue - 0.06, ue - 0.03, 0, ZC, 0.08, "steelD", sides=8, cap=RED)                  # hub
    lamp = "green" if docked else "steelD"
    f.box(u0 + 0.03, 0, ZC + RR + 0.02, 0.06, 0.1, 0.04, lamp, top=lamp)                            # seal light
    for k in range(4):                                                                           # clamps
        a = math.pi / 4 + k * math.pi / 2
        cv, cz = math.cos(a), math.sin(a)
        if docked:
            r = RR - 0.06
            f.box(ue + 0.05, cv * r, ZC + cz * r, 0.1, 0.09, 0.09, "steelD", top="steelD", base=False)
            f.box(ue + 0.11, cv * (r - 0.06), ZC + cz * (r - 0.06), 0.04, 0.08, 0.08, RED, top=RED, base=False)
        else:
            r = RR + 0.02
            f.box(ue - 0.06, cv * r, ZC + cz * r, 0.12, 0.07, 0.07, "steelD", top="steelD", base=False)
    return [m.build()]


# ---- inboard: unloaders and floor marks ---------------------------------------------------------------------------

UV, UHW = 1.0, 0.3                 # unloader centre v (built on the +v side; symmetric), half width
CW, CU0, CU1, CB = 0.23, -1.46, -1.06, -1.12   # chute: inner half width, mouth, back of the frame, inner back wall
UNLOADER = (                       # (u/z outline, v0, v1 about UV, body, top)
    ([(-0.3, 0), (-0.3, 0.5), (-0.04, 0.68), (0.36, 0.68), (0.46, 0.58), (0.46, 0)], -UHW, UHW, CREAM, CREAM_T),
    ([(-1.06, 0), (-1.06, 0.5), (-0.3, 0.5), (-0.3, 0)], 0.02 - UHW, UHW - 0.02, CREAM, CREAM_T),     # body
    ([(CU0, 0), (CU0, 0.5), (CU1, 0.5), (CU1, 0)], -UHW - 0.01, -CW, SLATE_T, SLATE_L),              # chute walls
    ([(CU0, 0), (CU0, 0.5), (CU1, 0.5), (CU1, 0)], CW, UHW + 0.01, SLATE_T, SLATE_L),
    ([(CU0, 0.41), (CU0, 0.5), (CU1, 0.5), (CU1, 0.41)], -CW, CW, SLATE_T, SLATE_L),                # roof
    ([(CU0, 0), (CU0, 0.07), (CU1, 0.07), (CU1, 0)], -CW, CW, SLATE_K, SLATE),                      # floor sill
    ([(CB, 0.07), (CB, 0.41), (CU1, 0.41), (CU1, 0.07)], -CW, CW, SLATE, SLATE),                    # back wall
    ([(-1.42, 0.5), (-1.32, 0.88), (-0.98, 0.88), (-0.9, 0.5)], -UHW, UHW, CREAM, CREAM_T),         # hood
)


def _unloader_details():
    """(u, v, z, su, sv, sz, colour) boxes on the unloader."""
    out = [(0.16, UV, 0.68, 0.3, 0.42, 0.02, CREAM_D),                                             # top panel
           (0.16, UV - 0.1, 0.7, 0.05, 0.05, 0.006, CREAM_S), (0.16, UV + 0.1, 0.7, 0.05, 0.05, 0.006, CREAM_S),
           (0.465, UV, 0.04, 0.01, 2 * UHW - 0.06, 0.08, RED),                                     # back base red
           (CB - 0.006, UV, 0.16, 0.01, 2 * CW - 0.06, 0.03, SLATE_K),                              # chute inside:
           (CB - 0.006, UV, 0.28, 0.01, 2 * CW - 0.06, 0.03, SLATE_K),                              # back wall slats
           (-1.3, UV, 0.395, 0.2, 2 * CW - 0.14, 0.012, "glassL"),                                 # light panel
           (CU0 - 0.004, UV, 0.44, 0.012, 2 * CW + 0.04, 0.03, SLATE_L)]                           # mouth lip
    out += [(u, UV, 0.07, 0.045, 2 * CW - 0.04, 0.03, "steelL") for u in (-1.41, -1.33, -1.25, -1.17)]   # rollers
    out += [(-1.38, UV, 0.56, 0.03, 2 * UHW - 0.18, 0.22, "dark"),                                # hood visor
            (-1.4, UV - 0.06, 0.66, 0.012, 0.05, 0.03, "lampY"), (-1.4, UV + 0.04, 0.7, 0.012, 0.05, 0.03, "lampY"),
            (-1.4, UV - 0.02, 0.6, 0.012, 0.05, 0.03, "lampY")]
    for s in (-1, 1):
        sv = UV + s * (UHW + 0.004)
        out += [(0.08, sv, 0.04, 0.72, 0.008, 0.08, RED),                                         # base red
                (-1.12, sv, 0.6, 0.18, 0.008, 0.06, RED)]                                         # hood red
        out += [(-0.98 + k * 0.07, UV + s * (UHW - 0.016), 0.1, 0.035, 0.008, 0.2, "dark") for k in range(4)]  # vents
        out += [(-0.45, UV + s * (UHW - 0.016), 0.36, 0.3, 0.008, 0.025, CREAM_S)]
    return out


def unloader(rot, half):
    """An unloader along u at v = 1 (the -v side is the same sprite), cut at u = -0.5 into its two tiles: a taller
    back block against the hull, a lower body with vents, and at the inboard end a hollow slate chute open toward the
    keep-out square (a roller bed on its floor, a light panel overhead, a slatted back wall) under a hood with a dark
    visor and amber lights; red trim low on the sides and on the hood."""
    m = core.Mesh(f"airlock_unloader_{rot}_{half}")
    f = frame(m, rot)
    lo, hi = (-0.5, 0.5) if half == "back" else (-1.5, -0.5)
    for shape, v0, v1, col, top in UNLOADER:
        part = _clip(shape, lo, hi)
        if len(part) >= 3:
            prism(f, part, UV + v0, UV + v1, col, top)
    for u, v, z, su, sv, sz, col in _unloader_details():
        if lo <= u < hi:
            f.box(u, v, z, su, sv, sz, col, top=col)
    return [m.build()]


def keepout(rot):
    """The keep-out square in front of a chute (built on the tile at u -2, v 1): orange dashes round the tile, inset.
    Paint on the deck (no plate)."""
    m = core.Mesh(f"airlock_keepout_{rot}")
    f = frame(m, rot)
    uc, vc, ins, n, bw, z = -2.0, UV, 0.06, 4, 0.065, 0.004
    lo, hi = -0.5 + ins, 0.5 - ins
    step = (hi - lo) / n
    for k in range(n):
        t = lo + (k + 0.5) * step
        for e in (lo + bw / 2, hi - bw / 2):
            f.box(uc + e, vc + t, 0, bw, step * 0.66, z, "hivis", top="hivis")
            f.box(uc + t, vc + e, 0, step * 0.66, bw, z, "hivis", top="hivis")
    return [m.build()]


def walk(rot):
    """The walk zone's marks (built on the tile at u -1, v 0): a green L at each corner. Paint on the deck."""
    m = core.Mesh(f"airlock_walk_{rot}")
    f = frame(m, rot)
    uc, ins, ln, bw, z = -1.0, 0.08, 0.26, 0.06, 0.004
    for su in (-1, 1):
        for sv in (-1, 1):
            cu, cv = uc + su * (0.5 - ins), sv * (0.5 - ins)
            f.box(cu - su * ln / 2, cv, 0, ln, bw, z, "alG", top="alG")
            f.box(cu, cv - sv * ln / 2, 0, bw, ln, z, "alG", top="alG")
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
    add(f"{ID}.unloader.r{rot}.back", "prop", lambda: unloader(rot, "back"), 0, UV)
    add(f"{ID}.unloader.r{rot}.front", "prop", lambda: unloader(rot, "front"), -1, UV)
    add(f"{ID}.keepout.r{rot}", "block", lambda: keepout(rot), -2, UV)
    add(f"{ID}.walk.r{rot}", "block", lambda: walk(rot), -1, 0)
    return out


def jobs():
    return [lambda r=r: items(r) for r in range(4)]
