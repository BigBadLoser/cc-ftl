"""Shuttle flight preview renders (runs in Blender): the flying shuttle in 8 headings (wings spread, nozzles glowing) and the
docked pose (legs up, wings folded, nozzles dark, nose out) at the 4 cardinal headings, as .npz for proto_shuttle_fly_composite.py.
  blender -b --factory-startup --python tools/blender/review/proto_shuttle_fly.py -- <out dir>"""
import math
import sys
from pathlib import Path
import bpy  # noqa: F401
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, post, vehicle_bay as VB, shuttle_craft as SC  # noqa: E402
from lib import palette  # noqa: E402

OUT = Path(sys.argv[sys.argv.index("--") + 1])
OUT.mkdir(parents=True, exist_ok=True)
for k, hx in VB.LIVERY.items():
    palette._data[k] = {"hex": hx}
core.setup_scene()
for name, state, heading in [(f"fly_d{d}", "fly", d * math.pi / 4) for d in range(8)] + [(f"docked_d{d}", "docked", d * math.pi / 4) for d in (0, 2, 4, 6)]:
    core.clear_scene_meshes()
    post.select(True)
    it = VB._render(name, "prop", SC.transport_shuttle(heading, state), [], (1, 1))
    np.savez(OUT / f"{name}.npz", rgba=it["rgba"], g=it["g"], ax=it["ax"], ay=it["ay"])
    print("done", name, it["rgba"].shape, flush=True)
