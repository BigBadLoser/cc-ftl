"""Door blockout: the interior door as plain grey boxes (no detail), to settle its shape before any art.

A door along x (in a wall run along x, its face toward +y) or y (face toward +x), tile units, the tile centre at the
origin, z up from the deck:
  frame      the wall's depth and height (walls.HF), the opening cut through it, its corners cut at 45 degrees; its
             inside shelled: a lip two px deep at the front and the back, the band between them recessed a px, the
             corners hollowed back to the recess (the cuts stand only in the lips)
  feet       a fin a px thick at each outer edge of the frame, the wall skirt's profile (the ramps beside it meet them)
  leaf       a slab in the middle of the wall's depth filling the opening (closed only)
  threshold  a px high across the frame's depth, joining the bottom cuts
Faces are toned by facing (bkT tops, bkY faces toward +y, bkX toward +x) and by depth: a shade darker (bk*d) in
from the piece's camera-facing bounds, two (bk*dd) further in (DEPTH). Flat greys, nothing else."""
import math

from mathutils import Vector

from . import core
from . import doors as D
from . import wall3d as W3
from . import walls as W

HW = 13 / 32           # the opening's half-width (jambs 3 px; on the px grid, so its 1 px edges land on whole px)
ZO = W.HF - 0.18       # its height (a header of 0.18)
CT = 0.25              # its top corners cut at 45 degrees by this much
CBU, CBZ = 0.2, 0.2    # its bottom corners cut: this far in along the floor, this far up the jamb (45 degrees)
PU, PZ = 1 / 32, 1 / 39  # one art px along the floor (u, v) and up (z)
LIP = 2 * PU           # the back lip's depth (two px)
FRONT = 4 * PU         # the front lip's: the leaf sits this far behind the frame's face (Space Haven's door II)


def _tone(n):
    if n.z > 0.5:
        return "bkT"
    return "bkY" if abs(n.y) >= abs(n.x) else "bkX"


DEPTH = (0.04, 0.08)   # a face this far in from the piece's camera-facing bounds (front, +u side, top) is a shade
                       # darker, past the second two shades: the blockout's depth cue


