"""Interior windows (tan, walls up): tile.wall.tan.full.m10 (the base) and its window pieces .win.l/.m/.r, the pane
see-through and tinted (the "glass" kind of jobs_window)."""
import os
import sys
os.environ["STRUCT_LOOKS"] = "tan"
os.environ["STRUCT_IDS"] = "tile.wall.full.m10"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jobs_window  # noqa: F401,E402  (patches env_build.render_sprite with the glass kind)
from sprites import structure  # noqa: E402
from sprites import wall3d_iwin as IW  # noqa: E402

jobs_window.JOBS.clear()


def _own(fn):
    def build():
        r = fn()
        return r[0] if isinstance(r, tuple) else r
    return build


JOBS = {}
for fid, fp, kind, fn in structure.jobs():
    if fid == "tile.wall.tan.full.m10":
        JOBS[fid] = (kind, fn)
        for part in ("l", "m", "r"):
            JOBS[f"{fid}.win.{part}"] = ("glass", IW.window(fn, part))

if os.environ.get("IWIN_CLOSE"):
    IW.CLOSE = True
if os.environ.get("IWIN_DIP"):
    IW.DIP = float(os.environ["IWIN_DIP"]) * IW.PZ
fid0 = "tile.wall.tan.full.m10"
if os.environ.get("IWIN_RAMP"):
    IW.RAMP_ONLY = True
    for _k in list(JOBS):
        if ".win." in _k:
            JOBS[_k] = (JOBS[fid0][0], JOBS[_k][1])
if os.environ.get("IWIN_DIAG"):
    IW.POST_IN = "fTG0"
jobs_window.TINT = jobs_window.np.array([12.0, 20.0, 20.0])   # interior glass: black (fTG1), barely there
jobs_window.ALPHA = float(os.environ.get("IWIN_ALPHA", "0.15"))
if os.environ.get("IWIN_RUN"):                                   # the shoulders' run, px (the slope follows)
    IW.ARCH_SLOPE = (5.0 / float(os.environ["IWIN_RUN"]),) * 2
if os.environ.get("IWIN_CURVE"):
    IW.JOINT_CURVE = int(os.environ["IWIN_CURVE"])
