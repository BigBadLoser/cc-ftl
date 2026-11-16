"""Station hull look (#524; family `station_hull`): a station's hull from outside (roofed), on the ship hull's own belly.
After the user's station hull reference (design reference only: our own geometry here): a block at the ship hull's
height and footprint (tile.hull.ext: out to the outline E, the roof's height), its outer edge rounded over into the
top in a big bullnose, two seams a tile running up the face and over the bullnose onto the top, a groove near the
foot with tabs where the seams cross it, a row of chunky light blocks along the foot, and a line along the top's inner
edge. Its own palette set (`station`, a darker blue-grey than the ship hull's).

Ids follow the faction looks' scheme (structure.py: tile.<fam>.<look>.<rest of the default id>), look `station`:

  tile.hull.station.ext.o<o>.m<mask>   the upper hull (as tile.hull.ext.o<o>.m<mask>: o 1 space at +y, 2 at +x, 3 both,
                                       the outer corner; mask the hull ring's neighbours); the belly is the ship's.

Geometry: a piece's outer face is a chain of plan lines (CHAINS) clipped at the tile's edges; the section (the face
upright, then ROUND facets over into the top) is laid along it, each level's line moved in and mitred. Detail is
painted on that section (a flat inlay a hair out along each strip's normal) or stands proud of it."""
import math

from mathutils import Vector

from . import core
from . import walls as W
from . import wall3d as T

E = 0.5 - 1 / 32                    # the outline (the ship hull's: wall3d_ext_geom.E)
DEPTH = E + 0.5                     # the block from its outer face back to the tile's back edge
H = None                            # the top: the roof's height (walls.hull_top(), set on first use)
R_D, R_Z = 0.32, 0.46               # the bullnose: this far in along the top, this far down the face (tiles)
ROUND = 16                          # its facets
LINE = 1 / 32                       # one art px along the run
SEAMS = (0.25, 0.75)                # seams along a straight run, as fractions of the tile
GROOVE = 0.40                       # the groove's height over the deck
RAIL = 5 / 32                       # the line along the top's inner edge: this far in from the back
FOOT_N, FOOT_W, FOOT_OUT, FOOT_H = 3, 0.26, 3 / 32, 0.15   # the foot blocks: a tile, wide, proud, tall

FACE, FACE_LO, END = "stS", "stL", "stE"   # the face, its band under the groove, the ends
LEDGE, LEDGE_H = "stW", 2                   # the bright ledge along the foot: colour, px tall
HATCH_D, HATCH_L = "stM", "stH"             # the hatch's outline: dark line, lit line inside/under it
# the bullnose's bands from its top edge down to the face: colour, share of the arc (the lightest the widest)
ROUND_BANDS = (("stW", 0.36), ("stB", 0.26), ("stH", 0.18), ("stL", 0.12), ("stS", 0.08))
PLUMB_LEVEL = 3                     # the bullnose level at the stL band's top: seams stand plumb on screen below it
TOP = "stL"
SEAM_D, SEAM_L = "stM", "stH"
GROOVE_D, GROOVE_L = "stD", "stH"
TAB, TAB_TOP, TAB_SIDE = "stB", "stW", "stH"
FOOT, FOOT_TOP, FOOT_SIDE = "stB", "stW", "stH"
RAIL_D, RAIL_L = "stM", "stW"

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
# per piece: (segment, its seams as fractions along it, its hatch's span or None)
PANELS = {(10, 1): [(0, SEAMS, (SEAMS[0] + 3 * LINE, SEAMS[1] - 2 * LINE))],
          (5, 2): [(0, SEAMS, (SEAMS[0] + 3 * LINE, SEAMS[1] - 2 * LINE))],
          (9, 3): [(1, (1.5 * LINE, 1 - 1.5 * LINE), (0.22, 0.78))]}


def _top():
    global H
    if H is None:
        H = W.hull_top()
    return H


def _pz():
    return 1 / core.ZPX


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


def _bullnose():
    """The bullnose's levels (inset, z), from the face's top to the top's edge."""
    h = _top()
    return [(R_D * (1 - math.cos(math.pi / 2 * i / ROUND)), h - R_Z + R_Z * math.sin(math.pi / 2 * i / ROUND))
            for i in range(ROUND + 1)]


def _band(t):
    """The bullnose's colour at t along its arc from the top edge (0) to the face (1)."""
    for col, w in ROUND_BANDS:
        if t < w:
            return col
        t -= w
    return ROUND_BANDS[-1][0]


