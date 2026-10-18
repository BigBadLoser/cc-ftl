"""Airlock (module.airlock): 3 wide along the hull, on the hull row plus 2 rows inboard (hullEdge n, rotates with the
module like the engine), with a docking collar on the tile beyond the hull.

Module frame (cmbkit.Frame, footprint centre at u = v = 0): u points outward through the hull (r0 north, r1 east,
r2 south, r3 west), v along the hull. Tile roles:
  u = 1   (hull row)  v = 0: the housing's pass-through, replacing the hull wall; v = +-1: plain hull (not ours)
  u = 0               v = 0: the door housing (tall inner door, keypad, cycle light strip); v = +-1: cargo unloaders
  u = -1  (keep-out)  v = -1..1: hazard-edged deck marking, walkable
  u = 2   (outside)   the docking collar, its round iris hatch (the outer door) at its mouth

The housing (inner door tile and hull pass-through) is a faceted white-grey armour block, never cut in any wall view
level; on the hull row it carries production hull-profile shoulders (walls.py) where it meets the plain hull either
side. The chamber is the housing's passage plus the collar tube; the outer door is the iris at the collar mouth.

Sprites, per rotation r (each anchored at its own tile so the renderer sorts it by that tile; footprint [1, 1]):
  module.airlock.housing.r<r>.<closed|f1|f2|open>     inner door tile: housing and inner door (opening frames f1, f2)
  module.airlock.hull.r<r>.<up|cut|low>               hull row: the housing's pass-through and hull shoulders (the
                                                      shoulders follow the wall view level; the housing never cuts)
  module.airlock.light.r<r>.<red|green>               the cycle light: lit strip on top and keypad status lamp
  module.airlock.collar.r<r>.<closed|f1|f2|open>[.docked]
                                                      collar and iris hatch (sort by the tile beyond the hull row);
                                                      docked: clamps swung onto the shuttle hatch, seal light green
  module.airlock.unloader.r<r>                        a cargo unloader (the same sprite on both side tiles)
  module.airlock.keepout.r<r>.<l|m|r>                 keep-out deck marking on the tiles at v = -1, 0, 1
The collar's mating face (where a shuttle's hatch meets it) is COLLAR_END: the far edge of the tile beyond the hull,
i.e. 1 tile past the hull row's outer edge."""
import math

from . import core, env_build, post
from . import walls as W
from .cmbkit import Frame
from .console_proto import centre

ID = "module.airlock"
DOORS = (("closed", 0.0), ("f1", 0.35), ("f2", 0.7), ("open", 1.0))
HULL_U, COLLAR_END = 1.0, 2.5
UI = -0.4                          # housing's inboard face
HW, TW, CZ, TOP = 0.44, 0.27, 1.5, 2.14   # housing half width, half width at the top, chamfer start, top
DW, DH = 0.25, 1.62                # inner door half width, height
ZC, RH, RR = 0.86, 0.68, 0.84      # collar axis height, iris (hatch) radius, sealing ring outer radius
ARM, ARM_T, LEAF = "gW1", "medWhite", "steelL"
ORANGE = "hivis"
HULL, HULL_T = "bM", "bL"


def frame(m, rot):
    return Frame(m, rot, centre=centre(rot, 3, 3))


def strip(rot):
    """(inner, outer) u of the production hull strip on the hull row (walls.Strip puts it at the tile's -x / -y edge:
    the outer edge for a north / west hull, the inner edge for an east / south one)."""
    t = (math.floor(W.hull_thick() * W.GN - 0.5) + 1) / W.GN
    return (HULL_U - 0.5, HULL_U - 0.5 + t) if rot in (1, 2) else (HULL_U + 0.5 - t, HULL_U + 0.5)


def prism(f, shape, a, b, mat, top):
    """Extrude a u/z outline across v in [a, b] (both end faces)."""
    n = len(shape)
    A = [f.pt(u, a, z) for u, z in shape]
    B = [f.pt(u, b, z) for u, z in shape]
    f.poly(A, mat, flip=True)
    f.poly(B[::-1], mat, flip=True)
    for i in range(n):
        j = (i + 1) % n
        f.poly([A[i], B[i], B[j], A[j]], top if shape[j][0] > shape[i][0] else mat, flip=True)