class _Mesh:
    def __init__(self, name, axis, front, top):
        self.m = core.Mesh(name, flat=True)
        self.axis = axis
        self.front, self.top = front, top
        self.edge = None                                # (set: the opening's sides take this tone)
        self.cap = None                                 # (set: the piece's top faces take this tone)
        self.side = 0                                   # (shades darker the frame's sides, u = +-0.5, are)
        self.holes = []                                 # ((v0, v1, z0, z1) rectangles cut out of the faces in the
                                                        # planes u = +-0.5: the frame's sides)
        self.prefix = "bk"                              # (the palette ramp: bk the blockout's greys; df / dl the
                                                        # metal look's frame / leaf, dmG its glass)

    def G(self, u, v, z):
        """Door-local (u along the wall, v across it toward its face, z) to the tile grid."""
        return Vector((u, v, z)) if self.axis == "x" else Vector((v, u, z))

    def poly(self, pts, tone=None):
        side = pts[0][0] if self.holes and abs(abs(pts[0][0]) - 0.5) < 1e-9 else None
        if side is not None and all(abs(p[0] - side) < 1e-9 for p in pts):
            pieces = [[(p[1], p[2]) for p in pts]]      # (a side face: less the holes, in (v, z))
            for v0, v1, z0, z1 in self.holes:
                pieces = [q for p in pieces for q in _minus(p, [(v0, z0), (v1, z0), (v1, z1), (v0, z1)])]
            holes, self.holes = self.holes, []
            for p in pieces:
                self.poly([(side, v, z) for v, z in p], tone)
            self.holes = holes
            return
        vp = pts[0][1]                                  # (a face across the depth, inside a hole's depth range: less
        if self.holes and all(abs(p[1] - vp) < 1e-9 for p in pts) and any(v0 < vp < v1 for v0, v1, _, _ in self.holes):
            pieces = [[(p[0], p[2]) for p in pts]]      # the hole, a px into the side, in (u, z))
            for v0, v1, z0, z1 in self.holes:
                if v0 < vp < v1:
                    for a, b in ((0.5 - PU, 0.5), (-0.5, -0.5 + PU)):
                        pieces = [q for p in pieces for q in _minus(p, [(a, z0), (b, z0), (b, z1), (a, z1)])]
            holes, self.holes = self.holes, []
            for p in pieces:
                self.poly([(u, vp, z) for u, z in p], tone)
            self.holes = holes
            return
        q = [self.G(*p) for p in pts]
        n = Vector((0.0, 0.0, 0.0))                     # (Newell's normal: any three corners may be in line)
        for a, b in zip(q, q[1:] + q[:1]):
            n += a.cross(b)
        if n.length < 1e-12:
            return
        u, v, z = (sum(p[i] for p in pts) / len(pts) for i in range(3))
        if self.edge and not tone and abs(n.normalized().dot(self.G(0, 1, 0))) < 0.5 and abs(u) < HW + 1e-6 \
                and z < ZO + 1e-6:
            tone = self.edge                            # (the opening's sides in the frame's first px: a lit edge)
        d = max(0.0, min(self.front - v, 0.5 - u, self.top - z))
        if self.cap and not tone and abs(n.normalized().z) > 0.5 and all(abs(p[2] - self.top) < 1e-6 for p in pts):
            tone = self.cap
        on_side = all(abs(abs(p[0]) - 0.5) < 1e-9 for p in pts) and abs(n.normalized().dot(self.G(1, 0, 0))) > 0.5
        tone = tone or _tone(n.normalized()) + "d" * min(2, sum(d > t for t in DEPTH) + (self.side if on_side else 0))
        if self.prefix != "bk" and tone.startswith("bk"):
            tone = "dmG" if tone == "bkG" else self.prefix + tone[2:]
        self.m.poly([core.G(*p) for p in q], tone)

    def prism(self, outline, v0, v1, tone=None, up=None):
        """A polygon in the (u, z) plane (counter-clockwise seen from +v) run from v0 to v1; `up` the tone of its
        sides facing up, if not their own (a seam's floor, in shadow)."""
        self.poly([(u, v1, z) for u, z in outline], tone)
        self.poly([(u, v0, z) for u, z in reversed(outline)], tone)
        for (ua, za), (ub, zb) in zip(outline, outline[1:] + outline[:1]):
            facing_up = up and (ub - ua) < -1e-9 and abs(zb - za) < abs(ub - ua) * 1.5   # (an upper edge: ccw runs -u)
            self.poly([(ua, v0, za), (ub, v0, zb), (ub, v1, zb), (ua, v1, za)], up if facing_up else tone)

    def box(self, u0, u1, v0, v1, z0, z1, tone=None, top=None):
        """An axis-aligned box, its faces wound outward; `tone` its faces' (`top` its top's) if not their own."""
        c = [(u, v, z) for z in (z0, z1) for v in (v0, v1) for u in (u0, u1)]
        for i, f in enumerate(((0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4), (2, 6, 7, 3), (0, 4, 6, 2), (1, 3, 7, 5))):
            self.poly([c[j] for j in f], top if i == 1 and top else tone)


def _clip(poly, a, b, c):
    """A convex polygon cut to a u + b z <= c."""
    out = []
    for p, q in zip(poly, poly[1:] + poly[:1]):
        fp, fq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if fp <= 1e-9:
            out.append(p)
        if (fp < -1e-9 < fq) or (fq < -1e-9 < fp):
            k = fp / (fp - fq)
            out.append((p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k))
    out = [p for i, p in enumerate(out) if abs(p[0] - out[i - 1][0]) + abs(p[1] - out[i - 1][1]) > 1e-9]
    return out if len(out) >= 3 else []                 # (no repeated corners: they made faces degenerate)


def _minus(p, q):
    """Convex polygon p less convex polygon q (counter-clockwise), as convex pieces."""
    out, rest = [], p
    for (au, az), (bu, bz) in zip(q, q[1:] + q[:1]):
        du, dz = bu - au, bz - az                       # (inside q: left of each edge)
        piece = _clip(rest, -dz, du, -(dz * au - du * az))
        if piece:
            out.append(piece)
        rest = _clip(rest, dz, -du, dz * au - du * az)
        if not rest:
            break
    return out


