"""Registry of the wall, hull, door and floor sprites: (id, footprint, kind, builder).

Three view levels (walls.LEVELS): up (walls up), cut (cutaway: partitions cut CUT above the skirt, the rear hull full)
and low (shortest: partitions are skirt-high stubs, every hull side is a ghost).
- Far pieces by 4-bit neighbour mask (N1 E2 S4 W8): tile.wall.full.m* (up), tile.wall.m* (cut), tile.wall.low.m* (low);
  tile.hull.full.m* (up) and tile.hull.m* (cut), each with the ochre plate variant .v1; tile.hull.ghost.m* is the far
  hull's ghost rim (low).
- Near-hull ghosts tile.hull.o{o}.m{mask} (o: 1 = space at +y, 2 = at +x, 3 = both: the chamfered outer corner, 4 =
  concave corner), drawn in every level, and their below-deck bellies tile.hull.belly.o{o}.m{mask} (.v1: muted ochre
  band), which the renderer draws UNDER the floor layer so a deck in front hides them.
- End faces where a wall butts into a ghost: tile.{fam}.{full.|low.|}end.{s|e}.
- The belly alone for a door in the near hull (tile.hull.drop.{s|e}); doors, never cut (tile.door.{x|y}[.open])."""
from .doors import door
from .floors import floor
from .hull import drop, out_block
from .walls import block, end_face

FLOORS = "abcdefgh"
PRE = {"up": "full.", "cut": "", "low": "low."}
SPRITES = [(f"tile.floor.{v}", (1, 1), "floor", lambda v=v: floor(v)) for v in FLOORS]
for _m in range(16):
    for _lv, _pre in PRE.items():
        SPRITES.append((f"tile.wall.{_pre}m{_m}", (1, 1), "block", lambda m=_m, lv=_lv: block(m, "wall", level=lv)))
    for _lv in ("up", "cut"):
        for _v in (0, 1):
            SPRITES.append((f"tile.hull.{PRE[_lv]}m{_m}{'.v1' if _v else ''}", (1, 1), "block",
                            lambda m=_m, lv=_lv, v=_v: block(m, "hull", v, level=lv)))
    SPRITES.append((f"tile.hull.ghost.m{_m}", (1, 1), "block", lambda m=_m: out_block(m, 0)))
OUT_MASK = {1: 4, 2: 2, 3: 6, 4: 0}    # mask bits that must be clear for each outward set (4: concave corner)
for _o, _clear in OUT_MASK.items():
    for _m in range(16):
        if _m & _clear or (_o == 4 and _m & 6 != 6):
            continue
        SPRITES.append((f"tile.hull.o{_o}.m{_m}", (1, 1), "block", lambda m=_m, o=_o: out_block(m, o)))
        if _o < 4:
            SPRITES.append((f"tile.hull.belly.o{_o}.m{_m}", (1, 1), "block",
                            lambda m=_m, o=_o: out_block(m, o, 0, "belly")))
        if _o < 3:
            SPRITES.append((f"tile.hull.belly.o{_o}.m{_m}.v1", (1, 1), "block",
                            lambda m=_m, o=_o: out_block(m, o, 1, "belly")))
for _s in ("s", "e"):
    for _lv, _pre in PRE.items():
        SPRITES.append((f"tile.wall.{_pre}end.{_s}", (1, 1), "block", lambda s=_s, lv=_lv: end_face("wall", s, lv)))
        if _lv != "low":
            SPRITES.append((f"tile.hull.{_pre}end.{_s}", (1, 1), "block", lambda s=_s, lv=_lv: end_face("hull", s, lv)))
    SPRITES.append((f"tile.hull.drop.{_s}", (1, 1), "block", lambda s=_s: drop(s)))
for _ax in ("x", "y"):
    SPRITES += [(f"tile.door.{_ax}", (1, 1), "block", lambda a=_ax: door(a, False)),
                (f"tile.door.{_ax}.open", (1, 1), "block", lambda a=_ax: door(a, True))]
