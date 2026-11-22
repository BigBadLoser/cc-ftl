"""manifest_io: the split manifest reassembles to the original, and a family rebuild rewrites only its own part file.
Run: python3 tools/blender/test_manifest_io.py   (no Blender)"""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sprites import manifest_io as mio  # noqa: E402
from sprites import pack  # noqa: E402


def static(sheet, n):
    return {"kind": "static", "sheet": sheet, "frame": {"x": n, "y": 0, "w": 4, "h": 4}, "anchor": {"x": 1, "y": 1}, "footprint": [1, 1]}


layer = {"kind": "crew.layer", "frameW": 8, "frameH": 8, "anchor": {"x": 4, "y": 6},
         "clips": {"idle": {"sheet": "crew.human.body.idle", "start": 0}, "walk": {"sheet": "crew.human.body.walk", "start": 0}}}
m = {"version": 1, "tile": {"w": 64, "h": 32}, "keyColors": {"team.skin": "#ff00ff"}, "heights": {"wall": 1.85},
     "sheets": {"crew.human.body.idle": {"image": "sprites/crew.human.body.idle.png"},
                "crew.human.body.walk": {"image": "sprites/crew.human.body.walk.png"},
                "hull": {"image": "sprites/hull.png"}, "hull.1": {"image": "sprites/hull.1.png", "glow": "sprites/hull.1.glow.png"},
                "walls": {"image": "sprites/walls.png"}},
     "assets": {"crew.human.body": layer, "tile.hull.a": static("hull", 0), "tile.hull.b": static("hull.1", 5), "tile.wall.a": static("walls", 9)}}

index, parts = mio.split(m)
assert index["parts"] == ["crew", "hull", "walls"], index["parts"]
assert set(parts["crew"]["sheets"]) == {"crew.human.body.idle", "crew.human.body.walk"} and set(parts["hull"]["sheets"]) == {"hull", "hull.1"}
assert mio.assemble(index, parts) == {**m, "sheets": dict(sorted(m["sheets"].items())), "assets": dict(sorted(m["assets"].items()))}

with tempfile.TemporaryDirectory() as d:
    d = Path(d)
    assert sorted(mio.write_manifest(d / "manifest.json", m)) == ["crew", "hull", "manifest.json", "walls"]
    assert mio.read_manifest(d) == mio.read_manifest(d / "manifest.json") == mio.assemble(index, parts)
    assert (d / "manifest/walls.json").read_text().splitlines()[5].startswith('"tile.wall.a":{')   # one entry per line
    assert mio.write_manifest(d / "manifest.json", mio.read_manifest(d)) == [], "an unchanged manifest rewrites nothing"
    # rebuild one family through pack.merge/save_manifest: only its part file changes
    cur = pack.load_manifest(d / "manifest.json", {"version": 1})
    pack.merge(cur, "walls", {"walls": {"image": "sprites/walls.png"}}, {"tile.wall.a": static("walls", 11), "tile.wall.b": static("walls", 12)})
    pack.save_manifest(d / "manifest.json", cur)
    assert json.loads((d / "manifest/walls.json").read_text())["assets"]["tile.wall.b"]["frame"]["x"] == 12
    cur = pack.load_manifest(d / "manifest.json", {"version": 1})
    cur["assets"]["tile.wall.c"] = static("walls", 13)
    cur["assets"]["tile.new.a"] = static("newfam", 1)
    cur["sheets"]["newfam"] = {"image": "sprites/newfam.png"}
    before = {f.name: f.read_bytes() for f in (d / "manifest").glob("*.json")}
    pack.save_manifest(d / "manifest.json", cur)
    after = {f.name: f.read_bytes() for f in (d / "manifest").glob("*.json")}
    assert {k for k in after if before.get(k) != after[k]} == {"walls.json", "newfam.json"}, "only the touched families change"
    # a part that empties out is removed
    cur = pack.load_manifest(d / "manifest.json", {"version": 1})
    del cur["assets"]["tile.new.a"], cur["sheets"]["newfam"]
    pack.save_manifest(d / "manifest.json", cur)
    assert not (d / "manifest/newfam.json").exists() and "newfam" not in json.loads((d / "manifest.json").read_text())["parts"]
    # a single-file manifest (a fragment) is read and written whole
    pack.save_manifest(d / "manifest.fragment.json", cur)
    assert "parts" not in json.loads((d / "manifest.fragment.json").read_text()) and mio.read_manifest(d / "manifest.fragment.json") == cur
print("manifest_io ok")
