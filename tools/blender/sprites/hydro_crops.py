"""Hydroponics crops (hydroponics.py draws them on its beds): greens, protein beans, medicinal herbs and grain, one
plant per tile, each in three stages, kept under the bed's lamp (hmax over the soil). Local frame: modkit.K."""
import math
import random


STAGES = ("sprout", "grow", "ripe")


def _leaf(k, u, v, z, a, L, w, tilt, col):
    """A flat leaf from (u, v, z) out along the angle a, L long and w wide, its tip tilted up by tilt."""
    d = L * 0.48
    k.box(u + d * math.cos(a), v + d * math.sin(a), z, L, w, 0.035, col, top=col, rz=a, ry=-tilt)


def _greens(k, u, v, z, st, seed, hmax):
    """Greens: a low, broad leafy head in bright fresh green. A sprout is a small upright rosette; half grown, one
    open tier; ripe, two tiers of broad leaves round a tight crown."""
    r = random.Random(seed * 11 + 5)
    cols = ("leaf", "leafL", "leafD")
    if st == "sprout":
        for j in range(5):
            _leaf(k, u, v, z, j * math.tau / 5 + r.uniform(-0.2, 0.2), 0.16, 0.09, 0.8, cols[j % 2])
        return
    g = 0.68 if st == "grow" else 1.0
    tiers = ((11, 0.46, 0.17, 0.0, 0.2), (9, 0.34, 0.15, 0.06, 0.4), (7, 0.22, 0.12, 0.12, 0.65))
    for tier, (n, L, w, zz, tilt) in enumerate(tiers):
        for j in range(n):
            a = j * math.tau / n + r.uniform(-0.15, 0.15) + tier * 0.4
            sq = 0.75 if abs(math.sin(a)) > 0.7 else 1.0                       # the soil is narrower in v
            _leaf(k, u, v, z + zz * g, a, L * g * sq, w * g, tilt + (0.15 if st == "grow" else 0), cols[(j + tier) % 3])
    k.box(u, v, z + 0.06 * g, 0.2 * g, 0.2 * g, 0.2 * g, "leafD", top="leafL", rz=r.uniform(0, 1.5), taper=0.5)


def _beans(k, u, v, z, st, seed, hmax):
    """Protein beans: a row of upright canes the full height (set at sowing), a dark green vine climbing each in a
    column, pale pods hanging when ripe."""
    r = random.Random(seed * 13 + 3)
    canes = [(u + du, v + 0.1 + r.uniform(-0.03, 0.03)) for du in (-0.26, 0.0, 0.26)]     # towards the front
    for cu, cv in canes:
        k.box(cu, cv, z, 0.031, 0.031, hmax - 0.02, "cane")
    reach, n = {"sprout": (0.22, 3), "grow": (0.5, 4), "ripe": (0.95, 11)}[st]
    cols = ("beanL", "bean", "beanL", "beanD")
    s = {"sprout": 0.7, "grow": 0.85, "ripe": 1.0}[st]
    for i, (cu, cv) in enumerate(canes):
        for j in range(n):
            zz = z + (j + r.uniform(0.2, 0.8)) / n * reach * hmax
            a = j * 2.4 + i                                                      # spiralling up the cane
            _leaf(k, cu + 0.02 * math.cos(a), cv + 0.02 * math.sin(a), zz, a, 0.15 * s, 0.12 * s, r.uniform(-0.1, 0.3),
                  cols[(i + j) % 4])
        if st == "ripe":                                                         # low leaves spilling to the front
            for j in range(2):
                a = math.pi / 2 + r.uniform(-0.7, 0.7)
                _leaf(k, cu + r.uniform(-0.06, 0.06), cv + 0.03, z + r.uniform(0.01, 0.05), a, 0.17, 0.13,
                      r.uniform(0.1, 0.35), cols[(i + j + 1) % 4])
        if st == "ripe":
            for j in range(3):
                zz = z + r.uniform(0.35, 0.62) * hmax                            # below the lamp, which hides the tops
                a = r.uniform(0, math.tau)
                k.box(cu + 0.07 * math.cos(a), cv + 0.07 * math.sin(a), zz - 0.15, 0.045, 0.045, 0.15, "pod", top="pod",
                      rx=r.uniform(-0.15, 0.15))


