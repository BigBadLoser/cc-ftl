"""Overlap check for the weapon concepts (runs in Blender, no render):
  blender -b --factory-startup --python tools/blender/review/proto_concepts_overlap.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, cmbkit, overlap, weapon_concepts as W  # noqa: E402

ALLOW = [("saddle", "breech"), ("column", "ammo"), ("column", "saddle"), ("column", "breech"), ("column", "drum"), ("column", "cradle"), ("column", "pod"),
         ("base", "dome"), ("base", "yoke"), ("base", "pod"), ("dome", "cupola"), ("dome", "mantlet"), ("mantlet", "barrel"),
         ("dome", "barrel"), ("yoke", "body"), ("body", "barrel"), ("pod", "nose"), ("pod", "barrel"), ("nose", "barrel"),
         ("drum", "breech"), ("ammo", "breech"), ("cradle", "breech"), ("body", "yoke"), ("ammo", "pod"), ("dome", "base")]


def check(name, fn):
    rec = cmbkit.REC = overlap.Recorder()
    fn(cmbkit.Frame(core.Mesh("chk"), 1, square=True), True)
    cmbkit.REC = None
    print("==", name)
    overlap.report(rec.parts, ALLOW)


for d, fns in W.FNS.items():
    for n, fn in zip(("turret_laser", "turret_driver", "bay_driver"), fns):
        check(f"{d}:{n}", fn)
