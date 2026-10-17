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
        # decorative straights (indicator screen, vent): kept in the manifest, not picked by the renderer
        for _m in (5, 10):
            for _k, _d in enumerate(("screen", "vent"), 1):
                SPRITES.append((f"tile.{_id}.m{_m}.v{_k}", (1, 1), "block", lambda m=_m, f=_fam, d=_d: block(m, f, d)))
for _s in ("s", "e"):
    for _b in range(4):
        SPRITES.append((f"tile.hull.haz.{_s}.{_b}", (1, 1), "block", lambda s=_s, b=_b: hazard(s, b)))
for _ax in ("x", "y"):
    SPRITES += [(f"tile.door.{_ax}", (1, 1), "block", lambda a=_ax: door(a, False)),
                (f"tile.door.{_ax}.open", (1, 1), "block", lambda a=_ax: door(a, True))]
