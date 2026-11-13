"""Furniture look study (bunk, exercise, ...; 1 x 2) preview (plain python3 + numpy + PIL): each design at r0 on its 1x2 floor, a crew member
at its foot end for scale, and the game's single bed first for comparison.

  python3 -I tools/blender/review/bunk_preview.py <bunk assets dir> <out dir> [designs, default b1,b2,b3] [family, default bunk]
    -> bunk-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, floor, human, iso  # noqa: E402

NAMES = {"b1": "B1  steel frame", "b2": "B2  berth cabinet", "b3": "B3  locker frame",
         "b1a": "B1a  upper railed full length", "b1b": "B1b  both decks railed", "b1c": "B1c  upper walled in",
         "b1d": "B1d  rails all round, thin", "b1e": "B1e  rails all round, thick",
         "b1f": "B1f  solid ends, rails both decks",
         "b1g1": "B1g1  light frame", "b1g2": "B1g2  dark frame, white rails", "b1g3": "B1g3  slate frame, red blanket",
         "b1g3a": "B1g3a  a shade darker", "b1g3b": "B1g3b  two shades darker",
         "b1h": "B1h  pillows 2 px", "b1h1": "B1h  pillows 1 px", "b1h3": "B1h  pillows 3 px (round 9)",
         "s1": "S1  single bed, bunk look", "s2": "S2  single bed, wall rail",
         "s3": "S3  wider mattress", "s3p": "S3p  cap + raised panel", "s3s": "S3s  cap + red band",
         "s3k": "S3k  cap + slots",
         "x1": "X1  treadmill", "x2": "X2  exercise bike", "x3": "X3  cable station",
         "y1": "Y1  omni pad", "y2": "Y2  mag rower", "y3": "Y3  field station"}
CW, CH = 200, 220


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "b1,b2,b3").split(",")
    fam = sys.argv[4] if len(sys.argv) > 4 else "bunk"
    out.mkdir(parents=True, exist_ok=True)
    cols = [("module.bed", pub, "single bed (game)")] if fam == "bunk" else []
    cols += [(f"module.{fam}.{v}", G, NAMES.get(v, v)) for v in names]
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
        cv.save(out / f"{fam}-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
