"""Overlap check for the engine prototype (runs in Blender, no render):
  blender -b --factory-startup --python tools/blender/review/proto_overlap.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, cmbkit, overlap, engine_proto as E, walls  # noqa: E402

ALLOW = [("bulkhead", "wall"), ("pylon", "bulkhead"), ("pylon", "wall"), ("bell", "bulkhead"), ("bell", "wall"),
         ("collar", "bulkhead"), ("collar", "wall"), ("collar", "bell"), ("bulkhead", "greeble_on_bulkhead")]


def parts_for(rot, full):
    rec = cmbkit.REC = overlap.Recorder()
    f = cmbkit.Frame(core.Mesh("chk"), rot, centre=E.CENTRE[rot])
    # real hull wall volumes: the 4 engine tiles plus the neighbouring wall tile each side (flat top + foot slope)
    top = walls.HF if full else walls.H
    rec.group = "wall"
    for v0, v1 in ((-3.0, -2.0), (-2.0, 2.0), (2.0, 3.0)):
        for u0, u1, z1 in ((E.UH - walls.WT, E.UH + walls.WT, top), (E.UH - 0.5, E.UH + 0.5, walls.H)):
            a, b = f.pt(u0, v0, 0), f.pt(u1, v1, z1)
            rec.add({"kind": "box", "lo": [min(a[i], b[i]) for i in range(3)], "hi": [max(a[i], b[i]) for i in range(3)], "src": "wall"})
    E.bulkhead(f, full)
    E.machine(f, rot, True)
    cmbkit.REC = None
    return rec.parts


for rot in (1, 0):
    for full in (True, False):
        print(f"== r{rot} {'full' if full else 'cut'}")
        overlap.report(parts_for(rot, full), ALLOW)
