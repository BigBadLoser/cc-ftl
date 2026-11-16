"""Station hull look, prototype (#524; family `station_hull`): the free-floating station's hull from outside (roofed)
on its platform belly. After Space Haven's station hull 1144 (a design reference only: our own geometry here): a
block at the ship hull's height and footprint (tile.hull.ext: out to the outline E, the roof's height), its outer
edge rounded over into the top (a bullnose all along it), the outer corner cut on the diagonal, and under the deck a
dark platform: a pedestal with posts round it on a wider base plate.

Ids follow the faction looks' scheme (structure.py: tile.<fam>.<look>.<rest of the default id>), look `station`:

  tile.hull.station.ext.o<o>.m<mask>        the upper hull (as tile.hull.ext.o<o>.m<mask>: o 1 space at +y, 2 at +x,
                                            3 both, the outer corner; mask the hull ring's neighbours)
  tile.hull.station.belly.under.<key>       the platform under it (as tile.hull.belly.under.<key>, by hull key)

The prototype renders the straight runs (o1.m10 along x, o2.m5 along y) and the outer corner (o3.m9), each belly by
its key. Geometry: a piece's outer face is a chain of plan lines (CHAINS) clipped at the tile's edges; the section
(the face upright, then ROUND facets over into the top) is laid along it, each level's line moved in and mitred."""
import math

from mathutils import Vector

from . import core
from . import walls as W
from . import wall3d as T

E = 0.5 - 1 / 32                    # the outline (the ship hull's: wall3d_ext_geom.E)
H = None                            # the top: the roof's height (walls.hull_top(), set on first use)
R_D, R_Z = 0.36, 0.36               # the bullnose: this far in along the top, this far down the face (tiles)
ROUND = 5                           # its facets
PLINTH = 0.32                       # the face's foot: a band this high, a px proud, its top edge lit
SEAMS = (1 / 3, 2 / 3)              # upright seams along a straight run, as fractions of the tile
LINE = 1 / 32
FACE, PLINTH_COL, PLINTH_TOP, SEAM, END = "hsS", "hsM", "hsH", "hsD", "hsXD"
ROUND_COLS = ("hsS", "hsL", "hsL", "hsH", "hsW")   # the bullnose from the face up to the top
TOP_COL, TOP_LINE = "hsH", "hsL"
# the platform (under the deck)
PED_Z, PLATE_Z = -0.30, -0.42       # the pedestal from the deck down to PED_Z; the plate under it to PLATE_Z
PLATE_OUT = 3 / 32                  # the plate past the pedestal's face
POST_W, POST_N = 3 / 32, 4          # posts down the pedestal's face: this wide, this many a tile
PED_FACE, PED_TOP, POST, PLATE_FACE, PLATE_TOP, PLATE_EDGE = "hbRim", "hbRim", "hbD", "hbRim", "hbK", "hbM"
BUMP_W, BUMP_D, BUMP_H, BUMP_N = 4 / 32, 2 / 32, 0.10, 3   # light blocks along the face's foot: wide, proud, tall,
BUMP_FACE, BUMP_TOP = "hsL", "hsW"                          # this many a tile

# (lines as (point, direction) in plan; the chain runs with the outside on its right; clips: the tile's edges at its
# ends; back: the footprint's points behind the chain, closing the top)
CHAINS = {
    (10, 1): {"lines": [((0.0, E), (-1.0, 0.0))], "clips": [((0.5, 0.0), (0.0, 1.0)), ((-0.5, 0.0), (0.0, 1.0))],
              "back": [(-0.5, -0.5), (0.5, -0.5)]},
    (5, 2): {"lines": [((E, 0.0), (0.0, 1.0))], "clips": [((0.0, -0.5), (1.0, 0.0)), ((0.0, 0.5), (1.0, 0.0))],
             "back": [(-0.5, 0.5), (-0.5, -0.5)]},
    (9, 3): {"lines": [((E, 0.0), (0.0, 1.0)), ((E, 0.0), (-1.0, 1.0)), ((0.0, E), (-1.0, 0.0))],
             "clips": [((0.0, -0.5), (1.0, 0.0)), ((-0.5, 0.0), (0.0, 1.0))],
             "back": [(-0.5, -0.5)]},
}
STRAIGHT = {(10, 1): (1, 0), (5, 2): (0, 1)}


def _top():
    global H
    if H is None:
        H = W.hull_top()
    return H


def _meet(l1, l2):
    (p, d), (q, e) = l1, l2
    den = d[0] * e[1] - d[1] * e[0]
    t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den
    return (p[0] + d[0] * t, p[1] + d[1] * t)


def _inward(d):
    """The inward normal of a chain line (the outside on its right)."""
    n = math.hypot(*d)
    return (-d[1] / n, d[0] / n)


def _chain(key, inset):
    """The chain's points with every line moved `inset` in: the start clip's meet, the joins, the end clip's."""
    c = CHAINS[key]
    ls = []
    for p, d in c["lines"]:
        n = _inward(d)
        ls.append(((p[0] + n[0] * inset, p[1] + n[1] * inset), d))
    pts = [_meet(c["clips"][0], ls[0])]
    pts += [_meet(a, b) for a, b in zip(ls, ls[1:])]
    pts.append(_meet(ls[-1], c["clips"][1]))
    return pts


