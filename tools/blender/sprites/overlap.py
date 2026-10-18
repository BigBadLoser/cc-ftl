"""Overlap check for kit-built modules (pure python, no Blender calls beyond what cmbkit imports).

Usage: set `cmbkit.REC = overlap.Recorder()`, put `rec.group = "name"` before each section of the build, run the build
(do not call Mesh.build), then `report(rec.parts, allow)`. Parts are the primitives Frame/detail built: boxes and
cylinders/rings (coaxial bells and collars). A pair from DIFFERENT groups that penetrates by more than `tol` (smallest
overlap extent, so a part sitting flush or sunk a hair into a face is fine) is flagged unless the group pair is in
`allow` (intended mounts: a bell through its bulkhead, a collar around its bell, a slab on the wall...). Group "deck"
is never flagged."""
import itertools
import math
from .cmbkit import Recorder  # noqa: F401  (re-exported)


def _ov(a0, a1, b0, b1):
    return min(a1, b1) - max(a0, b0)


def _rect_dist(c, lo, hi):
    """(min, max) distance from point c to the axis-aligned rectangle lo..hi (2D)."""
    dn = math.hypot(*(max(lo[i] - c[i], 0, c[i] - hi[i]) for i in (0, 1)))
    df = math.hypot(*(max(abs(lo[i] - c[i]), abs(hi[i] - c[i])) for i in (0, 1)))
    return dn, df


def penetration(a, b):
    """Penetration depth (0 if disjoint) of two parts."""
    if a["kind"] == "cyl" and b["kind"] == "box":
        a, b = b, a
    if a["kind"] == "box" and b["kind"] == "box":
        o = [_ov(a["lo"][i], a["hi"][i], b["lo"][i], b["hi"][i]) for i in range(3)]
        return min(o) if min(o) > 0 else 0.0
    if a["kind"] == "box" and b["kind"] == "cyl":
        ax = b["axis"]
        cross = [i for i in range(3) if i != ax]
        la = _ov(a["lo"][ax], a["hi"][ax], *b["a"])
        if la <= 0:
            return 0.0
        dn, df = _rect_dist(b["c"], [a["lo"][i] for i in cross], [a["hi"][i] for i in cross])
        rin, rout = b["r"]
        rad = min(rout, df) - max(rin, dn)
        return min(la, rad) if rad > 0 else 0.0
    # cyl-cyl: coaxial (same axis, same centre) or parallel
    if a["axis"] != b["axis"]:
        return 0.0
    la = _ov(*a["a"], *b["a"])
    if la <= 0:
        return 0.0
    d = math.hypot(a["c"][0] - b["c"][0], a["c"][1] - b["c"][1])
    lo1, hi1, lo2, hi2 = a["r"][0] - d, a["r"][1] + d, b["r"][0] - d, b["r"][1] + d   # radial reach seen from the other axis
    rad = min(a["r"][1] + b["r"][1] - d, a["r"][1] - b["r"][0] if d < 1e-6 else 9, b["r"][1] - a["r"][0] if d < 1e-6 else 9)
    return min(la, rad) if rad > 0 else 0.0


def report(parts, allow, tol=0.04, log=print):
    """Print every flagged group pair (worst penetration, count, an example). Returns the flagged list."""
    allow = {frozenset(p) for p in allow}
    worst = {}
    for a, b in itertools.combinations(parts, 2):
        ga, gb = a["group"], b["group"]
        if ga == gb or "deck" in (ga, gb) or frozenset((ga, gb)) in allow:
            continue
        p = penetration(a, b)
        if p > tol:
            k = tuple(sorted((ga, gb)))
            n, w, ex = worst.get(k, (0, 0.0, None))
            worst[k] = (n + 1, max(w, p), ex if ex and ex[0] >= p else (p, a, b))
    out = []
    for (ga, gb), (n, w, ex) in sorted(worst.items(), key=lambda t: -t[1][1]):
        fmt = lambda s: f"{s['src']}@" + (f"lo{[round(x, 2) for x in s['lo']]} hi{[round(x, 2) for x in s['hi']]}" if s['kind'] == 'box'  # noqa: E731
                                          else f"axis{s['axis']} c{[round(x, 2) for x in s['c']]} r{s['r']} a{[round(x, 2) for x in s['a']]}")
        log(f"CLIP {ga} x {gb}: {n} pairs, worst {w:.2f} e.g. {fmt(ex[1])} <> {fmt(ex[2])}")
        out.append((ga, gb, n, w))
    if not out:
        log("overlap check: clean")
    return out
