"""Overlap + floating + footprint check for the console prototypes (Blender, no render):
  blender -b --factory-startup --python tools/blender/review/proto_console_overlap.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core, cmbkit, overlap, console_proto as C  # noqa: E402

# intended mounts: things standing on / inside desk bodies (rotated boxes are recorded as axis-aligned bounds, so yawed bays
# and chamfers legitimately overlap their neighbours' bounds)
ALLOW = [("screen", "desk"), ("buttons", "desk"), ("greeble", "desk"), ("yoke", "desk"), ("lever", "desk"), ("fire", "desk"),
         ("scope", "desk"), ("hazard", "desk"), ("holo", "desk"), ("pylon", "desk"), ("trunk", "greeble"), ("pipe", "trunk"),
         ("greeble", "pylon"), ("greeble", "trunk"), ("buttons", "screen"), ("holo", "screen"), ("buttons", "yoke")]
GAP = 0.03


def gap(a, b):
    def ext(p):
        if p["kind"] == "box":
            return p["lo"], p["hi"]
        ax, (cu, cz) = p["axis"], p["c"]
        lo, hi = [0] * 3, [0] * 3
        cross = [i for i in range(3) if i != ax]
        lo[ax], hi[ax] = p["a"]
        for i, c in zip(cross, (cu, cz)):
            lo[i], hi[i] = c - p["r"][1], c + p["r"][1]
        return lo, hi
    (al, ah), (bl, bh) = ext(a), ext(b)
    return max(max(al[i] - bh[i], bl[i] - ah[i], 0) for i in range(3)), (al, ah)


def floating(parts):
    """Parts not connected (gap <= GAP, chained) to the floor deck. Returns the loose parts."""
    ok = [p for p in parts if p["group"] == "deck"]
    rest = [p for p in parts if p["group"] != "deck"]
    changed = True
    while changed:
        changed = False
        for p in rest[:]:
            if any(gap(p, q)[0] <= GAP for q in ok):
                ok.append(p)
                rest.remove(p)
                changed = True
    return rest


def run(name, rot):
    nu, nv = C.FOOT[name]
    rec = cmbkit.REC = overlap.Recorder()
    f = cmbkit.Frame(core.Mesh("chk"), rot, centre=C.centre(rot, nu, nv))
    C.BUILD[name](f, True)
    cmbkit.REC = None
    print(f"== {name} r{rot}: {len(rec.parts)} parts")
    overlap.report(rec.parts, ALLOW)
    for p in floating(rec.parts):
        print("FLOATING", p["group"], p["src"], gap(p, p)[1])
    a, b = f.pt(-nu / 2, -nv / 2, 0), f.pt(nu / 2, nv / 2, 0)
    lo = [min(a[i], b[i]) - 0.02 for i in range(2)]
    hi = [max(a[i], b[i]) + 0.02 for i in range(2)]
    for p in rec.parts:
        if p["group"] == "deck":
            continue
        l, h = gap(p, p)[1]
        tol = 0.2 if p['group'] == 'greeble' else 0.03
        if any(l[i] < lo[i] - tol + 0.02 or h[i] > hi[i] + tol - 0.02 for i in range(2)):
            print("OUTSIDE FOOTPRINT", p["group"], p["src"], [round(x, 2) for x in l], [round(x, 2) for x in h], lo, hi)


for n in C.BUILD:
    for r in (0, 1):
        run(n, r)
