"""Holo game table look study preview (plain python3 + numpy + PIL): each design on its 2x1 tiles with the tiles in front
and behind, two crew seated at it (front left facing -y, back right facing +y).

  python3 -I tools/blender/review/gametable_preview.py <gametable dir> <out dir> [designs, default m1,m2,m3]
    -> gametable-1x.png / -3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, human, iso  # noqa: E402

NAMES = {"k1": "K1  strategy board", "k2": "K2  tabletop battle", "k3": "K3  card game",
         "l1": "L1  cards, K table", "l2": "L2  casino table", "l3": "L3  card dais",
         "m1": "M1  disc duel", "m2": "M2  drop four", "m3": "M3  creature duel",
         "n1a": "N1 ridge, drop four", "n1b": "N1 ridge, duel", "n2a": "N2 cantilever, drop four",
         "n2b": "N2 cantilever, duel", "n3a": "N3 ring, drop four", "n3b": "N3 ring, duel",
         "p1a": "P1 ridge, drop A", "p1b": "P1 ridge, duel A", "p2a": "P2 cantilever, drop B 3D",
         "p2b": "P2 cantilever, duel B", "p3a": "P3 ring, drop B 3D", "p3b": "P3 ring, duel A",
         "q1": "Q1 drop four, big", "q2": "Q2 drop four, tubes", "q3": "Q3 duel, arena",
         "q4": "Q4 duel, on the dais"}
FRONT, BACK = 6, 2                                  # crew sheet rows facing -y and +y


def main():
    G, pub, out = Assets(sys.argv[1]), Assets(ROOT / "public/assets/1x"), Path(sys.argv[2])
    names = (sys.argv[3] if len(sys.argv) > 3 else "m2,q1,q2,q3,q4").split(",")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(220 * len(names), 220)
    for i, v in enumerate(names):
        ox, oy = 130 + i * 220, 120
        for gx in (-1, 0):
            for gy in (-1, 0, 1):
                cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
        cv.char(human(pub, BACK, "sit_idle"), *iso(ox, oy, 0, -1))
        cv.static(G, f"module.gametable.{v}", *iso(ox, oy, 0, 0))
        if f"module.gametable.{v}.holo" in G.m["assets"]:
            cv.static(G, f"module.gametable.{v}.holo", *iso(ox, oy, 0, 0))
        cv.char(human(pub, FRONT, "sit_idle"), *iso(ox, oy, -1, 1))
        cv.labels.append((ox - 70, 205, NAMES.get(v, v)))
    for s in (1, 3):
        cv.save(out / f"gametable-{s}x.png", s)
    print("wrote", out)


if __name__ == "__main__":
    main()