def _tube(f, u0, u1, sec, col, top=None, cap=None, start=True):
    """Extrude a convex (v, z) section along u from u0 to u1, faces wound outward from its axis. cap colours the end
    at u1 (None: open); start closes the end at u0 too."""
    from mathutils import Vector
    vc = sum(v for v, _ in sec) / len(sec)
    zc = sum(z for _, z in sec) / len(sec)

    def face(pts, ref, color):
        P = [Vector(f.pt(*q)) for q in pts]
        n = (P[1] - P[0]).cross(P[2] - P[0])
        c = sum(P, Vector()) / len(P)
        if n.dot(c - Vector(f.pt(*ref))) < 0:
            P = P[::-1]
        f.poly(P, color, flip=False)
    mid = ((u0 + u1) / 2, vc, zc)
    n = len(sec)
    for i in range(n):
        (va, za), (vb, zb) = sec[i], sec[(i + 1) % n]
        up = (zb + za) / 2 > zc and abs(zb - za) < 0.5 * abs(vb - va) + 1e-6
        face([(u0, va, za), (u1, va, za), (u1, vb, zb), (u0, vb, zb)], mid, (top or col) if up else col)
    if cap:
        face([(u1, v, z) for v, z in sec], (u0, vc, zc), cap)
    if start:
        face([(u0, v, z) for v, z in sec], (u1, vc, zc), col)


# ---- the housing --------------------------------------------------------------------------------------------------

def _body(f, u0, u1):
    """The armour block from u0 to u1: two pillars with chamfered shoulders and a lintel over the passage, white-grey
    with orange stripes along the shoulders, a seam band down each side and a dark liner in the passage."""
    for s in (-1, 1):
        _tube(f, u0, u1, [(s * DW, 0), (s * HW, 0), (s * HW, CZ), (s * TW, TOP), (s * DW, TOP)], ARM, ARM_T, cap=ARM)
        dv, dz = s * (TW - HW), TOP - CZ
        ln = math.hypot(dv, dz)
        nv, nz = s * dz / ln * 0.014, abs(dv) / ln * 0.014
        a, b = (s * HW + dv * 0.04, CZ + dz * 0.04), (s * HW + dv * 0.24, CZ + dz * 0.24)
        _tube(f, u0, u1, [a, b, (b[0] + nv, b[1] + nz), (a[0] + nv, a[1] + nz)], ORANGE, cap=ORANGE)   # shoulder stripe
        f.box((u0 + u1) / 2, s * (HW + 0.006), 0.6, u1 - u0 - 0.08, 0.012, 0.05, "steelL", top="steelL")   # seam band
        f.box((u0 + u1) / 2, s * (DW - 0.01), 0, u1 - u0, 0.02, DH, "steelD", top="steelD")       # passage liner
    _tube(f, u0, u1, [(-DW, DH), (DW, DH), (DW, TOP), (-DW, TOP)], ARM, ARM_T, cap=ARM)
    f.box((u0 + u1) / 2, 0, DH - 0.02, u1 - u0, 2 * DW, 0.02, "steelD", top="steelD")              # passage ceiling


def _leaves(f, uc, p):
    """Two heavy leaves meeting in the middle; p = how far open (0..1), sliding into the pillars."""
    if p >= 1.0:
        return
    w = DW * (1 - p)
    for s in (-1, 1):
        vc = s * (DW - w / 2)
        f.box(uc, vc, 0, 0.07, w, DH, LEAF, top=LEAF)
        for z in (0.32, 0.62):                                                                   # stiffeners
            f.box(uc - 0.04, vc, z, 0.015, w * 0.86, 0.06, "plate", top="plate")
        if w > 0.12:
            f.box(uc - 0.037, vc, 1.0, 0.01, min(0.1, w - 0.06), 0.34, "glassD", top="glassD")    # window slot
        f.box(uc - 0.02, s * (DW - w) + s * 0.012, 0.04, 0.05, 0.024, DH - 0.08, "steelD", top="steelD")   # edge


def housing(rot, p):
    m = core.Mesh(f"airlock_housing_{rot}")
    f = frame(m, rot)
    _body(f, UI, 0.5)
    for s in (-1, 1):
        f.box(UI - 0.02, s * (DW + 0.03), 0, 0.04, 0.06, DH, ARM_T, top=ARM_T)                    # door surround
        kv = s * (DW + 0.06 + (HW - DW - 0.07) / 2)
        f.box(UI - 0.05, kv, 0, 0.1, HW - DW - 0.08, 0.52, ARM, top=ARM_T, taper=0.25, tv=1.0)     # angled kick plate
    f.box(UI - 0.02, 0, DH, 0.04, 2 * (DW + 0.06), 0.12, ARM_T, top=ARM_T)                         # surround header
    for s in (-1, 1):                                                                            # orange header ends
        f.box(UI - 0.045, s * (DW - 0.02), DH + 0.03, 0.01, 0.1, 0.06, ORANGE, top=ORANGE)
    kv = DW + 0.06 + (HW - DW - 0.07) / 2
    f.box(UI - 0.015, kv, 0.96, 0.03, 0.11, 0.26, "dark", top="steelD")                           # keypad
    f.box(UI - 0.032, kv, 0.99, 0.006, 0.07, 0.12, "steelL", top="steelL")
    f.box(UI + 0.07, 0, TOP, 0.09, 0.44, 0.02, "dark", top="dark")                                 # light channel
    f.box(0.2, 0, TOP, 0.34, 0.34, 0.02, "steelL", top="steelL")                                   # roof vent
    for k in range(3):
        f.box(0.2, -0.1 + k * 0.1, TOP + 0.02, 0.28, 0.04, 0.004, "dark", top="dark")
    uc = UI + 0.12
    for k in range(6):                                                                           # hazard threshold
        c = "hazY" if k % 2 else "hazK"
        f.box(uc - 0.05, -DW + (k + 0.5) * (2 * DW / 6), 0, 0.14, 2 * DW / 6, 0.012, c, top=c)
    _leaves(f, uc, p)
    return [m.build()]


