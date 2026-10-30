"""The door along y (in a wall along y, its face toward +x), closed, half open and open."""
from sprites import door_block as DB

JOBS = {f"door.y.{t}": ("block", (lambda t=t: DB.door("y", leaf="halves", t=t, look="metal"))) for t in (0.0, 0.5, 1.0)}
