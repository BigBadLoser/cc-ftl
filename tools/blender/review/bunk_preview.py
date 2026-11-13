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
         "v4j": "V4j  arms at rest", "v4k": "V4k  elbows wide", "v4l": "V4l  goalpost guard",
         "v4m": "V4m  guard, small gloves", "v4n": "V4n  + small shoulders", "v4o": "V4o  + livery forearms",
         "v4p": "V4p  shoulders out a little", "v4q": "V4q  shoulders out more", "v4r": "V4r  shoulders out most",
         "v4s": "V4s  guard forward", "v4t": "V4t  guard further", "v4u": "V4u  guard furthest",
         "v5a": "V5a  discs + robot details", "v5b": "V5b  clevis + robot details", "v5c": "V5c  robot hinge, guard forward",
         "v6a": "V6a  round, leaning", "v6b": "V6b  athletic, leaning", "v6c": "V6c  heavy + ear plates",
         "v6d": "V6d  white upper, dark gauntlet", "v6e": "V6e  dark upper, white gauntlet", "v6f": "V6f  elbows down, forearms up",
         "v6g": "V6g  grey arms, elbows out", "v6h": "V6h  grey arms, elbows down", "v6i": "V6i  warm grey, darkest joints",
         "bn1": "BN1  cantilever", "bn2": "BN2  lounge shell", "bn3": "BN3  slat bench",
         "bn2a": "BN2A  solid body", "bn2b": "BN2B  end panels", "bn2c": "BN2C  pedestal",
         "bn4": "BN4  ribbon", "bn5": "BN5  lander legs", "bn6": "BN6  sled",
         "bn7": "BN7  seat row", "bn8": "BN8  crescent", "bn9": "BN9  jump seats",
         "bn10": "BN10  hoop", "bn11": "BN11  monoliths", "bn12": "BN12  glass back",
         "bn13": "BN13  fuel tank", "bn14": "BN14  pebbles", "bn15": "BN15  truss",
         "bn16": "BN16  locker room", "bn17": "BN17  park bench", "bn18": "BN18  waiting room",
         "bn18a": "BN18A  pad arms", "bn18b": "BN18B  end loops", "bn18c": "BN18C  with table",
         "bn18d": "BN18D  three legs", "bn18e": "BN18E  gap legs", "bn18f": "BN18F  floor rail",
         "bn18g": "BN18G  four frames", "bn18h": "BN18H  splayed ends", "bn18i": "BN18I  stretcher",
         "bn18j": "BN18J  plinth", "bn18k": "BN18K  sled legs", "bn18l": "BN18L  back spine",
         "bn18m": "BN18M  end T-legs", "bn18n": "BN18N  panel ends", "bn18o": "BN18O  posts",
         "pl1": "PL1  glazed pot", "pl2": "PL2  grow trough", "pl3": "PL3  bio-dome",
         "pl1a": "PL1A  taller", "pl1b": "PL1B  upright blades", "pl1c": "PL1C  footed",
         "vm1": "VM1  snack tower", "vm2": "VM2  can column", "vm3": "VM3  ration printer"}
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
        cv.char(human(pub, 6), *iso(ox, oy, -1, 1) if not fam.startswith("bench") else iso(ox, oy, 2, -1))
        cv.labels.append((ox - 50, oy + 52, label))
    for s in (1, 3):
        cv.save(out / f"{fam}-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
