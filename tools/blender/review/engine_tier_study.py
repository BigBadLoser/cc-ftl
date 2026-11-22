"""Engine tier fit-out study sheet (plain python3): one row per concept, Mk I | Mk II | Mk III at rotation 0 on deck
tiles with a crew member for scale. Each render directory is a render.py --out (engine_kestrel_h185) of one engine.

  python3 -I tools/blender/review/engine_tier_study.py <out.png> <mk1 dir> <concept>=<mk2 dir>,<mk3 dir> ...
"""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from study_sheet import Study, sheet  # noqa: E402


def merged(dirs):
    """One study dir whose manifest.json holds every render's sprites (paths made absolute)."""
    tmp = Path(tempfile.mkdtemp())
    man = {"version": 1, "sheets": {}, "assets": {}}
    for d in dirs:
        frag = json.loads((Path(d) / "manifest.fragment.json").read_text())
        for sid, sh in frag["sheets"].items():
            man["sheets"][sid] = {k: str(Path(d).resolve() / v) for k, v in sh.items()}
        man["assets"].update(frag["assets"])
    (tmp / "manifest.json").write_text(json.dumps(man))
    return tmp


def cell(st, asset, depth):
    sc = st.scene().floor(-3, -depth + 1, 0, 0)
    for part in ("bell", "hull", "machine.open"):
        sc.sprite(f"{asset}.{part}.r0")
    return sc.crew(1, -depth + 2)


def main():
    out, mk1, *rows = sys.argv[1:]
    concepts = [(r.split("=")[0], r.split("=")[1].split(",")) for r in rows]
    dirs = [mk1] + [d for _, ds in concepts for d in ds]
    st = Study(merged(dirs))
    cells = []
    for name, (d2, d3) in concepts:
        cells.append((f"{name}  Mk I", cell(st, "module.engine", 5)))
        cells.append((f"{name}  Mk II", cell(st, f"module.engine_mk2_{name}", 6)))
        cells.append((f"{name}  Mk III", cell(st, f"module.engine_mk3_{name}", 7)))
    print(out, sheet(cells, out, scale=2, columns=3, title="Engine tiers: fit-out concepts (r0, preview)"))


if __name__ == "__main__":
    main()
