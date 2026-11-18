"""The station hull with the walls up (#524; family `station_hull`): a ground base's pieces for the cutaway levels, in the
station's look (render/tiles.ts `wallPieces`, look "station").

  tile.hull.station.cap.m<mask>[c<c>]   the far hull over the partitions' height (as tile.hull.cap.*, drawn over
                                       tile.wall.full.*): its face over their height a black cut, its top the station's
                                       roof (the livery band, a lit inner edge, the bullnose's light at its back), the cut
                                       band along the room side black as the partitions' caps
  tile.hull.station.low.<key>          the near hull cut down to its foot, by hull key (as tile.hull.belly.low.<key>): the
                                       station's generic piece up to under the groove (the step and the lower livery band),
                                       its section's top a black cut; it stands for the ship's cut top and belly (a base on
                                       the ground has no belly)

Each with its `.tint` livery mask (station_hull.masked)."""
from . import core
from . import station_hull as SH
from . import wall3d as T
from . import walls as W
from .wall3d_ext_geom import E, LINE

CUT = "stCut"                           # the cut's black: the ship's (walls.CUT, wK), in the station's set
FOOT_Z = W.ZG                           # the near hull's cut: at the ship's (the ghost rim's height)
SEAM = "stCutSeam"                      # the seam along the cut's back (the ship's, wall3d_ext_diag.TOP_SEAM's tone)
LIP, LIP_Z = "stB", 2 / core.ZPX        # the face's lit lip right under the cut (as the ship's armour's), px tall


class CapShell(T.Shell):
    """The far hull's shell, its top the station's roof (no armour plates)."""
    no_cap = True

    def col_top(self, i, j, kind, x, y):
        r = self._rect_at(x, y) or self.rects[0]
        if r[1] != "hull" or r[3] < W.hull_top() - 1e-6:
            return CUT
        ax, w = T.along(self, r, x, y)
        x0, x1, y0, y1 = r[0]
        depth = ((y1 - y0) if ax else (x1 - x0)) - T.BAND
        w -= T.BAND
        if w < 0:
            return CUT                                  # (the cut band along the room side)
        if w < LINE:
            return "stW"                                # the lit inner edge
        if depth - w < LINE:
            return "stH"                                # the bullnose turning away at its back
        if depth - w < 2 * LINE:
            return "stB"
        return SH.TOP_P

    def col_face(self, face, x, y, z):
        return CUT

    def col_skirt(self, i, j, kind, x, y):
        return CUT


def cap(mask, corners=0):
    """(own, all): the far hull's cap over the partition piece of the same mask (wall3d.hull_cap's, in the station's
    look)."""
    old, T.CUT = T.CUT, CUT
    try:
        own = T.block(mask, "hull", None, level="up", corners=corners, shell=CapShell, above=W.HF)
        return own, own + T.block(mask, "wall", level="up", corners=corners)
    finally:
        T.CUT = old


def _lid(k, sp):
    """The cut's top at FOOT_Z over a run block (station_hull._block): its hull rects out to the armour's face (E)."""
    for (x0, x1, y0, y1), fam, _t, _top in sp.rects:
        if fam != "hull":
            continue
        if abs(x1 - sp.f) < 1e-6:
            x1 = E
        if abs(y1 - sp.f) < 1e-6:
            y1 = E
        k.poly([T.Vector((x, y, FOOT_Z)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))], "steel", 3,
               T.Vector((0, 0, 1)), fixed=CUT)
        z0, z1, e = FOOT_Z - LIP_Z, FOOT_Z, E + T.PAINT
        if x1 == E:                                     # (the lip on its face)
            k.poly([T.Vector(p) for p in ((e, y0, z0), (e, y1, z0), (e, y1, z1), (e, y0, z1))], "steel", 3,
                   T.Vector((1, 0, 0)), fixed=LIP)
        if y1 == E:
            k.poly([T.Vector(p) for p in ((x1, e, z0), (x0, e, z0), (x0, e, z1), (x1, e, z1))], "steel", 3,
                   T.Vector((0, 1, 0)), fixed=LIP)
        a, b = _seam_band()                             # (the seam along the cut's back, as the ship's)
        z = FOOT_Z + T.PAINT
        if x1 == E and y1 != E:
            k.poly([T.Vector(p) for p in ((E - b, y0, z), (E - a, y0, z), (E - a, y1, z), (E - b, y1, z))], "steel", 3,
                   T.Vector((0, 0, 1)), fixed=SEAM)
        if y1 == E and x1 != E:
            k.poly([T.Vector(p) for p in ((x0, E - b, z), (x1, E - b, z), (x1, E - a, z), (x0, E - a, z))], "steel", 3,
                   T.Vector((0, 0, 1)), fixed=SEAM)


