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
sh = record(lambda: S.build(B.BayFrame(core.Mesh("chk2"), 0, off=(B.UC, 0.0)), "parked"))
c = B.BayFrame(None, 0).pt(B.UC, 0.0, 0.0)
k, lz = 0.88, -B.PIT + 0.05 - 0.04 * 0.88                 # same transform as proto_bay.placeholder (scale about the centre)
C = (c.x, c.y, 0.0)
X = lambda p: tuple(C[i] + k * (p[i] - C[i]) + (lz if i == 2 else 0.0) for i in range(3))  # noqa: E731
for p in sh:
    if p["kind"] == "box":
        lo, hi = X(p["lo"]), X(p["hi"])
        p["lo"], p["hi"] = list(lo), list(hi)
    elif p["kind"] == "seg":
        p["a"], p["b"], p["r"] = X(p["a"]), X(p["b"]), p["r"] * k
    else:
        ax = p["axis"]
        cross = [i for i in range(3) if i != ax]
        q = [0.0, 0.0, 0.0]
        q[cross[0]], q[cross[1]] = p["c"]
        q[ax] = p["a"][0]
        q0 = X(q)
        q[ax] = p["a"][1]
        q1 = X(q)
        p["c"] = (q0[cross[0]], q0[cross[1]])
        p["a"] = (min(q0[ax], q1[ax]), max(q0[ax], q1[ax]))
        p["r"] = (p["r"][0] * k, p["r"][1] * k)
ps = bay + sh
overlap.report(ps, ALLOW)
overlap.floating(ps)
