"""2x1 desk look study preview, as a post (plain python3 + numpy + PIL): each desk at r0 with its hologram, the console
chair behind it with an officer seated facing the camera, and a visitor standing at the front facing the desk.

  python3 -I tools/blender/review/desk2_post_preview.py <desk out dir> <out dir> <designs, e.g. j1,j2,j3>
    -> desk2-post-3x.png
Grid coords are the desk sprite's: its tiles are (-1, 0) and (0, 0) (the K frame's offset), front +y."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bench_module_preview import as_game  # noqa: E402
from robots_preview import ROOT, Assets, Canvas, human, iso  # noqa: E402

NAMES = {"j1": "J1  reception counter", "j2": "J2  monitoring desk", "j3": "J3  open desk, scanner"}
CHAIR, VISITOR = (-1.0, -1.0), (-1.0, 1.05)
FACE_FRONT, FACE_BACK, CW, CH = 2, 6, 280, 230       # crew directions: +y (the camera side) and -y


def main():
    G, pub, out = Assets(sys.argv[1]), as_game(Assets(ROOT / "public/assets/1x")), Path(sys.argv[2])
    names = sys.argv[3].split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(CW * len(names), CH)
    for i, v in enumerate(names):
        ox, oy = 160 + i * CW, 120
        for gx in range(-3, 2):
            for gy in range(-2, 3):
                cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
        cv.static(G, "module.desk2.chair", *map(round, iso(ox, oy, *CHAIR)))
        cv.char(human(pub, FACE_FRONT, "sit_work"), *map(round, iso(ox, oy, *CHAIR)))
        cv.static(G, f"module.desk2.{v}", *iso(ox, oy, 0, 0))
        if f"module.desk2.{v}.holo" in G.m["assets"]:
            cv.static(G, f"module.desk2.{v}.holo", *iso(ox, oy, 0, 0))
        cv.char(human(pub, FACE_BACK), *map(round, iso(ox, oy, *VISITOR)))
        cv.labels.append((ox - 60, oy + 90, NAMES.get(v, v)))
    cv.save(out / "desk2-post-3x.png", 3)
    print("wrote", out)


if __name__ == "__main__":
    main()
