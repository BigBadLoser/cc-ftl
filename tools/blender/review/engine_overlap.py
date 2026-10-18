"""Clipping + floating-part check for the engine (runs in Blender, no render):
  blender -b --factory-startup --python tools/blender/review/engine_overlap.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, cmbkit, overlap, engine as E, walls  # noqa: E402

walls.HF = 2.4     # local override: full walls are being raised to 2.4 on a parallel branch

MOUNTS = {"bulkhead": ("wall", "collar", "icollar", "ports"), "collar": ("wall", "bell", "icollar"), "icollar": ("wall", "bell", "chamber"),
          "bell": ("wall", "bulkhead", "chamber", "torus", "mouth"), "mouth": ("plume",),
          "chamber": ("manifold", "gimbal", "act", "cool", "lox", "fuel"), "manifold": ("lox", "fuel"), "gimbal": ("frame",),
          "pump": ("saddle", "inlet", "lox", "fuel", "exhaust"), "exhaust": ("wall", "bulkhead", "torus", "bell", "collar"),
          "ports": ("wall", "exhaust", "cool", "collar", "icollar"), "act": ("bulkhead",),
          "hx": ("cool",), "cool": ("wall", "bulkhead"), "plume": ("bell", "torus")}
ALLOW = [(a, b) for a, bs in MOUNTS.items() for b in bs]


def parts_for(rot):
    rec = cmbkit.REC = overlap.Recorder()
    f = cmbkit.Frame(core.Mesh("chk"), rot, centre=E.CENTRE[rot])
    rec.group = "wall"
    for v0, v1 in ((-3.0, -2.0), (2.0, 3.0)):          # neighbouring hull walls
        for u0, u1, z1 in ((E.UW - walls.WT, E.UW + walls.WT, walls.HF), (E.UW - 0.5, E.UW + 0.5, walls.H)):
            a, b = f.pt(u0, v0, 0), f.pt(u1, v1, z1)
            rec.add({"kind": "box", "lo": [min(a[i], b[i]) for i in range(3)], "hi": [max(a[i], b[i]) for i in range(3)], "src": "wall"})
    rec.group = "deck"
    a, b = f.pt(-2.5, -2.0, -0.05), f.pt(1.5, 2.0, 0.0)
    rec.add({"kind": "box", "lo": [min(a[i], b[i]) for i in range(3)], "hi": [max(a[i], b[i]) for i in range(3)], "src": "deck"})
    E.bulkhead(f)
    E.machine(f, True)
    cmbkit.REC = None
    return rec.parts


for rot in (1, 0):
    print(f"== r{rot}")
    ps = parts_for(rot)
    overlap.report(ps, ALLOW)
    overlap.floating(ps)
