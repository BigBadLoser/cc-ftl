"""Interior windows on the default walls (walls up): tile.wall.full.m10 and its window pieces .win.l/.m/.r, the
pane see-through and tinted (the "glass" kind of jobs_window)."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jobs_window  # noqa: E402  (patches env_build.render_sprite with the glass kind)
from sprites.envtiles import SPRITES  # noqa: E402
from sprites import wall3d_iwin_def as IW  # noqa: E402

jobs_window.JOBS.clear()
JOBS = {}
for sid, fp, kind, fn in SPRITES:
    if sid == "tile.wall.full.m10":
        JOBS[sid] = (kind, fn)
        for part in ("l", "m", "r"):
            JOBS[f"{sid}.win.{part}"] = ("glass", IW.window(fn, part))
jobs_window.TINT = jobs_window.np.array([12.0, 20.0, 20.0])
jobs_window.ALPHA = 0.25
