"""Registry of the wall, hull, door and floor sprites: (id, footprint, kind, builder).

Three view levels (walls.LEVELS): up (walls up), cut (cutaway: partitions cut CUT above the skirt, the rear hull full)
and low (shortest: partitions are skirt-high stubs, every hull side is a ghost).
- Far pieces by 4-bit neighbour mask (N1 E2 S4 W8): tile.wall.full.m* (up), tile.wall.m* (cut), tile.wall.low.m* (low);
  tile.hull.full.m* (up) and tile.hull.m* (cut), each with the ochre plate variant .v1; tile.hull.ghost.m*[.r{1|8|9}]
  is the far hull's ghost (low): see-through edge lines of its sloped skirt (.r: unconnected N / W sides facing a room).
- Ghost rims are 'ghost' sprites: thin semi-transparent edge lines only (alpha from env_build.render_ghost);
  tile.hull.ghost.vert is a vertical edge line at a tile's front corner, placed where the front ghost silhouette turns
  or ends.
- Near-hull ghosts tile.hull.o{o}.m{mask} (o: 1 = space at +y, 2 = at +x, 3 = both: the chamfered outer corner, 4 =
  concave corner), drawn in every level, and their below-deck bellies tile.hull.belly.o{o}.m{mask} (.v1: muted ochre
  band), which the renderer draws UNDER the floor layer so a deck in front hides them.
- Corner fills (47-tile blob set): every far piece also comes as m{mask}c{bits} for each set of filled corner quadrants
  (NE 1, SE 2, SW 4, NW 8: both arms connected and the diagonal solid wall), so thick blocks read as one mass; the rear
  ghost as tile.hull.ghost.m{6|7|14|15}c2[.r*] (SE diagonal solid: no dip toward it).
- End faces where a wall butts into a ghost: tile.{fam}.{full.|low.|}end.{s|e}[.c{bits}] (the fills reaching that edge).
- The belly alone for a door in the near hull (tile.hull.drop.{s|e}); doors, never cut (tile.door.{x|y}[.open])."""
import re

from .doors import door
from .floors import floor
from .hull import drop, out_block, vert
from .wall3d_ext import EXT_PAIRS, STRAIGHT, ext_block, ext_run_wide
from .wall3d import block, end_face, hull_cap, hull_cap_end    # the relief walls (wall3d.py)
from .wall3d_variants import PAIRS
from .walls import corner_sets

FLOORS = "abcdefgh"
PRE = {"up": "full.", "cut": "", "low": "low."}
SPRITES = [(f"tile.floor.{v}", (1, 1), "floor", lambda v=v: floor(v)) for v in FLOORS]
for _m in range(16):
    for _c in corner_sets(_m):                     # corner fills (walls.corner_sets): m<mask>c<bits>, c0 = plain m<mask>
        _id = f"m{_m}c{_c}" if _c else f"m{_m}"
        for _lv, _pre in PRE.items():
            SPRITES.append((f"tile.wall.{_pre}{_id}", (1, 1), "block",
                            lambda m=_m, lv=_lv, c=_c: block(m, "wall", level=lv, corners=c)))
        for _lv in ("up", "cut"):
            for _v in (0, 1):
                SPRITES.append((f"tile.hull.{PRE[_lv]}{_id}{'.v1' if _v else ''}", (1, 1), "block",
                                lambda m=_m, lv=_lv, v=_v, c=_c: block(m, "hull", v, level=lv, corners=c)))
        for _v in (0, 1):                           # the far hull over a partition (wall3d.hull_cap: the renderer
            SPRITES.append((f"tile.hull.cap.{_id}{'.v1' if _v else ''}", (1, 1), "over",    # draws it over
                            lambda m=_m, v=_v, c=_c: hull_cap(m, v, corners=c)))         # tile.wall.full.m*)
    for _c in ((0, 2) if _m & 6 == 6 else (0,)):   # rear ghost: c2 = the SE diagonal is solid (no dip toward it)
        for _r in (0, 1, 8, 9):                    # ... and which unconnected N / W sides face a room
            if _r & _m:
                continue
            SPRITES.append((f"tile.hull.ghost.m{_m}{f'c{_c}' if _c else ''}{f'.r{_r}' if _r else ''}", (1, 1), "ghost",
                            lambda m=_m, r=_r, c=_c: out_block(m, 0, room=r, corners=c)))
def _variant(fn, tr):
    """fn built as a straight piece's variant (wall3d.VARIANT = tr)."""
    def build():
        from . import wall3d
        wall3d.VARIANT = tr
        try:
            return fn()
        finally:
            wall3d.VARIANT = (0, 0)
    return build


for _fam, _m in (("wall", 10), ("wall", 5), ("hull", 10), ("hull", 5)):      # straight runs' variants .a1 .. .a7
    for _n, _tr in enumerate(PAIRS, 1):                                      # (wall3d_variants; the renderer picks
        SPRITES.append((f"tile.{_fam}.full.m{_m}.a{_n}", (1, 1), "block",    # one a tile)
                        _variant(lambda m=_m, f=_fam: block(m, f, level="up"), _tr)))