def hull(rot, level):
    """The hull row: the housing's pass-through (never cut), with production-profile hull shoulders (strip, sloped
    skirt, 2.05 top) between the armour and the tile edges, where the plain hull either side butts against it. The
    shoulders follow the hull beside them: full on a far (north / west) hull in up and cut, else the ghost rim."""
    m = core.Mesh(f"airlock_hull_{rot}_{level}")
    f = frame(m, rot)
    _body(f, 0.5, 1.5)
    inner, outer = strip(rot)
    zs, run, top = W.skirt_top(), W.skirt_run(), W.hull_top()
    if rot in (1, 2) or level == "low":
        shape = [(inner, 0), (inner, W.ZG), (outer, W.ZG), (outer, 0)]
    else:
        edge = HULL_U - 0.5
        ze = max(0.0, zs * (1 - (inner - edge) / run))
        shape = [(edge, 0), (edge, ze), (inner, zs), (inner, top), (outer, top), (outer, 0)]
    for a, b in ((-0.5, -HW), (HW, 0.5)):
        prism(f, shape, a, b, HULL, HULL_T)
    return [m.build()]


def lights(rot, color):
    m = core.Mesh(f"airlock_light_{rot}")
    f = frame(m, rot)
    f.box(UI + 0.07, 0, TOP + 0.02, 0.06, 0.38, 0.025, color, top=color)                          # lit strip
    f.box(UI - 0.036, DW + 0.06 + (HW - DW - 0.07) / 2, 1.14, 0.008, 0.06, 0.05, color, top=color)   # keypad lamp
    return [m.build()]


# ---- the docking collar -------------------------------------------------------------------------------------------

def _sector(r0, r1, a0, a1, tw=0.0):
    """(v, z) quad of an annular sector about the collar axis; tw rotates the inner edge (iris blades)."""
    if r0 <= 1e-4:
        return [(0.0, ZC), (r1 * math.cos(a0), ZC + r1 * math.sin(a0)), (r1 * math.cos(a1), ZC + r1 * math.sin(a1))]
    return [(r1 * math.cos(a0), ZC + r1 * math.sin(a0)), (r1 * math.cos(a1), ZC + r1 * math.sin(a1)),
            (r0 * math.cos(a1 + tw), ZC + r0 * math.sin(a1 + tw)), (r0 * math.cos(a0 + tw), ZC + r0 * math.sin(a0 + tw))]


def collar(rot, p, docked):
    """The docking collar: a mounting flange on the housing's outer end, a round tube with two stiffening bands and
    an orange band, and a heavy sealing ring at the mouth holding the iris hatch (the outer door; p = how far open).
    Four clamps lie back along the ring, or swing forward onto a docked shuttle's hatch; the seal light on top of the
    ring is green when docked."""
    m = core.Mesh(f"airlock_collar_{rot}_{int(docked)}")
    f = frame(m, rot)
    u0, ue = HULL_U + 0.5, COLLAR_END
    uf = ue - 0.2
    f.hcyl(u0 - 0.02, u0 + 0.08, 0, ZC, RR + 0.04, ARM, sides=16, cap=ARM_T)                       # mounting flange
    f.hcyl(u0 + 0.08, uf, 0, ZC, RH + 0.06, ARM_T, sides=16, cap="dark")                         # tube
    for t in (0.3, 0.62):
        uk = u0 + 0.08 + (uf - u0 - 0.08) * t
        f.hcyl(uk - 0.03, uk + 0.03, 0, ZC, RH + 0.09, "steelL", sides=16, cap="steelL")          # stiffening bands
    f.hcyl(uf - 0.07, uf - 0.02, 0, ZC, RH + 0.075, ORANGE, sides=16, cap=ORANGE)                 # orange band
    n = 16
    for k in range(n):                                                                           # sealing ring
        a0, a1 = k * math.tau / n, (k + 1) * math.tau / n
        _tube(f, uf, ue, _sector(RH, RR, a0, a1), ARM, ARM_T, cap=ARM_T if k % 4 else "steelL")
    if p < 1.0:                                                                                  # iris blades
        r0, tw = RH * p, 0.55 * p
        for k in range(6):
            a0, a1 = k * math.tau / 6 + 0.035, (k + 1) * math.tau / 6 - 0.035
            c = "plate" if k % 2 else "steelL"
            _tube(f, ue - 0.09, ue - 0.05, _sector(r0, RH + 0.01, a0, a1, tw), c, c, cap=c)
        if p == 0.0:
            f.hcyl(ue - 0.06, ue - 0.035, 0, ZC, 0.09, "steelD", sides=8, cap="steelL")            # hub
    lamp = "green" if docked else "steelD"
    f.box(ue - 0.1, 0, ZC + RR - 0.01, 0.1, 0.16, 0.05, lamp, top=lamp)                           # seal light
    for k in range(4):                                                                           # clamps
        a = math.pi / 4 + k * math.pi / 2
        cv, cz = math.cos(a), math.sin(a)
        if docked:
            r = RR - 0.08
            f.box(ue + 0.04, cv * r, ZC + cz * r, 0.1, 0.1, 0.1, "steelD", top="steelD", base=False)
            f.box(ue + 0.1, cv * (r - 0.06), ZC + cz * (r - 0.06), 0.04, 0.09, 0.09, ORANGE, top=ORANGE, base=False)
        else:
            r = RR + 0.04
            f.box(ue - 0.13, cv * r, ZC + cz * r, 0.16, 0.08, 0.08, "steelD", top="steelD", base=False)
            f.box(ue - 0.04, cv * r, ZC + cz * r, 0.03, 0.085, 0.085, ORANGE, top=ORANGE, base=False)
    return [m.build()]


