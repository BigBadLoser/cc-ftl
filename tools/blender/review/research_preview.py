"""Research bench look study preview (plain python3 + numpy + PIL): the three bench designs (research.py a, b, c) at
r0 `.on`, each in a walled room with a crew member seated at the chair (sit_work, facing into the bench, the backrest
overlay drawn over them) and one standing for scale.

  python3 -I tools/blender/review/research_preview.py <research assets dir> <out dir>
    -> research-1x.png / -3x.png (all three), research-<v>-3x.png (one each)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import Assets, Canvas, human, iso  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]


class Crew(Assets):
    """Crew clips are trimmed: each frame is a cw x ch cell at (ox, oy) in the layer's frameW x frameH frame."""

    def frame(self, aid, d, clip, i):
        a = self.m["assets"][aid]
        c = a["clips"][clip]
        cw, ch = c["cw"], c["ch"]
        sh = self.m["sheets"][c["sheet"]]
        sl = (slice(d * ch, (d + 1) * ch), slice((c["start"] + i) * cw, (c["start"] + i + 1) * cw))
        g = self.img(sh["glow"])[sl] if "glow" in sh else None
        return self.img(sh["image"])[sl], g, {"x": a["anchor"]["x"] - c["ox"], "y": a["anchor"]["y"] - c["oy"]}


NAMES = {"a": "A  lab bench (amber)", "b": "B  U desk (mint)", "c": "C  glovebox (lime)"}


def room(cv, G, pub, ox, oy, v):
    nx, ny = 5, 4
    for gx in range(nx):
        for gy in range(ny):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
    cv.static(pub, "tile.wall.full.m6", *iso(ox, oy, -1, -1))
    for gx in range(nx):
        cv.static(pub, "tile.wall.full.m10", *iso(ox, oy, gx, -1))
    for gy in range(ny):
        cv.static(pub, "tile.wall.full.m5", *iso(ox, oy, -1, gy))
    # bench footprint x 1..3, y 0..1 (anchor: the front-most tile (3, 1)); chair at (2, 1)
    cv.static(G, f"module.research.{v}.on", *iso(ox, oy, 3, 1))
    cv.char(human(pub, 6, "sit_work", 2), *iso(ox, oy, 2, 1))
    cv.static(G, f"module.research.{v}.front", *iso(ox, oy, 3, 1))
    cv.char(human(pub, 0), *iso(ox, oy, 0, 3))
    cv.labels.append((ox - 140, oy + 120, NAMES[v]))


def main():
    G, out = Assets(sys.argv[1]), Path(sys.argv[2])
    pub = Crew(ROOT / "public/assets/1x")
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(1020, 300)
    for i, v in enumerate("abc"):
        room(cv, G, pub, 170 + i * 340, 110, v)
    for s in (1, 3):
        cv.save(out / f"research-{s}x.png", s)
    for v in "abc":
        one = Canvas(340, 300)
        room(one, G, pub, 170, 110, v)
        one.save(out / f"research-{v}-3x.png", 3)
    print("wrote", out)


if __name__ == "__main__":
    main()
