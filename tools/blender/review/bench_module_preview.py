"""Bench module preview (plain python3 + numpy + PIL): every rotation empty, then with a crew member on each of the three
seats as the renderer layers them (the bench, the sitters nearest last, the front overlay over them).

  python3 -I tools/blender/review/bench_module_preview.py <bench_module out dir> <out dir>
    -> bench-seated-3x.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, human, iso  # noqa: E402

SEATS = ((-0.6, -0.11), (0.0, -0.11), (0.6, -0.11))     # sprites/bench.py SEATS (bench_r13 SEATS, SIT_V)
FACING = {0: 2, 1: 4, 2: 6, 3: 0}                    # bench.facing: consoles.SEAT_DIR turned half way
CLIP = "sit_bench"


def grid(rot, u, v):
    """modkit.K.p for the 2x1 footprint."""
    x, y = ((u, v), (-v, u), (-u, -v), (v, -u))[rot]
    w, d = (2, 1) if rot % 2 == 0 else (1, 2)
    return x - (w - 1) / 2, y - (d - 1) / 2


def scene(cv, G, pub, ox, oy, rot, crew):
    for gx in range(-1, 3):
        for gy in range(-1, 3):
            cv.static(pub, "tile.floor.a", *iso(ox, oy, gx, gy))
    cv.static(G, f"module.bench.r{rot}", *iso(ox, oy, 0, 0))
    if not crew:
        return
    for gx, gy in sorted((grid(rot, u, v) for u, v in SEATS), key=lambda p: p[0] + p[1]):
        sx, sy = iso(ox, oy, gx, gy)
        cv.char(human(pub, FACING[rot], CLIP), round(sx), round(sy))
    fid = f"module.bench.front.r{rot}"
    if fid in G.m["assets"]:
        cv.static(G, fid, *iso(ox, oy, 0, 0))


HIDDEN_A = 12                                        # sprites/human_render.HIDDEN_A: the runtime draws it as nothing


def as_game(pub):
    """Crew frames as the runtime draws them: the sit clips' chair-cut pixels (alpha HIDDEN_A) left out."""
    frame = pub.frame

    def f(*a, **kw):
        img, g, an = frame(*a, **kw)
        img = img.copy()
        img[img[..., 3] == HIDDEN_A] = 0
        return img, g, an
    pub.frame = f
    return pub


def main():
    G, pub, out = Assets(sys.argv[1]), as_game(Assets(ROOT / "public/assets/1x")), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    cv = Canvas(200 * 4, 170 * 2)
    for row, crew in enumerate((False, True)):
        for r in range(4):
            ox, oy = 100 + r * 200, 105 + row * 170
            scene(cv, G, pub, ox, oy, r, crew)
            cv.labels.append((ox - 30, oy + 60, f"r{r} {'seated' if crew else 'empty'}"))
    cv.save(out / "bench-seated-3x.png", 3)
    print("wrote", out)


if __name__ == "__main__":
    main()