# ---- inboard: unloaders and the keep-out deck ---------------------------------------------------------------------

def unloader(rot):
    """A cargo unloader at (u 0, v 1): a low cabinet with a roller bed running inboard from a hood against the hull,
    where cargo comes through; orange band on the front, side vents, a status lamp. Symmetric across v, so the same
    sprite serves both side tiles."""
    m = core.Mesh(f"airlock_unloader_{rot}")
    f = frame(m, rot)
    v = 1.0
    f.box(-0.04, v, 0, 0.7, 0.72, 0.38, ARM, top=ARM_T)                                            # cabinet
    f.box(0.31, v, 0, 0.2, 0.76, 0.78, ARM, top=ARM_T, taper=0.8, tv=1.0)                           # hood
    f.box(0.205, v, 0.4, 0.012, 0.5, 0.26, "dark", top="dark")                                      # cargo chute
    for k in range(4):                                                                           # chute flaps
        f.box(0.198, v - 0.18 + k * 0.12, 0.44, 0.006, 0.1, 0.2, "steelD", top="steelD")
    for s in (-1, 1):
        f.box(0.2, v + s * 0.28, 0.38, 0.03, 0.06, 0.32, ORANGE, top=ORANGE)                        # chute guides
        f.box(-0.07, v + s * 0.3, 0.38, 0.54, 0.05, 0.07, "steelL", top="steelL")                  # bed rails
        for k in range(3):                                                                       # side vents
            f.box(-0.24 + k * 0.12, v + s * 0.362, 0.1, 0.05, 0.008, 0.16, "dark", top="dark")
    for k in range(5):                                                                           # rollers
        f.box(-0.31 + k * 0.115, v, 0.38, 0.06, 0.54, 0.04, "plate", top="plate")
    f.box(-0.37, v, 0.38, 0.04, 0.6, 0.08, "steelD", top="steelD")                                  # end stop
    f.box(-0.395, v, 0.27, 0.012, 0.6, 0.05, ORANGE, top=ORANGE)                                   # front band
    f.box(0.215, v + 0.3, 0.68, 0.01, 0.05, 0.05, "green", top="green")                            # status lamp
    return [m.build()]


def keepout(rot, v):
    """Hazard edging on the keep-out tile at (u -1, v): along the inboard edge, and the end edge on the two end
    tiles. Paint on the deck (no plate); stripes count from the row's end so they run on across the tiles."""
    m = core.Mesh(f"airlock_keepout_{rot}_{v}")
    f = frame(m, rot)
    bw, seg, z = 0.08, 0.125, 0.004
    for k in range(8):
        vv = v - 0.5 + (k + 0.5) * seg
        c = "hazY" if (round((vv + 1.5) / seg - 0.5)) % 2 else "hazK"
        f.box(-1.5 + 0.04 + bw / 2, vv, 0, bw, seg, z, c, top=c)
    if v != 0:
        s = 1 if v > 0 else -1
        for k in range(7):
            uu = -1.5 + 0.04 + bw + (k + 0.5) * (1 - 0.04 - bw) / 7
            c = "hazY" if k % 2 else "hazK"
            f.box(uu, s * (1.5 - 0.04 - bw / 2), 0, (1 - 0.04 - bw) / 7, bw, z, c, top=c)
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
