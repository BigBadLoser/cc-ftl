"""The door blockout's leaf motions (door_block.LEAVES), closed, half open and open, along x."""
import os

from sprites import door_block as DB

KINDS = os.environ.get("LEAVES", " ".join(DB.LEAVES)).split()
JOBS = {f"door.leaf.{lf}.{t}": ("block", (lambda lf=lf, t=t: DB.door("x", leaf=lf, t=t, look=os.environ.get("LOOK", "block"),
                                                                       frame=os.environ.get("FRAME", "plain"))))
        for lf in KINDS for t in (0.0, 0.5, 1.0)}
