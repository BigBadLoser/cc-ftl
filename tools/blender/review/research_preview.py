"""Research bench look study preview (plain python3 + numpy + PIL): the bench designs (research.py) at r0 `.on`, each
on its own, with its translucent `.holo` layer drawn over it (alpha-over, then its glow added).

  python3 -I tools/blender/review/research_preview.py <research assets dir> <out dir>
  python3 -I tools/blender/review/research_preview.py <assets> <out> [designs, comma separated, default c1]
    -> research-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import Assets, Canvas, iso  # noqa: E402

ALL = {"d": "D  specimen tank", "e": "E  holo table", "f": "F  analysis cabinet",
       "g": "G  electron microscope", "h": "H  gantry rig", "i": "I  containment field",
       "j": "J  specimen tank", "k": "K  prototype test bay", "l": "L  light table",
       "l1": "L1  entomologist", "l2": "L2  archivist", "l3": "L3  dissection",
       "l2a": "L2a  reconstruction", "l2b": "L2b  translation", "l2c": "L2c  star chart",
       "r1": "R1  desk extension", "r2": "R2  fragment vitrine", "r3": "R3  flat-file archive",
       "c1": "C1  combined", "x1": "X1  dissection table", "y1": "Y1  sample analyzer",
       "x2": "X2  scanner arch", "x3": "X3  canopy", "x4": "X4  manipulator hood",
       "y2": "Y2  chamber tower", "y3": "Y3  centrifuge", "y4": "Y4  sample tunnel",
       "x5": "X5  cradle", "x6": "X6  cowl", "x7": "X7  pod",
       "y5": "Y5  stepped tower", "y6": "Y6  drum", "y7": "Y7  sample library",
       "x8": "X8  table (blocks)", "y8": "Y8  analyzer (blocks)",
       "x9": "X9  table (flush)", "y9": "Y9  analyzer (flush)",
       "x10": "X10  table (between)", "y10": "Y10  analyzer (between)",
       "x11": "X11  scanner ring", "x12": "X12  trough", "x13": "X13  lift rig",
       "x14": "X14  rail ring", "x15": "X15  surgical arm", "x16": "X16  rotisserie",
       "x17": "X17  reference", "x18": "X18  scanner hood", "x19": "X19  tower"}


def main():
    G, out = Assets(sys.argv[1]), Path(sys.argv[2])
    NAMES = {v: ALL[v] for v in (sys.argv[3] if len(sys.argv) > 3 else "c1").split(",")}
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(230 * len(NAMES), 190)
    for i, v in enumerate(NAMES):
        ox, oy = 115 + i * 230, 100
        sx, sy = iso(ox, oy, 2, 1)
        cv.static(G, f"module.research.{v}.on", sx, sy)
        if f"module.research.{v}.holo" in G.m["assets"]:
            cv.static(G, f"module.research.{v}.holo", sx, sy)
        cv.labels.append((ox - 45, 175, NAMES[v]))
    for s in (1, 3):
        cv.save(out / f"research-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