def _rsq(uc, zc, nu, nz, r):
    """A rounded rectangle nu x nz px (its corners r px round), centred at (uc, zc), counter-clockwise."""
    hu, hz, ru, rz = nu * PU / 2, nz * PZ / 2, r * PU, r * PZ
    out = []
    for cu, cz, a0 in ((1, -1, -90), (1, 1, 0), (-1, 1, 90), (-1, -1, 180)):
        for i in range(4):
            a = math.radians(a0 + 90 * i / 3)
            out.append((uc + cu * (hu - ru) + ru * math.cos(a), zc + cz * (hz - rz) + rz * math.sin(a)))
    return out


WIN, WIN_R, WIN_B = (16, 18), 4, 1   # the leaves' windows: px wide and high, corner radius px, the recessed
                                     # border's px


def _windowed(parts, uc, zc):
    """A leaf's convex parts with a window cut in them: (outline, recess in px, tone) for the leaf, its window's
    border (a px back) and the glass (two px back)."""
    outer = _rsq(uc, zc, *WIN, WIN_R)
    inner = _rsq(uc, zc, WIN[0] - 2 * WIN_B, WIN[1] - 2 * WIN_B, max(1, WIN_R - WIN_B))
    out = [(q, 0, None) for p in parts for q in _minus(p, outer)]
    return out + [(q, 1, None) for q in _minus(outer, inner)] + [(inner, 2, "bkG")]


LEAVES = ("slide", "split", "shutter", "halves")


def leaf_parts(kind, t, band=False):
    """The leaf's parts in the (u, z) plane at open fraction t (0 closed, 1 open), each cut to the opening: what
    runs into a jamb or the header is hidden in it. slide: one panel into the +u jamb; split: two halves into both
    jambs; shutter: up into the header; halves: a top half (the shutter's half-open part) up into the header and a
    bottom half mating with it down into the floor."""
    e = PZ * CBU / CBZ                                  # (the cut's run at the leaf's foot)
    leaf = [(-HW + CBU - e, PZ), (HW - CBU + e, PZ), (HW, CBZ), (HW, ZO - CT), (HW - CT, ZO), (-HW + CT, ZO),
            (-HW, ZO - CT), (-HW, CBZ)]

    def moved(poly, du, dz):
        return [(u + du, z + dz) for u, z in poly]
    if kind == "slide":
        parts = [_clip(moved(leaf, 2 * HW * t, 0.0), 1, 0, HW)]
    elif kind == "split":
        parts = [_clip(moved(_clip(leaf, 1, 0, 0.0), -HW * t, 0.0), -1, 0, HW),
                 _clip(moved(_clip(leaf, -1, 0, 0.0), HW * t, 0.0), 1, 0, HW)]
    elif kind == "shutter":
        parts = [_clip(moved(leaf, 0.0, (ZO - PZ) * t), 0, 1, ZO)]
    else:                                               # halves: the shutter's half-open top part, and under it a
        b0, b1, s = -HW + CBU - e, HW - CBU + e, 1.5 * PZ   # bottom part mating with its edge (a px seam between
        dz = ZO - CBZ - (ZO - PZ) / 2 + s               # them; the shutter's halves' heights swapped: the bottom
                                                        # one the shorter); they open up into the header and down
                                                        # into the floor
        top = _clip(moved(leaf, 0.0, dz), 0, 1, ZO)
        bottom = [[(b0, PZ), (b1, PZ), (b1, PZ + dz - s), (b0, PZ + dz - s)],
                  [(-HW, CBZ), (b0, PZ), (b0, PZ + dz - s), (-HW, CBZ + dz - s)],
                  [(b1, PZ), (HW, CBZ), (HW, CBZ + dz - s), (b1, PZ + dz - s)]]
        top = _windowed([top], 0.0, (PZ + dz + ZO) / 2)            # (a window in each half's middle)
        band = [(q, -0.05, BAND) for p in bottom for q in _minus(p, moved(p, 0.0, -TRIM * PZ))] if band else []
        bottom = _windowed(bottom, 0.0, (PZ + PZ + dz - s) / 2) + band    # (band: an accent band along the bottom
                                                                          # half's top edge, a hair proud of it)
        top.append((_handle((PZ + dz + ZO) / 2), -1, HANDLE))     # (a grab bar beside each window)
        zl = (PZ + dz + (PZ + dz + ZO) / 2 - WIN[1] * PZ / 2) / 2  # (the lamp: under the top window, midway to
        lw, lh = LAMP[0] * PU / 2, LAMP[1] * PZ / 2              # the half's edge)
        lamp = [(-lw, zl - lh), (lw, zl - lh), (lw, zl + lh), (-lw, zl + lh)]
        top.append((lamp, -1, LAMP_T))                 # (in a dark housing LAMP_B px round it, its corner px off,
        bw, bh = lw + LAMP_B * PU, lh + LAMP_B * PZ     # both a px proud)
        box = [_rect(-bw + PU, bw - PU, zl - bh, zl + bh), _rect(-bw, -bw + PU, zl - bh + PZ, zl + bh - PZ),
               _rect(bw - PU, bw, zl - bh + PZ, zl + bh - PZ)]
        top += [(q, -1, HOUSING) for p in box for q in _minus(p, lamp)]
        bottom.append((_handle((PZ + PZ + dz - s) / 2), -1, HANDLE))
        up, down = (ZO - PZ - dz) * t, (dz + CBZ) * t
        parts = [(_clip(moved(p, 0.0, up), 0, 1, ZO), r, c) for p, r, c in top]
        parts += [(_clip(moved(p, 0.0, -down), 0, -1, -PZ), r, c or SEAM) for p, r, c in bottom]
        return [(p, r, c) for p, r, c in parts if p]
    return [(p, 0, None) for p in parts if p]