def _section():
    """The outer section as (inset, z, colour of the strip up to the next): the face, its bullnose (the top after)."""
    out = [(0.0, 0.0, FACE_LO), (0.0, GROOVE, FACE)]
    bn = _bullnose()
    for i, (d, z) in enumerate(bn):
        out.append((d, z, _band(1 - (i + 0.5) / ROUND) if i < ROUND else None))
    return out


def _seg_out(key, i):
    """The outward plan normal of the chain's segment i."""
    d = CHAINS[key]["lines"][i][1]
    n = _inward(d)
    return (-n[0], -n[1])


def _sx(pp, f):
    """The screen x (in plan units: x - y) of fraction f along the segment pp, and its rate along f."""
    a = pp[0][0] - pp[0][1]
    return a, (pp[1][0] - pp[1][1]) - a


def _plumb(key, i, f, d, keep):
    """Fraction f at inset d, moved along segment i so that below inset `keep` it stands plumb on screen under where f
    is at `keep` (a line that runs straight down there rather than following the bullnose in)."""
    if keep is None or d >= keep:
        return f
    a0, b0 = _sx(_chain(key, keep)[i:i + 2], f)
    a, b = _sx(_chain(key, d)[i:i + 2], f)
    return (a0 + b0 * f - a) / b


def _paint(k, key, i, f0, f1, levels, col, lift=None, keep=None):
    """Paint the band f0..f1 (fractions along segment i) over the section levels [(inset, z), ...], a hair out along
    each strip's normal; below inset `keep` the band stands plumb on screen (_plumb)."""
    lift = T.PAINT if lift is None else lift
    o = _seg_out(key, i)
    for (da, za), (db, zb) in zip(levels, levels[1:]):
        no, nz = zb - za, db - da                           # the strip's normal in (out, z)
        ln = math.hypot(no, nz)
        if ln < 1e-9:
            continue
        no, nz = no / ln * lift, nz / ln * lift
        n = Vector((o[0] * no, o[1] * no, nz))
        pa, pb = _chain(key, da)[i:i + 2], _chain(key, db)[i:i + 2]

        def at(pp, f):
            return (pp[0][0] + (pp[1][0] - pp[0][0]) * f, pp[0][1] + (pp[1][1] - pp[0][1]) * f)
        a0, a1 = _plumb(key, i, f0, da, keep), _plumb(key, i, f1, da, keep)
        b0, b1 = _plumb(key, i, f0, db, keep), _plumb(key, i, f1, db, keep)
        q = [Vector((*at(pa, a0), za)), Vector((*at(pa, a1), za)), Vector((*at(pb, b1), zb)), Vector((*at(pb, b0), zb))]
        k.poly([v + n for v in q], "steel", 2, n, fixed=col)


def _box(k, key, i, f0, f1, z0, z1, out, face, top, side, inset=0.0):
    """A block standing `out` proud of the face over f0..f1 of segment i, z0..z1 (its back at `inset`)."""
    o = _seg_out(key, i)
    p = _chain(key, inset)[i:i + 2]

    def at(f, d):
        x = p[0][0] + (p[1][0] - p[0][0]) * f
        y = p[0][1] + (p[1][1] - p[0][1]) * f
        return (x + o[0] * d, y + o[1] * d)
    a0, a1, b0, b1 = at(f0, 0), at(f1, 0), at(f0, out), at(f1, out)
    up = Vector((0, 0, 1))
    k.poly([Vector((*b0, z0)), Vector((*b1, z0)), Vector((*b1, z1)), Vector((*b0, z1))], "steel", 2,
           Vector((o[0], o[1], 0)), fixed=face)
    k.poly([Vector((*a0, z1)), Vector((*a1, z1)), Vector((*b1, z1)), Vector((*b0, z1))], "steel", 2, up, fixed=top)
    u = (p[1][0] - p[0][0], p[1][1] - p[0][1])
    for a, b, sg in ((a0, b0, -1), (a1, b1, 1)):
        k.poly([Vector((*a, z0)), Vector((*b, z0)), Vector((*b, z1)), Vector((*a, z1))], "steel", 2,
               Vector((u[0] * sg, u[1] * sg, 0)), fixed=side)


