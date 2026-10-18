"""Registry of the wall, hull, door and floor sprites: (id, footprint, kind, builder).

Far pieces by 4-bit neighbour mask (tile.wall / tile.hull, cutaway or .full), hull colour variant .v1 (ochre plate);
near-hull ghost footings tile.hull.o{o}.m{mask} (o: 1 = space at +y, 2 = at +x, 3 = both: the chamfered outer corner,
4 = concave corner) with their glass tile.hull.glass.o{o}.m{mask}, both drawn in every view mode; end faces where a wall
butts into the ghost (tile.{fam}.end.{s|e} cutaway, tile.{fam}.full.end.{s|e} walls up); the deck-edge band alone for
doors in the near hull; doors."""
from .doors import door
from .floors import floor
from .hull import drop, glass, out_block
from .walls import block, end_face

FLOORS = "abcdefgh"
SPRITES = [(f"tile.floor.{v}", (1, 1), "floor", lambda v=v: floor(v)) for v in FLOORS]
for _fam in ("wall", "hull"):
    for _m in range(16):
        SPRITES.append((f"tile.{_fam}.m{_m}", (1, 1), "block", lambda m=_m, f=_fam: block(m, f)))
        SPRITES.append((f"tile.{_fam}.full.m{_m}", (1, 1), "block", lambda m=_m, f=_fam: block(m, f, None, None, True)))
for _m in range(16):
    SPRITES.append((f"tile.hull.m{_m}.v1", (1, 1), "block", lambda m=_m: block(m, "hull", 1)))
    SPRITES.append((f"tile.hull.full.m{_m}.v1", (1, 1), "block", lambda m=_m: block(m, "hull", 1, None, True)))
OUT_MASK = {1: 4, 2: 2, 3: 6, 4: 0}    # mask bits that must be clear for each outward set (4: concave corner)
for _o, _clear in OUT_MASK.items():
    for _m in range(16):
        if _m & _clear or (_o == 4 and _m & 6 != 6):
            continue
        SPRITES.append((f"tile.hull.o{_o}.m{_m}", (1, 1), "block", lambda m=_m, o=_o: out_block(m, o)))
        if _o < 3:
            SPRITES.append((f"tile.hull.o{_o}.m{_m}.v1", (1, 1), "block", lambda m=_m, o=_o: out_block(m, o, 1)))
        if _o < 4:
            SPRITES.append((f"tile.hull.glass.o{_o}.m{_m}", (1, 1), "ghost", lambda m=_m, o=_o: glass(m, o)))
for _s in ("s", "e"):
    for _fam in ("wall", "hull"):
        SPRITES.append((f"tile.{_fam}.full.end.{_s}", (1, 1), "block", lambda f=_fam, s=_s: end_face(f, s)))
        SPRITES.append((f"tile.{_fam}.end.{_s}", (1, 1), "block", lambda f=_fam, s=_s: end_face(f, s, False)))
    SPRITES.append((f"tile.hull.drop.{_s}", (1, 1), "block", lambda s=_s: drop(s)))
for _ax in ("x", "y"):
    SPRITES += [(f"tile.door.{_ax}", (1, 1), "block", lambda a=_ax: door(a, False)),
                (f"tile.door.{_ax}.open", (1, 1), "block", lambda a=_ax: door(a, True)),
                (f"tile.door.low.{_ax}", (1, 1), "block", lambda a=_ax: door(a, False, True)),
                (f"tile.door.low.{_ax}.open", (1, 1), "block", lambda a=_ax: door(a, True, True))]