def _section():
    """The outer section as (inset, z, colour of the strip up to the next): the face, its bullnose, the top."""
    h = _top()
    out = [(0.0, 0.0, FACE)]
    for i in range(ROUND + 1):
        a = math.pi / 2 * i / ROUND
        out.append((R_D * (1 - math.cos(a)), h - R_Z + R_Z * math.sin(a), ROUND_COLS[i] if i < ROUND else None))
    return out


def _out(p, q, z):
    """The outward normal of a strip between plan points p -> q (the chain's right)."""
    d = (q[0] - p[0], q[1] - p[1])
    n = _inward(d)
    return Vector((-n[0], -n[1], z))


def upper(key, name):
    """The upper hull of a run set piece: its Relief's objects."""
    k = T.Relief(name)
    sec = _section()
    lv = [(_chain(key, d), z, col) for d, z, col in sec]
    for (pa, za, col), (pb, zb, _) in zip(lv, lv[1:]):          # the face and the bullnose, strip by strip
        for i in range(len(pa) - 1):
            out = _out(pa[i], pa[i + 1], 0.0 if za < _top() - R_Z - 1e-6 else 0.5)
            k.poly([Vector((*pa[i], za)), Vector((*pa[i + 1], za)), Vector((*pb[i + 1], zb)), Vector((*pb[i], zb))],
                   "steel", 2, out, fixed=col)
    top = lv[-1][0]
    h = _top()
    k.poly([Vector((*p, h)) for p in top + CHAINS[key]["back"]], "steel", 2, Vector((0, 0, 1)), fixed=TOP_COL)
    lines = CHAINS[key]["lines"]
    for j, sg in ((0, -1), (-1, 1)):                            # the ends at the tile's edges (the section)
        prof = [Vector((*pts[j], z)) for pts, z, _ in lv]
        bk = CHAINS[key]["back"][0 if j == -1 else -1]
        prof += [Vector((*bk, h)), Vector((*bk, 0.0))]
        cd = lines[j][1]
        k.poly(prof, "steel", 2, Vector((cd[0] * sg, cd[1] * sg, 0.0)), fixed=END)
    _details(k, key)
    return k.build()


def _details(k, key):
    """The face's plinth (a px proud, its top edge lit), its upright seams, the top's line along the bullnose."""
    e = T.PAINT
    base = _chain(key, 0.0)
    proud = _chain(key, -LINE)
    for i in range(len(base) - 1):
        out = _out(base[i], base[i + 1], 0.0)
        k.poly([Vector((*proud[i], 0.0)), Vector((*proud[i + 1], 0.0)), Vector((*proud[i + 1], PLINTH)),
                Vector((*proud[i], PLINTH))], "steel", 2, out, fixed=PLINTH_COL)
        k.poly([Vector((*proud[i], PLINTH)), Vector((*proud[i + 1], PLINTH)), Vector((*base[i + 1], PLINTH)),
                Vector((*base[i], PLINTH))], "steel", 2, Vector((0, 0, 1)), fixed=PLINTH_TOP)
    if key in STRAIGHT:                                         # upright seams, painted on the face
        p, q = base[0], base[1]
        n = _out(p, q, 0.0) * e
        for f in SEAMS:
            a = [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]
            dx, dy = (q[0] - p[0]), (q[1] - p[1])
            ln = math.hypot(dx, dy)
            w = (dx / ln * LINE / 2, dy / ln * LINE / 2)
            z0, z1 = PLINTH, _top() - R_Z
            k.poly([Vector((a[0] - w[0] + n.x, a[1] - w[1] + n.y, z0)), Vector((a[0] + w[0] + n.x, a[1] + w[1] + n.y, z0)),
                    Vector((a[0] + w[0] + n.x, a[1] + w[1] + n.y, z1)), Vector((a[0] - w[0] + n.x, a[1] - w[1] + n.y, z1))],
                   "steel", 2, n, fixed=SEAM)
    for i in range(len(base) - 1):                              # light blocks along the foot, on the plinth
        p, q = proud[i], proud[i + 1]
        dx, dy = q[0] - p[0], q[1] - p[1]
        ln = math.hypot(dx, dy)
        o = _out(p, q, 0.0)
        u = (dx / ln, dy / ln)
        for j in range(max(1, round(BUMP_N * ln))):
            c = (p[0] + dx * (j + 0.5) / max(1, round(BUMP_N * ln)), p[1] + dy * (j + 0.5) / max(1, round(BUMP_N * ln)))
            a0 = (c[0] - u[0] * BUMP_W / 2, c[1] - u[1] * BUMP_W / 2)
            a1 = (c[0] + u[0] * BUMP_W / 2, c[1] + u[1] * BUMP_W / 2)
            f0 = (a0[0] + o.x * BUMP_D, a0[1] + o.y * BUMP_D)
            f1 = (a1[0] + o.x * BUMP_D, a1[1] + o.y * BUMP_D)
            k.poly([Vector((*f0, 0.0)), Vector((*f1, 0.0)), Vector((*f1, BUMP_H)), Vector((*f0, BUMP_H))], "steel", 2, o,
                   fixed=BUMP_FACE)
            k.poly([Vector((*a0, BUMP_H)), Vector((*a1, BUMP_H)), Vector((*f1, BUMP_H)), Vector((*f0, BUMP_H))], "steel",
                   2, Vector((0, 0, 1)), fixed=BUMP_TOP)
            for a_, f_, sg in ((a0, f0, -1), (a1, f1, 1)):
                k.poly([Vector((*a_, 0.0)), Vector((*f_, 0.0)), Vector((*f_, BUMP_H)), Vector((*a_, BUMP_H))], "steel",
                       2, Vector((u[0] * sg, u[1] * sg, 0)), fixed=PLINTH_COL)
    ln = _chain(key, R_D + 3 / 32)                              # a line along the top, in from the bullnose
    ln2 = _chain(key, R_D + 4 / 32)
    h = _top() + 0.002
    for i in range(len(ln) - 1):
        k.poly([Vector((*ln[i], h)), Vector((*ln[i + 1], h)), Vector((*ln2[i + 1], h)), Vector((*ln2[i], h))],
               "steel", 2, Vector((0, 0, 1)), fixed=TOP_LINE)


