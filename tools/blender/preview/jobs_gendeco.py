"""jobs_gen's generic hull pieces' tint masks (masks.py)."""
import runpy
import sys
from pathlib import Path

from sprites import wall3d_ext as X

sys.path.insert(0, str(Path(__file__).parent))
import masks  # noqa: E402

BASE = runpy.run_path(str(Path(__file__).parent / "jobs_gen.py"))["JOBS"]
JOBS = masks.jobs({k: v for k, v in BASE.items() if k.startswith("tile.hull.ext")}, X.TINT)