def _herbs(k, u, v, z, st, seed, hmax):
    """Medicinal herbs: small bushy clumps in a grey-green touched with dark red; ripe, red flower spikes and pale
    flowers over them."""
    r = random.Random(seed * 17 + 7)
    h = {"sprout": 0.08, "grow": 0.17, "ripe": 0.22}[st]
    spots = [(0.0, 0.0)] + [(0.2 * math.cos(a), 0.17 * math.sin(a)) for a in (i * math.tau / 5 + 0.3 for i in range(5))]
    spots += [(0.34 * math.cos(a), 0.26 * math.sin(a)) for a in (i * math.tau / 6 for i in range(6))]
    if st == "sprout":
        spots = spots[1::2]
    cols = ("herb", "herbD", "herbL", "herbRD")
    for i, (du, dv) in enumerate(spots):                   # each clump: small leaves over a dome
        s = r.uniform(0.85, 1.1) * (1.15 if i == 0 else 1.0)
        rad = (0.1 if st != "sprout" else 0.05) * s
        for j in range(9 if st != "sprout" else 4):
            a, e = r.uniform(0, math.tau), r.uniform(0.15, 1.2)
            lu, lv = u + du + rad * math.cos(a) * math.cos(e), v + dv + rad * math.sin(a) * math.cos(e)
            lz = z + h * s * (0.25 + 0.7 * math.sin(e) / math.sin(1.2))
            k.box(lu, lv, lz, 0.08 * s, 0.05 * s, 0.03, cols[j % 4], top=cols[(j + 1) % 4], rz=a, ry=-0.5)
        k.box(u + du, v + dv, z, rad * 1.2, rad * 1.2, h * s * 0.6, "herbD", taper=0.6)
    if st == "ripe":
        for j in range(12):
            a, d = r.uniform(0, math.tau), r.uniform(0.04, 0.3)
            cu, cv = u + d * math.cos(a), v + d * math.sin(a)
            hs = r.uniform(0.28, min(0.37, hmax - 0.02))
            k.box(cu, cv, z + 0.1, 0.025, 0.025, hs - 0.1, "herbD")
            k.box(cu, cv, z + hs - 0.1, 0.07, 0.07, 0.12, "herbR", top="herbR", taper=0.55)
        for j in range(16):
            a, d = r.uniform(0, math.tau), r.uniform(0.02, 0.32)
            k.box(u + d * math.cos(a), v + d * math.sin(a), z + h * 0.92, 0.055, 0.055, 0.04, "flowerW", top="flowerW")


def _grain(k, u, v, z, st, seed, hmax):
    """Grain: upright stalks in rows. A sprout is rows of green blades; half grown, green stalks with slim green
    heads; ripe, gold straw as tall as the bed lets it be, each with a slim heavy head that nods. Each stalk is
    thicker at its foot, where its blades flare out."""
    r = random.Random(seed * 7 + 2)
    rows = [(u + du + r.uniform(-0.03, 0.03), v + dv + r.uniform(-0.03, 0.03))
            for du in (-0.3, -0.15, 0.0, 0.15, 0.3) for dv in (-0.18, 0.0, 0.18)]
    if st == "sprout":
        for cu, cv in rows:
            for q in range(2):
                k.box(cu + r.uniform(-0.02, 0.02), cv, z, 0.025, 0.025, r.uniform(0.07, 0.12), "leaf",
                      rx=r.uniform(-0.35, 0.35), ry=r.uniform(-0.35, 0.35))
        return
    ripe = st == "ripe"
    for i, (cu, cv) in enumerate(rows):
        h = r.uniform(0.8, 1.0) * (hmax - 0.14) * (1.0 if ripe else 0.62)
        stem = "straw" if ripe else "stalk"
        k.box(cu, cv, z, 0.03, 0.03, h, stem)
        k.box(cu, cv, z, 0.05, 0.05, h * 0.35, stem, taper=0.6)                     # thicker at the foot
        for q in range(3):                                                         # blades flaring from the foot
            b = r.uniform(0, math.tau)
            _leaf(k, cu, cv, z + r.uniform(0.0, 0.06), b, r.uniform(0.13, 0.19), 0.04, r.uniform(0.75, 1.05),
                  ("grainD", "straw", "stalk")[q] if ripe else ("leafD", "stalk", "leaf")[q])
        a = r.uniform(0, math.tau)
        if ripe:
            k.box(cu, cv, z + h - 0.02, 0.055, 0.055, 0.15, ("grain", "grainD")[i % 2], top="grain", taper=0.55,
                  rz=a, ry=0.3 * math.cos(a), rx=0.3 * math.sin(a))
        else:
            k.box(cu, cv, z + h - 0.02, 0.04, 0.04, 0.09, "stalk", top="leafL", taper=0.7, rz=a)


CROPS = {"greens": _greens, "beans": _beans, "herbs": _herbs, "grain": _grain}