SEAM = "seam"          # (a bottom half's part: its upper edges are the seam's floor, drawn in shadow)
HANDLE = "handle"      # (a leaf's grab bar: a px proud of it, in the frame's tones)
LAMP_T = "lamp"        # (the top half's status lamp, a px proud of it)
HOUSING = "housing"    # (the lamp's dark housing)
BAND = "band"          # (the leaf's accent band)
TRIM = 2               # its height, px
LAMP_B = 2             # the housing's border round the lamp, px
HANDLE_H = 6           # its height, px


def _handle(zc):
    """A grab bar at the leaf's -u side (the +u one is hidden behind the front lip), between the window and the
    jamb, centred at height zc."""
    u0, u1, h = -HW + 2 * PU, -HW + 3 * PU, HANDLE_H * PZ / 2
    return [(u0, zc - h), (u1, zc - h), (u1, zc + h), (u0, zc + h)]


HAZ = 4                # the floor's hazard bands, px wide (along the wall)
SLANT = -7 / 10         # their lean: the u shift per v (-7/10: about 20 degrees off vertical on screen)
LAMP = (4, 2)          # the status lamp, px wide and high


def _rect(u0, u1, z0, z1):
    return [(u0, z0), (u1, z0), (u1, z1), (u0, z1)]


LIGHT = 6              # the opening's side lights' height, px (as the handles)
SLOT_W = 4             # the frame's side slots' width, px


def _lights():
    """The side lights' feet: three up the opening's straight side, the end ones at its ends (the cuts), the middle
    one midway between where they stood a px in from them."""
    z0, z1 = CBZ + PZ, ZO - CT - PZ - LIGHT * PZ
    zs = [round((z0 + (z1 - z0) * i / 2) / PZ) * PZ for i in range(3)]
    return [zs[0] - PZ, zs[1], zs[2] + PZ]


RB = 2                 # the header's recess: its border, px (round the frame's edge and the opening's)


def _recess(hf):
    """The header's recess (a px deep in the frame's face) as convex pieces: the face from the top cuts' foot up,
    RB px in from the frame's edges and the opening's (a triangle beside each cut, a band over the opening)."""
    o = [(-HW + CBU, 0.0), (HW - CBU, 0.0), (HW, CBZ), (HW, ZO - CT), (HW - CT, ZO), (-HW + CT, ZO), (-HW, ZO - CT),
         (-HW, CBZ)]
    px = [(u / PU, z / PZ) for u, z in o]               # (the opening grown RB px, in px: mitred)
    grown = []
    for i, (u, z) in enumerate(px):
        (au, az), (bu, bz) = px[i - 1], px[(i + 1) % len(px)]
        n1, n2 = (z - az, -(u - au)), (bz - z, -(bu - u))
        l1, l2 = math.hypot(*n1), math.hypot(*n2)
        a, b, c, d = n1[0] / l1, n1[1] / l1, n2[0] / l2, n2[1] / l2
        m = 1 + a * c + b * d
        grown.append(((u + RB * (a + c) / m) * PU, (z + RB * (b + d) / m) * PZ))
    out = _minus(_rect(-0.5 + RB * PU, 0.5 - RB * PU, ZO - CT, hf - RB * PZ), grown)
    for s in (-1, 1):                                   # a column RB px wide (left at the face's level) at each end
        u = s * round(grown[4][0] / PU) * PU            # of the band, where it meets the slopes
        col = _rect(u - RB * PU, u, ZO, hf) if s > 0 else _rect(u, u + RB * PU, ZO, hf)
        out = [q for p in out for q in _minus(p, col)]
    return out


