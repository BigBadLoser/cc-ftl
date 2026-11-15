"""2x1 desk look study preview (plain python3 + numpy + PIL): each desk at r0 with its hologram, on a floor, a
crew member standing beside for scale.

  python3 -I tools/blender/review/desk2_preview.py <desk out dir> <out dir> [designs, default d1,d2,d3]
    -> desk2-3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bench_module_preview import as_game  # noqa: E402
from robots_preview import ROOT, Assets, Canvas, human, iso  # noqa: E402

NAMES = {"h1": "H1  scanner arch, customs", "h2": "H2  hover, office", "h3": "H3  retro, guard",
         "g1": "G1  waterfall, office", "g2": "G2  podium, customs", "g3": "G3  salvage, guard",
         "f1": "F1  flight cases, guard", "f2": "F2  glass top, office", "f3": "F3  twin fins, customs",
         "e1": "E1  arc, office", "e2": "E2  trestle, guard", "e3": "E3  cantilever, customs",
         "d1": "D1  slab, office", "d2": "D2  console, guard", "d3": "D3  counter, customs"}
CHAIR = (-1.0, 0.0)                 # consoles.meta(desk, 0)["chair_rel_origin"]: the chair from the sprite origin
SEAT_DIR, CW, CH = 6, 260, 210      # consoles.SEAT_DIR[0]


def main():
    G, pub, out = Assets(sys.argv[1]), as_game(Assets(ROOT / "public/assets/1x")), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "d1,d2,d3").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(CW * len(names), CH)
    for i, v in enumerate(names):
        for row, seated in enumerate((False,)):
            ox, oy = 150 + i * CW, 120 + row * CH
            for gx in range(-2, 2):
                for gy in range(-2, 2):
                    cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
            cv.static(G, f"module.desk2.{v}", *iso(ox, oy, 0, 0))
            if f"module.desk2.{v}.holo" in G.m["assets"]:
                cv.static(G, f"module.desk2.{v}.holo", *iso(ox, oy, 0, 0))
            if seated:
                cv.char(human(pub, SEAT_DIR, "sit_work"), *map(round, iso(ox, oy, *CHAIR)))
            fid = f"module.desk2.{v}.front.r0.active"
            if fid in G.m["assets"]:
                cv.static(G, fid, *iso(ox, oy, 0, 0))
            if not seated:
                cv.char(human(pub, 2), *map(round, iso(ox, oy, 2.0, 0.3)))
            cv.labels.append((ox - 60, oy + 70, f"{NAMES.get(v, v)}{'  seated' if seated else ''}"))
    cv.save(out / "desk2-3x.png", 3)
    print("wrote", out)


if __name__ == "__main__":
    main()
