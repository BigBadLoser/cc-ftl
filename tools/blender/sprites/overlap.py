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


def _samples(s):
    """Points along a seg part, spaced <= 0.8 r."""
    a, b, r = s["a"], s["b"], s["r"]
    ln = math.dist(a, b)
    n = max(2, int(ln / (0.8 * r)) + 1)
    return [tuple(a[i] + (b[i] - a[i]) * k / (n - 1) for i in range(3)) for k in range(n)]


def _sdf(p, s):
    """Signed distance from point p to a box / cylinder / ring part (negative inside, = -depth to the nearest face)."""
    if s["kind"] == "box":
        q = [max(s["lo"][i] - p[i], p[i] - s["hi"][i]) for i in range(3)]
        out = math.sqrt(sum(max(x, 0) ** 2 for x in q))
        return out if out > 0 else max(q)
    ax = s["axis"]
    cross = [i for i in range(3) if i != ax]
    d = math.hypot(p[cross[0]] - s["c"][0], p[cross[1]] - s["c"][1])
    m = max(s["r"][0] - d, d - s["r"][1])
    e = max(s["a"][0] - p[ax], p[ax] - s["a"][1])
    return math.hypot(max(m, 0), max(e, 0)) if (m > 0 or e > 0) else max(m, e)


def _flat(s):
    """Short wide solid cylinders (discs, wheels, bolt heads) are tested as their bounding box, not a sampled capsule."""
    if s["kind"] == "cyl" and s["r"][0] == 0 and s["a"][1] - s["a"][0] < s["r"][1]:
        lo, hi = bbox(s)
        return {"kind": "box", "lo": lo, "hi": hi, "group": s["group"], "src": s["src"]}
    return s


def penetration(a, b):
    """Penetration depth (0 if disjoint) of two parts. Segs (pipes, any direction) are sampled along their length."""
    a, b = _flat(a), _flat(b)
    if a["kind"] == "seg" or b["kind"] == "seg":
        if a["kind"] != "seg":
            a, b = b, a
        if b["kind"] == "seg":
            sb = _samples(b)
            return max(0.0, max(a["r"] + b["r"] - math.dist(p, q) for p in _samples(a) for q in sb))
        return max(0.0, max(a["r"] - _sdf(p, b) for p in _samples(a)))
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
    if a["axis"] != b["axis"]:                    # crossing cylinders: sample the thinner along its axis, test against the other
        if a["r"][1] > b["r"][1]:
            a, b = b, a
        ax = a["axis"]
        cross = [i for i in range(3) if i != ax]
        n = max(2, int((a["a"][1] - a["a"][0]) / (0.8 * a["r"][1])) + 1)
        pts = []
        for k in range(n):
            p = [0.0, 0.0, 0.0]
            p[ax] = a["a"][0] + (a["a"][1] - a["a"][0]) * k / (n - 1)
            p[cross[0]], p[cross[1]] = a["c"]
            pts.append(tuple(p))
        return max(0.0, max(a["r"][1] - _sdf(p, b) for p in pts))
    la = _ov(*a["a"], *b["a"])
    if la <= 0:
        return 0.0
    d = math.hypot(a["c"][0] - b["c"][0], a["c"][1] - b["c"][1])
    rad = min(a["r"][1] + b["r"][1] - d, a["r"][1] - b["r"][0] if d < 1e-6 else 9, b["r"][1] - a["r"][0] if d < 1e-6 else 9)
    return min(la, rad) if rad > 0 else 0.0


def bbox(s):
    if s["kind"] == "box":
        return s["lo"], s["hi"]
    if s["kind"] == "seg":
        r = s["r"]
        return [min(s["a"][i], s["b"][i]) - r for i in range(3)], [max(s["a"][i], s["b"][i]) + r for i in range(3)]
    ax, ro = s["axis"], s["r"][1]
    cross = [i for i in range(3) if i != ax]
    lo, hi = [0, 0, 0], [0, 0, 0]
    lo[ax], hi[ax] = s["a"]
    for k, i in enumerate(cross):
        lo[i], hi[i] = s["c"][k] - ro, s["c"][k] + ro
    return lo, hi


def floating(parts, eps=0.03, anchors=("deck", "wall"), log=print):
    """Parts not connected to an anchor group (deck, wall) through a chain of touching parts (bounding boxes grown by
    eps). Catches stray arcs, hoops and pipes hanging in the air. Returns the unreachable parts."""
    bb = [bbox(p) for p in parts]
    touch = lambda i, j: all(bb[i][0][k] - eps <= bb[j][1][k] and bb[j][0][k] - eps <= bb[i][1][k] for k in range(3))  # noqa: E731
    seen = {i for i, p in enumerate(parts) if p["group"] in anchors}
    todo = list(seen)
    while todo:
        i = todo.pop()
        for j in range(len(parts)):
            if j not in seen and touch(i, j):
                seen.add(j)
                todo.append(j)
    out = [parts[i] for i in range(len(parts)) if i not in seen]
    for p in out:
        lo, hi = bbox(p)
        log(f"FLOAT {p['group']}: {p['src']} lo{[round(x, 2) for x in lo]} hi{[round(x, 2) for x in hi]}")
    return out


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
        fmt = lambda s: f"{s['src']}@lo{[round(x, 2) for x in bbox(s)[0]]} hi{[round(x, 2) for x in bbox(s)[1]]}"  # noqa: E731
        log(f"CLIP {ga} x {gb}: {n} pairs, worst {w:.2f} e.g. {fmt(ex[1])} <> {fmt(ex[2])}")
        out.append((ga, gb, n, w))
    if not out:
        log("overlap check: clean")
    return out