def belly(key, name):
    """The platform under a piece: the pedestal under the hull's footprint (its posts down the outer faces) on a
    plate a little wider."""
    k = T.Relief(name)
    ped = _chain(key, 0.0)
    plate = _chain(key, -PLATE_OUT)
    back = CHAINS[key]["back"]
    for pts, z0, z1, face, top in ((ped, PED_Z, 0.0, PED_FACE, PED_TOP), (plate, PLATE_Z, PED_Z, PLATE_FACE, PLATE_TOP)):
        for i in range(len(pts) - 1):
            k.poly([Vector((*pts[i], z0)), Vector((*pts[i + 1], z0)), Vector((*pts[i + 1], z1)), Vector((*pts[i], z1))],
                   "steel", 2, _out(pts[i], pts[i + 1], 0.0), fixed=face)
        k.poly([Vector((*p, z1 - 0.001)) for p in pts + back], "steel", 2, Vector((0, 0, 1)), fixed=top)
    for i in range(len(plate) - 1):                             # the plate's lit top edge
        a, b = plate[i], plate[i + 1]
        a2, b2 = _chain(key, -PLATE_OUT + LINE)[i:i + 2]
        k.poly([Vector((*a, PED_Z + 0.001)), Vector((*b, PED_Z + 0.001)), Vector((*b2, PED_Z + 0.001)),
                Vector((*a2, PED_Z + 0.001))], "steel", 2, Vector((0, 0, 1)), fixed=PLATE_EDGE)
    for i in range(len(ped) - 1):                               # the posts
        p, q = ped[i], ped[i + 1]
        dx, dy = q[0] - p[0], q[1] - p[1]
        ln = math.hypot(dx, dy)
        n = max(1, round(POST_N * ln))
        o = _out(p, q, 0.0)
        for j in range(n):
            f = (j + 0.5) / n
            c = (p[0] + dx * f, p[1] + dy * f)
            u = (dx / ln * POST_W / 2, dy / ln * POST_W / 2)
            s = (o.x * LINE, o.y * LINE)
            quad = [(c[0] - u[0] + s[0], c[1] - u[1] + s[1]), (c[0] + u[0] + s[0], c[1] + u[1] + s[1])]
            k.poly([Vector((*quad[0], PED_Z)), Vector((*quad[1], PED_Z)), Vector((*quad[1], -0.02)),
                    Vector((*quad[0], -0.02))], "steel", 2, o, fixed=POST)
    return k.build()


def _wide(key, build):
    """(own, wide): a straight run with a copy a tile either way along it (its edge px resolve as mid-run)."""
    own = build(key, "st_own")
    more = []
    if key in STRAIGHT:
        dx, dy = STRAIGHT[key]
        for s in (-1, 1):
            for ob in build(key, f"st_{s}"):
                ob.location = ob.location + core.G(s * dx, s * dy, 0.0)
                more.append(ob)
    return own, own + more


BELLY_KEY = {(10, 1): "0_1_15", (5, 2): "1_0_15", (9, 3): "0_1_15~1_0_15"}   # (hull_outline.name of each piece's key)


def _item(sid, build):
    from . import env_build, post
    core.clear_scene_meshes()
    post.select("hull")
    it = env_build.crop_item(sid, (1, 1), *env_build.render_sprite(sid, "wide", build()))
    return [it] if it else []


def jobs():
    out = []
    for (m, o), key in BELLY_KEY.items():
        out.append(lambda m=m, o=o: _item(f"tile.hull.station.ext.o{o}.m{m}", lambda: _wide((m, o), upper)))
        out.append(lambda m=m, o=o, key=key: _item(f"tile.hull.station.belly.under.{key}",
                                                   lambda: _wide((m, o), belly)))
    return out
