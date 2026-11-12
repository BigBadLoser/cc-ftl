"""Double bunk bed look study preview (plain python3 + numpy + PIL): each design at r0 on its 1x2 floor, a crew member
at its foot end for scale, and the game's single bed first for comparison.

  python3 -I tools/blender/review/bunk_preview.py <bunk assets dir> <out dir> [designs, default b1,b2,b3]
    -> bunk-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, human, iso  # noqa: E402

NAMES = {"b1": "B1  steel frame", "b2": "B2  berth cabinet", "b3": "B3  locker frame",
         "b1a": "B1a  upper railed full length", "b1b": "B1b  both decks railed", "b1c": "B1c  upper walled in"}
CW, CH = 200, 220


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "b1,b2,b3").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cols = [("module.bed", pub, "single bed (game)")] + [(f"module.bunk.{v}", G, NAMES.get(v, v)) for v in names]
    cv = Canvas(CW * len(cols), CH)
    for i, (aid, src, label) in enumerate(cols):
        ox, oy = 95 + i * CW, 150                                    # the module's anchor: its front tile
        for gx in range(-1, 2):
            for gy in range(-2, 2):
                floor(cv, pub, *iso(ox, oy, gx, gy), 1, 1)
        cv.static(src, aid, ox, oy)
        cv.char(human(pub, 6), *iso(ox, oy, -1, 1))
        cv.labels.append((ox - 50, oy + 52, label))
    for s in (1, 3):
        cv.save(out / f"bunk-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
