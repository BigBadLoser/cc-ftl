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
         "y1": "Y1  omni pad", "y2": "Y2  mag rower", "y3": "Y3  field station",
         "z1": "Z1  gyro hoop", "z2": "Z2  hover bike", "z3": "Z3  climb wall",
         "w1": "W1  swoop bike", "w2": "W2  arc treadmill", "w3": "W3  press chair",
         "v1": "V1  centrifuge wheel", "v2": "V2  swim tank", "v3": "V3  sparring droid",
         "v3a": "V3a  guard droid", "v3b": "V3b  drill column", "v3c": "V3c  hover droid",
         "v3d": "V3d  no chest pad", "v3e": "V3e  no floor mat", "v3f": "V3f  neither",
         "v3g": "V3g  dark head, sockets", "v3h": "V3h  faceplate, yoke", "v3i": "V3i  cyclops, ball joints",
         "v3j": "V3j  boxer", "v3k": "V3k  faceplate, twin rods", "v3l": "V3l  heavy",
         "v3j0": "V3j  boxer, original turn",
         "v3m": "V3m  T visor", "v3n": "V3n  two eyes", "v3o": "V3o  face shield",
         "v3mc": "V3m  facing camera", "v3nc": "V3n  facing camera", "v3oc": "V3o  facing camera",
         "v3p": "V3p  white cap", "v3q": "V3q  white ear plates", "v3r": "V3r  white head, dark T",
         "v3qr": "V3q  red eyes", "v3qa": "V3q  amber eyes", "v3qg": "V3q  green eyes",
         "v3s": "V3s  tucked guard", "v3t": "V3t  hinge elbows", "v3u": "V3u  piston elbows",
         "v3t1": "V3t1  hinge capsule", "v3t2": "V3t2  joint discs", "v3t3": "V3t3  clevis + guard",
         "v4a": "V4a  robot style, worker", "v4b": "V4b  robot style, heavy", "v4c": "V4c  robot style, shell head",
         "v4b1": "V4b1  shoulders +1.6 px", "v4b2": "V4b2  shoulders +2.9 px", "v4b3": "V4b3  shoulders +4.2 px",
         "v4d": "V4d  high guard", "v4e": "V4e  boxer stance", "v4f": "V4f  focus mitts",
         "v4g": "V4g  upright, high guard", "v4h": "V4h  slight lean, high guard", "v4i": "V4i  upright, first guard",
         "v4j": "V4j  arms at rest", "v4k": "V4k  elbows wide", "v4l": "V4l  goalpost guard"}
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