def _seam_band():
    """The ship's cut seam's depths behind the outline (wall3d_ext_diag.TOP_SEAM, in from the hull's back)."""
    from . import hull_outline as HO
    from .wall3d_ext_diag import TOP_SEAM
    return HO.LIP - TOP_SEAM[1], HO.LIP - TOP_SEAM[0]


def _seam(rel, planes, fronts):
    """The seam on the cut's top, per front where it is the nearest (wall3d_ext_diag._seam's: depths in s . p terms)."""
    from .wall3d_ext_diag import _solid
    a, b = _seam_band()
    up = T.Vector((0, 0, 1))
    side = [q for q in planes if abs(q[0].z) < 1e-9]
    for s, c, w in fronts:
        band = [(s, c - w * a), (-s, -(c - w * b))]
        band += [(t, d - g * b) for t, d, g in fronts if t is not s]
        for pts, m, _ in _solid(side + band + [(-up, -FOOT_Z), (up, FOOT_Z + T.PAINT)]):
            if m.z > 0.85:
                rel.poly(pts, "steel", 3, m, fixed=SEAM)


def _back(s, c, w):
    """The cut where the hull ends behind front (s, c, w) (wall3d_belly's: hull_outline.back, d(f) <= back: in s . p
    terms, so a diagonal's and a run's meet on the tile's edge)."""
    from . import hull_outline as HO
    return (-s, -(c - w * HO.back((round(s.x), round(s.y)))))


def low(n):
    """(objs, kind): the station's generic piece of key name n (station_hull._generic) cut off at FOOT_Z, its section's top
    a black cut: its solids (and the step) get a top at FOOT_Z (toned CUT) and a back where the hull ends behind each front (the ship's cut hull's,
    hull_outline.back: the tile's inner edge), everything
    dressed on them is clipped there, and the roof's lines are left off."""
    from unittest import mock
    from . import station_hull_diag as SG
    from . import wall3d_ext_diag as DG
    k = SH._unname(n)
    part, tone, emit, step, build, old_hook = SG._part, SG._tone, SG._emit, SG._step, T.Relief.build, T.HOOK
    lid = (T.Vector((0, 0, 1)), FOOT_Z)

    def low_part(*a, **kw):
        parts, shared, fronts = part(*a, **kw)
        return [(ends, rest + [lid]) for ends, rest in parts[:1]], shared, fronts

    def low_emit(rel, parts, fronts, skip, sec):
        # (the piece has no back: the roof covers the rest of the tile. Cut low it needs one, where the hull ends behind
        # each front, a solid each: their union is the hull round a corner)
        for s, c, _w in fronts:
            back = _back(s, c, _w)
            emit(rel, [(ends, rest + [back]) for ends, rest in parts], fronts, skip, sec)
        for ends, rest in parts:                        # (each camera-facing front's lit lip under the cut)
            planes = ends + rest
            _seam(rel, planes, fronts)
            for s, c, _w in fronts:
                if s.x + s.y <= 0:
                    continue
                i = next((j for j, (n, d) in enumerate(planes) if (n - s).length < 1e-9 and abs(d - c) < 1e-9), None)
                if i is not None:
                    SG._paint(rel, planes, i, LIP, [(-T.Vector((0, 0, 1)), -(FOOT_Z - LIP_Z))])

    def low_step(rel, g, cut, sec):
        for s, c, w in map(SG._front, g):               # (the step too: the hull's depth behind each front)
            step(rel, g, cut + [_back(s, c, w)], sec)

    def low_tone(pts, m, fronts, sec):
        return CUT if m.z > 0.85 and min(p.z for p in pts) >= FOOT_Z - 1e-6 else tone(pts, m, fronts, sec)

    def clipped(self):
        self.clip_above(FOOT_Z + 2 * T.PAINT)                # (over the cut: its seam, lifted off it)
        return build(self)

    def hook(rk, sp):
        if old_hook:
            old_hook(rk, sp)
        _lid(rk, sp)
    T.HOOK = hook
    try:
        with mock.patch.object(SG, "_part", low_part), mock.patch.object(SG, "_tone", low_tone), \
                mock.patch.object(SG, "_emit", low_emit), mock.patch.object(SG, "_step", low_step), \
                mock.patch.object(SG, "_top_lines", lambda *a: None), \
                mock.patch.object(T.Relief, "build", clipped):
            if DG.uses_art(k):
                return SG.piece(k), "block"
            return (SG.piece(k), SG.piece(k, margin=DG.WIDE)), "wide"
    finally:
        T.HOOK = old_hook


