"""The relief door designs (doors3d), closed and open, along x and y, with the relief wall runs either side of them
and the floor (doors_mock.py composes them)."""
from sprites import doors3d as DD
from sprites.envtiles import SPRITES
from sprites import wall3d as T

JOBS = {f"door.{d}.{ax}{'.open' if op else ''}": ("block", (lambda d=d, ax=ax, op=op: DD.door(ax, op, d)))
        for d in DD.DESIGNS for ax in "xy" for op in (False, True)}
JOBS.update({f"wall.m{m}": ("block", (lambda m=m: T.block(m, "wall", level="up"))) for m in (10, 5)})
JOBS.update({sid: (kind, fn) for sid, fp, kind, fn in SPRITES if sid == "tile.floor.a"})
