"""Build every asset into public/assets/ and write manifest.json. Run through `npm run assets`:
    blender -b --factory-startup --python tools/blender/build.py
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from lib.palette import ROOT  # noqa: E402
from crew import human  # noqa: E402

OUT = ROOT / "public" / "assets"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    assets = human.build_all(OUT)
    for a in assets:
        a["bytes"] = (OUT / a["file"]).stat().st_size
    manifest = {"version": 1, "assets": assets}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
    print(f"wrote {len(assets)} assets")
    for a in assets:
        print(f"  {a['bytes']:>7}  {a['id']}")


main()
