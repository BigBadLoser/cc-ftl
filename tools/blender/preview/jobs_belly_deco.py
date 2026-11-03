"""jobs_belly_look's pieces and their tint masks (masks.py; the belly's seams are in untinted tones already, so
no seam pass). DECO_ONLY=1: the masks alone."""
import os
import runpy
import sys
from pathlib import Path

from sprites import wall3d_belly as B

sys.path.insert(0, str(Path(__file__).parent))
import masks  # noqa: E402

BASE = runpy.run_path(str(Path(__file__).parent / "jobs_belly_look.py"))["JOBS"]
JOBS = ({} if os.environ.get("DECO_ONLY") else dict(BASE)) | masks.jobs(BASE, B.TINT, seams=False)
