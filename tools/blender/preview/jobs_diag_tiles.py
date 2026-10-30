"""Diagonal walls, per tile: the camera-facing diagonal (a staircase along (1, -1) of mask 9 and mask 6 tiles) as one
squeezed relief panel per tile, on the diagonal's centre line y = -(x - 0.5) + YC (through the straight runs' centre
line where they meet it): a mask 9 tile holds the panel across its -x-y corner, a mask 6 tile across its +x+y one."""
import math
import sys
from pathlib import Path

from sprites import wall3d as T

sys.path.insert(0, str(Path(__file__).parent))
from jobs_diag_mock import YC  # noqa: E402
from jobs_diag_relief import _place  # noqa: E402

S = math.sqrt(2) / 2                       # the panel's length (a staircase tile's share of the diagonal)
CORNER = {9: (-0.25, -0.25 + YC), 6: (0.25, 0.25 + YC)}


def piece(mask, level="up"):
    cx, cy = CORNER[mask]
    return _place(T.block(10, "wall", level=level), cx, cy, -45, S)


JOBS = {f"tile.wall.diag.a.m{m}": ("block", lambda m=m: piece(m)) for m in (9, 6)}
