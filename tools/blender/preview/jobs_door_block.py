"""The door blockout (door_block), closed and open, along x and y."""
from sprites import door_block as DB

JOBS = {f"door.block.{ax}{'.open' if op else ''}": ("block", (lambda ax=ax, op=op: DB.door(ax, op)))
        for ax in "xy" for op in (False, True)}
