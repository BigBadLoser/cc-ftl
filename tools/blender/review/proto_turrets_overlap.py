"""Clipping + floating-part check for the turret and bay concepts (runs in Blender, no render):
  blender -b --factory-startup --python tools/blender/review/proto_turrets_overlap.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import cmbkit, overlap, turret_concepts as TC, turret_bays as TB  # noqa: E402

# intended mounts: a part seated in / passing through the one it is fixed to
ALLOW = [("table", "neck"), ("table", "drum"), ("neck", "breech"), ("neck", "cylinder"), ("neck", "motor"),
         ("breech", "barrel"), ("breech", "rods"), ("hoops", "rods"), ("barrel", "hoops"), ("barrel", "rods"), ("barrel", "brake"), ("barrel", "cylinder"),
         ("drum", "trunnion"), ("trunnion", "carriage"), ("carriage", "barrel"), ("carriage", "brake"),
         ("motor", "cluster"), ("bus", "caps"), ("bus", "trunk"), ("arm", "feeder"), ("arm", "trunk"), ("hoopfoot", "feeder")]


def check(name, build):
    rec = cmbkit.REC = overlap.Recorder()
    build()
    cmbkit.REC = None
    print(f"== {name}: {len(rec.parts)} parts")
    overlap.report(rec.parts, ALLOW)
    overlap.floating(rec.parts)


for (d_, kind), fn in TC.TURRETS.items():
    check(f"turret {d_} {kind}", lambda fn=fn: fn(True))
for d_ in "HSR":
    check(f"bay {d_}", lambda d_=d_: TB.bay(d_))
