"""Ground turret preview (plain python3 + numpy + PIL): each ground mount variant (sprites/turret_ground.py) on asteroid
rock, one view each, the roof-modelled turret dropped onto the mount's top ((ZR - top) * zPx), a run of ground cable
leaving its port.

  python3 -I tools/blender/review/ground_turret_preview.py <weapons out dir> <cable art dir> <out dir> [stem] [aim]
    -> ground-turret-variants.png"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from robots_preview import ROOT, Assets, Canvas, iso  # noqa: E402

N = 6                                               # rock patch, tiles 0..N-1; the mount on (2..3, 2..3), cable east
VARIANTS = {"R1": "on the rock", "R2": "steel baseplate", "R3": "apron, hazard band"}
ZR = 2.05


def scene(cv, G, pub, cab, ox, oy, stem, v, aim, zpx):
    for gx in range(N):
        for gy in range(N):
            cv.static(pub, "rock.ground.m15.v0", *iso(ox, oy, gx, gy))
    for i, gx in enumerate(range(4, N)):
        cv.static(cab, f"cable.duct.{'m10.w8' if i == 0 else 'm10'}", *iso(ox, oy, gx, 2))
    cv.static(G, f"module.{stem}.ground.{v}.r0", *iso(ox, oy, 3, 3))
    sx, sy = iso(ox, oy, 2.5, 2.5)
    cv.static(G, f"turret.{stem}.ground.{v}.d{aim}", round(sx), round(sy))


def main():
    G, cab, out = Assets(sys.argv[1]), Assets(sys.argv[2]), Path(sys.argv[3])
    stem = sys.argv[4] if len(sys.argv) > 4 else "burst_laser"
    aim = int(sys.argv[5]) if len(sys.argv) > 5 else 1
    pub = Assets(ROOT / "public/assets/1x")
    zpx = pub.m["heights"]["zPx"]
    out.mkdir(parents=True, exist_ok=True)
    W, H = 330, 250
    cv = Canvas(W * len(VARIANTS), H)
    for i, (v, name) in enumerate(VARIANTS.items()):
        ox, oy = W // 2 + i * W, 70
        scene(cv, G, pub, cab, ox, oy, stem, v, aim, zpx)
        cv.labels.append((ox - 70, H - 22, f"{v}  {name}"))
    cv.save(out / "ground-turret-variants.png", 3)
    print("wrote", out)


if __name__ == "__main__":
    main()