def upper(key, name):
    """The upper hull of a run set piece: its Relief's objects."""
    k = T.Relief(name)
    h = _top()
    sec = _section()
    lv = [(_chain(key, d), z, col) for d, z, col in sec]
    for (pa, za, col), (pb, zb, _) in zip(lv, lv[1:]):          # the face and the bullnose, strip by strip
        for i in range(len(pa) - 1):
            o = _seg_out(key, i)
            k.poly([Vector((*pa[i], za)), Vector((*pa[i + 1], za)), Vector((*pb[i + 1], zb)), Vector((*pb[i], zb))],
                   "steel", 2, Vector((o[0], o[1], 0.0 if za < h - R_Z - 1e-6 else 0.5)), fixed=col)
    k.poly([Vector((*p, h)) for p in lv[-1][0] + CHAINS[key]["back"]], "steel", 2, Vector((0, 0, 1)), fixed=TOP)
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
    h, pz = _top(), _pz()
    segs = len(CHAINS[key]["lines"])
    bn = _bullnose()
    rail = DEPTH - RAIL
    for i in range(segs):                                       # the groove near the foot, all along
        _paint(k, key, i, 0.0, 1.0, [(0.0, GROOVE), (0.0, GROOVE + pz)], GROOVE_D)
        _paint(k, key, i, 0.0, 1.0, [(0.0, GROOVE - pz), (0.0, GROOVE)], GROOVE_L)
        _paint(k, key, i, 0.0, 1.0, [(rail - LINE, h), (rail, h)], RAIL_L)      # the line along the top's inner edge
        _paint(k, key, i, 0.0, 1.0, [(rail, h), (rail + LINE, h)], RAIL_D)
    zt = h - R_Z - 3 * pz                                       # the line under the bullnose
    up = [(0.0, GROOVE + 3 * pz), (0.0, h - R_Z)] + bn + [(rail - LINE, h)]
    keep = bn[PLUMB_LEVEL][0]                                   # the seams stand plumb from the stL band's top down
    for i, seams, hatch in PANELS[key]:
        p = _chain(key, 0.0)[i:i + 2]
        ln = math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1])
        L = LINE / ln                                           # one px along this segment, as a fraction
        for f in seams:                                         # the seams: up the face, over the bullnose, across the top
            _paint(k, key, i, f - L / 2, f + L / 2, up, SEAM_D, keep=keep)
            _paint(k, key, i, f + L / 2, f + 1.5 * L, up, SEAM_L, keep=keep)
            g = _plumb(key, i, f, 0.0, keep)                    # (where the seam stands on the face)
            _box(k, key, i, g - 1.5 * L, g + 1.5 * L, GROOVE - 2 * pz, GROOVE + 3 * pz, LINE, TAB, TAB_TOP,
                 TAB_SIDE)                                      # a tab where the seam crosses the groove
        if hatch:                                               # a line under the bullnose from seam to seam, lit under
            a0, a1 = _plumb(key, i, seams[0], 0.0, keep) + L / 2, _plumb(key, i, seams[-1], 0.0, keep) - L / 2
            _paint(k, key, i, a0, a1, [(0.0, zt), (0.0, zt + pz)], HATCH_D)
            _paint(k, key, i, a0, a1, [(0.0, zt - pz), (0.0, zt)], HATCH_L)
    for i in range(segs):                                       # the bright ledge along the foot
        _paint(k, key, i, 0.0, 1.0, [(0.0, FOOT_H), (0.0, FOOT_H + LEDGE_H * pz)], LEDGE)
    for i in range(segs):                                       # the foot blocks
        p = _chain(key, 0.0)[i:i + 2]
        ln = math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1])
        n = max(1, round(FOOT_N * ln))
        w = FOOT_W / ln
        for j in range(n):
            c = (j + 0.5) / n
            _box(k, key, i, c - w / 2, c + w / 2, 0.0, FOOT_H, FOOT_OUT, FOOT, FOOT_TOP, FOOT_SIDE)


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


PIECES = ((10, 1), (5, 2), (9, 3))
PALETTE = "only:station"


def _item(sid, build):
    from . import env_build, post
    core.clear_scene_meshes()
    post.select(PALETTE)
    it = env_build.crop_item(sid, (1, 1), *env_build.render_sprite(sid, "wide", build()))
    return [it] if it else []


def jobs():
    return [lambda m=m, o=o: _item(f"tile.hull.station.ext.o{o}.m{m}", lambda: _wide((m, o), upper)) for m, o in PIECES]
