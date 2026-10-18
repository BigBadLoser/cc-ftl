"""Overlap check for the weapon prototypes (runs in Blender, no render):
  blender -b --factory-startup --python tools/blender/review/proto_weapon_overlap.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, cmbkit, overlap, weapon_proto as W  # noqa: E402

BAY_ALLOW = [("column", "body"), ("pod", "plinth"), ("cap", "plinth"), ("body", "plinth"), ("pod", "body"), ("cap", "body"), ("column", "plinth"), ("pod", "cap")]
TUR_ALLOW = [("base", "head"), ("barrel", "head"), ("barrel", "yoke"), ("yoke", "head"), ("greeble", "head"), ("cradle", "head"),
             ("rail", "cradle"), ("rail", "head"), ("greeble", "base"), ("greeble", "rail")]


def check(name, fn, allow):
    rec = cmbkit.REC = overlap.Recorder()
    fn(cmbkit.Frame(core.Mesh("chk"), 1, square=True), True)
    cmbkit.REC = None
    print("==", name)
    overlap.report(rec.parts, allow)


check("bay_laser", W.bay_laser, BAY_ALLOW)
check("turret_laser", W.turret_laser, TUR_ALLOW)
check("bay_driver", W.bay_driver, BAY_ALLOW)
check("turret_driver", W.turret_driver, TUR_ALLOW)
