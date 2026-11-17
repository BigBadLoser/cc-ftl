"""Measure the transport shuttle hull by raycasts (flank surface v by u and z, belly z by u and v), for placing gear bays and
hatches on its real skin. blender -b --factory-startup --python tools/blender/review/shuttle_hull_probe.py -- tools/blender"""
import sys, math
sys.path.insert(0, sys.argv[sys.argv.index("--") + 1])
import bpy
from sprites import core
from sprites.shuttle_craft import transport_shuttle
from lib.transport_forms import FlightFrame
core.setup_scene()
core.clear_scene_meshes()
objs = transport_shuttle(0.0, "docked")
dg = bpy.context.evaluated_depsgraph_get()
sc = bpy.context.scene
m = core.Mesh("probe"); f = FlightFrame(m, 0.0)
def W(u, v, z): return f.pt(u, v, z)
def hit(a, b):
    a, b = W(*a), W(*b)
    d = (b - a); L = d.length; d.normalize()
    ok, loc, n, *_ = sc.ray_cast(dg, a, d, distance=L)
    return ok, (loc - a).length / L if ok else None
# outer surface v at (u, z): cast from v=3 inward
print("U  Z  v_surface(+side)")
for u in [-1.9, -1.6, -1.35, -1.0, -0.6, -0.2, 0.2, 0.6, 1.0, 1.4, 1.8, 2.2]:
    row = []
    for z in [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3]:
        ok, t = hit((u, 3.0, z), (u, 0.0, z))
        row.append(f"{3.0 - 3.0 * t:.2f}" if ok else "  - ")
    print(f"{u:5.2f}", " ".join(row))
print("belly z (cast up from z=-1) at v:")
for u in [-1.9, -1.35, -1.0, -0.6, 0.2, 1.0, 1.4, 1.8]:
    row = []
    for v in [0.0, 0.3, 0.6, 0.8, 1.0, 1.2]:
        ok, t = hit((u, v, -1.0), (u, v, 3.0))
        row.append(f"{-1 + 4 * t:.2f}" if ok else "  - ")
    print(f"{u:5.2f}", " ".join(row))
