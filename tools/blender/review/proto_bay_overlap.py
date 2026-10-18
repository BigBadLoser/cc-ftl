"""Overlap + floating-part check for the shuttle bay prototype (runs in Blender, no render):
  blender -b --factory-startup --python tools/blender/review/proto_bay_overlap.py
Checks the bay closed and part-open at every rotation, and the placeholder shuttle standing in the well (r0)."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, cmbkit, overlap, shuttle_bay as B, shuttle as S  # noqa: E402

# intended mounts: wall kit on the well walls, the lip on the well, gate posts and gangway on the lip
ALLOW = [("pit", "coaming"), ("pit", "hatch"), ("gate", "coaming"), ("bridge", "coaming"), ("bridge", "gate"),
         ("lights", "coaming"), ("lights", "gate"),
         ("coaming", "pedestal")]   # false positive: the diagonal lip prism is tested as its bounding box; the pedestal's
#                                     nearest corner is 0.27 clear of the chamfer line
SHUTTLE = {"hull", "belt", "cabin", "spine", "door", "vent", "nacelle", "nozzle", "pylon", "navlight", "leg", "foot"}
ALLOW += [(a, b) for a in SHUTTLE for b in SHUTTLE]       # placeholder internals are not under review


def record(fn):
    rec = cmbkit.REC = overlap.Recorder()
    fn()
    cmbkit.REC = None
    return rec.parts


for rot in (0, 1, 2, 3):
    for t in (0.0, 0.66):
        print(f"== bay r{rot} t{t}")
        ps = record(lambda: B.build(B.BayFrame(core.Mesh("chk"), rot), t))
        overlap.report(ps, ALLOW)
        overlap.floating(ps)

print("== bay r0 + placeholder shuttle in the well")
bay = record(lambda: B.build(B.BayFrame(core.Mesh("chk"), 0), 0.0))
sh = record(lambda: S.build(B.BayFrame(core.Mesh("chk2"), 0, off=S.OFF), "parked"))
dz = -B.PIT + 0.01
for p in sh:                                              # Mesh.dz is applied at build, so shift the recorded parts here
    if p["kind"] == "box":
        p["lo"][2] += dz
        p["hi"][2] += dz
    elif p["kind"] == "seg":
        p["a"] = (p["a"][0], p["a"][1], p["a"][2] + dz)
        p["b"] = (p["b"][0], p["b"][1], p["b"][2] + dz)
    elif p["axis"] == 2:
        p["a"] = (p["a"][0] + dz, p["a"][1] + dz)
    else:
        p["c"] = (p["c"][0], p["c"][1] + dz)
ps = bay + sh
overlap.report(ps, ALLOW)
overlap.floating(ps)
