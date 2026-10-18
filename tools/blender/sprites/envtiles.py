"""Registry of the wall, hull, ghost, door and floor sprites: (id, footprint, kind, builder)."""
from .doors import door
from .floors import floor
from .ghosts import ghost
from .walls import block, hazard

FLOORS = "abcdefgh"
SPRITES = [(f"tile.floor.{v}", (1, 1), "floor", lambda v=v: floor(v)) for v in FLOORS]
for _fam, _id in (("wall", "wall"), ("hull", "hull"), ("ghost", "hull.ghost")):
    for _m in range(16):
        SPRITES.append((f"tile.{_id}.m{_m}", (1, 1), "ghost" if _fam == "ghost" else "block",
                        lambda m=_m, f=_fam: ghost(m) if f == "ghost" else block(m, f)))
    if _fam != "ghost":
        for _m in range(16):
            SPRITES.append((f"tile.{_id}.full.m{_m}", (1, 1), "block", lambda m=_m, f=_fam: block(m, f, None, None, True)))
    if _fam == "hull":                                 # colour-swapped plating variant, alternated by the renderer
        for _m in range(16):
            SPRITES.append((f"tile.hull.m{_m}.v1", (1, 1), "block", lambda m=_m: block(m, "hull", 1)))
            SPRITES.append((f"tile.hull.full.m{_m}.v1", (1, 1), "block", lambda m=_m: block(m, "hull", 1, None, True)))
for _s in ("s", "e"):
    for _b in range(4):
        SPRITES.append((f"tile.hull.haz.{_s}.{_b}", (1, 1), "block", lambda s=_s, b=_b: hazard(s, b)))
for _ax in ("x", "y"):
    SPRITES += [(f"tile.door.{_ax}", (1, 1), "block", lambda a=_ax: door(a, False)),
                (f"tile.door.{_ax}.open", (1, 1), "block", lambda a=_ax: door(a, True)),
                (f"tile.door.low.{_ax}", (1, 1), "block", lambda a=_ax: door(a, False, True)),
                (f"tile.door.low.{_ax}.open", (1, 1), "block", lambda a=_ax: door(a, True, True))]