def _lip(hf, recess):
    """A lip's convex pieces in (u, z): the jambs, the header, the corners' cuts; less the recess if `recess`."""
    out = [_rect(-0.5, -HW, 0.0, hf), _rect(HW, 0.5, 0.0, hf), _rect(-HW, HW, ZO, hf),
           [(-HW, ZO - CT), (-HW + CT, ZO), (-HW, ZO)], [(HW, ZO - CT), (HW, ZO), (HW - CT, ZO)],
           [(-HW, 0.0), (-HW + CBU, 0.0), (-HW, CBZ)], [(HW - CBU, 0.0), (HW, 0.0), (HW, CBZ)]]
    for r in (_recess(hf) if recess else []):
        out = [q for p in out for q in _minus(p, r)]
    return out


def door(axis="x", is_open=False, leaf="slide", t=None, look="block", frame="plain"):
    """The door piece; t (0 .. 1) its leaf's open fraction (is_open: 1); look "block" (the blockout's greys) or
    "metal" (a neutral steel frame, a gunmetal leaf, blue glass: it goes with any wall)."""
    t = (1.0 if is_open else 0.0) if t is None else t
    vb, vw, _, _ = D.planes()
    hf, zs, run = W.HF, W.skirt_top(), W.skirt_run()
    k = _Mesh(f"door_block_{axis}_{leaf}_{t:.2f}", axis, vw, hf)
    metal = look == "metal"
    k.prefix = "df" if metal else "bk"
    k.cap = W3.CUT if metal else None                   # (metal: the top dark, as the walls' cut tops)
    k.side = 2 if metal else 0                          # (metal: the sides two shades darker)
    vc, sw = (vb + vw) / 2, SLOT_W * PU / 2             # (metal: slots a px deep down the frame's sides, Space
    slots = [(vc - sw, vc + sw, z0, z1) for z0, z1 in   # Haven's door II: a long one over the skirt's top, a short
             ((((zs // PZ) + 3) * PZ, hf - 8 * PZ), (3 * PZ, ((zs // PZ) - 2) * PZ))] if metal else []   # one under
    k.holes = slots                                     # it, SLOT_W px wide mid-depth)
    face = _tone(k.G(0, 1, 0)) + "l"                    # (a shade lighter than the frame's face)
    for v0, v1 in ((vb, vb + LIP), (vw - FRONT, vw - PU), (vw - PU, vw)):   # the lips: the jambs, the header,
        k.edge = face if v1 == vw else None             # the corners' cuts; the front px of the opening's sides
                                                        # a shade lighter than the face
        for q in _lip(hf, metal and v1 == vw):          # (metal: the front px less the header's recess)
            k.prism(q, v0, v1)
    k.edge = None
    if metal:                                           # the face's top px lit (the top's own tone), as a bevel
        k.poly([(-0.5, vw + 1e-3, hf - PZ), (0.5, vw + 1e-3, hf - PZ), (0.5, vw + 1e-3, hf), (-0.5, vw + 1e-3, hf)],
               face[:-1].replace("Y", "T").replace("X", "T"))
        for s in (-1, 1):                               # amber lights down the opening's sides, the front lip's
            for z in _lights():                         # depth less a px wide
                u = s * (HW - 1e-3)
                v0, v1 = vw - FRONT, vw - PU            # (a px short of the frame's face)
                k.poly([(u, v0, z), (u, v1, z), (u, v1, z + LIGHT * PZ), (u, v0, z + LIGHT * PZ)], "dLmA")
        for q in _recess(hf):                           # the recess's floor a shade darker than the face
            k.poly([(u, vw - PU + 1e-3, z) for u, z in q], face[:-1] + "d")
    k.box(-0.5, -HW - PU, vb + LIP, vw - FRONT, 0.0, hf)  # between them, the frame's inside a px back
    k.box(HW + PU, 0.5, vb + LIP, vw - FRONT, 0.0, hf)
    k.box(-HW - PU, HW + PU, vb + LIP, vw - FRONT, ZO + PZ, hf)
    k.holes = []
    for s in (-1, 1):                                   # the slots, dark
        u0, u1 = s * 0.5, s * (0.5 - PU)
        for a, b, z0, z1 in slots:
            k.poly([(u1, a, z0), (u1, b, z0), (u1, b, z1), (u1, a, z1)], "dSlot")
            k.poly([(u0, a, z0), (u1, a, z0), (u1, b, z0), (u0, b, z0)], "dSlot")
            k.poly([(u0, a, z1), (u0, b, z1), (u1, b, z1), (u1, a, z1)], "dSlot")
            k.poly([(u0, a, z0), (u0, a, z1), (u1, a, z1), (u1, a, z0)], "dSlot")
            k.poly([(u0, b, z0), (u1, b, z0), (u1, b, z1), (u0, b, z1)], "dSlot")
    ft = W.foot()
    for a, b in ((-0.5, -0.5 + PU), (0.5 - PU, 0.5)):   # the feet: the skirt's section, a px thick, at the tile's
        for v, r in ((vw, run), (vb, -run)):            # edges, front and back (its slope onto the upright foot)
            k.poly([(a, v, zs), (b, v, zs), (b, v + r, ft), (a, v + r, ft)])
            k.poly([(a, v + r, 0.0), (b, v + r, 0.0), (b, v + r, ft), (a, v + r, ft)])
            k.poly([(a, v, 0.0), (a, v + r, 0.0), (a, v + r, ft), (a, v, zs)])
            k.poly([(b, v, 0.0), (b, v, zs), (b, v + r, ft), (b, v + r, 0.0)])
    k.box(-HW, HW, vb, vw, 0.0, PZ)                     # the threshold: a px high, the bottom cuts' feet joined
    if metal:                                           # the floor between the feet, front and back, in hazard bands
        u0, u1 = -0.5 + PU, 0.5 - PU                    # slanted SLANT (their spacing along the wall so that they
        w = HAZ * PU * max(1.0, abs(SLANT))             # stay about HAZ px thick)
        for v0, v1 in ((vw, vw + run), (vb - run, vb)):
            d = SLANT * (v1 - v0)
            m = int(abs(d) / w) + 2
            for i in range(-m, int((u1 - u0) / w) + m):
                a = u0 + i * w
                q = [(a, v0), (a + w, v0), (a + w - d, v1), (a - d, v1)]
                q = _clip(q, -1, 0, -u0)
                q = q and _clip(q, 1, 0, u1)
                if q:
                    k.poly([(u, v, 2e-3) for u, v in q], "dHzY" if i % 2 == 0 else "dHzK")
        b0, b1, v0, v1 = -HW, HW, vb + LIP, vw - FRONT + PU  # the slot the bottom half sinks into, jamb to jamb,
        k.poly([(b0, v0, PZ + 1e-3), (b1, v0, PZ + 1e-3), (b1, v1, PZ + 1e-3), (b0, v1, PZ + 1e-3)], "dSlot")  # (a
                                                        # px of it in front of the leaf)
        from . import door_frame
        door_frame.trim(k, frame, vw, hf, face[:-1])    # (the frame's face treatment)
    for part, recess, tone in leaf_parts(leaf, t, metal):   # the leaf, the opening's shape,
                                                        # filling the gap between
        seam = tone == SEAM                             # the lips (its window's parts set back)
        k.prefix = ("df" if tone == HANDLE else "dl") if metal else "bk"
        if metal:
            tone = {LAMP_T: "dLmG", HOUSING: "dHzK", BAND: "dAcc"}.get(tone, tone)
        tone = None if tone in (SEAM, HANDLE, LAMP_T, HOUSING, BAND) else tone
        k.prism(part, vb + LIP, vw - FRONT - recess * PU, tone, "bkXdd" if seam else None)
    return [k.m.build()]
