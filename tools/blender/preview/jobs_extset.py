"""The exterior run set as the game builds it (envtiles: the near runs and corners, tile.hull.ext.o<o>.m<mask>, the
straight runs' designs .a1 .. .a3). MASKS=1: their tint masks too (masks.py)."""
import os
import sys
from pathlib import Path

from sprites import wall3d_ext as X
from sprites.envtiles import SPRITES

sys.path.insert(0, str(Path(__file__).parent))
import masks  # noqa: E402

JOBS = {sid: (kind, fn) for sid, fp, kind, fn in SPRITES if sid.startswith("tile.hull.ext.o") and ".v1" not in sid}
if os.environ.get("MASKS"):
    JOBS |= masks.jobs(JOBS, X.TINT)