OUT_MASK = {1: 4, 2: 2, 3: 6, 4: 0}    # mask bits that must be clear for each outward set (4: concave corner)
for _o, _clear in OUT_MASK.items():
    for _m in range(16):
        if _m & _clear or (_o == 4 and _m & 6 != 6):
            continue
        SPRITES.append((f"tile.hull.o{_o}.m{_m}", (1, 1), "ghost", lambda m=_m, o=_o: out_block(m, o)))
        if _o < 4:
            SPRITES.append((f"tile.hull.belly.o{_o}.m{_m}", (1, 1), "block",
                            lambda m=_m, o=_o: out_block(m, o, 0, "belly")))
        if _o < 3:
            SPRITES.append((f"tile.hull.belly.o{_o}.m{_m}.v1", (1, 1), "block",
                            lambda m=_m, o=_o: out_block(m, o, 1, "belly")))
        if _o < 4:                                                  # the hull from outside (roofed ships)
            _run = (_m, _o) in STRAIGHT                             # (straight runs: "wide", ext_run_wide)
            for _v in (0, 1):
                SPRITES.append((f"tile.hull.ext.o{_o}.m{_m}{'.v1' if _v else ''}", (1, 1), "wide" if _run else "block",
                                lambda m=_m, o=_o, v=_v, r=_run: (ext_run_wide if r else ext_block)(m, o, v)))
            if _run:                                                # (its straight runs' variants .a1 ..)
                for _n, _tr in enumerate(EXT_PAIRS, 1):
                    SPRITES.append((f"tile.hull.ext.o{_o}.m{_m}.a{_n}", (1, 1), "wide",
                                    _variant(lambda m=_m, o=_o: ext_run_wide(m, o), _tr)))
SPRITES.append(("tile.hull.ghost.vert", (1, 1), "ghost", vert))
END_CORNERS = {"s": (0, 2, 4, 6), "e": (0, 1, 2, 3)}   # the corner fills reaching each end face's edge
for _s in ("s", "e"):
    for _lv, _pre in PRE.items():
        for _c in END_CORNERS[_s]:
            _cs = f".c{_c}" if _c else ""
            SPRITES.append((f"tile.wall.{_pre}end.{_s}{_cs}", (1, 1), "block",
                            lambda s=_s, lv=_lv, c=_c: end_face("wall", s, lv, c)))
            if _lv != "low":
                SPRITES.append((f"tile.hull.{_pre}end.{_s}{_cs}", (1, 1), "block",
                                lambda s=_s, lv=_lv, c=_c: end_face("hull", s, lv, c)))
    for _c in END_CORNERS[_s]:                      # the far hull's end over tile.wall.full.end.* (wall3d.hull_cap_end)
        SPRITES.append((f"tile.hull.cap.end.{_s}{f'.c{_c}' if _c else ''}", (1, 1), "block",
                        lambda s=_s, c=_c: hull_cap_end(s, c)))
    SPRITES.append((f"tile.hull.drop.{_s}", (1, 1), "block", lambda s=_s: drop(s)))
for _ax in ("x", "y"):
    SPRITES += [(f"tile.door.{_ax}", (1, 1), "block", lambda a=_ax: door(a, False)),
                (f"tile.door.{_ax}.open", (1, 1), "block", lambda a=_ax: door(a, True))]


STEPS = {1: (0, -1), 2: (1, 0), 4: (0, 1), 8: (-1, 0)}    # a mask bit's neighbour (N1 E2 S4 W8)
_WALL = re.compile(r"^tile\.wall\.(full\.|low\.)?m(\d+)")


def _with_runs(fn, mask, level):
    """A wall piece as env_build "wide" (own, wide): the piece, and on each connected side the wall's straight run one
    tile on, so a px on a tile edge (anti-aliased: env_build.AA) resolves against the wall running on there, not the
    empty canvas, and the tiles meet without specks. The runs are built plain (no straight-run variant) and in the
    look's style (a faction look wraps the whole build)."""
    def build():
        from mathutils import Matrix
        from . import core, wall3d
        own = fn()
        extra, tv = [], wall3d.VARIANT
        wall3d.VARIANT = (0, 0)
        try:
            for bit, (dx, dy) in STEPS.items():
                if mask & bit:
                    for o in block(10 if bit in (2, 8) else 5, "wall", level=level):
                        o.data.transform(Matrix.Translation(core.G(dx, dy, 0.0)))
                        o.data.update()
                        extra.append(o)
        finally:
            wall3d.VARIANT = tv
        return own, own + extra
    return build


for _k, (_sid, _fp, _kind, _fn) in enumerate(SPRITES):     # every wall piece by mask, at each level, with its runs
    _mm = _WALL.match(_sid)
    if _mm and _kind == "block":
        SPRITES[_k] = (_sid, _fp, "wide", _with_runs(_fn, int(_mm.group(2)), {"full.": "up", "low.": "low"}.get(
            _mm.group(1) or "", "cut")))
