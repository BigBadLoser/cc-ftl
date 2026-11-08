"""Research bench look study preview (plain python3 + numpy + PIL): the bench designs (research.py) at r0 `.on`, each
on its own, with its translucent `.holo` layer drawn over it (alpha-over, then its glow added).

  python3 -I tools/blender/review/research_preview.py <research assets dir> <out dir>
    -> research-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import Assets, Canvas, iso  # noqa: E402

NAMES = {"d": "D  specimen tank", "e": "E  holo table", "f": "F  analysis cabinet"}


def main():
    G, out = Assets(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(690, 190)
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
