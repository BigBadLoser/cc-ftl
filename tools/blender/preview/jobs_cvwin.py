"""Interior windows on civil (walls up): tile.wall.civil.v1.full.m10 and its window pieces .win.l/.m/.r with civil's own
window (wall3d_iwin_civil), the pane see-through and tinted (jobs_window's glass kind)."""
import os
import sys
os.environ["STRUCT_LOOKS"] = "civil.v1"
os.environ["STRUCT_IDS"] = "tile.wall.full.m10"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jobs_window  # noqa: F401,E402
from sprites import structure  # noqa: E402

jobs_window.JOBS.clear()
JOBS = {}
for fid, fp, kind, fn in structure.jobs():
    if fid == "tile.wall.civil.v1.full.m10":
        JOBS[fid] = (kind, fn)
        try:
            from sprites import wall3d_iwin_civil as IW
        except ImportError:
            IW = None
        if IW is not None:
            for part in ("l", "m", "r"):
                JOBS[f"{fid}.win.{part}"] = ("glass", IW.window(fn, part))
jobs_window.TINT = jobs_window.np.array([12.0, 20.0, 20.0])
jobs_window.ALPHA = 0.25
print("CWIN JOBS", list(JOBS))
