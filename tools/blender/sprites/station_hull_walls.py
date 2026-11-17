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

CUT = "stK"
FOOT_Z = SH.GROOVE - 2 / core.ZPX       # the near hull's cut: two px under the groove
THICK = W.TW                            # the near hull's cut band: the partitions' thickness behind its face


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
            x0, x1 = max(x0, E - THICK), E
        if abs(y1 - sp.f) < 1e-6:
            y0, y1 = max(y0, E - THICK), E
        k.poly([T.Vector((x, y, FOOT_Z)) for x, y in ((x0, y0), (x1, y0), (x1, y1), (x0, y1))], "steel", 3,
               T.Vector((0, 0, 1)), fixed=CUT)


def low(n):
    """(objs, kind): the station's generic piece of key name n (station_hull._generic) cut off at FOOT_Z, its section's top
    a black cut: its solids (and the step) get a top at FOOT_Z (toned CUT) and a back THICK behind each front, everything
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
        # (the piece has no back: the roof covers the rest of the tile. Cut low it needs one, as the walls' thickness behind
        # each front, a solid each: their union is the hull's band round a corner)
        for s, c, _w in fronts:
            back = (-s, -(c - THICK * s.length))
            emit(rel, [(ends, rest + [back]) for ends, rest in parts], fronts, skip, sec)

    def low_step(rel, g, cut, sec):
        for s, c, _w in map(SG._front, g):              # (the step too: the walls' thickness behind each front)
            step(rel, g, cut + [(-s, -(c - THICK * s.length))], sec)

    def low_tone(pts, m, fronts, sec):
        return CUT if m.z > 0.85 and min(p.z for p in pts) >= FOOT_Z - 1e-6 else tone(pts, m, fronts, sec)

    def clipped(self):
        self.clip_above(FOOT_Z)
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


def jobs():
    from . import hull_catalog as HC
    from . import hull_outline as HO
    from . import wall3d_ext_diag as DG
    from .hulltiles import _guard
    from .walls import corner_sets
    out = []
    for m in range(16):
        for c in corner_sets(m):
            sid = f"tile.hull.station.cap.m{m}{f'c{c}' if c else ''}"
            out.append(lambda m=m, c=c, sid=sid: _guard(sid, lambda: SH.masked(sid, "over", lambda: cap(m, c)))())
    for key in HC.keys():
        if not key:
            continue
        n = HO.name(key)
        sid = f"tile.hull.station.low.{n}"
        kind = "block" if DG.uses_art(key) else "wide"
        out.append(lambda n=n, sid=sid, kind=kind: _guard(sid, lambda: SH.masked(sid, kind, lambda: low(n)[0]))())
    return out
