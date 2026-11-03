"""The exterior hull's armour buckled: the first damage layer (the stripped machinery, wall3d_ext_stripped, the
second). Each piece (by key) as its plating cut into panels (PANEL wide along each side, in bands: the upright part's
lower and upper halves, the lean), each dented in, tipped on one edge and some scorched, with the seams between them
gaping onto the dark sub-hull behind. The renderer shows it where a tile's damage mask passes the first threshold.

A panel's damage comes from its place in the two-tile layout (wall3d_ext_stripped.PERIOD, phase (x + y) mod 2), so
panels line up from tile to tile; panels may only move in (never past the intact silhouette)."""
import math
import random

from mathutils import Matrix

from . import hull_outline as HO
from . import wall3d as T
from . import walls as W
from .wall3d_ext_diag import UP, _lift, _solid, _tile, _tone
from .wall3d_ext_geom import LEAN_RISE
from .wall3d_ext_stripped import PERIOD, _planes, _Side

ARMOUR = 2 / 32                     # tiles: the plating's thickness
GAP = 0.6 / 32                      # each panel this far in from its neighbours' edges (the seams)
PANEL = 0.5                         # tiles along a straight side (a diagonal's: half its tile length)
BANDS = (0.0, 0.5, 1.0)             # the upright part's bands (fractions of its height); the lean is one more
STATES = (("flat", 0.4, (0.0, 2.0)), ("tipped", 0.3, (8.0, 14.0)), ("folded", 0.15, (10.0, 16.0)),
          ("missing", 0.15, None))  # a panel's damage: its share of panels, degrees it tips (on an edge; folded: on a
                                    # diagonal, a corner pushed in)
DENT = (0.2 / 32, 0.8 / 32)         # how far a panel is pushed in
SUB_DEPTH = 6 / 32                  # the sub-hull this deep behind the face (deeper than any panel sinks)
SCORCH = 0.25                       # the share of panels scorched (two steps darker)
SUB = "hsXD"                        # the sub-hull behind the plating
SEED = 47
ID_SUB = "hsXK"                     # the ID pass (piece(ids=True)): the sub-hull's colour; each panel one of ID_COLS by
ID_N = 12                           # its place in the layout (band, index: at most ID_N), for the damage mask's panels
RAMP = ("hsXK", "hsK", "hsXD", "hsD", "hsXM", "hsXS", "hsM", "hsS", "hsL", "hsH")


def _damage(band, k):
    """A panel's damage from its band and its index in the layout: (state, hinge, tip in radians, dent, scorch)."""
    rnd = random.Random(SEED * 1000 + band * 37 + k)
    x, state, tip = rnd.random(), STATES[-1][0], None
    for name, share, tips in STATES:
        if x < share:
            state, tip = name, tips
            break
        x -= share
    hinge = rnd.choice(("top", "bottom", "left", "right") if state != "folded" else ("tl", "tr", "bl", "br"))
    scorch = 2 if rnd.random() < SCORCH else 0
    return state, hinge, math.radians(rnd.uniform(*tip)) if tip else 0.0, rnd.uniform(*DENT), scorch


def _id_cols(n=ID_N):
    """n palette colours far apart (and from ID_SUB): each a panel's flat colour in the ID pass."""
    from lib import palette
    cols = {k: palette.srgb(k) for k in palette.names() if palette.emissive(k) is None}
    pick = [ID_SUB]
    while len(pick) < n + 1:
        pick.append(max(cols, key=lambda k: min(sum((a - b) ** 2 for a, b in zip(cols[k], cols[q])) for q in pick)))
    return pick[1:]


def _darker(col, n):
    return RAMP[max(0, RAMP.index(col) - n)] if col in RAMP else col


def piece(key, phase=0, H=None, margin=0.0, ids=False):
    """The buckled piece of a tile with this key, in its phase; ids: its ID pass (each panel a flat colour)."""
    id_cols = _id_cols() if ids else None
    H = W.hull_top() if H is None else H
    zb = H - LEAN_RISE
    tile = _tile(margin)
    rel = T.Relief(f"ext_buckled_{HO.name(key)}_{phase}")
    for stretch in HO.parse(key):
        for g, before, after in HO.groups(stretch):
            sub, _ = _planes(g, before, after, H, tile, SUB_DEPTH)
            for pts, m, _ in _solid(sub):
                rel.poly(pts, "steel", 3, m, fixed=ID_SUB if ids else SUB)
            solid, fronts = _planes(g, before, after, H, tile)
            for f, (s, c, w) in zip(g, fronts):
                side = _Side(s, c, w, H)
                clip = solid + [_lift(HO.nearer(f, h)) for h in g if h is not f]
                shell = clip + [(-s, -(c - ARMOUR * s.length))]          # (the plating's slab on this side)
                ln, lc = side.lean
                shell_lean = clip + [(-ln, -(lc - ARMOUR * ln.length))]
                pw = PANEL * side.per
                per_layout = round(PERIOD * side.per / pw)
                n_span = math.ceil((0.75 + margin) / pw) + 2
                bands = [(BANDS[i], BANDS[i + 1]) for i in range(len(BANDS) - 1)] + [None]
                for b, band in enumerate(bands):
                    for j in range(-n_span, n_span + 1):
                        u0 = j * pw - phase * side.per
                        k = (j - round(phase * side.per / pw)) % per_layout
                        state, hinge, tip, dent, scorch = _damage(b, k)
                        if state == "missing":
                            continue
                        cut = [(side.t, u0 + pw - GAP), (-side.t, -(u0 + GAP))]
                        if band:
                            z0, z1 = zb * band[0] + GAP, zb * band[1] - GAP
                            cut += [(UP, z1), (-UP, -z0)]
                            region = shell
                        else:
                            z0, z1 = zb + GAP, H - GAP
                            cut += [(UP, z1), (-UP, -z0)]
                            region = shell_lean
                        normal = side.n if band else ln.normalized()
                        up = (UP - normal * normal.dot(UP)).normalized()   # (up the face it lies on)
                        um, zm = u0 + pw / 2, (z0 + z1) / 2
                        piv_u = {"left": u0 + GAP, "right": u0 + pw - GAP}.get(hinge, um)
                        piv_z = {"bottom": z0, "top": z1}.get(hinge, zm)
                        if state == "folded":                       # (a corner pushed in: a fold across its diagonal)
                            piv_u, piv_z = um, zm
                            du, dz = (1 if hinge[1] == "r" else -1) * pw, (1 if hinge[0] == "t" else -1) * (z1 - z0)
                            axis = (side.t * dz + up * -du).normalized()
                        else:
                            axis = side.t if hinge in ("top", "bottom") else up
                        pivot = side.at(side.lean_depth(piv_z) if not band else 0.0, piv_z, piv_u)
                        probe = side.at(side.lean_depth(zm) if not band else 0.0, zm, um)
                        if state == "folded":
                            probe = pivot + side.t * (du / 2) + up * (dz / 2)
                        rot = Matrix.Rotation(tip, 3, axis)
                        if (rot @ (probe - pivot) - (probe - pivot)).dot(normal) > 0:   # (its free part tips in)
                            rot = Matrix.Rotation(-tip, 3, axis)
                        for pts, m, _ in _solid(region + cut):
                            moved = [pivot + rot @ (p - pivot) - normal * dent for p in pts]
                            col = _darker(_tone(m, [(s, c, w)]), scorch)     # (its intact tone: the shape moves)
                            if ids:
                                col = id_cols[(b * per_layout + k) % ID_N]
                            rel.poly(moved, "steel", 3, rot @ m, fixed=col)
    return rel.build()