LOW_BERM = 0.55                         # the berm's height with the hull cut down: under its cut (the drift's tallest heap
                                        # 0.48 tile, the cut 0.30)


def low_berm(n, v, ends=None):
    """The rock berm with the hull cut down (`<berm id>.low`): station_hull._berm's drift flattened to LOW_BERM of its height,
    held out by the cut-down foot (low) instead of the full piece."""
    from . import env_build, post
    from . import station_berm as BM
    k = SH._unname(n)
    core.clear_scene_meshes()
    post.select("only:berm")
    own = BM.berm(k, v, ends or (0, 0))
    if not own:
        return []
    for ob in own:
        for vert in ob.data.vertices:
            vert.co.z *= LOW_BERM
    post.select(PALETTE)
    objs, kind = low(n)
    post.select("only:berm")
    hold = objs
    if kind == "wide":                                  # (a diagonal's: the narrow piece holds out; its wide copy,
        hold = objs[0]                                  # out past the tile's edges, goes, or it shows in the berm)
        import bpy
        for ob in [o for o in objs[1] if o not in objs[0]]:
            bpy.data.objects.remove(ob, do_unlink=True)
    sid = f"tile.hull.station.berm.{n}.v{v}" + (f".e{ends[0]}{ends[1]}" if ends else "") + ".low"
    it = env_build.crop_item(sid, (1, 1), *env_build.render_sprite(sid, "wide", (own, own + list(hold))))
    return [it] if it else []


PALETTE = "only:station+station_cut"    # the station's set and the cut's black (its own set: the rest of the family's
                                        # cache key stays as it was)


def _masked(sid, kind, build_fn):
    """station_hull.masked in this module's palette."""
    from unittest import mock
    with mock.patch.object(SH, "PALETTE", PALETTE):
        return SH.masked(sid, kind, build_fn)


def jobs():
    """The pieces' jobs; each carries this palette's digest (the family's cache key has only the station set's)."""
    from . import hull_catalog as HC
    from . import hull_outline as HO
    from . import post
    from . import wall3d_ext_diag as DG
    from .hulltiles import _guard
    from .walls import corner_sets
    from . import station_berm as BM
    pal = post.palette_digest(PALETTE)
    bp = post.palette_digest("only:berm")
    out = []
    for m in range(16):
        for c in corner_sets(m):
            sid = f"tile.hull.station.cap.m{m}{f'c{c}' if c else ''}"
            out.append(lambda m=m, c=c, sid=sid, pal=pal: _guard(sid, lambda: _masked(sid, "over", lambda: cap(m, c)))())
    for key in HC.keys():
        if not key:
            continue
        n = HO.name(key)
        sid = f"tile.hull.station.low.{n}"
        kind = "block" if DG.uses_art(key) else "wide"
        out.append(lambda n=n, sid=sid, kind=kind, pal=pal: _guard(sid, lambda: _masked(sid, kind, lambda: low(n)[0]))())
        run = BM.along(key) is not None                 # (the low berm: as station_hull.jobs' berm)
        ends = [(a, b) for a in (0, 1) for b in (0, 1)] if run or BM.turn_key(key) else [None]
        out += [lambda n=n, v=v, e=e, bp=bp: _guard((n, v, e, "low"), lambda: low_berm(n, v, e))()
                for v in range(BM.RUN if run else BM.VARIANTS) for e in ends]
    return out
